// src/app/bills/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WORKSPACE_ID } from "@/lib/appConfig";
import { BillTemplateManager } from "@/components/bills/BillTemplateManager";
import {
  Receipt,
  Calendar,
  Plus,
  Trash2,
  CreditCard,
  Clock,
  RefreshCw,
  Wallet,
  CheckCircle2,
  FilePenLine,
  LayoutList,
  Settings2,
  ChevronDown
} from "lucide-react";

type BillInstance = {
  id: string;
  period: string;
  due_date: string | null;
  name_snapshot: string;
  amount_due: number | null;
  paid_total: number;
  status: "awaiting_details" | "unpaid" | "partial" | "paid" | string;
  source: "manual" | "template";
  payment_mode: "ledger" | "status_only";
  paid_at?: string | null;
  billing_start?: string | null;
  billing_end?: string | null;
  created_at?: string;
};

type PayMethod = { id: string; name: string };
type Payer = { id: string; name: string };
type Category = { id: string; name: string; group_name?: string | null; sort_order?: number };

type SplitRow = { payer_id: string; amount: number };

function n(v: unknown) { const x = Number(v); return Number.isFinite(x) ? x : 0; }
function round2(v: number) { return Math.round((v + Number.EPSILON) * 100) / 100; }
function ymNow() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function todayStr() { const d = new Date(); const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; }
function monthRange(ym: string) { const [y, m] = ym.split("-").map(Number); const from = `${y}-${String(m).padStart(2, "0")}-01`; const lastDay = new Date(y, m, 0).getDate(); const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`; return { from, to }; }
function statusBadge(s: string) {
  const v = String(s || "");
  if (v === "paid") return "badge bg-emerald-100 text-emerald-600 border-none font-bold";
  if (v === "partial") return "badge bg-amber-100 text-amber-600 border-none font-bold";
  if (v === "awaiting_details") return "badge bg-sky-100 text-sky-700 border-none font-bold";
  return "badge bg-slate-100 text-slate-500 border-none font-bold";
}

function statusLabel(status: string) {
  if (status === "paid") return "已繳";
  if (status === "partial") return "部分付款";
  if (status === "awaiting_details") return "待填資料";
  return "待付款";
}

export default function BillsPage() {
  const router = useRouter();
  const [view, setView] = useState<"bills" | "templates">("bills");

  const [ym, setYm] = useState(ymNow());
  const { from, to } = useMemo(() => monthRange(ym), [ym]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<BillInstance[]>([]);
  const [detailing, setDetailing] = useState<BillInstance | null>(null);
  const [detailForm, setDetailForm] = useState({ amount_due: "", due_date: "" });
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  const [payMethods, setPayMethods] = useState<PayMethod[]>([]);
  const [payers, setPayers] = useState<Payer[]>([]);
  const [catsExpense, setCatsExpense] = useState<Category[]>([]);

  const catGroups = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of catsExpense) {
      const g = (c.group_name || "").trim();
      if (!g) continue;
      const so = n(c.sort_order);
      if (!map.has(g)) map.set(g, so);
      else map.set(g, Math.min(map.get(g)!, so));
    }
    return Array.from(map.entries()).sort((a, b) => a[1] - b[1]).map(([g]) => g);
  }, [catsExpense]);

  const [newBill, setNewBill] = useState({
    name_snapshot: "",
    due_date: todayStr(),
    amount_due: 0,
    billing_start: "",
    billing_end: "",
  });

  const [paying, setPaying] = useState<BillInstance | null>(null);
  const [payForm, setPayForm] = useState({
    entry_date: todayStr(),
    pay_amount: 0,
    payer_id: "",
    pay_method: "",
    merchant: "",
    note: "",
    category_group: "",
    category_id: "",
    useSplit: false,
    splits: [] as SplitRow[],
  });

  const loadBills = useCallback(async () => {
    if (!WORKSPACE_ID) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bills?workspace_id=${WORKSPACE_ID}&ym=${ym}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "讀取失敗");
      setRows(Array.isArray(j?.data) ? j.data : []);
    } catch (e: any) { setError(e.message); setRows([]); } finally { setLoading(false); }
  }, [ym]);

  async function loadPayMethods() {
    if (!WORKSPACE_ID) return;
    const res = await fetch(`/api/payment-methods?workspace_id=${WORKSPACE_ID}`, { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    setPayMethods(Array.isArray(j?.data) ? j.data : []);
  }

  async function loadPayers() {
    if (!WORKSPACE_ID) return;
    const res = await fetch(`/api/payers?workspace_id=${WORKSPACE_ID}`, { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    setPayers(Array.isArray(j?.data) ? j.data : []);
  }

  async function loadExpenseCats() {
    if (!WORKSPACE_ID) return;
    const res = await fetch(`/api/categories?workspace_id=${WORKSPACE_ID}&type=expense`, { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    setCatsExpense(Array.isArray(j?.data) ? j.data : []);
  }

  useEffect(() => { void loadBills(); }, [loadBills]);
  useEffect(() => { loadPayMethods(); loadPayers(); loadExpenseCats(); }, []);

  useEffect(() => {
    if (!payForm.useSplit) return;
    if (!payForm.payer_id) return;
    const other = payers.find((p) => p.id !== payForm.payer_id)?.id || "";
    if (!other) return;
    setPayForm((prev) => {
      if (!prev.splits || prev.splits.length === 0) return { ...prev, splits: [{ payer_id: other, amount: 0 }] };
      return { ...prev, splits: prev.splits.map((s) => ({ ...s, payer_id: s.payer_id === prev.payer_id ? other : s.payer_id })) };
    });
  }, [payForm.payer_id, payForm.useSplit, payers]);

  const paySubcats = useMemo(() => {
    const g = (payForm.category_group || "").trim();
    if (!g) return [];
    return catsExpense.filter((c) => (c.group_name || "").trim() === g).slice().sort((a, b) => n(a.sort_order) - n(b.sort_order) || a.name.localeCompare(b.name, "zh-Hant"));
  }, [catsExpense, payForm.category_group]);

  async function createBill() {
    if (!WORKSPACE_ID) return alert("未設定 WORKSPACE_ID");
    if (!newBill.name_snapshot.trim()) return alert("請輸入帳單名稱");
    const amt = round2(n(newBill.amount_due));
    if (!amt || amt <= 0) return alert("金額需大於 0");
    if (!newBill.due_date) return alert("請選擇到期日");

    const res = await fetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        workspace_id: WORKSPACE_ID,
        period: ym,
        name_snapshot: newBill.name_snapshot.trim(),
        due_date: newBill.due_date,
        amount_due: amt,
        billing_start: newBill.billing_start || null,
        billing_end: newBill.billing_end || null,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return alert(j?.error || "新增失敗");
    setNewBill({ name_snapshot: "", due_date: todayStr(), amount_due: 0, billing_start: "", billing_end: "" });
    await loadBills();
  }

  async function deleteBill(b: BillInstance) {
    if (!WORKSPACE_ID) return;
    if (!confirm(`確定刪除帳單？\n${b.name_snapshot}\n${b.due_date || "尚未填日期"} 金額 ${b.amount_due ?? "尚未填寫"}`)) return;
    const res = await fetch("/api/bills", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace_id: WORKSPACE_ID, id: b.id }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return alert(j?.error || "刪除失敗");
    await loadBills();
  }

  function openDetails(b: BillInstance) {
    setDetailing(b);
    setDetailForm({
      amount_due: b.amount_due == null ? "" : String(b.amount_due),
      due_date: b.due_date || "",
    });
  }

  async function saveDetails() {
    if (!WORKSPACE_ID || !detailing) return;
    const amount = round2(n(detailForm.amount_due));
    if (amount <= 0) return alert("請填寫大於 0 的金額");
    if (!detailForm.due_date) return alert("請選擇到期日");

    const response = await fetch("/api/bills", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: WORKSPACE_ID,
        id: detailing.id,
        amount_due: amount,
        due_date: detailForm.due_date,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return alert(payload?.error || "更新帳單失敗");
    setDetailing(null);
    await loadBills();
  }

  async function markPaid(b: BillInstance) {
    if (!WORKSPACE_ID) return;
    if (!b.amount_due || b.amount_due <= 0) return openDetails(b);
    if (!confirm(`將「${b.name_snapshot}」標記為已繳？\n此操作不會新增記帳紀錄。`)) return;

    setMarkingPaidId(b.id);
    try {
      const response = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_paid",
          workspace_id: WORKSPACE_ID,
          bill_instance_id: b.id,
          paid_at: todayStr(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return alert(payload?.error || "標記已繳失敗");
      await loadBills();
    } finally {
      setMarkingPaidId(null);
    }
  }

  function openPay(b: BillInstance) {
    setPaying(b);
    const remain = round2(n(b.amount_due) - n(b.paid_total));
    setPayForm({
      entry_date: todayStr(),
      pay_amount: remain > 0 ? remain : 0,
      payer_id: "",
      pay_method: "",
      merchant: "",
      note: "",
      category_group: catGroups[0] || "",
      category_id: "",
      useSplit: false,
      splits: [],
    });
  }

  async function payToLedger() {
    if (!WORKSPACE_ID || !paying) return;
    if (!payForm.entry_date) return alert("請選擇付款日期");
    const amt = round2(n(payForm.pay_amount));
    if (!amt || amt <= 0) return alert("付款金額需大於 0");
    if (!payForm.payer_id) return alert("請選擇付款人");

    if (payForm.useSplit) {
      if (!payForm.splits.length) return alert("請至少新增一筆分帳");
      let sum = 0;
      for (const s of payForm.splits) {
        if (!s.payer_id) return alert("分帳：請選擇應付者");
        if (s.payer_id === payForm.payer_id) return alert("分帳：應付者不可等於付款人");
        const a = round2(n(s.amount));
        if (!a || a <= 0) return alert("分帳：金額需大於 0");
        sum += a;
      }
      if (round2(sum) > amt) return alert("分帳：應付總和不可大於付款金額");
    }

    const res = await fetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "pay_to_ledger",
        workspace_id: WORKSPACE_ID,
        bill_instance_id: paying.id,
        entry_date: payForm.entry_date,
        pay_amount: amt,
        payer_id: payForm.payer_id,
        pay_method: payForm.pay_method || null,
        merchant: payForm.merchant || null,
        note: payForm.note || null,
        category_id: payForm.category_id || null,
        splits: payForm.useSplit ? payForm.splits : [],
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return alert(j?.error || "付款寫入記帳失敗");
    setPaying(null);
    await loadBills();
    alert("已寫入記帳，並更新帳單已付金額/狀態");
  }

  const summary = useMemo(() => {
    const due = rows.reduce((a, r) => a + n(r.amount_due), 0);
    const paid = rows.reduce((a, r) => a + n(r.paid_total), 0);
    const remain = round2(due - paid);
    const awaiting = rows.filter((row) => row.status === "awaiting_details").length;
    return { due, paid, remain, awaiting };
  }, [rows]);

  function billActions(b: BillInstance) {
    const due = round2(n(b.amount_due));
    const paid = round2(n(b.paid_total));
    const remain = round2(due - paid);
    const needsDetails = b.status === "awaiting_details" || !b.due_date || due <= 0;

    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {needsDetails ? (
          <button className="btn btn-sm rounded-lg border-none bg-sky-600 text-white hover:bg-sky-700" onClick={() => openDetails(b)}>
            <FilePenLine className="h-4 w-4" />
            填寫資料
          </button>
        ) : b.payment_mode === "status_only" ? (
          <button
            className="btn btn-sm rounded-lg border-none bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => void markPaid(b)}
            disabled={b.status === "paid" || markingPaidId === b.id}
          >
            <CheckCircle2 className="h-4 w-4" />
            {b.status === "paid" ? "已繳" : "標記已繳"}
          </button>
        ) : (
          <button className="btn btn-sm rounded-lg border-none bg-rose-500 text-white hover:bg-rose-600" onClick={() => openPay(b)} disabled={remain <= 0}>
            <CreditCard className="h-4 w-4" />
            付款
          </button>
        )}
        <button className="btn btn-ghost btn-sm rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500" onClick={() => void deleteBill(b)} title="刪除">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <main data-theme="light" className="min-h-screen bg-slate-50 px-3 py-3 pb-24 sm:px-4 md:px-6 md:py-5 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">

        <div className="sticky top-0 z-40 rounded-lg border border-slate-200 bg-white/95 shadow-sm backdrop-blur-md">
          <div className="flex min-h-14 flex-row items-center justify-between gap-3 px-3 py-2 sm:px-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-rose-100 bg-rose-50 p-2 text-rose-500">
                <Receipt className="w-5 h-5" />
              </div>
              <h1 className="text-base font-black text-slate-800 sm:text-lg">帳單管理</h1>
            </div>

            <button className="btn btn-ghost btn-sm h-9 min-h-0 rounded-lg font-bold text-slate-500 hover:bg-slate-100" onClick={() => router.push("/")}>回首頁</button>
          </div>
          {!WORKSPACE_ID && (
            <div className="px-4 pb-3">
              <div className="alert alert-warning rounded-lg py-3 text-sm"><span>未設定 WORKSPACE_ID（請檢查 .env.local）</span></div>
            </div>
          )}
        </div>

        <div className="grid w-full grid-cols-2 rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:w-fit sm:min-w-64">
          <button
            type="button"
            className={`btn btn-sm flex-1 rounded-lg border-none sm:flex-none ${view === "bills" ? "bg-slate-800 text-white hover:bg-slate-800" : "btn-ghost text-slate-500"}`}
            onClick={() => setView("bills")}
          >
            <LayoutList className="h-4 w-4" />
            帳單
          </button>
          <button
            type="button"
            className={`btn btn-sm flex-1 rounded-lg border-none sm:flex-none ${view === "templates" ? "bg-slate-800 text-white hover:bg-slate-800" : "btn-ghost text-slate-500"}`}
            onClick={() => setView("templates")}
          >
            <Settings2 className="h-4 w-4" />
            固定帳單
          </button>
        </div>

        {view === "bills" ? (
          <>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-bold text-slate-500">查看月份</span>
              </div>
              <input type="month" className="input input-bordered h-10 min-h-0 w-full rounded-lg border-slate-200 bg-slate-50 font-bold focus:border-rose-500" value={ym} onChange={(e) => setYm(e.target.value)} />
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                <span>{from} ~ {to}</span>
                <button className="btn btn-ghost btn-xs h-7 min-h-0 rounded-lg px-2 font-bold text-rose-500 hover:bg-rose-50 hover:text-rose-600" onClick={loadBills} disabled={loading} title="重新載入">
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> <span className="sr-only">重新載入</span>
                </button>
              </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="grid h-full grid-cols-2 sm:grid-cols-4">
                <div className="flex min-h-20 flex-col justify-center px-4 py-3">
                  <div className="mb-1 text-xs font-bold text-slate-400">應繳</div>
                  <div className="text-xl font-black tabular-nums text-slate-800">${summary.due.toLocaleString()}</div>
                </div>
                <div className="flex min-h-20 flex-col justify-center border-l border-slate-100 px-4 py-3">
                  <div className="mb-1 text-xs font-bold text-emerald-600">已付</div>
                  <div className="text-xl font-black tabular-nums text-emerald-600">${summary.paid.toLocaleString()}</div>
                </div>
                <div className="flex min-h-20 flex-col justify-center border-t border-slate-100 px-4 py-3 sm:border-l sm:border-t-0">
                  <div className="mb-1 text-xs font-bold text-rose-500">待付</div>
                  <div className="text-xl font-black tabular-nums text-rose-500">${summary.remain.toLocaleString()}</div>
                </div>
                <div className="flex min-h-20 flex-col justify-center border-l border-t border-slate-100 px-4 py-3 sm:border-t-0">
                  <div className="mb-1 text-xs font-bold text-sky-600">待補資料</div>
                  <div className="text-xl font-black tabular-nums text-sky-700">{summary.awaiting}</div>
                </div>
              </div>
          </section>
        </div>

        <details className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between bg-slate-50/70 px-4 py-3 sm:px-5">
            <h2 className="flex items-center gap-2 text-sm font-black text-slate-800 sm:text-base">
              <Plus className="h-4 w-4 text-rose-500" />
              手動新增帳單
            </h2>
            <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>

          <div className="space-y-3 border-t border-slate-200 p-4 sm:p-5">
            <div className="grid gap-3 md:grid-cols-[minmax(220px,2fr)_minmax(150px,1fr)_minmax(130px,1fr)_112px]">
              <div>
                <label className="label py-1"><span className="label-text text-xs font-bold text-slate-500">帳單名稱</span></label>
                <input className="input input-bordered h-10 min-h-0 w-full rounded-lg focus:border-rose-500" placeholder="例如：房貸、保費" value={newBill.name_snapshot} onChange={(e) => setNewBill((p) => ({ ...p, name_snapshot: e.target.value }))} />
              </div>
              <div>
                <label className="label py-1"><span className="label-text text-xs font-bold text-slate-500">到期日</span></label>
                <input type="date" className="input input-bordered h-10 min-h-0 w-full rounded-lg font-medium focus:border-rose-500" value={newBill.due_date} onChange={(e) => setNewBill((p) => ({ ...p, due_date: e.target.value }))} />
              </div>
              <div>
                <label className="label py-1"><span className="label-text text-xs font-bold text-slate-500">金額</span></label>
                <input type="number" className="input input-bordered h-10 min-h-0 w-full rounded-lg font-bold focus:border-rose-500" value={newBill.amount_due || ""} onChange={(e) => setNewBill((p) => ({ ...p, amount_due: Number(e.target.value) }))} />
              </div>
              <div className="flex items-end">
                <button className="btn h-10 min-h-0 w-full rounded-lg border-none bg-rose-500 font-black text-white hover:bg-rose-600" onClick={createBill} disabled={loading}>
                  <Plus className="h-4 w-4" />新增
                </button>
              </div>
            </div>

            <details className="collapse collapse-arrow rounded-lg border border-slate-100 bg-slate-50">
              <summary className="collapse-title min-h-10 py-3 text-xs font-bold text-slate-500">帳期區間（選填）</summary>
              <div className="collapse-content">
                <div className="grid md:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="label py-1"><span className="label-text text-xs text-slate-400">帳期開始</span></label>
                    <input type="date" className="input input-bordered w-full input-sm rounded-lg focus:border-rose-500" value={newBill.billing_start || ""} onChange={(e) => setNewBill((p) => ({ ...p, billing_start: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label py-1"><span className="label-text text-xs text-slate-400">帳期結束</span></label>
                    <input type="date" className="input input-bordered w-full input-sm rounded-lg focus:border-rose-500" value={newBill.billing_end || ""} onChange={(e) => setNewBill((p) => ({ ...p, billing_end: e.target.value }))} />
                  </div>
                </div>
              </div>
            </details>
          </div>
        </details>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <LayoutList className="h-4 w-4 text-slate-400" />
              <h2 className="text-base font-black text-slate-800">帳單明細</h2>
            </div>
            <span className="text-xs font-bold text-slate-400">{rows.length} 筆</span>
          </div>

          {rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm font-bold text-slate-400">這個月份沒有帳單</div>
          ) : (
            <>
              <div className="divide-y divide-slate-100 md:hidden">
                {rows.map((b) => {
                  const due = round2(n(b.amount_due));
                  const paid = round2(n(b.paid_total));
                  const remain = round2(due - paid);
                  return (
                    <article key={b.id} className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-bold text-slate-800">{b.name_snapshot}</h3>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                            <Clock className="h-3.5 w-3.5" />
                            {b.due_date || "待填到期日"}
                          </div>
                        </div>
                        <span className={statusBadge(b.status)}>{statusLabel(b.status)}</span>
                      </div>
                      <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-lg bg-slate-50 py-2">
                        <div>
                          <div className="px-3 text-[11px] font-bold text-slate-400">應繳</div>
                          <div className="mt-1 px-3 font-mono text-sm font-black text-slate-800">{b.amount_due == null ? "待填" : `$${due.toLocaleString()}`}</div>
                        </div>
                        <div>
                          <div className="px-3 text-[11px] font-bold text-slate-400">已付</div>
                          <div className="mt-1 px-3 font-mono text-sm font-bold text-emerald-600">${paid.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="px-3 text-[11px] font-bold text-slate-400">待付</div>
                          <div className="mt-1 px-3 font-mono text-sm font-black text-rose-500">${remain.toLocaleString()}</div>
                        </div>
                      </div>
                      {billActions(b)}
                    </article>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="table w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-white text-xs font-bold text-slate-400">
                    <th className="py-3 pl-5">到期日</th>
                    <th>帳單名稱</th>
                    <th className="text-right">應繳金額</th>
                    <th className="text-right">已付金額</th>
                    <th className="text-right">待付金額</th>
                    <th>狀態</th>
                    <th className="pr-5 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => {
                    const due = round2(n(b.amount_due));
                    const paid = round2(n(b.paid_total));
                    const remain = round2(due - paid);
                    return (
                      <tr key={b.id} className="group border-b border-slate-50 last:border-0 hover:bg-slate-50/80 transition-colors">
                        <td className="whitespace-nowrap py-3 pl-5 font-mono text-sm font-medium text-slate-600">
                          <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-slate-300" />{b.due_date || "待填"}</div>
                        </td>
                        <td className="font-bold text-slate-700 text-base">
                          <div>{b.name_snapshot}</div>
                          {(b.billing_start || b.billing_end) && <div className="text-[10px] text-slate-400 font-normal mt-0.5">{b.billing_start || "—"} ~ {b.billing_end || "—"}</div>}
                        </td>
                        <td className="text-right font-black font-mono text-slate-800 text-base">{b.amount_due == null ? "待填" : `$${due.toLocaleString()}`}</td>
                        <td className="text-right font-mono font-medium text-emerald-600">${paid.toLocaleString()}</td>
                        <td className={`text-right font-mono font-black ${remain > 0 ? "text-rose-500" : "text-slate-300"}`}>${remain.toLocaleString()}</td>
                        <td><span className={statusBadge(b.status)}>{statusLabel(b.status)}</span></td>
                        <td className="pr-5 text-right">
                          {billActions(b)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                </table>
              </div>
            </>
          )}
        </section>

          </>
        ) : (
          <BillTemplateManager workspaceId={WORKSPACE_ID} />
        )}

        {/* Pay Modal */}
        {paying && (
          <div className="modal modal-open bg-slate-900/40 backdrop-blur-sm">
            <div className="modal-box max-w-2xl rounded-lg border border-white/20 p-0 shadow-2xl">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-100 text-rose-600 rounded-lg"><Wallet className="w-5 h-5" /></div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800">付款並記帳</h3>
                    <div className="mt-0.5 text-sm font-medium text-slate-500">{paying.name_snapshot}</div>
                  </div>
                </div>
              </div>

              <div className="max-h-[70vh] space-y-4 overflow-y-auto bg-white p-5 sm:p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div><label className="label py-1"><span className="label-text font-bold text-slate-400 text-xs uppercase">付款日期</span></label><input type="date" className="input input-bordered w-full rounded-xl focus:border-rose-500" value={payForm.entry_date} onChange={(e) => setPayForm((p) => ({ ...p, entry_date: e.target.value }))} /></div>
                  <div><label className="label py-1"><span className="label-text font-bold text-slate-400 text-xs uppercase">付款金額</span></label><input type="number" className="input input-bordered w-full font-black text-lg rounded-xl focus:border-rose-500" value={payForm.pay_amount || ""} onChange={(e) => setPayForm((p) => ({ ...p, pay_amount: Number(e.target.value) }))} /></div>
                  <div><label className="label py-1"><span className="label-text font-bold text-slate-400 text-xs uppercase">誰先付錢</span></label><select className="select select-bordered w-full rounded-xl font-bold focus:border-rose-500" value={payForm.payer_id} onChange={(e) => setPayForm((p) => ({ ...p, payer_id: e.target.value }))}><option value="">（選擇）</option>{payers.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}</select></div>
                  <div><label className="label py-1"><span className="label-text font-bold text-slate-400 text-xs uppercase">付款方式</span></label><select className="select select-bordered w-full rounded-xl focus:border-rose-500" value={payForm.pay_method} onChange={(e) => setPayForm((p) => ({ ...p, pay_method: e.target.value }))}><option value="">（不選）</option>{payMethods.map((m) => (<option key={m.id} value={m.name}>{m.name}</option>))}</select></div>
                  <div><label className="label py-1"><span className="label-text font-bold text-slate-400 text-xs uppercase">分類大項</span></label><select className="select select-bordered w-full rounded-xl focus:border-rose-500" value={payForm.category_group} onChange={(e) => setPayForm((p) => ({ ...p, category_group: e.target.value, category_id: "" }))}><option value="">（不選）</option>{catGroups.map((g) => (<option key={g} value={g}>{g}</option>))}</select></div>
                  <div><label className="label py-1"><span className="label-text font-bold text-slate-400 text-xs uppercase">分類小項</span></label><select className="select select-bordered w-full rounded-xl focus:border-rose-500" value={payForm.category_id} onChange={(e) => setPayForm((p) => ({ ...p, category_id: e.target.value }))} disabled={!payForm.category_group}><option value="">（不選）</option>{paySubcats.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}</select></div>
                  <div className="md:col-span-2"><label className="label py-1"><span className="label-text font-bold text-slate-400 text-xs uppercase">店家/對象</span></label><input className="input input-bordered w-full rounded-xl focus:border-rose-500" value={payForm.merchant} onChange={(e) => setPayForm((p) => ({ ...p, merchant: e.target.value }))} /></div>
                  <div className="md:col-span-2"><label className="label py-1"><span className="label-text font-bold text-slate-400 text-xs uppercase">備註</span></label><input className="input input-bordered w-full rounded-xl focus:border-rose-500" value={payForm.note} onChange={(e) => setPayForm((p) => ({ ...p, note: e.target.value }))} /></div>
                </div>

                <div className={`mt-4 rounded-lg border p-4 transition-colors ${payForm.useSplit ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" className="toggle toggle-error" checked={payForm.useSplit} onChange={(e) => { const on = e.target.checked; if (!on) return setPayForm((p) => ({ ...p, useSplit: false, splits: [] })); const other = payForm.payer_id ? payers.find((x) => x.id !== payForm.payer_id)?.id || "" : ""; setPayForm((p) => ({ ...p, useSplit: true, splits: [{ payer_id: other, amount: 0 }] })); }} />
                    <span className={`font-bold ${payForm.useSplit ? 'text-rose-700' : 'text-slate-500'}`}>啟用分帳功能</span>
                  </label>
                  {payForm.useSplit && (
                    <div className="mt-4 space-y-3">
                      {payForm.splits.map((s, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <select className="select select-bordered select-sm w-full rounded-lg font-bold focus:border-rose-500" value={s.payer_id} onChange={(e) => setPayForm((p) => ({ ...p, splits: p.splits.map((r, i) => (i === idx ? { ...r, payer_id: e.target.value } : r)) }))}><option value="">（選擇應付者）</option>{payers.filter((p) => p.id !== payForm.payer_id).map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}</select>
                          <input type="number" className="input input-bordered input-sm w-32 font-bold rounded-lg focus:border-rose-500" value={s.amount} onChange={(e) => setPayForm((p) => ({ ...p, splits: p.splits.map((r, i) => (i === idx ? { ...r, amount: Number(e.target.value) } : r)) }))} />
                          <button className="btn btn-ghost btn-sm text-rose-500 rounded-lg hover:bg-rose-50" onClick={() => setPayForm((p) => ({ ...p, splits: p.splits.filter((_, i) => i !== idx) }))}><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                      <button className="btn btn-ghost btn-xs text-rose-600 font-bold hover:bg-rose-100" onClick={() => { const other = payForm.payer_id ? payers.find((x) => x.id !== payForm.payer_id)?.id || "" : ""; setPayForm((p) => ({ ...p, splits: [...p.splits, { payer_id: other, amount: 0 }] })); }}>＋ 新增分攤者</button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
                <button className="btn btn-ghost font-bold text-slate-400" onClick={() => setPaying(null)}>取消</button>
                <button className="btn rounded-lg border-none bg-rose-500 px-6 font-black text-white hover:bg-rose-600" onClick={payToLedger}>確認付款</button>
              </div>
            </div>
            <div className="modal-backdrop" onClick={() => setPaying(null)} />
          </div>
        )}

        {detailing ? (
          <div className="modal modal-open bg-slate-900/40">
            <div className="modal-box max-w-md rounded-lg p-0">
              <div className="border-b border-slate-200 px-5 py-4">
                <h3 className="font-black text-slate-800">填寫帳單資料</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">{detailing.name_snapshot}</p>
              </div>
              <div className="space-y-4 p-5">
                <label className="form-control">
                  <span className="label-text mb-1 text-xs font-bold text-slate-500">應繳金額</span>
                  <input
                    type="number"
                    min="0"
                    className="input input-bordered w-full rounded-lg font-mono text-lg font-bold"
                    value={detailForm.amount_due}
                    onChange={(event) => setDetailForm((current) => ({ ...current, amount_due: event.target.value }))}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text mb-1 text-xs font-bold text-slate-500">到期日</span>
                  <input
                    type="date"
                    className="input input-bordered w-full rounded-lg"
                    value={detailForm.due_date}
                    onChange={(event) => setDetailForm((current) => ({ ...current, due_date: event.target.value }))}
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
                <button type="button" className="btn btn-ghost rounded-lg" onClick={() => setDetailing(null)}>取消</button>
                <button type="button" className="btn rounded-lg border-none bg-sky-600 px-6 text-white hover:bg-sky-700" onClick={() => void saveDetails()}>
                  儲存
                </button>
              </div>
            </div>
            <button type="button" className="modal-backdrop" onClick={() => setDetailing(null)} aria-label="關閉帳單資料視窗" />
          </div>
        ) : null}

        {error && (<div className="toast toast-bottom toast-center"><div className="alert alert-error shadow-lg"><span>{error}</span></div></div>)}
      </div>
    </main>
  );
}
