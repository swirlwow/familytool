import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HoldingCalculation } from "./HoldingCalculation";
import { HoldingsList } from "./InvestmentLists";
import type { InvestmentHolding } from "@/lib/investments";

describe("holding calculation layout", () => {
  it("keeps collapsed rows compact and places shared rules only in help", () => {
    const row = { key: "test", account_name: "測試帳戶", symbol: "00878", security_name: "測試股票", quantity: 1000, current_price: 34, market_value: 34000, cost_basis: 16924, average_cost: 16.924, estimated_sale_fee: 48, estimated_sale_tax: 34, estimated_sale_value: 33918, unrealized_profit_after_sale_costs: 16994, unrealized_return: 100.41, position_dividend_gross: 6840, dividend_adjusted_cost_basis: 10084, dividend_adjusted_profit: 23834, dividend_adjusted_return: 236.35, dividend_income: 6740, dividend_lots: [], calculation_warnings: ["測試差異提醒"] } as unknown as InvestmentHolding;
    const html = renderToStaticMarkup(<HoldingsList rows={[row]} onPrice={() => {}} onManage={() => {}} />);
    expect(html).toContain("table-fixed");
    expect(html).toContain("<colgroup>");
    expect(html).toContain("w-32 shrink-0");
    const table = html.slice(html.indexOf("<tbody>"), html.indexOf("</tbody>"));
    expect(table.match(/<tr>/g)).toHaveLength(1);
    expect(table.split("</tr>")[0]).not.toContain("<details");
    expect(table).not.toContain('colSpan="9"');
    expect(table).toContain('aria-expanded="false"');
    expect(html.match(/成本採移動加權平均；/g)).toHaveLength(1);
    const detail = renderToStaticMarkup(<HoldingCalculation row={row} />);
    expect(detail).not.toContain("成本採移動加權平均；");
    expect(detail).not.toContain("費稅沿用一般台股試算");
    expect(detail).toContain("lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)_minmax(0,1fr)]");
    expect(html).not.toContain("min-w-[1280px]");
    expect(html).toContain("flex-col items-end");
    expect(detail).toContain("grid-cols-1");
    expect(detail).toContain("券商對帳（僅試算、不儲存）");
    expect(detail).toContain("測試差異提醒");
  });
});
