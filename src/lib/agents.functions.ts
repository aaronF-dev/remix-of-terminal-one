import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { fetchYahooSymbol } from "./services/market-data.server";
import { fetchFinanceNews } from "./services/news.server";
import type { NewsItem, Quote } from "./services/types";

// ─── shared helpers ──────────────────────────────────────────────────
function extractJson(raw: string): unknown {
  let s = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = s.search(/[{[]/);
  const end = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (start === -1 || end === -1) throw new Error("Model returned no JSON");
  s = s.slice(start, end + 1);
  try {
    return JSON.parse(s);
  } catch {
    return JSON.parse(
      s.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, " "),
    );
  }
}
function gateway() {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  return createLovableAiGatewayProvider(apiKey);
}
const MODEL = "google/gemini-3-flash-preview";

async function jsonAI(system: string, prompt: string): Promise<unknown> {
  const { text } = await generateText({ model: gateway()(MODEL), system, prompt });
  return extractJson(text);
}

function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v];
  return [];
}
function str(v: unknown, fb = "Data unavailable."): string {
  return typeof v === "string" && v.trim() ? v : fb;
}
function num(v: unknown, fb = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fb;
}

// ─── historical series (re-used) ─────────────────────────────────────
interface SeriesPoint { t: string; close: number }
async function fetchHistory(symbol: string, range = "6mo", interval = "1d"): Promise<SeriesPoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; TerminalOne/1.0) AppleWebKit/537.36",
      accept: "application/json",
    },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> };
  };
  const r = json.chart?.result?.[0];
  const ts = r?.timestamp ?? [];
  const cl = r?.indicators?.quote?.[0]?.close ?? [];
  const out: SeriesPoint[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = cl[i];
    if (typeof c === "number" && Number.isFinite(c))
      out.push({ t: new Date(ts[i] * 1000).toISOString(), close: c });
  }
  return out;
}

function summarizeSeries(p: SeriesPoint[]) {
  if (!p.length) return { available: false as const };
  const first = p[0].close;
  const last = p[p.length - 1].close;
  const high = Math.max(...p.map((x) => x.close));
  const low = Math.min(...p.map((x) => x.close));
  const rets: number[] = [];
  for (let i = 1; i < p.length; i++) rets.push((p[i].close - p[i - 1].close) / p[i - 1].close);
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1);
  const vol = Math.sqrt(variance) * Math.sqrt(252) * 100;
  const sma20 = p.slice(-20).reduce((a, b) => a + b.close, 0) / Math.min(20, p.length);
  const sma50 = p.slice(-50).reduce((a, b) => a + b.close, 0) / Math.min(50, p.length);
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    available: true as const,
    samples: p.length,
    first: round(first),
    last: round(last),
    high: round(high),
    low: round(low),
    totalReturnPct: round(((last - first) / first) * 100),
    annualizedVolPct: round(vol),
    drawdownFromHighPct: round(((last - high) / high) * 100),
    sma20: round(sma20),
    sma50: round(sma50),
    aboveSma20: last > sma20,
    aboveSma50: last > sma50,
  };
}

// ─── agent kinds ─────────────────────────────────────────────────────
export const AGENT_KINDS = [
  "news",
  "fundamental",
  "technical",
  "macro",
  "risk",
  "historical",
  "relationship",
  "synthesis",
] as const;
export type AgentKind = (typeof AGENT_KINDS)[number];

// Per-agent schemas
const NewsAgentSchema = z.object({
  sentiment: z.enum(["bullish", "bearish", "neutral", "mixed"]),
  sentimentScore: z.number(),
  headlinesAnalyzed: z.number(),
  topImpacts: z.array(z.object({ title: z.string(), impact: z.enum(["high", "medium", "low"]), direction: z.enum(["positive", "negative", "neutral"]), reason: z.string() })),
  themes: z.array(z.string()),
  takeaway: z.string(),
});

const FundamentalAgentSchema = z.object({
  verdict: z.enum(["undervalued", "fairly_valued", "overvalued", "uncertain"]),
  qualityScore: z.number(),
  valuationScore: z.number(),
  growthScore: z.number(),
  balanceSheetScore: z.number(),
  signals: z.array(z.object({ label: z.string(), value: z.string(), bias: z.enum(["positive", "negative", "neutral"]) })),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  takeaway: z.string(),
});

const TechnicalAgentSchema = z.object({
  trend: z.enum(["strong_up", "up", "sideways", "down", "strong_down"]),
  momentumScore: z.number(),
  volatilityRegime: z.enum(["low", "normal", "elevated", "extreme"]),
  signals: z.array(z.object({ name: z.string(), reading: z.string(), bias: z.enum(["bullish", "bearish", "neutral"]) })),
  supportLevels: z.array(z.number()),
  resistanceLevels: z.array(z.number()),
  takeaway: z.string(),
});

