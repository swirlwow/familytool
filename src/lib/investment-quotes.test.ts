import { describe, expect, it } from "vitest";
import { parseOfficialClosingQuotes, parseOfficialRealtimeQuotes, supportsOfficialClosingQuote } from "@/lib/investment-quotes";

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

  it("parses the latest MIS trade price and Gregorian date", () => {
    const quotes = parseOfficialRealtimeQuotes({
      msgArray: [
        { c: "1718", d: "20260904", t: "13:30:00", z: "10.6000", y: "10.7000" },
        { c: "2014", d: "20260904", t: "13:30:00", z: "-", y: "16.9000" },
      ],
    });
    expect(quotes.get("1718")).toEqual({ price: 10.6, date: "2026-09-04" });
    expect(quotes.has("2014")).toBe(false);
  });
});
