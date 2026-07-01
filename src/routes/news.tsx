import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  Loader2,
  Newspaper,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { getNewsFeed } from "@/lib/terminal.functions";
import { explainNews } from "@/lib/phase2.functions";
import { FreshnessBar, ListSection, Section } from "@/components/analysis-view";
import type { NewsItem } from "@/lib/services/types";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "News Intelligence — Terminal One" },
      {
        name: "description",
        content:
          "Every market story explained by AI — what happened, why it matters, who benefits, who's hurt.",
      },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  const feedFn = useServerFn(getNewsFeed);
  const explainFn = useServerFn(explainNews);
  const feed = useQuery({
    queryKey: ["news"],
    queryFn: () => feedFn(),
    refetchInterval: 60_000,
  });
  const [selected, setSelected] = useState<NewsItem | null>(null);
  const mutation = useMutation({
    mutationFn: (item: NewsItem) =>
      explainFn({ data: { title: item.title, url: item.url, source: item.source, aiOverride: getAiOverride() } }),
  });

  const onSelect = (n: NewsItem) => {
    setSelected(n);
    mutation.mutate(n);
  };

  const intel = mutation.data;

  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-12 gap-4 p-4">
      <aside className="col-span-12 lg:col-span-4 rounded-md border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border p-3">
          <div className="flex items-center gap-2">
            <Newspaper className="size-4 text-amber" />
            <h2 className="text-sm font-semibold uppercase tracking-widest">Newswire</h2>
          </div>
          {feed.isFetching && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
        </header>
        <div className="max-h-[80vh] overflow-y-auto">
          {(feed.data?.data ?? []).map((n) => (
            <button
              key={n.id}
              onClick={() => onSelect(n)}
              className={`block w-full border-b border-border p-3 text-left transition-colors hover:bg-accent ${
                selected?.id === n.id ? "bg-accent" : ""
              }`}
            >
              <div className="text-xs text-foreground">{n.title}</div>
              <div className="mt-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>{n.source}</span>
                <span>{new Date(n.publishedAt).toLocaleTimeString()}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="col-span-12 lg:col-span-8 space-y-4">
        {!selected && (
          <div className="rounded-md border border-border bg-card p-10 text-center">
            <Sparkles className="mx-auto size-6 text-amber" />
            <h2 className="mt-3 text-lg font-semibold text-foreground">
              Select a headline to decode it.
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              AI explains what happened, why it matters, who benefits, who is hurt.
            </p>
          </div>
        )}

        {selected && (
          <div className="rounded-md border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{selected.title}</h2>
                <div className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <span>{selected.source}</span> · <span>{selected.publishedAt}</span>
                </div>
              </div>
              <a
                href={selected.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-amber/40 hover:text-amber"
              >
                Source <ArrowRight className="size-3" />
              </a>
            </div>
          </div>
        )}

        {mutation.isPending && (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Decoding story…
          </div>
        )}
        {mutation.error && (
          <div className="flex items-start gap-2 rounded-md border border-warn/40 bg-warn/5 p-3 text-sm text-warn">
            <ShieldAlert className="size-4 shrink-0" />
            <div>{(mutation.error as Error).message}</div>
          </div>
        )}

        {intel && (
          <div className="space-y-4">
            <FreshnessBar
              fetchedAt={intel.fetchedAt}
              sources={intel.sources}
              confidence={intel.intel.confidenceLevel}
            />
            <Section title="What happened">{intel.intel.whatHappened}</Section>
            <Section title="Why it matters">{intel.intel.whyItMatters}</Section>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ListSection title="Who benefits" items={intel.intel.whoBenefits} />
              <ListSection title="Who is hurt" items={intel.intel.whoIsHurt} accent="bear" />
            </div>
            <Section title="Historical comparison">{intel.intel.historicalComparison}</Section>
            <Section title="Estimated market impact">
              {intel.intel.estimatedMarketImpact}
            </Section>
            {intel.intel.relatedSymbols.length > 0 && (
              <div className="rounded-md border border-border bg-card p-3">
                <div className="mb-2 text-[10px] uppercase tracking-widest text-amber">
                  Related symbols
                </div>
                <div className="flex flex-wrap gap-2">
                  {intel.intel.relatedSymbols.map((s) => (
                    <span
                      key={s}
                      className="rounded-sm border border-border bg-surface-2 px-2 py-0.5 text-xs text-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
