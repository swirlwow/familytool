"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, BriefcaseBusiness, Building2, Coins, Download, Landmark, Pencil, Plus, RefreshCw, Search, Trash2, TrendingDown, TrendingUp, WalletCards, X } from "lucide-react";
import { WORKSPACE_ID } from "@/lib/appConfig";
import { toast } from "@/hooks/use-toast";
import type { InvestmentAccount, InvestmentSecurity, InvestmentSnapshot, InvestmentTransaction, InvestmentTransactionType } from "@/lib/investments";

const EMPTY: InvestmentSnapshot = { accounts: [], securities: [], transactions: [], holdings: [], summary: { cost_basis: 0, market_value: 0, realized_trade_profit: 0, dividend_income: 0, realized_profit: 0, unrealized_profit: 0 } };
const TYPE_META: Record<InvestmentTransactionType, { label: string; className: string }> = {
  buy: { label: "買進", className: "bg-sky-50 text-sky-700 border-sky-200" },
  sell: { label: "賣出", className: "bg-amber-50 text-amber-700 border-amber-200" },
  dividend: { label: "股利", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};
type Tab = "holdings" | "transactions" | "settings";
type Modal = { kind: "transaction"; row?: InvestmentTransaction } | { kind: "account"; row?: InvestmentAccount } | { kind: "security"; row?: InvestmentSecurity } | null;
const today = () => new Date().toISOString().slice(0, 10);
const money = (value: number | null, empty = "尚未更新") => value === null ? empty : new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(value);
const signedMoney = (value: number | null) => value === null ? "—" : `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`;
const numberText = (value: number) => new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 6 }).format(value);

