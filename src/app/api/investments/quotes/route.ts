import { NextResponse } from "next/server";
import { apiError, apiInternalError, parseJson } from "@/lib/api/http";
import { assertWorkspaceAccess, WorkspaceAccessError } from "@/lib/api/workspaceAccess";
import { getInvestmentSnapshot, updateInvestmentRecord } from "@/lib/investments";
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
    const updates = await Promise.allSettled(quotes.map((quote) => updateInvestmentRecord(workspaceId, "security", quote.securityId, {
      current_price: quote.price,
      current_price_date: quote.date,
    })));
    const updated = updates.filter((result) => result.status === "fulfilled").length;
    const failed = updates.length - updated;
    const unavailable = supported.length - quotes.length;
    return NextResponse.json({ success: true, data: { updated, failed, unavailable, unsupported, failed_markets: failedMarkets } });
  } catch (error) {
    return failure(error);
  }
}
