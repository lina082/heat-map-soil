import type { VariableMeta } from "../types";

interface Props {
  variables: VariableMeta[];
  selected: string;
  onChange: (key: string) => void;
}

export function VariableSelector({ variables, selected, onChange }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-ink-faint uppercase tracking-widest">
        Variable
      </label>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm font-medium text-ink bg-surface-overlay border border-surface-border px-3 py-2 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
      >
        {variables.map((v) => (
          <option key={v.key} value={v.key}>
            {v.label} ({v.unit})
          </option>
        ))}
      </select>
    </div>
  );
}
