// News Service — aggregates finance/markets headlines from multiple free
// sources (Hacker News + Google News RSS) so the newswire stays dense and
// always references the instruments Terminal One is displaying.
import type { NewsItem } from "./types";

const FIN_KEYWORDS =
  /\b(stock|stocks|market|markets|equit|share|shares|trader|trading|fed|fomc|ecb|boj|inflation|cpi|ppi|earnings|revenue|guidance|nasdaq|nyse|dow|s&p|sp500|sensex|nifty|bse|nse|sec|sebi|rbi|crypto|bitcoin|btc|ethereum|eth|solana|xrp|oil|brent|wti|gold|silver|copper|gdp|jobs|payroll|rate|rates|yield|yields|bond|bonds|treasur|ipo|merger|acquisition|buyback|dividend|tesla|nvidia|apple|microsoft|google|alphabet|amazon|meta|netflix|amd|intel|reliance|tcs|infosys|hdfc|icici|adani|tata)\b/i;

const TICKER_QUERIES = [
  "stock market",
  "S&P 500",
  "Nasdaq",
  "Federal Reserve",
  "Bitcoin price",
  "Ethereum price",
  "Nifty 50",
  "Sensex",
  "crude oil price",
  "gold price",
  "Tesla stock",
  "Nvidia stock",
  "Apple stock",
  "Microsoft stock",
  "Amazon stock",
  "Reliance Industries",
];

interface HNHit {
  objectID: string;
  title: string | null;
  url: string | null;
  author: string;
  created_at: string;
}

async function fetchHN(): Promise<NewsItem[]> {
  // Pull both date-sorted and relevance for "stock OR market OR crypto"
  const urls = [
    "https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=100",
    "https://hn.algolia.com/api/v1/search?tags=story&query=stock%20OR%20market%20OR%20crypto%20OR%20earnings&hitsPerPage=100",
  ];
  const out: NewsItem[] = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) continue;
      const json = (await res.json()) as { hits: HNHit[] };
      for (const h of json.hits) {
        if (!h.title || !h.url) continue;
        if (!FIN_KEYWORDS.test(h.title)) continue;
        try {
          out.push({
            id: `hn-${h.objectID}`,
            title: h.title,
            url: h.url,
            source: new URL(h.url).hostname.replace(/^www\./, ""),
            publishedAt: h.created_at,
          });
        } catch {
          /* skip bad url */
        }
      }
    } catch {
      /* skip provider failure */
    }
  }
  return out;
}

function parseRss(xml: string, sourceTag: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml))) {
    const block = m[1];
    const title = pick(block, "title");
    const link = pick(block, "link");
    const pub = pick(block, "pubDate");
    const src = pick(block, "source");
    if (!title || !link) continue;
    let host = sourceTag;
    try {
      host = src || new URL(link).hostname.replace(/^www\./, "");
    } catch {
      /* keep tag */
    }
    items.push({
      id: `gn-${hash(link)}`,
      title: decodeEntities(title),
      url: link,
      source: host,
      publishedAt: pub ? new Date(pub).toISOString() : new Date().toISOString(),
    });
  }
  return items;
}

function pick(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  if (!m) return "";
  return m[1]
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

async function fetchGoogleNews(query: string): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
    query,
  )}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; TerminalOne/1.0; +https://lovable.dev)",
        accept: "application/rss+xml, application/xml, text/xml",
      },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRss(xml, "news.google.com").slice(0, 8);
  } catch {
    return [];
  }
}

export async function fetchFinanceNews(query?: string): Promise<NewsItem[]> {
  const queries = query ? [query] : TICKER_QUERIES;
  const [hn, ...rss] = await Promise.all([
    fetchHN(),
    ...queries.map((q) => fetchGoogleNews(q)),
  ]);
  const merged = [...hn, ...rss.flat()];
  // de-dup by URL
  const seen = new Set<string>();
  const unique: NewsItem[] = [];
  for (const n of merged) {
    const key = n.url.split("?")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(n);
  }
  unique.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  return unique.slice(0, 80);
}
