interface Props {
  min: number;
  max: number;
  unit: string;
  label: string;
}

export function ColorLegend({ min, max, unit, label }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-ink-faint uppercase tracking-widest">{label}</span>
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-ink-muted w-20 text-right">
          {min.toFixed(1)} {unit}
        </span>
        <div
          className="h-2 flex-1"
          style={{ background: "linear-gradient(to right, #4575b4, #ffffbf, #d73027)" }}
        />
        <span className="font-mono text-xs text-ink-muted w-20">
          {max.toFixed(1)} {unit}
        </span>
      </div>
    </div>
  );
}
