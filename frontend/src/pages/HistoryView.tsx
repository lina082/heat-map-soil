import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useGrid } from "../hooks/useGrid";
import { HeatMapCanvas } from "../components/HeatMapCanvas";
import { ColorLegend } from "../components/ColorLegend";
import { VariableSelector } from "../components/VariableSelector";
import { CellPopup } from "../components/CellPopup";
import type { CellDetail, Run, VariableMeta } from "../types";
import { ChevronLeft } from "lucide-react";

function formatRunDate(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function HistoryView() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [variables, setVariables] = useState<VariableMeta[]>([]);
  const [selectedVar, setSelectedVar] = useState("humedad_suelo_pct");
  const [selectedCell, setSelectedCell] = useState<CellDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const { grid, min, max, loadGrid, reset } = useGrid();

  useEffect(() => {
    api.runs.list().then(setRuns).catch(console.error);
    api.variables.list().then(setVariables).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedRun) return;
    setLoading(true);
    reset();
    api.grid.get(selectedRun.run_id, selectedVar)
      .then((res) => loadGrid(res.grid, res.min, res.max))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedRun, selectedVar, reset, loadGrid]);

  async function handleCellClick(x: number, y: number) {
    if (!selectedRun) return;
    try {
      const detail = await api.grid.cell(selectedRun.run_id, x, y);
      setSelectedCell(detail);
    } catch { /* not measured */ }
  }

  const currentVar = variables.find((v) => v.key === selectedVar);

  if (!selectedRun) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-bold text-ink tracking-tight">Recorridos anteriores</h1>

        {runs.length === 0 ? (
          <p className="text-ink-faint font-mono text-sm text-center py-16">
            — sin recorridos registrados —
          </p>
        ) : (
          <div className="flex flex-col gap-0 border border-surface-border divide-y divide-surface-border">
            {runs.map((run) => (
              <button
                key={run.run_id}
                onClick={() => setSelectedRun(run)}
                className="bg-surface-raised hover:bg-surface-overlay px-5 py-4 text-left transition-colors group"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-ink group-hover:text-brand transition-colors">
                      {run.label ?? formatRunDate(run.started_at)}
                    </p>
                    <p className="font-mono text-xs text-ink-faint">
                      {run.total_measurements.toLocaleString("es-CO")} puntos
                      {run.ended_at ? `  ·  finalizado ${formatRunDate(run.ended_at)}` : ""}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold font-mono px-2 py-0.5 border ${
                    run.status === "active"
                      ? "border-brand/40 text-brand bg-brand/10"
                      : "border-surface-subtle text-ink-faint"
                  }`}>
                    {run.status === "active" ? "EN CURSO" : "COMPLETADO"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => { setSelectedRun(null); reset(); }}
          className="flex items-center gap-1 text-xs text-ink-faint hover:text-ink transition-colors font-semibold uppercase tracking-widest"
        >
          <ChevronLeft size={14} />
          Historial
        </button>
        <span className="text-surface-subtle">/</span>
        <span className="text-sm font-semibold text-ink truncate">
          {selectedRun.label ?? formatRunDate(selectedRun.started_at)}
        </span>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-48">
          <VariableSelector variables={variables} selected={selectedVar} onChange={setSelectedVar} />
        </div>
        <span className="font-mono text-xs text-ink-faint">
          {selectedRun.total_measurements.toLocaleString("es-CO")} puntos
        </span>
      </div>

      <div className="bg-surface-raised border border-surface-border p-4 flex flex-col gap-4">
        {loading ? (
          <div className="aspect-square w-full max-w-2xl mx-auto flex items-center justify-center bg-surface">
            <p className="font-mono text-xs text-ink-faint">cargando mapa...</p>
          </div>
        ) : (
          <div className="aspect-square w-full max-w-2xl mx-auto">
            <HeatMapCanvas
              grid={grid}
              min={min === Infinity ? 0 : min}
              max={max === -Infinity ? 1 : max}
              unit={currentVar?.unit ?? ""}
              robotX={null}
              robotY={null}
              onCellClick={handleCellClick}
            />
          </div>
        )}
        {currentVar && min !== Infinity && (
          <ColorLegend min={min} max={max} unit={currentVar.unit} label={currentVar.label} />
        )}
      </div>

      {selectedCell && (
        <CellPopup cell={selectedCell} onClose={() => setSelectedCell(null)} />
      )}
    </div>
  );
}
