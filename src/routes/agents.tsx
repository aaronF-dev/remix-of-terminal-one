import { getAiOverride } from "@/lib/ai-override";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  Cpu,
  Globe2,
  LineChart as LineChartIcon,
  Loader2,
  Newspaper,
  Play,
  Scale,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { runAgent, AGENT_KINDS, type AgentKind } from "@/lib/agents.functions";
import { getMarketSnapshot } from "@/lib/terminal.functions";
import type { Quote } from "@/lib/services/types";
import { addHistory } from "@/lib/research-history";

export const Route = createFileRoute("/agents")({
  head: () => ({
    meta: [
      { title: "AI Agents — Terminal One" },
      { name: "description", content: "8 specialized AI agents you can run on any stock." },
    ],
  }),
  component: AgentsPage,
});

// ─── agent meta ──────────────────────────────────────────────────────
interface AgentMeta {
  kind: AgentKind;
  name: string;
  icon: typeof Brain;
  role: string;
  pipeline: string[];
}
const AGENTS: AgentMeta[] = [
  { kind: "news", name: "News Intelligence", icon: Newspaper, role: "Decodes every headline into impact, beneficiaries and risk.", pipeline: ["Headline ingest", "Sentiment", "Entity link", "Impact rank"] },
  { kind: "fundamental", name: "Fundamental Analyst", icon: Scale, role: "Reads quotes, valuations and financial signals.", pipeline: ["Quote pull", "Valuation", "Quality score", "Verdict"] },
  { kind: "technical", name: "Technical Analyst", icon: LineChartIcon, role: "Volatility, momentum, drawdown and trend strength.", pipeline: ["Series digest", "Vol calc", "Trend test", "Signal"] },
  { kind: "macro", name: "Macro Economist", icon: Globe2, role: "Frames cross-asset moves in macro regime context.", pipeline: ["Regime detect", "Rates view", "Cross-asset", "Narrative"] },
  { kind: "risk", name: "Risk Analyst", icon: ShieldAlert, role: "Stress tests every thesis and flags downside.", pipeline: ["Scenario", "Tail risk", "Correlation", "Rank"] },
  { kind: "historical", name: "Historical Pattern Engine", icon: Activity, role: "Maps the present to historical analogs.", pipeline: ["Window match", "Cosine sim", "Analog rank", "Outcome"] },
  { kind: "relationship", name: "Relationship Engine", icon: Cpu, role: "Builds the company knowledge graph.", pipeline: ["Entity graph", "Supplier", "Competitor", "Macro link"] },
  { kind: "synthesis", name: "Research Writer", icon: Sparkles, role: "Synthesizes every signal into the executive brief.", pipeline: ["Evidence rank", "Outline", "Draft", "Confidence"] },
];

type RunState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "error"; message: string }
  | { status: "done"; data: Awaited<ReturnType<typeof runAgent>> };

