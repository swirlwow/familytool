import { supabase } from "@/lib/supabaseClient";
import { NextResponse } from "next/server";
import { apiError, apiInternalError, parseJson } from "@/lib/api/http";
import { assertWorkspaceAccess, WorkspaceAccessError } from "@/lib/api/workspaceAccess";
import { getInvestmentSnapshot } from "@/lib/investments";
import { getOfficialLatestQuotes, supportsOfficialClosingQuote } from "@/lib/investment-quotes";

function failure(error: unknown) {
  if (error instanceof WorkspaceAccessError) return apiError(error.message, { status: error.status, successFalse: true });
  return apiInternalError(error, { context: "更新持股股價失敗", message: "更新持股股價失敗", successFalse: true });
}

export async function POST(request: Request) {
  try {
    const body = await parseJson<Record<string, unknown>>(request, {});
    const workspaceId = await assertWorkspaceAccess(String(body.workspace_id ?? ""));
    const snapshot = await getInvestmentSnapshot(workspaceId);
    const heldSecurityIds = new Set(snapshot.holdings.filter((holding) => holding.quantity > 0).map((holding) => holding.security_id));
    const heldSecurities = snapshot.securities.filter((security) => heldSecurityIds.has(security.id));
    const supported = heldSecurities.filter(supportsOfficialClosingQuote);
    const unsupported = heldSecurities.length - supported.length;
    const { quotes, failedMarkets } = await getOfficialLatestQuotes(supported);
    const updates = await Promise.allSettled(quotes.map(async (quote) => {
      const { data, error } = await supabase.rpc("save_investment_quote", {
        p_workspace_id: workspaceId, p_security_id: quote.securityId,
        p_price: quote.price, p_date: quote.date, p_time: quote.time ?? null,
        p_source: quote.source, p_market: quote.market,
      });
      if (error) throw error;
      return data === true;
    }));
    const updated = updates.filter((result) => result.status === "fulfilled" && result.value).length;
    const failed = updates.filter((result) => result.status === "rejected").length;
    const retained = updates.filter((result) => result.status === "fulfilled" && !result.value).length;
    const unavailable = supported.length - quotes.length;
    const successfulQuotes = quotes.filter((_, index) => { const result = updates[index]; return result?.status === "fulfilled" && result.value; });
    const realtimeTrade = successfulQuotes.filter((quote) => quote.source === "realtime_trade").length;
    const realtimeBid = successfulQuotes.filter((quote) => quote.source === "realtime_bid").length;
    const closing = successfulQuotes.filter((quote) => quote.source === "closing").length;
    const latestRealtimeTime = successfulQuotes
      .filter((quote) => quote.source !== "closing" && quote.time)
      .map((quote) => quote.time as string)
      .sort()
      .at(-1);
    return NextResponse.json({ success: updated > 0 || supported.length === 0, data: { updated, failed, retained, unavailable, unsupported, realtime_trade: realtimeTrade, realtime_bid: realtimeBid, closing, latest_realtime_time: latestRealtimeTime, failed_markets: failedMarkets } });
  } catch (error) {
    return failure(error);
  }
}
