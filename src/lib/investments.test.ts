import { describe, expect, it } from "vitest";
import { calculateInvestmentSnapshot, estimateTradingCosts, resolveDividendStatus, type InvestmentAccount, type InvestmentCorporateAction, type InvestmentDividend, type InvestmentSecurity, type InvestmentTransaction } from "./investments";

const account = { id: "a", workspace_id: "w", name: "測試帳戶", broker: "券商", currency: "TWD", sort_order: 0, is_active: true, note: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } satisfies InvestmentAccount;
const security = { id: "s", workspace_id: "w", symbol: "2330", name: "台積電", market: "TWSE", currency: "TWD", current_price: 700, current_price_date: "2026-09-03", sort_order: 0, is_active: true, note: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } satisfies InvestmentSecurity;
const tx = (values: Partial<InvestmentTransaction> & Pick<InvestmentTransaction, "id" | "transaction_type" | "trade_date">): InvestmentTransaction => {
  const { id, transaction_type, trade_date, ...overrides } = values;
  return { id, workspace_id: "w", account_id: "a", security_id: "s", transaction_type, trade_date, quantity: 0, price: 0, fee: 0, tax: 0, cash_amount: 0, settlement_amount: null, order_number: null, currency: "TWD", source: "manual", note: null, created_at: `${trade_date}T00:00:00Z`, updated_at: `${trade_date}T00:00:00Z`, ...overrides };
};
const dividend = (values: Partial<InvestmentDividend> = {}): InvestmentDividend => ({ id: "d", workspace_id: "w", account_id: "a", security_id: "s", dividend_type: "cash", ex_dividend_date: "2026-05-19", eligible_quantity: 1000, dividend_per_share: 0.66, stock_dividend_rate: 0, payment_date: "2026-06-12", received_amount: 650, shares_received: null, deduction_type: "transfer_fee", status: "received", source: "manual", note: null, created_at: "2026-05-19T00:00:00Z", updated_at: "2026-06-12T00:00:00Z", expected_amount: 660, expected_shares: 0, deduction_amount: 10, ...values });
const action = (values: Partial<InvestmentCorporateAction> = {}): InvestmentCorporateAction => ({ id: "c", workspace_id: "w", account_id: "a", security_id: "s", action_type: "capital_reduction", event_date: "2026-02-01", quantity_before: 1000, reduction_ratio: 0.2, quantity_after: 800, cash_return: 2000, cost_adjustment: 2000, source: "manual", note: null, created_at: "2026-02-01T00:00:00Z", updated_at: "2026-02-01T00:00:00Z", ...values });

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
  it("uses the actual received dividend amount without transaction fees or tax", () => {
    const result = calculateInvestmentSnapshot([account], [security], [tx({ id: "1", transaction_type: "buy", trade_date: "2026-01-01", quantity: 1000, price: 10 })], [dividend()]);
    expect(result.summary).toMatchObject({ dividend_income: 650, realized_profit: 650 });
  });
  it("calculates estimated sale value and both dividend views for an open position", () => {
    const result = calculateInvestmentSnapshot(
      [account],
      [{ ...security, current_price: 20 }],
      [tx({ id: "1", transaction_type: "buy", trade_date: "2026-01-01", quantity: 1000, price: 10, fee: 10 })],
      [dividend()],
    );
    expect(result.holdings[0]).toMatchObject({
      market_value: 20000,
      estimated_sale_fee: 28,
      estimated_sale_tax: 60,
      estimated_sale_value: 19912,
      cost_basis: 10010,
      position_dividend_gross: 660,
      dividend_adjusted_cost_basis: 9350,
      unrealized_profit_after_sale_costs: 9902,
      dividend_adjusted_profit: 10562,
      unrealized_return: 98.92,
      dividend_adjusted_return: 112.96,
    });
  });
  it("allocates accumulated ex-dividend amounts proportionally after a partial sale", () => {
    const result = calculateInvestmentSnapshot(
      [account],
      [security],
      [
        tx({ id: "1", transaction_type: "buy", trade_date: "2026-01-01", quantity: 1000, price: 10 }),
        tx({ id: "2", transaction_type: "sell", trade_date: "2026-06-20", quantity: 400, price: 10 }),
      ],
      [dividend({ dividend_per_share: 1, expected_amount: 1000, received_amount: 990 })],
    );
    expect(result.holdings[0]).toMatchObject({ quantity: 600, cost_basis: 6000, position_dividend_gross: 600, dividend_adjusted_cost_basis: 5400 });
  });
  it("does not carry dividends into a new position after the prior position is closed", () => {
    const result = calculateInvestmentSnapshot(
      [account],
      [security],
      [
        tx({ id: "1", transaction_type: "buy", trade_date: "2026-01-01", quantity: 1000, price: 10 }),
        tx({ id: "2", transaction_type: "sell", trade_date: "2026-06-20", quantity: 1000, price: 10 }),
        tx({ id: "3", transaction_type: "buy", trade_date: "2026-07-01", quantity: 100, price: 12 }),
      ],
      [dividend({ dividend_per_share: 1, expected_amount: 1000, received_amount: 990 })],
    );
    expect(result.holdings[0]).toMatchObject({ quantity: 100, cost_basis: 1200, position_dividend_gross: 0, dividend_adjusted_cost_basis: 1200 });
  });
  it("adds received stock dividends to shares without increasing cost", () => {
    const stockDividends = [
      dividend({ id: "s1", dividend_type: "stock", ex_dividend_date: "2022-08-12", eligible_quantity: 1000, dividend_per_share: 0, stock_dividend_rate: 0.3, payment_date: null, received_amount: null, shares_received: 30, deduction_type: null, expected_amount: 0, expected_shares: 30, deduction_amount: 0 }),
      dividend({ id: "s2", dividend_type: "stock", ex_dividend_date: "2023-08-11", eligible_quantity: 1000, dividend_per_share: 0, stock_dividend_rate: 0.15, payment_date: null, received_amount: null, shares_received: 15, deduction_type: null, expected_amount: 0, expected_shares: 15, deduction_amount: 0 }),
    ];
    const result = calculateInvestmentSnapshot([account], [security], [tx({ id: "1", transaction_type: "buy", trade_date: "2022-01-01", quantity: 1000, price: 10 })], stockDividends);
    expect(result.holdings[0]).toMatchObject({ quantity: 1045, cost_basis: 10000, average_cost: 9.57 });
    expect(result.summary).toMatchObject({ dividend_income: 0 });
  });
  it("applies a cash capital reduction to shares and carrying cost", () => {
    const result = calculateInvestmentSnapshot([account], [security], [tx({ id: "1", transaction_type: "buy", trade_date: "2026-01-01", quantity: 1000, price: 10 })], [], [action()]);
    expect(result.holdings[0]).toMatchObject({ quantity: 800, cost_basis: 8000, average_cost: 10 });
  });
  it("keeps total cost for a loss-offset capital reduction", () => {
    const result = calculateInvestmentSnapshot([account], [security], [tx({ id: "1", transaction_type: "buy", trade_date: "2026-01-01", quantity: 1000, price: 10 })], [], [action({ action_type: "loss_reduction", cost_adjustment: 0 })]);
    expect(result.holdings[0]).toMatchObject({ quantity: 800, cost_basis: 10000, average_cost: 12.5 });
  });
});