function AgentsPage() {
  const snapshot = useServerFn(getMarketSnapshot);
  const run = useServerFn(runAgent);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [symbol, setSymbol] = useState<string>("AAPL");
  const [states, setStates] = useState<Record<AgentKind, RunState>>(() => {
    const o = {} as Record<AgentKind, RunState>;
    AGENT_KINDS.forEach((k) => (o[k] = { status: "idle" }));
    return o;
  });

  useEffect(() => {
    snapshot()
      .then((env) => {
        setQuotes(env.data);
        if (env.data.length && !env.data.find((q) => q.symbol === symbol)) {
          setSymbol(env.data[0].symbol);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(() => quotes.find((q) => q.symbol === symbol), [quotes, symbol]);

  const runOne = async (kind: AgentKind) => {
    setStates((s) => ({ ...s, [kind]: { status: "running" } }));
    try {
      const data = await run({ data: { kind, symbol, name: selected?.name, aiOverride: getAiOverride() } });
      setStates((s) => ({ ...s, [kind]: { status: "done", data } }));
      if (!("error" in data)) {
        const meta = AGENTS.find((a) => a.kind === kind);
        const r = data.result as Record<string, unknown>;
        const summary =
          (typeof r.takeaway === "string" && r.takeaway) ||
          (typeof r.executiveBrief === "string" && r.executiveBrief) ||
          `${meta?.name ?? kind} run for ${symbol}`;
        addHistory({
          kind: "agent",
          agentKind: kind,
          agentName: meta?.name ?? kind,
          symbol,
          name: selected?.name ?? symbol,
          summary: String(summary),
          fetchedAt: data.fetchedAt,
          payload: data,
        });
      }
    } catch (e) {
      setStates((s) => ({ ...s, [kind]: { status: "error", message: (e as Error).message } }));
    }
  };

  const runAll = async () => {
    // reset & sequentially to be polite to AI gateway
    for (const a of AGENTS) {
      // eslint-disable-next-line no-await-in-loop
      await runOne(a.kind);
    }
  };

  // Reset states when symbol changes
  useEffect(() => {
    const o = {} as Record<AgentKind, RunState>;
    AGENT_KINDS.forEach((k) => (o[k] = { status: "idle" }));
    setStates(o);
  }, [symbol]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-3 sm:p-4 sm:py-6">
      {/* header / control bar */}
      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-amber">
          <Brain className="size-3.5" /> Reasoning fleet
        </div>
        <h1 className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
          Pick an instrument. Deploy the agents.
        </h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          8 purpose-built AI agents. Each runs its own pipeline against live data and returns a typed result.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:max-w-md">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Selected instrument
            </label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground outline-none focus:border-amber"
            >
              {quotes.length === 0 && <option value={symbol}>{symbol}</option>}
              {quotes.map((q) => (
                <option key={q.symbol} value={q.symbol}>
                  {q.symbol} — {q.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            {selected && (
              <div className="hidden text-right text-xs text-muted-foreground sm:block">
                <div className="text-base font-mono font-semibold text-foreground">
                  {selected.currency} {selected.price.toFixed(2)}
                </div>
                <div className={selected.changePercent >= 0 ? "text-bull" : "text-bear"}>
                  {selected.changePercent >= 0 ? "+" : ""}
                  {selected.changePercent.toFixed(2)}%
                </div>
              </div>
            )}
            <button
              onClick={runAll}
              className="inline-flex items-center gap-2 rounded-md border border-amber/40 bg-amber/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-amber hover:bg-amber/20"
            >
              <Play className="size-3.5" /> Deploy all agents
            </button>
          </div>
        </div>
      </div>

      {/* agent grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {AGENTS.map((a) => (
          <AgentCard key={a.kind} meta={a} state={states[a.kind]} onRun={() => runOne(a.kind)} />
        ))}
      </div>
    </div>
  );
}

// ─── card ────────────────────────────────────────────────────────────
function AgentCard({ meta, state, onRun }: { meta: AgentMeta; state: RunState; onRun: () => void }) {
  const Icon = meta.icon;
  const statusBadge = (() => {
    if (state.status === "running")
      return <span className="flex items-center gap-1.5 rounded-sm border border-amber/40 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-amber"><Loader2 className="size-3 animate-spin" /> Working</span>;
    if (state.status === "done")
      return <span className="flex items-center gap-1.5 rounded-sm border border-bull/40 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-bull"><CheckCircle2 className="size-3" /> Ready</span>;
    if (state.status === "error")
      return <span className="flex items-center gap-1.5 rounded-sm border border-bear/40 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-bear"><XCircle className="size-3" /> Error</span>;
    return <span className="flex items-center gap-1.5 rounded-sm border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-muted-foreground"><span className="pulse-dot" /> Idle</span>;
  })();

  return (
    <div className="flex flex-col rounded-md border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-amber" />
          <div>
            <div className="text-sm font-semibold text-foreground">{meta.name}</div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{meta.role}</p>
          </div>
        </div>
        {statusBadge}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1">
        {meta.pipeline.map((step, i) => (
          <div
            key={step}
            className={
              "rounded-sm px-1.5 py-1 text-center text-[9px] uppercase tracking-wider " +
              (state.status === "running"
                ? "bg-amber/15 text-amber"
                : state.status === "done"
                  ? "bg-bull/10 text-bull"
                  : "bg-surface-2 text-muted-foreground")
            }
            style={state.status === "running" ? { animation: `pulse 1.4s ease-in-out ${i * 0.18}s infinite` } : undefined}
          >
            {step}
          </div>
        ))}
      </div>

      <button
        onClick={onRun}
        disabled={state.status === "running"}
        className="mt-3 inline-flex items-center justify-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-foreground hover:border-amber/40 hover:text-amber disabled:opacity-50"
      >
        {state.status === "running" ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
        {state.status === "done" ? "Re-run" : "Run agent"}
      </button>

      {state.status === "error" && (
        <div className="mt-3 rounded-md border border-bear/40 bg-bear/10 p-2 text-[11px] text-bear">
          {state.message}
        </div>
      )}

      {state.status === "done" && "error" in state.data && (
        <div className="mt-3 rounded-md border border-bear/40 bg-bear/10 p-2 text-[11px] text-bear">
          {state.data.message}
        </div>
      )}

      {state.status === "done" && !("error" in state.data) && (
        <div className="mt-3">
          <AgentResult kind={meta.kind} data={state.data} />
          <div className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            Fetched {new Date(state.data.fetchedAt).toLocaleTimeString()} · {state.data.sources.join(" · ")}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── per-agent result renderers ──────────────────────────────────────
export function AgentResult({ kind, data }: { kind: AgentKind; data: Extract<Awaited<ReturnType<typeof runAgent>>, { kind: AgentKind }> }) {
  const r = data.result as Record<string, unknown>;
  switch (kind) {
    case "news":
      return <NewsResult r={r as never} />;
    case "fundamental":
      return <FundamentalResult r={r as never} />;
    case "technical":
      return <TechnicalResult r={r as never} />;
    case "macro":
      return <MacroResult r={r as never} />;
    case "risk":
      return <RiskResult r={r as never} />;
    case "historical":
      return <HistoricalResult r={r as never} />;
    case "relationship":
      return <RelationshipResult r={r as never} />;
    case "synthesis":
      return <SynthesisResult r={r as never} />;
  }
}

function Bar({ value, max = 100, tone = "amber" }: { value: number; max?: number; tone?: "amber" | "bull" | "bear" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const cls = tone === "bull" ? "bg-bull" : tone === "bear" ? "bg-bear" : "bg-amber";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div className={`h-full ${cls}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "pos" | "neg" | "neutral" }) {
  const cls =
    tone === "pos"
      ? "border-bull/40 text-bull bg-bull/10"
      : tone === "neg"
        ? "border-bear/40 text-bear bg-bear/10"
        : "border-border text-muted-foreground bg-surface-2";
  return <span className={`rounded-sm border px-1.5 py-0.5 text-[9px] uppercase tracking-widest ${cls}`}>{children}</span>;
}

// News
function NewsResult({ r }: { r: { sentiment: string; sentimentScore: number; headlinesAnalyzed: number; topImpacts: Array<{ title: string; impact: string; direction: string; reason: string }>; themes: string[]; takeaway: string } }) {
  const score = r.sentimentScore;
  const tone = score > 10 ? "pos" : score < -10 ? "neg" : "neutral";
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Pill tone={tone}>{r.sentiment}</Pill>
        <div className="text-[11px] text-muted-foreground">{r.headlinesAnalyzed} headlines</div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Sentiment score</span>
          <span className="font-mono text-foreground">{score.toFixed(0)}</span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className={score >= 0 ? "absolute left-1/2 h-full bg-bull" : "absolute h-full bg-bear"}
            style={score >= 0 ? { width: `${Math.min(50, score / 2)}%` } : { left: `${50 - Math.min(50, -score / 2)}%`, width: `${Math.min(50, -score / 2)}%` }}
          />
          <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
        </div>
      </div>
      <div className="space-y-2">
        {r.topImpacts.slice(0, 5).map((i, idx) => (
          <div key={idx} className="rounded-md border border-border bg-surface-2 p-2">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[11px] font-medium text-foreground">{i.title}</div>
              <Pill tone={i.direction === "positive" ? "pos" : i.direction === "negative" ? "neg" : "neutral"}>{i.impact}</Pill>
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">{i.reason}</div>
          </div>
        ))}
      </div>
      {r.themes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {r.themes.map((t) => (
            <Pill key={t}>{t}</Pill>
          ))}
        </div>
      )}
      <p className="text-xs text-foreground">{r.takeaway}</p>
    </div>
  );
}

// Fundamental
function FundamentalResult({ r }: { r: { verdict: string; qualityScore: number; valuationScore: number; growthScore: number; balanceSheetScore: number; signals: Array<{ label: string; value: string; bias: string }>; strengths: string[]; weaknesses: string[]; takeaway: string } }) {
  const verdictTone = r.verdict === "undervalued" ? "pos" : r.verdict === "overvalued" ? "neg" : "neutral";
  const dims: Array<[string, number]> = [
    ["Quality", r.qualityScore],
    ["Valuation", r.valuationScore],
    ["Growth", r.growthScore],
    ["Balance sheet", r.balanceSheetScore],
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Pill tone={verdictTone}>{r.verdict.replace("_", " ")}</Pill>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {dims.map(([k, v]) => (
          <div key={k}>
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>{k}</span>
              <span className="font-mono text-foreground">{v.toFixed(0)}</span>
            </div>
            <Bar value={v} />
          </div>
        ))}
      </div>
      {r.signals.length > 0 && (
        <div className="space-y-1">
          {r.signals.slice(0, 6).map((s, i) => (
            <div key={i} className="flex items-center justify-between rounded-sm bg-surface-2 px-2 py-1 text-[11px]">
              <span className="text-muted-foreground">{s.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-foreground">{s.value}</span>
                <Pill tone={s.bias === "positive" ? "pos" : s.bias === "negative" ? "neg" : "neutral"}>{s.bias}</Pill>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-bull">Strengths</div>
          <ul className="space-y-0.5 text-foreground">{r.strengths.slice(0, 4).map((s, i) => <li key={i}>• {s}</li>)}</ul>
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-bear">Weaknesses</div>
          <ul className="space-y-0.5 text-foreground">{r.weaknesses.slice(0, 4).map((s, i) => <li key={i}>• {s}</li>)}</ul>
        </div>
      </div>
      <p className="text-xs text-foreground">{r.takeaway}</p>
    </div>
  );
}

// Technical
function TechnicalResult({ r }: { r: { trend: string; momentumScore: number; volatilityRegime: string; signals: Array<{ name: string; reading: string; bias: string }>; supportLevels: number[]; resistanceLevels: number[]; takeaway: string } }) {
  const trendIcon = r.trend.includes("up") ? <TrendingUp className="size-3.5" /> : r.trend.includes("down") ? <TrendingDown className="size-3.5" /> : <Activity className="size-3.5" />;
  const trendTone = r.trend.includes("up") ? "pos" : r.trend.includes("down") ? "neg" : "neutral";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={trendTone}>
          <span className="inline-flex items-center gap-1">{trendIcon} {r.trend.replace("_", " ")}</span>
        </Pill>
        <Pill tone={r.volatilityRegime === "extreme" || r.volatilityRegime === "elevated" ? "neg" : "neutral"}>vol: {r.volatilityRegime}</Pill>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Momentum</span>
          <span className="font-mono text-foreground">{r.momentumScore.toFixed(0)}</span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className={r.momentumScore >= 0 ? "absolute left-1/2 h-full bg-bull" : "absolute h-full bg-bear"}
            style={r.momentumScore >= 0 ? { width: `${Math.min(50, r.momentumScore / 2)}%` } : { left: `${50 - Math.min(50, -r.momentumScore / 2)}%`, width: `${Math.min(50, -r.momentumScore / 2)}%` }}
          />
          <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md border border-bull/30 bg-bull/5 p-2">
          <div className="text-[10px] uppercase tracking-widest text-bull">Support</div>
          <div className="mt-1 font-mono text-foreground">{r.supportLevels.length ? r.supportLevels.map((n) => n.toFixed(2)).join(" · ") : "—"}</div>
        </div>
        <div className="rounded-md border border-bear/30 bg-bear/5 p-2">
          <div className="text-[10px] uppercase tracking-widest text-bear">Resistance</div>
          <div className="mt-1 font-mono text-foreground">{r.resistanceLevels.length ? r.resistanceLevels.map((n) => n.toFixed(2)).join(" · ") : "—"}</div>
        </div>
      </div>
      <div className="space-y-1">
        {r.signals.slice(0, 5).map((s, i) => (
          <div key={i} className="flex items-center justify-between rounded-sm bg-surface-2 px-2 py-1 text-[11px]">
            <span className="text-muted-foreground">{s.name}</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-foreground">{s.reading}</span>
              <Pill tone={s.bias === "bullish" ? "pos" : s.bias === "bearish" ? "neg" : "neutral"}>{s.bias}</Pill>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-foreground">{r.takeaway}</p>
    </div>
  );
}

// Macro
function MacroResult({ r }: { r: { regime: string; rateOutlook: string; factors: Array<{ factor: string; exposure: string; note: string }>; crossAsset: string[]; takeaway: string } }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md border border-border bg-surface-2 p-2">
          <div className="text-[10px] uppercase tracking-widest text-amber">Regime</div>
          <div className="mt-1 text-foreground">{r.regime}</div>
        </div>
        <div className="rounded-md border border-border bg-surface-2 p-2">
          <div className="text-[10px] uppercase tracking-widest text-amber">Rate outlook</div>
          <div className="mt-1 text-foreground">{r.rateOutlook}</div>
        </div>
      </div>
      <div className="space-y-1">
        {r.factors.slice(0, 6).map((f, i) => (
          <div key={i} className="rounded-sm bg-surface-2 px-2 py-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{f.factor}</span>
              <Pill tone={f.exposure === "positive" ? "pos" : f.exposure === "negative" ? "neg" : "neutral"}>{f.exposure}</Pill>
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">{f.note}</div>
          </div>
        ))}
      </div>
      {r.crossAsset.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Cross-asset reads</div>
          <ul className="space-y-0.5 text-[11px] text-foreground">{r.crossAsset.slice(0, 4).map((s, i) => <li key={i}>• {s}</li>)}</ul>
        </div>
      )}
      <p className="text-xs text-foreground">{r.takeaway}</p>
    </div>
  );
}

// Risk
function RiskResult({ r }: { r: { overallRisk: string; riskScore: number; scenarios: Array<{ name: string; probability: number; impactPct: number; description: string }>; tailRisks: string[]; hedges: string[]; takeaway: string } }) {
  const tone = r.overallRisk === "low" ? "pos" : r.overallRisk === "extreme" || r.overallRisk === "high" ? "neg" : "neutral";
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Pill tone={tone}>
          <span className="inline-flex items-center gap-1"><AlertTriangle className="size-3" /> {r.overallRisk}</span>
        </Pill>
        <div className="text-[11px] text-muted-foreground">score <span className="font-mono text-foreground">{r.riskScore.toFixed(0)}</span></div>
      </div>
      <Bar value={r.riskScore} tone={r.riskScore > 66 ? "bear" : r.riskScore > 33 ? "amber" : "bull"} />
      <div className="space-y-2">
        {r.scenarios.slice(0, 4).map((s, i) => {
          const pct = Math.round(s.probability * 100);
          const impTone = s.impactPct > 0 ? "pos" : s.impactPct < 0 ? "neg" : "neutral";
          return (
            <div key={i} className="rounded-md border border-border bg-surface-2 p-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-foreground">{s.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">{pct}%</span>
                  <Pill tone={impTone}>{s.impactPct >= 0 ? "+" : ""}{s.impactPct.toFixed(1)}%</Pill>
                </div>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-card">
                <div className="h-full bg-amber" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">{s.description}</div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-bear">Tail risks</div>
          <ul className="space-y-0.5 text-foreground">{r.tailRisks.slice(0, 4).map((s, i) => <li key={i}>• {s}</li>)}</ul>
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-bull">Hedges</div>
          <ul className="space-y-0.5 text-foreground">{r.hedges.slice(0, 4).map((s, i) => <li key={i}>• {s}</li>)}</ul>
        </div>
      </div>
      <p className="text-xs text-foreground">{r.takeaway}</p>
    </div>
  );
}

// Historical
function HistoricalResult({ r }: { r: { analogs: Array<{ period: string; similarity: number; outcome: string; note: string }>; patternsDetected: string[]; baseRateOutcome: string; takeaway: string } }) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {r.analogs.slice(0, 4).map((a, i) => (
          <div key={i} className="rounded-md border border-border bg-surface-2 p-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-foreground">{a.period}</span>
              <span className="font-mono text-amber">{a.similarity.toFixed(0)}% sim</span>
            </div>
            <Bar value={a.similarity} />
            <div className="mt-1 text-[10px] text-muted-foreground"><span className="text-foreground">Outcome:</span> {a.outcome}</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">{a.note}</div>
          </div>
        ))}
      </div>
      {r.patternsDetected.length > 0 && (
        <div className="flex flex-wrap gap-1">{r.patternsDetected.map((p) => <Pill key={p}>{p}</Pill>)}</div>
      )}
      <div className="rounded-md border border-amber/30 bg-amber/5 p-2 text-[11px]">
        <div className="text-[10px] uppercase tracking-widest text-amber">Base rate</div>
        <div className="mt-1 text-foreground">{r.baseRateOutcome}</div>
      </div>
      <p className="text-xs text-foreground">{r.takeaway}</p>
    </div>
  );
}

// Relationship
function RelationshipResult({ r }: { r: { suppliers: Array<{ name: string; note: string }>; customers: Array<{ name: string; note: string }>; competitors: Array<{ name: string; note: string }>; macroLinks: Array<{ name: string; note: string }>; takeaway: string } }) {
  const Section = ({ title, items, tone }: { title: string; items: Array<{ name: string; note: string }>; tone: "pos" | "neg" | "neutral" }) => (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="space-y-1">
        {items.length === 0 && <div className="text-[10px] text-muted-foreground">—</div>}
        {items.slice(0, 4).map((n, i) => (
          <div key={i} className="rounded-sm bg-surface-2 px-2 py-1 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{n.name}</span>
              <Pill tone={tone}>{title.slice(0, 4).toLowerCase()}</Pill>
            </div>
            {n.note && <div className="mt-0.5 text-[10px] text-muted-foreground">{n.note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Section title="Suppliers" items={r.suppliers} tone="neutral" />
        <Section title="Customers" items={r.customers} tone="pos" />
        <Section title="Competitors" items={r.competitors} tone="neg" />
        <Section title="Macro links" items={r.macroLinks} tone="neutral" />
      </div>
      <p className="text-xs text-foreground">{r.takeaway}</p>
    </div>
  );
}

// Synthesis
function SynthesisResult({ r }: { r: { thesis: string; recommendation: string; conviction: string; bullCase: string[]; bearCase: string[]; catalysts: string[]; whatToWatch: string[]; executiveBrief: string } }) {
  const recTone = r.recommendation.includes("buy") ? "pos" : r.recommendation.includes("sell") ? "neg" : "neutral";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={recTone}>{r.recommendation.replace("_", " ")}</Pill>
        <Pill>conviction: {r.conviction}</Pill>
      </div>
      <div className="rounded-md border border-amber/30 bg-amber/5 p-2 text-[11px]">
        <div className="text-[10px] uppercase tracking-widest text-amber">Thesis</div>
        <div className="mt-1 text-foreground">{r.thesis}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-bull">Bull case</div>
          <ul className="space-y-0.5 text-foreground">{r.bullCase.slice(0, 4).map((s, i) => <li key={i}>• {s}</li>)}</ul>
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-bear">Bear case</div>
          <ul className="space-y-0.5 text-foreground">{r.bearCase.slice(0, 4).map((s, i) => <li key={i}>• {s}</li>)}</ul>
        </div>
      </div>
      {r.catalysts.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Catalysts</div>
          <div className="flex flex-wrap gap-1">{r.catalysts.slice(0, 6).map((c) => <Pill key={c}>{c}</Pill>)}</div>
        </div>
      )}
      {r.whatToWatch.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">What to watch</div>
          <ul className="space-y-0.5 text-[11px] text-foreground">{r.whatToWatch.slice(0, 4).map((s, i) => <li key={i}>• {s}</li>)}</ul>
        </div>
      )}
      <p className="text-xs text-foreground">{r.executiveBrief}</p>
    </div>
  );
}
