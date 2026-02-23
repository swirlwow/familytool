// src/app/settlement/history/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, History, RefreshCw, Trash2, AlertCircle, CalendarDays } from "lucide-react";

const WORKSPACE_ID = process.env.NEXT_PUBLIC_WORKSPACE_ID || "";

type Payer = { id: string; name: string };

function pad2(n: number) { return String(n).padStart(2, "0"); }
function fmtDate(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function defaultRange90Days() {
  const now = new Date();
  const to = new Date(now);
  const from = new Date(now);
  from.setDate(from.getDate() - 90);
  return { from: fmtDate(from), to: fmtDate(to) };
}

export default function SettlementHistoryPage() {
  const router = useRouter();

  const init = useMemo(() => defaultRange90Days(), []);
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [limit, setLimit] = useState(50);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [payers, setPayers] = useState<Payer[]>([]);
  const payerMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of payers) m.set(p.id, p.name);
    return m;
  }, [payers]);
  const nameOf = (id: string) => payerMap.get(id) || id;

  const [rows, setRows] = useState<any[]>([]);

  async function loadPayers() {
    if (!WORKSPACE_ID) return;
    const res = await fetch(`/api/payers?workspace_id=${WORKSPACE_ID}`, { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    setPayers(Array.isArray(j?.data) ? j.data : []);
  }

  async function loadHistory() {
    if (!WORKSPACE_ID) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        workspace_id: WORKSPACE_ID,
        from,
        to,
        limit: String(limit),
      });

      const res = await fetch(`/api/settlement/history?${qs.toString()}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "讀取失敗");

      setRows(Array.isArray(j?.data) ? j.data : []);
    } catch (e: any) {
      setError(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPayers(); }, []);
  useEffect(() => { loadHistory(); }, [from, to, limit, payers.length]);

  async function undoWholeSettlement(row: any) {
    const id = String(row?.id || "");
    if (!id) return;

    const debtor = nameOf(row?.debtor_id);
    const creditor = nameOf(row?.creditor_id);
    const amt = row?.amount;
    const period = `${row?.from_date || "?"} ~ ${row?.to_date || "?"}`;

    const msg =
      `確定要撤銷整筆結清？\n` +
      `${debtor} → ${creditor}：${amt}\n` +
      `期間：${period}\n\n` +
      `⚠️ 會刪除該結算底下所有明細（回復待結清）`;

    if (!confirm(msg)) return;

    const res = await fetch(`/api/settlement/${id}?workspace_id=${WORKSPACE_ID}`, { method: "DELETE" });

    const raw = await res.text();
    let j: any = {};
    try { j = JSON.parse(raw); } catch {}

    if (!res.ok) {
      alert(`撤銷失敗：${j?.error || raw || res.status}`);
      return;
    }

    await loadHistory();
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-6">
        
        {/* ✅ Header: Sticky & Compact - Violet Theme */}
        <div className="card bg-white/90 backdrop-blur-md shadow-sm border border-slate-200 rounded-2xl sticky top-0 z-40">
          <div className="card-body p-3 flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-violet-50 text-violet-600 p-2 rounded-lg border border-violet-100">
                <History className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-slate-800">結清紀錄</h1>
                <div className="badge badge-sm bg-violet-100 text-violet-700 border-none font-bold hidden sm:inline-flex">History</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                className="btn btn-ghost btn-sm h-9 min-h-0 rounded-xl font-bold text-slate-500 hover:bg-slate-100"
                onClick={() => router.push("/")}
              >
                回首頁
              </button>
              <button
                className="btn btn-outline btn-sm h-9 min-h-0 rounded-xl font-bold border-slate-300 hover:bg-slate-100 hover:text-slate-700 gap-2"
                onClick={() => router.push("/settlement")}
              >
                <ArrowLeft className="w-4 h-4" /> 回建議結算
              </button>
            </div>
          </div>

          {!WORKSPACE_ID && (
            <div className="px-4 pb-3">
              <div className="alert alert-warning rounded-2xl py-3 text-sm">
                <span>未設定 WORKSPACE_ID（請檢查 .env.local）</span>
              </div>
            </div>
          )}
        </div>

        {/* Filters Panel */}
        <div className="card bg-white shadow-sm border border-slate-200 rounded-3xl">
          <div className="card-body p-5">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">查詢條件</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <div className="text-[11px] font-bold text-slate-400 mb-1 pl-1 uppercase">Start Date</div>
                <input
                  type="date"
                  className="input input-bordered w-full bg-slate-50 border-slate-200 rounded-xl font-bold focus:border-violet-500"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400 mb-1 pl-1 uppercase">End Date</div>
                <input
                  type="date"
                  className="input input-bordered w-full bg-slate-50 border-slate-200 rounded-xl font-bold focus:border-violet-500"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400 mb-1 pl-1 uppercase">Limit Rows</div>
                <input
                  type="number"
                  min={1}
                  max={200}
                  className="input input-bordered w-full bg-slate-50 border-slate-200 rounded-xl font-bold focus:border-violet-500"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value || 50))}
                />
              </div>
              <div>
                <button
                  className="btn bg-violet-600 hover:bg-violet-700 text-white w-full rounded-xl font-black shadow-md shadow-violet-500/20 border-none gap-2"
                  onClick={loadHistory}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  重新查詢
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* History List */}
        <div className="card bg-white shadow-sm border border-slate-200 rounded-3xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">結算歷史列表</h3>
            </div>
            <div className="text-xs font-bold text-slate-400">
                共 {rows.length} 筆
            </div>
          </div>

          <div className="overflow-x-auto">
            {rows.length === 0 ? (
              <div className="p-16 text-center text-slate-400 opacity-60 font-medium">查無符合條件的資料</div>
            ) : (
              <table className="table w-full">
                <thead>
                  <tr className="bg-white border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wide">
                    <th className="pl-8 py-4">建立時間</th>
                    <th>結算對象 (Debtor → Creditor)</th>
                    <th>涵蓋區間</th>
                    <th className="text-right">結算金額</th>
                    <th className="text-right pr-8">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="group hover:bg-violet-50/30 border-b border-slate-50 last:border-0 transition-colors">
                      <td className="pl-8 font-medium text-slate-600 whitespace-nowrap font-mono text-sm">
                        {String(r.created_at || "").replace("T", " ").slice(0, 16)}
                      </td>
                      <td>
                        <div className="flex items-center gap-2 font-bold text-slate-700 text-base">
                          <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded-md text-sm border border-rose-100">{nameOf(r.debtor_id)}</span>
                          <span className="text-slate-300">→</span>
                          <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md text-sm border border-emerald-100">{nameOf(r.creditor_id)}</span>
                        </div>
                      </td>
                      <td className="text-xs text-slate-500 font-mono">
                        {r.from_date} ~ {r.to_date}
                      </td>
                      <td className="text-right font-black font-mono text-slate-800 text-lg tabular-nums">
                        ${Number(r.amount).toLocaleString()}
                      </td>
                      <td className="text-right pr-8">
                        <button
                          className="btn btn-xs bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 rounded-lg gap-1 transition-all"
                          onClick={() => undoWholeSettlement(r)}
                          title="撤銷整筆結算"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          撤銷
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <span className="loading loading-spinner loading-lg text-violet-500"></span>
              <span className="text-sm font-bold text-violet-600 animate-pulse">讀取中...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="toast toast-bottom toast-center">
            <div className="alert alert-error shadow-lg">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}