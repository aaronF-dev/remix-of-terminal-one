// Market Data Service — modular provider layer.
// Providers are independently replaceable. Each returns Quote[] in the unified schema.
import type { Quote, AssetClass } from "./types";

const UA =
  "Mozilla/5.0 (compatible; TerminalOne/1.0; +https://lovable.dev) AppleWebKit/537.36";

// ───────────────────────── CoinGecko (crypto) ─────────────────────────
const CRYPTO_IDS = [
  "bitcoin",
  "ethereum",
  "solana",
  "binancecoin",
  "ripple",
  "cardano",
  "dogecoin",
  "avalanche-2",
];

export async function fetchCryptoQuotes(): Promise<Quote[]> {
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${CRYPTO_IDS.join(
    ",",
  )}&price_change_percentage=24h`;
  const res = await fetch(url, { headers: { "User-Agent": UA, accept: "application/json" } });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const rows = (await res.json()) as Array<{
    symbol: string;
    name: string;
    current_price: number;
    price_change_24h: number;
    price_change_percentage_24h: number;
    market_cap: number;
    total_volume: number;
    high_24h: number;
    low_24h: number;
  }>;
  const now = new Date().toISOString();
  return rows.map((r) => ({
    symbol: r.symbol.toUpperCase(),
    name: r.name,
    assetClass: "crypto" as AssetClass,
    price: r.current_price,
    change: r.price_change_24h,
    changePercent: r.price_change_percentage_24h,
    currency: "USD",
    marketCap: r.market_cap,
    volume: r.total_volume,
    high24h: r.high_24h,
    low24h: r.low_24h,
    source: "coingecko",
    fetchedAt: now,
  }));
}

// ───────────────────────── Yahoo Finance (equities / indices / fx) ─────────────────────────
// Unofficial public endpoint. Replaceable in one place.
interface YahooSpec {
  symbol: string;
  name: string;
  assetClass: AssetClass;
}

const YAHOO_UNIVERSE: YahooSpec[] = [
  // US equities
  { symbol: "AAPL", name: "Apple Inc.", assetClass: "equity_us" },
  { symbol: "MSFT", name: "Microsoft Corp.", assetClass: "equity_us" },
  { symbol: "NVDA", name: "NVIDIA Corp.", assetClass: "equity_us" },
  { symbol: "GOOGL", name: "Alphabet Inc.", assetClass: "equity_us" },
  { symbol: "AMZN", name: "Amazon.com Inc.", assetClass: "equity_us" },
  { symbol: "TSLA", name: "Tesla Inc.", assetClass: "equity_us" },
  { symbol: "META", name: "Meta Platforms", assetClass: "equity_us" },
  // Indian equities
  { symbol: "RELIANCE.NS", name: "Reliance Industries", assetClass: "equity_in" },
  { symbol: "TCS.NS", name: "Tata Consultancy Services", assetClass: "equity_in" },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank", assetClass: "equity_in" },
  { symbol: "INFY.NS", name: "Infosys", assetClass: "equity_in" },
  // Indices
  { symbol: "^GSPC", name: "S&P 500", assetClass: "index" },
  { symbol: "^IXIC", name: "NASDAQ Composite", assetClass: "index" },
  { symbol: "^DJI", name: "Dow Jones Industrial", assetClass: "index" },
  { symbol: "^NSEI", name: "NIFTY 50", assetClass: "index" },
  { symbol: "^BSESN", name: "BSE SENSEX", assetClass: "index" },
  // Commodities
  { symbol: "GC=F", name: "Gold Futures", assetClass: "commodity" },
  { symbol: "CL=F", name: "Crude Oil WTI", assetClass: "commodity" },
  { symbol: "SI=F", name: "Silver Futures", assetClass: "commodity" },
  // FX
  { symbol: "EURUSD=X", name: "EUR / USD", assetClass: "currency" },
  { symbol: "USDINR=X", name: "USD / INR", assetClass: "currency" },
];

async function fetchYahooOne(spec: YahooSpec): Promise<Quote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      spec.symbol,
    )}?interval=1d&range=2d`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      chart?: { result?: Array<{ meta: Record<string, unknown> }> };
    };
    const meta = json.chart?.result?.[0]?.meta as
      | {
          regularMarketPrice?: number;
          chartPreviousClose?: number;
          previousClose?: number;
          currency?: string;
          regularMarketDayHigh?: number;
          regularMarketDayLow?: number;
          regularMarketVolume?: number;
        }
      | undefined;
    if (!meta || typeof meta.regularMarketPrice !== "number") return null;
    const prev = meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPrice;
    const change = meta.regularMarketPrice - prev;
    const pct = prev ? (change / prev) * 100 : 0;
    return {
      symbol: spec.symbol,
      name: spec.name,
      assetClass: spec.assetClass,
      price: meta.regularMarketPrice,
      change,
      changePercent: pct,
      currency: meta.currency ?? "USD",
      volume: meta.regularMarketVolume,
      high24h: meta.regularMarketDayHigh,
      low24h: meta.regularMarketDayLow,
      source: "yahoo_finance",
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function fetchYahooQuotes(): Promise<Quote[]> {
  const results = await Promise.all(YAHOO_UNIVERSE.map(fetchYahooOne));
  return results.filter((q): q is Quote => q !== null);
}

// ───────────────────────── Single symbol lookup ─────────────────────────
export async function fetchYahooSymbol(
  symbol: string,
  hintName?: string,
): Promise<Quote | null> {
  return fetchYahooOne({
    symbol,
    name: hintName ?? symbol,
    assetClass: symbol.endsWith(".NS") || symbol.endsWith(".BO") ? "equity_in" : "equity_us",
  });
}
