import { describe, expect, it } from "vitest";
import { calculateInvestmentSnapshot, type InvestmentAccount, type InvestmentDividend, type InvestmentSecurity, type InvestmentTransaction } from "./investments";

const account = { id: "a", workspace_id: "w", name: "測試帳戶", broker: "券商", currency: "TWD", sort_order: 0, is_active: true, note: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } satisfies InvestmentAccount;
const security = { id: "s", workspace_id: "w", symbol: "2330", name: "台積電", market: "TWSE", currency: "TWD", current_price: 700, current_price_date: "2026-09-03", sort_order: 0, is_active: true, note: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } satisfies InvestmentSecurity;
const tx = (values: Partial<InvestmentTransaction> & Pick<InvestmentTransaction, "id" | "transaction_type" | "trade_date">): InvestmentTransaction => {
  const { id, transaction_type, trade_date, ...overrides } = values;
  return { id, workspace_id: "w", account_id: "a", security_id: "s", transaction_type, trade_date, quantity: 0, price: 0, fee: 0, tax: 0, cash_amount: 0, settlement_amount: null, order_number: null, currency: "TWD", source: "manual", note: null, created_at: `${trade_date}T00:00:00Z`, updated_at: `${trade_date}T00:00:00Z`, ...overrides };
};
const dividend = (values: Partial<InvestmentDividend> = {}): InvestmentDividend => ({ id: "d", workspace_id: "w", account_id: "a", security_id: "s", dividend_type: "cash", ex_dividend_date: "2026-05-19", eligible_quantity: 1000, dividend_per_share: 0.66, stock_dividend_rate: 0, payment_date: "2026-06-12", received_amount: 650, shares_received: null, deduction_type: "transfer_fee", status: "received", source: "manual", note: null, created_at: "2026-05-19T00:00:00Z", updated_at: "2026-06-12T00:00:00Z", expected_amount: 660, expected_shares: 0, deduction_amount: 10, ...values });

describe("phase 2 investment regression", () => {
  it("keeps the same stock's costs and dividends separate by account", () => {
    const second = { ...account, id: "b", name: "另一帳戶" };
    const result = calculateInvestmentSnapshot([account, second], [security], [
      tx({ id:"1", transaction_type:"buy", trade_date:"2026-01-01", quantity:1000, price:10 }),
      tx({ id:"2", account_id:"b", transaction_type:"buy", trade_date:"2026-01-01", quantity:1000, price:20 }),
    ], [dividend()]);
    expect(result.holdings.find(h => h.account_id === "a")).toMatchObject({cost_basis:10000, position_dividend_gross:660});
    expect(result.holdings.find(h => h.account_id === "b")).toMatchObject({cost_basis:20000, position_dividend_gross:0});
  });
  it("replays chronological events even when input is reversed, without mutating input", () => {
    const transactions = [
      tx({id:"1",transaction_type:"buy",trade_date:"2026-01-01",quantity:1000,price:10}),
      tx({id:"2",transaction_type:"sell",trade_date:"2026-06-20",quantity:400,price:12}),
    ];
    const reversed = [...transactions].reverse();
    const original = structuredClone(reversed);
    expect(calculateInvestmentSnapshot([account],[security],reversed,[dividend()]))
      .toEqual(calculateInvestmentSnapshot([account],[security],transactions,[dividend()]));
    expect(reversed).toEqual(original);
  });
  it("does not use another account's position to cover an oversell", () => {
    expect(() => calculateInvestmentSnapshot([account,{...account,id:"b"}],[security],[
      tx({id:"1",transaction_type:"buy",trade_date:"2026-01-01",quantity:1000,price:10}),
      tx({id:"2",account_id:"b",transaction_type:"sell",trade_date:"2026-02-01",quantity:1,price:12}),
    ])).toThrow("賣出股數超過");
  });
});
