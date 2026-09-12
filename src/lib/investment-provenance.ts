export type QuoteMetadata = {
  current_price_date: string | null; current_price_time?: string | null;
  current_price_source?: string | null; quote_fetched_at?: string | null;
};
export function taipeiDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function quoteDescription(row: QuoteMetadata, today = taipeiDate()) {
  const source = ({ manual: "手動股價", realtime_trade: "MIS 最近成交（可能延遲）", realtime_bid: "MIS 買一參考（非成交）", closing: "官方收盤價" } as Record<string, string>)[row.current_price_source ?? ""] ?? "來源未記錄";
  const date = row.current_price_date;
  return { source, timestamp: date ? `${date}${row.current_price_time ? " " + row.current_price_time.slice(0, 8) : ""}` : "未記錄報價日期",
    freshness: !date ? "無法判定新鮮度" : date > today ? "日期異常" : date < today ? "非今日報價" : "今日資料・非串流即時行情" };
}
export function validQuoteDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
