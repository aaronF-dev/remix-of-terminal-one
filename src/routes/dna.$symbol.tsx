import { getAiOverride } from "@/lib/ai-override";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Dna, Loader2, ShieldAlert } from "lucide-react";
import { getCompanyDNA, type CompanyDNA } from "@/lib/phase2.functions";
import { getMarketSnapshot } from "@/lib/terminal.functions";
import { FreshnessBar, ListSection } from "@/components/analysis-view";
import { z } from "zod";

export const Route = createFileRoute("/dna/$symbol")({
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ name: z.string().optional() }).parse(s),
  head: ({ params }) => ({
    meta: [
      { title: `${params.symbol} Company DNA — Terminal One` },
      {
        name: "description",
        content: `AI-generated Company DNA profile for ${params.symbol}: scores across quality, growth, valuation, risk, moat.`,
      },
    ],
  }),
  component: DnaPage,
});

function DnaPage() {
  const { symbol } = Route.useParams();
  const { name } = Route.useSearch();
  const navigate = useNavigate();
  const dnaFn = useServerFn(getCompanyDNA);
  const snapshotFn = useServerFn(getMarketSnapshot);

  const snapshot = useQuery({
    queryKey: ["snapshot"],
    queryFn: () => snapshotFn(),
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: () => dnaFn({ data: { symbol, name, aiOverride: getAiOverride() } }),
  });

  useEffect(() => {
    mutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const data = mutation.data;
  const candidates = (snapshot.data?.data ?? []).filter((q) =>
    ["equity_us", "equity_in"].includes(q.assetClass),
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <Dna className="size-4 text-amber" />
          <div>
            <div className="text-lg font-bold text-foreground">{symbol}</div>
            {name && <div className="text-xs text-muted-foreground">{name}</div>}
          </div>
        </div>
        <select
          value={symbol}
          onChange={(e) => {
            const next = candidates.find((c) => c.symbol === e.target.value);
            navigate({
              to: "/dna/$symbol",
              params: { symbol: e.target.value },
              search: { name: next?.name },
            });
          }}
          className="h-8 rounded-sm border border-border bg-surface-2 px-2 text-xs"
        >
          {candidates.map((c) => (
            <option key={c.symbol} value={c.symbol}>
              {c.symbol} — {c.name}
            </option>
          ))}
        </select>
      </div>

      {mutation.isPending && (
        <div className="flex items-center justify-center gap-2 p-20 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Profiling {symbol} across 10 dimensions…
        </div>
      )}
      {mutation.error && (
        <div className="flex items-start gap-2 rounded-md border border-warn/40 bg-warn/5 p-3 text-sm text-warn">
          <ShieldAlert className="size-4 shrink-0" />
          <div>{(mutation.error as Error).message}</div>
        </div>
      )}
      {data && "error" in data && (
        <div className="flex items-start gap-2 rounded-md border border-warn/40 bg-warn/5 p-3 text-sm text-warn">
          <ShieldAlert className="size-4 shrink-0" />
          <div>{data.message}</div>
        </div>
      )}
      {data && "dna" in data && data.dna && (
        <DnaView
          dna={data.dna as CompanyDNA}
          fetchedAt={data.fetchedAt}
          sources={data.sources}
          symbol={symbol}
        />
      )}
    </div>
  );
}

const DIM_LABELS: Record<keyof CompanyDNA["scores"], string> = {
  businessQuality: "Business Quality",
  growth: "Growth",
  financialHealth: "Financial Health",
  competitiveMoat: "Competitive Moat",
  innovation: "Innovation",
  managementQuality: "Management",
  valuation: "Valuation",
  risk: "Risk",
  marketSentiment: "Sentiment",
  longTermOutlook: "Long-Term Outlook",
};

function DnaView({
  dna,
  fetchedAt,
  sources,
  symbol,
}: {
  dna: CompanyDNA;
  fetchedAt: string;
  sources: string[];
  symbol: string;
}) {
  return (
    <div className="space-y-5">
      <FreshnessBar fetchedAt={fetchedAt} sources={sources} confidence="medium" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-md border border-border bg-card p-5 text-center">
          <div className="text-[10px] uppercase tracking-widest text-amber">
            Overall AI Rating
          </div>
          <div className="mt-2 text-6xl font-bold tabular-nums text-foreground">
            {dna.overallRating}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            / 100
          </div>
          <p className="mt-3 text-xs leading-relaxed text-foreground">{dna.overallVerdict}</p>
          <Link
            to="/analyze/$symbol"
            params={{ symbol }}
            className="mt-4 inline-block rounded-sm bg-amber px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground"
          >
            Full AI Analysis →
          </Link>
        </div>
        <div className="rounded-md border border-border bg-card p-5 lg:col-span-2">
          <div className="text-[10px] uppercase tracking-widest text-amber">
            Business Summary
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{dna.businessSummary}</p>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-4">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-amber">
          Dimension Scorecard
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(Object.keys(DIM_LABELS) as (keyof CompanyDNA["scores"])[]).map((k) => {
            const s = dna.scores[k];
            const color =
              s.score >= 75
                ? "bg-bull"
                : s.score >= 55
                  ? "bg-amber"
                  : s.score >= 35
                    ? "bg-muted-foreground"
                    : "bg-bear";
            return (
              <div key={k} className="rounded-sm border border-border bg-surface-2 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    {DIM_LABELS[k]}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-sm border border-border px-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {s.grade}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-foreground">
                      {s.score}
                    </span>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                  <div
                    className={`h-full transition-all ${color}`}
                    style={{ width: `${s.score}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  {s.rationale}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ListSection title="Key Strengths" items={dna.keyStrengths} />
        <ListSection title="Key Weaknesses" items={dna.keyWeaknesses} accent="bear" />
        <ListSection title="Catalysts" items={dna.catalysts} />
      </div>
    </div>
  );
}
