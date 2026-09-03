"use client";

import { useMemo, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { estimateTradingCosts } from "@/lib/investments";
import type {
  InvestmentAccount,
  InvestmentCorporateAction,
  InvestmentDividend,
  InvestmentHolding,
  InvestmentSecurity,
  InvestmentTransaction,
  InvestmentTransactionType,
} from "@/lib/investments";

export type InvestmentModal =
  | { kind: "transaction"; row?: InvestmentTransaction; transactionType?: InvestmentTransactionType }
  | { kind: "dividend"; row?: InvestmentDividend }
  | { kind: "corporate_action"; row?: InvestmentCorporateAction }
  | { kind: "account"; row?: InvestmentAccount }
  | { kind: "security"; row?: InvestmentSecurity };

type Save = (resource: string, body: Record<string, unknown>, id?: string) => Promise<void>;
const today = () => new Date().toISOString().slice(0, 10);
const inputClass = "input input-bordered w-full rounded-lg";
const selectClass = "select select-bordered w-full rounded-lg";
const Label = ({ title, children, wide = false }: { title: string; children: ReactNode; wide?: boolean }) => <label className={wide ? "sm:col-span-2" : ""}><span className="mb-1 block text-xs font-bold text-slate-500">{title}</span>{children}</label>;

function ModalFrame({ title, subtitle, saving, onClose, onSubmit, children }: { title: string; subtitle?: string; saving: boolean; onClose: () => void; onSubmit: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/35 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3"><div><h2 className="text-lg font-black text-slate-900">{title}</h2>{subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}</div><button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="關閉"><X className="h-5 w-5" /></button></div>
      <div className="grid gap-4 p-4 sm:grid-cols-2">{children}</div>
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3"><button className="btn btn-ghost rounded-lg" onClick={onClose}>取消</button><button className="btn rounded-lg border-0 bg-indigo-600 px-6 text-white hover:bg-indigo-700" disabled={saving} onClick={onSubmit}>{saving && <span className="loading loading-spinner loading-sm" />}儲存</button></div>
    </div>
  </div>;
}

function SecuritySelect({ value, onChange, securities, includeId }: { value: string; onChange: (value: string) => void; securities: InvestmentSecurity[]; includeId?: string }) {
  return <select className={selectClass} value={value} onChange={(event) => onChange(event.target.value)}><option value="">請選擇</option>{securities.filter((row) => row.is_active || row.id === includeId).map((row) => <option key={row.id} value={row.id}>{row.symbol} {row.name}</option>)}</select>;
}

function AccountSelect({ value, onChange, accounts, includeId }: { value: string; onChange: (value: string) => void; accounts: InvestmentAccount[]; includeId?: string }) {
  return <select className={selectClass} value={value} onChange={(event) => onChange(event.target.value)}><option value="">請選擇</option>{accounts.filter((row) => row.is_active || row.id === includeId).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>;
}

export function TransactionModal({ modal, accounts, securities, saving, onClose, onSave }: { modal: Extract<InvestmentModal, { kind: "transaction" }>; accounts: InvestmentAccount[]; securities: InvestmentSecurity[]; saving: boolean; onClose: () => void; onSave: Save }) {
  const tx = modal.row;
  const [form, setForm] = useState<Record<string, string>>({
    transaction_type: tx?.transaction_type ?? modal.transactionType ?? "buy", trade_date: tx?.trade_date ?? today(),
    account_id: tx?.account_id ?? accounts.find((row) => row.is_active)?.id ?? "", security_mode: tx || securities.length ? "existing" : "new",
    security_id: tx?.security_id ?? securities.find((row) => row.is_active)?.id ?? "", new_security_symbol: "", new_security_name: "",
    new_security_market: "TWSE", new_security_current_price: "", new_security_current_price_date: "",
    quantity: tx?.quantity ? String(tx.quantity) : "", price: tx?.price ? String(tx.price) : "", fee: tx?.fee ? String(tx.fee) : "",
    tax: tx?.tax ? String(tx.tax) : "", cash_amount: tx?.cash_amount ? String(tx.cash_amount) : "",
    settlement_amount: tx?.settlement_amount == null ? "" : String(tx.settlement_amount), order_number: tx?.order_number ?? "",
    currency: tx?.currency ?? "TWD", note: tx?.note ?? "", cost_mode: tx ? "manual" : "auto",
  });
  const field = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const type = form.transaction_type as InvestmentTransactionType;
  const useNewSecurity = form.security_mode === "new";
  const gross = Number(form.quantity || 0) * Number(form.price || 0);
  const selectedSecurity = useMemo(() => useNewSecurity
    ? { symbol: form.new_security_symbol, market: form.new_security_market }
    : securities.find((row) => row.id === form.security_id),
  [form.new_security_market, form.new_security_symbol, form.security_id, securities, useNewSecurity]);
  const automaticCosts = useMemo(() => estimateTradingCosts({
    gross,
    transactionType: type,
    symbol: selectedSecurity?.symbol ?? "",
    market: selectedSecurity?.market ?? "",
  }), [gross, selectedSecurity?.market, selectedSecurity?.symbol, type]);
  const editCost = (key: "fee" | "tax", value: string) => setForm((current) => ({ ...current, [key]: value, cost_mode: "manual" }));
  const resetAutomaticCosts = () => setForm((current) => ({ ...current, cost_mode: "auto" }));
  const effectiveFee = form.cost_mode === "auto" ? automaticCosts.fee : Number(form.fee || 0);
  const effectiveTax = form.cost_mode === "auto" ? automaticCosts.tax : Number(form.tax || 0);
  const estimatedSettlement = type === "buy" ? gross + effectiveFee + effectiveTax : gross - effectiveFee - effectiveTax;

  return <ModalFrame title={tx ? "修改交易" : type === "sell" ? "新增賣出" : "新增買進"} subtitle={useNewSecurity ? "儲存時會同時建立股票資料" : "可修改後重新計算後續持股"} saving={saving} onClose={onClose} onSubmit={() => void onSave("transaction", { ...form, fee: effectiveFee, tax: effectiveTax }, tx?.id)}>
    <Label title="交易類型"><select className={selectClass} value={type} onChange={(event) => field("transaction_type", event.target.value)}><option value="buy">買進</option><option value="sell">賣出</option>{tx?.transaction_type === "dividend" && <option value="dividend">舊格式股利</option>}</select></Label>
    <Label title="成交日期"><input type="date" className={inputClass} value={form.trade_date} onChange={(event) => field("trade_date", event.target.value)} /></Label>
    <Label title="券商帳戶" wide><AccountSelect value={form.account_id} onChange={(value) => field("account_id", value)} accounts={accounts} includeId={tx?.account_id} /></Label>
    <fieldset className="grid gap-3 rounded-xl border border-indigo-100 bg-indigo-50/35 p-3 sm:col-span-2 sm:grid-cols-2"><div className="flex items-center justify-between gap-3 sm:col-span-2"><span className="text-sm font-black text-slate-800">股票資料</span>{!tx && securities.length > 0 && <div className="inline-flex rounded-lg bg-white p-1 shadow-sm"><button type="button" aria-pressed={!useNewSecurity} className={`rounded-md px-3 py-1.5 text-xs font-bold ${!useNewSecurity ? "bg-indigo-600 text-white" : "text-slate-500"}`} onClick={() => field("security_mode", "existing")}>選擇既有</button><button type="button" aria-pressed={useNewSecurity} className={`rounded-md px-3 py-1.5 text-xs font-bold ${useNewSecurity ? "bg-indigo-600 text-white" : "text-slate-500"}`} onClick={() => field("security_mode", "new")}>建立新股票</button></div>}</div>
      {useNewSecurity ? <><Label title="股票代號"><input className={`${inputClass} bg-white uppercase`} value={form.new_security_symbol} onChange={(event) => field("new_security_symbol", event.target.value)} placeholder="例如：2330" /></Label><Label title="股票名稱"><input className={`${inputClass} bg-white`} value={form.new_security_name} onChange={(event) => field("new_security_name", event.target.value)} /></Label><Label title="市場"><select className={`${selectClass} bg-white`} value={form.new_security_market} onChange={(event) => field("new_security_market", event.target.value)}><option value="TWSE">TWSE（台股上市）</option><option value="TPEx">TPEx（台股上櫃）</option><option value="US">US（美股）</option><option value="OTHER">OTHER（其他）</option></select></Label><Label title="目前股價（選填）"><input type="number" min="0" step="0.01" className={`${inputClass} bg-white`} value={form.new_security_current_price} onChange={(event) => field("new_security_current_price", event.target.value)} /></Label></> : <Label title="選擇股票" wide><SecuritySelect value={form.security_id} onChange={(value) => field("security_id", value)} securities={securities} includeId={tx?.security_id} /></Label>}
    </fieldset>
    {type === "dividend" ? <Label title="舊格式股利金額" wide><input type="number" min="0" step="0.01" className={inputClass} value={form.cash_amount} onChange={(event) => field("cash_amount", event.target.value)} /></Label> : <><Label title="股數"><input type="number" min="0" step="0.000001" className={inputClass} value={form.quantity} onChange={(event) => field("quantity", event.target.value)} /></Label><Label title="成交價"><input type="number" min="0" step="0.01" className={inputClass} value={form.price} onChange={(event) => field("price", event.target.value)} /></Label></>}
    {type !== "dividend" && <><Label title="手續費（自動試算）"><input type="number" min="0" step="1" className={inputClass} value={effectiveFee} onChange={(event) => editCost("fee", event.target.value)} /></Label><Label title="交易稅（自動試算）"><input type="number" min="0" step="1" className={inputClass} value={effectiveTax} onChange={(event) => editCost("tax", event.target.value)} /></Label><div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 sm:col-span-2"><span>{selectedSecurity?.market === "TWSE" || selectedSecurity?.market === "TPEx" ? "手續費以 0.1425% 參考費率試算；實際費率與最低收費依券商為準，可手動修改。" : "非台股市場不自動估算費稅，請依券商資料填寫。"}</span><button type="button" className="btn btn-ghost btn-xs shrink-0 text-indigo-700" onClick={resetAutomaticCosts}>重新自動計算</button></div><Label title={type === "buy" ? "實際扣款（選填）" : "實際入帳（選填）"}><input type="number" min="0" step="0.01" className={inputClass} value={form.settlement_amount} onChange={(event) => field("settlement_amount", event.target.value)} placeholder={estimatedSettlement > 0 ? `試算 ${estimatedSettlement.toFixed(0)}` : ""} /></Label><Label title="委託單號（選填、不可重複）"><input className={inputClass} value={form.order_number} onChange={(event) => field("order_number", event.target.value)} /></Label></>}
    <Label title="備註" wide><textarea className="textarea textarea-bordered min-h-20 w-full rounded-lg" value={form.note} onChange={(event) => field("note", event.target.value)} /></Label>
  </ModalFrame>;
}

export function DividendModal({ modal, accounts, securities, saving, onClose, onSave }: { modal: Extract<InvestmentModal, { kind: "dividend" }>; accounts: InvestmentAccount[]; securities: InvestmentSecurity[]; saving: boolean; onClose: () => void; onSave: Save }) {
  const row = modal.row;
  const [form, setForm] = useState<Record<string, string>>({ account_id: row?.account_id ?? accounts.find((item) => item.is_active)?.id ?? "", security_id: row?.security_id ?? securities.find((item) => item.is_active)?.id ?? "", dividend_type: row?.dividend_type ?? "cash", ex_dividend_date: row?.ex_dividend_date ?? today(), eligible_quantity: row ? String(row.eligible_quantity) : "", dividend_per_share: row ? String(row.dividend_per_share) : "", stock_dividend_rate: row ? String(row.stock_dividend_rate) : "", status: row?.status ?? "pending", payment_date: row?.payment_date ?? "", received_amount: row?.received_amount == null ? "" : String(row.received_amount), shares_received: row?.shares_received == null ? "" : String(row.shares_received), deduction_type: row?.deduction_type ?? "unclassified", note: row?.note ?? "" });
  const field = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const isStock = form.dividend_type === "stock";
  const expected = Number(form.eligible_quantity || 0) * Number(form.dividend_per_share || 0);
  const expectedShares = Number(form.eligible_quantity || 0) * Number(form.stock_dividend_rate || 0) / 10;
  const deduction = form.received_amount === "" ? 0 : Math.max(0, expected - Number(form.received_amount));
  return <ModalFrame title={row ? "修改股利" : "新增股利"} subtitle={isStock ? "股票股利會增加持股數，但不增加持有成本" : "不知道扣款組成時，只填實收金額即可"} saving={saving} onClose={onClose} onSubmit={() => void onSave("dividend", form, row?.id)}>
    <Label title="股利類型"><select className={selectClass} value={form.dividend_type} onChange={(event) => field("dividend_type", event.target.value)}><option value="cash">現金股利</option><option value="stock">股票股利</option></select></Label><Label title="除權息日期"><input type="date" className={inputClass} value={form.ex_dividend_date} onChange={(event) => field("ex_dividend_date", event.target.value)} /></Label>
    <Label title="券商帳戶"><AccountSelect value={form.account_id} onChange={(value) => field("account_id", value)} accounts={accounts} includeId={row?.account_id} /></Label><Label title="股票"><SecuritySelect value={form.security_id} onChange={(value) => field("security_id", value)} securities={securities} includeId={row?.security_id} /></Label>
    <Label title="計算股數"><input type="number" min="0" step="0.000001" className={inputClass} value={form.eligible_quantity} onChange={(event) => field("eligible_quantity", event.target.value)} /></Label>
    {isStock ? <><Label title="股票股利（元）"><input type="number" min="0" step="0.000001" className={inputClass} value={form.stock_dividend_rate} onChange={(event) => field("stock_dividend_rate", event.target.value)} placeholder="例如：0.3" /></Label><div className="rounded-lg bg-violet-50 p-3 sm:col-span-2"><span className="text-xs font-bold text-violet-700">預計配股</span><strong className="mt-1 block text-lg text-violet-800">{expectedShares.toLocaleString("zh-TW", { maximumFractionDigits: 6 })} 股</strong><p className="mt-1 text-xs text-violet-600">配股 {Number(form.stock_dividend_rate || 0).toLocaleString()} 元＝每 1,000 股配 {Number(form.stock_dividend_rate || 0) * 100} 股</p></div></> : <><Label title="每股現金股利"><input type="number" min="0" step="0.000001" className={inputClass} value={form.dividend_per_share} onChange={(event) => field("dividend_per_share", event.target.value)} /></Label><div className="rounded-lg bg-emerald-50 p-3"><span className="text-xs font-bold text-emerald-700">預計股利</span><strong className="mt-1 block text-lg text-emerald-800">{expected.toLocaleString("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 2 })}</strong></div></>}
    <Label title="狀態"><select className={selectClass} value={form.status} onChange={(event) => field("status", event.target.value)}><option value="pending">{isStock ? "待配發" : "待發放"}</option><option value="received">{isStock ? "已入股" : "已收款"}</option></select></Label><Label title={isStock ? "股票入帳日期（選填）" : "實際收款日期"}><input type="date" className={inputClass} value={form.payment_date} onChange={(event) => field("payment_date", event.target.value)} /></Label>
    {isStock ? <Label title="實際入股股數（選填）" wide><input type="number" min="0" step="0.000001" className={inputClass} value={form.shares_received} onChange={(event) => field("shares_received", event.target.value)} placeholder={expectedShares > 0 ? `未填則使用試算 ${expectedShares.toLocaleString("zh-TW", { maximumFractionDigits: 6 })} 股` : ""} disabled={form.status !== "received"} /></Label> : <><Label title="實際收款金額"><input type="number" min="0" step="0.01" className={inputClass} value={form.received_amount} onChange={(event) => field("received_amount", event.target.value)} /></Label><Label title={`扣除金額（自動：${deduction.toLocaleString("zh-TW", { style: "currency", currency: "TWD" })}）`}><select className={selectClass} value={form.deduction_type} onChange={(event) => field("deduction_type", event.target.value)} disabled={deduction <= 0}><option value="unclassified">尚未確認</option><option value="transfer_fee">匯費</option><option value="nhi">補充保費</option><option value="withholding_tax">扣繳稅</option><option value="other">其他</option></select></Label></>}
    <Label title="備註" wide><textarea className="textarea textarea-bordered min-h-20 w-full rounded-lg" value={form.note} onChange={(event) => field("note", event.target.value)} /></Label>
  </ModalFrame>;
}

export function CorporateActionModal({ modal, accounts, securities, holdings, saving, onClose, onSave }: { modal: Extract<InvestmentModal, { kind: "corporate_action" }>; accounts: InvestmentAccount[]; securities: InvestmentSecurity[]; holdings: InvestmentHolding[]; saving: boolean; onClose: () => void; onSave: Save }) {
  const row = modal.row;
  const defaultAccount = row?.account_id ?? accounts.find((item) => item.is_active)?.id ?? "";
  const defaultSecurity = row?.security_id ?? securities.find((item) => item.is_active)?.id ?? "";
  const holding = holdings.find((item) => item.account_id === defaultAccount && item.security_id === defaultSecurity);
  const [form, setForm] = useState<Record<string, string>>({ account_id: defaultAccount, security_id: defaultSecurity, action_type: row?.action_type ?? "capital_reduction", event_date: row?.event_date ?? today(), quantity_before: row ? String(row.quantity_before) : holding ? String(holding.quantity) : "", reduction_ratio_percent: row ? String(row.reduction_ratio * 100) : "", quantity_after: row ? String(row.quantity_after) : "", cash_return: row ? String(row.cash_return) : "", cost_adjustment: row ? String(row.cost_adjustment) : "", note: row?.note ?? "" });
  const currentHolding = useMemo(() => holdings.find((item) => item.account_id === form.account_id && item.security_id === form.security_id), [holdings, form.account_id, form.security_id]);
  const field = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const updateSelection = (key: "account_id" | "security_id", value: string) => setForm((current) => { const next = { ...current, [key]: value }; const match = holdings.find((item) => item.account_id === next.account_id && item.security_id === next.security_id); return { ...next, quantity_before: row ? next.quantity_before : match ? String(match.quantity) : "" }; });
  const calculatedAfter = Math.max(0, Number(form.quantity_before || 0) * (1 - Number(form.reduction_ratio_percent || 0) / 100));
  return <ModalFrame title={row ? "修改股權異動" : "新增股權異動"} subtitle="儲存前會檢查事件當日的持有股數" saving={saving} onClose={onClose} onSubmit={() => void onSave("corporate_action", { ...form, quantity_after: form.quantity_after || calculatedAfter }, row?.id)}>
    <Label title="券商帳戶"><AccountSelect value={form.account_id} onChange={(value) => updateSelection("account_id", value)} accounts={accounts} includeId={row?.account_id} /></Label><Label title="股票"><SecuritySelect value={form.security_id} onChange={(value) => updateSelection("security_id", value)} securities={securities} includeId={row?.security_id} /></Label>
    <Label title="異動類型"><select className={selectClass} value={form.action_type} onChange={(event) => field("action_type", event.target.value)}><option value="capital_reduction">現金減資</option><option value="loss_reduction">彌補虧損減資</option></select></Label><Label title="生效日期"><input type="date" className={inputClass} value={form.event_date} onChange={(event) => field("event_date", event.target.value)} /></Label>
    <Label title="減資前股數"><input type="number" min="0" step="0.000001" className={inputClass} value={form.quantity_before} onChange={(event) => field("quantity_before", event.target.value)} placeholder={currentHolding ? `目前 ${currentHolding.quantity}` : ""} /></Label><Label title="減資比率（%）"><input type="number" min="0" max="99.999999" step="0.000001" className={inputClass} value={form.reduction_ratio_percent} onChange={(event) => field("reduction_ratio_percent", event.target.value)} /></Label>
    <Label title="減資後股數"><input type="number" min="0" step="0.000001" className={inputClass} value={form.quantity_after} onChange={(event) => field("quantity_after", event.target.value)} placeholder={calculatedAfter ? `自動計算 ${calculatedAfter}` : ""} /></Label><Label title="實際退還金額"><input type="number" min="0" step="0.01" className={inputClass} value={form.cash_return} onChange={(event) => field("cash_return", event.target.value)} disabled={form.action_type === "loss_reduction"} /></Label>
    <Label title="成本調整金額"><input type="number" min="0" step="0.01" className={inputClass} value={form.cost_adjustment} onChange={(event) => field("cost_adjustment", event.target.value)} disabled={form.action_type === "loss_reduction"} /></Label><div className="rounded-lg bg-violet-50 p-3"><span className="text-xs font-bold text-violet-700">股數預覽</span><strong className="mt-1 block text-violet-900">{Number(form.quantity_before || 0).toLocaleString()} → {(Number(form.quantity_after) || calculatedAfter).toLocaleString()}</strong></div>
    <Label title="備註" wide><textarea className="textarea textarea-bordered min-h-20 w-full rounded-lg" value={form.note} onChange={(event) => field("note", event.target.value)} /></Label>
  </ModalFrame>;
}

export function MasterDataModal({ modal, saving, onClose, onSave }: { modal: Extract<InvestmentModal, { kind: "account" | "security" }>; saving: boolean; onClose: () => void; onSave: Save }) {
  const account = modal.kind === "account" ? modal.row : undefined; const security = modal.kind === "security" ? modal.row : undefined;
  const [form, setForm] = useState<Record<string, string | boolean>>(modal.kind === "account" ? { name: account?.name ?? "", broker: account?.broker ?? "", currency: account?.currency ?? "TWD", is_active: account?.is_active ?? true, note: account?.note ?? "" } : { symbol: security?.symbol ?? "", name: security?.name ?? "", market: security?.market ?? "TWSE", currency: security?.currency ?? "TWD", current_price: security?.current_price == null ? "" : String(security.current_price), current_price_date: security?.current_price_date ?? "", is_active: security?.is_active ?? true, note: security?.note ?? "" });
  const field = (key: string, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const id = account?.id ?? security?.id; const title = modal.kind === "account" ? (account ? "修改券商帳戶" : "新增券商帳戶") : (security ? "修改股票資料" : "新增股票資料");
  return <ModalFrame title={title} saving={saving} onClose={onClose} onSubmit={() => void onSave(modal.kind, form, id)}>
    {modal.kind === "account" ? <><Label title="帳戶名稱"><input className={inputClass} value={String(form.name)} onChange={(event) => field("name", event.target.value)} /></Label><Label title="券商"><input className={inputClass} value={String(form.broker)} onChange={(event) => field("broker", event.target.value)} /></Label></> : <><Label title="股票代號"><input className={`${inputClass} uppercase`} value={String(form.symbol)} onChange={(event) => field("symbol", event.target.value)} /></Label><Label title="股票名稱"><input className={inputClass} value={String(form.name)} onChange={(event) => field("name", event.target.value)} /></Label><Label title="市場"><select className={selectClass} value={String(form.market)} onChange={(event) => field("market", event.target.value)}><option value="TWSE">TWSE（台股上市）</option><option value="TPEx">TPEx（台股上櫃）</option><option value="US">US（美股）</option><option value="OTHER">OTHER（其他）</option></select></Label><Label title="目前股價（選填）"><input type="number" min="0" step="0.01" className={inputClass} value={String(form.current_price)} onChange={(event) => field("current_price", event.target.value)} /></Label><Label title="股價日期（選填）" wide><input type="date" className={inputClass} value={String(form.current_price_date)} onChange={(event) => field("current_price_date", event.target.value)} /></Label></>}
    <label className="flex items-center gap-2 text-sm font-bold text-slate-600"><input type="checkbox" className="checkbox checkbox-sm" checked={Boolean(form.is_active)} onChange={(event) => field("is_active", event.target.checked)} />啟用</label><Label title="備註" wide><textarea className="textarea textarea-bordered min-h-20 w-full rounded-lg" value={String(form.note)} onChange={(event) => field("note", event.target.value)} /></Label>
  </ModalFrame>;
}
