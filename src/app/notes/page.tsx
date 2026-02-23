// src/app/notes/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NotebookPen, Plus, Search, Trash2, Pencil, Save, X, Filter, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const WORKSPACE_ID = process.env.NEXT_PUBLIC_WORKSPACE_ID || "";

type NoteRow = {
  id: string;
  owner: string; // 家庭/雅惠/昱元/子逸/英茵
  title: string;
  content: string;
  note_date: string | null;
  date_from: string | null;
  date_to: string | null;
  is_important: boolean;
  updated_at: string;
};

const OWNER_LIST = ["家庭", "雅惠", "昱元", "子逸", "英茵"] as const;
const FILTER_OWNERS = ["全部", ...OWNER_LIST] as const;

// 維持 Pink 主題
const OWNER_STYLE: Record<string, { chip: string; ring: string }> = {
  家庭: { chip: "bg-slate-100 text-slate-700", ring: "ring-slate-200" },
  雅惠: { chip: "bg-rose-100 text-rose-700", ring: "ring-rose-200" },
  昱元: { chip: "bg-blue-100 text-blue-700", ring: "ring-blue-200" },
  子逸: { chip: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-200" },
  英茵: { chip: "bg-amber-100 text-amber-800", ring: "ring-amber-200" },
  全部: { chip: "bg-pink-100 text-pink-700", ring: "ring-pink-200" },
};

function fmt10(s: string | null | undefined) {
  if (!s) return "";
  return String(s).slice(0, 10);
}

function parseOwners(raw: string): string[] {
  const s = String(raw || "").trim();
  if (!s) return ["家庭"];
  if (s.includes("|")) {
    const arr = s.split("|").map((x) => x.trim()).filter(Boolean);
    return arr.length ? arr : ["家庭"];
  }
  const arr = s.split(",").map((x) => x.trim()).filter(Boolean);
  return arr.length ? arr : ["家庭"];
}

function daysBetweenInclusive(from: string, to: string) {
  const a = new Date(from + "T00:00:00");
  const b = new Date(to + "T00:00:00");
  return Math.floor((b.getTime() - a.getTime()) / 86400000) + 1;
}

// ✅ 移除「日期：」字樣
function rangeText(n: { date_from: string | null; date_to: string | null; note_date: string | null }) {
  const df = n.date_from ?? n.note_date;
  const dt = n.date_to ?? n.date_from ?? n.note_date;
  if (!df) return "";
  if (!dt || dt === df) return `${fmt10(df)}`;
  return `${fmt10(df)} ~ ${fmt10(dt)} (${daysBetweenInclusive(df, dt)}天)`;
}

type Draft = {
  mode: "new" | "edit";
  id?: string;
  owners: string[];
  title: string;
  content: string;
  date_from: string | null;
  date_to: string | null;
};

export default function NotesPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [q, setQ] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<(typeof FILTER_OWNERS)[number]>("全部");
  const [list, setList] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!WORKSPACE_ID) return;
    setLoading(true);
    try {
      const usp = new URLSearchParams();
      usp.set("workspace_id", WORKSPACE_ID);
      usp.set("limit", "200");
      if (q.trim()) usp.set("q", q.trim());
      if (ownerFilter !== "全部") usp.set("owner", ownerFilter);

      const res = await fetch(`/api/notes?${usp.toString()}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "讀取失敗");

      const rows: NoteRow[] = Array.isArray(j.data) ? j.data : [];
      setList(rows.filter((x) => String(x?.id || "").trim()));
    } catch (e: any) {
      toast({ variant: "destructive", title: "讀取記事失敗", description: e.message });
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerFilter]);

  function openNewDraft() {
    const defaultOwner = ownerFilter === "全部" ? "家庭" : ownerFilter;
    setDraft({
      mode: "new",
      owners: [defaultOwner],
      title: `${defaultOwner} 新記事`,
      content: "",
      date_from: null,
      date_to: null,
    });
  }

  function openEditDraft(n: NoteRow) {
    const id = String(n?.id || "").trim();
    if (!id) return;
    setDraft({
      mode: "edit",
      id,
      owners: parseOwners(n.owner),
      title: n.title ?? "",
      content: n.content ?? "",
      date_from: n.date_from ?? n.note_date ?? null,
      date_to: n.date_to ?? null,
    });
  }

  function closeDraft() {
    setDraft(null);
  }

  function toggleOwner(o: string) {
    if (!draft) return;
    const next = new Set(draft.owners);
    if (next.has(o)) next.delete(o);
    else next.add(o);
    const arr = Array.from(next);
    setDraft({ ...draft, owners: arr.length ? arr : ["家庭"] });
  }

  async function saveDraft() {
    if (!WORKSPACE_ID || !draft) return;

    const title = String(draft.title || "").trim();
    if (!title) {
      toast({ variant: "destructive", title: "儲存失敗", description: "title 不可空白" });
      return;
    }

    const df = draft.date_from ?? null;
    const dt = draft.date_to ?? draft.date_from ?? null;
    if (df && dt && dt < df) {
      toast({ variant: "destructive", title: "日期範圍錯誤", description: "結束日期不可早於開始日期" });
      return;
    }

    setSaving(true);
    try {
      if (draft.mode === "new") {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: WORKSPACE_ID,
            owner: draft.owners,
            title,
            content: draft.content ?? "",
            date_from: df,
            date_to: dt,
            is_important: false,
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || "新增失敗");

        toast({ title: "已新增" });
        closeDraft();
        await load();
      } else {
        const id = String(draft.id || "").trim();
        if (!id) throw new Error("缺少ID");

        const res = await fetch(`/api/notes/${encodeURIComponent(id)}?workspace_id=${WORKSPACE_ID}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: WORKSPACE_ID,
            owner: draft.owners,
            title,
            content: draft.content ?? "",
            date_from: df,
            date_to: dt,
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || "儲存失敗");

        toast({ title: "已儲存" });
        closeDraft();
        await load();
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "儲存失敗", description: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(n: NoteRow) {
    const id = String(n?.id || "").trim();
    if (!WORKSPACE_ID || !id) return;
    if (!confirm("確定刪除這則記事？")) return;

    try {
      const res = await fetch(`/api/notes/${encodeURIComponent(id)}?workspace_id=${WORKSPACE_ID}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "刪除失敗");

      toast({ title: "已刪除" });
      setList((prev) => prev.filter((x) => x.id !== id));
      if (draft?.mode === "edit" && draft.id === id) closeDraft();
    } catch (e: any) {
      toast({ variant: "destructive", title: "刪除失敗", description: e.message });
    }
  }

  const countText = useMemo(() => `共 ${list.length} 則`, [list]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* Header：黏住頂部 + 縮小 - Pink Theme */}
        <div className="card bg-white/90 backdrop-blur-md shadow-sm border border-slate-200 rounded-2xl sticky top-0 z-40">
          <div className="card-body p-3 flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-pink-50 text-pink-600 p-2 rounded-lg border border-pink-100">
                <NotebookPen className="w-5 h-5" />
              </div>

              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-slate-800">記事本</h1>
                <div className="badge badge-sm bg-pink-100 text-pink-700 border-none font-bold hidden sm:inline-flex">
                  Notes
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                className="btn btn-ghost btn-sm h-9 min-h-0 rounded-xl font-bold text-slate-500 hover:bg-slate-100"
                onClick={() => router.push("/")}
              >
                回首頁
              </button>

              <button
                className="btn btn-outline btn-sm h-9 min-h-0 rounded-xl font-bold border-slate-200 hover:bg-slate-100 hover:text-slate-700 text-slate-500 gap-2"
                onClick={() => router.push("/calendar")}
              >
                <CalendarDays className="w-4 h-4" /> <span className="hidden sm:inline">去行事曆</span>
              </button>

              <button
                className="hidden md:inline-flex btn h-9 min-h-0 bg-pink-600 hover:bg-pink-700 text-white border-none rounded-xl px-4 font-black shadow-md shadow-pink-200/30 gap-2"
                onClick={openNewDraft}
              >
                <Plus className="w-4 h-4" /> 新增
              </button>
            </div>
          </div>

          <div className="px-4 pb-3 -mt-1">
            <p className="text-[11px] font-medium text-slate-400">
              記錄生活點滴與待辦事項，支援多人分類（Owner 可多選）與日期區間。
            </p>
          </div>

          {!WORKSPACE_ID && (
            <div className="px-4 pb-3">
              <div className="alert alert-warning rounded-2xl py-3 text-sm">
                <span>未設定 WORKSPACE_ID（請檢查 .env.local）</span>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="card bg-white shadow-sm border border-slate-200 rounded-3xl">
          <div className="card-body p-5">
            <div className="flex flex-col gap-4">

              {/* Search Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    className="input input-bordered w-full pl-10 rounded-xl focus:border-pink-500 bg-slate-50 border-slate-200 focus:bg-white transition-all"
                    placeholder="搜尋標題或內容..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && load()}
                  />
                </div>
                <button
                  className="btn btn-outline border-slate-200 text-slate-600 hover:text-pink-600 hover:border-pink-200 hover:bg-pink-50 rounded-xl px-6"
                  onClick={load}
                  disabled={loading}
                >
                  搜尋
                </button>
              </div>

              {/* Owner Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-50">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mr-2">
                    <Filter className="w-3 h-3" /> 過濾
                  </div>
                  {FILTER_OWNERS.map((o) => {
                    const active = ownerFilter === o;
                    const st = OWNER_STYLE[o];
                    return (
                      <button
                        key={o}
                        className={[
                          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap border",
                          active
                            ? `${st.chip} ${st.ring} border-transparent shadow-sm`
                            : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700",
                        ].join(" ")}
                        onClick={() => setOwnerFilter(o)}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${active ? st.ring : "bg-slate-300"}`} />
                        {o}
                      </button>
                    );
                  })}
                </div>
                <div className="text-xs font-medium text-slate-400 text-right shrink-0">
                  {loading ? <span className="loading loading-spinner loading-xs text-pink-500"></span> : countText}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Draft Editor */}
        {draft && (
          <div className="card bg-white border rounded-3xl border-pink-300 shadow-xl ring-2 ring-pink-300/20 mb-6 scroll-mt-24" id="draft-editor">
            <div className="card-body p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-md text-xs font-black bg-pink-100 text-pink-700">
                      {draft.mode === "new" ? "未儲存草稿" : "編輯中"}
                    </span>

                    <input
                      className="input input-bordered rounded-xl w-full text-lg font-black bg-slate-50 focus:bg-white focus:border-pink-500"
                      value={draft.title}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      placeholder="標題"
                      autoFocus
                    />
                  </div>

                  {/* 日期區間 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="text-xs text-slate-400 font-bold ml-1">開始日期（可選）</div>
                      <input
                        type="date"
                        className="input input-bordered rounded-xl w-full focus:border-pink-500"
                        value={draft.date_from ?? ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            date_from: e.target.value || null,
                            date_to: draft.date_to ?? (e.target.value ? e.target.value : null),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-slate-400 font-bold ml-1">結束日期（可選，多天用）</div>
                      <input
                        type="date"
                        className="input input-bordered rounded-xl w-full focus:border-pink-500"
                        value={draft.date_to ?? ""}
                        onChange={(e) => setDraft({ ...draft, date_to: e.target.value || null })}
                      />
                    </div>
                  </div>

                  {/* Owner 多選 */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {OWNER_LIST.map((o) => {
                      const active = draft.owners.includes(o);
                      const st = OWNER_STYLE[o];
                      return (
                        <button
                          key={o}
                          className={[
                            "px-3 py-1.5 rounded-full text-sm font-bold ring-1 transition",
                            active ? `${st.chip} ${st.ring}` : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                          ].join(" ")}
                          onClick={() => toggleOwner(o)}
                          type="button"
                        >
                          {o}
                        </button>
                      );
                    })}
                  </div>

                  <textarea
                    className="textarea textarea-bordered rounded-xl w-full min-h-[220px] text-sm leading-relaxed p-4 focus:border-pink-500"
                    value={draft.content}
                    onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                    placeholder="輸入記事內容..."
                  />
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    className="btn btn-primary btn-square rounded-xl bg-pink-600 hover:bg-pink-700 border-none text-white shadow-md shadow-pink-200/50"
                    onClick={saveDraft}
                    disabled={saving}
                    title="儲存"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  <button className="btn btn-ghost btn-square rounded-xl text-slate-400 hover:bg-slate-100" onClick={closeDraft} title="取消">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* List: 調整為雙欄 Grid */}
        {!loading && list.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
            <div className="text-6xl mb-4">📝</div>
            <div className="font-bold text-slate-400">目前沒有記事</div>
          </div>
        )}

        {!loading && list.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {list.map((n) => {
              const id = String(n?.id || "").trim();
              const owners = parseOwners(n.owner);
              const dateText = rangeText(n);

              return (
                <div key={id || Math.random()} className="card bg-white border border-slate-200 rounded-3xl shadow-sm hover:shadow-md transition-all duration-200 group flex flex-col h-full hover:border-pink-200">
                  <div className="card-body p-6 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        
                        {/* ✅ 第一排：Owner + 日期資訊 (移除 | 符號) */}
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <div className="flex flex-wrap gap-2">
                                {owners.map((o) => {
                                    const st = OWNER_STYLE[o] || OWNER_STYLE["家庭"];
                                    return (
                                        <span key={o} className={["px-2.5 py-1 rounded-md text-xs font-black border border-transparent", st.chip].join(" ")}>
                                            {o}
                                        </span>
                                    );
                                })}
                            </div>

                            {/* ✅ 日期與更新資訊 (直接顯示不加前綴) */}
                            <div className="text-xs font-medium text-slate-400 truncate">
                                {dateText} 
                                {dateText ? "　" : ""} 
                                更新：{fmt10(n.updated_at)}
                            </div>
                        </div>

                        {/* 第二排：標題 */}
                        <h3 className="font-black text-lg text-slate-800 truncate" title={n.title}>
                          {n.title?.trim() ? n.title : <span className="opacity-40 italic">（未命名）</span>}
                        </h3>
                      </div>

                      <div className="flex flex-col gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="btn btn-ghost btn-sm btn-square rounded-xl text-slate-400 hover:text-pink-600 hover:bg-pink-50"
                          onClick={() => {
                            openEditDraft(n);
                            setTimeout(() => {
                                document.getElementById("draft-editor")?.scrollIntoView({ behavior: "smooth", block: "center" });
                            }, 100);
                          }}
                          title="編輯"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm btn-square rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                          onClick={() => deleteRow(n)}
                          title="刪除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="text-sm text-slate-600 whitespace-pre-line leading-7 flex-1 mt-1">
                      {String(n.content || "").trim() ? n.content : <span className="text-slate-300 italic">（尚無內容）</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        className="md:hidden fixed right-6 bottom-24 z-50 btn btn-circle btn-lg bg-pink-600 hover:bg-pink-700 border-none text-white shadow-xl shadow-pink-600/30"
        onClick={() => {
            openNewDraft();
            window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        aria-label="新增記事"
      >
        <Plus className="w-6 h-6" />
      </button>

    </main>
  );
}