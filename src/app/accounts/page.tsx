// src/app/accounts/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { WORKSPACE_ID } from "@/lib/appConfig";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Edit3, Plus, Trash2, ShieldCheck, Building2, Copy, CheckCircle2 } from "lucide-react";

// ✅ 完美對齊最新的資料庫欄位，加入 account_number
type AccountRow = {
  id: string;
  type: string;
  name: string;
  account_number: string | null;
  owner_name: string | null;
  note: string | null;
  sort_order: number | null;
  is_active: boolean;
};

const ACCOUNT_TYPES = [
  { value: "bank", label: "銀行帳戶" },
  { value: "credit_card", label: "信用卡" },
  { value: "e_wallet", label: "電子支付/錢包" },
  { value: "other", label: "其他" },
];

function getTypeLabel(v: string) {
  return ACCOUNT_TYPES.find((x) => x.value === v)?.label || v;
}

// ===== 🚀 手機版專用滑動元件 (Swipe to Action) =====
function SwipeableRow({ children, onEdit, onDelete }: { children: React.ReactNode, onEdit: () => void, onDelete: () => void }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const currentX = useRef<number>(0);
  const isSwiping = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isSwiping.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null || startY.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (!isSwiping.current && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      isSwiping.current = true;
    }

    if (isSwiping.current) {
      let newX = currentX.current + dx;
      if (newX > 80) newX = 80 + (newX - 80) * 0.2;
      if (newX < -80) newX = -80 + (newX + 80) * 0.2;
      
      if (rowRef.current) {
        rowRef.current.style.transform = `translateX(${newX}px)`;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isSwiping.current) {
      if (currentX.current !== 0) {
         currentX.current = 0;
         if (rowRef.current) {
           rowRef.current.style.transition = 'transform 0.2s ease-out';
           rowRef.current.style.transform = `translateX(0px)`;
           setTimeout(() => { if(rowRef.current) rowRef.current.style.transition = ''; }, 200);
         }
      }
      return;
    }
    
    const dx = e.changedTouches[0].clientX - (startX.current || 0);
    let finalX = currentX.current + dx;

    if (finalX > 40) {
      currentX.current = 80;
    } else if (finalX < -40) {
      currentX.current = -80;
    } else {
      currentX.current = 0;
    }

    if (rowRef.current) {
      rowRef.current.style.transition = 'transform 0.2s ease-out';
      rowRef.current.style.transform = `translateX(${currentX.current}px)`;
      setTimeout(() => {
        if (rowRef.current) rowRef.current.style.transition = '';
      }, 200);
    }
    
    startX.current = null;
    startY.current = null;
    isSwiping.current = false;
  };

  return (
    <div className="relative overflow-hidden group touch-pan-y border-b border-slate-100 last:border-b-0 bg-slate-50">
      <div 
        className="absolute inset-y-0 left-0 w-20 bg-emerald-500 flex flex-col items-center justify-center text-white md:hidden cursor-pointer" 
        onClick={() => { currentX.current = 0; if(rowRef.current) rowRef.current.style.transform = 'translateX(0px)'; onEdit(); }}
      >
        <Edit3 className="w-5 h-5 mb-1" />
        <span className="text-[10px] font-bold tracking-widest">編輯</span>
      </div>
      
      <div 
        className="absolute inset-y-0 right-0 w-20 bg-rose-500 flex flex-col items-center justify-center text-white md:hidden cursor-pointer" 
        onClick={() => { currentX.current = 0; if(rowRef.current) rowRef.current.style.transform = 'translateX(0px)'; onDelete(); }}
      >
        <Trash2 className="w-5 h-5 mb-1" />
        <span className="text-[10px] font-bold tracking-widest">刪除</span>
      </div>
      
      <div 
        ref={rowRef}
        className="bg-white relative z-10 w-full"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const { toast } = useToast();
  const [list, setList] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);

  // New Form
  const [formType, setFormType] = useState("bank");
  const [formName, setFormName] = useState("");
  const [formOwnerName, setFormOwnerName] = useState("");
  const [formAccountNumber, setFormAccountNumber] = useState(""); // ✅ 新增卡號狀態
  const [formNote, setFormNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit Modal
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [editForm, setEditForm] = useState({
    type: "bank",
    name: "",
    owner_name: "",
    account_number: "", // ✅ 新增卡號狀態
    note: "",
  });

  // Copy Feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function load() {
    if (!WORKSPACE_ID) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/accounts?workspace_id=${WORKSPACE_ID}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "讀取失敗");
      setList(Array.isArray(j.data) ? j.data : []);
    } catch (e: any) {
      toast({ variant: "destructive", title: "讀取失敗", description: e.message });
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitNew() {
    if (!WORKSPACE_ID) return;
    const n = formName.trim();
    if (!n) {
      toast({ variant: "destructive", title: "失敗", description: "名稱不可空白" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: WORKSPACE_ID,
          type: formType,
          name: n,
          owner_name: formOwnerName || null,
          account_number: formAccountNumber || null, // ✅ 傳送卡號
          note: formNote || null,
          is_active: true,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "新增失敗");

      setFormName("");
      setFormOwnerName("");
      setFormAccountNumber(""); // ✅ 清除卡號狀態
      setFormNote("");
      toast({ title: "已新增帳戶/卡片" });
      load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "新增失敗", description: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function submitEdit() {
    if (!WORKSPACE_ID || !editing) return;
    const n = editForm.name.trim();
    if (!n) {
      toast({ variant: "destructive", title: "失敗", description: "名稱不可空白" });
      return;
    }

    try {
      const res = await fetch("/api/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: WORKSPACE_ID,
          id: editing.id,
          type: editForm.type,
          name: n,
          owner_name: editForm.owner_name || null,
          account_number: editForm.account_number || null, // ✅ 傳送卡號
          note: editForm.note || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "修改失敗");

      toast({ title: "已儲存修改" });
      setEditing(null);
      load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "修改失敗", description: e.message });
    }
  }

  async function deleteRow(id: string) {
    if (!WORKSPACE_ID) return;
    if (!confirm("確定刪除此紀錄嗎？")) return;
    try {
      const res = await fetch("/api/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: WORKSPACE_ID, id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "刪除失敗");
      toast({ title: "已刪除" });
      load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "刪除失敗", description: e.message });
    }
  }

  function openEdit(r: AccountRow) {
    setEditing(r);
    setEditForm({
      type: r.type || "bank",
      name: r.name || "",
      owner_name: r.owner_name || "",
      account_number: r.account_number || "", // ✅ 帶入卡號
      note: r.note || "",
    });
  }

  // ✅ 複製帳號功能
  async function handleCopy(text: string, id: string, e: React.MouseEvent) {
    e.stopPropagation(); // 避免觸發滑動或其他點擊事件
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
      toast({ title: "已複製帳號/卡號" });
    } catch (err) {
      toast({ variant: "destructive", title: "複製失敗", description: "請手動選取複製" });
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-0 py-4 sm:p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
        
        {/* Header */}
        <div className="card bg-white/90 backdrop-blur-md shadow-none sm:shadow-sm border-b sm:border border-slate-200 rounded-none sm:rounded-3xl sticky top-0 z-40">
          <div className="card-body p-3 px-4 sm:p-4 flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl border border-emerald-100">
                <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">帳戶與卡片備忘</h1>
                <div className="badge badge-sm bg-emerald-100 text-emerald-700 border-none font-bold hidden sm:inline-flex">
                  Accounts
                </div>
              </div>
            </div>
            <div>
              <Link
                href="/"
                className="btn btn-ghost btn-sm h-8 sm:h-9 min-h-0 rounded-xl font-bold text-slate-500 hover:bg-slate-100 hidden sm:inline-flex"
              >
                回首頁
              </Link>
            </div>
          </div>
        </div>

        {/* New Form */}
        <div className="card bg-white shadow-none sm:shadow-md border-y sm:border border-slate-200 rounded-none sm:rounded-3xl">
          <div className="bg-slate-50/50 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 flex items-center gap-2 sm:rounded-t-3xl">
            <div className="bg-emerald-500 text-white p-1 rounded-md sm:rounded-lg">
              <Plus className="w-4 h-4" />
            </div>
            <h2 className="font-black text-base sm:text-lg text-slate-800">新增紀錄</h2>
          </div>
          <div className="card-body p-4 sm:p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div className="col-span-1">
                <label className="label py-0.5 sm:py-1 mb-0.5"><span className="label-text font-bold text-slate-400 text-xs uppercase">類型</span></label>
                <select className="select select-sm sm:select-md select-bordered w-full rounded-xl focus:border-emerald-500 font-bold" value={formType} onChange={(e) => setFormType(e.target.value)}>
                  {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="col-span-1">
                <label className="label py-0.5 sm:py-1 mb-0.5"><span className="label-text font-bold text-slate-400 text-xs uppercase">持有人</span></label>
                <input className="input input-sm sm:input-md input-bordered w-full rounded-xl focus:border-emerald-500" value={formOwnerName} onChange={(e) => setFormOwnerName(e.target.value)} placeholder="如：自己、老公" />
              </div>
              <div className="col-span-2">
                <label className="label py-0.5 sm:py-1 mb-0.5"><span className="label-text font-bold text-slate-400 text-xs uppercase">銀行/卡片名稱</span></label>
                <input className="input input-sm sm:input-md input-bordered w-full rounded-xl font-bold focus:border-emerald-500" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="如：國泰世華、玉山 Cube" />
              </div>
              
              {/* ✅ 獨立出卡號/帳號輸入框 */}
              <div className="col-span-2 md:col-span-2">
                <label className="label py-0.5 sm:py-1 mb-0.5"><span className="label-text font-bold text-slate-400 text-xs uppercase">帳號 / 卡號</span></label>
                <input className="input input-sm sm:input-md input-bordered w-full rounded-xl focus:border-emerald-500 font-mono tracking-wide placeholder:font-sans" value={formAccountNumber} onChange={(e) => setFormAccountNumber(e.target.value)} placeholder="000-0000-0000" />
              </div>

              <div className="col-span-2 md:col-span-2">
                <label className="label py-0.5 sm:py-1 mb-0.5"><span className="label-text font-bold text-slate-400 text-xs uppercase">備註</span></label>
                <input className="input input-sm sm:input-md input-bordered w-full rounded-xl focus:border-emerald-500" value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="如：繳費帳戶、結帳日5號" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="btn bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl sm:rounded-2xl px-8 font-black border-none w-full sm:w-auto" onClick={submitNew} disabled={saving}>
                儲存紀錄
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="card bg-white shadow-none sm:shadow-sm border-y sm:border border-slate-200 rounded-none sm:rounded-3xl overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Building2 className="w-4 h-4" /> 備忘清單
            </h2>
            {loading && <span className="loading loading-spinner loading-xs text-emerald-500"></span>}
          </div>

          <div className="flex flex-col">
            {!loading && list.length === 0 ? (
              <div className="p-16 text-center text-slate-300 font-bold">目前沒有任何紀錄</div>
            ) : (
              list.map((r) => (
                <SwipeableRow key={r.id} onEdit={() => openEdit(r)} onDelete={() => deleteRow(r.id)}>
                  <div className="group relative px-4 py-4 sm:px-6 hover:bg-slate-50 transition-colors">
                    
                    {/* PC 端按鈕 */}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:flex flex-row gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="btn btn-ghost btn-xs h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" onClick={() => openEdit(r)}>
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button className="btn btn-ghost btn-xs h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => deleteRow(r.id)}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-start gap-3 sm:gap-4 pr-0 sm:pr-24">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200 mt-1">
                        {r.type === 'credit_card' ? <CreditCard className="w-5 h-5 sm:w-6 sm:h-6" /> : <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />}
                      </div>
                      
                      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black text-slate-900 text-sm sm:text-base leading-tight truncate">{r.name}</h3>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-bold text-[10px] sm:text-xs">
                            {getTypeLabel(r.type)}
                          </span>
                          {r.owner_name && (
                            <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 font-bold text-[10px] sm:text-xs border border-sky-100">
                              {r.owner_name}
                            </span>
                          )}
                        </div>

                        {/* ✅ 獨立帳號顯示，支援一鍵複製 */}
                        {r.account_number && (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm sm:text-[15px] font-bold text-slate-700 tracking-wide select-all bg-slate-100/50 px-2 py-0.5 rounded-md border border-slate-200/50">
                              {r.account_number}
                            </span>
                            <button 
                              onClick={(e) => handleCopy(r.account_number!, r.id, e)}
                              className="text-slate-400 hover:text-emerald-600 transition-colors p-1"
                              title="複製帳號"
                            >
                              {copiedId === r.id ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        )}

                        {r.note && (
                          <div className="text-xs text-slate-500 leading-snug">
                            備註：{r.note}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </SwipeableRow>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="modal modal-open bg-slate-900/40 backdrop-blur-sm p-2 sm:p-0">
          <div className="modal-box w-full max-w-md rounded-2xl sm:rounded-3xl p-0 shadow-2xl">
            <div className="bg-slate-50 px-5 sm:px-6 py-4 flex items-center justify-between border-b border-slate-200">
              <h3 className="text-lg font-black text-slate-800">修改紀錄</h3>
              <button className="btn btn-sm btn-circle btn-ghost" onClick={() => setEditing(null)}>✕</button>
            </div>
            
            <div className="p-5 sm:p-6 space-y-4 bg-white">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-1">
                  <label className="label py-0 mb-1"><span className="label-text font-bold text-[10px] text-slate-400 uppercase">類型</span></label>
                  <select className="select select-bordered w-full rounded-xl focus:border-emerald-500 font-bold" value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                    {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="label py-0 mb-1"><span className="label-text font-bold text-[10px] text-slate-400 uppercase">持有人</span></label>
                  <input className="input input-bordered w-full rounded-xl focus:border-emerald-500" value={editForm.owner_name} onChange={(e) => setEditForm({ ...editForm, owner_name: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="label py-0 mb-1"><span className="label-text font-bold text-[10px] text-slate-400 uppercase">銀行/卡片名稱</span></label>
                  <input className="input input-bordered w-full rounded-xl font-bold focus:border-emerald-500" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                
                {/* ✅ 編輯 Modal 加上卡號 */}
                <div className="col-span-2">
                  <label className="label py-0 mb-1"><span className="label-text font-bold text-[10px] text-slate-400 uppercase">帳號 / 卡號</span></label>
                  <input className="input input-bordered w-full rounded-xl focus:border-emerald-500 font-mono tracking-wide placeholder:font-sans" value={editForm.account_number} onChange={(e) => setEditForm({ ...editForm, account_number: e.target.value })} placeholder="000-0000-0000" />
                </div>

                <div className="col-span-2">
                  <label className="label py-0 mb-1"><span className="label-text font-bold text-[10px] text-slate-400 uppercase">備註</span></label>
                  <input className="input input-bordered w-full rounded-xl focus:border-emerald-500" value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-4 flex justify-end gap-3 border-t border-slate-200">
              <button className="btn btn-ghost rounded-xl text-slate-600 font-bold" onClick={() => setEditing(null)}>取消</button>
              <button className="btn bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-xl px-6 font-black" onClick={submitEdit}>確認修改</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setEditing(null)}></div>
        </div>
      )}
    </main>
  );
}
