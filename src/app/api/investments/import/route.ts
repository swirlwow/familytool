import { NextResponse } from "next/server";
import { apiError, apiInternalError, parseJson } from "@/lib/api/http";
import { assertWorkspaceAccess, WorkspaceAccessError } from "@/lib/api/workspaceAccess";
import { createInvestmentRecord, getInvestmentSnapshot } from "@/lib/investments";

function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]; const next = text[i + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && next === "\n") i += 1; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); return rows;
}

const aliases: Record<string, string> = { 日期: "date", date: "date", 類型: "type", type: "type", 券商帳戶: "account", account: "account", 市場: "market", market: "market", 股票代號: "symbol", symbol: "symbol", 股票名稱: "name", name: "name", 股數: "quantity", quantity: "quantity", 成交價: "price", price: "price", 手續費: "fee", fee: "fee", 交易稅: "tax", tax: "tax", 股利金額: "cash", cash_amount: "cash", 實付實收金額: "settlement", settlement_amount: "settlement", 委託單號: "order_number", order_number: "order_number", 幣別: "currency", currency: "currency", 資料來源: "source", source: "source", 備註: "note", note: "note" };
const typeMap: Record<string, string> = { 買進: "buy", 買入: "buy", buy: "buy", 賣出: "sell", sell: "sell", 股利: "dividend", dividend: "dividend" };

export async function POST(request: Request) {
  try {
    const body = await parseJson<Record<string, unknown>>(request, {});
    const workspaceId = await assertWorkspaceAccess(String(body.workspace_id ?? ""));
    const csv = String(body.csv ?? "").replace(/^\ufeff/, ""); if (!csv.trim()) return apiError("請選擇 CSV 檔案", { successFalse: true });
    const rows = parseCsv(csv); if (rows.length < 2) return apiError("CSV 沒有可匯入的交易資料", { successFalse: true });
    const keys = rows[0].map((header) => aliases[header.trim().toLowerCase()] ?? aliases[header.trim()] ?? "");
    for (const required of ["date", "type", "account", "market", "symbol", "name"]) if (!keys.includes(required)) return apiError(`CSV 缺少必要欄位：${required}`, { successFalse: true });
    let snapshot = await getInvestmentSnapshot(workspaceId); let imported = 0;
    for (let index = 1; index < rows.length; index += 1) {
      const values = Object.fromEntries(keys.map((key, i) => [key, rows[index][i] ?? ""]));
      const accountName = values.account?.trim(); const symbol = values.symbol?.trim().toUpperCase(); const market = (values.market?.trim() || "TWSE").toUpperCase();
      if (!accountName || !symbol || !values.name?.trim()) throw new Error(`第 ${index + 1} 列缺少帳戶或股票資料`);
      let account = snapshot.accounts.find((item) => item.name === accountName);
      if (!account) { account = await createInvestmentRecord(workspaceId, "account", { name: accountName }) as typeof snapshot.accounts[number]; snapshot.accounts.push(account); }
      let security = snapshot.securities.find((item) => item.symbol === symbol && item.market === market);
      if (!security) { security = await createInvestmentRecord(workspaceId, "security", { symbol, market, name: values.name }) as typeof snapshot.securities[number]; snapshot.securities.push(security); }
      const transactionType = typeMap[(values.type || "").trim().toLowerCase()] ?? typeMap[(values.type || "").trim()];
      if (!transactionType) throw new Error(`第 ${index + 1} 列交易類型不正確`);
      await createInvestmentRecord(workspaceId, "transaction", { account_id: account.id, security_id: security.id, transaction_type: transactionType, trade_date: values.date, quantity: values.quantity, price: values.price, fee: values.fee, tax: values.tax, cash_amount: values.cash, settlement_amount: values.settlement, order_number: values.order_number, currency: values.currency || "TWD", source: values.source === "excel" ? "excel" : "csv", note: values.note });
      imported += 1; snapshot = await getInvestmentSnapshot(workspaceId);
    }
    return NextResponse.json({ success: true, imported });
  } catch (error) {
    if (error instanceof WorkspaceAccessError) return apiError(error.message, { status: error.status, successFalse: true });
    if (error instanceof Error && (/^(第 |CSV|請選擇)/.test(error.message) || /格式不正確|賣出股數/.test(error.message))) return apiError(error.message, { successFalse: true });
    return apiInternalError(error, { context: "Investment import failed", message: "匯入股票資料失敗", successFalse: true });
  }
}
