import { describe, expect, it } from "vitest";
import { calculateInvestmentSnapshot, estimateTradingCosts, type InvestmentAccount, type InvestmentCorporateAction, type InvestmentDividend, type InvestmentSecurity, type InvestmentTransaction } from "./investments";

const account = { id: "a", workspace_id: "w", name: "測試帳戶", broker: "券商", currency: "TWD", sort_order: 0, is_active: true, note: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } satisfies InvestmentAccount;
const security = { id: "s", workspace_id: "w", symbol: "2330", name: "台積電", market: "TWSE", currency: "TWD", current_price: 700, current_price_date: "2026-09-03", sort_order: 0, is_active: true, note: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } satisfies InvestmentSecurity;
const tx = (values: Partial<InvestmentTransaction> & Pick<InvestmentTransaction, "id" | "transaction_type" | "trade_date">): InvestmentTransaction => {
  const { id, transaction_type, trade_date, ...overrides } = values;
  return { id, workspace_id: "w", account_id: "a", security_id: "s", transaction_type, trade_date, quantity: 0, price: 0, fee: 0, tax: 0, cash_amount: 0, settlement_amount: null, order_number: null, currency: "TWD", source: "manual", note: null, created_at: `${trade_date}T00:00:00Z`, updated_at: `${trade_date}T00:00:00Z`, ...overrides };
};
const dividend = (values: Partial<InvestmentDividend> = {}): InvestmentDividend => ({ id: "d", workspace_id: "w", account_id: "a", security_id: "s", dividend_type: "cash", ex_dividend_date: "2026-05-19", eligible_quantity: 1000, dividend_per_share: 0.66, stock_dividend_rate: 0, payment_date: "2026-06-12", received_amount: 650, shares_received: null, deduction_type: "transfer_fee", status: "received", source: "manual", note: null, created_at: "2026-05-19T00:00:00Z", updated_at: "2026-06-12T00:00:00Z", expected_amount: 660, expected_shares: 0, deduction_amount: 10, ...values });
const action = (values: Partial<InvestmentCorporateAction> = {}): InvestmentCorporateAction => ({ id: "c", workspace_id: "w", account_id: "a", security_id: "s", action_type: "capital_reduction", event_date: "2026-02-01", quantity_before: 1000, reduction_ratio: 0.2, quantity_after: 800, cash_return: 2000, cost_adjustment: 2000, source: "manual", note: null, created_at: "2026-02-01T00:00:00Z", updated_at: "2026-02-01T00:00:00Z", ...values });


describe("phase 5 transparent calculations", () => {
  it("normalizes all TPEx casing without changing fee rates", () => {
    for (const market of ["TPEx", "TPEX", " tpex "]) expect(estimateTradingCosts({gross:52700,transactionType:"sell",symbol:"8938",market})).toEqual({fee:75,tax:158});
  });
  it("preserves historical dividends through reduction; removes only sold FIFO shares", () => {
    const buy=tx({id:"buy",transaction_type:"buy",trade_date:"2026-01-01",quantity:1000,price:10});
    const div=dividend({ex_dividend_date:"2026-01-15",dividend_per_share:1});
    const reduced=calculateInvestmentSnapshot([account],[security],[buy],[div],[action()]);
    expect(reduced.holdings[0]).toMatchObject({quantity:800,cost_basis:8000,position_dividend_gross:1000});
    expect(reduced.holdings[0].dividend_lots?.[0].allocations[0].remaining_gross).toBe(1000);
    const sold=calculateInvestmentSnapshot([account],[security],[buy,tx({id:"sell",transaction_type:"sell",trade_date:"2026-03-01",quantity:400,price:20})],[div],[action()]);
    expect(sold.holdings[0]).toMatchObject({quantity:400,cost_basis:4000,position_dividend_gross:500});
    expect(sold.holdings[0].dividend_lots?.[0].allocations[0].remaining_gross).toBe(500);
  });
  it("explains the 2014 example with FIFO dividends but weighted costs", () => {
    const trades=[
      tx({id:"b1",transaction_type:"buy",trade_date:"2021-05-25",quantity:1000,price:45.5,fee:64}),
      tx({id:"b2",transaction_type:"buy",trade_date:"2022-03-24",quantity:1000,price:48,fee:68}),
      tx({id:"s1",transaction_type:"sell",trade_date:"2022-03-25",quantity:1000,price:48.5,fee:69,tax:145}),
    ];
    const divs=[["2021-08-26",0.3],["2022-07-26",2.8],["2023-07-26",0.35],["2024-07-25",0.1]].map(([date,rate],i)=>dividend({id:"d"+i,ex_dividend_date:String(date),dividend_per_share:Number(rate)}));
    const row=calculateInvestmentSnapshot([account],[security],trades,divs).holdings[0];
    expect(row.cost_basis).toBe(46816);
    expect(row.position_dividend_gross).toBe(3250);
    expect(row.dividend_lots?.map(l=>l.origin_id)).toEqual(["b2"]);
    expect(row.dividend_lots?.[0].allocations.map(d=>d.ex_date)).toEqual(["2022-07-26","2023-07-26","2024-07-25"]);
  });
  it("does not give newly repurchased shares the old dividends", () => {
    const row=calculateInvestmentSnapshot([account],[security],[
      tx({id:"b",transaction_type:"buy",trade_date:"2026-01-01",quantity:1000,price:10}),
      tx({id:"s",transaction_type:"sell",trade_date:"2026-07-01",quantity:1000,price:10}),
      tx({id:"new",transaction_type:"buy",trade_date:"2026-08-01",quantity:1000,price:10}),
    ],[dividend()]).holdings[0];
    expect(row.position_dividend_gross).toBe(0);
    expect(row.dividend_lots?.[0]).toMatchObject({origin_id:"new",allocations:[]});
  });
  it("stock dividends add shares, not a second cash distribution", () => {
    const row=calculateInvestmentSnapshot([account],[security],[tx({id:"b",transaction_type:"buy",trade_date:"2026-01-01",quantity:1000,price:10})],
      [dividend(),dividend({id:"stock",dividend_type:"stock",shares_received:45,payment_date:"2026-07-01"})]).holdings[0];
    expect(row).toMatchObject({quantity:1045,cost_basis:10000,position_dividend_gross:660,dividend_income:650});
    expect(row.dividend_lots?.[1]).toMatchObject({origin:"stock_dividend",dividendGross:0});
  });
});
