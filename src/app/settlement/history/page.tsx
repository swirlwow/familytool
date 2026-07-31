// src/app/settlement/history/page.tsx
"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  History,
  RefreshCw,
  Trash2,
  AlertCircle,
  CalendarDays,
  ChevronDown,
  Download,
} from "lucide-react";

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
  const [detailRows, setDetailRows] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      const detailQs = new URLSearchParams({
        workspace_id: WORKSPACE_ID,
        from,
        to,
      });
      const detailRes = await fetch(
        `/api/settlement/reconciliation?${detailQs.toString()}`,
        { cache: "no-store" }
      );
      const detailJson = await detailRes.json().catch(() => ({}));
      if (!detailRes.ok) throw new Error(detailJson?.error || "讀取結算明細失敗");
      setDetailRows(Array.isArray(detailJson?.rows) ? detailJson.rows : []);
    } catch (e: any) {
      setError(e.message);
      setRows([]);
      setDetailRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPayers(); }, []);
  useEffect(() => { loadHistory(); }, [from, to, limit, payers.length]);

  function exportReconciliation(settlementId?: string) {
    const qs = new URLSearchParams({
      workspace_id: WORKSPACE_ID,
      from,
      to,
      format: "csv",
    });
    if (settlementId) qs.set("settlement_id", settlementId);
    window.location.href = `/api/settlement/reconciliation?${qs.toString()}`;
  }

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
    <main className="app-page">
      <div className="app-page-inner">
        
        {/* ✅ Header: Sticky & Compact - Violet Theme */}
        <div className="app-header">
          <div className="flex w-full flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-violet-50 text-violet-600 p-2 rounded-lg border border-violet-100">
                <History className="w-5 h-5" />
              </div>
              <h1 className="text-lg font-black text-slate-800">結清紀錄</h1>
            </div>

            <div className="flex gap-2">
              <button
                className="btn btn-ghost btn-sm hidden h-9 min-h-0 rounded-lg font-bold text-slate-500 hover:bg-slate-100 sm:inline-flex"
                onClick={() => router.push("/")}
              >
                回首頁
              </button>
              <button
                className="btn btn-outline btn-sm h-9 min-h-0 rounded-lg border-slate-300 font-bold hover:bg-slate-100 hover:text-slate-700"
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
        <section className="app-panel p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-bold text-slate-500">查詢條件</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <div className="mb-1 pl-1 text-[11px] font-bold text-slate-500">開始日期</div>
                <input
                  type="date"
                  className="input input-bordered w-full bg-slate-50 border-slate-200 rounded-xl font-bold focus:border-violet-500"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div>
                <div className="mb-1 pl-1 text-[11px] font-bold text-slate-500">結束日期</div>
                <input
                  type="date"
                  className="input input-bordered w-full bg-slate-50 border-slate-200 rounded-xl font-bold focus:border-violet-500"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
              <div>
                <div className="mb-1 pl-1 text-[11px] font-bold text-slate-500">顯示筆數</div>
                <input
                  type="number"
                  min={1}
                  max={200}
                  className="input input-bordered w-full bg-slate-50 border-slate-200 rounded-xl font-bold focus:border-violet-500"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value || 50))}
                />
              </div>
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
                <button
                  className="btn w-full rounded-lg border-none bg-violet-600 font-black text-white hover:bg-violet-700"
                  onClick={loadHistory}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  重新查詢
                </button>
                <button
                  className="btn rounded-lg border-emerald-200 px-3 font-black text-emerald-700 sm:px-4"
                  onClick={() => exportReconciliation()}
                  title="匯出目前日期範圍的完整結算明細"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">匯出</span>
                </button>
              </div>
            </div>
        </section>

        {/* History List */}
        <section className="app-panel overflow-hidden">
          <div className="app-panel-header">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-black text-slate-800">結清明細</h3>
            </div>
            <div className="text-xs font-bold text-slate-400">
                共 {rows.length} 筆
            </div>
          </div>

          <div className="overflow-x-auto">
            {rows.length === 0 ? (
              <div className="app-empty">這個期間沒有結清紀錄</div>
            ) : (
              <>
              <div className="divide-y divide-slate-100 md:hidden">
                {rows.map((r) => {
                  const details = detailRows.filter((item) => String(item.settlement_id) === String(r.id));
                  return (
                    <article key={r.id} className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-bold text-slate-800">{nameOf(r.debtor_id)} → {nameOf(r.creditor_id)}</div>
                          <div className="mt-1 text-xs text-slate-400">{String(r.created_at || "").replace("T", " ").slice(0, 16)}</div>
                        </div>
                        <div className="font-mono text-lg font-black text-slate-800">${Number(r.amount).toLocaleString()}</div>
                      </div>
                      <div className="text-xs text-slate-500">{r.from_date} ~ {r.to_date}</div>
                      <div className="flex items-center justify-end gap-2">
                        <button className="btn btn-ghost btn-sm rounded-lg" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                          <ChevronDown className={`h-4 w-4 ${expandedId === r.id ? "rotate-180" : ""}`} />明細
                        </button>
                        <button className="btn btn-ghost btn-sm rounded-lg text-emerald-700" onClick={() => exportReconciliation(r.id)} title="匯出此筆結算">
                          <Download className="h-4 w-4" /><span className="sr-only">匯出</span>
                        </button>
                        <button className="btn btn-ghost btn-sm rounded-lg text-rose-600" onClick={() => undoWholeSettlement(r)}>
                          <Trash2 className="h-4 w-4" />撤銷
                        </button>
                      </div>
                      {expandedId === r.id ? (
                        <div className="space-y-2 rounded-lg bg-slate-50 p-3">
                          {details.length ? details.map((item) => (
                            <div key={item.id} className="flex justify-between gap-3 text-xs">
                              <span className="min-w-0 truncate text-slate-600">{item.entry_date} {item.merchant || item.note || "帳目"}</span>
                              <span className="shrink-0 font-mono font-bold">${Number(item.amount || 0).toLocaleString()}</span>
                            </div>
                          )) : <div className="text-xs text-slate-400">沒有可顯示的明細</div>}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
              <table className="table hidden w-full md:table">
                <thead>
                  <tr className="bg-white border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wide">
                    <th className="pl-8 py-4">建立時間</th>
                    <th>結算對象</th>
                    <th>涵蓋區間</th>
                    <th className="text-right">結算金額</th>
                    <th className="text-right pr-8">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const details = detailRows.filter(
                      (item) => String(item.settlement_id) === String(r.id)
                    );
                    return (
                    <Fragment key={r.id}>
                    <tr className="group hover:bg-violet-50/30 border-b border-slate-50 transition-colors">
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
                          className="btn btn-xs bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg mr-1"
                          onClick={() =>
                            setExpandedId(expandedId === r.id ? null : r.id)
                          }
                          title="查看這筆結算包含哪些帳"
                        >
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform ${
                              expandedId === r.id ? "rotate-180" : ""
                            }`}
                          />
                          明細
                        </button>
                        <button
                          className="btn btn-xs bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-lg mr-1"
                          onClick={() => exportReconciliation(r.id)}
                          title="匯出此筆結算"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
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
                    {expandedId === r.id && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={5} className="px-8 py-4">
                          {details.length === 0 ? (
                            <div className="text-sm text-slate-500">
                              此結算沒有連結到帳務明細，可能是溢付款或舊資料未建立明細連結。
                            </div>
                          ) : (
                            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                              <table className="table table-sm w-full">
                                <thead>
                                  <tr className="text-slate-500">
                                    <th>帳務日期</th>
                                    <th>店家 / 備註</th>
                                    <th className="text-right">原拆帳</th>
                                    <th className="text-right">本次分配</th>
                                    <th>狀態</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {details.map((item) => (
                                    <tr key={item.settlement_item_id}>
                                      <td className="font-mono whitespace-nowrap">
                                        {item.entry_date || "—"}
                                      </td>
                                      <td>
                                        <div className="font-bold text-slate-700">
                                          {item.merchant || "未填店家"}
                                        </div>
                                        <div className="text-xs text-slate-400">
                                          {item.entry_note || "—"}
                                        </div>
                                      </td>
                                      <td className="text-right font-mono">
                                        ${Number(item.split_amount || 0).toLocaleString()}
                                      </td>
                                      <td className="text-right font-mono font-bold">
                                        ${Number(item.allocated_amount || 0).toLocaleString()}
                                      </td>
                                      <td>
                                        <span
                                          className={`badge badge-sm border-none font-bold ${
                                            item.status === "overallocated"
                                              ? "bg-rose-100 text-rose-700"
                                              : item.status === "settled"
                                                ? "bg-emerald-100 text-emerald-700"
                                                : "bg-amber-100 text-amber-800"
                                          }`}
                                        >
                                          {item.status_label}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  )})}
                </tbody>
              </table>
              </>
            )}
          </div>
        </section>

        {error && (
          <div className="toast toast-bottom toast-center">
            <div className="alert alert-error shadow-lg">
              <AlertCircle className="w-5 h-5" />
              <span>資料暫時無法讀取，請稍後再試。</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
