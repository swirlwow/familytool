"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Search, Store } from "lucide-react";
import { LedgerSettingsNav } from "@/components/settings/LedgerSettingsNav";
import { MerchantNameField } from "@/components/settings/MerchantNameField";
import { TextInputDialog } from "@/components/ui/text-input-dialog";
import { useLedgerMerchants } from "@/hooks/useLedgerMerchants";
import { toast } from "@/hooks/use-toast";
import { WORKSPACE_ID } from "@/lib/appConfig";
import { getErrorMessage } from "@/lib/client/feedback";
import type { LedgerMerchant } from "@/lib/ledger/details";

export default function MerchantsPage() {
  const source = useLedgerMerchants(WORKSPACE_ID ?? "");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const matches = source.items.filter(item => item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  async function saveName() {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true);
    try {
      await source.save({ name });
      toast({ title: "店家已新增", description: "原有記帳文字保持不變。" });
      return true;
    } catch (error) {
      toast({ variant: "destructive", title: "無法儲存店家", description: getErrorMessage(error, "請稍後再試") });
      return false;
    } finally { saving.current = false; setBusy(false); }
  }
  async function rename(id: string, name: string) {
    if (saving.current) throw new Error("另一項變更儲存中，請稍後再試");
    saving.current = true;
    setBusy(true);
    try {
      const saved = await source.save({ id, name });
      toast({ title: "店家名稱已更新", description: "原有記帳文字保持不變。" });
      return saved;
    } finally { saving.current = false; setBusy(false); }
  }
  async function toggle(item: LedgerMerchant) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      await source.save({ id: item.id, is_active: !item.is_active });
      toast({ title: item.is_active ? "店家已停用" : "店家已啟用", description: "不影響原有記帳。" });
    } catch (error) {
      toast({ variant: "destructive", title: "更新失敗", description: getErrorMessage(error, "請稍後再試") });
    } finally { saving.current = false; setBusy(false); }
  }
  return <main className="app-page">
    <div className="app-page-inner max-w-6xl">
      <div className="app-header">
        <div className="flex w-full items-center justify-between gap-3">
          <h1 className="flex items-center gap-3 text-lg font-black"><Store size={20} />記帳設定</h1>
          <Link href="/ledger" className="btn btn-outline btn-sm"><ArrowLeft size={16} />記帳本</Link>
        </div>
      </div>
      <LedgerSettingsNav active="merchants" />
      <section className="merchant-management" aria-labelledby="merchants-title">
        <header className="merchant-heading">
          <div><h2 id="merchants-title">店家清單 <span>{source.items.length}</span></h2>
            <p>直接修改名稱，離開欄位或按 Enter 儲存。不改寫舊記帳。</p></div>
          <button type="button" className="btn btn-sm bg-violet-600" disabled={busy || source.loading || !!source.error}
            onClick={() => { setName(""); setDialog(true); }}><Plus size={16} />新增店家</button>
        </header>
        <div className="choice-search merchant-search"><Search size={16} aria-hidden="true" />
          <input type="search" aria-label="搜尋店家" placeholder="搜尋店家名稱…" value={search} onChange={event => setSearch(event.target.value)} />
        </div>
        {source.loading ? <p role="status" className="choice-hint">載入店家中…</p> : source.error ? (
          <div role="alert">{source.error}<button type="button" className="choice-more" onClick={source.retry}>重試</button></div>
        ) : <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {matches.map(item => <article key={item.id} className="merchant-card">
            <div><MerchantNameField item={item} busy={busy} onSave={rename} /><span className="merchant-status" data-active={item.is_active}>{item.is_active ? "啟用" : "停用"}</span></div>
            <div className="merchant-actions">
              <button type="button" disabled={busy} aria-label={`${item.is_active ? "停用" : "啟用"} ${item.name}`}
                onClick={() => void toggle(item)}>{item.is_active ? "停用" : "啟用"}</button>
            </div>
          </article>)}
          {matches.length === 0 && <p className="choice-hint">沒有符合的店家，可新增店家。</p>}
        </div>}
      </section>
      <TextInputDialog open={dialog} onOpenChange={setDialog}
        title="新增店家" label="店家名稱"
        description="名稱最多 120 個字；同名店家不會重複新增。" value={name} onValueChange={setName} busy={busy} onConfirm={saveName} />
    </div>
  </main>;
}
