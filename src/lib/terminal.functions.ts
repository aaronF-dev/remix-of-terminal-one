import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { resolveAiModel } from "./ai-gateway.server";
import { AiOverrideSchema } from "./ai-override";
import {
  fetchCryptoQuotes,
  fetchYahooQuotes,
  fetchYahooSymbol,
} from "./services/market-data.server";
import { fetchFinanceNews } from "./services/news.server";
import type { DataEnvelope, NewsItem, Quote } from "./services/types";

// ─── Market snapshot: all asset classes ───────────────────────────────
export const getMarketSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<DataEnvelope<Quote[]>> => {
    const errors: string[] = [];
    const sources: string[] = [];
    const [yahoo, crypto] = await Promise.all([
      fetchYahooQuotes().catch((e) => {
        errors.push(`yahoo:${(e as Error).message}`);
        return [] as Quote[];
      }),
      fetchCryptoQuotes().catch((e) => {
        errors.push(`coingecko:${(e as Error).message}`);
        return [] as Quote[];
      }),
    ]);
    if (yahoo.length) sources.push("yahoo_finance");
    if (crypto.length) sources.push("coingecko");
    const all = [...yahoo, ...crypto];
    return {
      data: all,
      fetchedAt: new Date().toISOString(),
      sources,
      stale: all.length === 0,
      errors: errors.length ? errors : undefined,
    };
  },
);

// ─── News feed ────────────────────────────────────────────────────────
export const getNewsFeed = createServerFn({ method: "GET" }).handler(
  async (): Promise<DataEnvelope<NewsItem[]>> => {
    try {
      const items = await fetchFinanceNews();
      return {
        data: items,
        fetchedAt: new Date().toISOString(),
        sources: ["hn_algolia"],
        stale: items.length === 0,
      };
    } catch (e) {
      return {
        data: [],
        fetchedAt: new Date().toISOString(),
        sources: [],
        stale: true,
        errors: [(e as Error).message],
      };
    }
  },
);

// ─── Historical price series (for charts) ─────────────────────────────
export interface SeriesPoint {
  t: string; // ISO date
  close: number;
}

async function fetchHistory(
  symbol: string,
  range = "3mo",
  interval = "1d",
): Promise<SeriesPoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=${interval}&range=${range}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; TerminalOne/1.0; +https://lovable.dev) AppleWebKit/537.36",
      accept: "application/json",
    },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }>;
    };
  };
  const result = json.chart?.result?.[0];
  const ts = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const out: SeriesPoint[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (typeof c === "number" && Number.isFinite(c)) {
      out.push({ t: new Date(ts[i] * 1000).toISOString(), close: c });
    }
  }
  return out;
}

export const getHistoricalSeries = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        symbol: z.string().min(1).max(20),
        range: z.string().default("3mo"),
        interval: z.string().default("1d"),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const points = await fetchHistory(data.symbol, data.range, data.interval);
    return {
      symbol: data.symbol,
      points,
      fetchedAt: new Date().toISOString(),
      sources: points.length ? ["yahoo_finance"] : [],
    };
  });

// ─── AI analysis ──────────────────────────────────────────────────────
const AnalysisSchema = z.object({
  executiveSummary: z.string(),
  supportingEvidence: z.array(z.string()),
  technicalSignals: z.array(z.string()),
  fundamentalSignals: z.array(z.string()),
  macroContext: z.array(z.string()),
  newsImpact: z.array(z.string()),
  historicalComparisons: z.array(z.string()),
  potentialRisks: z.array(z.string()),
  bullishScenario: z.string(),
  bearishScenario: z.string(),
  neutralScenario: z.string(),
  confidenceLevel: z.enum(["low", "medium", "high"]),
  confidenceRationale: z.string(),
});