describe("estimateTradingCosts", () => {
  it("estimates listed-stock buy fee using the standard Taiwan rate", () => {
    expect(estimateTradingCosts({ gross: 9600, transactionType: "buy", symbol: "1718", market: "TWSE" })).toEqual({ fee: 13, tax: 0 });
  });
  it("estimates listed-stock sell fee and transaction tax", () => {
    expect(estimateTradingCosts({ gross: 8120, transactionType: "sell", symbol: "3481", market: "TWSE" })).toEqual({ fee: 11, tax: 24 });
  });
  it("uses the ETF sell tax rate for Taiwan ETF symbols", () => {
    expect(estimateTradingCosts({ gross: 37500, transactionType: "sell", symbol: "0056", market: "TWSE" })).toEqual({ fee: 53, tax: 37 });
  });
  it("does not guess fees for unsupported overseas markets", () => {
    expect(estimateTradingCosts({ gross: 10000, transactionType: "sell", symbol: "AAPL", market: "US" })).toEqual({ fee: 0, tax: 0 });
  });
});

describe("resolveDividendStatus", () => {
  it("marks a cash dividend received when its payment date is today or earlier", () => {
    expect(resolveDividendStatus("cash", "2026-09-06", "pending", "2026-09-07")).toBe("received");
    expect(resolveDividendStatus("cash", "2026-09-07", "pending", "2026-09-07")).toBe("received");
  });

  it("keeps future cash and stock dividend statuses unchanged", () => {
    expect(resolveDividendStatus("cash", "2026-09-08", "pending", "2026-09-07")).toBe("pending");
    expect(resolveDividendStatus("stock", "2026-09-06", "pending", "2026-09-07")).toBe("pending");
  });
});
