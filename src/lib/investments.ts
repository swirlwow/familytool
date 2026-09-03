import { supabase } from "@/lib/supabaseClient";

export const INVESTMENT_TRANSACTION_TYPES = ["buy", "sell", "dividend"] as const;
export type InvestmentTransactionType = (typeof INVESTMENT_TRANSACTION_TYPES)[number];

export type InvestmentAccount = {
  id: string; workspace_id: string; name: string; broker: string | null; currency: string;
  sort_order: number; is_active: boolean; note: string | null; created_at: string; updated_at: string;
};

export type InvestmentSecurity = {
  id: string; workspace_id: string; symbol: string; name: string; market: string; currency: string;
  current_price: number | null; current_price_date: string | null; sort_order: number; is_active: boolean;
  note: string | null; created_at: string; updated_at: string;
};

export type InvestmentTransaction = {
  id: string; workspace_id: string; account_id: string; security_id: string;
  transaction_type: InvestmentTransactionType; trade_date: string; quantity: number; price: number;
  fee: number; tax: number; cash_amount: number; note: string | null; created_at: string; updated_at: string;
};

export type InvestmentHolding = {
  key: string; account_id: string; security_id: string; account_name: string; broker: string | null;
  symbol: string; security_name: string; market: string; currency: string; quantity: number;
  average_cost: number; cost_basis: number; current_price: number | null; current_price_date: string | null;
  market_value: number | null; realized_trade_profit: number; dividend_income: number;
  realized_profit: number; unrealized_profit: number | null;
};

export type InvestmentSummary = {
  cost_basis: number; market_value: number | null; realized_trade_profit: number;
  dividend_income: number; realized_profit: number; unrealized_profit: number | null;
};

export type InvestmentSnapshot = {
  accounts: InvestmentAccount[]; securities: InvestmentSecurity[]; transactions: InvestmentTransaction[];
  holdings: InvestmentHolding[]; summary: InvestmentSummary;
};

type Position = { quantity: number; cost: number; realizedTrade: number; dividends: number };
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const quantity = (value: number) => Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
const numberValue = (value: unknown, field: string, allowZero = true) => {
  if (value === "" || value === null || value === undefined) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || (!allowZero && parsed === 0)) throw new Error(`${field}格式不正確`);
  return parsed;
};
const optionalText = (value: unknown, max = 500) => {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
};
const requiredText = (value: unknown, field: string, max = 120) => {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`請輸入${field}`);
  return text.slice(0, max);
};
const currencyCode = (value: unknown) => {
  const code = String(value ?? "TWD").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new Error("幣別需為 3 碼英文字母");
  return code;
};
const tradeDate = (value: unknown) => {
  const date = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("交易日期格式不正確");
  return date;
};

export function calculateInvestmentSnapshot(
  accounts: InvestmentAccount[], securities: InvestmentSecurity[], transactions: InvestmentTransaction[],
): Pick<InvestmentSnapshot, "holdings" | "summary"> {
  const accountMap = new Map(accounts.map((row) => [row.id, row]));
  const securityMap = new Map(securities.map((row) => [row.id, row]));
  const positions = new Map<string, Position>();
  const sorted = [...transactions].sort((a, b) =>
    a.trade_date.localeCompare(b.trade_date) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));

  for (const row of sorted) {
    const key = `${row.account_id}:${row.security_id}`;
    const state = positions.get(key) ?? { quantity: 0, cost: 0, realizedTrade: 0, dividends: 0 };
    if (row.transaction_type === "buy") {
      state.quantity = quantity(state.quantity + Number(row.quantity));
      state.cost = money(state.cost + Number(row.quantity) * Number(row.price) + Number(row.fee) + Number(row.tax));
    } else if (row.transaction_type === "sell") {
      const sold = Number(row.quantity);
      if (sold > state.quantity + 0.000001) throw new Error(`${row.trade_date} 賣出股數超過當時持有股數`);
      const average = state.quantity > 0 ? state.cost / state.quantity : 0;
      const soldCost = average * sold;
      const proceeds = sold * Number(row.price) - Number(row.fee) - Number(row.tax);
      state.realizedTrade = money(state.realizedTrade + proceeds - soldCost);
      state.quantity = quantity(state.quantity - sold);
      state.cost = state.quantity <= 0 ? 0 : money(state.cost - soldCost);
    } else {
      state.dividends = money(state.dividends + Number(row.cash_amount) - Number(row.fee) - Number(row.tax));
    }
    positions.set(key, state);
  }

  const holdings: InvestmentHolding[] = [];
  for (const [key, state] of positions) {
    const [accountId, securityId] = key.split(":");
    const account = accountMap.get(accountId);
    const security = securityMap.get(securityId);
    if (!account || !security) continue;
    const marketValue = security.current_price === null ? null : money(state.quantity * Number(security.current_price));
    holdings.push({
      key, account_id: accountId, security_id: securityId, account_name: account.name, broker: account.broker,
      symbol: security.symbol, security_name: security.name, market: security.market, currency: security.currency,
      quantity: state.quantity, average_cost: state.quantity > 0 ? money(state.cost / state.quantity) : 0,
      cost_basis: money(state.cost), current_price: security.current_price, current_price_date: security.current_price_date,
      market_value: marketValue, realized_trade_profit: money(state.realizedTrade), dividend_income: money(state.dividends),
      realized_profit: money(state.realizedTrade + state.dividends),
      unrealized_profit: marketValue === null ? null : money(marketValue - state.cost),
    });
  }
  holdings.sort((a, b) => b.cost_basis - a.cost_basis || a.symbol.localeCompare(b.symbol));
  const costBasis = money(holdings.reduce((sum, row) => sum + row.cost_basis, 0));
  const allPriced = holdings.filter((row) => row.quantity > 0).every((row) => row.market_value !== null);
  const marketValue = allPriced ? money(holdings.reduce((sum, row) => sum + Number(row.market_value ?? 0), 0)) : null;
  const realizedTrade = money(holdings.reduce((sum, row) => sum + row.realized_trade_profit, 0));
  const dividends = money(holdings.reduce((sum, row) => sum + row.dividend_income, 0));
  return { holdings, summary: {
    cost_basis: costBasis, market_value: marketValue, realized_trade_profit: realizedTrade,
    dividend_income: dividends, realized_profit: money(realizedTrade + dividends),
    unrealized_profit: marketValue === null ? null : money(marketValue - costBasis),
  } };
}

