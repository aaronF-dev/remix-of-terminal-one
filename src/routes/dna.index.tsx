import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Dna } from "lucide-react";
import { getMarketSnapshot } from "@/lib/terminal.functions";

export const Route = createFileRoute("/dna/")({
  head: () => ({
    meta: [
      { title: "Company DNA — Terminal One" },
      {
        name: "description",
        content: "AI-generated company intelligence profiles across 10 dimensions.",
      },
    ],
  }),
  component: DnaIndex,
});

function DnaIndex() {
  const navigate = useNavigate();
  const snapshotFn = useServerFn(getMarketSnapshot);
  const snapshot = useQuery({ queryKey: ["snapshot"], queryFn: () => snapshotFn() });
  const equities = (snapshot.data?.data ?? []).filter((q) =>
    ["equity_us", "equity_in"].includes(q.assetClass),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <div className="text-center">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber/30 bg-amber/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-amber">
          <Dna className="size-3" /> Company DNA
        </div>
        <h1 className="text-2xl font-bold text-foreground">Pick a company to profile.</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each profile scores 10 dimensions with AI-written rationale.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {equities.map((q) => (
          <button
            key={q.symbol}
            onClick={() =>
              navigate({
                to: "/dna/$symbol",
                params: { symbol: q.symbol },
                search: { name: q.name },
              })
            }
            className="rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-amber/40"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">{q.symbol}</span>
              <span
                className={`text-xs ${q.changePercent >= 0 ? "text-bull" : "text-bear"}`}
              >
                {q.changePercent >= 0 ? "+" : ""}
                {q.changePercent.toFixed(2)}%
              </span>
            </div>
            <div className="truncate text-[11px] text-muted-foreground">{q.name}</div>
          </button>
        ))}
        {equities.length === 0 && (
          <div className="col-span-full text-center text-sm text-muted-foreground">
            Loading universe…
          </div>
        )}
      </div>
      <div className="text-center text-[11px] text-muted-foreground">
        Or open from any{" "}
        <Link to="/" className="text-amber underline">
          market row
        </Link>
        .
      </div>
    </div>
  );
}
