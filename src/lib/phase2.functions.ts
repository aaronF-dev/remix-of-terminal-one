import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import {
  fetchCryptoQuotes,
  fetchYahooQuotes,
  fetchYahooSymbol,
} from "./services/market-data.server";
import { fetchFinanceNews } from "./services/news.server";
import type { NewsItem, Quote } from "./services/types";

// ────────────────────────────── helpers ──────────────────────────────
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

async function jsonModel(system: string, prompt: string): Promise<unknown> {
  const { text } = await generateText({
    model: gateway()(MODEL),
    system,
    prompt,
  });
  return extractJson(text);
}

function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v];
  return [];
}
function str(v: unknown, fb = "Data unavailable."): string {
  return typeof v === "string" && v.trim() ? v : fb;
}

// ─────────────────────────── Global AI Search ───────────────────────────
const AskAnswerSchema = z.object({
  intent: z.string(),
  headline: z.string(),
  answer: z.string(),
  bullets: z.array(z.string()),
  relatedSymbols: z.array(z.string()),
  followUps: z.array(z.string()),
  confidenceLevel: z.enum(["low", "medium", "high"]),
});
export type AskAnswer = z.infer<typeof AskAnswerSchema>;

export const askAnything = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z.object({ query: z.string().min(2).max(400) }).parse(raw),
  )
  .handler(async ({ data }): Promise<{
    answer: AskAnswer;
    fetchedAt: string;
    sources: string[];
    contextQuotes: Quote[];
    newsUsed: NewsItem[];
  }> => {
    const [yahoo, crypto, news] = await Promise.all([
      fetchYahooQuotes().catch(() => [] as Quote[]),
      fetchCryptoQuotes().catch(() => [] as Quote[]),
      fetchFinanceNews().catch(() => [] as NewsItem[]),
    ]);
    const all = [...yahoo, ...crypto];
    const q = data.query.toLowerCase();
    const matchedQuotes = all
      .filter(
        (x) =>
          q.includes(x.symbol.toLowerCase()) ||
          q.includes(x.name.toLowerCase().split(" ")[0]),
      )
      .slice(0, 6);
    const matchedNews = news
      .filter((n) =>
        q
          .split(/\s+/)
          .some(
            (tok) => tok.length > 3 && n.title.toLowerCase().includes(tok),
          ),
      )
      .slice(0, 8);
    const fetchedAt = new Date().toISOString();
    const sources: string[] = [];
    if (yahoo.length) sources.push("yahoo_finance");
    if (crypto.length) sources.push("coingecko");
    if (news.length) sources.push("hn_algolia");

    const system = `You are Terminal One — an AI-first financial intelligence operating system.
Hard rules:
- Use ONLY the supplied live data and news. Cite numbers only if present in the data.
- Distinguish facts vs analysis. Frame outlooks as probabilistic, never predictions.
- If you cannot answer with the data provided, say so explicitly.
- Always be specific, dense, and Wall Street grade. No fluff. No disclaimers about being an AI.
- Respond with ONLY a single JSON object matching this shape (no fences, no commentary):
{
  "intent": string,             // one of: company, comparison, concept, macro, sector, news, screener, general
  "headline": string,           // 1-line punchy answer
  "answer": string,             // 2-5 sentence reasoned answer
  "bullets": string[],          // 3-6 supporting bullets (facts, signals, evidence)
  "relatedSymbols": string[],   // tickers the user might explore next
  "followUps": string[],        // 3 natural-language follow-up questions
  "confidenceLevel": "low" | "medium" | "high"
}`;

    const prompt = `User query (timestamp ${fetchedAt}):
"${data.query}"

Live market snapshot (top matches):
${JSON.stringify(
  matchedQuotes.length ? matchedQuotes : all.slice(0, 12),
  null,
  2,
)}

Related news headlines:
${
  matchedNews.length
    ? matchedNews
        .map((n) => `- [${n.source} ${n.publishedAt}] ${n.title}`)
        .join("\n")
    : "(none directly matched the query)"
}

Produce the JSON answer.`;

    const parsed = (await jsonModel(system, prompt)) as Record<string, unknown>;
    const answer = AskAnswerSchema.parse({
      intent: str(parsed.intent, "general"),
      headline: str(parsed.headline, "Result"),
      answer: str(parsed.answer),
      bullets: arr(parsed.bullets),
      relatedSymbols: arr(parsed.relatedSymbols).map((s) => s.toUpperCase()),
      followUps: arr(parsed.followUps),
      confidenceLevel:
        parsed.confidenceLevel === "high" || parsed.confidenceLevel === "medium"
          ? parsed.confidenceLevel
          : "low",
    });

    return {
      answer,
      fetchedAt,
      sources,
      contextQuotes: matchedQuotes,
      newsUsed: matchedNews,
    };
  });