const ACCOUNT_COLUMNS = "id,workspace_id,name,broker,currency,sort_order,is_active,note,created_at,updated_at";
const SECURITY_COLUMNS = "id,workspace_id,symbol,name,market,currency,current_price,current_price_date,sort_order,is_active,note,created_at,updated_at";
const TRANSACTION_COLUMNS = "id,workspace_id,account_id,security_id,transaction_type,trade_date,quantity,price,fee,tax,cash_amount,note,created_at,updated_at";

export async function getInvestmentSnapshot(workspaceId: string): Promise<InvestmentSnapshot> {
  const [accountsResult, securitiesResult, transactionsResult] = await Promise.all([
    supabase.from("investment_accounts").select(ACCOUNT_COLUMNS).eq("workspace_id", workspaceId).order("sort_order").order("name"),
    supabase.from("investment_securities").select(SECURITY_COLUMNS).eq("workspace_id", workspaceId).order("sort_order").order("market").order("symbol"),
    supabase.from("investment_transactions").select(TRANSACTION_COLUMNS).eq("workspace_id", workspaceId).order("trade_date", { ascending: false }).order("created_at", { ascending: false }).limit(5000),
  ]);
  if (accountsResult.error) throw new Error(accountsResult.error.message);
  if (securitiesResult.error) throw new Error(securitiesResult.error.message);
  if (transactionsResult.error) throw new Error(transactionsResult.error.message);
  const accounts = (accountsResult.data ?? []) as InvestmentAccount[];
  const securities = (securitiesResult.data ?? []) as InvestmentSecurity[];
  const transactions = (transactionsResult.data ?? []) as InvestmentTransaction[];
  return { accounts, securities, transactions, ...calculateInvestmentSnapshot(accounts, securities, transactions) };
}

