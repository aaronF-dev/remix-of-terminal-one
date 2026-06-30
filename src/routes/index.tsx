import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Brain,
  Dna,
  Loader2,
  Newspaper,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { getMarketSnapshot, getNewsFeed } from "@/lib/terminal.functions";
import type { Quote } from "@/lib/services/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Markets — Terminal One" },
      {
        name: "description",
        content:
          "Real-time multi-asset market snapshot — equities, indices, crypto, FX, commodities — with live news.",
      },
      { property: "og:title", content: "Markets — Terminal One" },
      {
        property: "og:description",
        content: "Live multi-asset prices and news with explicit data freshness.",
      },
    ],
  }),
  component: MarketsPage,
});

const ASSET_TABS = [
  { id: "all", label: "All" },
  { id: "index", label: "Indices" },
  { id: "equity_us", label: "US Equities" },
  { id: "equity_in", label: "India" },
  { id: "crypto", label: "Crypto" },
  { id: "commodity", label: "Commodities" },
  { id: "currency", label: "FX" },
] as const;

function fmtPrice(n: number, ccy: string) {
  const opts: Intl.NumberFormatOptions = {
    minimumFractionDigits: n < 10 ? 4 : 2,
    maximumFractionDigits: n < 10 ? 4 : 2,
  };
  const sym = ccy === "USD" ? "$" : ccy === "INR" ? "₹" : ccy === "EUR" ? "€" : "";
  return `${sym}${n.toLocaleString("en-US", opts)}`;
}

function fmtAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function MarketsPage() {
  const snapshotFn = useServerFn(getMarketSnapshot);
  const newsFn = useServerFn(getNewsFeed);
  const navigate = useNavigate();

  const snapshot = useQuery({
    queryKey: ["snapshot"],
    queryFn: () => snapshotFn(),
    refetchInterval: 15_000,
    staleTime: 0,
  });
  const news = useQuery({
    queryKey: ["news"],
    queryFn: () => newsFn(),
    refetchInterval: 60_000,
    staleTime: 0,
  });

  const [tab, setTab] = useState<(typeof ASSET_TABS)[number]["id"]>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Quote | null>(null);

  const quotes = snapshot.data?.data ?? [];
  const filtered = useMemo(() => {
    let rows = quotes;
    if (tab !== "all") rows = rows.filter((q) => q.assetClass === tab);
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter(
        (r) => r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [quotes, tab, query]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 p-3 sm:p-4">
      <HeroAsk />

      <div className="grid grid-cols-12 gap-4">
      {/* Market grid */}
      <section className="col-span-12 lg:col-span-9 rounded-md border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
          <div className="flex min-w-0 items-center gap-2">
            <Activity className="size-4 shrink-0 text-amber" />
            <h2 className="truncate text-sm font-semibold uppercase tracking-widest">
              Market Snapshot
            </h2>
            {snapshot.isFetching && (
              <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />
            )}
            {snapshot.data?.fetchedAt && (
              <span className="hidden sm:inline text-[10px] uppercase tracking-wider text-muted-foreground">
                · synced {fmtAgo(snapshot.data.fetchedAt)}
              </span>
            )}
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search symbol / name"
                className="h-8 w-full rounded-sm border border-border bg-surface-2 pl-7 pr-2 text-xs text-foreground outline-none focus:border-amber"
              />
            </div>
          </div>
        </header>

        <nav className="flex flex-wrap gap-1 border-b border-border bg-surface px-2 py-1">
          {ASSET_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-sm px-2.5 py-1 text-[11px] uppercase tracking-wider transition-colors ${
                tab === t.id
                  ? "bg-amber/15 text-amber"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="ticker-row border-b-2 border-border bg-surface text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Symbol</span>
          <span className="text-right">Price</span>
          <span className="text-right">Chg</span>
          <span className="text-right">%</span>
        </div>

        <div className="max-h-[68vh] overflow-y-auto">
          {snapshot.isLoading && (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading live market data…
            </div>
          )}
          {!snapshot.isLoading && filtered.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No instruments match the current filter.
            </div>
          )}
          {filtered.map((q) => {
            const up = q.changePercent >= 0;
            return (
              <button
                key={`${q.source}:${q.symbol}`}
                onClick={() => setSelected(q)}
                className={`ticker-row w-full text-left transition-colors hover:bg-accent ${
                  selected?.symbol === q.symbol ? "bg-accent" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{q.symbol}</span>
                    <span className="rounded-sm bg-surface-2 px-1 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                      {q.assetClass.replace("_", " ")}
                    </span>
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">{q.name}</div>
                </div>
                <div className="text-right text-sm text-foreground">
                  {fmtPrice(q.price, q.currency)}
                </div>
                <div className={`text-right text-sm ${up ? "text-bull" : "text-bear"}`}>
                  {up ? "+" : ""}
                  {q.change.toFixed(q.price < 10 ? 4 : 2)}
                </div>
                <div
                  className={`flex items-center justify-end gap-1 text-sm ${
                    up ? "text-bull" : "text-bear"
                  }`}
                >
                  {up ? (
                    <ArrowUpRight className="size-3.5" />
                  ) : (
                    <ArrowDownRight className="size-3.5" />
                  )}
                  {up ? "+" : ""}
                  {q.changePercent.toFixed(2)}%
                </div>
              </button>
            );
          })}
        </div>

        {snapshot.data?.errors && snapshot.data.errors.length > 0 && (
          <div className="flex items-start gap-2 border-t border-border bg-warn/5 p-2 text-[11px] text-warn">
            <ShieldAlert className="size-3.5 shrink-0" />
            <div>
              Partial provider outage: {snapshot.data.errors.join(" · ")}. Affected rows omitted —
              no fabricated values.
            </div>
          </div>
        )}
      </section>

      {/* Right column: actions + news */}
      <aside className="col-span-12 lg:col-span-3 flex flex-col gap-4">
        <div className="rounded-md border border-border bg-card p-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-amber">
            Selected instrument
          </h3>
          {selected ? (
            <div className="mt-2 space-y-3">
              <div>
                <div className="text-lg font-bold text-foreground">{selected.symbol}</div>
                <div className="text-xs text-muted-foreground">{selected.name}</div>
                <div className="mt-1 text-sm">
                  {fmtPrice(selected.price, selected.currency)}{" "}
                  <span
                    className={selected.changePercent >= 0 ? "text-bull" : "text-bear"}
                  >
                    {selected.changePercent >= 0 ? "+" : ""}
                    {selected.changePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() =>
                    navigate({
                      to: "/analyze/$symbol",
                      params: { symbol: selected.symbol },
                      search: { name: selected.name },
                    })
                  }
                  className="flex items-center justify-center gap-2 rounded-sm bg-amber px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Brain className="size-3.5" /> AI Analyze
                </button>
                <button
                  onClick={() =>
                    navigate({
                      to: "/compare",
                      search: { symbols: selected.symbol },
                    })
                  }
                  className="flex items-center justify-center gap-2 rounded-sm border border-amber/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-amber transition-colors hover:bg-amber/10"
                >
                  <BarChart3 className="size-3.5" /> Add to Compare
                </button>
                <button
                  onClick={() =>
                    navigate({
                      to: "/dna/$symbol",
                      params: { symbol: selected.symbol },
                      search: { name: selected.name },
                    })
                  }
                  className="flex items-center justify-center gap-2 rounded-sm border border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:border-amber/40 hover:text-amber"
                >
                  <Dna className="size-3.5" /> Company DNA
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Click any instrument in the grid to analyze or compare it.
            </p>
          )}
        </div>

        <div className="rounded-md border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border p-3">
            <div className="flex items-center gap-2">
              <Newspaper className="size-4 text-amber" />
              <h2 className="text-sm font-semibold uppercase tracking-widest">Newswire</h2>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {news.data?.fetchedAt ? `synced ${fmtAgo(news.data.fetchedAt)}` : "—"}
            </span>
          </header>
          <div className="max-h-[60vh] overflow-y-auto">
            {news.isLoading && (
              <div className="p-4 text-xs text-muted-foreground">Polling news feed…</div>
            )}
            {!news.isLoading && (news.data?.data ?? []).length === 0 && (
              <div className="p-4 text-xs text-muted-foreground">
                No matching items in current feed window.
              </div>
            )}
            {(news.data?.data ?? []).map((n) => (
              <a
                key={n.id}
                href={n.url}
                target="_blank"
                rel="noreferrer"
                className="block border-b border-border p-3 transition-colors hover:bg-accent"
              >
                <div className="text-xs text-foreground">{n.title}</div>
                <div className="mt-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>{n.source}</span>
                  <span>{fmtAgo(n.publishedAt)}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </aside>
      </div>
    </div>
  );
}

function HeroAsk() {
  const navigate = useNavigate();
  const [v, setV] = useState("");
  return (
    <section className="rounded-md border border-border bg-gradient-to-br from-card via-card to-surface-2 p-5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-amber">
        <Sparkles className="size-3" /> AI-First Financial Intelligence
      </div>
      <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
        Ask anything. Reason across every market.
      </h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const q = v.trim();
          if (!q) {
            navigate({ to: "/ask" });
            return;
          }
          navigate({ to: "/ask", search: { q } });
        }}
        className="mt-3 flex items-center gap-2 rounded-md border border-border bg-background p-2 focus-within:border-amber/60"
      >
        <Search className="ml-2 size-4 text-muted-foreground" />
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="Why is NVIDIA moving today? · Compare Microsoft and Google · Find undervalued semis…"
          className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button className="rounded-sm bg-amber px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground">
          Ask
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <Link
          to="/pulse"
          className="rounded-sm border border-border bg-surface-2 px-2 py-1 text-muted-foreground hover:border-amber/40 hover:text-amber"
        >
          Market Pulse
        </Link>
        <Link
          to="/radar"
          className="rounded-sm border border-border bg-surface-2 px-2 py-1 text-muted-foreground hover:border-amber/40 hover:text-amber"
        >
          Opportunity Radar
        </Link>
        <Link
          to="/news"
          className="rounded-sm border border-border bg-surface-2 px-2 py-1 text-muted-foreground hover:border-amber/40 hover:text-amber"
        >
          News Intelligence
        </Link>
        <Link
          to="/dna"
          className="rounded-sm border border-border bg-surface-2 px-2 py-1 text-muted-foreground hover:border-amber/40 hover:text-amber"
        >
          Company DNA
        </Link>
        <Link
          to="/agents"
          className="rounded-sm border border-border bg-surface-2 px-2 py-1 text-muted-foreground hover:border-amber/40 hover:text-amber"
        >
          AI Agents
        </Link>
      </div>
    </section>
  );
}
