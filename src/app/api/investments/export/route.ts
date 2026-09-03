import { NextResponse } from "next/server";
import { assertWorkspaceAccess, WorkspaceAccessError } from "@/lib/api/workspaceAccess";
import { getInvestmentSnapshot, type InvestmentTransactionType } from "@/lib/investments";

const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const typeLabel: Record<InvestmentTransactionType, string> = { buy: "買進", sell: "賣出", dividend: "股利" };

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
    const accountMap = new Map(snapshot.accounts.map((row) => [row.id, row]));
    const securityMap = new Map(snapshot.securities.map((row) => [row.id, row]));
    const headers = ["日期", "類型", "券商帳戶", "市場", "股票代號", "股票名稱", "股數", "成交價", "手續費", "交易稅", "股利金額", "備註"];
    const rows = snapshot.transactions.map((row) => {
      const account = accountMap.get(row.account_id); const security = securityMap.get(row.security_id);
      return [row.trade_date, typeLabel[row.transaction_type], account?.name, security?.market, security?.symbol, security?.name, row.quantity || "", row.price || "", row.fee || "", row.tax || "", row.cash_amount || "", row.note].map(csvCell).join(",");
    });
    return new NextResponse(`\ufeff${[headers.map(csvCell).join(","), ...rows].join("\r\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="familytool_investments_${date}.csv"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if (error instanceof WorkspaceAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Investment export failed", error); return NextResponse.json({ error: "匯出股票資料失敗" }, { status: 500 });
  }
}
