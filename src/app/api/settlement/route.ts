// src/app/api/settlement/route.ts
import { NextResponse } from "next/server";
import { apiError, parseJson } from "@/lib/api/http";
import { getSettlementSummary } from "@/services/settlement/summary";
import { createSettlementByDebtorCreditor } from "@/services/settlement/items";


export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspace_id = searchParams.get("workspace_id") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    if (!workspace_id) return apiError("缺少 workspace_id");
    if (!from || !to) return apiError("缺少 from/to");

    const result = await getSettlementSummary({ workspace_id, from, to });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * POST /api/settlement
 * body: { workspace_id, from, to, debtor_id, creditor_id, amount, note? }
 */
export async function POST(req: Request) {
  try {
    const body = await parseJson<Record<string, any>>(req, {});
    const { workspace_id, from, to, debtor_id, creditor_id, amount, note } = body || {};

    if (!workspace_id) return apiError("缺少 workspace_id");
    if (!from || !to) return apiError("缺少 from/to");
    if (!debtor_id) return apiError("缺少 debtor_id");
    if (!creditor_id) return apiError("缺少 creditor_id");
    if (debtor_id === creditor_id) return apiError("debtor_id 不可等於 creditor_id");

    const result = await createSettlementByDebtorCreditor({
      workspace_id,
      from,
      to,
      debtor_id,
      creditor_id,
      amount,
      note,
    });

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
