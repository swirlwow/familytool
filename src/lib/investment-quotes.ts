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
