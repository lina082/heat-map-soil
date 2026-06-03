import logging
import signal
import sys
from datetime import datetime

import paho.mqtt.client as mqtt

import emitter
import storage
from config import BROKER, PORT, TOPIC, KEEPALIVE, RUN_TIMEOUT_SECONDS
from parser import topic_type, decode_payload, extract_data_fields, TOPIC_DATA
from run_manager import RunManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

db = None
run_manager = RunManager(timeout_seconds=RUN_TIMEOUT_SECONDS)


def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code == 0:
        logger.info(f"Connected to broker {BROKER}:{PORT}")
        client.subscribe(TOPIC)
        logger.info(f"Subscribed to: {TOPIC}")
        if db:
            storage.log_event(db, "INFO", "broker_connected",
                              f"Connected to {BROKER}:{PORT}, subscribed to {TOPIC}")
    else:
        logger.error(f"Connection failed. Code: {reason_code}")
        if db:
            storage.log_event(db, "ERROR", "broker_connect_failed",
                              f"Connection to {BROKER}:{PORT} failed",
                              metadata={"reason_code": str(reason_code)})


def on_disconnect(client, userdata, flags, reason_code, properties):
    logger.warning(f"Disconnected from broker. Code: {reason_code}")
    emitter.emit_robot_offline()
    if db:
        storage.log_event(db, "WARNING", "broker_disconnected",
                          f"Disconnected from broker",
                          metadata={"reason_code": str(reason_code)})


def on_message(client, userdata, msg):
    raw = msg.payload.decode("utf-8", errors="ignore")
    kind = topic_type(msg.topic)

    if kind != TOPIC_DATA:
        return

    payload = decode_payload(raw)
    if payload is None:
        storage.log_event(db, "WARNING", "mqtt_parse_error",
                          f"Failed to decode payload on topic {msg.topic}",
                          metadata={"raw": raw[:200]})
        return

    fields = extract_data_fields(payload)
    if fields is None:
        storage.log_event(db, "WARNING", "mqtt_field_error",
                          f"Missing required fields in payload on topic {msg.topic}",
                          metadata={"payload": str(payload)[:200]})
        return

    now = datetime.utcnow()
    indice = fields["indice_recorrido"]

    if run_manager.is_new_run(indice, now):
        prev_run_id = run_manager.active_run_id
        if prev_run_id:
            storage.close_run(db, prev_run_id, now)
            emitter.emit_run_completed(prev_run_id, run_manager._last_index + 1)
            storage.log_event(db, "INFO", "run_completed",
                              f"Run {prev_run_id} closed by new run detection",
                              run_id=prev_run_id)

        run_id = run_manager.start_run(fields["device_id"], now)
        storage.create_run(db, run_id, fields["device_id"], fields["timestamp"])
        emitter.emit_run_started(run_id, fields["device_id"])
        emitter.emit_robot_online(run_id)
        storage.log_event(db, "INFO", "run_started",
                          f"New run started for device {fields['device_id']}",
                          run_id=run_id,
                          metadata={"device_id": fields["device_id"]})

    run_id = run_manager.active_run_id
    doc = {**fields, "run_id": run_id, "received_at": now}

    storage.save_measurement(db, doc)
    storage.increment_run_count(db, run_id)
    run_manager.update(indice, now)

    emitter.emit_measurement(doc)

    if run_manager.is_complete(fields["total_puntos"]):
        storage.close_run(db, run_id, now)
        emitter.emit_run_completed(run_id, fields["total_puntos"])
        logger.info(f"Run completed: {run_id} | {fields['total_puntos']} measurements")
        storage.log_event(db, "INFO", "run_completed",
                          f"Run finished with {fields['total_puntos']} measurements",
                          run_id=run_id,
                          metadata={"total_puntos": fields["total_puntos"]})


def _log_event(event_type: str, data: dict) -> None:
    logger.info(f"[EVENT] {event_type}: {data}")


def main():
    global db

    try:
        db = storage.connect()
    except Exception as e:
        logger.critical(f"Cannot connect to PostgreSQL: {e}")
        sys.exit(1)

    storage.log_event(db, "INFO", "service_started", "mqtt-service started")

    # resume active run from DB if service restarted mid-sweep
    active = storage.get_active_run(db)
    if active:
        run_manager.resume(
            active["run_id"],
            active["device_id"],
            active["last_index"],
            datetime.utcnow(),
        )
        logger.info(f"Resumed active run {active['run_id']} at index {active['last_index']}")

    emitter.register_callback(_log_event)

    client = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message

    def shutdown(sig, frame):
        logger.info("Shutting down...")
        storage.log_event(db, "INFO", "service_stopped", "mqtt-service shutting down")
        if run_manager.active_run_id:
            storage.close_run(db, run_manager.active_run_id, datetime.utcnow())
        client.disconnect()
        if db and not db.closed:
            db.close()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    logger.info(f"Connecting to {BROKER}:{PORT} ...")
    client.connect(BROKER, PORT, KEEPALIVE)
    client.loop_forever()


if __name__ == "__main__":
    main()
