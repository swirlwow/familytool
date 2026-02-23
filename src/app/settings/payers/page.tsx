"use client";

import { useEffect, useMemo, useState } from "react";
import { WORKSPACE_ID } from "@/lib/appConfig";

type PayerRow = {
  id: string;
  name: string;
  is_active: boolean;
  created_at?: string;
};

export default function PayersPage() {
  const [rows, setRows] = useState<PayerRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [newName, setNewName] = useState("");

  const activeCount = useMemo(() => rows.filter((r) => r.is_active).length, [rows]);

  async function load() {
    if (!WORKSPACE_ID) return;
    setLoading(true);
    const res = await fetch(`/api/payers?workspace_id=${WORKSPACE_ID}&include_inactive=1`, {
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    setRows(json?.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addOne() {
    if (!WORKSPACE_ID) return alert("未設定 WORKSPACE_ID（請檢查 .env.local）");
    const name = newName.trim();
    if (!name) return alert("請輸入名稱");

    const res = await fetch("/api/payers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: WORKSPACE_ID, name }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return alert(json?.error || "新增失敗");

    setNewName("");
    await load();
  }

  async function patch(id: string, patchBody: Partial<PayerRow>) {
    if (!WORKSPACE_ID) return alert("未設定 WORKSPACE_ID（請檢查 .env.local）");

    const res = await fetch("/api/payers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: WORKSPACE_ID, id, ...patchBody }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return alert(json?.error || "更新失敗");
    await load();
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">付款人管理</h1>
            <div className="text-sm text-gray-500">適用拆帳（A / B），停用不刪資料</div>
          </div>
          <div className="flex gap-2">
            <a
              href="/"
              className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50"
            >
              回帳單
            </a>
            <a
              href="/ledger"
              className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50"
            >
              回記帳
            </a>
            <a
              href="/settings/settlement"
              className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50"
            >
              拆帳結算
            </a>
          </div>
        </div>

        {!WORKSPACE_ID && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
            未設定 WORKSPACE_ID（請檢查 .env.local 的 NEXT_PUBLIC_WORKSPACE_ID）
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">總筆數</div>
            <div className="mt-1 text-2xl font-semibold">{rows.length}</div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">啟用中</div>
            <div className="mt-1 text-2xl font-semibold">{activeCount}</div>
          </div>
        </div>

        {/* 新增 */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-2 text-lg font-semibold">新增付款人</div>
          <div className="flex gap-2">
            <input
              className="w-full rounded border p-2"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例如：付款人A / 付款人B"
            />
            <button
              className="shrink-0 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              onClick={addOne}
            >
              新增
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            提醒：拆帳邏輯最少需要 2 位付款人（A/B）。你可以新增兩筆後就不必再動了。
          </div>
        </div>

        {/* 清單 */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-lg font-semibold">付款人清單</div>
            {loading && <div className="text-sm text-gray-500">讀取中…</div>}
          </div>

          {rows.length === 0 ? (
            <div className="text-gray-500">尚無付款人。</div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className={`rounded-lg border p-3 sm:flex sm:items-center sm:justify-between ${
                    r.is_active ? "" : "opacity-60"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-medium flex items-center gap-2">
                      {r.name}
                      {!r.is_active && (
                        <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
                          停用
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 break-all">id：{r.id}</div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 sm:mt-0 sm:justify-end">
                    <button
                      className="rounded border bg-white px-3 py-2 text-sm hover:bg-gray-50"
                      onClick={() => {
                        const nm = prompt("修改名稱", r.name);
                        if (nm === null) return;
                        const v = nm.trim();
                        if (!v) return alert("名稱不可為空");
                        patch(r.id, { name: v });
                      }}
                    >
                      改名
                    </button>

                    <button
                      className={`rounded px-3 py-2 text-sm text-white ${
                        r.is_active ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
                      }`}
                      onClick={() => patch(r.id, { is_active: !r.is_active })}
                    >
                      {r.is_active ? "停用" : "啟用"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-sm text-gray-500">
          註：停用付款人不會刪資料；歷史拆帳仍可追溯。
        </div>
      </div>
    </main>
  );
}