export default function InvestmentsPage() {
  const [snapshot, setSnapshot] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("holdings");
  const [modal, setModal] = useState<Modal>(null);
  const [query, setQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<InvestmentTransactionType | "all">("all");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!WORKSPACE_ID) { setLoading(false); return; }
    setLoading(true);
    try {
      const response = await fetch(`/api/investments?workspace_id=${encodeURIComponent(WORKSPACE_ID)}`, { cache: "no-store" });
      const json = await response.json().catch(() => ({})); if (!response.ok) throw new Error(json.error || "讀取失敗");
      setSnapshot(json.data);
    } catch (error) { toast({ variant: "destructive", title: "讀取股票資料失敗", description: error instanceof Error ? error.message : "請稍後再試" }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const accountMap = useMemo(() => new Map(snapshot.accounts.map((row) => [row.id, row])), [snapshot.accounts]);
  const securityMap = useMemo(() => new Map(snapshot.securities.map((row) => [row.id, row])), [snapshot.securities]);
  const filteredHoldings = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return snapshot.holdings.filter((row) => row.quantity > 0 && (accountFilter === "all" || row.account_id === accountFilter) && (!keyword || [row.symbol, row.security_name, row.account_name, row.market].some((value) => value.toLowerCase().includes(keyword))));
  }, [snapshot.holdings, query, accountFilter]);
  const filteredTransactions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return snapshot.transactions.filter((row) => {
      const account = accountMap.get(row.account_id); const security = securityMap.get(row.security_id);
      return (accountFilter === "all" || row.account_id === accountFilter) && (typeFilter === "all" || row.transaction_type === typeFilter) && (!keyword || [account?.name, security?.symbol, security?.name, security?.market, row.note].some((value) => String(value ?? "").toLowerCase().includes(keyword)));
    });
  }, [snapshot.transactions, accountMap, securityMap, accountFilter, typeFilter, query]);

  async function request(method: "POST" | "PATCH", resource: string, body: Record<string, unknown>) {
    if (!WORKSPACE_ID) throw new Error("缺少工作區設定");
    const response = await fetch("/api/investments", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace_id: WORKSPACE_ID, resource, ...body }) });
    const json = await response.json().catch(() => ({})); if (!response.ok) throw new Error(json.error || "儲存失敗"); return json.data;
  }
  async function remove(resource: string, id: string, label: string) {
    if (!WORKSPACE_ID || !window.confirm(`確定刪除「${label}」？`)) return;
    try { const response = await fetch(`/api/investments?workspace_id=${encodeURIComponent(WORKSPACE_ID)}&resource=${resource}&id=${encodeURIComponent(id)}`, { method: "DELETE" }); const json = await response.json().catch(() => ({})); if (!response.ok) throw new Error(json.error || "刪除失敗"); await load(); toast({ title: "已刪除" }); }
    catch (error) { toast({ variant: "destructive", title: "刪除失敗", description: error instanceof Error ? error.message : "請稍後再試" }); }
  }
  function download(format: "csv" | "json") {
    if (!WORKSPACE_ID) return;
    const link = document.createElement("a");
    link.href = `/api/investments/export?workspace_id=${encodeURIComponent(WORKSPACE_ID)}&format=${format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  async function importCsv(file?: File) {
    if (!file || !WORKSPACE_ID) return; setSaving(true);
    try { const csv = await file.text(); const response = await fetch("/api/investments/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace_id: WORKSPACE_ID, csv }) }); const json = await response.json().catch(() => ({})); if (!response.ok) throw new Error(json.error || "匯入失敗"); await load(); toast({ title: `已匯入 ${json.imported} 筆交易` }); }
    catch (error) { toast({ variant: "destructive", title: "匯入失敗", description: error instanceof Error ? error.message : "請檢查 CSV 格式" }); }
    finally { setSaving(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  const stats = [
    { label: "持有成本", value: money(snapshot.summary.cost_basis), icon: WalletCards, color: "text-sky-600", bg: "bg-sky-50" },
    { label: "目前市值", value: money(snapshot.summary.market_value), icon: BriefcaseBusiness, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "未實現損益", value: signedMoney(snapshot.summary.unrealized_profit), icon: (snapshot.summary.unrealized_profit ?? 0) >= 0 ? TrendingUp : TrendingDown, color: (snapshot.summary.unrealized_profit ?? 0) >= 0 ? "text-rose-600" : "text-emerald-600", bg: (snapshot.summary.unrealized_profit ?? 0) >= 0 ? "bg-rose-50" : "bg-emerald-50" },
    { label: "已實現＋股利", value: signedMoney(snapshot.summary.realized_profit), icon: Coins, color: snapshot.summary.realized_profit >= 0 ? "text-rose-600" : "text-emerald-600", bg: snapshot.summary.realized_profit >= 0 ? "bg-rose-50" : "bg-emerald-50" },
  ];

  return <main className="app-page"><div className="app-page-inner max-w-[1500px]">
    <header className="app-header">
      <div className="flex min-w-0 items-center gap-3"><span className="rounded-lg bg-indigo-50 p-2 text-indigo-600"><TrendingUp className="h-5 w-5" /></span><div className="min-w-0"><h1 className="truncate text-lg font-black text-slate-900 sm:text-xl">股票買賣管理</h1><p className="text-xs font-medium text-slate-500">獨立投資紀錄，不連動家庭帳務</p></div></div>
      <div className="flex items-center gap-2"><button className="btn btn-sm rounded-lg border-slate-200 bg-white" onClick={() => void load()} aria-label="重新讀取"><RefreshCw className="h-4 w-4" /></button><button className="btn btn-sm rounded-lg border-0 bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setModal({ kind: "transaction" })}><Plus className="h-4 w-4" />新增交易</button></div>
    </header>

    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">{stats.map(({ label, value, icon: Icon, color, bg }) => <div key={label} className="app-panel flex items-center gap-3 p-4"><span className={`rounded-lg p-2.5 ${bg} ${color}`}><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className="text-xs font-bold text-slate-500">{label}</p><p className={`truncate text-lg font-black sm:text-xl ${color}`}>{loading ? "—" : value}</p></div></div>)}</section>

    <section className="app-panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex w-full rounded-lg bg-slate-100 p-1 lg:w-auto">{([['holdings','持有部位'],['transactions','交易紀錄'],['settings','基本資料']] as const).map(([key,label]) => <button key={key} onClick={() => setTab(key)} className={`flex-1 rounded-md px-4 py-2 text-sm font-bold transition lg:flex-none ${tab === key ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}>{label}</button>)}</div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(event) => void importCsv(event.target.files?.[0])} />
          <button className="btn btn-sm rounded-lg border-slate-200 bg-white" onClick={() => fileRef.current?.click()} disabled={saving}><ArrowUpFromLine className="h-4 w-4" />匯入 CSV</button>
          <button className="btn btn-sm rounded-lg border-slate-200 bg-white" onClick={() => download("csv")}><ArrowDownToLine className="h-4 w-4" />匯出 CSV</button>
          <button className="btn btn-sm rounded-lg border-slate-200 bg-white" onClick={() => download("json")}><Download className="h-4 w-4" />備份</button>
        </div>
      </div>

      {tab !== "settings" && <div className="grid gap-2 border-b border-slate-100 bg-slate-50/70 p-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]">
        <label className="input input-sm flex items-center gap-2 rounded-lg border-slate-200 bg-white"><Search className="h-4 w-4 text-slate-400" /><input className="grow" placeholder="搜尋股票、代號或帳戶" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        <select className="select select-sm rounded-lg border-slate-200 bg-white" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}><option value="all">全部券商帳戶</option>{snapshot.accounts.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
        {tab === "transactions" && <select className="select select-sm rounded-lg border-slate-200 bg-white" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as InvestmentTransactionType | "all")}><option value="all">全部類型</option><option value="buy">買進</option><option value="sell">賣出</option><option value="dividend">股利</option></select>}
      </div>}

      {loading ? <div className="app-empty"><span className="loading loading-spinner loading-md text-indigo-500" /></div> : tab === "holdings" ? <Holdings rows={filteredHoldings} onPrice={(securityId) => setModal({ kind: "security", row: snapshot.securities.find((row) => row.id === securityId) })} /> : tab === "transactions" ? <Transactions rows={filteredTransactions} accountMap={accountMap} securityMap={securityMap} onEdit={(row) => setModal({ kind: "transaction", row })} onDelete={(row) => void remove("transaction", row.id, `${securityMap.get(row.security_id)?.name ?? "交易"} ${row.trade_date}`)} /> : <Settings accounts={snapshot.accounts} securities={snapshot.securities} onAccount={(row) => setModal({ kind: "account", row })} onSecurity={(row) => setModal({ kind: "security", row })} onDelete={(resource, id, label) => void remove(resource, id, label)} />}
    </section>
    {modal && <RecordModal modal={modal} accounts={snapshot.accounts} securities={snapshot.securities} saving={saving} onClose={() => setModal(null)} onSave={async (resource, body, id) => { setSaving(true); try { await request(id ? "PATCH" : "POST", resource, { ...body, ...(id ? { id } : {}) }); await load(); setModal(null); toast({ title: id ? "資料已更新" : "資料已新增" }); } catch (error) { toast({ variant: "destructive", title: "儲存失敗", description: error instanceof Error ? error.message : "請稍後再試" }); } finally { setSaving(false); } }} />}
  </div></main>;
}

