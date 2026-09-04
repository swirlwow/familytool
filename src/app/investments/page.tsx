"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, BriefcaseBusiness, Building2, Coins, Download, Landmark, Plus, RefreshCw, Search, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { WORKSPACE_ID } from "@/lib/appConfig";
import { toast } from "@/hooks/use-toast";
import type { InvestmentSecurity, InvestmentSnapshot, InvestmentTransactionType } from "@/lib/investments";
import { CorporateActionList, DividendList, HoldingsList, InvestmentSettings, TransactionList } from "@/components/investments/InvestmentLists";
import { CorporateActionModal, DividendModal, MasterDataModal, TransactionModal, type InvestmentModal } from "@/components/investments/InvestmentModals";

const EMPTY: InvestmentSnapshot = {
  accounts: [], securities: [], transactions: [], dividends: [], corporate_actions: [], holdings: [],
  summary: { cost_basis: 0, market_value: 0, realized_trade_profit: 0, dividend_income: 0, realized_profit: 0, unrealized_profit: 0 },
};
type Tab = "holdings" | "transactions" | "dividends" | "corporate_actions" | "settings";
const wholeMoney = (value: number | null, empty = "尚未更新") => value === null ? empty : new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(value);
const signedWholeMoney = (value: number | null) => value === null ? "—" : `${value >= 0 ? "+" : "−"}${wholeMoney(Math.abs(value))}`;

