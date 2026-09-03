"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  BadgeDollarSign,
  CalendarClock,
  ExternalLink,
  Link2,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  ShoppingBasket,
  SlidersHorizontal,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ShoppingItem, ShoppingPriority, ShoppingStatus } from "@/lib/shoppingRepo";
import { bestShoppingPrice, draftSources, emptyShoppingSource, SourceComparisonEditor, SourceComparisonList, type ShoppingSourceDraft } from "@/components/shopping/SourceComparisonEditor";

const WORKSPACE_ID = process.env.NEXT_PUBLIC_WORKSPACE_ID || "";
const SHOPPING_THEME = {
  "--ft-paper": "#ffffff",
  "--ft-line": "#e2e8f0",
  "--ft-plum": "#0f172a",
  "--ft-plum-soft": "#64748b",
  "--ft-rose": "#e11d48",
  "--ft-rose-pale": "#ffe4e6",
  "--ft-peach": "#f97316",
  "--ft-wine": "#6d28d9",
  "--ft-shadow": "0 1px 2px rgba(15, 23, 42, 0.06)",
} as CSSProperties;

const STATUS_OPTIONS: Array<{ value: ShoppingStatus | "all"; label: string }> = [
  { value: "all", label: "全部" },
  { value: "pending", label: "待確認" },
  { value: "planned", label: "預計購買" },
  { value: "waiting_sale", label: "等待優惠" },
  { value: "purchased", label: "已購買" },
  { value: "skipped", label: "不購買" },
];

const STATUS_STYLE: Record<ShoppingStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  planned: "bg-sky-50 text-sky-700 border-sky-200",
  waiting_sale: "bg-violet-50 text-violet-700 border-violet-200",
  purchased: "bg-emerald-50 text-emerald-700 border-emerald-200",
  skipped: "bg-slate-100 text-slate-500 border-slate-200",
};

const PRIORITY_LABEL: Record<ShoppingPriority, string> = {
  low: "一般",
  normal: "想買",
  high: "優先",
};

type Draft = {
  id?: string;
  name: string;
  url: string;
  estimated_price: string;
  platform: string;
  sources: ShoppingSourceDraft[];
  requested_by: string;
  purchase_for: string;
  priority: ShoppingPriority;
  planned_date: string;
  status: ShoppingStatus;
  note: string;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  url: "",
  estimated_price: "",
  platform: "",
  sources: [emptyShoppingSource(), emptyShoppingSource(), emptyShoppingSource()],
  requested_by: "",
  purchase_for: "",
  priority: "normal",
  planned_date: "",
  status: "pending",
  note: "",
};

function statusLabel(status: ShoppingStatus) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function priceText(value: number | null) {
  if (value === null) return "未填價格";
  return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(value);
}

function toDraft(item: ShoppingItem): Draft {
  return {
    id: item.id,
    name: item.name,
    url: item.url ?? "",
    estimated_price: item.estimated_price === null ? "" : String(item.estimated_price),
    platform: item.platform ?? "",
    sources: draftSources(item.sources, { platform: item.platform, url: item.url, price: item.estimated_price }),
    requested_by: item.requested_by ?? "",
    purchase_for: item.purchase_for ?? "",
    priority: item.priority,
    planned_date: item.planned_date ?? "",
    status: item.status,
    note: item.note ?? "",
  };
}

