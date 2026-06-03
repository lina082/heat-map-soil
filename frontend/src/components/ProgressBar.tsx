interface Props {
  measured: number;
  total: number;
}

export function ProgressBar({ measured, total }: Props) {
  const pct = total > 0 ? Math.min((measured / total) * 100, 100) : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-baseline">
        <span className="text-xs font-semibold text-ink-faint uppercase tracking-widest">Progreso</span>
        <span className="font-mono text-xs text-ink-muted">
          <span className="text-ink font-semibold">{measured.toLocaleString("es-CO")}</span>
          {" / "}{total.toLocaleString("es-CO")} pts
          <span className="text-brand ml-2">{pct.toFixed(1)}%</span>
        </span>
      </div>
      <div className="h-1 bg-surface-subtle w-full">
        <div
          className="h-full bg-brand transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