// ─────────────────────────── Market Pulse ───────────────────────────
const PulseSchema = z.object({
  morningBriefing: z.string(),
  eveningWrap: z.string(),
  fearGreedScore: z.number(),
  fearGreedLabel: z.string(),
  marketSentiment: z.string(),
  mostBullishSector: z.string(),
  mostBearishSector: z.string(),
  trendingThemes: z.array(z.string()),
  upcomingCatalysts: z.array(z.string()),
  mostDiscussed: z.array(z.string()),
  institutionalBuying: z.array(z.string()),
  institutionalSelling: z.array(z.string()),
});
export type MarketPulse = z.infer<typeof PulseSchema>;

export const getMarketPulse = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    pulse: MarketPulse;
    quotes: Quote[];
    fetchedAt: string;
    sources: string[];
  }> => {
    const [yahoo, crypto, news] = await Promise.all([
      fetchYahooQuotes().catch(() => [] as Quote[]),
      fetchCryptoQuotes().catch(() => [] as Quote[]),
      fetchFinanceNews().catch(() => [] as NewsItem[]),
    ]);
    const all = [...yahoo, ...crypto];
    const fetchedAt = new Date().toISOString();

    const system = `You are Terminal One's Market Pulse engine.
Hard rules:
- Use ONLY the supplied live data.
- fearGreedScore must be integer 0-100. Label one of: Extreme Fear, Fear, Neutral, Greed, Extreme Greed.
- Be concise, Wall Street grade. No disclaimers.
- Reply with ONLY JSON of this shape:
{
  "morningBriefing": string,
  "eveningWrap": string,
  "fearGreedScore": number,
  "fearGreedLabel": string,
  "marketSentiment": string,
  "mostBullishSector": string,
  "mostBearishSector": string,
  "trendingThemes": string[],
  "upcomingCatalysts": string[],
  "mostDiscussed": string[],
  "institutionalBuying": string[],
  "institutionalSelling": string[]
}`;

    const prompt = `Live market snapshot @ ${fetchedAt}:
${JSON.stringify(all, null, 2)}

Top news headlines:
${news.slice(0, 15).map((n) => `- ${n.title}`).join("\n")}

Produce the Market Pulse JSON.`;

    const parsed = (await jsonModel(system, prompt)) as Record<string, unknown>;
    const scoreNum =
      typeof parsed.fearGreedScore === "number"
        ? Math.max(0, Math.min(100, Math.round(parsed.fearGreedScore)))
        : 50;
    const pulse = PulseSchema.parse({
      morningBriefing: str(parsed.morningBriefing),
      eveningWrap: str(parsed.eveningWrap),
      fearGreedScore: scoreNum,
      fearGreedLabel: str(parsed.fearGreedLabel, "Neutral"),
      marketSentiment: str(parsed.marketSentiment),
      mostBullishSector: str(parsed.mostBullishSector, "—"),
      mostBearishSector: str(parsed.mostBearishSector, "—"),
      trendingThemes: arr(parsed.trendingThemes),
      upcomingCatalysts: arr(parsed.upcomingCatalysts),
      mostDiscussed: arr(parsed.mostDiscussed),
      institutionalBuying: arr(parsed.institutionalBuying),
      institutionalSelling: arr(parsed.institutionalSelling),
    });

    const sources = ["yahoo_finance", "coingecko", "hn_algolia"];
    return { pulse, quotes: all, fetchedAt, sources };
  },
);

// ─────────────────────────── Company DNA ───────────────────────────
const DnaScoreSchema = z.object({
  score: z.number(),
  grade: z.string(),
  rationale: z.string(),
});

const DnaSchema = z.object({
  businessSummary: z.string(),
  overallRating: z.number(),
  overallVerdict: z.string(),
  scores: z.object({
    businessQuality: DnaScoreSchema,
    growth: DnaScoreSchema,
    financialHealth: DnaScoreSchema,
    competitiveMoat: DnaScoreSchema,
    innovation: DnaScoreSchema,
    managementQuality: DnaScoreSchema,
    valuation: DnaScoreSchema,
    risk: DnaScoreSchema,
    marketSentiment: DnaScoreSchema,
    longTermOutlook: DnaScoreSchema,
  }),
  keyStrengths: z.array(z.string()),
  keyWeaknesses: z.array(z.string()),
  catalysts: z.array(z.string()),
});
export type CompanyDNA = z.infer<typeof DnaSchema>;

