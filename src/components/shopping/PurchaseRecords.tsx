"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import controls from "@/components/ui/record-controls.module.css";
import { useToast } from "@/hooks/use-toast";
import { filterPurchases, normalizePurchase, purchaseWishlistSnapshot, type Purchase } from "@/lib/purchases";
import type { ShoppingItem } from "@/lib/shoppingRepo";

type Draft = {id?:string; shopping_item_id:string|null; request_key:string; name:string; purchase_date:string;
  quantity:string; total_amount:string; store:string; url:string; specification:string; note:string; legacy:boolean};
const inputClass="input input-bordered w-full min-w-0 rounded-xl bg-white";
const money=(n:number)=>new Intl.NumberFormat("zh-TW",{style:"currency",currency:"TWD",maximumFractionDigits:2}).format(n);
const priorityLabel={low:"想買",normal:"一般",high:"優先"} as const;
function today() { const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function makeDraft(row?:Purchase,item?:ShoppingItem):Draft {
  return {id:row?.id,shopping_item_id:row?.shopping_item_id ?? item?.id ?? null,request_key:crypto.randomUUID(),
    name:row?.name ?? item?.name ?? "",purchase_date:row ? row.purchase_date ?? "" : today(),
    quantity:String(row?.quantity ?? 1),total_amount:row?.total_amount == null ? "" : String(row.total_amount),
    store:row?.store ?? "",url:row?.url ?? "",specification:row?.specification ?? "",note:row?.note ?? item?.note ?? "",legacy:row?.legacy ?? false};
}
function WishlistSnapshot({row}:{row:Purchase}) {
  const snapshot=purchaseWishlistSnapshot(row.wishlist_snapshot);
  if(!snapshot)return null;
  const hasMeta=snapshot.requested_by||snapshot.purchase_for||snapshot.planned_date||snapshot.note;
  if(!hasMeta&&!snapshot.sources.length)return null;
  return <details className="mt-3 rounded-xl border border-violet-100 bg-violet-50/40 p-3 text-sm">
    <summary className="cursor-pointer font-semibold text-violet-800">原待購資料與比價來源（{snapshot.sources.length}）</summary>
    <div className="mt-3 space-y-3">
      {hasMeta&&<div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-600"><span>優先程度：{priorityLabel[snapshot.priority]}</span>{snapshot.planned_date&&<span>原預計：{snapshot.planned_date}</span>}{snapshot.requested_by&&<span>提出：{snapshot.requested_by}</span>}{snapshot.purchase_for&&<span>購買給：{snapshot.purchase_for}</span>}</div>}
      {snapshot.note&&<p className="whitespace-pre-wrap break-words text-slate-700">{snapshot.note}</p>}
      {snapshot.sources.length>0&&<div className="divide-y rounded-xl border bg-white">{snapshot.sources.map((source,index)=><div key={`${source.url||source.platform||"source"}-${index}`} className="grid gap-1 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0"><strong>{source.platform||`來源 ${index+1}`}</strong>{source.note&&<p className="break-words text-xs text-slate-500">{source.note}</p>}</div>
        {source.price!==null&&Number.isFinite(source.price)&&<strong className="tabular-nums text-emerald-700">{money(source.price)}</strong>}
        {source.url&&/^https?:\/\//i.test(source.url)&&<a className="break-all text-violet-700 underline sm:col-span-2" href={source.url} target="_blank" rel="noopener noreferrer">開啟原商品連結</a>}
      </div>)}</div>}
    </div>
  </details>;
}
function Modal({title,children,onClose,busy=false}:{title:string;children:ReactNode;onClose:()=>void;busy?:boolean}) {
  return <Dialog.Root open onOpenChange={open=>{if(!open&&!busy)onClose();}}><Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-[90] bg-slate-900/40" />
    <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-1/2 z-[91] flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-white shadow-xl">
      <div className="flex items-center justify-between border-b p-4"><Dialog.Title className="text-xl font-bold">{title}</Dialog.Title><button type="button" aria-label="關閉購買表單" disabled={busy} className={controls.button} onClick={onClose}>✕</button></div>
      <div className="overflow-y-auto p-4 pb-6">{children}</div>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
export function PurchaseRecords({workspaceId,visible,source,onSourceClose,onChanged,onShowWishlist}:{workspaceId:string;visible:boolean;source:ShoppingItem|null;onSourceClose:()=>void;onChanged:()=>void;onShowWishlist:()=>void;}) {
  const {toast}=useToast();
  const [rows,setRows]=useState<Purchase[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [query,setQuery]=useState(""),[from,setFrom]=useState(""),[to,setTo]=useState(""),[store,setStore]=useState("");
  const [draft,setDraft]=useState<Draft|null>(null),[deleting,setDeleting]=useState<Purchase|null>(null),[restore,setRestore]=useState(false);
  const [busy,setBusy]=useState(false),[formError,setFormError]=useState("");
  const lock=useRef(false),opened=useRef<string|null>(null),rebuyKeys=useRef(new Map<string,string>());
  async function load(){setError("");setLoading(true);try{const r=await fetch("/api/purchases?workspace_id="+encodeURIComponent(workspaceId),{cache:"no-store"});const j=await r.json();if(!r.ok)throw Error(j.error);setRows(j.data);}catch(e){setError(e instanceof Error?e.message:"讀取失敗");}finally{setLoading(false);}}
  useEffect(()=>{if(workspaceId)void load();else setLoading(false);},[workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{if(!source){opened.current=null;return;}if(loading||error||opened.current===source.id)return;opened.current=source.id;setDraft(makeDraft(rows.find(r=>r.shopping_item_id===source.id),source));setFormError("");},[source,rows,loading,error]);
  function close(){setDraft(null);setFormError("");onSourceClose();}
  async function request(method:string,body:Record<string,unknown>){const r=await fetch("/api/purchases",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify({...body,workspace_id:workspaceId})});const j=await r.json();if(!r.ok)throw Error(j.error||"儲存失敗");return j.data;}
  async function save(){if(!draft||lock.current)return;lock.current=true;setBusy(true);setFormError("");try{const payload=normalizePurchase(draft,draft.legacy);const saved:Purchase=await request(draft.id?"PATCH":"POST",{...payload,id:draft.id,shopping_item_id:draft.shopping_item_id,request_key:draft.request_key});setRows(prev=>[saved,...prev.filter(r=>r.id!==saved.id)]);close();onChanged();toast({title:"購買紀錄已儲存",description:"原待購資料與比價來源已保留，不會自動建立記帳。"});}catch(e){setFormError(e instanceof Error?e.message:"儲存失敗，請重試");}finally{lock.current=false;setBusy(false);}}
  async function remove(){if(!deleting||lock.current)return;lock.current=true;setBusy(true);setFormError("");try{await request("DELETE",{id:deleting.id,restore});setRows(prev=>prev.filter(r=>r.id!==deleting.id));setDeleting(null);onChanged();toast({title:restore?"已刪除紀錄並恢復待購":"購買紀錄已刪除"});}catch(e){setFormError(e instanceof Error?e.message:"刪除失敗");}finally{lock.current=false;setBusy(false);}}
  async function rebuy(row:Purchase){if(lock.current)return;lock.current=true;setBusy(true);const key=rebuyKeys.current.get(row.id)??crypto.randomUUID();rebuyKeys.current.set(row.id,key);try{await request("POST",{action:"rebuy",id:row.id,request_key:key});rebuyKeys.current.delete(row.id);onChanged();onShowWishlist();toast({title:"已再次加入待購",description:"原購買紀錄仍保留。"});}catch(e){toast({variant:"destructive",title:"加入待購失敗",description:e instanceof Error?e.message:"請重試"});}finally{lock.current=false;setBusy(false);}}
  const filtered=filterPurchases(rows,query,from,to,store),total=filtered.reduce((n,r)=>n+(r.total_amount==null?0:Number(r.total_amount)),0),missing=filtered.filter(r=>r.total_amount==null).length;
  return <>
    {error&&(visible||source)&&<div role="alert" className="alert alert-error"><span>購買紀錄讀取失敗：{error}</span><button className={controls.button} onClick={()=>void load()}>重試</button>{source&&<button className={controls.button} onClick={onSourceClose}>取消</button>}</div>}
    <section hidden={!visible} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">購買紀錄</h2><p className="text-sm text-slate-500">保留實際購買資料，以及完成當下的原待購內容與全部比價來源。</p></div><button disabled={busy||loading||!!error} className={controls.button} onClick={()=>{setDraft(makeDraft());setFormError("");}}>新增購買</button></div>
      <div className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm">搜尋<input className={inputClass} placeholder="品名、型號、店家、備註" value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="text-sm">購買起日<input type="date" className={inputClass} value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="text-sm">購買迄日<input type="date" className={inputClass} value={to} onChange={e=>setTo(e.target.value)}/></label><label className="text-sm">店家／平台<select className="select select-bordered w-full rounded-xl" value={store} onChange={e=>setStore(e.target.value)}><option value="">全部店家</option>{[...new Set(rows.map(r=>r.store).filter((v):v is string=>!!v))].sort().map(s=><option key={s}>{s}</option>)}</select></label>{from&&to&&from>to&&<p role="alert" className="text-red-600">起日不可晚於迄日</p>}</div>
      <p className="text-sm text-slate-600">目前查詢：{filtered.length} 筆 · 已填金額合計 <strong className="text-slate-900">{money(total)}</strong>{missing>0&&<span> · {missing} 筆金額未填（不計入合計）</span>}{(from||to)&&<span> · 日期待補的紀錄不列入日期篩選</span>}</p>
      {loading?<p role="status">讀取購買紀錄…</p>:!error&&filtered.length===0?<div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">沒有符合的購買紀錄。可直接新增，或從待購項目完成購買。</div>:<div className="grid gap-3 lg:grid-cols-2">{filtered.map(row=><article key={row.id} className="min-w-0 rounded-2xl border bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-slate-500">{row.purchase_date||"日期待補"}{row.legacy&&" · 舊待購資料"}</p><h3 className="break-words text-lg font-bold">{row.name}</h3><p className="break-words text-sm text-slate-500">{row.specification||"規格未填"}</p></div><strong className="shrink-0 tabular-nums">{row.total_amount==null?"金額未填":money(Number(row.total_amount))}</strong></div><p className="mt-3 break-words text-sm">{row.store||"店家未填"} · 數量 {Number(row.quantity)}</p>{(row.url||row.note)&&<details className="mt-3 text-sm"><summary className="cursor-pointer text-violet-700">實際購買詳情</summary>{row.url&&/^https?:\/\//i.test(row.url)&&<a className="mt-2 block break-all underline" href={row.url} target="_blank" rel="noopener noreferrer">實際購買連結</a>}{row.note&&<p className="mt-2 whitespace-pre-wrap break-words">{row.note}</p>}</details>}<WishlistSnapshot row={row}/><div className="mt-4 flex flex-wrap gap-2 border-t pt-3"><button disabled={busy} className={controls.button} onClick={()=>{setDraft(makeDraft(row));setFormError("");}}>修改</button><button disabled={busy} className={controls.button} onClick={()=>{setDeleting(row);setRestore(false);setFormError("");}}>刪除</button><button disabled={busy} className={`${controls.button} ml-auto`} onClick={()=>void rebuy(row)}>再次加入待購</button></div></article>)}</div>}
    </section>
    {draft&&<Modal title={draft.id?"修改購買紀錄":"記錄這次購買"} onClose={close} busy={busy}><form onSubmit={e=>{e.preventDefault();void save();}} className="space-y-4">{source?.sources.length?<label className="block text-sm">實際購買來源（原本的全部來源仍會保留）<select className="select select-bordered w-full rounded-xl" defaultValue="" onChange={e=>{const s=source.sources.find(x=>x.id===e.target.value);if(s)setDraft({...draft,store:s.platform||"",url:s.url||""});}}><option value="">手動填寫／選擇來源</option>{source.sources.map(s=><option key={s.id} value={s.id}>{s.platform||s.url||"未命名來源"}</option>)}</select></label>:null}<div className="grid gap-3 sm:grid-cols-2"><label className="sm:col-span-2">品名<input autoFocus required maxLength={200} className={inputClass} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>購買日期{draft.legacy&&"（可待補）"}<input required={!draft.legacy} type="date" className={inputClass} value={draft.purchase_date} onChange={e=>setDraft({...draft,purchase_date:e.target.value})}/></label><label>數量<input required type="number" min="0.001" step="0.001" className={inputClass} value={draft.quantity} onChange={e=>setDraft({...draft,quantity:e.target.value})}/></label><label>實付總額（選填）<input type="number" min="0" step="0.01" placeholder="不知道可留空" className={inputClass} value={draft.total_amount} onChange={e=>setDraft({...draft,total_amount:e.target.value})}/></label><label>店家／平台<input maxLength={120} className={inputClass} value={draft.store} onChange={e=>setDraft({...draft,store:e.target.value})}/></label><label className="sm:col-span-2">商品連結<input type="url" maxLength={2048} className={inputClass} value={draft.url} onChange={e=>setDraft({...draft,url:e.target.value})}/></label><label className="sm:col-span-2">規格／型號<input maxLength={300} className={inputClass} value={draft.specification} onChange={e=>setDraft({...draft,specification:e.target.value})}/></label><label className="sm:col-span-2">備註<textarea maxLength={1000} className="textarea textarea-bordered w-full rounded-xl" value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})}/></label></div>{formError&&<p role="alert" className="text-red-600">{formError}</p>}<div className="sticky bottom-0 flex justify-end gap-2 border-t bg-white py-3"><button type="button" disabled={busy} className={controls.button} onClick={close}>取消</button><button disabled={busy} className={controls.button}>{busy?"儲存中…":"儲存購買紀錄"}</button></div></form></Modal>}
    {deleting&&<Modal title="刪除購買紀錄" busy={busy} onClose={()=>setDeleting(null)}><p>確定刪除「{deleting.name}」這次購買？其他購買紀錄不受影響。</p>{deleting.shopping_item_id&&<label className="my-4 flex items-center gap-2"><input type="checkbox" className="checkbox" checked={restore} onChange={e=>setRestore(e.target.checked)}/>同時將原項目恢復為待購（保留比價來源）</label>}{formError&&<p role="alert" className="text-red-600">{formError}</p>}<div className="mt-4 flex justify-end gap-2"><button disabled={busy} className={controls.button} onClick={()=>setDeleting(null)}>取消</button><button disabled={busy} className={controls.button} onClick={()=>void remove()}>確認刪除</button></div></Modal>}
  </>;
}
