// src/app/accounts/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WORKSPACE_ID } from "@/lib/appConfig";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { AccountRow, AccountType, apiGetAccounts, apiPostAccount, apiPatchAccount, apiDeleteAccount, n } from "@/lib/api";
import { Wallet, CreditCard, Landmark, Plus, GripVertical, Power, Trash2, ArrowUpDown, ArrowLeft } from "lucide-react";

function stopDrag(e: React.SyntheticEvent) { e.stopPropagation(); }

function TypeIcon({ type }: { type: AccountType }) {
  if (type === "credit_card") return <CreditCard className="w-5 h-5 text-emerald-600" />;
  if (type === "bank") return <Landmark className="w-5 h-5 text-emerald-600" />;
  return <Wallet className="w-5 h-5 text-emerald-600" />;
}

function SortableAccountCard({ row, onPatchLocal, onBlurCommit, onToggleActive, onDelete }: { row: AccountRow; onPatchLocal: (patch: Partial<AccountRow>) => void; onBlurCommit: () => void; onToggleActive: () => void; onDelete: () => void; }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  const style: React.CSSProperties = { transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 50 : undefined, position: "relative" };
  const inactive = row.is_active === false;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={["group relative flex flex-col md:flex-row items-start md:items-center gap-3 rounded-2xl border p-4 shadow-sm transition-all select-none", isDragging ? "border-emerald-400 ring-2 ring-emerald-400/20 shadow-xl scale-[1.02] z-50 bg-white" : "border-slate-100 bg-white hover:border-emerald-200 hover:shadow-md", inactive ? "bg-slate-50 opacity-60 grayscale-[0.5]" : ""].join(" ")} title="按住卡片空白處拖曳排序">
      <div className="absolute right-3 top-3 md:static md:top-auto md:right-auto md:left-auto flex h-8 w-6 items-center justify-center rounded-md text-slate-300 group-hover:text-emerald-500 cursor-grab active:cursor-grabbing touch-none"><GripVertical className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1 w-full pr-8 md:pr-0">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 items-center">
          <div className="md:col-span-4"><div className="md:hidden text-[10px] font-bold text-slate-400 uppercase mb-0.5">名稱</div><Input value={row.name || ""} onChange={(e) => onPatchLocal({ name: e.target.value })} onBlur={onBlurCommit} placeholder="帳戶名稱" className={["h-9 border-transparent bg-transparent px-2 text-base font-bold shadow-none transition-all p-0 md:p-2", "focus-visible:border-slate-300 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-emerald-500/20 rounded-lg", inactive ? "text-slate-500 line-through decoration-slate-300" : "text-slate-900"].join(" ")} onPointerDown={stopDrag} onKeyDown={stopDrag} /></div>
          <div className="md:col-span-4"><div className="md:hidden text-[10px] font-bold text-slate-400 uppercase mb-0.5 mt-2 md:mt-0">備註/帳號</div><Input value={row.note || ""} onChange={(e) => onPatchLocal({ note: e.target.value })} onBlur={onBlurCommit} placeholder="備註 / 末四碼" className={["h-9 border-transparent bg-transparent px-2 text-sm font-mono shadow-none transition-all p-0 md:p-2", "focus-visible:border-slate-300 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-emerald-500/20 rounded-lg", "text-slate-500 placeholder:text-slate-300"].join(" ")} onPointerDown={stopDrag} onKeyDown={stopDrag} /></div>
          <div className="md:col-span-2"><div className="md:hidden text-[10px] font-bold text-slate-400 uppercase mb-0.5 mt-2 md:mt-0">持有人</div><Input value={row.owner_name || ""} onChange={(e) => onPatchLocal({ owner_name: e.target.value })} onBlur={onBlurCommit} placeholder="持有人" className={["h-9 border-transparent bg-transparent px-2 text-sm font-bold text-left md:text-center shadow-none transition-all p-0 md:p-2", "focus-visible:border-slate-300 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-emerald-500/20 rounded-lg", inactive ? "text-slate-400" : "text-emerald-600"].join(" ")} onPointerDown={stopDrag} onKeyDown={stopDrag} /></div>
          <div className="md:col-span-2 flex items-center justify-between md:justify-end gap-2 mt-3 md:mt-0 pt-3 md:pt-0 border-t border-slate-100 md:border-0 w-full">
            <span className="md:hidden text-[10px] font-bold text-slate-300 uppercase">狀態與操作</span>
            <div className="flex items-center gap-1">
                <span className="hidden md:inline-block font-mono text-[10px] text-slate-200 select-none mr-2">#{n(row.sort_order)}</span>
                <Button type="button" size="sm" variant="ghost" className={["h-8 px-2.5 text-xs font-bold rounded-lg border transition-all", inactive ? "border-slate-200 text-slate-400 bg-transparent hover:bg-slate-100" : "border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700"].join(" ")} onClick={(e) => { e.stopPropagation(); onToggleActive(); }} onPointerDown={stopDrag}><Power className="w-3.5 h-3.5 mr-1" />{inactive ? "停用" : "啟用"}</Button>
                <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" onClick={(e) => { e.stopPropagation(); onDelete(); }} onPointerDown={stopDrag} title="刪除"><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AccountsSettingsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [newType, setNewType] = useState<AccountType>("credit_card");
  const [newName, setNewName] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newNote, setNewNote] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byType = useMemo(() => {
    const m: Record<AccountType, AccountRow[]> = { credit_card: [], bank: [], cash: [] };
    for (const r of rows) { const tp = (r.type || "credit_card") as AccountType; m[tp].push(r); }
    for (const tp of Object.keys(m) as AccountType[]) { m[tp] = m[tp].slice().sort((a, b) => n(a.sort_order) - n(b.sort_order) || String(a.name).localeCompare(String(b.name), "zh-Hant")); }
    return m;
  }, [rows]);

  async function load() {
    if (!WORKSPACE_ID) return;
    setLoading(true);
    try {
      const j = await apiGetAccounts({ workspace_id: WORKSPACE_ID, include_inactive: 1 });
      setRows(Array.isArray(j?.data) ? j.data : []);
    } catch (e: any) { alert(e?.message || "讀取失敗"); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function patch(id: string, patchBody: any) {
    if (!WORKSPACE_ID) return;
    try { await apiPatchAccount({ workspace_id: WORKSPACE_ID, id, ...patchBody }); } catch (e: any) { alert(e?.message || "更新失敗"); }
  }

  async function add() {
    if (!WORKSPACE_ID) return alert("未設定 WORKSPACE_ID");
    const nm = newName.trim(); const ow = newOwner.trim();
    if (!nm) return alert("請輸入帳戶名稱"); if (!ow) return alert("請輸入持有人");
    try {
      await apiPostAccount({ workspace_id: WORKSPACE_ID, type: newType, name: nm, owner_name: ow, note: newNote.trim() ? newNote.trim() : null });
      setNewName(""); setNewOwner(""); setNewNote(""); await load();
    } catch (e: any) { alert(e?.message || "新增失敗"); }
  }

  async function del(id: string, name: string) {
    if (!WORKSPACE_ID) return;
    if (!confirm(`確定刪除帳戶「${name}」？`)) return;
    try { await apiDeleteAccount({ workspace_id: WORKSPACE_ID, id }); await load(); } catch (e: any) { alert(e?.message || "刪除失敗"); }
  }

  async function fixSort(tp: AccountType) {
    if (!WORKSPACE_ID) return;
    setLoading(true);
    try {
      const base = byType[tp] || [];
      for (let i = 0; i < base.length; i++) {
        const desired = (i + 1) * 10;
        if (n(base[i].sort_order) !== desired) { await patch(base[i].id, { sort_order: desired }); }
      }
      await load();
    } finally { setLoading(false); }
  }

  async function handleDragEnd(tp: AccountType, e: DragEndEvent) {
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || activeId === overId) return;
    const ordered = byType[tp] || [];
    const ids = ordered.map((r) => r.id);
    const oldIndex = ids.indexOf(activeId);
    const newIndex = ids.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ordered, oldIndex, newIndex);
    const nextRows = next.map((r, i) => ({ ...r, sort_order: (i + 1) * 10 }));
    setRows((prev) => { const other = prev.filter((x) => (x.type as AccountType) !== tp); return [...other, ...nextRows]; });
    try { for (let i = 0; i < nextRows.length; i++) { await patch(nextRows[i].id, { sort_order: (i + 1) * 10 }); } } finally { await load(); }
  }

  const sections: { tp: AccountType; title: string; desc: string }[] = [
    { tp: "credit_card", title: "信用卡", desc: "可記錄卡片名稱、持有人與末四碼。" },
    { tp: "bank", title: "銀行帳戶", desc: "可記錄銀行/戶名/備註。" },
    { tp: "cash", title: "現金", desc: "可記錄現金類別。" },
  ];

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        
        {/* ✅ Header: Sticky & Compact - Emerald Theme */}
        <div className="card bg-white/90 backdrop-blur-md shadow-sm border border-slate-200 rounded-2xl sticky top-0 z-40">
          <div className="card-body p-3 flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg border border-emerald-100"><Wallet className="w-5 h-5" /></div>
              <div className="flex items-center gap-2"><h1 className="text-lg font-black tracking-tight text-slate-800">帳戶總覽</h1><div className="badge badge-sm bg-emerald-100 text-emerald-700 border-none font-bold hidden sm:inline-flex">Accounts</div></div>
            </div>
            <div className="flex gap-2">
                <button className="btn btn-ghost btn-sm h-9 min-h-0 rounded-xl font-bold text-slate-500 hover:bg-slate-100" onClick={() => router.push("/")}>回首頁</button>
                <button className="btn btn-outline btn-sm h-9 min-h-0 rounded-xl font-bold border-slate-300 hover:bg-slate-100 hover:text-slate-700 gap-2" onClick={() => router.push("/ledger")}><ArrowLeft className="w-4 h-4" /> 記帳本</button>
            </div>
          </div>
          {!WORKSPACE_ID && (<div className="px-4 pb-3"><div className="alert alert-warning rounded-2xl py-3 text-sm"><span>未設定 WORKSPACE_ID（請檢查 .env.local）</span></div></div>)}
        </div>

        <Card className="overflow-hidden border-none shadow-none sm:border sm:bg-white sm:shadow-sm sm:rounded-3xl">
          <CardHeader className="border-b border-slate-100 bg-white/50 px-6 py-4 backdrop-blur-sm rounded-t-3xl">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2"><div className="bg-emerald-500 text-white p-1 rounded-lg"><Plus className="w-4 h-4" /></div>新增帳戶資料</CardTitle>
              <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="h-8 px-3 text-slate-400 hover:text-emerald-600 rounded-xl">{loading ? "讀取中..." : "重新整理"}</Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 bg-slate-50/50 sm:bg-white rounded-b-3xl">
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4 sm:p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12 items-end">
                <div className="md:col-span-2"><label className="label py-1"><span className="label-text font-bold text-slate-400 text-xs uppercase">類型</span></label><select className="select select-bordered select-sm w-full rounded-xl font-bold focus:border-emerald-500 h-10" value={newType} onChange={(e) => setNewType(e.target.value as AccountType)}><option value="credit_card">信用卡</option><option value="bank">銀行帳戶</option><option value="cash">現金</option></select></div>
                <div className="md:col-span-3"><label className="label py-1"><span className="label-text font-bold text-slate-400 text-xs uppercase">名稱</span></label><Input className="h-10 border-slate-200 bg-white shadow-sm rounded-xl focus:border-emerald-500" placeholder="例如：玉山 UBear" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} /></div>
                <div className="md:col-span-2"><label className="label py-1"><span className="label-text font-bold text-slate-400 text-xs uppercase">持有人</span></label><Input className="h-10 border-slate-200 bg-white shadow-sm rounded-xl focus:border-emerald-500" placeholder="例如：媽媽" value={newOwner} onChange={(e) => setNewOwner(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} /></div>
                <div className="md:col-span-3"><label className="label py-1"><span className="label-text font-bold text-slate-400 text-xs uppercase">備註</span></label><Input className="h-10 border-slate-200 bg-white shadow-sm rounded-xl focus:border-emerald-500" placeholder="例如：末四碼 1234" value={newNote} onChange={(e) => setNewNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} /></div>
                <div className="md:col-span-2"><Button onClick={add} className="h-10 w-full rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700 shadow-md shadow-emerald-200/50 hover:scale-[1.02] active:scale-95 transition-all">新增</Button></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading && <div className="flex justify-center py-8"><span className="loading loading-spinner loading-lg text-emerald-500"></span></div>}

        <div className="space-y-6">
          {sections.map((s) => {
            const list = byType[s.tp] || [];
            return (
              <Card key={s.tp} className="overflow-hidden sm:rounded-3xl border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100 bg-white px-6 py-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3"><div className="p-2 bg-slate-50 rounded-xl border border-slate-100"><TypeIcon type={s.tp} /></div><div><CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">{s.title}<span className="badge badge-sm bg-slate-100 text-slate-500 border-none font-mono">{list.length}</span></CardTitle><p className="text-xs text-slate-400 mt-0.5">{s.desc}</p></div></div>
                    <Button variant="outline" size="sm" className="h-8 text-xs rounded-xl border-slate-200 text-slate-500 hover:border-emerald-200 hover:text-emerald-700 hover:bg-emerald-50 gap-2" onClick={() => fixSort(s.tp)} disabled={loading || list.length === 0}><ArrowUpDown className="w-3 h-3" />重置排序</Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 bg-slate-50/30 min-h-[100px]">
                  {list.length === 0 ? (<div className="flex flex-col items-center justify-center py-10 text-slate-400 text-sm"><div className="text-4xl mb-2 opacity-20">📭</div>尚無資料</div>) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(s.tp, e)}>
                      <SortableContext items={list.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-3">{list.map((r) => (<SortableAccountCard key={r.id} row={r} onPatchLocal={(p) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...p } : x)))} onBlurCommit={() => { const current = rows.find((x) => x.id === r.id); patch(r.id, { name: (current?.name ?? r.name ?? "").toString(), owner_name: (current?.owner_name ?? r.owner_name ?? "").toString(), note: String(current?.note ?? r.note ?? "").trim() ? String(current?.note ?? r.note) : null }); }} onToggleActive={async () => { await patch(r.id, { is_active: r.is_active === false }); await load(); }} onDelete={() => del(r.id, r.name)} />))}</div>
                      </SortableContext>
                    </DndContext>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );
}
