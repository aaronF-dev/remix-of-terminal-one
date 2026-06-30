import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/analyze/")({
  head: () => ({
    meta: [
      { title: "AI Reasoning — Terminal One" },
      {
        name: "description",
        content:
          "Select an instrument from the Markets grid to run a grounded AI analysis.",
      },
    ],
  }),
  component: AnalyzeIndex,
});

function AnalyzeIndex() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <div className="rounded-md border border-border bg-card p-6 sm:p-8">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-amber">
          <Sparkles className="size-3" /> AI Reasoning
        </div>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-foreground sm:text-3xl">
          <Brain className="size-6 text-amber" /> Analyze an instrument
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          AI Reasoning runs a fully grounded, multi-section analysis on a specific
          instrument — quote, 3-month price action, signals, scenarios, risks and
          confidence. Pick any instrument from the live Markets grid to get started.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-sm bg-amber px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
          >
            Go to Markets <ArrowRight className="size-3.5" />
          </Link>
          <Link
            to="/research"
            className="inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:border-amber/40 hover:text-amber"
          >
            View saved research
          </Link>
        </div>

        <div className="mt-6 rounded-sm border border-border bg-surface-2 p-4 text-[11px] uppercase tracking-wider text-muted-foreground">
          Tip — click any row in Markets, then hit <span className="text-amber">AI Analyze</span>.
        </div>
      </div>
    </div>
  );
}
