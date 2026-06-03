import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { LiveView } from "./pages/LiveView";
import { HistoryView } from "./pages/HistoryView";
import { AnalyticsView } from "./pages/AnalyticsView";

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("theme");
    if (stored) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  return [dark, setDark] as const;
}

type Page = "live" | "history" | "analytics";

const NAV: { id: Page; label: string }[] = [
  { id: "live",      label: "EN VIVO"   },
  { id: "history",   label: "HISTORIAL" },
  { id: "analytics", label: "ANÁLISIS"  },
];

export function App() {
  const [page, setPage] = useState<Page>("live");
  const [dark, setDark] = useDarkMode();

  return (
    <div className="min-h-screen bg-surface font-sans">
      <header className="bg-surface-raised border-b border-surface-border sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-12">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-brand" />
            <span className="font-display text-base font-700 text-ink tracking-tight">
              Monitor de Suelo
            </span>
          </div>
          <div className="flex items-center gap-0">
            <nav className="flex gap-0">
              {NAV.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setPage(id)}
                  className={`px-5 h-12 text-sm font-semibold transition-colors border-b-2 ${
                    page === id
                      ? "text-brand border-brand"
                      : "text-ink-faint border-transparent hover:text-ink-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
            <button
              onClick={() => setDark(!dark)}
              className="ml-3 p-2 text-ink-faint hover:text-ink transition-colors"
              aria-label="Cambiar tema"
            >
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {page === "live"      && <LiveView />}
        {page === "history"   && <HistoryView />}
        {page === "analytics" && <AnalyticsView />}
      </main>
    </div>
  );
}
