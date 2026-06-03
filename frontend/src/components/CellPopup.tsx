import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { CellDetail } from "../types";

interface Props {
  cell: CellDetail;
  onClose: () => void;
}

const FIELDS: { key: keyof CellDetail; label: string; unit: string; decimals: number }[] = [
  { key: "humedad_suelo_pct",      label: "Humedad del suelo",    unit: "%",    decimals: 2 },
  { key: "temperatura_suelo_c",    label: "Temperatura del suelo",unit: "°C",   decimals: 2 },
  { key: "intensidad_luz",         label: "Intensidad de luz",    unit: "lux",  decimals: 1 },
  { key: "lluvia_mm_h",            label: "Lluvia",               unit: "mm/h", decimals: 2 },
  { key: "temperatura_ambiente_c", label: "Temperatura del aire", unit: "°C",   decimals: 2 },
  { key: "distancia_rio_m",        label: "Distancia al río",     unit: "m",    decimals: 1 },
  { key: "influencia_rio",         label: "Influencia del río",   unit: "",     decimals: 4 },
  { key: "retencion_suelo",        label: "Retención de agua",    unit: "",     decimals: 4 },
  { key: "drenaje",                label: "Drenaje",              unit: "",     decimals: 4 },
  { key: "sombra",                 label: "Sombra",               unit: "",     decimals: 4 },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function CellPopup({ cell, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        ref={ref}
        className="bg-surface-raised border border-surface-border w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-surface-border">
          <div>
            <p className="text-xs font-semibold text-ink-faint uppercase tracking-widest mb-1">Punto medido</p>
            <p className="font-mono text-lg font-semibold text-ink">
              x={cell.x_m}  y={cell.y_m}
            </p>
            <p className="text-xs text-ink-muted mt-0.5">{formatDate(cell.timestamp)}</p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-faint hover:text-ink transition-colors mt-0.5"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* values */}
        <div className="px-5 py-4 divide-y divide-surface-border">
          {FIELDS.map(({ key, label, unit, decimals }) => {
            const raw = cell[key];
            const value = typeof raw === "number" ? raw.toFixed(decimals) : raw;
            return (
              <div key={key} className="flex justify-between items-baseline py-2">
                <span className="text-sm text-ink-muted">{label}</span>
                <span className="font-mono text-sm font-medium text-ink tabular-nums">
                  {value}{unit ? ` ${unit}` : ""}
                </span>
              </div>
            );
          })}
        </div>

        <div className="px-5 pb-4">
          <p className="font-mono text-xs text-ink-faint">
            {cell.latitud.toFixed(6)}, {cell.longitud.toFixed(6)}
          </p>
        </div>
      </div>
    </div>
  );
}
