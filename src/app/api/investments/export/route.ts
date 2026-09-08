import { NextResponse } from "next/server";
import { assertWorkspaceAccess, WorkspaceAccessError } from "@/lib/api/workspaceAccess";
import { getInvestmentSnapshot } from "@/lib/investments";
import { buildInvestmentCsv, investmentCsvFilename, parseInvestmentCsvScope } from "@/lib/investmentCsv";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = await assertWorkspaceAccess(searchParams.get("workspace_id") ?? "");
    const snapshot = await getInvestmentSnapshot(workspaceId);
    const format = searchParams.get("format") === "json" ? "json" : "csv";
    const date = new Date().toISOString().slice(0, 10);
    if (format === "json") {
      return new NextResponse(JSON.stringify({ format: "familytool-investments", version: 1, exported_at: new Date().toISOString(), workspace_id: workspaceId, data: snapshot }, null, 2), {
        headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="familytool_investments_${date}.json"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
      });
    }
    const scope = parseInvestmentCsvScope(searchParams.get("scope"));
    const csv = buildInvestmentCsv(snapshot, {
      scope,
      accountId: searchParams.get("account_id"),
      securityId: searchParams.get("security_id"),
      transactionType: searchParams.get("transaction_type"),
      dateFrom: searchParams.get("date_from"),
      dateTo: searchParams.get("date_to"),
      query: searchParams.get("query"),
    });
    return new NextResponse(`\ufeff${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${investmentCsvFilename(scope, date)}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if (error instanceof WorkspaceAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Investment export failed", error); return NextResponse.json({ error: "匯出股票資料失敗" }, { status: 500 });
  }
}
