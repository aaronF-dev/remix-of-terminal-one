import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Loader2, Search, ShieldAlert, Sparkles } from "lucide-react";
import { askAnything } from "@/lib/phase2.functions";
import { FreshnessBar } from "@/components/analysis-view";
import { z } from "zod";

export const Route = createFileRoute("/ask")({
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ q: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Ask Anything — Terminal One" },
      {
        name: "description",
        content:
          "Universal AI search for markets — companies, sectors, macro, concepts. Ask in plain English.",
      },
      { property: "og:title", content: "Ask Anything — Terminal One" },
      {
        property: "og:description",
        content: "Ask any financial question. Reasoned answers grounded in live data.",
      },
    ],
  }),
  component: AskPage,
});

const SUGGESTIONS = [
  "Why is Apple moving today?",
  "Explain today's market in one minute.",
  "Compare Microsoft and Google.",
  "Find undervalued semiconductor names.",
  "Which sectors benefit from lower rates?",
  "Explain Bitcoin's move like I'm 15.",
];

function AskPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const askFn = useServerFn(askAnything);
  const [query, setQuery] = useState(q ?? "");

  const mutation = useMutation({
    mutationFn: (queryText: string) => askFn({ data: { query: queryText, aiOverride: getAiOverride() } }),
  });

  const submit = (text: string) => {
    const v = text.trim();
    if (!v) return;
    setQuery(v);
    navigate({ to: "/ask", search: { q: v }, replace: true });
    mutation.mutate(v);
  };

  const result = mutation.data;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber/30 bg-amber/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-amber">
          <Sparkles className="size-3" /> Financial Intelligence
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Ask anything about the markets.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Companies, ETFs, crypto, commodities, macro, concepts — reasoned with live data.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
        className="mt-8 flex items-center gap-2 rounded-md border border-border bg-card p-2 shadow-sm focus-within:border-amber/60"
      >
        <Search className="ml-2 size-4 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Why is NVIDIA moving today?"
          className="h-10 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={mutation.isPending || !query.trim()}
          className="flex items-center gap-2 rounded-sm bg-amber px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {mutation.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ArrowRight className="size-3.5" />
          )}
          Ask
        </button>
      </form>

      {!mutation.isPending && !result && (
        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => submit(s)}
              className="rounded-sm border border-border bg-surface p-3 text-left text-xs text-muted-foreground transition-colors hover:border-amber/40 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {mutation.isPending && (
        <div className="mt-10 flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-amber" />
          <span className="uppercase tracking-widest text-[10px]">
            Routing through reasoning pipeline…
          </span>
          <div className="mt-2 flex flex-wrap justify-center gap-2 text-[10px]">
            {[
              "Intent",
              "Data",
              "News",
              "Fundamentals",
              "Technical",
              "Macro",
              "Risk",
              "Synthesis",
            ].map((step, i) => (
              <span
                key={step}
                className="rounded-sm border border-border bg-surface-2 px-2 py-1 uppercase tracking-wider"
                style={{ animation: `pulse 1.4s ease-in-out ${i * 0.12}s infinite` }}
              >
                {step}
              </span>
            ))}
          </div>
        </div>
      )}

      {mutation.error && (
        <div className="mt-6 flex items-start gap-2 rounded-md border border-warn/40 bg-warn/5 p-3 text-sm text-warn">
          <ShieldAlert className="size-4 shrink-0" />
          <div>{(mutation.error as Error).message}</div>
        </div>
      )}

      {result && (
        <div className="mt-8 space-y-4">
          <FreshnessBar
            fetchedAt={result.fetchedAt}
            sources={result.sources}
            confidence={result.answer.confidenceLevel}
          />
          <div className="rounded-md border border-border bg-card p-5">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-amber">
              Intent · {result.answer.intent}
            </div>
            <h2 className="mt-1 text-xl font-semibold text-foreground">
              {result.answer.headline}
            </h2>
            <p className="mt-3 leading-relaxed text-foreground">{result.answer.answer}</p>
            {result.answer.bullets.length > 0 && (
              <ul className="mt-4 space-y-1.5 text-sm">
                {result.answer.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-amber">›</span>
                    <span className="text-foreground">{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {result.answer.relatedSymbols.length > 0 && (
            <div className="rounded-md border border-border bg-card p-4">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-amber">
                Explore related
              </div>
              <div className="flex flex-wrap gap-2">
                {result.answer.relatedSymbols.map((s) => (
                  <Link
                    key={s}
                    to="/analyze/$symbol"
                    params={{ symbol: s }}
                    className="rounded-sm border border-border bg-surface-2 px-2.5 py-1 text-xs text-foreground hover:border-amber/40 hover:text-amber"
                  >
                    {s}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {result.answer.followUps.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Follow-up questions
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {result.answer.followUps.map((f) => (
                  <button
                    key={f}
                    onClick={() => submit(f)}
                    className="flex items-center justify-between gap-2 rounded-sm border border-border bg-surface p-3 text-left text-xs text-foreground hover:border-amber/40 hover:text-amber"
                  >
                    {f}
                    <ArrowRight className="size-3.5 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
