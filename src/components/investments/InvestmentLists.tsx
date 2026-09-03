"use client";

import { BriefcaseBusiness, Building2, Landmark, Pencil, Trash2 } from "lucide-react";
import type {
  InvestmentAccount,
  InvestmentCorporateAction,
  InvestmentDividend,
  InvestmentHolding,
  InvestmentSecurity,
  InvestmentTransaction,
} from "@/lib/investments";

const money = (value: number | null, empty = "—") => value === null ? empty : new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 2 }).format(value);
const numberText = (value: number) => new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 6 }).format(value);
const signedMoney = (value: number | null) => value === null ? "—" : `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`;
const sourceLabel = { manual: "手動", csv: "CSV", excel: "Excel" } as const;
const deductionLabel = { transfer_fee: "匯費", nhi: "補充保費", withholding_tax: "扣繳稅", other: "其他", unclassified: "未分類扣款" } as const;
const actionLabel = { capital_reduction: "現金減資", loss_reduction: "彌補虧損減資" } as const;

function Actions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div className="flex shrink-0 justify-end gap-2">
    <button className="btn btn-sm rounded-lg border-slate-200 bg-white" onClick={onEdit}><Pencil className="h-4 w-4" />修改</button>
    <button className="btn btn-sm rounded-lg border-rose-200 bg-rose-50 text-rose-600" onClick={onDelete}><Trash2 className="h-4 w-4" />刪除</button>
  </div>;
}

export function HoldingsList({ rows, onPrice }: { rows: InvestmentHolding[]; onPrice: (id: string) => void }) {
  if (!rows.length) return <div className="app-empty"><BriefcaseBusiness className="mx-auto mb-2 h-8 w-8 text-slate-300" /><p>尚無持有部位</p><p className="mt-1 text-xs">先建立券商帳戶與股票，再新增買進紀錄。</p></div>;
  return <><div className="hidden overflow-x-auto md:block"><table className="table">
    <thead><tr><th>股票</th><th>券商帳戶</th><th className="text-right">持有股數</th><th className="text-right">平均成本</th><th className="text-right">目前股價</th><th className="text-right">市值</th><th className="text-right">未實現損益</th><th /></tr></thead>
    <tbody>{rows.map((row) => <tr key={row.key}>
      <td><strong>{row.symbol} {row.security_name}</strong><div className="text-xs text-slate-400">{row.market}</div></td>
      <td>{row.account_name}<div className="text-xs text-slate-400">{row.broker}</div></td>
      <td className="text-right font-mono">{numberText(row.quantity)}</td><td className="text-right font-mono">{money(row.average_cost)}</td>
      <td className="text-right font-mono">{row.current_price === null ? "未更新" : money(row.current_price)}<div className="text-[10px] text-slate-400">{row.current_price_date}</div></td>
      <td className="text-right font-bold">{money(row.market_value)}</td>
      <td className={`text-right font-black ${(row.unrealized_profit ?? 0) >= 0 ? "text-rose-600" : "text-emerald-600"}`}>{signedMoney(row.unrealized_profit)}</td>
      <td><button className="btn btn-ghost btn-xs whitespace-nowrap" onClick={() => onPrice(row.security_id)}>更新股價</button></td>
    </tr>)}</tbody>
  </table></div>
  <div className="divide-y divide-slate-100 md:hidden">{rows.map((row) => <article key={row.key} className="p-4">
    <div className="flex justify-between gap-3"><div><strong>{row.symbol} {row.security_name}</strong><p className="text-xs text-slate-400">{row.account_name}・{row.market}</p></div><button className="btn btn-ghost btn-xs" onClick={() => onPrice(row.security_id)}>股價</button></div>
    <div className="mt-3 grid grid-cols-2 gap-2 text-sm"><span>持有 <b>{numberText(row.quantity)}</b></span><span>均價 <b>{money(row.average_cost)}</b></span><span>市值 <b>{money(row.market_value)}</b></span><span className={(row.unrealized_profit ?? 0) >= 0 ? "text-rose-600" : "text-emerald-600"}>損益 <b>{signedMoney(row.unrealized_profit)}</b></span></div>
  </article>)}</div></>;
}