export default function ShoppingPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickValue, setQuickValue] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ShoppingStatus | "all">("all");
  const [sortMode, setSortMode] = useState<"priority" | "date" | "newest">("priority");
  const [draft, setDraft] = useState<Draft | null>(null);

  async function loadItems() {
    if (!WORKSPACE_ID) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/shopping?workspace_id=${encodeURIComponent(WORKSPACE_ID)}`, { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "讀取失敗");
      setItems(Array.isArray(json.data) ? json.data : []);
    } catch (error) {
      toast({ variant: "destructive", title: "讀取待購清單失敗", description: error instanceof Error ? error.message : "請稍後再試" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const priorityWeight: Record<ShoppingPriority, number> = { high: 3, normal: 2, low: 1 };
    const filtered = items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!keyword) return true;
      const sourceValues = item.sources.flatMap((source) => [source.platform, source.url, source.note, source.price]);
      return [item.name, item.platform, item.requested_by, item.purchase_for, item.note, item.url, ...sourceValues]
        .some((value) => String(value ?? "").toLowerCase().includes(keyword));
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === "date") return (a.planned_date || "9999-12-31").localeCompare(b.planned_date || "9999-12-31");
      if (sortMode === "newest") return b.created_at.localeCompare(a.created_at);
      return priorityWeight[b.priority] - priorityWeight[a.priority]
        || (a.planned_date || "9999-12-31").localeCompare(b.planned_date || "9999-12-31");
    });
  }, [items, query, sortMode, statusFilter]);

  const activeItems = items.filter((item) => !["purchased", "skipped"].includes(item.status));
  const estimatedTotal = activeItems.reduce((sum, item) => sum + Number(bestShoppingPrice(item.sources, item.estimated_price) || 0), 0);
  const waitingCount = items.filter((item) => item.status === "waiting_sale").length;

  async function saveItem(input: Record<string, unknown>, id?: string, forceDuplicate = false): Promise<ShoppingItem | null> {
    const response = await fetch(id ? `/api/shopping/${encodeURIComponent(id)}` : "/api/shopping", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, workspace_id: WORKSPACE_ID, force_duplicate: forceDuplicate }),
    });
    const json = await response.json().catch(() => ({}));
    if (response.status === 409 && !forceDuplicate) {
      if (window.confirm(`${json.error}\n仍要儲存這筆資料嗎？`)) return saveItem(input, id, true);
      return null;
    }
    if (!response.ok) throw new Error(json.error || "儲存失敗");
    return json.data as ShoppingItem;
  }

  async function quickAdd() {
    const value = quickValue.trim();
    if (!value || !WORKSPACE_ID) return;
    setQuickSaving(true);
    try {
      const isUrl = /^https?:\/\//i.test(value);
      const item = await saveItem(isUrl ? { url: value } : { name: value });
      if (!item) return;
      setItems((current) => [item, ...current]);
      setQuickValue("");
      toast({ title: "已加入待購清單", description: isUrl ? "連結已保存，可再補上商品資料。" : item.name });
    } catch (error) {
      toast({ variant: "destructive", title: "快速新增失敗", description: error instanceof Error ? error.message : "請稍後再試" });
    } finally {
      setQuickSaving(false);
    }
  }

  async function submitDraft() {
    if (!draft || !WORKSPACE_ID) return;
    if (!draft.name.trim() && !draft.url.trim() && !draft.sources.some((source) => source.url?.trim())) {
      toast({ variant: "destructive", title: "請輸入商品名稱或連結" });
      return;
    }
    setSaving(true);
    try {
      const sources = draft.sources.map((source) => ({ ...source, price: source.price || null }));
      const item = await saveItem({ ...draft, sources, estimated_price: draft.estimated_price || null }, draft.id);
      if (!item) return;
      setItems((current) => draft.id ? current.map((row) => row.id === item.id ? item : row) : [item, ...current]);
      setDraft(null);
      toast({ title: draft.id ? "待購資料已更新" : "已新增待購項目" });
    } catch (error) {
      toast({ variant: "destructive", title: "儲存失敗", description: error instanceof Error ? error.message : "請稍後再試" });
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(item: ShoppingItem, status: ShoppingStatus) {
    try {
      const updated = await saveItem({ status }, item.id);
      if (updated) setItems((current) => current.map((row) => row.id === item.id ? updated : row));
    } catch (error) {
      toast({ variant: "destructive", title: "狀態更新失敗", description: error instanceof Error ? error.message : "請稍後再試" });
    }
  }

  async function removeItem(item: ShoppingItem) {
    if (!window.confirm(`確定移除「${item.name}」？`)) return;
    try {
      const response = await fetch(`/api/shopping/${encodeURIComponent(item.id)}?workspace_id=${encodeURIComponent(WORKSPACE_ID)}`, { method: "DELETE" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "刪除失敗");
      setItems((current) => current.filter((row) => row.id !== item.id));
      toast({ title: "已移除待購項目" });
    } catch (error) {
      toast({ variant: "destructive", title: "移除失敗", description: error instanceof Error ? error.message : "請稍後再試" });
    }
  }

  return (
    <main style={SHOPPING_THEME} className="app-page mx-auto w-full max-w-7xl space-y-5">
      <section className="overflow-hidden rounded-[26px] border border-[var(--ft-line)] bg-[var(--ft-paper)] shadow-[var(--ft-shadow)]">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.78fr)] lg:p-7">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff0d8] text-[#c65b19]">
              <ShoppingBasket className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="mb-1 text-xs font-bold tracking-[0.18em] text-[var(--ft-peach)]">生活採買</p>
              <h1 className="text-2xl font-black text-[var(--ft-plum)] sm:text-3xl">待購清單</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ft-plum-soft)]">先把連結留下來，再決定何時買。待確認、等優惠和已購買都集中在這裡。</p>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-[#efb383] bg-[#fff9ef] p-3.5">
            <label htmlFor="quick-shopping" className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--ft-plum)]">
              <Link2 className="h-4 w-4 text-[var(--ft-peach)]" />快速收進清單
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input id="quick-shopping" className="input input-bordered h-11 min-h-0 flex-1 rounded-xl border-[var(--ft-line)] bg-white text-[var(--ft-plum)]" placeholder="貼上商品連結，或直接輸入品名" value={quickValue} onChange={(event) => setQuickValue(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void quickAdd()} />
              <button className="btn h-11 min-h-0 rounded-xl border-0 bg-[var(--ft-peach)] px-5 text-white hover:bg-[#dc5621]" disabled={!quickValue.trim() || quickSaving} onClick={() => void quickAdd()}>
                {quickSaving ? <span className="loading loading-spinner loading-sm" /> : <Plus className="h-4 w-4" />}加入
              </button>
            </div>
          </div>
        </div>

        <div className="grid border-t border-[var(--ft-line)] sm:grid-cols-3">
          <div className="flex items-center gap-3 px-5 py-4 sm:border-r sm:border-[var(--ft-line)]">
            <ShoppingBasket className="h-5 w-5 text-[var(--ft-rose)]" /><div><span className="text-xs text-[var(--ft-plum-soft)]">待處理</span><strong className="ml-2 text-xl text-[var(--ft-plum)]">{activeItems.length}</strong></div>
          </div>
          <div className="flex items-center gap-3 border-y border-[var(--ft-line)] px-5 py-4 sm:border-y-0 sm:border-r">
            <BadgeDollarSign className="h-5 w-5 text-emerald-600" /><div><span className="text-xs text-[var(--ft-plum-soft)]">預估合計</span><strong className="ml-2 text-xl text-[var(--ft-plum)]">{priceText(estimatedTotal)}</strong></div>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <CalendarClock className="h-5 w-5 text-violet-600" /><div><span className="text-xs text-[var(--ft-plum-soft)]">等待優惠</span><strong className="ml-2 text-xl text-[var(--ft-plum)]">{waitingCount}</strong></div>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-[var(--ft-line)] bg-[var(--ft-paper)] p-4 shadow-[var(--ft-shadow)] sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {STATUS_OPTIONS.map((option) => (
              <button key={option.value} className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-bold transition ${statusFilter === option.value ? "border-[var(--ft-rose)] bg-[var(--ft-rose-pale)] text-[var(--ft-rose)]" : "border-[var(--ft-line)] bg-white text-[var(--ft-plum-soft)] hover:border-[#d7b9c8]"}`} onClick={() => setStatusFilter(option.value)}>
                {option.label}{option.value !== "all" && <span className="ml-1.5 opacity-60">{items.filter((item) => item.status === option.value).length}</span>}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ft-plum-soft)]" />
              <input className="input input-bordered h-10 min-h-0 w-full rounded-xl border-[var(--ft-line)] bg-white pl-9" placeholder="搜尋商品、平台或備註" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <label className="flex h-10 items-center gap-2 rounded-xl border border-[var(--ft-line)] bg-white px-3 text-sm text-[var(--ft-plum-soft)]">
              <SlidersHorizontal className="h-4 w-4" />
              <select className="bg-transparent font-bold text-[var(--ft-plum)] outline-none" value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)}>
                <option value="priority">優先順序</option><option value="date">預計日期</option><option value="newest">最新加入</option>
              </select>
            </label>
            <button className="btn h-10 min-h-0 rounded-xl border-0 bg-[var(--ft-wine)] px-4 text-white hover:bg-[var(--ft-plum)]" onClick={() => setDraft({ ...EMPTY_DRAFT })}><Plus className="h-4 w-4" />完整新增</button>
          </div>
        </div>
      </section>

      {!WORKSPACE_ID && <div className="alert alert-warning"><span>尚未設定工作區，請檢查系統設定。</span></div>}

      {loading ? (
        <div className="flex min-h-56 items-center justify-center"><span className="loading loading-spinner loading-lg text-[var(--ft-rose)]" /></div>
      ) : visibleItems.length === 0 ? (
        <section className="flex min-h-64 flex-col items-center justify-center rounded-[24px] border border-dashed border-[var(--ft-line)] bg-[var(--ft-paper)] p-8 text-center">
          <PackageCheck className="mb-3 h-10 w-10 text-[#d9b6a0]" /><h2 className="font-black text-[var(--ft-plum)]">目前沒有符合的待購項目</h2><p className="mt-1 text-sm text-[var(--ft-plum-soft)]">貼上連結即可先保存，不需要一次填完所有資料。</p>
        </section>
      ) : (
        <section className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {visibleItems.map((item) => (
            <article key={item.id} className={`group rounded-[22px] border bg-[var(--ft-paper)] p-4 shadow-[0_4px_18px_rgba(75,44,55,0.045)] transition hover:-translate-y-0.5 hover:shadow-[var(--ft-shadow)] ${item.priority === "high" ? "border-[#ef9e83]" : "border-[var(--ft-line)]"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[item.status]}`}>{statusLabel(item.status)}</span>
                    {item.priority !== "low" && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.priority === "high" ? "bg-[#ffe1d6] text-[#b7431c]" : "bg-[#f4edf8] text-[var(--ft-wine)]"}`}>{PRIORITY_LABEL[item.priority]}</span>}
                    {item.platform && <span className="truncate rounded-full bg-[#fff5e8] px-2.5 py-1 text-xs font-bold text-[#9b5a29]">{item.platform}</span>}
                    {item.sources.length > 1 && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{item.sources.length} 個來源</span>}
                  </div>
                  <h2 className="line-clamp-2 text-lg font-black leading-7 text-[var(--ft-plum)]">{item.name}</h2>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button className="btn btn-ghost btn-sm h-9 min-h-0 w-9 rounded-xl p-0 text-[var(--ft-plum-soft)] hover:bg-[var(--ft-rose-pale)] hover:text-[var(--ft-rose)]" aria-label={`編輯 ${item.name}`} onClick={() => setDraft(toDraft(item))}><Pencil className="h-4 w-4" /></button>
                  <button className="btn btn-ghost btn-sm h-9 min-h-0 w-9 rounded-xl p-0 text-[var(--ft-plum-soft)] hover:bg-rose-50 hover:text-rose-600" aria-label={`移除 ${item.name}`} onClick={() => void removeItem(item)}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-[#fffaf5] p-3 text-sm">
                <div><span className="block text-xs text-[var(--ft-plum-soft)]">最低價格</span><strong className="text-emerald-700">{priceText(bestShoppingPrice(item.sources, item.estimated_price))}</strong></div>
                <div><span className="block text-xs text-[var(--ft-plum-soft)]">預計購買</span><strong className="text-[var(--ft-plum)]">{item.planned_date || "尚未安排"}</strong></div>
              </div>

              {(item.requested_by || item.purchase_for) && <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ft-plum-soft)]">{item.requested_by && <span className="flex items-center gap-1 rounded-full border border-[var(--ft-line)] px-2.5 py-1"><UserRound className="h-3.5 w-3.5" />{item.requested_by} 提出</span>}{item.purchase_for && <span className="rounded-full border border-[var(--ft-line)] px-2.5 py-1">購買給 {item.purchase_for}</span>}</div>}
              {item.note && <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--ft-plum-soft)]">{item.note}</p>}
              <SourceComparisonList sources={item.sources} />

              <div className="mt-4 flex items-center gap-2 border-t border-[var(--ft-line)] pt-3">
                <select className={`select select-bordered h-9 min-h-0 flex-1 rounded-xl text-sm font-bold ${STATUS_STYLE[item.status]}`} value={item.status} onChange={(event) => void changeStatus(item, event.target.value as ShoppingStatus)} aria-label={`${item.name} 狀態`}>
                  {STATUS_OPTIONS.filter((option) => option.value !== "all").map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                {item.url && <a className="btn btn-outline h-9 min-h-0 rounded-xl border-[var(--ft-line)] px-3 text-[var(--ft-wine)] hover:border-[var(--ft-wine)] hover:bg-[var(--ft-wine)] hover:text-white" href={item.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /><span className="hidden sm:inline">商品頁</span></a>}
              </div>
            </article>
          ))}
        </section>
      )}

      {draft && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#2e1838]/35 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="shopping-dialog-title">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-[26px] border border-[var(--ft-line)] bg-[var(--ft-paper)] shadow-2xl sm:max-w-3xl sm:rounded-[26px]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--ft-line)] bg-[var(--ft-paper)]/95 px-5 py-4 backdrop-blur">
              <div><p className="text-xs font-bold text-[var(--ft-peach)]">{draft.id ? "編輯資料" : "新增項目"}</p><h2 id="shopping-dialog-title" className="text-xl font-black text-[var(--ft-plum)]">{draft.id ? draft.name : "完整加入待購清單"}</h2></div>
              <button className="btn btn-ghost h-10 min-h-0 w-10 rounded-full p-0" aria-label="關閉" onClick={() => setDraft(null)}><X className="h-5 w-5" /></button>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-bold text-[var(--ft-plum)]">商品名稱</span><input className="input input-bordered w-full rounded-xl border-[var(--ft-line)] bg-white" placeholder="例如：保冷壺" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
              <SourceComparisonEditor sources={draft.sources} onChange={(sources) => setDraft({ ...draft, sources })} />
              <label><span className="mb-1.5 block text-sm font-bold text-[var(--ft-plum)]">誰提出</span><input list="shopping-requesters" className="input input-bordered w-full rounded-xl border-[var(--ft-line)] bg-white" placeholder="我、先生…" value={draft.requested_by} onChange={(event) => setDraft({ ...draft, requested_by: event.target.value })} /></label>
              <label><span className="mb-1.5 block text-sm font-bold text-[var(--ft-plum)]">購買給誰</span><input list="shopping-for" className="input input-bordered w-full rounded-xl border-[var(--ft-line)] bg-white" placeholder="家庭、自己…" value={draft.purchase_for} onChange={(event) => setDraft({ ...draft, purchase_for: event.target.value })} /></label>
              <datalist id="shopping-requesters"><option value="我" /><option value="先生" /></datalist><datalist id="shopping-for"><option value="家庭" /><option value="自己" /><option value="先生" /></datalist>
              <label><span className="mb-1.5 block text-sm font-bold text-[var(--ft-plum)]">優先程度</span><select className="select select-bordered w-full rounded-xl border-[var(--ft-line)] bg-white" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as ShoppingPriority })}><option value="low">一般</option><option value="normal">想買</option><option value="high">優先購買</option></select></label>
              <label><span className="mb-1.5 block text-sm font-bold text-[var(--ft-plum)]">預計購買日期</span><input type="date" className="input input-bordered w-full rounded-xl border-[var(--ft-line)] bg-white" value={draft.planned_date} onChange={(event) => setDraft({ ...draft, planned_date: event.target.value })} /></label>
              <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-bold text-[var(--ft-plum)]">狀態</span><div className="flex flex-wrap gap-2">{STATUS_OPTIONS.filter((option) => option.value !== "all").map((option) => <button type="button" key={option.value} className={`rounded-full border px-3 py-2 text-sm font-bold ${draft.status === option.value ? STATUS_STYLE[option.value as ShoppingStatus] : "border-[var(--ft-line)] bg-white text-[var(--ft-plum-soft)]"}`} onClick={() => setDraft({ ...draft, status: option.value as ShoppingStatus })}>{option.label}</button>)}</div></label>
              <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-bold text-[var(--ft-plum)]">備註</span><textarea className="textarea textarea-bordered min-h-24 w-full rounded-xl border-[var(--ft-line)] bg-white" placeholder="尺寸、顏色、優惠條件等" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></label>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--ft-line)] bg-[var(--ft-paper)]/95 px-5 py-4 backdrop-blur"><button className="btn btn-ghost rounded-xl" onClick={() => setDraft(null)}>取消</button><button className="btn rounded-xl border-0 bg-[var(--ft-rose)] px-6 text-white hover:bg-[#c42750]" disabled={saving} onClick={() => void submitDraft()}>{saving && <span className="loading loading-spinner loading-sm" />}儲存</button></div>
          </div>
        </div>
      )}
    </main>
  );
}
