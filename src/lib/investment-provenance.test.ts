import { afterEach, describe, expect, it, vi } from "vitest";
import { getOfficialLatestQuotes, parseOfficialRealtimeQuotes } from "./investment-quotes";
import { quoteDescription, validQuoteDate } from "./investment-provenance";
import type { InvestmentSecurity } from "./investments";
const security={id:"s",symbol:"8938",market:"TPEX"} as InvestmentSecurity;
afterEach(()=>vi.unstubAllGlobals());
describe("phase 5 quote provenance",()=>{
  it("never labels a previous-day MIS response as today's live trade",()=>{
    const info=quoteDescription({current_price_date:"2026-09-04",current_price_time:"13:30:00",current_price_source:"realtime_trade"},"2026-09-07");
    expect(info.freshness).toBe("非今日報價");
    expect(info.source).toContain("可能延遲");
    expect(info.timestamp).toBe("2026-09-04 13:30:00");
  });
  it("labels bid fallback separately and old rows as unknown",()=>{
    expect(quoteDescription({current_price_date:"2026-09-07",current_price_source:"realtime_bid"},"2026-09-07").source).toContain("非成交");
    expect(quoteDescription({current_price_date:null}).source).toBe("來源未記錄");
  });
  it("rejects impossible calendar dates and future quotes",()=>{
    expect(validQuoteDate("2026-02-30")).toBe(false);
    expect(validQuoteDate("2024-02-29")).toBe(true);
    expect(parseOfficialRealtimeQuotes({msgArray:[{c:"8938",d:"20990907",t:"11:00:00",z:"53",ex:"otc"}]}).size).toBe(0);
  });
  it("chooses a newer official close over an older MIS trade",async()=>{
    vi.stubGlobal("fetch",vi.fn(async(url:string)=>Response.json(url.includes("getStockInfo")
      ?{msgArray:[{c:"8938",d:"20260904",t:"13:30:00",z:"52.7",ex:"otc"}]}
      :[{Date:"1150907",SecuritiesCompanyCode:"8938",Close:"53.0"}])));
    const result=await getOfficialLatestQuotes([security]);
    expect(result.quotes[0]).toMatchObject({price:53,date:"2026-09-07",source:"closing"});
  });
  it("retains a valid realtime result if the closing service fails",async()=>{
    vi.stubGlobal("fetch",vi.fn(async(url:string)=>{
      if(!url.includes("getStockInfo"))throw Error("offline");
      return Response.json({msgArray:[{c:"8938",d:"20260907",t:"11:00:00",z:"53.2",ex:"otc"}]});
    }));
    expect((await getOfficialLatestQuotes([security])).quotes[0]).toMatchObject({price:53.2,source:"realtime_trade",time:"11:00:00"});
  });
  it("does not fabricate zero-price results when every provider fails",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>{throw Error("offline");}));
    expect((await getOfficialLatestQuotes([security])).quotes).toEqual([]);
  });
});