function Holdings({ rows, onPrice }: { rows: InvestmentSnapshot["holdings"]; onPrice: (id: string) => void }) {
  if (!rows.length) return <div className="app-empty"><BriefcaseBusiness className="mx-auto mb-2 h-8 w-8 text-slate-300" /><p>尚無持有部位</p><p className="mt-1 text-xs">先建立券商帳戶與股票，再新增買進紀錄。</p></div>;
  return <><div className="hidden overflow-x-auto md:block"><table className="table"><thead><tr><th>股票</th><th>券商帳戶</th><th className="text-right">持有股數</th><th className="text-right">平均成本</th><th className="text-right">目前股價</th><th className="text-right">市值</th><th className="text-right">未實現損益</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.key}><td><strong>{row.symbol} {row.security_name}</strong><div className="text-xs text-slate-400">{row.market}</div></td><td>{row.account_name}<div className="text-xs text-slate-400">{row.broker}</div></td><td className="text-right font-mono">{numberText(row.quantity)}</td><td className="text-right font-mono">{money(row.average_cost)}</td><td className="text-right font-mono">{row.current_price === null ? "未更新" : money(row.current_price)}<div className="text-[10px] text-slate-400">{row.current_price_date}</div></td><td className="text-right font-bold">{money(row.market_value)}</td><td className={`text-right font-black ${(row.unrealized_profit ?? 0) >= 0 ? "text-rose-600" : "text-emerald-600"}`}>{signedMoney(row.unrealized_profit)}</td><td><button className="btn btn-ghost btn-xs" onClick={() => onPrice(row.security_id)}>更新股價</button></td></tr>)}</tbody></table></div><div className="divide-y divide-slate-100 md:hidden">{rows.map((row) => <article key={row.key} className="p-4"><div className="flex justify-between gap-3"><div><strong>{row.symbol} {row.security_name}</strong><p className="text-xs text-slate-400">{row.account_name}・{row.market}</p></div><button className="btn btn-ghost btn-xs" onClick={() => onPrice(row.security_id)}>股價</button></div><div className="mt-3 grid grid-cols-2 gap-2 text-sm"><span>持有 <b>{numberText(row.quantity)}</b></span><span>均價 <b>{money(row.average_cost)}</b></span><span>市值 <b>{money(row.market_value)}</b></span><span className={(row.unrealized_profit ?? 0) >= 0 ? "text-rose-600" : "text-emerald-600"}>損益 <b>{signedMoney(row.unrealized_profit)}</b></span></div></article>)}</div></>;
}

