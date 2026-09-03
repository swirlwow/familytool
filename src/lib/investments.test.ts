import { describe, expect, it } from "vitest";
import { calculateInvestmentSnapshot, type InvestmentAccount, type InvestmentSecurity, type InvestmentTransaction } from "./investments";

const account = { id: "a", workspace_id: "w", name: "測試帳戶", broker: "券商", currency: "TWD", sort_order: 0, is_active: true, note: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } satisfies InvestmentAccount;
const security = { id: "s", workspace_id: "w", symbol: "2330", name: "台積電", market: "TWSE", currency: "TWD", current_price: 700, current_price_date: "2026-09-03", sort_order: 0, is_active: true, note: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } satisfies InvestmentSecurity;
const tx = (values: Partial<InvestmentTransaction> & Pick<InvestmentTransaction, "id" | "transaction_type" | "trade_date">): InvestmentTransaction => {
  const { id, transaction_type, trade_date, ...overrides } = values;
  return { id, workspace_id: "w", account_id: "a", security_id: "s", transaction_type, trade_date, quantity: 0, price: 0, fee: 0, tax: 0, cash_amount: 0, note: null, created_at: `${trade_date}T00:00:00Z`, updated_at: `${trade_date}T00:00:00Z`, ...overrides };
};

describe("calculateInvestmentSnapshot", () => {
  it("calculates weighted average cost including fees", () => {
    const result = calculateInvestmentSnapshot([account], [security], [tx({ id: "1", transaction_type: "buy", trade_date: "2026-01-01", quantity: 10, price: 500, fee: 20 }), tx({ id: "2", transaction_type: "buy", trade_date: "2026-02-01", quantity: 10, price: 600, fee: 20 })]);
    expect(result.holdings[0]).toMatchObject({ quantity: 20, cost_basis: 11040, average_cost: 552, market_value: 14000, unrealized_profit: 2960 });
  });
  it("calculates realized profit and reduces cost at average cost", () => {
    const result = calculateInvestmentSnapshot([account], [security], [tx({ id: "1", transaction_type: "buy", trade_date: "2026-01-01", quantity: 10, price: 500 }), tx({ id: "2", transaction_type: "sell", trade_date: "2026-02-01", quantity: 4, price: 650, fee: 10, tax: 7 })]);
    expect(result.holdings[0]).toMatchObject({ quantity: 6, cost_basis: 3000, realized_trade_profit: 583, market_value: 4200, unrealized_profit: 1200 });
  });
  it("includes net dividends in realized profit", () => {
    const result = calculateInvestmentSnapshot([account], [security], [tx({ id: "1", transaction_type: "dividend", trade_date: "2026-03-01", cash_amount: 1000, fee: 10, tax: 20 })]);
    expect(result.summary).toMatchObject({ dividend_income: 970, realized_profit: 970 });
  });
  it("rejects selling more shares than held at the trade date", () => {
    expect(() => calculateInvestmentSnapshot([account], [security], [tx({ id: "1", transaction_type: "sell", trade_date: "2026-01-01", quantity: 1, price: 500 })])).toThrow("賣出股數超過");
  });
});