export const getCompanyDNA = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({ symbol: z.string().min(1).max(20), name: z.string().optional() })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const quote = await fetchYahooSymbol(data.symbol, data.name);
    if (!quote) {
      return {
        error: "DATA_UNAVAILABLE" as const,
        message: `Could not verify live data for ${data.symbol}.`,
        fetchedAt: new Date().toISOString(),
        sources: [] as string[],
      };
    }
    const fetchedAt = new Date().toISOString();
    const system = `You are Terminal One's Company DNA engine.
Generate a structured intelligence profile. Score every dimension 0-100 with a one-letter grade A/B/C/D/F and a 1-2 sentence rationale.
Hard rules:
- Be honest, balanced, Wall Street grade.
- Each rationale must justify the number with specific reasoning.
- overallRating = weighted synthesis of all dimensions (0-100).
- Reply with ONLY JSON of this shape (no fences):
{
  "businessSummary": string,
  "overallRating": number,
  "overallVerdict": string,
  "scores": {
    "businessQuality":   { "score": number, "grade": string, "rationale": string },
    "growth":            { "score": number, "grade": string, "rationale": string },
    "financialHealth":   { "score": number, "grade": string, "rationale": string },
    "competitiveMoat":   { "score": number, "grade": string, "rationale": string },
    "innovation":        { "score": number, "grade": string, "rationale": string },
    "managementQuality": { "score": number, "grade": string, "rationale": string },
    "valuation":         { "score": number, "grade": string, "rationale": string },
    "risk":              { "score": number, "grade": string, "rationale": string },
    "marketSentiment":   { "score": number, "grade": string, "rationale": string },
    "longTermOutlook":   { "score": number, "grade": string, "rationale": string }
  },
  "keyStrengths": string[],
  "keyWeaknesses": string[],
  "catalysts": string[]
}`;
    const prompt = `Symbol: ${quote.symbol} (${quote.name})
Live quote @ ${fetchedAt}:
${JSON.stringify(quote, null, 2)}

Produce the Company DNA JSON.`;

    const parsed = (await jsonModel(system, prompt)) as Record<string, unknown>;
    const coerceScore = (v: unknown) => {
      const o = (v ?? {}) as Record<string, unknown>;
      const sc = typeof o.score === "number" ? Math.max(0, Math.min(100, o.score)) : 50;
      return {
        score: Math.round(sc),
        grade: str(o.grade, "C"),
        rationale: str(o.rationale),
      };
    };
    const scoresRaw = (parsed.scores ?? {}) as Record<string, unknown>;
    const dna = DnaSchema.parse({
      businessSummary: str(parsed.businessSummary),
      overallRating:
        typeof parsed.overallRating === "number"
          ? Math.round(Math.max(0, Math.min(100, parsed.overallRating)))
          : 50,
      overallVerdict: str(parsed.overallVerdict),
      scores: {
        businessQuality: coerceScore(scoresRaw.businessQuality),
        growth: coerceScore(scoresRaw.growth),
        financialHealth: coerceScore(scoresRaw.financialHealth),
        competitiveMoat: coerceScore(scoresRaw.competitiveMoat),
        innovation: coerceScore(scoresRaw.innovation),
        managementQuality: coerceScore(scoresRaw.managementQuality),
        valuation: coerceScore(scoresRaw.valuation),
        risk: coerceScore(scoresRaw.risk),
        marketSentiment: coerceScore(scoresRaw.marketSentiment),
        longTermOutlook: coerceScore(scoresRaw.longTermOutlook),
      },
      keyStrengths: arr(parsed.keyStrengths),
      keyWeaknesses: arr(parsed.keyWeaknesses),
      catalysts: arr(parsed.catalysts),
    });

    return {
      dna,
      quote,
      fetchedAt,
      sources: [quote.source],
    };
  });

// ─────────────────────────── Opportunity Radar ───────────────────────────
const RadarSchema = z.object({
  interpretedQuery: z.string(),
  filters: z.array(z.object({ name: z.string(), value: z.string() })),
  results: z.array(
    z.object({
      symbol: z.string(),
      name: z.string(),
      thesis: z.string(),
      matchScore: z.number(),
    }),
  ),
  reasoning: z.string(),
  caveat: z.string(),
});
export type RadarResult = z.infer<typeof RadarSchema>;