export const analyzeSymbol = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        symbol: z.string().min(1).max(20),
        name: z.string().optional(),
        aiOverride: AiOverrideSchema.optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {

    const [quote, news, history] = await Promise.all([
      fetchYahooSymbol(data.symbol, data.name),
      fetchFinanceNews().catch(() => [] as NewsItem[]),
      fetchHistory(data.symbol, "3mo", "1d").catch(() => [] as SeriesPoint[]),
    ]);

    if (!quote) {
      return {
        error: "DATA_UNAVAILABLE" as const,
        message: `Could not verify live market data for ${data.symbol}. Refusing to fabricate.`,
        fetchedAt: new Date().toISOString(),
        sources: [] as string[],
      } as const;
    }

    const relevantNews = news
      .filter(
        (n) =>
          n.title.toLowerCase().includes(data.symbol.toLowerCase()) ||
          (data.name && n.title.toLowerCase().includes(data.name.toLowerCase())),
      )
      .slice(0, 6);

    const fetchedAt = new Date().toISOString();
    const model = resolveAiModel(data.aiOverride);

    const historyDigest = summarizeSeries(history);

    const schemaShape = `{
  "executiveSummary": string,
  "supportingEvidence": string[],
  "technicalSignals": string[],
  "fundamentalSignals": string[],
  "macroContext": string[],
  "newsImpact": string[],
  "historicalComparisons": string[],
  "potentialRisks": string[],
  "bullishScenario": string,
  "bearishScenario": string,
  "neutralScenario": string,
  "confidenceLevel": "low" | "medium" | "high",
  "confidenceRationale": string
}`;

    const systemPrompt = `You are Terminal One, a real-time financial intelligence engine.
HARD RULES:
- Never imply certainty about future market movements.
- Distinguish facts from analysis explicitly.
- Use ONLY the data provided. Do not invent numbers.
- If a section has no supporting data, return [] or a short sentence stating data is unavailable.
- Frame scenarios as conditional, probabilistic outlooks — never predictions.
- Respond with ONLY a single valid JSON object matching this exact shape (no markdown, no commentary, no code fences):
${schemaShape}`;

    const userPrompt = `Live data snapshot (timestamp ${fetchedAt}):
${JSON.stringify(quote, null, 2)}

3-month price history digest:
${JSON.stringify(historyDigest, null, 2)}

Related news headlines:
${
  relevantNews.length
    ? relevantNews.map((n) => `- [${n.source} ${n.publishedAt}] ${n.title}`).join("\n")
    : "(none matched in current feed)"
}

Produce the Terminal One analysis JSON for ${quote.name} (${quote.symbol}).`;

    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
    });

    const parsed = extractJson(text);
    const analysis = AnalysisSchema.parse(coerceAnalysis(parsed));

    return {
      analysis,
      quote,
      history,
      newsUsed: relevantNews,
      fetchedAt,
      sources: [quote.source, ...(history.length ? ["yahoo_finance"] : []), ...(relevantNews.length ? ["hn_algolia"] : [])],
    };
  });

// ─── AI comparison across multiple symbols ───────────────────────────
const ComparisonSchema = z.object({
  executiveSummary: z.string(),
  winner: z.string(),
  winnerRationale: z.string(),
  dimensions: z.array(
    z.object({
      name: z.string(),
      insight: z.string(),
      ranking: z.array(z.object({ symbol: z.string(), score: z.number(), note: z.string() })),
    }),
  ),
  riskComparison: z.array(z.object({ symbol: z.string(), risk: z.string() })),
  correlationNotes: z.string(),
  portfolioGuidance: z.string(),
  confidenceLevel: z.enum(["low", "medium", "high"]),
});

export type ComparisonResult = z.infer<typeof ComparisonSchema>;

export const compareSymbols = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        symbols: z.array(z.string().min(1).max(20)).min(2).max(4),
        aiOverride: AiOverrideSchema.optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {

    const results = await Promise.all(
      data.symbols.map(async (s) => {
        const [quote, history] = await Promise.all([
          fetchYahooSymbol(s),
          fetchHistory(s, "3mo", "1d").catch(() => [] as SeriesPoint[]),
        ]);
        return { symbol: s, quote, history };
      }),
    );

    const valid = results.filter((r): r is { symbol: string; quote: Quote; history: SeriesPoint[] } => !!r.quote);
    if (valid.length < 2) {
      return {
        error: "DATA_UNAVAILABLE" as const,
        message: `Could not verify live data for at least 2 of: ${data.symbols.join(", ")}.`,
        fetchedAt: new Date().toISOString(),
        sources: [] as string[],
      };
    }

    const fetchedAt = new Date().toISOString();
    const model = resolveAiModel(data.aiOverride);

    const digest = valid.map((v) => ({
      symbol: v.symbol,
      name: v.quote.name,
      live: {
        price: v.quote.price,
        currency: v.quote.currency,
        changePercent: v.quote.changePercent,
      },
      history: summarizeSeries(v.history),
    }));

    const schemaShape = `{
  "executiveSummary": string,
  "winner": string,            // ticker symbol that scores best overall
  "winnerRationale": string,
  "dimensions": [
    { "name": string, "insight": string,
      "ranking": [ { "symbol": string, "score": number (0-100), "note": string } ] }
  ],
  "riskComparison": [ { "symbol": string, "risk": string } ],
  "correlationNotes": string,
  "portfolioGuidance": string,
  "confidenceLevel": "low" | "medium" | "high"
}`;

    const systemPrompt = `You are Terminal One's cross-asset comparison engine.
HARD RULES:
- Use ONLY the supplied data. Do not invent numbers.
- Score each symbol on each dimension 0-100 (relative to the others in this set).
- Dimensions MUST include at minimum: "Momentum", "Volatility", "Trend Strength", "Recent Drawdown".
- Frame outlooks as probabilistic, never as predictions.
- Respond with ONLY a single valid JSON object matching this shape (no markdown, no code fences):
${schemaShape}`;

    const userPrompt = `Comparison set fetched at ${fetchedAt}:
${JSON.stringify(digest, null, 2)}

Produce the comparison JSON.`;

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: systemPrompt,
      prompt: userPrompt,
    });

    const parsed = extractJson(text);
    const comparison = ComparisonSchema.parse(coerceComparison(parsed, valid.map((v) => v.symbol)));

    return {
      comparison,
      quotes: valid.map((v) => v.quote),
      histories: valid.map((v) => ({ symbol: v.symbol, points: v.history })),
      fetchedAt,
      sources: ["yahoo_finance"],
    };
  });

