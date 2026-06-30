import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BarChart3, Brain, Cpu, History, Loader2, Trash2 } from "lucide-react";
import {
  clearHistory,
  removeHistory,
  subscribeHistory,
  type HistoryEntry,
} from "@/lib/research-history";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/research")({
  head: () => ({
    meta: [
      { title: "Research — Terminal One" },
      {
        name: "description",
        content: "Your history of AI analyses, comparisons, and agent runs.",
      },
    ],
  }),
  component: ResearchPage,
});

function ResearchPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoaded(false);
    const unsub = subscribeHistory(user.uid, (list) => {
      setEntries(list);
      setLoaded(true);
    });
    return () => unsub();
  }, [user]);

  const analyses = entries.filter(
    (e): e is Extract<HistoryEntry, { kind: "analysis" }> => e.kind === "analysis",
  );
  const comparisons = entries.filter(
    (e): e is Extract<HistoryEntry, { kind: "comparison" }> => e.kind === "comparison",
  );
  const agents = entries.filter(
    (e): e is Extract<HistoryEntry, { kind: "agent" }> => e.kind === "agent",
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="size-4 text-amber" />
          <h1 className="text-base font-bold uppercase tracking-[0.18em]">
            Research Workspace
          </h1>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {entries.length} saved · synced to your account
          </span>
        </div>
        {entries.length > 0 && (
          <button
            onClick={() => {
              if (confirm("Clear all research history from your account?")) clearHistory();
            }}
            className="inline-flex items-center gap-1.5 rounded-sm border border-bear/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-bear hover:bg-bear/10"
          >
            <Trash2 className="size-3.5" /> Clear all
          </button>
        )}
      </div>

      {!loaded && (
        <div className="flex items-center justify-center rounded-md border border-border bg-card p-12">
          <Loader2 className="size-5 animate-spin text-amber" />
        </div>
      )}

      {loaded && entries.length === 0 && (
        <div className="rounded-md border border-dashed border-border bg-card p-12 text-center">
          <History className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm text-foreground">No saved research yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Every analysis, comparison, and agent run is saved here with its full result so you can re-open it any time.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link to="/" className="rounded-sm bg-amber px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground">
              Browse markets
            </Link>
            <Link to="/compare" className="rounded-sm border border-amber/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber">
              Start a comparison
            </Link>
            <Link to="/agents" className="rounded-sm border border-amber/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber">
              Deploy agents
            </Link>
          </div>
        </div>
      )}

      {analyses.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-amber">
            <Brain className="size-3.5" /> AI Analyses ({analyses.length})
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {analyses.map((e) => (
              <article key={e.id} className="group flex flex-col rounded-md border border-border bg-card p-3">
                <header className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-lg font-bold">{e.symbol}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{e.name}</div>
                  </div>
                  <RemoveBtn id={e.id} />
                </header>
                <p className="line-clamp-4 flex-1 text-xs leading-relaxed text-foreground">{e.summary}</p>
                <footer className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span
                    className={`rounded-sm border px-1.5 py-0.5 ${
                      e.confidence === "high"
                        ? "border-bull/40 text-bull"
                        : e.confidence === "medium"
                          ? "border-amber/40 text-amber"
                          : "border-bear/40 text-bear"
                    }`}
                  >
                    {e.confidence}
                  </span>
                  <span>{new Date(e.createdAt).toLocaleString()}</span>
                </footer>
                <Link
                  to="/research/$id"
                  params={{ id: e.id }}
                  className="mt-3 rounded-sm bg-amber/10 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-amber hover:bg-amber/20"
                >
                  Open saved result
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}

      {comparisons.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-amber">
            <BarChart3 className="size-3.5" /> Comparisons ({comparisons.length})
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {comparisons.map((e) => (
              <article key={e.id} className="group flex flex-col rounded-md border border-border bg-card p-3">
                <header className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-1">
                      {e.symbols.map((s) => (
                        <span
                          key={s}
                          className={`rounded-sm px-1.5 py-0.5 text-xs font-semibold ${
                            s === e.winner ? "bg-amber/20 text-amber" : "bg-surface-2 text-foreground"
                          }`}
                        >
                          {s}
                          {s === e.winner ? " ★" : ""}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      Winner: {e.winner}
                    </div>
                  </div>
                  <RemoveBtn id={e.id} />
                </header>
                <p className="line-clamp-3 flex-1 text-xs leading-relaxed text-foreground">{e.summary}</p>
                <footer className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString()}
                </footer>
                <Link
                  to="/research/$id"
                  params={{ id: e.id }}
                  className="mt-3 rounded-sm bg-amber/10 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-amber hover:bg-amber/20"
                >
                  Open saved result
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}

      {agents.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-amber">
            <Cpu className="size-3.5" /> Agent Runs ({agents.length})
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((e) => (
              <article key={e.id} className="group flex flex-col rounded-md border border-border bg-card p-3">
                <header className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-widest text-amber">{e.agentName}</div>
                    <div className="text-base font-bold">{e.symbol}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{e.name}</div>
                  </div>
                  <RemoveBtn id={e.id} />
                </header>
                <p className="line-clamp-4 flex-1 text-xs leading-relaxed text-foreground">{e.summary}</p>
                <footer className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString()}
                </footer>
                <Link
                  to="/research/$id"
                  params={{ id: e.id }}
                  className="mt-3 rounded-sm bg-amber/10 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-amber hover:bg-amber/20"
                >
                  Open saved result
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RemoveBtn({ id }: { id: string }) {
  return (
    <button
      onClick={() => removeHistory(id)}
      className="opacity-0 transition-opacity group-hover:opacity-100"
      aria-label="Remove"
    >
      <Trash2 className="size-3.5 text-muted-foreground hover:text-bear" />
    </button>
  );
}
