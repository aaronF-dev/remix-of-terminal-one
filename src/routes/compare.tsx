import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, BarChart3, Loader2, Plus, Trophy, X } from "lucide-react";
import { compareSymbols, getMarketSnapshot } from "@/lib/terminal.functions";
import { FreshnessBar, ErrorBlock } from "@/components/analysis-view";
import { addHistory } from "@/lib/research-history";

const searchSchema = z.object({
  symbols: z.string().optional(),
});

export const Route = createFileRoute("/compare")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Compare — Terminal One" },
      {
        name: "description",
        content: "Side-by-side AI-driven comparison of up to 4 instruments with charts.",
      },
    ],
  }),
  component: ComparePage,
});

const SERIES_COLORS = [
  "var(--color-amber)",
  "var(--color-bull)",
  "var(--color-bear)",
  "oklch(0.72 0.16 220)",
];

function ComparePage() {
  const { symbols: initial } = Route.useSearch();
  const [symbols, setSymbols] = useState<string[]>(() =>
    initial ? initial.split(",").map((s: string) => s.trim()).filter(Boolean).slice(0, 4) : [],
  );

  const snapshotFn = useServerFn(getMarketSnapshot);
  const compareFn = useServerFn(compareSymbols);
  const snapshot = useQuery({
    queryKey: ["snapshot"],
    queryFn: () => snapshotFn(),
    staleTime: 30_000,
  });
  const quotes = snapshot.data?.data ?? [];

  const mut = useMutation({
    mutationFn: (syms: string[]) => compareFn({ data: { symbols: syms } }),
  });

  useEffect(() => {
    if (mut.data && !("error" in mut.data)) {
      const d = mut.data;
      addHistory({
        kind: "comparison",
        symbols: d.quotes.map((q) => q.symbol),
        winner: d.comparison.winner,
        summary: d.comparison.executiveSummary,
        fetchedAt: d.fetchedAt,
        payload: d,
      });
    }
  }, [mut.data]);

  const canRun = symbols.length >= 2 && symbols.length <= 4;

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to markets
        </Link>
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-amber" />
          <h1 className="text-base font-bold uppercase tracking-[0.18em]">
            Stock Comparison
          </h1>
        </div>
        <button
          onClick={() => mut.mutate(symbols)}
          disabled={!canRun || mut.isPending}
          className="rounded-sm bg-amber px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground transition-opacity disabled:opacity-40"
        >
          {mut.isPending ? "Comparing…" : "Run AI Comparison"}
        </button>
      </div>

      {/* selection */}
      <div className="rounded-md border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-amber">
            Selected ({symbols.length}/4) — pick 2 to 4
          </h3>
          {symbols.length > 0 && (
            <button
              onClick={() => setSymbols([])}
              className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
        <div className="mb-3 flex min-h-[28px] flex-wrap gap-2">
          {symbols.length === 0 && (
            <span className="text-xs text-muted-foreground">
              No symbols selected. Pick from the list below.
            </span>
          )}
          {symbols.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-sm border border-amber/40 bg-amber/10 px-2 py-1 text-xs text-amber"
            >
              {s}
              <button
                onClick={() => setSymbols((arr) => arr.filter((x) => x !== s))}
                aria-label={`Remove ${s}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="max-h-56 overflow-y-auto rounded-sm border border-border bg-surface-2 p-1">
          <div className="grid grid-cols-2 gap-1 md:grid-cols-4">
            {quotes.map((q) => {
              const checked = symbols.includes(q.symbol);
              const disabled = !checked && symbols.length >= 4;
              return (
                <button
                  key={q.symbol}
                  disabled={disabled}
                  onClick={() =>
                    setSymbols((arr) =>
                      checked ? arr.filter((s) => s !== q.symbol) : [...arr, q.symbol],
                    )
                  }
                  className={`flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors ${
                    checked
                      ? "bg-amber/15 text-amber"
                      : "text-foreground hover:bg-accent disabled:opacity-40"
                  }`}
                >
                  <span className="truncate">
                    <span className="font-semibold">{q.symbol}</span>{" "}
                    <span className="text-[10px] text-muted-foreground">{q.name}</span>
                  </span>
                  {checked ? <X className="size-3" /> : <Plus className="size-3" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {mut.isPending && (
        <div className="flex items-center justify-center gap-3 rounded-md border border-border bg-card p-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Fetching live data and 3-month histories, running AI comparison…
        </div>
      )}
      {mut.isError && (
        <div className="rounded-md border border-bear/40 bg-bear/5 p-4 text-sm text-bear">
          Comparison failed: {(mut.error as Error).message}
        </div>
      )}
      {mut.data && "error" in mut.data && (
        <ErrorBlock message={mut.data.message} fetchedAt={mut.data.fetchedAt} />
      )}
      {mut.data && !("error" in mut.data) && <ComparisonResultView data={mut.data} />}
    </div>
  );
}

export function ComparisonResultView({
  data,
}: {
  data: {
    comparison: {
      executiveSummary: string;
      winner: string;
      winnerRationale: string;
      dimensions: Array<{
        name: string;
        insight: string;
        ranking: Array<{ symbol: string; score: number; note: string }>;
      }>;
      riskComparison: Array<{ symbol: string; risk: string }>;
      correlationNotes: string;
      portfolioGuidance: string;
      confidenceLevel: "low" | "medium" | "high";
    };
    quotes: Array<{
      symbol: string;
      name: string;
      price: number;
      currency: string;
      changePercent: number;
    }>;
    histories: Array<{ symbol: string; points: Array<{ t: string; close: number }> }>;
    fetchedAt: string;
    sources: string[];
  };
}) {
  const { comparison, quotes, histories, fetchedAt, sources } = data;

  // Build normalized series (index to 100 at start of window)
  const normalized = useMemo(() => {
    const map = new Map<string, Record<string, number | string>>();
    histories.forEach((h) => {
      if (!h.points.length) return;
      const base = h.points[0].close;
      h.points.forEach((p) => {
        const key = p.t.slice(0, 10);
        const row = map.get(key) ?? { t: key };
        row[h.symbol] = Math.round(((p.close - base) / base) * 10000) / 100;
        map.set(key, row);
      });
    });
    return Array.from(map.values()).sort((a, b) => String(a.t).localeCompare(String(b.t)));
  }, [histories]);

  const perfBars = quotes.map((q) => ({
    symbol: q.symbol,
    changePercent: Math.round(q.changePercent * 100) / 100,
  }));

  return (
    <div className="space-y-4">
      <FreshnessBar
        fetchedAt={fetchedAt}
        sources={sources}
        confidence={comparison.confidenceLevel}
      />

      {/* Winner banner */}
      <div className="flex flex-wrap items-start gap-3 rounded-md border border-amber/40 bg-amber/5 p-4">
        <Trophy className="mt-0.5 size-5 text-amber" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-widest text-amber">
            AI-Ranked Winner
          </div>
          <div className="text-2xl font-bold">{comparison.winner}</div>
          <p className="mt-1 text-sm text-foreground">{comparison.winnerRationale}</p>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-3">
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-amber">
          Executive Summary
        </h3>
        <p className="text-sm leading-relaxed text-foreground">{comparison.executiveSummary}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Normalized performance chart */}
        <div className="rounded-md border border-border bg-card p-3 lg:col-span-2">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-amber">
            3-Month Performance (indexed to 100)
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={normalized} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="t" stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} minTickGap={32} />
                <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} width={50} unit="%" />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    fontSize: 11,
                  }}
                  formatter={(v: number) => `${v.toFixed(2)}%`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {quotes.map((q, i) => (
                  <Line
                    key={q.symbol}
                    type="monotone"
                    dataKey={q.symbol}
                    stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 24h perf bars */}
        <div className="rounded-md border border-border bg-card p-3">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-amber">
            Latest Change %
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perfBars} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="symbol" stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} />
                <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} unit="%" width={40} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    fontSize: 11,
                  }}
                  formatter={(v: number) => `${v.toFixed(2)}%`}
                />
                <Bar dataKey="changePercent">
                  {perfBars.map((b, i) => (
                    <Cell
                      key={i}
                      fill={b.changePercent >= 0 ? "var(--color-bull)" : "var(--color-bear)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quote table */}
      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-xs">
          <thead className="bg-surface text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Symbol</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-right">Change %</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.symbol} className="border-t border-border">
                <td className="px-3 py-2 font-semibold">{q.symbol}</td>
                <td className="px-3 py-2 text-muted-foreground">{q.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {q.currency === "USD" ? "$" : q.currency === "INR" ? "₹" : ""}
                  {q.price.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                </td>
                <td
                  className={`px-3 py-2 text-right tabular-nums ${
                    q.changePercent >= 0 ? "text-bull" : "text-bear"
                  }`}
                >
                  {q.changePercent >= 0 ? "+" : ""}
                  {q.changePercent.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* AI dimension rankings */}
      <div className="space-y-3">
        {comparison.dimensions.map((d) => (
          <DimensionCard key={d.name} dim={d} />
        ))}
      </div>

      {/* Risks & guidance */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-md border border-border bg-card p-3">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-amber">
            Risk Comparison
          </h3>
          <ul className="space-y-2">
            {comparison.riskComparison.map((r, i) => (
              <li key={i} className="text-xs">
                <span className="font-semibold text-bear">{r.symbol}</span>{" "}
                <span className="text-foreground">— {r.risk}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-amber">
            Correlation & Portfolio Guidance
          </h3>
          <p className="text-xs leading-relaxed text-foreground">
            {comparison.correlationNotes}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-foreground">
            {comparison.portfolioGuidance}
          </p>
        </div>
      </div>
    </div>
  );
}

function DimensionCard({
  dim,
}: {
  dim: {
    name: string;
    insight: string;
    ranking: Array<{ symbol: string; score: number; note: string }>;
  };
}) {
  const sorted = [...dim.ranking].sort((a, b) => b.score - a.score);
  const max = Math.max(...sorted.map((r) => r.score), 100);
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-amber">
          {dim.name}
        </h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          AI-scored 0–100
        </span>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{dim.insight}</p>
      <div className="space-y-1.5">
        {sorted.map((r) => (
          <div key={r.symbol} className="grid grid-cols-[80px_1fr_40px] items-center gap-2">
            <span className="text-xs font-semibold">{r.symbol}</span>
            <div className="relative h-2 overflow-hidden rounded-sm bg-surface-2">
              <div
                className="absolute inset-y-0 left-0 bg-amber"
                style={{ width: `${(r.score / max) * 100}%` }}
              />
            </div>
            <span className="text-right text-xs tabular-nums">{r.score}</span>
            {r.note && (
              <span className="col-span-3 -mt-0.5 text-[10px] text-muted-foreground">
                {r.note}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
