// src/app/bills/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WORKSPACE_ID } from "@/lib/appConfig";
import {
  Receipt,
  Calendar,
  Plus,
  Trash2,
  CreditCard,
  ArrowLeft,
  Clock,
  RefreshCw,
  Wallet,
  AlertCircle
} from "lucide-react";

type BillInstance = {
  id: string;
  period: string;
  due_date: string;
  name_snapshot: string;
  amount_due: number;
  paid_total: number;
  status: "unpaid" | "partial" | "paid" | string;
  billing_start?: string | null;
  billing_end?: string | null;
  created_at?: string;
};

type PayMethod = { id: string; name: string };
type Payer = { id: string; name: string };
type Category = { id: string; name: string; group_name?: string | null; sort_order?: number };

type SplitRow = { payer_id: string; amount: number };

function n(v: any) { const x = Number(v); return Number.isFinite(x) ? x : 0; }
function round2(v: number) { return Math.round((v + Number.EPSILON) * 100) / 100; }
function ymNow() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function todayStr() { const d = new Date(); const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; }
function monthRange(ym: string) { const [y, m] = ym.split("-").map(Number); const from = `${y}-${String(m).padStart(2, "0")}-01`; const lastDay = new Date(y, m, 0).getDate(); const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`; return { from, to }; }
function statusBadge(s: string) {
  const v = String(s || "");
  if (v === "paid") return "badge bg-emerald-100 text-emerald-600 border-none font-bold";
  if (v === "partial") return "badge bg-amber-100 text-amber-600 border-none font-bold";
  return "badge bg-slate-100 text-slate-500 border-none font-bold";
}

export default function BillsPage() {
  const router = useRouter();

  const [ym, setYm] = useState(ymNow());
  const { from, to } = useMemo(() => monthRange(ym), [ym]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<BillInstance[]>([]);

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

  function payerName(id?: string | null) { if (!id) return ""; return payers.find((p) => p.id === id)?.name ?? id; }

  async function loadBills() {
    if (!WORKSPACE_ID) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bills?workspace_id=${WORKSPACE_ID}&ym=${ym}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "讀取失敗");
      setRows(Array.isArray(j?.data) ? j.data : []);
    } catch (e: any) { setError(e.message); setRows([]); } finally { setLoading(false); }
  }

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

  useEffect(() => { loadBills(); }, [ym]);
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
  }, [payForm.payer_id, payForm.useSplit, payers.length]);

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
    if (!confirm(`確定刪除帳單？\n${b.name_snapshot}\n${b.due_date} 金額 ${b.amount_due}`)) return;
    const res = await fetch("/api/bills", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace_id: WORKSPACE_ID, id: b.id }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return alert(j?.error || "刪除失敗");
    await loadBills();
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
    return { due, paid, remain };
  }, [rows]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* ✅ Header：Sticky & Compact - Rose Theme */}
        <div className="card bg-white/90 backdrop-blur-md shadow-sm border border-slate-200 rounded-2xl sticky top-0 z-40">
          <div className="card-body p-3 flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-rose-50 text-rose-500 p-2 rounded-lg border border-rose-100">
                <Receipt className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-slate-800">帳單管理</h1>
                <div className="badge badge-sm bg-rose-100 text-rose-700 border-none font-bold hidden sm:inline-flex">Bills</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="btn btn-ghost btn-sm h-9 min-h-0 rounded-xl font-bold text-slate-500 hover:bg-slate-100" onClick={() => router.push("/")}>回首頁</button>
            </div>
          </div>
          {!WORKSPACE_ID && (
            <div className="px-4 pb-3">
              <div className="alert alert-warning rounded-2xl py-3 text-sm"><span>未設定 WORKSPACE_ID（請檢查 .env.local）</span></div>
            </div>
          )}
        </div>

        {/* Month / Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card bg-white shadow-sm border border-slate-200 rounded-3xl">
            <div className="card-body p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">統計月份</span>
              </div>
              <input type="month" className="input input-bordered w-full font-bold text-lg bg-slate-50 border-slate-200 focus:border-rose-500 rounded-xl" value={ym} onChange={(e) => setYm(e.target.value)} />
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>{from} ~ {to}</span>
                <button className="flex items-center gap-1 text-rose-500 hover:text-rose-600 font-bold transition-colors" onClick={loadBills} disabled={loading}>
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> 重新載入
                </button>
              </div>
            </div>
          </div>

          <div className="card bg-white shadow-sm border border-slate-200 rounded-3xl md:col-span-2">
            <div className="card-body p-5">
              <div className="grid grid-cols-3 gap-4 h-full">
                <div className="flex flex-col justify-center">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">本期應繳</div>
                  <div className="text-2xl lg:text-3xl font-black tabular-nums text-slate-800">${summary.due.toLocaleString()}</div>
                </div>
                <div className="flex flex-col justify-center border-l border-slate-100 pl-4">
                  <div className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1">本期已付</div>
                  <div className="text-2xl lg:text-3xl font-black tabular-nums text-emerald-500">${summary.paid.toLocaleString()}</div>
                </div>
                <div className="flex flex-col justify-center border-l border-slate-100 pl-4">
                  <div className="text-xs font-bold text-rose-500 uppercase tracking-widest mb-1">本期待付</div>
                  <div className="text-2xl lg:text-3xl font-black tabular-nums text-rose-500">${summary.remain.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Create Bill */}
        <div className="card bg-white shadow-md border border-slate-200 rounded-3xl overflow-hidden">
          <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-black text-lg text-slate-800 flex items-center gap-2">
              <div className="bg-rose-500 text-white p-1 rounded-lg"><Plus className="w-4 h-4" /></div>
              新增本期帳單
            </h2>
          </div>

          <div className="card-body p-6 space-y-4">
            <div className="grid md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <label className="label py-1"><span className="label-text font-bold text-slate-400 text-xs uppercase">帳單名稱</span></label>
                <input className="input input-bordered w-full rounded-xl focus:border-rose-500" placeholder="例如：房貸、保費" value={newBill.name_snapshot} onChange={(e) => setNewBill((p) => ({ ...p, name_snapshot: e.target.value }))} />
              </div>
              <div>
                <label className="label py-1"><span className="label-text font-bold text-slate-400 text-xs uppercase">到期日</span></label>
                <input type="date" className="input input-bordered w-full rounded-xl focus:border-rose-500 font-medium" value={newBill.due_date} onChange={(e) => setNewBill((p) => ({ ...p, due_date: e.target.value }))} />
              </div>
              <div>
                <label className="label py-1"><span className="label-text font-bold text-slate-400 text-xs uppercase">金額</span></label>
                <input type="number" className="input input-bordered w-full rounded-xl font-black focus:border-rose-500" value={newBill.amount_due || ""} onChange={(e) => setNewBill((p) => ({ ...p, amount_due: Number(e.target.value) }))} />
              </div>
              <div className="flex items-end">
                <button className="btn bg-rose-500 hover:bg-rose-600 text-white border-none w-full rounded-xl font-black shadow-lg shadow-rose-500/30 hover:scale-[1.02] active:scale-95 transition-all" onClick={createBill} disabled={loading}>新增</button>
              </div>
            </div>

            <details className="collapse collapse-arrow bg-slate-50 border border-slate-100 rounded-xl">
              <summary className="collapse-title text-xs font-bold text-slate-500 uppercase tracking-wide">進階：帳期區間（選填）</summary>
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
        </div>

        {/* List */}
        <div className="card bg-white shadow-sm border border-slate-200 rounded-3xl overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
              <h2 className="text-xl font-black text-slate-800 italic tracking-tight">BILL LIST</h2>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="p-16 text-center opacity-40 font-black italic text-lg">本期尚無帳單。</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr className="bg-white border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wide">
                    <th className="pl-8 py-4">到期日</th>
                    <th>帳單名稱</th>
                    <th className="text-right">應繳金額</th>
                    <th className="text-right">已付金額</th>
                    <th className="text-right">待付金額</th>
                    <th>狀態</th>
                    <th className="text-right pr-8">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => {
                    const due = round2(n(b.amount_due));
                    const paid = round2(n(b.paid_total));
                    const remain = round2(due - paid);
                    return (
                      <tr key={b.id} className="group border-b border-slate-50 last:border-0 hover:bg-rose-50/10 transition-colors">
                        <td className="pl-8 whitespace-nowrap text-sm font-medium text-slate-600 font-mono">
                          <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-slate-300" />{b.due_date}</div>
                        </td>
                        <td className="font-bold text-slate-700 text-base">
                          <div>{b.name_snapshot}</div>
                          {(b.billing_start || b.billing_end) && <div className="text-[10px] text-slate-400 font-normal mt-0.5">{b.billing_start || "—"} ~ {b.billing_end || "—"}</div>}
                        </td>
                        <td className="text-right font-black font-mono text-slate-800 text-base">${due.toLocaleString()}</td>
                        <td className="text-right font-mono font-medium text-emerald-600">${paid.toLocaleString()}</td>
                        <td className={`text-right font-mono font-black ${remain > 0 ? "text-rose-500" : "text-slate-300"}`}>${remain.toLocaleString()}</td>
                        <td><span className={statusBadge(b.status)}>{b.status}</span></td>
                        <td className="text-right pr-8">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="btn btn-sm bg-rose-500 hover:bg-rose-600 border-none text-white shadow-md shadow-rose-500/20 rounded-lg" onClick={() => openPay(b)} disabled={remain <= 0} title={remain <= 0 ? "已結清" : "付款並寫入記帳"}>
                              <CreditCard className="w-4 h-4" /><span className="hidden sm:inline ml-1">付款</span>
                            </button>
                            <button className="btn btn-ghost btn-sm text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg" onClick={() => deleteBill(b)} title="刪除"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {rows.length > 0 && <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 text-[10px] text-slate-400 text-center">💡 提示：點擊「付款」可將支出寫入記帳本，並支援分帳功能。</div>}
        </div>

        {/* Pay Modal */}
        {paying && (
          <div className="modal modal-open bg-slate-900/40 backdrop-blur-sm">
            <div className="modal-box max-w-2xl rounded-3xl p-0 shadow-2xl border border-white/20">
              <div className="bg-slate-50 px-8 py-6 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-100 text-rose-600 rounded-lg"><Wallet className="w-5 h-5" /></div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800">付款/記帳</h3>
                    <div className="text-xs font-bold text-slate-400 mt-0.5 uppercase tracking-widest">TARGET: {paying.name_snapshot}</div>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-5 bg-white max-h-[70vh] overflow-y-auto">
                <div className="grid md:grid-cols-2 gap-5">
                  <div><label className="label py-1"><span className="label-text font-bold text-slate-400 text-xs uppercase">付款日期</span></label><input type="date" className="input input-bordered w-full rounded-xl focus:border-rose-500" value={payForm.entry_date} onChange={(e) => setPayForm((p) => ({ ...p, entry_date: e.target.value }))} /></div>
                  <div><label className="label py-1"><span className="label-text font-bold text-slate-400 text-xs uppercase">付款金額</span></label><input type="number" className="input input-bordered w-full font-black text-lg rounded-xl focus:border-rose-500" value={payForm.pay_amount || ""} onChange={(e) => setPayForm((p) => ({ ...p, pay_amount: Number(e.target.value) }))} /></div>
                  <div><label className="label py-1"><span className="label-text font-bold text-slate-400 text-xs uppercase">誰先付錢</span></label><select className="select select-bordered w-full rounded-xl font-bold focus:border-rose-500" value={payForm.payer_id} onChange={(e) => setPayForm((p) => ({ ...p, payer_id: e.target.value }))}><option value="">（選擇）</option>{payers.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}</select></div>
                  <div><label className="label py-1"><span className="label-text font-bold text-slate-400 text-xs uppercase">付款方式</span></label><select className="select select-bordered w-full rounded-xl focus:border-rose-500" value={payForm.pay_method} onChange={(e) => setPayForm((p) => ({ ...p, pay_method: e.target.value }))}><option value="">（不選）</option>{payMethods.map((m) => (<option key={m.id} value={m.name}>{m.name}</option>))}</select></div>
                  <div><label className="label py-1"><span className="label-text font-bold text-slate-400 text-xs uppercase">分類大項</span></label><select className="select select-bordered w-full rounded-xl focus:border-rose-500" value={payForm.category_group} onChange={(e) => setPayForm((p) => ({ ...p, category_group: e.target.value, category_id: "" }))}><option value="">（不選）</option>{catGroups.map((g) => (<option key={g} value={g}>{g}</option>))}</select></div>
                  <div><label className="label py-1"><span className="label-text font-bold text-slate-400 text-xs uppercase">分類小項</span></label><select className="select select-bordered w-full rounded-xl focus:border-rose-500" value={payForm.category_id} onChange={(e) => setPayForm((p) => ({ ...p, category_id: e.target.value }))} disabled={!payForm.category_group}><option value="">（不選）</option>{paySubcats.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}</select></div>
                  <div className="md:col-span-2"><label className="label py-1"><span className="label-text font-bold text-slate-400 text-xs uppercase">店家/對象</span></label><input className="input input-bordered w-full rounded-xl focus:border-rose-500" value={payForm.merchant} onChange={(e) => setPayForm((p) => ({ ...p, merchant: e.target.value }))} /></div>
                  <div className="md:col-span-2"><label className="label py-1"><span className="label-text font-bold text-slate-400 text-xs uppercase">備註</span></label><input className="input input-bordered w-full rounded-xl focus:border-rose-500" value={payForm.note} onChange={(e) => setPayForm((p) => ({ ...p, note: e.target.value }))} /></div>
                </div>

                <div className={`mt-4 p-5 rounded-2xl border transition-colors ${payForm.useSplit ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
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

              <div className="bg-slate-50 px-8 py-5 flex justify-end gap-3 border-t border-slate-200">
                <button className="btn btn-ghost font-bold text-slate-400" onClick={() => setPaying(null)}>取消</button>
                <button className="btn bg-rose-500 hover:bg-rose-600 text-white border-none rounded-2xl px-8 font-black shadow-lg shadow-rose-500/30 hover:scale-[1.02] active:scale-95 transition-all" onClick={payToLedger}>確認付款</button>
              </div>
            </div>
            <div className="modal-backdrop" onClick={() => setPaying(null)} />
          </div>
        )}

        {error && (<div className="toast toast-bottom toast-center"><div className="alert alert-error shadow-lg"><span>{error}</span></div></div>)}
      </div>
    </main>
  );
}
