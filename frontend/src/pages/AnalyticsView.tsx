import { useEffect, useState } from "react";
import { api } from "../api/client";
import { TreemapChart } from "../components/TreemapChart";
import { VariableSelector } from "../components/VariableSelector";
import type { DistributionBin, Run, RunStats, VariableMeta } from "../types";

const VARIABLE_UNITS: Record<string, string> = {
  humedad_suelo_pct: "%", temperatura_suelo_c: "°C", intensidad_luz: "lux",
  lluvia_mm_h: "mm/h", temperatura_ambiente_c: "°C", distancia_rio_m: "m",
  influencia_rio: "", retencion_suelo: "", drenaje: "", sombra: "",
};

function StatCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="bg-surface-raised border border-surface-border p-4 flex flex-col gap-2">
      <span className="text-xs font-semibold text-ink-faint uppercase tracking-widest">{label}</span>
      <span className="font-mono text-2xl font-bold text-ink tabular-nums">
        {value.toLocaleString("es-CO", { maximumFractionDigits: 2 })}
        <span className="text-sm font-normal text-ink-faint ml-1">{unit}</span>
      </span>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function AnalyticsView() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [variables, setVariables] = useState<VariableMeta[]>([]);
  const [selectedVar, setSelectedVar] = useState("humedad_suelo_pct");
  const [stats, setStats] = useState<RunStats[]>([]);
  const [distribution, setDistribution] = useState<DistributionBin[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingDist, setLoadingDist] = useState(false);

  useEffect(() => {
    api.runs.list().then((r) => { setRuns(r); if (r.length > 0) setSelectedRunId(r[0].run_id); });
    api.variables.list().then(setVariables);
  }, []);

  useEffect(() => {
    if (!selectedRunId) return;
    setLoadingStats(true);
    api.runs.stats(selectedRunId).then(setStats).catch(console.error).finally(() => setLoadingStats(false));
  }, [selectedRunId]);

  useEffect(() => {
    if (!selectedRunId) return;
    setLoadingDist(true);
    api.runs.distribution(selectedRunId, selectedVar, 12).then(setDistribution).catch(console.error).finally(() => setLoadingDist(false));
  }, [selectedRunId, selectedVar]);

  const currentStat = stats.find((s) => s.variable === selectedVar);
  const currentVar = variables.find((v) => v.key === selectedVar);
  const currentRun = runs.find((r) => r.run_id === selectedRunId);
  const unit = VARIABLE_UNITS[selectedVar] ?? "";

  return (
    <div className="flex flex-col gap-6">

      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-xl font-bold text-ink tracking-tight">Análisis del recorrido</h1>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-ink-faint uppercase tracking-widest">Recorrido</label>
          <select
            value={selectedRunId}
            onChange={(e) => setSelectedRunId(e.target.value)}
            className="text-sm font-medium text-ink bg-surface-overlay border border-surface-border px-3 py-2 focus:outline-none focus:border-brand font-mono"
          >
            {runs.map((r) => (
              <option key={r.run_id} value={r.run_id}>
                {r.label ?? formatDate(r.started_at)} — {r.total_measurements.toLocaleString("es-CO")} pts
              </option>
            ))}
          </select>
        </div>
      </div>

      {currentRun && (
        <p className="font-mono text-xs text-ink-faint border-l-2 border-surface-subtle pl-3">
          {currentRun.total_measurements.toLocaleString("es-CO")} puntos
          {currentRun.ended_at ? `  ·  completado ${formatDate(currentRun.ended_at)}` : "  ·  en curso"}
        </p>
      )}

      {/* variable selector */}
      {variables.length > 0 && (
        <div className="max-w-sm flex flex-col gap-1.5">
          <VariableSelector variables={variables} selected={selectedVar} onChange={setSelectedVar} />
          {currentVar?.description && (
            <p className="text-xs text-ink-muted leading-relaxed">{currentVar.description}</p>
          )}
        </div>
      )}

      {/* stat cards */}
      {loadingStats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-surface-raised border border-surface-border h-20 animate-pulse" />
          ))}
        </div>
      ) : currentStat ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Promedio" value={currentStat.avg} unit={unit} />
          <StatCard label="Mínimo"   value={currentStat.min} unit={unit} />
          <StatCard label="Máximo"   value={currentStat.max} unit={unit} />
          <StatCard label="Mediana"  value={currentStat.median} unit={unit} />
        </div>
      ) : null}

      {currentStat && (
        <p className="text-xs text-ink-muted font-mono border-l-2 border-surface-subtle pl-3">
          desv. estándar: <span className="text-ink">{currentStat.stddev.toFixed(4)} {unit}</span>
          {currentStat.stddev / currentStat.avg > 0.15
            ? "  —  alta variabilidad" : "  —  campo uniforme"}
        </p>
      )}

      {/* treemap */}
      <div className="bg-surface-raised border border-surface-border p-5">
        <div className="mb-4 border-b border-surface-border pb-4">
          <h2 className="text-sm font-semibold text-ink uppercase tracking-widest">{currentVar?.label}</h2>
          {currentVar?.description && (
            <p className="text-xs text-ink-muted mt-1">{currentVar.description}</p>
          )}
        </div>
        {loadingDist ? (
          <div className="h-64 bg-surface animate-pulse" />
        ) : (
          <TreemapChart bins={distribution} unit={unit} label={currentVar?.label ?? selectedVar} />
        )}
      </div>

      {/* summary table */}
      {stats.length > 0 && (
        <div className="bg-surface-raised border border-surface-border overflow-hidden">
          <div className="px-5 py-3 border-b border-surface-border">
            <h2 className="text-xs font-semibold text-ink-faint uppercase tracking-widest">Resumen — todas las variables</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface text-ink-faint text-xs uppercase tracking-widest border-b border-surface-border">
                  <th className="text-left px-5 py-3 font-semibold">Variable</th>
                  <th className="text-right px-4 py-3 font-semibold">Mín</th>
                  <th className="text-right px-4 py-3 font-semibold">Promedio</th>
                  <th className="text-right px-4 py-3 font-semibold">Mediana</th>
                  <th className="text-right px-4 py-3 font-semibold">Máx</th>
                  <th className="text-right px-5 py-3 font-semibold">Desv.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {stats.map((s) => {
                  const meta = variables.find((v) => v.key === s.variable);
                  const u = VARIABLE_UNITS[s.variable] ?? "";
                  const active = s.variable === selectedVar;
                  return (
                    <tr
                      key={s.variable}
                      className={`cursor-pointer transition-colors ${active ? "bg-brand/5 border-l-2 border-brand" : "hover:bg-surface-overlay"}`}
                      onClick={() => setSelectedVar(s.variable)}
                    >
                      <td className="px-5 py-3 font-medium text-ink text-sm">
                        {meta?.label ?? s.variable}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-ink-muted">{s.min.toFixed(2)} {u}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-ink font-semibold">{s.avg.toFixed(2)} {u}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-ink-muted">{s.median.toFixed(2)} {u}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-ink-muted">{s.max.toFixed(2)} {u}</td>
                      <td className="px-5 py-3 text-right font-mono text-xs text-ink-faint">{s.stddev.toFixed(4)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