const MacroAgentSchema = z.object({
  regime: z.string(),
  rateOutlook: z.string(),
  factors: z.array(z.object({ factor: z.string(), exposure: z.enum(["positive", "negative", "neutral"]), note: z.string() })),
  crossAsset: z.array(z.string()),
  takeaway: z.string(),
});

const RiskAgentSchema = z.object({
  overallRisk: z.enum(["low", "medium", "high", "extreme"]),
  riskScore: z.number(),
  scenarios: z.array(z.object({ name: z.string(), probability: z.number(), impactPct: z.number(), description: z.string() })),
  tailRisks: z.array(z.string()),
  hedges: z.array(z.string()),
  takeaway: z.string(),
});

const HistoricalAgentSchema = z.object({
  analogs: z.array(z.object({ period: z.string(), similarity: z.number(), outcome: z.string(), note: z.string() })),
  patternsDetected: z.array(z.string()),
  baseRateOutcome: z.string(),
  takeaway: z.string(),
});

const RelationshipAgentSchema = z.object({
  suppliers: z.array(z.object({ name: z.string(), note: z.string() })),
  customers: z.array(z.object({ name: z.string(), note: z.string() })),
  competitors: z.array(z.object({ name: z.string(), note: z.string() })),
  macroLinks: z.array(z.object({ name: z.string(), note: z.string() })),
  takeaway: z.string(),
});

const SynthesisAgentSchema = z.object({
  thesis: z.string(),
  recommendation: z.enum(["strong_buy", "buy", "hold", "sell", "strong_sell"]),
  conviction: z.enum(["low", "medium", "high"]),
  bullCase: z.array(z.string()),
  bearCase: z.array(z.string()),
  catalysts: z.array(z.string()),
  whatToWatch: z.array(z.string()),
  executiveBrief: z.string(),
});

const SCHEMAS = {
  news: NewsAgentSchema,
  fundamental: FundamentalAgentSchema,
  technical: TechnicalAgentSchema,
  macro: MacroAgentSchema,
  risk: RiskAgentSchema,
  historical: HistoricalAgentSchema,
  relationship: RelationshipAgentSchema,
  synthesis: SynthesisAgentSchema,
} as const;

