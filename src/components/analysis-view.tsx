import { ShieldAlert } from "lucide-react";

export interface AnalysisData {
  executiveSummary: string;
  supportingEvidence: string[];
  technicalSignals: string[];
  fundamentalSignals: string[];
  macroContext: string[];
  newsImpact: string[];
  historicalComparisons: string[];
  potentialRisks: string[];
  bullishScenario: string;
  bearishScenario: string;
  neutralScenario: string;
  confidenceLevel: "low" | "medium" | "high";
  confidenceRationale: string;
}

export function AnalysisView({
  analysis,
  fetchedAt,
  sources,
}: {
  analysis: AnalysisData;
  fetchedAt: string;
  sources: string[];
}) {
  return (
    <div className="space-y-4 text-sm">
      <FreshnessBar
        fetchedAt={fetchedAt}
        sources={sources}
        confidence={analysis.confidenceLevel}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Scenario tone="bull" label="Bullish" text={analysis.bullishScenario} />
        <Scenario tone="muted" label="Neutral" text={analysis.neutralScenario} />
        <Scenario tone="bear" label="Bearish" text={analysis.bearishScenario} />
      </div>

      <Section title="Executive Summary">{analysis.executiveSummary}</Section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ListSection title="Supporting Evidence" items={analysis.supportingEvidence} />
        <ListSection title="Technical Signals" items={analysis.technicalSignals} />
        <ListSection title="Fundamental Signals" items={analysis.fundamentalSignals} />
        <ListSection title="Macro Context" items={analysis.macroContext} />
        <ListSection title="News Impact" items={analysis.newsImpact} />
        <ListSection title="Historical Comparisons" items={analysis.historicalComparisons} />
      </div>

      <ListSection
        title="Potential Risks"
        items={analysis.potentialRisks}
        accent="bear"
      />

      <Section title="Confidence Rationale">{analysis.confidenceRationale}</Section>
    </div>
  );
}

export function FreshnessBar({
  fetchedAt,
  sources,
  confidence,
}: {
  fetchedAt: string;
  sources: string[];
  confidence: "low" | "medium" | "high";
}) {
  const tone =
    confidence === "high"
      ? "text-bull border-bull/40"
      : confidence === "medium"
        ? "text-amber border-amber/40"
        : "text-bear border-bear/40";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border bg-surface-2 px-3 py-2 text-[10px] uppercase tracking-wider">
      <span className="text-muted-foreground">
        Data @ {new Date(fetchedAt).toLocaleString()}
      </span>
      <span className={`rounded-sm border px-2 py-0.5 ${tone}`}>
        Confidence: {confidence}
      </span>
      <span className="text-muted-foreground">Sources: {sources.join(", ") || "—"}</span>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-amber">
        {title}
      </h3>
      <p className="leading-relaxed text-foreground">{children}</p>
    </div>
  );
}

export function ListSection({
  title,
  items,
  accent,
}: {
  title: string;
  items: string[];
  accent?: "bear";
}) {
  if (!items.length) return null;
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-amber">
        {title}
      </h3>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-foreground">
            <span className={accent === "bear" ? "text-bear" : "text-muted-foreground"}>›</span>
            <span className="leading-relaxed">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Scenario({
  tone,
  label,
  text,
}: {
  tone: "bull" | "bear" | "muted";
  label: string;
  text: string;
}) {
  const cls =
    tone === "bull"
      ? "border-bull/40 text-bull"
      : tone === "bear"
        ? "border-bear/40 text-bear"
        : "border-border text-muted-foreground";
  return (
    <div className={`rounded-md border bg-surface-2 p-3 ${cls}`}>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest">{label}</div>
      <p className="text-[12px] leading-relaxed text-foreground">{text}</p>
    </div>
  );
}

export function ErrorBlock({
  message,
  fetchedAt,
}: {
  message?: string;
  fetchedAt: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-warn/40 bg-warn/5 p-3 text-sm text-warn">
      <ShieldAlert className="size-4 shrink-0" />
      <div>
        <div className="font-semibold uppercase tracking-wider">Data unavailable</div>
        <div className="text-foreground">{message}</div>
        <div className="mt-1 text-[10px] text-muted-foreground">
          Timestamp {new Date(fetchedAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
