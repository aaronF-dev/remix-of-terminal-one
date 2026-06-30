import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Brain, BarChart3, Cpu, Loader2, RefreshCcw, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  getHistoryEntry,
  removeHistory,
  type HistoryEntry,
} from "@/lib/research-history";
import { AnalysisView } from "@/components/analysis-view";
import { QuoteHeader, PriceChart } from "./analyze.$symbol";
import { ComparisonResultView } from "./compare";
import { AgentResult } from "./agents";
import type { AgentKind } from "@/lib/agents.functions";

export const Route = createFileRoute("/research/$id")({
  head: ({ params }) => ({
    meta: [{ title: `Saved · ${params.id} — Terminal One` }],
  }),
  component: SavedResearchPage,
});

function SavedResearchPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<HistoryEntry | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    setState("loading");
    getHistoryEntry(id)
      .then((e) => {
        if (!e) return setState("missing");
        setEntry(e);
        setState("ready");
      })
      .catch(() => setState("missing"));
  }, [id, user, loading]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/research"
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to research
        </Link>
        {entry && (
          <div className="flex items-center gap-2">
            <ReRunButton entry={entry} />
            <button
              onClick={async () => {
                if (!confirm("Delete this saved result?")) return;
                await removeHistory(entry.id);
                navigate({ to: "/research" });
              }}
              className="inline-flex items-center gap-1.5 rounded-sm border border-bear/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-bear hover:bg-bear/10"
            >
              <Trash2 className="size-3.5" /> Delete
            </button>
          </div>
        )}
      </div>

      {state === "loading" && (
        <div className="flex items-center justify-center rounded-md border border-border bg-card p-16">
          <Loader2 className="size-5 animate-spin text-amber" />
        </div>
      )}

      {state === "missing" && (
        <div className="rounded-md border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
          This saved result no longer exists in your research workspace.
        </div>
      )}

      {state === "ready" && entry && <SavedRenderer entry={entry} />}
    </div>
  );
}

function ReRunButton({ entry }: { entry: HistoryEntry }) {
  if (entry.kind === "analysis") {
    return (
      <Link
        to="/analyze/$symbol"
        params={{ symbol: entry.symbol }}
        search={{ name: entry.name }}
        className="inline-flex items-center gap-1.5 rounded-sm bg-amber px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground hover:opacity-90"
      >
        <RefreshCcw className="size-3.5" /> Re-run
      </Link>
    );
  }
  if (entry.kind === "comparison") {
    return (
      <Link
        to="/compare"
        search={{ symbols: entry.symbols.join(",") }}
        className="inline-flex items-center gap-1.5 rounded-sm bg-amber px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground hover:opacity-90"
      >
        <RefreshCcw className="size-3.5" /> Re-run
      </Link>
    );
  }
  return (
    <Link
      to="/agents"
      className="inline-flex items-center gap-1.5 rounded-sm bg-amber px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground hover:opacity-90"
    >
      <RefreshCcw className="size-3.5" /> Re-run
    </Link>
  );
}

function SavedRenderer({ entry }: { entry: HistoryEntry }) {
  if (entry.kind === "analysis") return <AnalysisSaved entry={entry} />;
  if (entry.kind === "comparison") return <ComparisonSaved entry={entry} />;
  return <AgentSaved entry={entry} />;
}

function MetaBar({
  icon: Icon,
  label,
  title,
  fetchedAt,
  createdAt,
}: {
  icon: typeof Brain;
  label: string;
  title: string;
  fetchedAt: string;
  createdAt: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-amber" />
        <div>
          <div className="text-[10px] uppercase tracking-widest text-amber">{label}</div>
          <div className="text-sm font-semibold text-foreground">{title}</div>
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        Saved {new Date(createdAt).toLocaleString()} · Data {new Date(fetchedAt).toLocaleString()}
      </div>
    </div>
  );
}

