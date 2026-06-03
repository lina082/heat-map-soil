import os

BROKER = os.getenv("MQTT_BROKER", "190.248.28.132")
PORT = int(os.getenv("MQTT_PORT", "3001"))
TOPIC = os.getenv("MQTT_TOPIC", "suelo/robot-01/#")
KEEPALIVE = int(os.getenv("MQTT_KEEPALIVE", "60"))

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://heatmap:heatmap@localhost:5432/heatmap_soil",
)

BACKEND_BROADCAST_URL = os.getenv(
    "BACKEND_BROADCAST_URL",
    "http://backend:8000/internal/broadcast",
)

# seconds of inactivity before a run is considered timed out
RUN_TIMEOUT_SECONDS = int(os.getenv("RUN_TIMEOUT_SECONDS", "1800"))
