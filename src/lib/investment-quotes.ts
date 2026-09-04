import type { InvestmentSecurity } from "@/lib/investments";

type QuoteMarket = "TWSE" | "TPEx";

export type InvestmentQuote = {
  securityId: string;
  symbol: string;
  market: QuoteMarket;
  price: number;
  date: string;
};

const MARKET_URLS: Record<QuoteMarket, string> = {
  TWSE: "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_AVG_ALL",
  TPEx: "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes",
};
const REALTIME_URL = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp";

const quoteMarket = (value: string): QuoteMarket | null => {
  const normalized = value.trim().toUpperCase();
  if (normalized === "TWSE") return "TWSE";
  if (normalized === "TPEX") return "TPEx";
  return null;
};

export const supportsOfficialClosingQuote = (security: Pick<InvestmentSecurity, "market">) => quoteMarket(security.market) !== null;

const rocDateToIso = (value: unknown) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length !== 7) return null;
  const year = Number(digits.slice(0, 3)) + 1911;
  const month = digits.slice(3, 5);
  const day = digits.slice(5, 7);
  return `${year}-${month}-${day}`;
};

const gregorianDateToIso = (value: unknown) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length !== 8) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
};

const positiveNumber = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export function parseOfficialClosingQuotes(rows: unknown[], market: QuoteMarket) {
  const result = new Map<string, { price: number; date: string }>();
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const symbol = String(market === "TWSE" ? row.Code : row.SecuritiesCompanyCode ?? "").trim().toUpperCase();
    const price = positiveNumber(market === "TWSE" ? row.ClosingPrice : row.Close);
    const date = rocDateToIso(row.Date);
    if (symbol && price !== null && date) result.set(symbol, { price, date });
  }
  return result;
}

export function parseOfficialRealtimeQuotes(payload: unknown) {
  const result = new Map<string, { price: number; date: string }>();
  if (!payload || typeof payload !== "object") return result;
  const rows = (payload as { msgArray?: unknown[] }).msgArray;
  if (!Array.isArray(rows)) return result;
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const symbol = String(row.c ?? "").trim().toUpperCase();
    const price = positiveNumber(row.z);
    const date = gregorianDateToIso(row.d);
    if (symbol && price !== null && date) result.set(symbol, { price, date });
  }
  return result;
}

async function fetchRealtimeQuotes(securities: InvestmentSecurity[]) {
  const channels = securities.map((security) => {
    const market = quoteMarket(security.market);
    if (!market) return null;
    return `${market === "TWSE" ? "tse" : "otc"}_${security.symbol.trim().toLowerCase()}.tw`;
  }).filter((channel): channel is string => channel !== null);
  const batches = Array.from({ length: Math.ceil(channels.length / 50) }, (_, index) => channels.slice(index * 50, (index + 1) * 50));
  const settled = await Promise.allSettled(batches.map(async (batch) => {
    const query = new URLSearchParams({ ex_ch: batch.join("|"), json: "1", delay: "0" });
    const response = await fetch(`${REALTIME_URL}?${query}`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Referer: "https://mis.twse.com.tw/stock/index.jsp",
        "User-Agent": "Mozilla/5.0 (compatible; FAMILYTOOL/1.0)",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`MIS 行情服務回應 ${response.status}`);
    return parseOfficialRealtimeQuotes(await response.json());
  }));
  const result = new Map<string, { price: number; date: string }>();
  for (const batch of settled) {
    if (batch.status !== "fulfilled") continue;
    for (const [symbol, quote] of batch.value) result.set(symbol, quote);
  }
  return result;
}

async function fetchMarketQuotes(market: QuoteMarket) {
  const response = await fetch(MARKET_URLS[market], {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${market} 行情服務回應 ${response.status}`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error(`${market} 行情格式不正確`);
  return parseOfficialClosingQuotes(payload, market);
}

export async function getOfficialClosingQuotes(securities: InvestmentSecurity[]) {
  const markets = (["TWSE", "TPEx"] as const).filter((market) => securities.some((security) => quoteMarket(security.market) === market));
  const settled = await Promise.allSettled(markets.map(async (market) => ({ market, quotes: await fetchMarketQuotes(market) })));
  const marketQuotes = new Map<QuoteMarket, Map<string, { price: number; date: string }>>();
  const failedMarkets: QuoteMarket[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") marketQuotes.set(result.value.market, result.value.quotes);
    else failedMarkets.push(markets[index]);
  });

  const quotes: InvestmentQuote[] = [];
  for (const security of securities) {
    const market = quoteMarket(security.market);
    if (!market) continue;
    const quote = marketQuotes.get(market)?.get(security.symbol.trim().toUpperCase());
    if (quote) quotes.push({ securityId: security.id, symbol: security.symbol, market, ...quote });
  }
  return { quotes, failedMarkets };
}

export async function getOfficialLatestQuotes(securities: InvestmentSecurity[]) {
  const realtimeQuotes = await fetchRealtimeQuotes(securities);
  const missing = securities.filter((security) => !realtimeQuotes.has(security.symbol.trim().toUpperCase()));
  const closing = await getOfficialClosingQuotes(missing);
  const closingBySecurityId = new Map(closing.quotes.map((quote) => [quote.securityId, quote]));
  const quotes = securities.flatMap((security) => {
    const market = quoteMarket(security.market);
    if (!market) return [];
    const realtime = realtimeQuotes.get(security.symbol.trim().toUpperCase());
    if (realtime) return [{ securityId: security.id, symbol: security.symbol, market, ...realtime }];
    const fallback = closingBySecurityId.get(security.id);
    return fallback ? [fallback] : [];
  });
  return { quotes, failedMarkets: closing.failedMarkets };
}
