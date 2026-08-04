import { NextResponse } from "next/server";
import { apiError, apiOperationError, parseJson } from "@/lib/api/http";
import { createItemForSplit } from "@/services/settlement/items";

/**
 * POST /api/settlement/:split_id/items
 * body: { workspace_id, from, to, amount, request_key, note? }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await parseJson<Record<string, any>>(req, {});
    const routeParams = await params;
    const { workspace_id, from, to, amount, request_key, note } = body || {};
    const split_id = String(body?.split_id || routeParams.id || "").trim();

    if (!workspace_id) return apiError("缺少 workspace_id");
    if (!from || !to) return apiError("缺少 from/to");
    if (!split_id) return apiError("缺少 split_id");
    if (!request_key) return apiError("缺少 request_key");

    const result = await createItemForSplit({
      workspace_id,
      from,
      to,
      split_id,
      amount,
      request_key,
      note,
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiOperationError(error, { context: "Create settlement item" });
  }
}
