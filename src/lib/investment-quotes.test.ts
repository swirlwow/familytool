import { describe, expect, it } from "vitest";
import { officialRealtimeChannel, parseOfficialClosingQuotes, parseOfficialRealtimeQuotes, supportsOfficialClosingQuote } from "@/lib/investment-quotes";

describe("parseOfficialClosingQuotes", () => {
  it("parses TWSE prices and ROC dates", () => {
    const quotes = parseOfficialClosingQuotes([{ Date: "1150903", Code: "1718", ClosingPrice: "10.60" }], "TWSE");
    expect(quotes.get("1718")).toEqual({ price: 10.6, date: "2026-09-03" });
  });

  it("parses TPEx prices and ignores invalid rows", () => {
    const quotes = parseOfficialClosingQuotes([
      { Date: "1150903", SecuritiesCompanyCode: "8938", Close: "50.80" },
      { Date: "1150903", SecuritiesCompanyCode: "0000", Close: "" },
    ], "TPEx");
    expect(quotes.get("8938")).toEqual({ price: 50.8, date: "2026-09-03" });
    expect(quotes.has("0000")).toBe(false);
  });

  it("accepts both TPEx casing variants", () => {
    expect(supportsOfficialClosingQuote({ market: "TPEx" })).toBe(true);
    expect(supportsOfficialClosingQuote({ market: "TPEX" })).toBe(true);
    expect(supportsOfficialClosingQuote({ market: "US" })).toBe(false);
  });

  it("preserves uppercase letters in official realtime channels", () => {
    expect(officialRealtimeChannel({ market: "TWSE", symbol: "00403A" })).toBe("tse_00403A.tw");
    expect(officialRealtimeChannel({ market: "TWSE", symbol: "8938" }, true)).toBe("otc_8938.tw");
  });

  it("parses the latest MIS trade price and Gregorian date", () => {
    const quotes = parseOfficialRealtimeQuotes({
      msgArray: [
        { c: "1718", d: "20260904", t: "13:30:00", z: "10.6000", y: "10.7000", ex: "tse" },
        { c: "2014", d: "20260904", t: "13:30:00", z: "-", y: "16.9000", ex: "tse" },
      ],
    });
    expect(quotes.get("1718")).toEqual({ price: 10.6, date: "2026-09-04", time: "13:30:00", source: "realtime_trade", market: "TWSE" });
    expect(quotes.has("2014")).toBe(false);
  });

  it("uses the same-day best bid when an MIS snapshot omits the latest trade", () => {
    const quotes = parseOfficialRealtimeQuotes({
      msgArray: [{ c: "00878", d: "20260907", t: "11:26:54", z: "-", b: "34.3300_34.3200_", y: "34.1100", ex: "tse" }],
    });
    expect(quotes.get("00878")).toEqual({ price: 34.33, date: "2026-09-07", time: "11:26:54", source: "realtime_bid", market: "TWSE" });
  });
});