export function TransactionList({ rows, accountMap, securityMap, onEdit, onDelete }: { rows: InvestmentTransaction[]; accountMap: Map<string, InvestmentAccount>; securityMap: Map<string, InvestmentSecurity>; onEdit: (row: InvestmentTransaction) => void; onDelete: (row: InvestmentTransaction) => void }) {
  if (!rows.length) return <div className="app-empty">尚無符合條件的交易紀錄</div>;
  return <div className="divide-y divide-slate-100">{rows.map((row) => {
    const security = securityMap.get(row.security_id); const account = accountMap.get(row.account_id);
    const gross = row.transaction_type === "dividend" ? row.cash_amount : row.quantity * row.price;
    const settlement = row.settlement_amount ?? (row.transaction_type === "buy" ? gross + row.fee + row.tax : gross - row.fee - row.tax);
    const tone = row.transaction_type === "buy" ? "border-sky-200 bg-sky-50 text-sky-700" : row.transaction_type === "sell" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";
    return <article key={row.id} className="p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-black ${tone}`}>{row.transaction_type === "buy" ? "買進" : row.transaction_type === "sell" ? "賣出" : "舊格式股利"}</span><div className="min-w-0"><strong className="block truncate text-slate-900">{security?.symbol} {security?.name}</strong><p className="text-xs text-slate-500">{row.trade_date}・{account?.name}・{sourceLabel[row.source] ?? row.source}</p>{row.note && <p className="mt-1 text-xs text-slate-400">{row.note}</p>}</div></div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4 xl:min-w-[560px]"><span><small className="block text-slate-400">數量／單價</small>{row.transaction_type === "dividend" ? "—" : `${numberText(row.quantity)} × ${money(row.price)}`}</span><span><small className="block text-slate-400">成交價金</small><b>{money(gross)}</b></span><span><small className="block text-slate-400">費用／稅</small>{money(row.fee + row.tax)}</span><span><small className="block text-slate-400">{row.transaction_type === "buy" ? "實付" : "實收"}</small><b>{money(settlement)}</b></span></div>
        <div className="flex flex-col gap-2 xl:items-end">{row.order_number && <span className="text-xs text-slate-400">委託單號 {row.order_number}</span>}<Actions onEdit={() => onEdit(row)} onDelete={() => onDelete(row)} /></div>
      </div>
    </article>;
  })}</div>;
}

export function DividendList({ rows, accountMap, securityMap, onEdit, onDelete }: { rows: InvestmentDividend[]; accountMap: Map<string, InvestmentAccount>; securityMap: Map<string, InvestmentSecurity>; onEdit: (row: InvestmentDividend) => void; onDelete: (row: InvestmentDividend) => void }) {
  if (!rows.length) return <div className="app-empty">尚無股利紀錄</div>;
  return <div className="divide-y divide-slate-100">{rows.map((row) => {
    const security = securityMap.get(row.security_id); const account = accountMap.get(row.account_id);
    return <article key={row.id} className="p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${row.status === "received" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{row.status === "received" ? "已收款" : "待發放"}</span><strong>{security?.symbol} {security?.name}</strong></div><p className="mt-1 text-xs text-slate-500">除權息 {row.ex_dividend_date}・{account?.name}</p></div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4 lg:min-w-[560px]"><span><small className="block text-slate-400">股數</small>{numberText(row.eligible_quantity)}</span><span><small className="block text-slate-400">每股股利</small>{money(row.dividend_per_share)}</span><span><small className="block text-slate-400">預計股利</small><b>{money(row.expected_amount)}</b></span><span><small className="block text-slate-400">實收／扣款</small><b>{row.received_amount === null ? "尚未收款" : `${money(row.received_amount)}／${money(row.deduction_amount)}`}</b></span></div>
      <div className="flex flex-col gap-2 lg:items-end">{row.deduction_amount > 0 && <span className="text-xs text-slate-500">{row.deduction_type ? deductionLabel[row.deduction_type] : "未分類扣款"}</span>}<Actions onEdit={() => onEdit(row)} onDelete={() => onDelete(row)} /></div>
    </div></article>;
  })}</div>;
}

