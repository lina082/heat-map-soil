interface Props {
  online: boolean;
  lastSeen: string | null;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h`;
}

export function LiveBadge({ online, lastSeen }: Props) {
  if (online) {
    return (
      <div className="flex items-center gap-2 border border-brand/40 bg-brand/10 px-3 py-1">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand" />
        </span>
        <span className="text-xs font-semibold text-brand tracking-widest uppercase">En vivo</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 border border-surface-border px-3 py-1">
      <span className="h-1.5 w-1.5 rounded-full bg-ink-faint" />
      <span className="text-xs text-ink-faint font-mono">
        {lastSeen ? `última señal ${timeAgo(lastSeen)} atrás` : "sin señal"}
      </span>
    </div>
  );
}
