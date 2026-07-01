import { getAiOverride } from "@/lib/ai-override";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Compass, Loader2, ShieldAlert } from "lucide-react";
import { runOpportunityRadar } from "@/lib/phase2.functions";
import { FreshnessBar } from "@/components/analysis-view";

export const Route = createFileRoute("/radar")({
  head: () => ({
    meta: [
      { title: "Opportunity Radar — Terminal One" },
      {
        name: "description",
        content:
          "Natural-language stock screener — describe what you want, AI returns ranked ideas.",
      },
    ],
  }),
  component: RadarPage,
});

const EXAMPLES = [
  "Find profitable AI companies with strong momentum.",
  "Show growing healthcare names trading at a discount.",
  "Crypto with high recent volatility but positive trend.",
  "Defensive equities for a rising-rates environment.",
];

function RadarPage() {
  const radarFn = useServerFn(runOpportunityRadar);
  const [query, setQuery] = useState("");
  const mutation = useMutation({
    mutationFn: (q: string) => radarFn({ data: { query: q, aiOverride: getAiOverride() } }),
  });

  const submit = (text: string) => {
    const v = text.trim();
    if (!v) return;
    setQuery(v);
    mutation.mutate(v);
  };

  const data = mutation.data;

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 py-8">
      <div className="text-center">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber/30 bg-amber/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-amber">
          <Compass className="size-3" /> Opportunity Radar
        </div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          Describe what you want. AI screens the universe.
        </h1>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
        className="flex items-center gap-2 rounded-md border border-border bg-card p-2 focus-within:border-amber/60"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find profitable semiconductor names with strong momentum…"
          className="h-10 flex-1 bg-transparent px-2 text-sm text-foreground outline-none"
        />
        <button
          type="submit"
          disabled={mutation.isPending || !query.trim()}
          className="flex items-center gap-2 rounded-sm bg-amber px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
        >
          {mutation.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ArrowRight className="size-3.5" />
          )}
          Run
        </button>
      </form>

      {!data && !mutation.isPending && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              onClick={() => submit(e)}
              className="rounded-sm border border-border bg-surface p-3 text-left text-xs text-muted-foreground hover:border-amber/40 hover:text-foreground"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {mutation.error && (
        <div className="flex items-start gap-2 rounded-md border border-warn/40 bg-warn/5 p-3 text-sm text-warn">
          <ShieldAlert className="size-4 shrink-0" />
          <div>{(mutation.error as Error).message}</div>
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <FreshnessBar fetchedAt={data.fetchedAt} sources={data.sources} confidence="medium" />

          <div className="rounded-md border border-border bg-card p-4">
            <div className="text-[10px] uppercase tracking-widest text-amber">
              AI Interpretation
            </div>
            <p className="mt-1 text-sm text-foreground">{data.radar.interpretedQuery}</p>
            {data.radar.filters.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.radar.filters.map((f, i) => (
                  <span
                    key={i}
                    className="rounded-sm border border-border bg-surface-2 px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    <span className="text-amber">{f.name}:</span> {f.value}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            {data.radar.results.length === 0 && (
              <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
                No matches in the current universe.
              </div>
            )}
            {data.radar.results.map((r) => (
              <Link
                key={r.symbol}
                to="/analyze/$symbol"
                params={{ symbol: r.symbol }}
                className="block rounded-md border border-border bg-card p-3 transition-colors hover:border-amber/40"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-foreground">
                      {r.symbol}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        {r.name}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-foreground">{r.thesis}</p>
                  </div>
                  <div className="ml-3 text-right">
                    <div className="text-2xl font-bold tabular-nums text-amber">
                      {r.matchScore}
                    </div>
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
                      Match
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-amber">
              Reasoning
            </div>
            <p className="mt-1 text-foreground">{data.radar.reasoning}</p>
            <p className="mt-2 italic">{data.radar.caveat}</p>
          </div>
        </div>
      )}
    </div>
  );
}
