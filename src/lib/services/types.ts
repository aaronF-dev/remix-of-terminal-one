// Unified internal schema. Every provider normalizes into these shapes.
export type AssetClass =
  | "equity_in"
  | "equity_us"
  | "etf"
  | "mutual_fund"
  | "index"
  | "option"
  | "future"
  | "currency"
  | "crypto"
  | "commodity";

export interface Quote {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  marketCap?: number;
  volume?: number;
  high24h?: number;
  low24h?: number;
  source: string;
  fetchedAt: string; // ISO timestamp
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary?: string;
}

export interface DataEnvelope<T> {
  data: T;
  fetchedAt: string;
  sources: string[];
  stale: boolean;
  errors?: string[];
}