// ─── helpers ─────────────────────────────────────────────────────────
function summarizeSeries(points: SeriesPoint[]) {
  if (!points.length) return { available: false };
  const first = points[0].close;
  const last = points[points.length - 1].close;
  const high = Math.max(...points.map((p) => p.close));
  const low = Math.min(...points.map((p) => p.close));
  const returns: number[] = [];
  for (let i = 1; i < points.length; i++) {
    returns.push((points[i].close - points[i - 1].close) / points[i - 1].close);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
  const variance =
    returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length || 1);
  const vol = Math.sqrt(variance) * Math.sqrt(252) * 100; // annualized %
  const totalReturnPct = ((last - first) / first) * 100;
  const drawdownPct = ((last - high) / high) * 100;
  return {
    available: true,
    samples: points.length,
    first,
    last,
    high,
    low,
    totalReturnPct: round(totalReturnPct),
    annualizedVolPct: round(vol),
    drawdownFromHighPct: round(drawdownPct),
  };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function extractJson(raw: string): unknown {
  let s = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = s.search(/[{[]/);
  const end = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (start === -1 || end === -1) throw new Error("Model returned no JSON");
  s = s.slice(start, end + 1);
  try {
    return JSON.parse(s);
  } catch {
    const cleaned = s
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .replace(/[\x00-\x1F\x7F]/g, " ");
    return JSON.parse(cleaned);
  }
}

function coerceAnalysis(obj: unknown): Record<string, unknown> {
  const o = (obj ?? {}) as Record<string, unknown>;
  const arr = (k: string) => {
    const v = o[k];
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === "string" && v.trim()) return [v];
    return [];
  };
  const str = (k: string, fallback = "Data unavailable.") =>
    typeof o[k] === "string" && (o[k] as string).trim() ? (o[k] as string) : fallback;
  const conf = o.confidenceLevel;
  return {
    executiveSummary: str("executiveSummary"),
    supportingEvidence: arr("supportingEvidence"),
    technicalSignals: arr("technicalSignals"),
    fundamentalSignals: arr("fundamentalSignals"),
    macroContext: arr("macroContext"),
    newsImpact: arr("newsImpact"),
    historicalComparisons: arr("historicalComparisons"),
    potentialRisks: arr("potentialRisks"),
    bullishScenario: str("bullishScenario"),
    bearishScenario: str("bearishScenario"),
    neutralScenario: str("neutralScenario"),
    confidenceLevel: conf === "low" || conf === "medium" || conf === "high" ? conf : "low",
    confidenceRationale: str("confidenceRationale"),
  };
}

function coerceComparison(obj: unknown, symbols: string[]): Record<string, unknown> {
  const o = (obj ?? {}) as Record<string, unknown>;
  const str = (k: string, fallback = "Data unavailable.") =>
    typeof o[k] === "string" && (o[k] as string).trim() ? (o[k] as string) : fallback;
  const conf = o.confidenceLevel;
  const dimsRaw = Array.isArray(o.dimensions) ? (o.dimensions as unknown[]) : [];
  const dimensions = dimsRaw.map((d) => {
    const dd = (d ?? {}) as Record<string, unknown>;
    const rankingRaw = Array.isArray(dd.ranking) ? (dd.ranking as unknown[]) : [];
    const ranking = rankingRaw.map((r) => {
      const rr = (r ?? {}) as Record<string, unknown>;
      return {
        symbol: typeof rr.symbol === "string" ? rr.symbol : "",
        score: typeof rr.score === "number" ? rr.score : 0,
        note: typeof rr.note === "string" ? rr.note : "",
      };
    });
    return {
      name: typeof dd.name === "string" ? dd.name : "Dimension",
      insight: typeof dd.insight === "string" ? dd.insight : "",
      ranking,
    };
  });
  const risksRaw = Array.isArray(o.riskComparison) ? (o.riskComparison as unknown[]) : [];
  const riskComparison = risksRaw.map((r) => {
    const rr = (r ?? {}) as Record<string, unknown>;
    return {
      symbol: typeof rr.symbol === "string" ? rr.symbol : "",
      risk: typeof rr.risk === "string" ? rr.risk : "",
    };
  });
  const winner =
    typeof o.winner === "string" && symbols.includes(o.winner) ? o.winner : symbols[0];
  return {
    executiveSummary: str("executiveSummary"),
    winner,
    winnerRationale: str("winnerRationale"),
    dimensions,
    riskComparison,
    correlationNotes: str("correlationNotes"),
    portfolioGuidance: str("portfolioGuidance"),
    confidenceLevel: conf === "low" || conf === "medium" || conf === "high" ? conf : "low",
  };
}
