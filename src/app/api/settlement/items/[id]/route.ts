import { NextResponse } from "next/server";
import { apiError, apiOperationError } from "@/lib/api/http";
import { undoSettlementItem } from "@/services/settlement/undo";


function getLastPathSegment(reqUrl: string) {
  const u = new URL(reqUrl);
  const parts = u.pathname.split("/").filter(Boolean);
  return parts.at(-1) || "";
}

/**
 * DELETE /api/settlement/items/:id?workspace_id=...
 * 撤銷單筆 settlement_items
 */
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const workspace_id = url.searchParams.get("workspace_id") || "";
    const id = getLastPathSegment(req.url).trim();

    if (!workspace_id) return apiError("缺少 workspace_id", { status: 400, extra: { url: req.url } });
    if (!id) return apiError("缺少 id", { status: 400, extra: { url: req.url } });

    const result = await undoSettlementItem({ workspace_id, id });
    return NextResponse.json(result);
  } catch (error) {
    return apiOperationError(error, { context: "Undo settlement item" });
  }
}