function AnalysisSaved({ entry }: { entry: Extract<HistoryEntry, { kind: "analysis" }> }) {
  const p = entry.payload as
    | {
        quote: { symbol: string; name: string; price: number; currency: string; change: number; changePercent: number };
        history: Array<{ t: string; close: number }>;
        analysis: Parameters<typeof AnalysisView>[0]["analysis"];
        fetchedAt: string;
        sources: string[];
      }
    | undefined;
  return (
    <div className="space-y-4">
      <MetaBar
        icon={Brain}
        label="AI Analysis"
        title={`${entry.symbol} · ${entry.name}`}
        fetchedAt={entry.fetchedAt}
        createdAt={entry.createdAt}
      />
      {!p ? (
        <LegacyFallback
          summary={entry.summary}
          rerunHref={`/analyze/${entry.symbol}`}
          rerunLabel="Open live analysis"
        />
      ) : (
        <>
          <QuoteHeader
            symbol={p.quote.symbol}
            name={p.quote.name}
            price={p.quote.price}
            currency={p.quote.currency}
            change={p.quote.change}
            changePercent={p.quote.changePercent}
          />
          {p.history.length > 1 && (
            <PriceChart data={p.history} positive={p.quote.changePercent >= 0} />
          )}
          <AnalysisView analysis={p.analysis} fetchedAt={p.fetchedAt} sources={p.sources} />
        </>
      )}
    </div>
  );
}

function ComparisonSaved({ entry }: { entry: Extract<HistoryEntry, { kind: "comparison" }> }) {
  const p = entry.payload as Parameters<typeof ComparisonResultView>[0]["data"] | undefined;
  return (
    <div className="space-y-4">
      <MetaBar
        icon={BarChart3}
        label="Comparison"
        title={entry.symbols.join(" vs ") + ` · winner ${entry.winner}`}
        fetchedAt={entry.fetchedAt}
        createdAt={entry.createdAt}
      />
      {!p ? (
        <LegacyFallback
          summary={entry.summary}
          rerunHref={`/compare?symbols=${entry.symbols.join(",")}`}
          rerunLabel="Open live comparison"
        />
      ) : (
        <ComparisonResultView data={p} />
      )}
    </div>
  );
}

function AgentSaved({ entry }: { entry: Extract<HistoryEntry, { kind: "agent" }> }) {
  const p = entry.payload as
    | { kind: AgentKind; result: unknown; fetchedAt: string; sources: string[] }
    | undefined;
  return (
    <div className="space-y-4">
      <MetaBar
        icon={Cpu}
        label={`Agent · ${entry.agentName}`}
        title={`${entry.symbol} · ${entry.name}`}
        fetchedAt={entry.fetchedAt}
        createdAt={entry.createdAt}
      />
      {!p ? (
        <LegacyFallback
          summary={entry.summary}
          rerunHref="/agents"
          rerunLabel="Open agents"
        />
      ) : (
        <div className="rounded-md border border-border bg-card p-4">
          <AgentResult
            kind={p.kind}
            data={p as Parameters<typeof AgentResult>[0]["data"]}
          />
          <div className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">
            Fetched {new Date(p.fetchedAt).toLocaleString()} · {p.sources.join(" · ")}
          </div>
        </div>
      )}
    </div>
  );
}

function LegacyFallback({
  summary,
  rerunHref,
  rerunLabel,
}: {
  summary: string;
  rerunHref: string;
  rerunLabel: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-border bg-card p-6">
      <div className="text-[10px] uppercase tracking-widest text-amber">Legacy entry</div>
      <p className="mt-2 text-sm leading-relaxed text-foreground">{summary}</p>
      <p className="mt-2 text-[11px] text-muted-foreground">
        This was saved before full payloads were stored. Re-run to capture the complete result.
      </p>
      <a
        href={rerunHref}
        className="mt-3 inline-flex rounded-sm bg-amber px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground"
      >
        {rerunLabel}
      </a>
    </div>
  );
}
