"use client";

import { useMemo, useState } from "react";
import { WORKSPACE_ID } from "@/lib/appConfig";

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthStartStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

type NetRow = {
  result: string;
  amount: number;
  debtor_id: string;
  creditor_id: string;
  person_1?: string;
  person_2?: string;
};

export default function SettlementPage() {
  const init = useMemo(() => ({ from: monthStartStr(), to: todayStr() }), []);
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [rows, setRows] = useState<NetRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [note, setNote] = useState("");
  const [settleDate, setSettleDate] = useState(todayStr());

  async function run() {
    if (!WORKSPACE_ID) return alert("未設定 WORKSPACE_ID");
    setLoading(true);
    const res = await fetch(`/api/settlement?workspace_id=${WORKSPACE_ID}&from=${from}&to=${to}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    setRows(json?.data || []);
    setLoading(false);
  }

  async function settleOne(row: NetRow) {
    if (!WORKSPACE_ID) return alert("未設定 WORKSPACE_ID");

    const ok = confirm(`標記已結清：\n${row.result}\n金額：${row.amount}\n\n（會寫入結清紀錄，結算淨額會歸零）`);
    if (!ok) return;

    const res = await fetch("/api/settlements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: WORKSPACE_ID,
        debtor_id: row.debtor_id,
        creditor_id: row.creditor_id,
        amount: row.amount,
        settled_date: settleDate,
        note: note || null,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) return alert(json?.error || "結清失敗");

    // 重新結算
    await run();
  }

  const totalOutstanding = rows.reduce((a, r) => a + Number(r.amount || 0), 0);

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">拆帳結算</h1>
            <div className="text-sm text-gray-500">區間內「欠款 - 已結清」後的未結清淨額</div>
          </div>
          <div className="flex gap-2">
            <a href="/" className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50">回帳單</a>
            <a href="/ledger" className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50">回記帳</a>
          </div>
        </div>

        {!WORKSPACE_ID && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
            未設定 WORKSPACE_ID（請檢查 .env.local 的 NEXT_PUBLIC_WORKSPACE_ID）
          </div>
        )}

        {/* 摘要卡 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">未結清筆數</div>
            <div className="mt-1 text-2xl font-semibold">{rows.length}</div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">未結清總額（加總）</div>
            <div className="mt-1 text-2xl font-semibold">{totalOutstanding}</div>
          </div>
        </div>

        {/* 篩選條件 */}
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-sm">起日</label>
              <input type="date" className="w-full rounded border p-2" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm">迄日</label>
              <input type="date" className="w-full rounded border p-2" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="flex items-end">
              <button className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700" onClick={run}>
                {loading ? "計算中…" : "開始結算"}
              </button>
            </div>
          </div>

          {/* 結清設定 */}
          <div className="rounded-lg border bg-gray-50 p-3 space-y-2">
            <div className="text-sm font-medium">一鍵結清設定</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm">結清日期</label>
                <input type="date" className="w-full rounded border p-2" value={settleDate} onChange={(e) => setSettleDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm">備註（可空）</label>
                <input className="w-full rounded border p-2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：本月月底結清" />
              </div>
            </div>
          </div>
        </div>

        {/* 結算結果 */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-lg font-semibold mb-2">未結清明細</div>

          {rows.length === 0 ? (
            <div className="text-gray-500">沒有未結清的拆帳（或此區間沒有拆帳紀錄）。</div>
          ) : (
            <div className="space-y-2">
              {rows.map((r, idx) => (
                <div key={idx} className="rounded-lg border p-3 sm:flex sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-medium">{r.result}</div>
                    <div className="text-sm text-gray-500">金額：{r.amount}</div>
                  </div>
                  <div className="mt-2 sm:mt-0 flex gap-2">
                    <button
                      className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                      onClick={() => settleOne(r)}
                    >
                      已結清
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 小提醒 */}
        <div className="text-sm text-gray-500">
          註：按「已結清」不會改動舊拆帳紀錄，只會新增一筆「結清紀錄」，讓之後結算自動扣除。
        </div>
      </div>
    </main>
  );
}
