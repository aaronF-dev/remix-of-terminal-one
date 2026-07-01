import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, BarChart3, Brain, Loader2 } from "lucide-react";
import { analyzeSymbol, getMarketSnapshot } from "@/lib/terminal.functions";
import { AnalysisView, ErrorBlock } from "@/components/analysis-view";
import { addHistory } from "@/lib/research-history";

const searchSchema = z.object({
  name: z.string().optional(),
});

export const Route = createFileRoute("/analyze/$symbol")({
  validateSearch: searchSchema,
  head: ({ params }) => ({
    meta: [
      { title: `${params.symbol} — AI Reasoning · Terminal One` },
      {
        name: "description",
        content: `Grounded, timestamped AI analysis for ${params.symbol} using live multi-source data.`,
      },
    ],
  }),
  component: AnalyzePage,
});

function AnalyzePage() {
  const { symbol } = Route.useParams();
  const { name } = Route.useSearch();
  const analyzeFn = useServerFn(analyzeSymbol);

  const mut = useMutation({
    mutationFn: () => analyzeFn({ data: { symbol, name, aiOverride: getAiOverride() } }),
  });

  // auto-trigger on mount / symbol change
  useEffect(() => {
    mut.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  // persist successful analysis to research history
  useEffect(() => {
    if (mut.data && !("error" in mut.data)) {
      const d = mut.data;
      addHistory({
        kind: "analysis",
        symbol: d.quote.symbol,
        name: d.quote.name,
        summary: d.analysis.executiveSummary,
        confidence: d.analysis.confidenceLevel,
        fetchedAt: d.fetchedAt,
        payload: d,
      });
    }
  }, [mut.data]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to markets
        </Link>
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-amber" />
          <h1 className="text-base font-bold uppercase tracking-[0.18em]">
            {symbol}
            {name ? <span className="ml-2 text-muted-foreground">· {name}</span> : null}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="rounded-sm bg-amber px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground transition-opacity disabled:opacity-40"
          >
            {mut.isPending ? "Analyzing…" : "Re-Analyze"}
          </button>
          <SwitchSymbolButton currentSymbol={symbol} />
        </div>
      </div>

      {mut.isPending && (
        <div className="flex items-center justify-center gap-3 rounded-md border border-border bg-card p-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Fetching fresh data, grounding model, generating structured analysis…
        </div>
      )}

      {mut.isError && (
        <div className="rounded-md border border-bear/40 bg-bear/5 p-4 text-sm text-bear">
          Analysis failed: {(mut.error as Error).message}
        </div>
      )}

      {mut.data && "error" in mut.data && (
        <ErrorBlock message={mut.data.message} fetchedAt={mut.data.fetchedAt} />
      )}

      {mut.data && !("error" in mut.data) && (
        <>
          <QuoteHeader
            symbol={mut.data.quote.symbol}
            name={mut.data.quote.name}
            price={mut.data.quote.price}
            currency={mut.data.quote.currency}
            change={mut.data.quote.change}
            changePercent={mut.data.quote.changePercent}
          />
          {mut.data.history.length > 1 && (
            <PriceChart
              data={mut.data.history}
              positive={mut.data.quote.changePercent >= 0}
            />
          )}
          <AnalysisView
            analysis={mut.data.analysis}
            fetchedAt={mut.data.fetchedAt}
            sources={mut.data.sources}
          />
        </>
      )}
    </div>
  );
}

function SwitchSymbolButton({ currentSymbol }: { currentSymbol: string }) {
  const navigate = useNavigate();
  const snapshotFn = useServerFn(getMarketSnapshot);
  const snapshot = useQuery({
    queryKey: ["snapshot"],
    queryFn: () => snapshotFn(),
    staleTime: 30_000,
  });
  const [open, setOpen] = useState(false);
  const quotes = snapshot.data?.data ?? [];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-sm border border-border px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        Switch symbol
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 max-h-80 w-64 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-lg">
          {quotes.map((q) => (
            <button
              key={q.symbol}
              onClick={() => {
                setOpen(false);
                navigate({
                  to: "/analyze/$symbol",
                  params: { symbol: q.symbol },
                  search: { name: q.name },
                });
              }}
              className={`flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent ${
                q.symbol === currentSymbol ? "bg-amber/10 text-amber" : ""
              }`}
            >
              <span className="font-semibold">{q.symbol}</span>
              <span className="truncate text-[10px] text-muted-foreground">{q.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function QuoteHeader({
  symbol,
  name,
  price,
  currency,
  change,
  changePercent,
}: {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  change: number;
  changePercent: number;
}) {
  const up = changePercent >= 0;
  const sym = currency === "USD" ? "$" : currency === "INR" ? "₹" : currency === "EUR" ? "€" : "";
  return (
    <div className="grid grid-cols-1 gap-3 rounded-md border border-border bg-card p-4 md:grid-cols-3">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Symbol</div>
        <div className="text-2xl font-bold">{symbol}</div>
        <div className="text-xs text-muted-foreground">{name}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Last Price
        </div>
        <div className="text-2xl font-semibold tabular-nums">
          {sym}
          {price.toLocaleString("en-US", { maximumFractionDigits: 4 })}
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Change</div>
        <div className={`text-2xl font-semibold tabular-nums ${up ? "text-bull" : "text-bear"}`}>
          {up ? "+" : ""}
          {change.toFixed(2)} ({up ? "+" : ""}
          {changePercent.toFixed(2)}%)
        </div>
      </div>
    </div>
  );
}

export function PriceChart({
  data,
  positive,
}: {
  data: Array<{ t: string; close: number }>;
  positive: boolean;
}) {
  const series = useMemo(
    () => data.map((p) => ({ t: p.t.slice(0, 10), close: p.close })),
    [data],
  );
  const stroke = positive ? "var(--color-bull)" : "var(--color-bear)";
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <BarChart3 className="size-3.5 text-amber" />
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-amber">
          3-Month Price History
        </h3>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="pricefill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.5} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              stroke="var(--color-muted-foreground)"
              tick={{ fontSize: 10 }}
              minTickGap={32}
            />
            <YAxis
              stroke="var(--color-muted-foreground)"
              tick={{ fontSize: 10 }}
              domain={["auto", "auto"]}
              width={60}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                fontSize: 11,
              }}
              labelStyle={{ color: "var(--color-muted-foreground)" }}
            />
            <Area
              type="monotone"
              dataKey="close"
              stroke={stroke}
              fill="url(#pricefill)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
