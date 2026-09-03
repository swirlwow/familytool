"use client";

import { ExternalLink, Plus, Store, Trash2 } from "lucide-react";
import type { ShoppingSource } from "@/lib/shoppingRepo";

export type ShoppingSourceDraft = Pick<ShoppingSource, "platform" | "url" | "note"> & { id?: string; price: string };

export const emptyShoppingSource = (): ShoppingSourceDraft => ({ platform: "", url: "", price: "", note: "" });

export function draftSources(sources: ShoppingSource[]) {
  const rows: ShoppingSourceDraft[] = sources.map((source) => ({
    id: source.id, platform: source.platform ?? "", url: source.url ?? "", price: source.price === null ? "" : String(source.price), note: source.note ?? "",
  }));
  while (rows.length < 3) rows.push(emptyShoppingSource());
  return rows;
}

export function bestShoppingPrice(sources: ShoppingSource[]) {
  const prices = sources.map((source) => source.price).filter((price): price is number => price !== null);
  return prices.length ? Math.min(...prices) : null;
}

export function SourceComparisonEditor({ sources, onChange }: { sources: ShoppingSourceDraft[]; onChange: (sources: ShoppingSourceDraft[]) => void }) {
  const update = (index: number, key: keyof ShoppingSourceDraft, value: string) => onChange(sources.map((source, rowIndex) => rowIndex === index ? { ...source, [key]: value } : source));
  const remove = (index: number) => {
    const next = sources.filter((_, rowIndex) => rowIndex !== index);
    while (next.length < 3) next.push(emptyShoppingSource());
    onChange(next);
  };

  return (
    <section className="sm:col-span-2 overflow-hidden rounded-2xl border border-[var(--ft-line)] bg-[#fffaf5]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--ft-line)] px-4 py-3">
        <div><h3 className="flex items-center gap-2 text-sm font-black text-[var(--ft-plum)]"><Store className="h-4 w-4 text-[var(--ft-peach)]" />購買來源比價</h3><p className="mt-0.5 text-xs text-[var(--ft-plum-soft)]">可記錄三個以上的平台、價格與優惠條件</p></div>
        <button type="button" className="btn btn-ghost btn-sm rounded-xl text-[var(--ft-wine)]" onClick={() => onChange([...sources, emptyShoppingSource()])}><Plus className="h-4 w-4" />增加來源</button>
      </div>
      <div className="hidden grid-cols-[130px_minmax(220px,1fr)_120px_minmax(180px,0.8fr)_36px] gap-2 px-4 pb-1 pt-3 text-xs font-bold text-[var(--ft-plum-soft)] lg:grid">
        <span>平台／店家</span><span>網址</span><span>價格</span><span>來源備註</span><span />
      </div>
      <div className="grid gap-3 p-3 lg:gap-2 lg:pt-1">
        {sources.map((source, index) => (
          <div key={source.id ?? index} className="grid gap-2 rounded-xl border border-[var(--ft-line)] bg-white p-3 lg:grid-cols-[130px_minmax(220px,1fr)_120px_minmax(180px,0.8fr)_36px] lg:border-0 lg:bg-transparent lg:p-1">
            <label><span className="mb-1 block text-xs font-bold text-[var(--ft-plum-soft)] lg:hidden">平台／店家</span><input className="input input-bordered h-10 min-h-0 w-full rounded-xl border-[var(--ft-line)] bg-white" placeholder={`來源 ${index + 1}`} value={source.platform ?? ""} onChange={(event) => update(index, "platform", event.target.value)} /></label>
            <label><span className="mb-1 block text-xs font-bold text-[var(--ft-plum-soft)] lg:hidden">網址</span><div className="flex gap-1"><input type="url" className="input input-bordered h-10 min-h-0 min-w-0 flex-1 rounded-xl border-[var(--ft-line)] bg-white" placeholder="https://..." value={source.url ?? ""} onChange={(event) => update(index, "url", event.target.value)} />{source.url && <a href={source.url} target="_blank" rel="noreferrer" className="btn btn-ghost h-10 min-h-0 w-10 rounded-xl p-0" aria-label={`開啟來源 ${index + 1}`}><ExternalLink className="h-4 w-4" /></a>}</div></label>
            <label><span className="mb-1 block text-xs font-bold text-[var(--ft-plum-soft)] lg:hidden">價格</span><input type="number" min="0" step="1" className="input input-bordered h-10 min-h-0 w-full rounded-xl border-[var(--ft-line)] bg-white" placeholder="0" value={source.price} onChange={(event) => update(index, "price", event.target.value)} /></label>
            <label><span className="mb-1 block text-xs font-bold text-[var(--ft-plum-soft)] lg:hidden">來源備註</span><input className="input input-bordered h-10 min-h-0 w-full rounded-xl border-[var(--ft-line)] bg-white" placeholder="優惠、贈品或期限" value={source.note ?? ""} onChange={(event) => update(index, "note", event.target.value)} /></label>
            <button type="button" className="btn btn-ghost h-10 min-h-0 w-full rounded-xl text-rose-500 lg:w-9 lg:p-0" aria-label={`移除來源 ${index + 1}`} onClick={() => remove(index)}><Trash2 className="h-4 w-4" /><span className="lg:hidden">清除此來源</span></button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SourceComparisonList({ sources }: { sources: ShoppingSource[] }) {
  if (!sources.length) return null;
  const validPrices = sources.map((source) => source.price).filter((price): price is number => price !== null);
  const lowest = validPrices.length ? Math.min(...validPrices) : null;
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--ft-line)] bg-white">
      {sources.map((source, index) => (
        <div key={source.id} className="grid grid-cols-[minmax(72px,0.8fr)_auto_32px] items-center gap-2 border-b border-[var(--ft-line)] px-3 py-2 text-xs last:border-b-0">
          <div className="min-w-0"><strong className="block truncate text-[var(--ft-plum)]">{source.platform || `來源 ${index + 1}`}</strong>{source.note && <span className="block truncate text-[var(--ft-plum-soft)]" title={source.note}>{source.note}</span>}</div>
          <strong className={source.price !== null && source.price === lowest ? "text-emerald-600" : "text-[var(--ft-plum)]"}>{source.price === null ? "未填價格" : new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(source.price)}</strong>
          {source.url ? <a href={source.url} target="_blank" rel="noreferrer" className="btn btn-ghost h-8 min-h-0 w-8 rounded-lg p-0 text-[var(--ft-wine)]" aria-label={`開啟 ${source.platform || `來源 ${index + 1}`}`}><ExternalLink className="h-3.5 w-3.5" /></a> : <span />}
        </div>
      ))}
    </div>
  );
}
