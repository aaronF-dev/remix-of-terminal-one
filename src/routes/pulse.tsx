import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Gauge, Loader2, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { getAiOverride } from "@/lib/ai-override";
import { getMarketPulse } from "@/lib/phase2.functions";
import { FreshnessBar, ListSection, Section } from "@/components/analysis-view";

export const Route = createFileRoute("/pulse")({
  head: () => ({
    meta: [
      { title: "Market Pulse — Terminal One" },
      {
        name: "description",
        content:
          "AI-generated market briefing — sentiment, sectors, themes and catalysts, summarized live.",
      },
      { property: "og:title", content: "Market Pulse — Terminal One" },
      {
        property: "og:description",
        content: "Live AI market briefing: sentiment, sectors, themes, catalysts.",
      },
    ],
  }),
  component: PulsePage,
});

function PulsePage() {
  const pulseFn = useServerFn(getMarketPulse);
  const q = useQuery({
    queryKey: ["pulse"],
    queryFn: () => pulseFn({ data: { aiOverride: getAiOverride() } }),
    refetchInterval: 5 * 60_000,
    staleTime: 0,
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 p-20 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Generating live market pulse…
      </div>
    );
  }
  if (q.error || !q.data) {
    return (
      <div className="m-6 flex items-start gap-2 rounded-md border border-warn/40 bg-warn/5 p-4 text-sm text-warn">
        <ShieldAlert className="size-4 shrink-0" />
        <div>{(q.error as Error)?.message ?? "Pulse unavailable"}</div>
      </div>
    );
  }
  const { pulse, fetchedAt, sources } = q.data;

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4">
      <FreshnessBar fetchedAt={fetchedAt} sources={sources} confidence="medium" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FearGreed score={pulse.fearGreedScore} label={pulse.fearGreedLabel} />
        <div className="rounded-md border border-border bg-card p-4 lg:col-span-2">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-amber">
            Market Sentiment
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground">
            {pulse.marketSentiment}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-sm border border-bull/30 bg-bull/5 p-3">
              <div className="flex items-center gap-2 text-bull">
                <TrendingUp className="size-3.5" />
                <span className="text-[10px] uppercase tracking-wider">Most bullish sector</span>
              </div>
              <div className="mt-1 font-semibold text-foreground">
                {pulse.mostBullishSector}
              </div>
            </div>
            <div className="rounded-sm border border-bear/30 bg-bear/5 p-3">
              <div className="flex items-center gap-2 text-bear">
                <TrendingDown className="size-3.5" />
                <span className="text-[10px] uppercase tracking-wider">Most bearish sector</span>
              </div>
              <div className="mt-1 font-semibold text-foreground">
                {pulse.mostBearishSector}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="AI Morning Briefing">{pulse.morningBriefing}</Section>
        <Section title="AI Evening Wrap">{pulse.eveningWrap}</Section>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ListSection title="Trending Themes" items={pulse.trendingThemes} />
        <ListSection title="Upcoming Catalysts" items={pulse.upcomingCatalysts} />
        <ListSection title="Most Discussed" items={pulse.mostDiscussed} />
        <ListSection title="Institutional Buying" items={pulse.institutionalBuying} />
        <ListSection title="Institutional Selling" items={pulse.institutionalSelling} accent="bear" />
      </div>
    </div>
  );
}

function FearGreed({ score, label }: { score: number; label: string }) {
  const tone =
    score >= 75
      ? "text-bull border-bull/40"
      : score >= 55
        ? "text-amber border-amber/40"
        : score >= 35
          ? "text-muted-foreground border-border"
          : "text-bear border-bear/40";
  return (
    <div className={`rounded-md border bg-card p-4 ${tone}`}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest">
        <Gauge className="size-3.5" /> Fear & Greed
      </div>
      <div className="mt-2 flex items-end gap-3">
        <div className="text-5xl font-bold text-foreground tabular-nums">{score}</div>
        <div className="pb-2 text-sm uppercase tracking-wider">{label}</div>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full bg-gradient-to-r from-bear via-amber to-bull transition-all"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