// Per-agent prompt builders + coercion
function buildPrompt(kind: AgentKind, ctx: { quote: Quote; news: NewsItem[]; digest: ReturnType<typeof summarizeSeries> }) {
  const { quote, news, digest } = ctx;
  const liveBlock = JSON.stringify(quote, null, 2);
  const newsBlock = news.length
    ? news.slice(0, 10).map((n) => `- [${n.source} ${n.publishedAt}] ${n.title}`).join("\n")
    : "(no related news in current feed)";
  const histBlock = JSON.stringify(digest, null, 2);

  const base = `You are part of Terminal One's agent fleet. Use ONLY the provided data. Never invent numbers. Output a SINGLE valid JSON object, no markdown, no code fences.`;
  switch (kind) {
    case "news":
      return {
        system: `${base} You are the NEWS INTELLIGENCE agent. Decode headlines into impact and sentiment. Schema:
{ "sentiment": "bullish|bearish|neutral|mixed", "sentimentScore": number (-100..100), "headlinesAnalyzed": number,
  "topImpacts": [{"title": string, "impact": "high|medium|low", "direction": "positive|negative|neutral", "reason": string}],
  "themes": string[], "takeaway": string }`,
        prompt: `Asset: ${quote.name} (${quote.symbol})\nLive quote:\n${liveBlock}\nHeadlines:\n${newsBlock}`,
      };
    case "fundamental":
      return {
        system: `${base} You are the FUNDAMENTAL ANALYST. Read the live quote and any available metrics. Schema:
{ "verdict": "undervalued|fairly_valued|overvalued|uncertain",
  "qualityScore": number(0..100), "valuationScore": number(0..100), "growthScore": number(0..100), "balanceSheetScore": number(0..100),
  "signals": [{"label": string, "value": string, "bias": "positive|negative|neutral"}],
  "strengths": string[], "weaknesses": string[], "takeaway": string }`,
        prompt: `Asset: ${quote.name} (${quote.symbol})\nLive quote:\n${liveBlock}\n6-month digest:\n${histBlock}`,
      };
    case "technical":
      return {
        system: `${base} You are the TECHNICAL ANALYST. Read momentum, volatility, trend. Schema:
{ "trend": "strong_up|up|sideways|down|strong_down",
  "momentumScore": number(-100..100), "volatilityRegime": "low|normal|elevated|extreme",
  "signals": [{"name": string, "reading": string, "bias": "bullish|bearish|neutral"}],
  "supportLevels": number[], "resistanceLevels": number[], "takeaway": string }`,
        prompt: `Asset: ${quote.name} (${quote.symbol})\nLive quote:\n${liveBlock}\n6-month digest:\n${histBlock}`,
      };
    case "macro":
      return {
        system: `${base} You are the MACRO ECONOMIST. Frame this asset within current macro regime. Schema:
{ "regime": string, "rateOutlook": string,
  "factors": [{"factor": string, "exposure": "positive|negative|neutral", "note": string}],
  "crossAsset": string[], "takeaway": string }`,
        prompt: `Asset: ${quote.name} (${quote.symbol}, ${quote.assetClass})\nLive quote:\n${liveBlock}\nRecent headlines for macro context:\n${newsBlock}`,
      };
    case "risk":
      return {
        system: `${base} You are the RISK ANALYST. Stress test. Probabilities sum near 1.0. Schema:
{ "overallRisk": "low|medium|high|extreme", "riskScore": number(0..100),
  "scenarios": [{"name": string, "probability": number(0..1), "impactPct": number, "description": string}],
  "tailRisks": string[], "hedges": string[], "takeaway": string }`,
        prompt: `Asset: ${quote.name} (${quote.symbol})\nLive quote:\n${liveBlock}\n6-month digest:\n${histBlock}\nHeadlines:\n${newsBlock}`,
      };
    case "historical":
      return {
        system: `${base} You are the HISTORICAL PATTERN ENGINE. Map present to past analogs. Schema:
{ "analogs": [{"period": string, "similarity": number(0..100), "outcome": string, "note": string}],
  "patternsDetected": string[], "baseRateOutcome": string, "takeaway": string }`,
        prompt: `Asset: ${quote.name} (${quote.symbol})\nLive quote:\n${liveBlock}\n6-month digest:\n${histBlock}`,
      };
    case "relationship":
      return {
        system: `${base} You are the RELATIONSHIP ENGINE. Build a small knowledge graph around this asset. Schema:
{ "suppliers": [{"name": string, "note": string}], "customers": [{"name": string, "note": string}],
  "competitors": [{"name": string, "note": string}], "macroLinks": [{"name": string, "note": string}],
  "takeaway": string }`,
        prompt: `Asset: ${quote.name} (${quote.symbol}, ${quote.assetClass})\nLive quote:\n${liveBlock}`,
      };
    case "synthesis":
      return {
        system: `${base} You are the RESEARCH WRITER. Synthesize everything into an executive brief. Schema:
{ "thesis": string, "recommendation": "strong_buy|buy|hold|sell|strong_sell", "conviction": "low|medium|high",
  "bullCase": string[], "bearCase": string[], "catalysts": string[], "whatToWatch": string[], "executiveBrief": string }`,
        prompt: `Asset: ${quote.name} (${quote.symbol})\nLive quote:\n${liveBlock}\n6-month digest:\n${histBlock}\nHeadlines:\n${newsBlock}`,
      };
  }
}

