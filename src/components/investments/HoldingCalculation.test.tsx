import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HoldingsList } from "./InvestmentLists";
import type { InvestmentHolding } from "@/lib/investments";

describe("holding calculation layout", () => {
  it("places the disclosure in its own full-width table row and retains mobile content", () => {
    const row = { key: "test", account_name: "測試帳戶", symbol: "00878", security_name: "測試股票", quantity: 1000, current_price: 34, market_value: 34000, cost_basis: 16924, average_cost: 16.924, estimated_sale_fee: 48, estimated_sale_tax: 34, estimated_sale_value: 33918, unrealized_profit_after_sale_costs: 16994, unrealized_return: 100.41, position_dividend_gross: 6840, dividend_adjusted_cost_basis: 10084, dividend_adjusted_profit: 23834, dividend_adjusted_return: 236.35, dividend_income: 6740, dividend_lots: [], calculation_warnings: ["測試差異提醒"] } as unknown as InvestmentHolding;
    const html = renderToStaticMarkup(<HoldingsList rows={[row]} onPrice={() => {}} onManage={() => {}} />);
    const table = html.slice(html.indexOf("<tbody>"), html.indexOf("</tbody>"));
    expect(table.match(/<tr>/g)).toHaveLength(2);
    expect(table.split("</tr>")[0]).not.toContain("<details");
    expect(table).toMatch(/<td colSpan="9"[^>]*><details/);
    expect(html).toContain("lg:grid-cols-3");
    expect(html).toContain("grid-cols-1");
    expect(html).toContain("券商對帳（僅試算、不儲存）");
    expect(html).toContain("測試差異提醒");
  });
});
