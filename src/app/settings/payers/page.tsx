"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TextInputDialog } from "@/components/ui/text-input-dialog";
import { toast } from "@/hooks/use-toast";
import { WORKSPACE_ID } from "@/lib/appConfig";
import { getErrorMessage } from "@/lib/client/feedback";

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
  const [renaming, setRenaming] = useState<PayerRow | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renamingBusy, setRenamingBusy] = useState(false);

  const activeCount = useMemo(() => rows.filter((r) => r.is_active).length, [rows]);

  const load = useCallback(async () => {
    if (!WORKSPACE_ID) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/payers?workspace_id=${WORKSPACE_ID}&include_inactive=1`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(json, "讀取付款人失敗"));
      setRows(Array.isArray(json?.data) ? json.data : []);
    } catch (error: unknown) {
      toast({ variant: "destructive", title: "付款人讀取失敗", description: getErrorMessage(error, "請稍後再試") });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addOne() {
    if (!WORKSPACE_ID) {
      toast({ variant: "destructive", title: "無法新增", description: "尚未設定工作區" });
      return;
    }
    const name = newName.trim();
    if (!name) {
      toast({ variant: "destructive", title: "請輸入付款人名稱" });
      return;
    }

    const res = await fetch("/api/payers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: WORKSPACE_ID, name }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ variant: "destructive", title: "新增失敗", description: getErrorMessage(json, "請稍後再試") });
      return;
    }

    setNewName("");
    await load();
    toast({ title: "已新增付款人", description: name });
  }

  async function patch(id: string, patchBody: Partial<Pick<PayerRow, "name" | "is_active">>) {
    if (!WORKSPACE_ID) {
      toast({ variant: "destructive", title: "無法更新", description: "尚未設定工作區" });
      return false;
    }

    try {
      const res = await fetch("/api/payers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: WORKSPACE_ID, id, ...patchBody }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(json, "更新失敗"));
      await load();
      return true;
    } catch (error: unknown) {
      toast({ variant: "destructive", title: "付款人更新失敗", description: getErrorMessage(error, "請稍後再試") });
      return false;
    }
  }

  async function confirmRename() {
    if (!renaming) return false;
    const name = renameValue.trim();
    if (!name) {
      toast({ variant: "destructive", title: "名稱不可為空" });
      return false;
    }

    setRenamingBusy(true);
    const updated = await patch(renaming.id, { name });
    setRenamingBusy(false);
    if (!updated) return false;
    toast({ title: "付款人名稱已更新", description: `${renaming.name} → ${name}` });
    return true;
  }

  return (
    <main className="app-page">
      <div className="app-page-inner max-w-3xl">
        <div className="app-header">
          <div>
            <h1 className="text-lg font-black text-slate-800">付款人管理</h1>
            <div className="text-xs text-slate-500">停用後仍保留歷史資料</div>
          </div>
          <div className="hidden gap-2 sm:flex">
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
              href="/settlement"
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
            拆帳至少需要兩位付款人。
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
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 sm:mt-0 sm:justify-end">
                    <button
                      className="rounded border bg-white px-3 py-2 text-sm hover:bg-gray-50"
                      onClick={() => {
                        setRenaming(r);
                        setRenameValue(r.name);
                      }}
                    >
                      改名
                    </button>

                    <button
                      className={`rounded px-3 py-2 text-sm text-white ${
                        r.is_active ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
                      }`}
                      onClick={async () => {
                        const updated = await patch(r.id, { is_active: !r.is_active });
                        if (updated) {
                          toast({ title: r.is_active ? "付款人已停用" : "付款人已啟用", description: r.name });
                        }
                      }}
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

      <TextInputDialog
        open={renaming !== null}
        title="修改付款人名稱"
        description="只會更新顯示名稱，歷史拆帳與結清資料都會保留。"
        label="付款人名稱"
        value={renameValue}
        busy={renamingBusy}
        confirmLabel="儲存名稱"
        onValueChange={setRenameValue}
        onConfirm={confirmRename}
        onOpenChange={(open) => {
          if (!open) setRenaming(null);
        }}
      />
    </main>
  );
}