export async function createInvestmentRecord(workspaceId: string, resource: string, input: Record<string, unknown>) {
  if (resource === "account") {
    const payload = { workspace_id: workspaceId, name: requiredText(input.name, "帳戶名稱"), broker: optionalText(input.broker, 120), currency: currencyCode(input.currency), note: optionalText(input.note, 1000) };
    const { data, error } = await supabase.from("investment_accounts").insert(payload).select(ACCOUNT_COLUMNS).single();
    if (error) throw new Error(error.code === "23505" ? "帳戶名稱已存在" : error.message); return data;
  }
  if (resource === "security") {
    const payload = { workspace_id: workspaceId, symbol: requiredText(input.symbol, "股票代號", 30).toUpperCase(), name: requiredText(input.name, "股票名稱"), market: requiredText(input.market || "TWSE", "市場", 30).toUpperCase(), currency: currencyCode(input.currency), current_price: input.current_price === "" || input.current_price == null ? null : numberValue(input.current_price, "目前股價"), current_price_date: optionalText(input.current_price_date, 10), note: optionalText(input.note, 1000) };
    const { data, error } = await supabase.from("investment_securities").insert(payload).select(SECURITY_COLUMNS).single();
    if (error) throw new Error(error.code === "23505" ? "相同市場與股票代號已存在" : error.message); return data;
  }
  if (resource === "transaction") {
    const type = String(input.transaction_type ?? "") as InvestmentTransactionType;
    if (!INVESTMENT_TRANSACTION_TYPES.includes(type)) throw new Error("交易類型不正確");
    const payload = {
      workspace_id: workspaceId, account_id: requiredText(input.account_id, "券商帳戶"), security_id: requiredText(input.security_id, "股票"),
      transaction_type: type, trade_date: tradeDate(input.trade_date), quantity: type === "dividend" ? 0 : numberValue(input.quantity, "股數", false),
      price: type === "dividend" ? 0 : numberValue(input.price, "成交價", false), fee: numberValue(input.fee, "手續費"), tax: numberValue(input.tax, "交易稅"),
      cash_amount: type === "dividend" ? numberValue(input.cash_amount, "股利金額", false) : 0, note: optionalText(input.note, 1000),
    };
    const { data: account } = await supabase.from("investment_accounts").select("id").eq("workspace_id", workspaceId).eq("id", payload.account_id).maybeSingle();
    const { data: security } = await supabase.from("investment_securities").select("id").eq("workspace_id", workspaceId).eq("id", payload.security_id).maybeSingle();
    if (!account || !security) throw new Error("券商帳戶或股票不屬於目前工作區");
    const existing = await getInvestmentSnapshot(workspaceId);
    calculateInvestmentSnapshot(existing.accounts, existing.securities, [...existing.transactions, { ...payload, id: "candidate", created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as InvestmentTransaction]);
    const { data, error } = await supabase.from("investment_transactions").insert(payload).select(TRANSACTION_COLUMNS).single();
    if (error) throw new Error(error.message); return data;
  }
  throw new Error("不支援的投資資料類型");
}

export async function updateInvestmentRecord(workspaceId: string, resource: string, id: string, input: Record<string, unknown>) {
  if (!id) throw new Error("缺少資料 ID");
  if (resource === "account") {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ("name" in input) patch.name = requiredText(input.name, "帳戶名稱"); if ("broker" in input) patch.broker = optionalText(input.broker, 120);
    if ("currency" in input) patch.currency = currencyCode(input.currency); if ("is_active" in input) patch.is_active = Boolean(input.is_active); if ("note" in input) patch.note = optionalText(input.note, 1000);
    const { data, error } = await supabase.from("investment_accounts").update(patch).eq("workspace_id", workspaceId).eq("id", id).select(ACCOUNT_COLUMNS).maybeSingle();
    if (error) throw new Error(error.message); if (!data) throw new Error("找不到券商帳戶"); return data;
  }
  if (resource === "security") {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ("symbol" in input) patch.symbol = requiredText(input.symbol, "股票代號", 30).toUpperCase(); if ("name" in input) patch.name = requiredText(input.name, "股票名稱");
    if ("market" in input) patch.market = requiredText(input.market, "市場", 30).toUpperCase(); if ("currency" in input) patch.currency = currencyCode(input.currency);
    if ("current_price" in input) patch.current_price = input.current_price === "" || input.current_price == null ? null : numberValue(input.current_price, "目前股價");
    if ("current_price_date" in input) patch.current_price_date = optionalText(input.current_price_date, 10); if ("is_active" in input) patch.is_active = Boolean(input.is_active); if ("note" in input) patch.note = optionalText(input.note, 1000);
    const { data, error } = await supabase.from("investment_securities").update(patch).eq("workspace_id", workspaceId).eq("id", id).select(SECURITY_COLUMNS).maybeSingle();
    if (error) throw new Error(error.message); if (!data) throw new Error("找不到股票資料"); return data;
  }
  if (resource === "transaction") {
    const snapshot = await getInvestmentSnapshot(workspaceId);
    const current = snapshot.transactions.find((row) => row.id === id); if (!current) throw new Error("找不到交易紀錄");
    const merged = { ...current, ...input } as Record<string, unknown>;
    const type = String(merged.transaction_type) as InvestmentTransactionType; if (!INVESTMENT_TRANSACTION_TYPES.includes(type)) throw new Error("交易類型不正確");
    const patch = { account_id: requiredText(merged.account_id, "券商帳戶"), security_id: requiredText(merged.security_id, "股票"), transaction_type: type, trade_date: tradeDate(merged.trade_date), quantity: type === "dividend" ? 0 : numberValue(merged.quantity, "股數", false), price: type === "dividend" ? 0 : numberValue(merged.price, "成交價", false), fee: numberValue(merged.fee, "手續費"), tax: numberValue(merged.tax, "交易稅"), cash_amount: type === "dividend" ? numberValue(merged.cash_amount, "股利金額", false) : 0, note: optionalText(merged.note, 1000), updated_at: new Date().toISOString() };
    calculateInvestmentSnapshot(snapshot.accounts, snapshot.securities, snapshot.transactions.map((row) => row.id === id ? { ...row, ...patch } : row));
    const { data, error } = await supabase.from("investment_transactions").update(patch).eq("workspace_id", workspaceId).eq("id", id).select(TRANSACTION_COLUMNS).maybeSingle();
    if (error) throw new Error(error.message); if (!data) throw new Error("找不到交易紀錄"); return data;
  }
  throw new Error("不支援的投資資料類型");
}

export async function deleteInvestmentRecord(workspaceId: string, resource: string, id: string) {
  const table = resource === "account" ? "investment_accounts" : resource === "security" ? "investment_securities" : resource === "transaction" ? "investment_transactions" : "";
  if (!table) throw new Error("不支援的投資資料類型");
  const { data, error } = await supabase.from(table).delete().eq("workspace_id", workspaceId).eq("id", id).select("id").maybeSingle();
  if (error) throw new Error(error.code === "23503" ? "已有交易紀錄，請改為停用" : error.message);
  if (!data) throw new Error("找不到要刪除的資料");
}