function Transactions({ rows, accountMap, securityMap, onEdit, onDelete }: { rows: InvestmentTransaction[]; accountMap: Map<string, InvestmentAccount>; securityMap: Map<string, InvestmentSecurity>; onEdit: (row: InvestmentTransaction) => void; onDelete: (row: InvestmentTransaction) => void }) {
  if (!rows.length) return <div className="app-empty">尚無符合條件的交易紀錄</div>;
  return <div className="divide-y divide-slate-100">{rows.map((row) => { const security = securityMap.get(row.security_id); const account = accountMap.get(row.account_id); const amount = row.transaction_type === "dividend" ? row.cash_amount : row.quantity * row.price; return <article key={row.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-black ${TYPE_META[row.transaction_type].className}`}>{TYPE_META[row.transaction_type].label}</span><div className="min-w-0"><strong className="block truncate text-slate-900">{security?.symbol} {security?.name}</strong><p className="truncate text-xs text-slate-500">{row.trade_date}・{account?.name}{row.note ? `・${row.note}` : ""}</p></div></div><div className="grid grid-cols-2 gap-x-5 text-sm sm:flex sm:items-center"><span className="text-slate-500">{row.transaction_type === "dividend" ? "股利" : `${numberText(row.quantity)} 股 × ${money(row.price)}`}</span><strong className="text-right">{money(amount)}</strong><span className="text-xs text-slate-400">費稅 {money(row.fee + row.tax)}</span><span className="flex justify-end gap-1"><button className="btn btn-ghost btn-xs" onClick={() => onEdit(row)}><Pencil className="h-3.5 w-3.5" /></button><button className="btn btn-ghost btn-xs text-rose-500" onClick={() => onDelete(row)}><Trash2 className="h-3.5 w-3.5" /></button></span></div></article>; })}</div>;
}

function Settings({ accounts, securities, onAccount, onSecurity, onDelete }: { accounts: InvestmentAccount[]; securities: InvestmentSecurity[]; onAccount: (row?: InvestmentAccount) => void; onSecurity: (row?: InvestmentSecurity) => void; onDelete: (resource: string, id: string, label: string) => void }) {
  return <div className="grid gap-4 p-4 xl:grid-cols-2"><section className="rounded-lg border border-slate-200"><div className="app-panel-header"><div><h2 className="font-black text-slate-800">券商帳戶</h2><p className="text-xs text-slate-400">股票交易使用的帳戶</p></div><button className="btn btn-sm rounded-lg border-0 bg-indigo-600 text-white" onClick={() => onAccount()}><Plus className="h-4 w-4" />新增</button></div><div className="divide-y divide-slate-100">{accounts.length ? accounts.map((row) => <div key={row.id} className="flex items-center gap-3 p-3"><span className="rounded-lg bg-indigo-50 p-2 text-indigo-600"><Landmark className="h-4 w-4" /></span><div className="min-w-0 flex-1"><strong className="block truncate">{row.name}</strong><span className="text-xs text-slate-400">{row.broker || "未填券商"}・{row.is_active ? "啟用" : "停用"}</span></div><button className="btn btn-ghost btn-xs" onClick={() => onAccount(row)}><Pencil className="h-3.5 w-3.5" /></button><button className="btn btn-ghost btn-xs text-rose-500" onClick={() => onDelete("account", row.id, row.name)}><Trash2 className="h-3.5 w-3.5" /></button></div>) : <div className="app-empty">尚未建立券商帳戶</div>}</div></section><section className="rounded-lg border border-slate-200"><div className="app-panel-header"><div><h2 className="font-black text-slate-800">股票基本資料</h2><p className="text-xs text-slate-400">代號、名稱與手動股價</p></div><button className="btn btn-sm rounded-lg border-0 bg-indigo-600 text-white" onClick={() => onSecurity()}><Plus className="h-4 w-4" />新增</button></div><div className="divide-y divide-slate-100">{securities.length ? securities.map((row) => <div key={row.id} className="flex items-center gap-3 p-3"><span className="rounded-lg bg-sky-50 p-2 text-sky-600"><Building2 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><strong className="block truncate">{row.symbol} {row.name}</strong><span className="text-xs text-slate-400">{row.market}・{row.current_price === null ? "股價未更新" : `${money(row.current_price)}｜${row.current_price_date ?? "未填日期"}`}</span></div><button className="btn btn-ghost btn-xs" onClick={() => onSecurity(row)}><Pencil className="h-3.5 w-3.5" /></button><button className="btn btn-ghost btn-xs text-rose-500" onClick={() => onDelete("security", row.id, `${row.symbol} ${row.name}`)}><Trash2 className="h-3.5 w-3.5" /></button></div>) : <div className="app-empty">尚未建立股票資料</div>}</div></section></div>;
}

function RecordModal({ modal, accounts, securities, saving, onClose, onSave }: { modal: Exclude<Modal, null>; accounts: InvestmentAccount[]; securities: InvestmentSecurity[]; saving: boolean; onClose: () => void; onSave: (resource: string, body: Record<string, unknown>, id?: string) => Promise<void> }) {
  const isTx = modal.kind === "transaction"; const tx = isTx ? modal.row : undefined; const account = modal.kind === "account" ? modal.row : undefined; const security = modal.kind === "security" ? modal.row : undefined;
  const initialForm = (isTx ? { transaction_type: tx?.transaction_type ?? "buy", trade_date: tx?.trade_date ?? today(), account_id: tx?.account_id ?? accounts.find((r) => r.is_active)?.id ?? "", security_id: tx?.security_id ?? securities.find((r) => r.is_active)?.id ?? "", quantity: tx?.quantity ? String(tx.quantity) : "", price: tx?.price ? String(tx.price) : "", fee: tx?.fee ? String(tx.fee) : "", tax: tx?.tax ? String(tx.tax) : "", cash_amount: tx?.cash_amount ? String(tx.cash_amount) : "", note: tx?.note ?? "" } : modal.kind === "account" ? { name: account?.name ?? "", broker: account?.broker ?? "", currency: account?.currency ?? "TWD", is_active: account?.is_active ?? true, note: account?.note ?? "" } : { symbol: security?.symbol ?? "", name: security?.name ?? "", market: security?.market ?? "TWSE", currency: security?.currency ?? "TWD", current_price: security?.current_price == null ? "" : String(security.current_price), current_price_date: security?.current_price_date ?? today(), is_active: security?.is_active ?? true, note: security?.note ?? "" }) as Record<string, string | boolean>;
  const [form, setForm] = useState<Record<string, string | boolean>>(initialForm);
  const field = (key: string, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const type = String(form.transaction_type) as InvestmentTransactionType;
  const title = isTx ? (tx ? "修改交易" : "新增交易") : modal.kind === "account" ? (account ? "修改券商帳戶" : "新增券商帳戶") : (security ? "修改股票資料" : "新增股票資料");
  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/35 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3"><h2 className="text-lg font-black text-slate-900">{title}</h2><button className="btn btn-ghost btn-sm" onClick={onClose}><X className="h-5 w-5" /></button></div><div className="grid gap-4 p-4 sm:grid-cols-2">
    {isTx ? <><label><span className="mb-1 block text-xs font-bold text-slate-500">交易類型</span><select className="select select-bordered w-full rounded-lg" value={type} onChange={(e) => field("transaction_type", e.target.value)}><option value="buy">買進</option><option value="sell">賣出</option><option value="dividend">股利</option></select></label><label><span className="mb-1 block text-xs font-bold text-slate-500">日期</span><input type="date" className="input input-bordered w-full rounded-lg" value={String(form.trade_date)} onChange={(e) => field("trade_date", e.target.value)} /></label><label><span className="mb-1 block text-xs font-bold text-slate-500">券商帳戶</span><select className="select select-bordered w-full rounded-lg" value={String(form.account_id)} onChange={(e) => field("account_id", e.target.value)}><option value="">請選擇</option>{accounts.filter((r) => r.is_active || r.id === tx?.account_id).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label><span className="mb-1 block text-xs font-bold text-slate-500">股票</span><select className="select select-bordered w-full rounded-lg" value={String(form.security_id)} onChange={(e) => field("security_id", e.target.value)}><option value="">請選擇</option>{securities.filter((r) => r.is_active || r.id === tx?.security_id).map((r) => <option key={r.id} value={r.id}>{r.symbol} {r.name}</option>)}</select></label>{type === "dividend" ? <label className="sm:col-span-2"><span className="mb-1 block text-xs font-bold text-slate-500">股利金額</span><input type="number" min="0" step="0.01" className="input input-bordered w-full rounded-lg" value={String(form.cash_amount)} onChange={(e) => field("cash_amount", e.target.value)} /></label> : <><label><span className="mb-1 block text-xs font-bold text-slate-500">股數</span><input type="number" min="0" step="0.000001" className="input input-bordered w-full rounded-lg" value={String(form.quantity)} onChange={(e) => field("quantity", e.target.value)} /></label><label><span className="mb-1 block text-xs font-bold text-slate-500">成交價</span><input type="number" min="0" step="0.000001" className="input input-bordered w-full rounded-lg" value={String(form.price)} onChange={(e) => field("price", e.target.value)} /></label></>}<label><span className="mb-1 block text-xs font-bold text-slate-500">手續費</span><input type="number" min="0" step="0.01" className="input input-bordered w-full rounded-lg" value={String(form.fee)} onChange={(e) => field("fee", e.target.value)} /></label><label><span className="mb-1 block text-xs font-bold text-slate-500">交易稅</span><input type="number" min="0" step="0.01" className="input input-bordered w-full rounded-lg" value={String(form.tax)} onChange={(e) => field("tax", e.target.value)} /></label></> : modal.kind === "account" ? <><label><span className="mb-1 block text-xs font-bold text-slate-500">帳戶名稱</span><input className="input input-bordered w-full rounded-lg" value={String(form.name)} onChange={(e) => field("name", e.target.value)} placeholder="例如：富邦證券" /></label><label><span className="mb-1 block text-xs font-bold text-slate-500">券商</span><input className="input input-bordered w-full rounded-lg" value={String(form.broker)} onChange={(e) => field("broker", e.target.value)} /></label></> : <><label><span className="mb-1 block text-xs font-bold text-slate-500">股票代號</span><input className="input input-bordered w-full rounded-lg uppercase" value={String(form.symbol)} onChange={(e) => field("symbol", e.target.value)} placeholder="2330" /></label><label><span className="mb-1 block text-xs font-bold text-slate-500">股票名稱</span><input className="input input-bordered w-full rounded-lg" value={String(form.name)} onChange={(e) => field("name", e.target.value)} placeholder="台積電" /></label><label><span className="mb-1 block text-xs font-bold text-slate-500">市場</span><select className="select select-bordered w-full rounded-lg" value={String(form.market)} onChange={(e) => field("market", e.target.value)}><option>TWSE</option><option>TPEx</option><option>US</option><option>OTHER</option></select></label><label><span className="mb-1 block text-xs font-bold text-slate-500">目前股價</span><input type="number" min="0" step="0.000001" className="input input-bordered w-full rounded-lg" value={String(form.current_price)} onChange={(e) => field("current_price", e.target.value)} /></label><label className="sm:col-span-2"><span className="mb-1 block text-xs font-bold text-slate-500">股價日期</span><input type="date" className="input input-bordered w-full rounded-lg" value={String(form.current_price_date)} onChange={(e) => field("current_price_date", e.target.value)} /></label></>}
    {!isTx && <label className="flex items-center gap-2 text-sm font-bold text-slate-600"><input type="checkbox" className="checkbox checkbox-sm" checked={Boolean(form.is_active)} onChange={(e) => field("is_active", e.target.checked)} />啟用</label>}<label className="sm:col-span-2"><span className="mb-1 block text-xs font-bold text-slate-500">備註</span><textarea className="textarea textarea-bordered min-h-20 w-full rounded-lg" value={String(form.note)} onChange={(e) => field("note", e.target.value)} /></label>
  </div><div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3"><button className="btn btn-ghost rounded-lg" onClick={onClose}>取消</button><button className="btn rounded-lg border-0 bg-indigo-600 px-6 text-white hover:bg-indigo-700" disabled={saving} onClick={() => void onSave(modal.kind, form, isTx ? tx?.id : modal.kind === "account" ? account?.id : security?.id)}>{saving && <span className="loading loading-spinner loading-sm" />}儲存</button></div></div></div>;
}