export function CorporateActionList({ rows, accountMap, securityMap, onEdit, onDelete }: { rows: InvestmentCorporateAction[]; accountMap: Map<string, InvestmentAccount>; securityMap: Map<string, InvestmentSecurity>; onEdit: (row: InvestmentCorporateAction) => void; onDelete: (row: InvestmentCorporateAction) => void }) {
  if (!rows.length) return <div className="app-empty">尚無股權異動紀錄</div>;
  return <div className="divide-y divide-slate-100">{rows.map((row) => {
    const security = securityMap.get(row.security_id); const account = accountMap.get(row.account_id);
    return <article key={row.id} className="p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1"><span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-700">{actionLabel[row.action_type]}</span><strong className="ml-2">{security?.symbol} {security?.name}</strong><p className="mt-2 text-xs text-slate-500">{row.event_date}・{account?.name}</p></div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4 lg:min-w-[560px]"><span><small className="block text-slate-400">減資比率</small>{numberText(row.reduction_ratio * 100)}%</span><span><small className="block text-slate-400">股數變動</small>{numberText(row.quantity_before)} → {numberText(row.quantity_after)}</span><span><small className="block text-slate-400">退還金額</small>{money(row.cash_return)}</span><span><small className="block text-slate-400">成本調整</small>{money(row.cost_adjustment)}</span></div>
      <Actions onEdit={() => onEdit(row)} onDelete={() => onDelete(row)} />
    </div></article>;
  })}</div>;
}

export function InvestmentSettings({ accounts, securities, onAccount, onSecurity, onDelete }: { accounts: InvestmentAccount[]; securities: InvestmentSecurity[]; onAccount: (row?: InvestmentAccount) => void; onSecurity: (row?: InvestmentSecurity) => void; onDelete: (resource: string, id: string, label: string) => void }) {
  return <div className="grid gap-4 p-4 xl:grid-cols-2">
    <section className="rounded-lg border border-slate-200"><div className="app-panel-header"><div><h2 className="font-black text-slate-800">券商帳戶</h2><p className="text-xs text-slate-400">股票交易使用的帳戶</p></div><button className="btn btn-sm rounded-lg border-0 bg-indigo-600 text-white" onClick={() => onAccount()}>新增</button></div><div className="divide-y divide-slate-100">{accounts.length ? accounts.map((row) => <div key={row.id} className="flex items-center gap-3 p-3"><span className="rounded-lg bg-indigo-50 p-2 text-indigo-600"><Landmark className="h-4 w-4" /></span><div className="min-w-0 flex-1"><strong className="block truncate">{row.name}</strong><span className="text-xs text-slate-400">{row.broker || "未填券商"}・{row.is_active ? "啟用" : "停用"}</span></div><Actions onEdit={() => onAccount(row)} onDelete={() => onDelete("account", row.id, row.name)} /></div>) : <div className="app-empty">尚未建立券商帳戶</div>}</div></section>
    <section className="rounded-lg border border-slate-200"><div className="app-panel-header"><div><h2 className="font-black text-slate-800">股票基本資料</h2><p className="text-xs text-slate-400">代號、名稱與選填股價</p></div><button className="btn btn-sm rounded-lg border-0 bg-indigo-600 text-white" onClick={() => onSecurity()}>新增</button></div><div className="divide-y divide-slate-100">{securities.length ? securities.map((row) => <div key={row.id} className="flex items-center gap-3 p-3"><span className="rounded-lg bg-sky-50 p-2 text-sky-600"><Building2 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><strong className="block truncate">{row.symbol} {row.name}</strong><span className="text-xs text-slate-400">{row.market}・{row.current_price === null ? "股價未更新" : `${money(row.current_price)}｜${row.current_price_date ?? "未填日期"}`}</span></div><Actions onEdit={() => onSecurity(row)} onDelete={() => onDelete("security", row.id, `${row.symbol} ${row.name}`)} /></div>) : <div className="app-empty">尚未建立股票資料</div>}</div></section>
  </div>;
}
