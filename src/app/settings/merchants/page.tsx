"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, GripVertical, Plus, Store } from "lucide-react";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LedgerSettingsNav } from "@/components/settings/LedgerSettingsNav";
import { MerchantNameField } from "@/components/settings/MerchantNameField";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLedgerMerchants } from "@/hooks/useLedgerMerchants";
import { toast } from "@/hooks/use-toast";
import { WORKSPACE_ID } from "@/lib/appConfig";
import { getErrorMessage } from "@/lib/client/feedback";
import type { LedgerMerchant } from "@/lib/ledger/details";

function SortableMerchantCard({ item, busy, onRename, onToggle }: {
  item: LedgerMerchant;
  busy: boolean;
  onRename: (id: string, name: string) => Promise<LedgerMerchant>;
  onToggle: (item: LedgerMerchant) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    transition: { duration: 140, easing: "cubic-bezier(0.2, 0, 0, 1)" },
  });
  return <article ref={setNodeRef} className={`merchant-card ${isDragging ? "border-sky-400 bg-sky-50/80 shadow-md" : ""}`}
    style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 30 : undefined, position: "relative" }}>
    <button type="button" {...attributes} {...listeners} disabled={busy}
      className="flex h-9 w-7 shrink-0 touch-none cursor-grab items-center justify-center rounded-lg text-slate-400 hover:bg-sky-50 hover:text-sky-600 active:cursor-grabbing"
      aria-label={`調整店家「${item.name}」順序`} title="按住拖曳排序">
      <GripVertical size={18} aria-hidden="true" />
    </button>
    <MerchantNameField item={item} busy={busy} onSave={onRename} />
    <span className="merchant-status" data-active={item.is_active}>{item.is_active ? "啟用" : "停用"}</span>
    <div className="merchant-actions">
      <button type="button" disabled={busy} aria-label={`${item.is_active ? "停用" : "啟用"} ${item.name}`}
        onClick={() => onToggle(item)}>{item.is_active ? "停用" : "啟用"}</button>
    </div>
  </article>;
}

export default function MerchantsPage() {
  const source = useLedgerMerchants(WORKSPACE_ID ?? "");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function saveName() {
    if (saving.current || !name.trim()) return false;
    saving.current = true;
    setBusy(true);
    try {
      await source.save({ name });
      setName("");
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
  async function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId || saving.current) return;
    const oldIndex = source.items.findIndex(item => item.id === activeId);
    const newIndex = source.items.findIndex(item => item.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;
    saving.current = true;
    setBusy(true);
    try {
      await source.reorder(arrayMove(source.items, oldIndex, newIndex));
      toast({ title: "店家順序已更新", description: "新增記帳會依這個順序顯示。" });
    } catch (error) {
      toast({ variant: "destructive", title: "店家排序失敗", description: getErrorMessage(error, "請稍後再試") });
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
            <p>拖曳左側把手調整順序；新增記帳會優先顯示前面的店家。</p></div>
        </header>
        <form className="mb-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2 sm:p-3"
          onSubmit={event => { event.preventDefault(); void saveName(); }}>
          <div className="flex gap-2">
            <Input aria-label="新增店家名稱" maxLength={120} readOnly={busy}
              className="h-10 min-w-0 flex-1 border-slate-200 bg-white shadow-sm rounded-xl focus:border-sky-500 font-medium"
              placeholder="輸入名稱後按 Enter 新增..." value={name} onChange={event => setName(event.target.value)}
              onKeyDown={event => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }} />
            <Button type="submit" disabled={busy || source.loading || !!source.error || !name.trim()}
              className="h-10 shrink-0 rounded-xl bg-sky-600 px-6 font-bold text-white hover:bg-sky-700 shadow-md shadow-sky-200/50">
              <Plus className="w-4 h-4 mr-1" aria-hidden="true" />新增
            </Button>
          </div>
        </form>
        {source.loading ? <p role="status" className="choice-hint">載入店家中…</p> : source.error ? (
          <div role="alert">{source.error}<button type="button" className="choice-more" onClick={source.retry}>重試</button></div>
        ) : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={source.items.map(item => item.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {source.items.map(item => <SortableMerchantCard key={item.id} item={item} busy={busy}
            onRename={rename} onToggle={item => void toggle(item)} />)}
          {source.items.length === 0 && <p className="choice-hint">目前尚無店家，請在上方輸入名稱新增。</p>}
            </div>
          </SortableContext>
        </DndContext>}
      </section>
    </div>
  </main>;
}
