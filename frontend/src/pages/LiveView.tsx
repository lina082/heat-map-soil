import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import { useGrid } from "../hooks/useGrid";
import { useWebSocket } from "../hooks/useWebSocket";
import { HeatMapCanvas } from "../components/HeatMapCanvas";
import { ColorLegend } from "../components/ColorLegend";
import { VariableSelector } from "../components/VariableSelector";
import { ProgressBar } from "../components/ProgressBar";
import { LiveBadge } from "../components/LiveBadge";
import { CellPopup } from "../components/CellPopup";
import type { CellDetail, LiveStatus, VariableMeta, WsMessage } from "../types";

export function LiveView() {
  const [variables, setVariables] = useState<VariableMeta[]>([]);
  const [selectedVar, setSelectedVar] = useState("humedad_suelo_pct");
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [totalPoints, setTotalPoints] = useState(10000);
  const [selectedCell, setSelectedCell] = useState<CellDetail | null>(null);
  const [loadingCell, setLoadingCell] = useState(false);

  const { grid, min, max, loadGrid, addCell, reset } = useGrid();

  useEffect(() => {
    api.variables.list().then(setVariables).catch(console.error);
    api.live.status().then((status) => {
      setLiveStatus(status);
      if (status.run_id) setActiveRunId(status.run_id);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!activeRunId) return;
    reset();
    api.grid.get(activeRunId, selectedVar).then((res) => {
      loadGrid(res.grid, res.min, res.max);
    }).catch(console.error);
  }, [activeRunId, selectedVar, reset, loadGrid]);

  const handleWsMessage = useCallback((msg: WsMessage) => {
    if (msg.type === "measurement") {
      const d = msg.data as Record<string, unknown>;
      const x = d.x_m as number;
      const y = d.y_m as number;
      const value = d[selectedVar] as number | undefined;
      if (value !== undefined) addCell(x, y, value);
      setTotalPoints((d.total_puntos as number) ?? 10000);
      setLiveStatus((prev) => ({
        ...(prev ?? { online: true, device_id: null, run_id: null, last_x: null, last_y: null, indice_recorrido: null, progress_pct: null, last_seen: null }),
        online: true,
        last_x: x,
        last_y: y,
        indice_recorrido: d.indice_recorrido as number,
        progress_pct: ((d.indice_recorrido as number) / (d.total_puntos as number)) * 100,
        last_seen: new Date().toISOString(),
      }));
    }
    if (msg.type === "run_started") {
      const d = msg.data as { run_id: string };
      setActiveRunId(d.run_id);
      reset();
    }
    if (msg.type === "robot_online") {
      setLiveStatus((prev) => prev ? { ...prev, online: true } : null);
    }
    if (msg.type === "robot_offline") {
      setLiveStatus((prev) => prev ? { ...prev, online: false } : null);
    }
  }, [selectedVar, addCell, reset]);

  useWebSocket(handleWsMessage);

  async function handleCellClick(x: number, y: number) {
    if (!activeRunId) return;
    setLoadingCell(true);
    try {
      const detail = await api.grid.cell(activeRunId, x, y);
      setSelectedCell(detail);
    } catch {
      // not yet measured
    } finally {
      setLoadingCell(false);
    }
  }

  const currentVar = variables.find((v) => v.key === selectedVar);
  const measured = liveStatus?.indice_recorrido ?? grid.size;

  return (
    <div className="flex flex-col gap-6">

      {/* top bar */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink tracking-tight">Recorrido en vivo</h1>
          {liveStatus?.device_id && (
            <p className="font-mono text-xs text-ink-faint mt-1">{liveStatus.device_id}</p>
          )}
        </div>
        <LiveBadge online={liveStatus?.online ?? false} lastSeen={liveStatus?.last_seen ?? null} />
      </div>

      {/* controls row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-1.5">
          <VariableSelector variables={variables} selected={selectedVar} onChange={setSelectedVar} />
          {currentVar?.description && (
            <p className="text-xs text-ink-muted leading-relaxed">{currentVar.description}</p>
          )}
        </div>
        <ProgressBar measured={measured} total={totalPoints} />
      </div>

      {/* notice */}
      {grid.size > 0 && grid.size < 500 && (
        <div className="border-l-2 border-brand bg-brand/5 px-4 py-3 text-sm text-ink-muted">
          Robot en progreso — <span className="font-mono text-ink">{grid.size.toLocaleString("es-CO")}</span> de 10.000 puntos medidos.
          Las zonas grises aún no han sido recorridas.
        </div>
      )}
      {grid.size === 0 && liveStatus?.online && (
        <div className="border-l-2 border-ink-faint bg-surface-raised px-4 py-3 text-sm text-ink-muted">
          Robot conectado. Esperando primera medición...
        </div>
      )}

      {/* map panel */}
      <div className="bg-surface-raised border border-surface-border p-4 flex flex-col gap-4">
        <div className="aspect-square w-full max-w-2xl mx-auto">
          <HeatMapCanvas
            grid={grid}
            min={min === Infinity ? 0 : min}
            max={max === -Infinity ? 1 : max}
            unit={currentVar?.unit ?? ""}
            robotX={liveStatus?.last_x ?? null}
            robotY={liveStatus?.last_y ?? null}
            onCellClick={handleCellClick}
          />
        </div>

        {currentVar && min !== Infinity && (
          <ColorLegend min={min} max={max} unit={currentVar.unit} label={currentVar.label} />
        )}

        {liveStatus?.last_x !== null && liveStatus?.last_y !== null && (
          <p className="font-mono text-xs text-ink-faint text-center">
            posición robot → x={liveStatus?.last_x}  y={liveStatus?.last_y}  ·  fila {liveStatus?.last_y}/100
          </p>
        )}

        {loadingCell && (
          <p className="text-center text-xs text-ink-faint font-mono">cargando punto...</p>
        )}
      </div>

      {selectedCell && (
        <CellPopup cell={selectedCell} onClose={() => setSelectedCell(null)} />
      )}
    </div>
  );
}
