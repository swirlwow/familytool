import { describe, expect, it } from "vitest";
import { buildInvestmentCsv, parseInvestmentCsvScope } from "./investmentCsv";
import type { InvestmentSnapshot } from "./investments";

const snapshot = {
  accounts: [{ id: "a", workspace_id: "w", name: "永豐-大美女", broker: "永豐", currency: "TWD", sort_order: 0, is_active: true, note: null, created_at: "", updated_at: "" }],
  securities: [{ id: "s", workspace_id: "w", symbol: "00878", name: "國泰永續高股息", market: "TWSE", currency: "TWD", current_price: 34.38, current_price_date: "2026-09-07", sort_order: 0, is_active: true, note: null, created_at: "", updated_at: "" }],
  transactions: [{ id: "t", workspace_id: "w", account_id: "a", security_id: "s", transaction_type: "buy", trade_date: "2026-01-02", quantity: 1000, price: 20, fee: 28, tax: 0, cash_amount: 20000, settlement_amount: 20028, order_number: "A001", currency: "TWD", source: "manual", note: null, created_at: "", updated_at: "" }],
  dividends: [{ id: "d", workspace_id: "w", account_id: "a", security_id: "s", dividend_type: "cash", ex_dividend_date: "2026-05-19", eligible_quantity: 1000, dividend_per_share: 0.66, stock_dividend_rate: 0, payment_date: "2026-06-12", received_amount: 650, shares_received: null, deduction_type: "transfer_fee", status: "received", source: "excel", note: null, created_at: "", updated_at: "", expected_amount: 660, expected_shares: 0, deduction_amount: 10 }],
  corporate_actions: [{ id: "c", workspace_id: "w", account_id: "a", security_id: "s", action_type: "capital_reduction", event_date: "2026-07-01", quantity_before: 1000, reduction_ratio: 0.1, quantity_after: 900, cash_return: 1000, cost_adjustment: 1000, source: "manual", note: "測試", created_at: "", updated_at: "" }],
  holdings: [],
  summary: { cost_basis: 0, market_value: 0, realized_trade_profit: 0, dividend_income: 0, realized_profit: 0, unrealized_profit: 0 },
} satisfies InvestmentSnapshot;

describe("buildInvestmentCsv", () => {
  it("exports transaction records only for the transaction scope", () => {
    const csv = buildInvestmentCsv(snapshot, { scope: "transactions", accountId: "a" });
    expect(csv).toContain('"成交價"');
    expect(csv).toContain('"買進"');
    expect(csv).not.toContain('"除權息日期"');
  });

  it("applies the transaction date range", () => {
    expect(buildInvestmentCsv(snapshot, { scope: "transactions", dateFrom: "2026-02-01" })).not.toContain('"A001"');
    expect(buildInvestmentCsv(snapshot, { scope: "transactions", dateTo: "2026-01-02" })).toContain('"A001"');
  });

  it("exports dividend records for the dividend scope", () => {
    const csv = buildInvestmentCsv(snapshot, { scope: "dividends", accountId: "a" });
    expect(csv).toContain('"除權息日期"');
    expect(csv).toContain('"現金股利"');
    expect(csv).toContain('"650"');
  });

  it("exports corporate actions for the corporate-action scope", () => {
    const csv = buildInvestmentCsv(snapshot, { scope: "corporate_actions", accountId: "a" });
    expect(csv).toContain('"異動日期"');
    expect(csv).toContain('"現金減資"');
    expect(csv).toContain('"測試"');
  });

  it("defaults an unknown scope to transactions", () => {
    expect(parseInvestmentCsvScope("unknown")).toBe("transactions");
  });
});