function coerce(kind: AgentKind, o: unknown): unknown {
  const x = (o ?? {}) as Record<string, unknown>;
  const aobj = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? v.map((y) => (y && typeof y === "object" ? (y as Record<string, unknown>) : {})) : [];
  const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fb: T): T =>
    typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fb;

  switch (kind) {
    case "news":
      return {
        sentiment: oneOf(x.sentiment, ["bullish", "bearish", "neutral", "mixed"] as const, "neutral"),
        sentimentScore: num(x.sentimentScore),
        headlinesAnalyzed: num(x.headlinesAnalyzed),
        topImpacts: aobj(x.topImpacts).map((i) => ({
          title: str(i.title, "Untitled"),
          impact: oneOf(i.impact, ["high", "medium", "low"] as const, "medium"),
          direction: oneOf(i.direction, ["positive", "negative", "neutral"] as const, "neutral"),
          reason: str(i.reason),
        })),
        themes: arr(x.themes),
        takeaway: str(x.takeaway),
      };
    case "fundamental":
      return {
        verdict: oneOf(x.verdict, ["undervalued", "fairly_valued", "overvalued", "uncertain"] as const, "uncertain"),
        qualityScore: num(x.qualityScore),
        valuationScore: num(x.valuationScore),
        growthScore: num(x.growthScore),
        balanceSheetScore: num(x.balanceSheetScore),
        signals: aobj(x.signals).map((s) => ({
          label: str(s.label, "Signal"),
          value: str(s.value),
          bias: oneOf(s.bias, ["positive", "negative", "neutral"] as const, "neutral"),
        })),
        strengths: arr(x.strengths),
        weaknesses: arr(x.weaknesses),
        takeaway: str(x.takeaway),
      };
    case "technical":
      return {
        trend: oneOf(x.trend, ["strong_up", "up", "sideways", "down", "strong_down"] as const, "sideways"),
        momentumScore: num(x.momentumScore),
        volatilityRegime: oneOf(x.volatilityRegime, ["low", "normal", "elevated", "extreme"] as const, "normal"),
        signals: aobj(x.signals).map((s) => ({
          name: str(s.name, "Signal"),
          reading: str(s.reading),
          bias: oneOf(s.bias, ["bullish", "bearish", "neutral"] as const, "neutral"),
        })),
        supportLevels: Array.isArray(x.supportLevels) ? (x.supportLevels as unknown[]).map((n) => num(n)).filter((n) => n > 0) : [],
        resistanceLevels: Array.isArray(x.resistanceLevels) ? (x.resistanceLevels as unknown[]).map((n) => num(n)).filter((n) => n > 0) : [],
        takeaway: str(x.takeaway),
      };
    case "macro":
      return {
        regime: str(x.regime),
        rateOutlook: str(x.rateOutlook),
        factors: aobj(x.factors).map((f) => ({
          factor: str(f.factor, "Factor"),
          exposure: oneOf(f.exposure, ["positive", "negative", "neutral"] as const, "neutral"),
          note: str(f.note),
        })),
        crossAsset: arr(x.crossAsset),
        takeaway: str(x.takeaway),
      };
    case "risk":
      return {
        overallRisk: oneOf(x.overallRisk, ["low", "medium", "high", "extreme"] as const, "medium"),
        riskScore: num(x.riskScore),
        scenarios: aobj(x.scenarios).map((s) => ({
          name: str(s.name, "Scenario"),
          probability: num(s.probability),
          impactPct: num(s.impactPct),
          description: str(s.description),
        })),
        tailRisks: arr(x.tailRisks),
        hedges: arr(x.hedges),
        takeaway: str(x.takeaway),
      };
    case "historical":
      return {
        analogs: aobj(x.analogs).map((a) => ({
          period: str(a.period, "Unknown"),
          similarity: num(a.similarity),
          outcome: str(a.outcome),
          note: str(a.note),
        })),
        patternsDetected: arr(x.patternsDetected),
        baseRateOutcome: str(x.baseRateOutcome),
        takeaway: str(x.takeaway),
      };
    case "relationship": {
      const list = (k: string) =>
        aobj(x[k]).map((n) => ({ name: str(n.name, "Unknown"), note: str(n.note) }));
      return {
        suppliers: list("suppliers"),
        customers: list("customers"),
        competitors: list("competitors"),
        macroLinks: list("macroLinks"),
        takeaway: str(x.takeaway),
      };
    }
    case "synthesis":
      return {
        thesis: str(x.thesis),
        recommendation: oneOf(x.recommendation, ["strong_buy", "buy", "hold", "sell", "strong_sell"] as const, "hold"),
        conviction: oneOf(x.conviction, ["low", "medium", "high"] as const, "low"),
        bullCase: arr(x.bullCase),
        bearCase: arr(x.bearCase),
        catalysts: arr(x.catalysts),
        whatToWatch: arr(x.whatToWatch),
        executiveBrief: str(x.executiveBrief),
      };
  }
}

// ─── unified server function ─────────────────────────────────────────
export const runAgent = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        kind: z.enum(AGENT_KINDS),
        symbol: z.string().min(1).max(20),
        name: z.string().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const fetchedAt = new Date().toISOString();
    const [quote, news, history] = await Promise.all([
      fetchYahooSymbol(data.symbol, data.name),
      fetchFinanceNews().catch(() => [] as NewsItem[]),
      fetchHistory(data.symbol, "6mo", "1d").catch(() => [] as SeriesPoint[]),
    ]);

    if (!quote) {
      return {
        error: "DATA_UNAVAILABLE" as const,
        message: `Could not verify live data for ${data.symbol}.`,
        fetchedAt,
        sources: [] as string[],
      };
    }

    const sym = data.symbol.toLowerCase();
    const nm = (data.name ?? quote.name).toLowerCase();
    const relevant = news.filter((n) => {
      const t = n.title.toLowerCase();
      return t.includes(sym) || (nm && t.includes(nm));
    });
    const newsForAgent = relevant.length ? relevant.slice(0, 12) : news.slice(0, 8);
    const digest = summarizeSeries(history);

    const { system, prompt } = buildPrompt(data.kind, { quote, news: newsForAgent, digest });
    const parsedRaw = await jsonAI(system, prompt);
    const coerced = coerce(data.kind, parsedRaw);
    const schema = SCHEMAS[data.kind];
    const result = schema.parse(coerced);

    return {
      kind: data.kind,
      symbol: data.symbol,
      result,
      quote,
      digest,
      newsCount: newsForAgent.length,
      fetchedAt,
      sources: [quote.source, ...(history.length ? ["yahoo_finance"] : []), ...(newsForAgent.length ? ["news"] : [])],
    };
  });

export type AgentRunSuccess = Extract<Awaited<ReturnType<typeof runAgent>>, { kind: AgentKind }>;