export default function InvestmentsPage() {
  const [snapshot, setSnapshot] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingPrices, setUpdatingPrices] = useState(false);
  const [tab, setTab] = useState<Tab>("holdings");
  const [modal, setModal] = useState<InvestmentModal | null>(null);
  const [query, setQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [securityFilter, setSecurityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<InvestmentTransactionType | "all">("all");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!WORKSPACE_ID) { setLoading(false); return; }
    setLoading(true);
    try {
      const response = await fetch(`/api/investments?workspace_id=${encodeURIComponent(WORKSPACE_ID)}`, { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "讀取失敗");
      setSnapshot(json.data);
    } catch (error) {
      toast({ variant: "destructive", title: "讀取股票資料失敗", description: error instanceof Error ? error.message : "請稍後再試" });
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const accountMap = useMemo(() => new Map(snapshot.accounts.map((row) => [row.id, row])), [snapshot.accounts]);
  const securityMap = useMemo(() => new Map(snapshot.securities.map((row) => [row.id, row])), [snapshot.securities]);
  const matches = useCallback((accountId: string, securityId: string, note?: string | null) => {
    const keyword = query.trim().toLowerCase(); const account = accountMap.get(accountId); const security = securityMap.get(securityId);
    return (accountFilter === "all" || accountId === accountFilter) && (securityFilter === "all" || securityId === securityFilter) && (!keyword || [account?.name, security?.symbol, security?.name, security?.market, note].some((value) => String(value ?? "").toLowerCase().includes(keyword)));
  }, [query, accountFilter, securityFilter, accountMap, securityMap]);
  const filteredHoldings = useMemo(() => snapshot.holdings.filter((row) => row.quantity > 0 && matches(row.account_id, row.security_id)), [snapshot.holdings, matches]);
  const filteredTransactions = useMemo(() => snapshot.transactions.filter((row) => row.transaction_type !== "dividend" && (typeFilter === "all" || row.transaction_type === typeFilter) && matches(row.account_id, row.security_id, row.note)), [snapshot.transactions, typeFilter, matches]);
  const filteredDividends = useMemo(() => snapshot.dividends.filter((row) => matches(row.account_id, row.security_id, row.note)), [snapshot.dividends, matches]);
  const filteredActions = useMemo(() => snapshot.corporate_actions.filter((row) => matches(row.account_id, row.security_id, row.note)), [snapshot.corporate_actions, matches]);
  const selectedPerformance = useMemo(() => {
    if (securityFilter === "all") return null;
    const security = securityMap.get(securityFilter);
    const rows = snapshot.holdings.filter((row) => row.security_id === securityFilter && (accountFilter === "all" || row.account_id === accountFilter));
    const quantity = rows.reduce((sum, row) => sum + row.quantity, 0);
    const costBasis = rows.reduce((sum, row) => sum + row.cost_basis, 0);
    const realizedTrade = rows.reduce((sum, row) => sum + row.realized_trade_profit, 0);
    const dividends = rows.reduce((sum, row) => sum + row.dividend_income, 0);
    const openRows = rows.filter((row) => row.quantity > 0);
    const marketValue = openRows.every((row) => row.market_value !== null) ? openRows.reduce((sum, row) => sum + Number(row.market_value), 0) : null;
    const unrealized = marketValue === null ? null : marketValue - costBasis;
    return { security, quantity, costBasis, marketValue, realizedTrade, dividends, unrealized, total: unrealized === null ? null : realizedTrade + dividends + unrealized };
  }, [accountFilter, securityFilter, securityMap, snapshot.holdings]);

  async function request(method: "POST" | "PATCH", resource: string, body: Record<string, unknown>) {
    if (!WORKSPACE_ID) throw new Error("缺少工作區設定");
    const response = await fetch("/api/investments", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace_id: WORKSPACE_ID, resource, ...body }) });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || "儲存失敗");
    return json.data;
  }
  async function saveRecord(resource: string, body: Record<string, unknown>, id?: string) {
    setSaving(true);
    try {
      let saveBody = body;
      if (resource === "transaction") {
        const transactionBody = { ...body };
        for (const key of ["security_mode", "new_security_symbol", "new_security_name", "new_security_market", "new_security_current_price", "new_security_current_price_date", "cost_mode"]) delete transactionBody[key];
        if (body.security_mode === "new") {
          const created = await request("POST", "security", { symbol: body.new_security_symbol, name: body.new_security_name, market: body.new_security_market, currency: "TWD", current_price: body.new_security_current_price, current_price_date: body.new_security_current_price_date, is_active: true, note: "" }) as InvestmentSecurity;
          transactionBody.security_id = created.id;
        }
        saveBody = transactionBody;
      }
      await request(id ? "PATCH" : "POST", resource, { ...saveBody, ...(id ? { id } : {}) });
      await load(); setModal(null); toast({ title: id ? "資料已更新" : "資料已新增" });
    } catch (error) {
      toast({ variant: "destructive", title: "儲存失敗", description: error instanceof Error ? error.message : "請稍後再試" });
    } finally { setSaving(false); }
  }
  async function remove(resource: string, id: string, label: string) {
    if (!WORKSPACE_ID || !window.confirm(`確定刪除「${label}」？\n刪除後會重新計算持股與損益。`)) return;
    try {
      const response = await fetch(`/api/investments?workspace_id=${encodeURIComponent(WORKSPACE_ID)}&resource=${resource}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = await response.json().catch(() => ({})); if (!response.ok) throw new Error(json.error || "刪除失敗");
      await load(); toast({ title: "已刪除並重新計算" });
    } catch (error) { toast({ variant: "destructive", title: "刪除失敗", description: error instanceof Error ? error.message : "請稍後再試" }); }
  }
  function download(format: "csv" | "json") {
    if (!WORKSPACE_ID) return; const link = document.createElement("a");
    link.href = `/api/investments/export?workspace_id=${encodeURIComponent(WORKSPACE_ID)}&format=${format}`;
    document.body.appendChild(link); link.click(); link.remove();
  }
  async function importCsv(file?: File) {
    if (!file || !WORKSPACE_ID) return; setSaving(true);
    try {
      const csv = await file.text(); const response = await fetch("/api/investments/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace_id: WORKSPACE_ID, csv }) });
      const json = await response.json().catch(() => ({})); if (!response.ok) throw new Error(json.error || "匯入失敗");
      await load(); toast({ title: `已匯入 ${json.imported} 筆交易` });
    } catch (error) { toast({ variant: "destructive", title: "匯入失敗", description: error instanceof Error ? error.message : "請檢查 CSV 格式" }); }
    finally { setSaving(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function updateHoldingPrices() {
    if (!WORKSPACE_ID) return;
    setUpdatingPrices(true);
    try {
      const response = await fetch("/api/investments/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace_id: WORKSPACE_ID }) });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "更新持股股價失敗");
      await load();
      const result = json.data ?? {};
      const skipped = Number(result.unavailable ?? 0) + Number(result.unsupported ?? 0) + Number(result.failed ?? 0);
      toast({ title: `已更新 ${Number(result.updated ?? 0)} 檔持股股價`, description: skipped > 0 ? `${skipped} 檔暫無官方收盤價或不支援自動更新` : "已採用官方最新收盤價" });
    } catch (error) {
      toast({ variant: "destructive", title: "更新持股股價失敗", description: error instanceof Error ? error.message : "請稍後再試" });
    } finally { setUpdatingPrices(false); }
  }

  const stats = [
    { label: "持有成本", value: wholeMoney(snapshot.summary.cost_basis), icon: WalletCards, color: "text-sky-600", bg: "bg-sky-50" },
    { label: "目前市值", value: wholeMoney(snapshot.summary.market_value), icon: BriefcaseBusiness, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "未實現損益", value: signedWholeMoney(snapshot.summary.unrealized_profit), icon: (snapshot.summary.unrealized_profit ?? 0) >= 0 ? TrendingUp : TrendingDown, color: (snapshot.summary.unrealized_profit ?? 0) >= 0 ? "text-rose-600" : "text-emerald-600", bg: (snapshot.summary.unrealized_profit ?? 0) >= 0 ? "bg-rose-50" : "bg-emerald-50" },
    { label: "已實現＋股利", value: signedWholeMoney(snapshot.summary.realized_profit), icon: Coins, color: snapshot.summary.realized_profit >= 0 ? "text-rose-600" : "text-emerald-600", bg: snapshot.summary.realized_profit >= 0 ? "bg-rose-50" : "bg-emerald-50" },
  ];
  const tabs: [Tab, string][] = [["holdings", "現有持股"], ["transactions", "交易紀錄"], ["dividends", "股利紀錄"], ["corporate_actions", "股權異動"], ["settings", "基本資料"]];

  return <main className="app-page"><div className="app-page-inner max-w-[1500px]">
    <header className="app-header"><div className="flex min-w-0 items-center gap-3"><span className="rounded-lg bg-indigo-50 p-2 text-indigo-600"><TrendingUp className="h-5 w-5" /></span><div className="min-w-0"><h1 className="truncate text-lg font-black text-slate-900 sm:text-xl">股票買賣管理</h1><p className="text-xs font-medium text-slate-500">獨立投資紀錄，不連動家庭帳務</p></div></div><div className="flex flex-wrap items-center justify-end gap-2"><button className="btn btn-sm rounded-lg border-slate-200 bg-white" onClick={() => void load()} aria-label="重新讀取"><RefreshCw className="h-4 w-4" /></button><button className="btn btn-sm rounded-lg border-slate-200 bg-white text-indigo-700" onClick={() => setModal({ kind: "account" })}><Landmark className="h-4 w-4" />帳戶</button><button className="btn btn-sm rounded-lg border-slate-200 bg-white text-indigo-700" onClick={() => setModal({ kind: "security" })}><Building2 className="h-4 w-4" />股票</button><button className="btn btn-sm rounded-lg border-0 bg-indigo-600 text-white" onClick={() => setModal({ kind: "transaction", transactionType: "buy" })}><Plus className="h-4 w-4" />新增交易</button></div></header>
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">{stats.map(({ label, value, icon: Icon, color, bg }) => <div key={label} className="app-panel flex items-center gap-3 p-4"><span className={`rounded-lg p-2.5 ${bg} ${color}`}><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className="text-xs font-bold text-slate-500">{label}</p><p className={`truncate text-lg font-black sm:text-xl ${color}`}>{loading ? "—" : value}</p></div></div>)}</section>
    <section className="app-panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-3 xl:flex-row xl:items-center xl:justify-between"><div className="flex w-full overflow-x-auto rounded-lg bg-slate-100 p-1 xl:w-auto">{tabs.map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`shrink-0 rounded-md px-4 py-2 text-sm font-bold transition ${tab === key ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}>{label}</button>)}</div><div className="flex flex-wrap gap-2">{tab === "holdings" && <button className="btn btn-sm rounded-lg border-sky-200 bg-sky-50 text-sky-700" onClick={() => void updateHoldingPrices()} disabled={updatingPrices || snapshot.holdings.length === 0}><RefreshCw className={`h-4 w-4 ${updatingPrices ? "animate-spin" : ""}`} />{updatingPrices ? "更新中" : "更新持股股價"}</button>}<button className="btn btn-sm rounded-lg border-0 bg-sky-600 text-white" onClick={() => setModal({ kind: "transaction", transactionType: "buy" })}><TrendingUp className="h-4 w-4" />新增買進</button><button className="btn btn-sm rounded-lg border-amber-200 bg-amber-50 text-amber-700" onClick={() => setModal({ kind: "transaction", transactionType: "sell" })}><TrendingDown className="h-4 w-4" />新增賣出</button><button className="btn btn-sm rounded-lg border-emerald-200 bg-emerald-50 text-emerald-700" onClick={() => setModal({ kind: "dividend" })}><Coins className="h-4 w-4" />新增股利</button><button className="btn btn-sm rounded-lg border-violet-200 bg-violet-50 text-violet-700" onClick={() => setModal({ kind: "corporate_action" })}>新增減資</button><input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(event) => void importCsv(event.target.files?.[0])} /><button className="btn btn-sm rounded-lg border-slate-200 bg-white" onClick={() => fileRef.current?.click()} disabled={saving}><ArrowUpFromLine className="h-4 w-4" />匯入 CSV</button><button className="btn btn-sm rounded-lg border-slate-200 bg-white" onClick={() => download("csv")}><ArrowDownToLine className="h-4 w-4" />匯出 CSV</button><button className="btn btn-sm rounded-lg border-slate-200 bg-white" onClick={() => download("json")}><Download className="h-4 w-4" />備份</button></div></div>
      {tab !== "settings" && <div className="grid gap-2 border-b border-slate-100 bg-slate-50/70 p-3 sm:grid-cols-2 xl:grid-cols-4"><label className="input input-sm flex items-center gap-2 rounded-lg border-slate-200 bg-white"><Search className="h-4 w-4 text-slate-400" /><input className="grow" placeholder="搜尋股票、代號或帳戶" value={query} onChange={(event) => setQuery(event.target.value)} /></label><select className="select select-sm rounded-lg border-slate-200 bg-white" value={securityFilter} onChange={(event) => setSecurityFilter(event.target.value)}><option value="all">全部股票</option>{snapshot.securities.map((row) => <option key={row.id} value={row.id}>{row.symbol} {row.name}</option>)}</select><select className="select select-sm rounded-lg border-slate-200 bg-white" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}><option value="all">全部券商帳戶</option>{snapshot.accounts.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>{tab === "transactions" && <select className="select select-sm rounded-lg border-slate-200 bg-white" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as InvestmentTransactionType | "all")}><option value="all">全部類型</option><option value="buy">買進</option><option value="sell">賣出</option></select>}</div>}
      {tab === "transactions" && selectedPerformance && <section className="border-b border-indigo-100 bg-indigo-50/45 p-4"><div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><div><p className="text-xs font-bold text-indigo-600">單股收益</p><h2 className="font-black text-slate-900">{selectedPerformance.security?.symbol} {selectedPerformance.security?.name}</h2></div><span className="text-xs text-slate-500">{accountFilter === "all" ? "全部券商帳戶" : accountMap.get(accountFilter)?.name}・持有 {new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 6 }).format(selectedPerformance.quantity)} 股</span></div><div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 xl:grid-cols-6">{[["持有成本", wholeMoney(selectedPerformance.costBasis), "text-slate-800"], ["目前市值", wholeMoney(selectedPerformance.marketValue), "text-indigo-700"], ["已實現交易", signedWholeMoney(selectedPerformance.realizedTrade), selectedPerformance.realizedTrade >= 0 ? "text-rose-600" : "text-emerald-600"], ["股利收益", signedWholeMoney(selectedPerformance.dividends), selectedPerformance.dividends >= 0 ? "text-rose-600" : "text-emerald-600"], ["未實現損益", signedWholeMoney(selectedPerformance.unrealized), (selectedPerformance.unrealized ?? 0) >= 0 ? "text-rose-600" : "text-emerald-600"], ["累計收益", signedWholeMoney(selectedPerformance.total), (selectedPerformance.total ?? 0) >= 0 ? "text-rose-600" : "text-emerald-600"]].map(([label, value, color]) => <div key={label} className="rounded-lg border border-white/80 bg-white/85 p-3"><small className="block text-slate-400">{label}</small><b className={color}>{value}</b></div>)}</div></section>}
      {loading ? <div className="app-empty"><span className="loading loading-spinner loading-md text-indigo-500" /></div> : tab === "holdings" ? <HoldingsList rows={filteredHoldings} onPrice={(securityId) => setModal({ kind: "security", row: snapshot.securities.find((row) => row.id === securityId) })} onManage={(holding) => { setAccountFilter(holding.account_id); setSecurityFilter(holding.security_id); setQuery(""); setTypeFilter("all"); setTab("transactions"); toast({ title: `已篩選 ${holding.symbol} 的交易與收益`, description: "可查看彙總收益，並修改或刪除來源交易。" }); }} /> : tab === "transactions" ? <TransactionList rows={filteredTransactions} accountMap={accountMap} securityMap={securityMap} onEdit={(row) => setModal({ kind: "transaction", row })} onDelete={(row) => void remove("transaction", row.id, `${securityMap.get(row.security_id)?.name ?? "交易"} ${row.trade_date}`)} /> : tab === "dividends" ? <DividendList rows={filteredDividends} accountMap={accountMap} securityMap={securityMap} onEdit={(row) => setModal({ kind: "dividend", row })} onDelete={(row) => void remove("dividend", row.id, `${securityMap.get(row.security_id)?.name ?? "股利"} ${row.ex_dividend_date}`)} /> : tab === "corporate_actions" ? <CorporateActionList rows={filteredActions} accountMap={accountMap} securityMap={securityMap} onEdit={(row) => setModal({ kind: "corporate_action", row })} onDelete={(row) => void remove("corporate_action", row.id, `${securityMap.get(row.security_id)?.name ?? "股權異動"} ${row.event_date}`)} /> : <InvestmentSettings accounts={snapshot.accounts} securities={snapshot.securities} holdings={snapshot.holdings} updatingPrices={updatingPrices} onUpdatePrices={() => void updateHoldingPrices()} onAccount={(row) => setModal({ kind: "account", row })} onSecurity={(row) => setModal({ kind: "security", row })} onDelete={(resource, id, label) => void remove(resource, id, label)} />}
    </section>
    {modal?.kind === "transaction" && <TransactionModal modal={modal} accounts={snapshot.accounts} securities={snapshot.securities} holdings={snapshot.holdings} saving={saving} onClose={() => setModal(null)} onSave={saveRecord} />}
    {modal?.kind === "dividend" && <DividendModal modal={modal} accounts={snapshot.accounts} securities={snapshot.securities} saving={saving} onClose={() => setModal(null)} onSave={saveRecord} />}
    {modal?.kind === "corporate_action" && <CorporateActionModal modal={modal} accounts={snapshot.accounts} securities={snapshot.securities} holdings={snapshot.holdings} saving={saving} onClose={() => setModal(null)} onSave={saveRecord} />}
    {(modal?.kind === "account" || modal?.kind === "security") && <MasterDataModal modal={modal} saving={saving} onClose={() => setModal(null)} onSave={saveRecord} />}
  </div></main>;
}
