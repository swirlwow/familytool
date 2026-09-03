import { supabase } from "@/lib/supabaseClient";

export const INVESTMENT_TRANSACTION_TYPES = ["buy", "sell", "dividend"] as const;
export type InvestmentTransactionType = (typeof INVESTMENT_TRANSACTION_TYPES)[number];
export const INVESTMENT_DEDUCTION_TYPES = ["transfer_fee", "nhi", "withholding_tax", "other", "unclassified"] as const;
export type InvestmentDeductionType = (typeof INVESTMENT_DEDUCTION_TYPES)[number];
export const INVESTMENT_DIVIDEND_TYPES = ["cash", "stock"] as const;
export type InvestmentDividendType = (typeof INVESTMENT_DIVIDEND_TYPES)[number];
export const INVESTMENT_ACTION_TYPES = ["capital_reduction", "loss_reduction"] as const;
export type InvestmentCorporateActionType = (typeof INVESTMENT_ACTION_TYPES)[number];

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
  fee: number; tax: number; cash_amount: number; settlement_amount: number | null; order_number: string | null;
  currency: string; source: "manual" | "csv" | "excel"; note: string | null; created_at: string; updated_at: string;
};

export type InvestmentDividend = {
  id: string; workspace_id: string; account_id: string; security_id: string;
  dividend_type: InvestmentDividendType; ex_dividend_date: string; eligible_quantity: number;
  dividend_per_share: number; stock_dividend_rate: number; payment_date: string | null;
  received_amount: number | null; shares_received: number | null; deduction_type: InvestmentDeductionType | null;
  status: "pending" | "received"; source: "manual" | "csv" | "excel"; note: string | null;
  created_at: string; updated_at: string; expected_amount: number; expected_shares: number; deduction_amount: number;
};

export type InvestmentCorporateAction = {
  id: string; workspace_id: string; account_id: string; security_id: string;
  action_type: InvestmentCorporateActionType; event_date: string; quantity_before: number;
  reduction_ratio: number; quantity_after: number; cash_return: number; cost_adjustment: number;
  source: "manual" | "csv" | "excel"; note: string | null; created_at: string; updated_at: string;
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
  dividends: InvestmentDividend[]; corporate_actions: InvestmentCorporateAction[];
  holdings: InvestmentHolding[]; summary: InvestmentSummary;
};