export const runOpportunityRadar = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z.object({ query: z.string().min(3).max(300) }).parse(raw),
  )
  .handler(async ({ data }) => {
    const [yahoo, crypto] = await Promise.all([
      fetchYahooQuotes().catch(() => [] as Quote[]),
      fetchCryptoQuotes().catch(() => [] as Quote[]),
    ]);
    const universe = [...yahoo, ...crypto];
    const fetchedAt = new Date().toISOString();

    const system = `You are Terminal One's Opportunity Radar — a natural-language screener.
Hard rules:
- Translate the user's natural language into structured filters.
- Recommend ONLY symbols that exist in the supplied universe.
- matchScore 0-100, justify each pick in 1-2 sentences.
- Reply with ONLY JSON:
{
  "interpretedQuery": string,
  "filters": [ { "name": string, "value": string } ],
  "results": [ { "symbol": string, "name": string, "thesis": string, "matchScore": number } ],
  "reasoning": string,
  "caveat": string
}`;
    const prompt = `User query: "${data.query}"
Investable universe (live @ ${fetchedAt}):
${JSON.stringify(
  universe.map((q) => ({
    symbol: q.symbol,
    name: q.name,
    assetClass: q.assetClass,
    price: q.price,
    changePercent: q.changePercent,
  })),
  null,
  2,
)}

Produce the JSON.`;

    const parsed = (await jsonModel(system, prompt)) as Record<string, unknown>;
    const resultsRaw = Array.isArray(parsed.results) ? (parsed.results as unknown[]) : [];
    const results = resultsRaw.map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        symbol: str(o.symbol, ""),
        name: str(o.name, ""),
        thesis: str(o.thesis),
        matchScore:
          typeof o.matchScore === "number"
            ? Math.round(Math.max(0, Math.min(100, o.matchScore)))
            : 50,
      };
    });
    const filtersRaw = Array.isArray(parsed.filters) ? (parsed.filters as unknown[]) : [];
    const filters = filtersRaw.map((f) => {
      const o = (f ?? {}) as Record<string, unknown>;
      return { name: str(o.name, ""), value: str(o.value, "") };
    });

    const radar = RadarSchema.parse({
      interpretedQuery: str(parsed.interpretedQuery, data.query),
      filters,
      results,
      reasoning: str(parsed.reasoning),
      caveat: str(
        parsed.caveat,
        "Results limited to Terminal One's live universe. Not investment advice.",
      ),
    });

    return { radar, fetchedAt, sources: ["yahoo_finance", "coingecko"] };
  });

// ─────────────────────────── News Intelligence ───────────────────────────
const NewsIntelSchema = z.object({
  whatHappened: z.string(),
  whyItMatters: z.string(),
  whoBenefits: z.array(z.string()),
  whoIsHurt: z.array(z.string()),
  historicalComparison: z.string(),
  estimatedMarketImpact: z.string(),
  relatedSymbols: z.array(z.string()),
  confidenceLevel: z.enum(["low", "medium", "high"]),
});
export type NewsIntel = z.infer<typeof NewsIntelSchema>;

export const explainNews = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        title: z.string().min(3).max(500),
        url: z.string().optional(),
        source: z.string().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const fetchedAt = new Date().toISOString();
    const system = `You are Terminal One's News Intelligence engine.
Explain a financial news story with structured reasoning.
- Be specific. No filler.
- If the headline is ambiguous, say so and reason from likely context.
- Reply with ONLY JSON:
{
  "whatHappened": string,
  "whyItMatters": string,
  "whoBenefits": string[],
  "whoIsHurt": string[],
  "historicalComparison": string,
  "estimatedMarketImpact": string,
  "relatedSymbols": string[],
  "confidenceLevel": "low" | "medium" | "high"
}`;
    const prompt = `Headline: ${data.title}
Source: ${data.source ?? "unknown"}
URL: ${data.url ?? "n/a"}
Timestamp: ${fetchedAt}

Produce the JSON.`;
    const parsed = (await jsonModel(system, prompt)) as Record<string, unknown>;
    const intel = NewsIntelSchema.parse({
      whatHappened: str(parsed.whatHappened),
      whyItMatters: str(parsed.whyItMatters),
      whoBenefits: arr(parsed.whoBenefits),
      whoIsHurt: arr(parsed.whoIsHurt),
      historicalComparison: str(parsed.historicalComparison),
      estimatedMarketImpact: str(parsed.estimatedMarketImpact),
      relatedSymbols: arr(parsed.relatedSymbols).map((s) => s.toUpperCase()),
      confidenceLevel:
        parsed.confidenceLevel === "high" || parsed.confidenceLevel === "medium"
          ? parsed.confidenceLevel
          : "low",
    });
    return { intel, fetchedAt, sources: ["ai_reasoning"] };
  });
