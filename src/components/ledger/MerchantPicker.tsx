"use client";

import { useId, useRef, useState } from "react";
import { ChevronDown, Plus, Settings2 } from "lucide-react";
import { TextInputDialog } from "@/components/ui/text-input-dialog";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/client/feedback";
import type { useLedgerMerchants } from "@/hooks/useLedgerMerchants";

type Props = {
  value: string;
  onChange: (value: string) => void;
  source: ReturnType<typeof useLedgerMerchants>;
};

export function MerchantPicker({ value, onChange, source }: Props) {
  const id = useId();
  const details = useRef<HTMLDetailsElement>(null);
  const [search, setSearch] = useState("");
  const [managing, setManaging] = useState(false);
  const [dialog, setDialog] = useState<{ id?: string } | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = source.items.filter(item =>
    (managing || item.is_active) && item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  );
  function choose(name: string) {
    onChange(name);
    if (details.current) details.current.open = false;
    setSearch("");
  }
  async function saveName() {
    if (busy) return false;
    setBusy(true);
    try {
      const item = await source.save({ id: dialog?.id, name });
      if (!dialog?.id) choose(item.name);
      toast({ title: dialog?.id ? "店家名稱已更新" : "店家已新增", description: dialog?.id ? "原有記帳文字保持不變。" : undefined });
      return true;
    } catch (error) {
      toast({ variant: "destructive", title: "無法儲存店家", description: getErrorMessage(error, "請稍後再試") });
      return false;
    } finally { setBusy(false); }
  }
  async function toggle(id: string, isActive: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      await source.save({ id, is_active: !isActive });
      toast({ title: isActive ? "店家已停用" : "店家已啟用", description: "不影響原有記帳。" });
    } catch (error) {
      toast({ variant: "destructive", title: "更新失敗", description: getErrorMessage(error, "請稍後再試") });
    } finally { setBusy(false); }
  }
  return (
    <div className="min-w-0">
      <details ref={details} className="relative" onKeyDown={event => {
        if (event.key === "Escape" && details.current) {
          details.current.open = false;
          details.current.querySelector("summary")?.focus();
        }
      }}>
        <summary role="button" aria-label="選擇店家／對象" className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-xl border border-[#efd8cd] bg-[#fffdfa] px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
          <span className="truncate">{value || "選擇店家／對象（選填）"}</span>
          <ChevronDown className="h-4 w-4 shrink-0" />
        </summary>
        <div className="mt-2 rounded-xl border border-[#efd8cd] bg-[#fffdfa] p-3">
          <label htmlFor={id} className="sr-only">搜尋店家</label>
          <input id={id} type="search" value={search} onChange={event => setSearch(event.target.value)}
            placeholder="搜尋店家名稱…" className="input input-bordered input-sm w-full rounded-lg" />
          <div className="mt-2 flex items-center justify-between gap-2 text-xs">
            <button type="button" disabled={busy || source.loading || !!source.error} className="btn btn-sm rounded-xl bg-[#eee7fa] text-[#44244c]"
              onClick={() => { setName(search); setDialog({}); }}><Plus className="h-3.5 w-3.5" />新增店家</button>
            <button type="button" className="btn btn-ghost btn-sm rounded-xl" aria-pressed={managing} onClick={() => setManaging(value => !value)}>
              <Settings2 className="h-3.5 w-3.5" />{managing ? "返回選擇" : "管理"}
            </button>
          </div>
          {managing && <p className="my-2 text-xs text-slate-500">更名或停用只調整選單，不改寫舊記帳。</p>}
          <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
            {source.loading ? <p role="status" className="p-2 text-sm">載入店家中…</p> : source.error ? (
              <div role="alert" className="p-2 text-sm">{source.error}<button type="button" className="btn btn-ghost btn-sm" onClick={source.retry}>重試</button></div>
            ) : <>
              {!managing && <button type="button" className="block w-full rounded-lg p-2 text-left text-sm hover:bg-[#f9edf1]" onClick={() => choose("")}>（不選）</button>}
              {!managing && value && !source.items.some(item => item.is_active && item.name === value) && (
                <button type="button" className="block w-full break-words rounded-lg p-2 text-left text-sm hover:bg-[#f9edf1]" onClick={() => choose(value)}>保留原值：{value}</button>
              )}
              {matches.map(item => <div key={item.id} className="flex min-w-0 items-center gap-1 rounded-lg hover:bg-[#f9edf1]">
                {managing ? <>
                  <span className="min-w-0 flex-1 break-words p-2 text-sm">{item.name}{!item.is_active && <span className="ml-1 text-xs text-slate-400">停用</span>}</span>
                  <button type="button" disabled={busy} className="btn btn-ghost btn-xs shrink-0" aria-label={`更名 ${item.name}`}
                    onClick={() => { setName(item.name); setDialog({ id: item.id }); }}>更名</button>
                  <button type="button" disabled={busy} className="btn btn-ghost btn-xs shrink-0" aria-label={`${item.is_active ? "停用" : "啟用"} ${item.name}`}
                    onClick={() => void toggle(item.id, item.is_active)}>{item.is_active ? "停用" : "啟用"}</button>
                </> : <button type="button" className="w-full break-words p-2 text-left text-sm" onClick={() => choose(item.name)}>{item.name}</button>}
              </div>)}
              {matches.length === 0 && <p className="p-2 text-xs text-slate-500">沒有符合的店家，可按「新增店家」。</p>}
            </>}
          </div>
        </div>
      </details>
      <TextInputDialog open={dialog !== null} onOpenChange={open => { if (!open) setDialog(null); }}
        title={dialog?.id ? "店家更名" : "新增店家"} label="店家名稱" description="名稱最多 120 個字；同名店家不會重複新增。"
        value={name} onValueChange={setName} busy={busy} onConfirm={saveName} />
    </div>
  );
}
