"use client";
import { useState } from "react";
import type { InvestmentHolding } from "@/lib/investments";
import { quoteDescription } from "@/lib/investment-provenance";

const amount = (n: number | null) => n === null ? "未有報價" : new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(n);
export function QuoteProvenance({ row }: { row: InvestmentHolding }) {
  const info = quoteDescription(row);
  return <div className="mt-1 space-y-0.5 text-[11px] font-normal text-slate-500">
    <div>{info.timestamp}</div><div>{info.source}</div><div>{info.freshness}</div>
  </div>;
}
export function HoldingCalculation({ row }: { row: InvestmentHolding }) {
  const [broker, setBroker] = useState({ quantity: "", cost: "", net: "" });
  const lots = row.dividend_lots ?? [];
  const comparisons = [
    { key: "quantity" as const, label: "券商持股數", actual: row.quantity },
    { key: "cost" as const, label: "券商成本（未扣除息）", actual: row.cost_basis },
    { key: "net" as const, label: "券商現值（已扣預估費稅）", actual: row.estimated_sale_value },
  ];
  return <details className="mt-2 w-full whitespace-normal rounded-lg border border-slate-200 bg-white p-4 text-left text-sm font-normal text-slate-700">
    <summary className="cursor-pointer font-bold text-indigo-700 focus-visible:outline focus-visible:outline-2">計算明細／對帳</summary>
    <div className="mt-3 space-y-3">
      <p className="font-bold">{row.account_name}・{row.symbol} {row.security_name}</p>
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
      <section className="min-w-0 space-y-3">
      <h3 className="font-bold text-indigo-700">計算明細</h3>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 [&_dd]:text-right [&_dd]:tabular-nums">
        <dt>市值＝股數 × 股價</dt><dd>{amount(row.market_value)}</dd>
        <dt>預估手續費／交易稅</dt><dd>{amount(row.estimated_sale_fee)}／{amount(row.estimated_sale_tax)}</dd>
        <dt>預估賣出淨值＝市值 − 費稅</dt><dd>{amount(row.estimated_sale_value)}</dd>
        <dt>持有成本（移動加權平均）</dt><dd>{amount(row.cost_basis)}</dd>
        <dt>平均成本＝持有成本 ÷ 股數</dt><dd>{amount(row.average_cost)}</dd>
        <dt>未實現＝預估淨值 − 持有成本</dt><dd>{amount(row.unrealized_profit_after_sale_costs)}</dd>
        <dt>目前持股累計除息（毛額）</dt><dd>{amount(row.position_dividend_gross)}</dd>
        <dt>除息後成本＝持有成本 − 累計除息</dt><dd>{amount(row.dividend_adjusted_cost_basis)}</dd>
        <dt>含股利損益＝預估淨值 − 除息後成本</dt><dd>{amount(row.dividend_adjusted_profit)}</dd>
        <dt>歷年實收現金股利（含已售批次）</dt><dd>{amount(row.dividend_income)}</dd>
      </dl>
      <p>成本採移動加權平均；只有除息批次採先買先賣。含股利損益不是歷年全部收益。報酬率分母分別為持有成本／除息後成本；分母不大於 0 時不顯示。</p>
      <p>費稅沿用一般台股試算：手續費 0.1425%，一般股票賣出稅 0.3%、代號 00 開頭 ETF 0.1%，各自無條件捨去至元。未包含券商折扣、最低費用、當沖及特殊商品／免稅規則，請以券商為準；不回寫實際交易費稅。</p>
      </section>
      <section className="min-w-0 space-y-2 border-t border-slate-100 pt-3 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <h3 className="font-bold">目前持股的除息來源</h3>
        {lots.map((lot) => <div key={lot.origin_id} className="rounded-md bg-slate-50 p-2">
          <p className="font-semibold">{lot.acquired_date} {lot.origin === "buy" ? "買進" : "股票股利入股"}・剩餘 {amount(lot.quantity)} 股</p>
          <details open={lot.allocations.length <= 4}>
          <summary className="my-2 cursor-pointer text-indigo-700">除息紀錄（{lot.allocations.length} 筆）</summary>
          {lot.allocations.length ? lot.allocations.map((part) => <p key={part.dividend_id} className="mt-1">
            {part.ex_date}：原參與 {amount(part.eligible_quantity)} 股 × {amount(part.per_share)}＝{amount(part.gross)}；目前歸屬 {amount(part.remaining_gross)}
          </p>) : <p>此批次尚無已參與的現金除息。</p>}
          </details>
          <p className="mt-1 font-semibold">此批次累計除息 {amount(lot.dividendGross)}</p>
        </div>)}
        <p>除息日在當日買賣前認定。減資保留歷史除息，配股本身不新增現金股利；實際賣出才移除 FIFO 批次的除息。分攤有小數時以批次小計為準。</p>
      </section>

      <section className="min-w-0 space-y-2 border-t border-slate-100 pt-3 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <h3 className="font-bold">券商對帳（僅試算、不儲存）</h3>
        <p>先核對相同帳戶、日期、股價與除息／費稅口徑。差額＝本工具 − 券商；不要為了對齊數字直接修改紀錄。</p>
        {comparisons.map((field) => <label key={field.key} className="block">{field.label}
          <input className="input input-bordered mt-1 w-full" type="number" step="any" value={broker[field.key]}
            onChange={(event) => setBroker((old) => ({ ...old, [field.key]: event.target.value }))} />
          <span className="mt-1 block">{broker[field.key] !== "" && field.actual !== null && Number.isFinite(Number(broker[field.key])) ? `差額 ${amount(field.actual - Number(broker[field.key]))}` : "尚未比對"}</span>
        </label>)}
      </section>
      </div>
      {row.calculation_warnings?.map((message, index) => <p key={index} className="rounded bg-amber-50 p-2 text-amber-900">{message}</p>)}
    </div>
  </details>;
}