type Position = { quantity: number; cost: number; realizedTrade: number; dividends: number };
type InvestmentEvent =
  | { kind: "transaction"; date: string; created_at: string; id: string; row: InvestmentTransaction }
  | { kind: "stock_dividend"; date: string; created_at: string; id: string; row: InvestmentDividend }
  | { kind: "corporate_action"; date: string; created_at: string; id: string; row: InvestmentCorporateAction };
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
const optionalDate = (value: unknown, field: string) => {
  const date = String(value ?? "").trim();
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${field}格式不正確`);
  return date;
};

export function calculateInvestmentSnapshot(
  accounts: InvestmentAccount[], securities: InvestmentSecurity[], transactions: InvestmentTransaction[],
  dividends: InvestmentDividend[] = [], corporateActions: InvestmentCorporateAction[] = [],
): Pick<InvestmentSnapshot, "holdings" | "summary"> {
  const accountMap = new Map(accounts.map((row) => [row.id, row]));
  const securityMap = new Map(securities.map((row) => [row.id, row]));
  const positions = new Map<string, Position>();
  const events: InvestmentEvent[] = [
    ...transactions.map((row) => ({ kind: "transaction" as const, date: row.trade_date, created_at: row.created_at, id: row.id, row })),
    ...dividends.filter((row) => row.dividend_type === "stock" && row.status === "received" && row.shares_received !== null)
      .map((row) => ({ kind: "stock_dividend" as const, date: row.payment_date ?? row.ex_dividend_date, created_at: row.created_at, id: row.id, row })),
    ...corporateActions.map((row) => ({ kind: "corporate_action" as const, date: row.event_date, created_at: row.created_at, id: row.id, row })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));

  for (const event of events) {
    const key = `${event.row.account_id}:${event.row.security_id}`;
    const state = positions.get(key) ?? { quantity: 0, cost: 0, realizedTrade: 0, dividends: 0 };
    if (event.kind === "stock_dividend") {
      state.quantity = quantity(state.quantity + Number(event.row.shares_received));
    } else if (event.kind === "corporate_action") {
      const row = event.row;
      if (Math.abs(state.quantity - Number(row.quantity_before)) > 0.000001) {
        throw new Error(`${row.event_date} 減資前股數與當時持有股數不符`);
      }
      if (row.action_type === "capital_reduction" && Number(row.cost_adjustment) > state.cost + 0.01) {
        throw new Error(`${row.event_date} 成本調整金額超過當時持有成本`);
      }
      state.quantity = quantity(Number(row.quantity_after));
      if (row.action_type === "capital_reduction") state.cost = money(state.cost - Number(row.cost_adjustment));
    } else {
      const row = event.row;
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
    }
    positions.set(key, state);
  }

  for (const row of dividends) {
    if (row.dividend_type !== "cash" || row.status !== "received" || row.received_amount === null) continue;
    const key = `${row.account_id}:${row.security_id}`;
    const state = positions.get(key) ?? { quantity: 0, cost: 0, realizedTrade: 0, dividends: 0 };
    state.dividends = money(state.dividends + Number(row.received_amount));
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
  const dividendIncome = money(holdings.reduce((sum, row) => sum + row.dividend_income, 0));
  return { holdings, summary: {
    cost_basis: costBasis, market_value: marketValue, realized_trade_profit: realizedTrade,
    dividend_income: dividendIncome, realized_profit: money(realizedTrade + dividendIncome),
    unrealized_profit: marketValue === null ? null : money(marketValue - costBasis),
  } };
}

const ACCOUNT_COLUMNS = "id,workspace_id,name,broker,currency,sort_order,is_active,note,created_at,updated_at";
const SECURITY_COLUMNS = "id,workspace_id,symbol,name,market,currency,current_price,current_price_date,sort_order,is_active,note,created_at,updated_at";
const TRANSACTION_COLUMNS = "id,workspace_id,account_id,security_id,transaction_type,trade_date,quantity,price,fee,tax,cash_amount,settlement_amount,order_number,currency,source,note,created_at,updated_at";
const DIVIDEND_COLUMNS = "id,workspace_id,account_id,security_id,dividend_type,ex_dividend_date,eligible_quantity,dividend_per_share,stock_dividend_rate,payment_date,received_amount,shares_received,deduction_type,status,source,note,created_at,updated_at";
const CORPORATE_ACTION_COLUMNS = "id,workspace_id,account_id,security_id,action_type,event_date,quantity_before,reduction_ratio,quantity_after,cash_return,cost_adjustment,source,note,created_at,updated_at";

export async function getInvestmentSnapshot(workspaceId: string): Promise<InvestmentSnapshot> {
  const [accountsResult, securitiesResult, transactionsResult, dividendsResult, corporateActionsResult] = await Promise.all([
    supabase.from("investment_accounts").select(ACCOUNT_COLUMNS).eq("workspace_id", workspaceId).order("sort_order").order("name"),
    supabase.from("investment_securities").select(SECURITY_COLUMNS).eq("workspace_id", workspaceId).order("sort_order").order("market").order("symbol"),
    supabase.from("investment_transactions").select(TRANSACTION_COLUMNS).eq("workspace_id", workspaceId).order("trade_date", { ascending: false }).order("created_at", { ascending: false }).limit(5000),
    supabase.from("investment_dividends").select(DIVIDEND_COLUMNS).eq("workspace_id", workspaceId).order("ex_dividend_date", { ascending: false }).order("created_at", { ascending: false }).limit(5000),
    supabase.from("investment_corporate_actions").select(CORPORATE_ACTION_COLUMNS).eq("workspace_id", workspaceId).order("event_date", { ascending: false }).order("created_at", { ascending: false }).limit(5000),
  ]);
  if (accountsResult.error) throw new Error(accountsResult.error.message);
  if (securitiesResult.error) throw new Error(securitiesResult.error.message);
  if (transactionsResult.error) throw new Error(transactionsResult.error.message);
  if (dividendsResult.error) throw new Error(dividendsResult.error.message);
  if (corporateActionsResult.error) throw new Error(corporateActionsResult.error.message);
  const accounts = (accountsResult.data ?? []) as InvestmentAccount[];
  const securities = (securitiesResult.data ?? []) as InvestmentSecurity[];
  const transactions = (transactionsResult.data ?? []) as InvestmentTransaction[];
  const dividends = ((dividendsResult.data ?? []) as Omit<InvestmentDividend, "expected_amount" | "expected_shares" | "deduction_amount">[]).map((row) => {
    const expectedAmount = row.dividend_type === "cash" ? money(Number(row.eligible_quantity) * Number(row.dividend_per_share)) : 0;
    const expectedShares = row.dividend_type === "stock" ? quantity(Number(row.eligible_quantity) * Number(row.stock_dividend_rate) / 10) : 0;
    return { ...row, expected_amount: expectedAmount, expected_shares: expectedShares, deduction_amount: row.received_amount === null ? 0 : money(Math.max(0, expectedAmount - Number(row.received_amount))) };
  });
  const corporateActions = (corporateActionsResult.data ?? []) as InvestmentCorporateAction[];
  return { accounts, securities, transactions, dividends, corporate_actions: corporateActions, ...calculateInvestmentSnapshot(accounts, securities, transactions, dividends, corporateActions) };
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
  if (resource === "dividend") {
    const dividendType: InvestmentDividendType = input.dividend_type === "stock" ? "stock" : "cash";
    const status: InvestmentDividend["status"] = input.status === "received" ? "received" : "pending";
    const eligibleQuantity = numberValue(input.eligible_quantity, "計算股數", false);
    const paymentDate = optionalDate(input.payment_date, "實際收款日期");
    const dividendPerShare = dividendType === "cash" ? numberValue(input.dividend_per_share, "每股現金股利", false) : 0;
    const stockDividendRate = dividendType === "stock" ? numberValue(input.stock_dividend_rate, "股票股利配股率", false) : 0;
    const expectedAmount = money(eligibleQuantity * dividendPerShare);
    const expectedShares = quantity(eligibleQuantity * stockDividendRate / 10);
    if (dividendType === "stock" && expectedShares <= 0) throw new Error("股票股利試算股數需大於 0");
    const receivedAmount = dividendType === "cash" && input.received_amount !== "" && input.received_amount != null
      ? numberValue(input.received_amount, "實際收款金額") : null;
    const sharesReceived = dividendType === "stock" && status === "received"
      ? (input.shares_received === "" || input.shares_received == null ? expectedShares : numberValue(input.shares_received, "實際入股股數", false))
      : null;
    if (dividendType === "cash" && status === "received" && (!paymentDate || receivedAmount === null)) throw new Error("已收款股利需填寫收款日期與金額");
    if (receivedAmount !== null && receivedAmount > expectedAmount + 0.01) throw new Error("實際收款金額不可高於預計股利");
    const deductionType: InvestmentDeductionType | null = dividendType === "cash" && receivedAmount !== null && receivedAmount < expectedAmount
      ? (INVESTMENT_DEDUCTION_TYPES.includes(String(input.deduction_type) as InvestmentDeductionType) ? String(input.deduction_type) as InvestmentDeductionType : "unclassified") : null;
    const payload = {
      workspace_id: workspaceId, account_id: requiredText(input.account_id, "券商帳戶"), security_id: requiredText(input.security_id, "股票"),
      dividend_type: dividendType, ex_dividend_date: tradeDate(input.ex_dividend_date), eligible_quantity: eligibleQuantity,
      dividend_per_share: dividendPerShare, stock_dividend_rate: stockDividendRate, payment_date: paymentDate,
      received_amount: receivedAmount, shares_received: sharesReceived, deduction_type: deductionType, status,
      source: input.source === "csv" || input.source === "excel" ? input.source : "manual", note: optionalText(input.note, 1000),
    };
    const { data, error } = await supabase.from("investment_dividends").insert(payload).select(DIVIDEND_COLUMNS).single();
    if (error) throw new Error(error.message); return data;
  }
  if (resource === "corporate_action") {
    const actionType = String(input.action_type) as InvestmentCorporateActionType;
    if (!INVESTMENT_ACTION_TYPES.includes(actionType)) throw new Error("股權異動類型不正確");
    const quantityBefore = numberValue(input.quantity_before, "減資前股數", false);
    const ratioPercent = numberValue(input.reduction_ratio_percent, "減資比率", false);
    if (ratioPercent >= 100) throw new Error("減資比率需小於 100%");
    const reductionRatio = ratioPercent / 100;
    const quantityAfter = input.quantity_after === "" || input.quantity_after == null
      ? quantity(quantityBefore * (1 - reductionRatio))
      : numberValue(input.quantity_after, "減資後股數");
    if (quantityAfter >= quantityBefore) throw new Error("減資後股數需小於減資前股數");
    const payload = {
      workspace_id: workspaceId, account_id: requiredText(input.account_id, "券商帳戶"), security_id: requiredText(input.security_id, "股票"),
      action_type: actionType, event_date: tradeDate(input.event_date), quantity_before: quantityBefore,
      reduction_ratio: reductionRatio, quantity_after: quantityAfter, cash_return: numberValue(input.cash_return, "實際退還金額"),
      cost_adjustment: actionType === "capital_reduction" ? numberValue(input.cost_adjustment, "成本調整金額") : 0,
      source: input.source === "csv" || input.source === "excel" ? input.source : "manual", note: optionalText(input.note, 1000),
    };
    const snapshot = await getInvestmentSnapshot(workspaceId);
    calculateInvestmentSnapshot(snapshot.accounts, snapshot.securities, snapshot.transactions, snapshot.dividends, [...snapshot.corporate_actions, { ...payload, id: "candidate", created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as InvestmentCorporateAction]);
    const { data, error } = await supabase.from("investment_corporate_actions").insert(payload).select(CORPORATE_ACTION_COLUMNS).single();
    if (error) throw new Error(error.message); return data;
  }
  if (resource === "transaction") {
    const type = String(input.transaction_type ?? "") as InvestmentTransactionType;
    if (!INVESTMENT_TRANSACTION_TYPES.includes(type)) throw new Error("交易類型不正確");
    const payload = {
      workspace_id: workspaceId, account_id: requiredText(input.account_id, "券商帳戶"), security_id: requiredText(input.security_id, "股票"),
      transaction_type: type, trade_date: tradeDate(input.trade_date), quantity: type === "dividend" ? 0 : numberValue(input.quantity, "股數", false),
      price: type === "dividend" ? 0 : numberValue(input.price, "成交價", false), fee: numberValue(input.fee, "手續費"), tax: numberValue(input.tax, "交易稅"),
      cash_amount: type === "dividend" ? numberValue(input.cash_amount, "股利金額", false) : 0,
      settlement_amount: input.settlement_amount === "" || input.settlement_amount == null ? null : numberValue(input.settlement_amount, "實付或實收金額"),
      order_number: optionalText(input.order_number, 120), currency: currencyCode(input.currency), source: input.source === "csv" || input.source === "excel" ? input.source : "manual",
      note: optionalText(input.note, 1000),
    };
    const { data: account } = await supabase.from("investment_accounts").select("id").eq("workspace_id", workspaceId).eq("id", payload.account_id).maybeSingle();
    const { data: security } = await supabase.from("investment_securities").select("id").eq("workspace_id", workspaceId).eq("id", payload.security_id).maybeSingle();
    if (!account || !security) throw new Error("券商帳戶或股票不屬於目前工作區");
    const existing = await getInvestmentSnapshot(workspaceId);
    calculateInvestmentSnapshot(existing.accounts, existing.securities, [...existing.transactions, { ...payload, id: "candidate", created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as InvestmentTransaction], existing.dividends, existing.corporate_actions);
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
  if (resource === "dividend") {
    const snapshot = await getInvestmentSnapshot(workspaceId);
    const current = snapshot.dividends.find((row) => row.id === id); if (!current) throw new Error("找不到股利紀錄");
    const merged = { ...current, ...input } as Record<string, unknown>;
    const dividendType: InvestmentDividendType = merged.dividend_type === "stock" ? "stock" : "cash";
    const status: InvestmentDividend["status"] = merged.status === "received" ? "received" : "pending";
    const eligibleQuantity = numberValue(merged.eligible_quantity, "計算股數", false);
    const paymentDate = optionalDate(merged.payment_date, "實際收款日期");
    const dividendPerShare = dividendType === "cash" ? numberValue(merged.dividend_per_share, "每股現金股利", false) : 0;
    const stockDividendRate = dividendType === "stock" ? numberValue(merged.stock_dividend_rate, "股票股利配股率", false) : 0;
    const expectedAmount = money(eligibleQuantity * dividendPerShare);
    const expectedShares = quantity(eligibleQuantity * stockDividendRate / 10);
    if (dividendType === "stock" && expectedShares <= 0) throw new Error("股票股利試算股數需大於 0");
    const receivedAmount = dividendType === "cash" && merged.received_amount !== "" && merged.received_amount != null
      ? numberValue(merged.received_amount, "實際收款金額") : null;
    const sharesReceived = dividendType === "stock" && status === "received"
      ? (merged.shares_received === "" || merged.shares_received == null ? expectedShares : numberValue(merged.shares_received, "實際入股股數", false))
      : null;
    if (dividendType === "cash" && status === "received" && (!paymentDate || receivedAmount === null)) throw new Error("已收款股利需填寫收款日期與金額");
    if (receivedAmount !== null && receivedAmount > expectedAmount + 0.01) throw new Error("實際收款金額不可高於預計股利");
    const deductionType: InvestmentDeductionType | null = dividendType === "cash" && receivedAmount !== null && receivedAmount < expectedAmount
      ? (INVESTMENT_DEDUCTION_TYPES.includes(String(merged.deduction_type) as InvestmentDeductionType) ? String(merged.deduction_type) as InvestmentDeductionType : "unclassified") : null;
    const patch = {
      account_id: requiredText(merged.account_id, "券商帳戶"), security_id: requiredText(merged.security_id, "股票"),
      dividend_type: dividendType, ex_dividend_date: tradeDate(merged.ex_dividend_date), eligible_quantity: eligibleQuantity,
      dividend_per_share: dividendPerShare, stock_dividend_rate: stockDividendRate, payment_date: paymentDate,
      received_amount: receivedAmount, shares_received: sharesReceived, deduction_type: deductionType, status,
      note: optionalText(merged.note, 1000), updated_at: new Date().toISOString(),
    };
    calculateInvestmentSnapshot(snapshot.accounts, snapshot.securities, snapshot.transactions, snapshot.dividends.map((row) => row.id === id ? { ...row, ...patch, expected_amount: expectedAmount, expected_shares: expectedShares, deduction_amount: receivedAmount === null ? 0 : money(Math.max(0, expectedAmount - receivedAmount)) } : row), snapshot.corporate_actions);
    const { data, error } = await supabase.from("investment_dividends").update(patch).eq("workspace_id", workspaceId).eq("id", id).select(DIVIDEND_COLUMNS).maybeSingle();
    if (error) throw new Error(error.message); if (!data) throw new Error("找不到股利紀錄"); return data;
  }
  if (resource === "corporate_action") {
    const snapshot = await getInvestmentSnapshot(workspaceId);
    const current = snapshot.corporate_actions.find((row) => row.id === id); if (!current) throw new Error("找不到股權異動紀錄");
    const merged = { ...current, ...input } as Record<string, unknown>;
    const actionType = String(merged.action_type) as InvestmentCorporateActionType;
    if (!INVESTMENT_ACTION_TYPES.includes(actionType)) throw new Error("股權異動類型不正確");
    const quantityBefore = numberValue(merged.quantity_before, "減資前股數", false);
    const ratioPercent = "reduction_ratio_percent" in input ? numberValue(input.reduction_ratio_percent, "減資比率", false) : Number(current.reduction_ratio) * 100;
    if (ratioPercent >= 100) throw new Error("減資比率需小於 100%");
    const reductionRatio = ratioPercent / 100;
    const quantityAfter = numberValue(merged.quantity_after, "減資後股數");
    if (quantityAfter >= quantityBefore) throw new Error("減資後股數需小於減資前股數");
    const patch = {
      account_id: requiredText(merged.account_id, "券商帳戶"), security_id: requiredText(merged.security_id, "股票"),
      action_type: actionType, event_date: tradeDate(merged.event_date), quantity_before: quantityBefore,
      reduction_ratio: reductionRatio, quantity_after: quantityAfter, cash_return: numberValue(merged.cash_return, "實際退還金額"),
      cost_adjustment: actionType === "capital_reduction" ? numberValue(merged.cost_adjustment, "成本調整金額") : 0,
      note: optionalText(merged.note, 1000), updated_at: new Date().toISOString(),
    };
    calculateInvestmentSnapshot(snapshot.accounts, snapshot.securities, snapshot.transactions, snapshot.dividends, snapshot.corporate_actions.map((row) => row.id === id ? { ...row, ...patch } : row));
    const { data, error } = await supabase.from("investment_corporate_actions").update(patch).eq("workspace_id", workspaceId).eq("id", id).select(CORPORATE_ACTION_COLUMNS).maybeSingle();
    if (error) throw new Error(error.message); if (!data) throw new Error("找不到股權異動紀錄"); return data;
  }
  if (resource === "transaction") {
    const snapshot = await getInvestmentSnapshot(workspaceId);
    const current = snapshot.transactions.find((row) => row.id === id); if (!current) throw new Error("找不到交易紀錄");
    const merged = { ...current, ...input } as Record<string, unknown>;
    const type = String(merged.transaction_type) as InvestmentTransactionType; if (!INVESTMENT_TRANSACTION_TYPES.includes(type)) throw new Error("交易類型不正確");
    const patch = { account_id: requiredText(merged.account_id, "券商帳戶"), security_id: requiredText(merged.security_id, "股票"), transaction_type: type, trade_date: tradeDate(merged.trade_date), quantity: type === "dividend" ? 0 : numberValue(merged.quantity, "股數", false), price: type === "dividend" ? 0 : numberValue(merged.price, "成交價", false), fee: numberValue(merged.fee, "手續費"), tax: numberValue(merged.tax, "交易稅"), cash_amount: type === "dividend" ? numberValue(merged.cash_amount, "股利金額", false) : 0, settlement_amount: merged.settlement_amount === "" || merged.settlement_amount == null ? null : numberValue(merged.settlement_amount, "實付或實收金額"), order_number: optionalText(merged.order_number, 120), currency: currencyCode(merged.currency), note: optionalText(merged.note, 1000), updated_at: new Date().toISOString() };
    calculateInvestmentSnapshot(snapshot.accounts, snapshot.securities, snapshot.transactions.map((row) => row.id === id ? { ...row, ...patch } : row), snapshot.dividends, snapshot.corporate_actions);
    const { data, error } = await supabase.from("investment_transactions").update(patch).eq("workspace_id", workspaceId).eq("id", id).select(TRANSACTION_COLUMNS).maybeSingle();
    if (error) throw new Error(error.message); if (!data) throw new Error("找不到交易紀錄"); return data;
  }
  throw new Error("不支援的投資資料類型");
}

export async function deleteInvestmentRecord(workspaceId: string, resource: string, id: string) {
  if (resource === "transaction" || resource === "dividend" || resource === "corporate_action") {
    const snapshot = await getInvestmentSnapshot(workspaceId);
    calculateInvestmentSnapshot(
      snapshot.accounts,
      snapshot.securities,
      resource === "transaction" ? snapshot.transactions.filter((row) => row.id !== id) : snapshot.transactions,
      resource === "dividend" ? snapshot.dividends.filter((row) => row.id !== id) : snapshot.dividends,
      resource === "corporate_action" ? snapshot.corporate_actions.filter((row) => row.id !== id) : snapshot.corporate_actions,
    );
  }
  const table = resource === "account" ? "investment_accounts"
    : resource === "security" ? "investment_securities"
      : resource === "transaction" ? "investment_transactions"
        : resource === "dividend" ? "investment_dividends"
          : resource === "corporate_action" ? "investment_corporate_actions" : "";
  if (!table) throw new Error("不支援的投資資料類型");
  const { data, error } = await supabase.from(table).delete().eq("workspace_id", workspaceId).eq("id", id).select("id").maybeSingle();
  if (error) throw new Error(error.code === "23503" ? "已有交易紀錄，請改為停用" : error.message);
  if (!data) throw new Error("找不到要刪除的資料");
}
