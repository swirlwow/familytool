import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/http";
import {
  getSettlementReconciliation,
  reconciliationCsv,
} from "@/services/settlement/reconciliation";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspace_id = searchParams.get("workspace_id") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const settlement_id = searchParams.get("settlement_id") || "";
    const format = searchParams.get("format") || "json";

    if (!workspace_id) return apiError("缺少 workspace_id");

    const data = await getSettlementReconciliation({
      workspace_id,
      from: from || undefined,
      to: to || undefined,
      settlement_id: settlement_id || undefined,
    });

    if (format === "csv") {
      const suffix = settlement_id || `${from || "all"}_${to || "all"}`;
      return new Response(reconciliationCsv(data), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="settlement_reconciliation_${suffix}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "無法建立對帳明細" },
      { status: 500 }
    );
  }
}
