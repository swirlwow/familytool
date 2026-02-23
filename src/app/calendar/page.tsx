// src/app/calendar/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarDays, Plus, Save, X, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const WORKSPACE_ID = process.env.NEXT_PUBLIC_WORKSPACE_ID || "";

type NoteRow = { id: string; owner: string; title: string; content: string; note_date: string | null; date_from: string | null; date_to: string | null; updated_at?: string; };
const OWNER_LIST = ["家庭", "雅惠", "昱元", "子逸", "英茵"] as const;
const OWNER_STYLE: Record<string, { chip: string; ring: string; itemBg: string }> = {
  家庭: { chip: "bg-slate-100 text-slate-700", ring: "ring-slate-200", itemBg: "bg-slate-50 text-slate-700 border-slate-100" },
  雅惠: { chip: "bg-rose-100 text-rose-700", ring: "ring-rose-200", itemBg: "bg-rose-50 text-rose-700 border-rose-100" },
  昱元: { chip: "bg-blue-100 text-blue-700", ring: "ring-blue-200", itemBg: "bg-blue-50 text-blue-700 border-blue-100" },
  子逸: { chip: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-200", itemBg: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  英茵: { chip: "bg-amber-100 text-amber-800", ring: "ring-amber-200", itemBg: "bg-amber-50 text-amber-800 border-amber-100" },
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}
function pad(n: number) { return String(n).padStart(2, "0"); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function monthKey(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
function monthRange(ym: string) { const [y, m] = ym.split("-").map(Number); const from = `${y}-${pad(m)}-01`; const last = new Date(y, m, 0).getDate(); const to = `${y}-${pad(m)}-${pad(last)}`; return { from, to }; }
function addDays(dateStr: string, n: number) { const d = new Date(dateStr + "T00:00:00"); d.setDate(d.getDate() + n); return ymd(d); }
function parseOwners(raw: string | null | undefined): string[] { const s = String(raw ?? "").trim(); if (!s) return ["家庭"]; if (s.includes("|")) return s.split("|").map((x) => x.trim()).filter(Boolean); return s.split(",").map((x) => x.trim()).filter(Boolean); }
function formatOwners(arr: string[]): string[] { const uniq = Array.from(new Set(arr.map((x) => x.trim()).filter(Boolean))); const cleaned = uniq.filter((x) => (OWNER_LIST as readonly string[]).includes(x)); return cleaned.length ? cleaned : ["家庭"]; }
function primaryOwner(rawOwner: string): string { const arr = formatOwners(parseOwners(rawOwner)); return arr[0] || "家庭"; }
function expandNotesToDayMap(notes: NoteRow[]) { const map = new Map<string, NoteRow[]>(); for (const n of notes) { const from = n.date_from || n.note_date; const to = n.date_to || n.date_from || n.note_date; if (!from || !to) continue; let cur = from; while (cur <= to) { const arr = map.get(cur) ?? []; arr.push(n); map.set(cur, arr); cur = addDays(cur, 1); } } for (const [k, v] of map.entries()) { v.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || ""))); map.set(k, v); } return map; }

type Draft = { mode: "new" | "edit"; id?: string; owners: string[]; title: string; content: string; date_from: string | null; date_to: string | null; anchorDate?: string; };

export default function CalendarPage() {
  const router = useRouter();
  const { toast } = useToast();
  const today = new Date();
  
  const [ym, setYm] = useState(monthKey(today));
  const { from, to } = useMemo(() => monthRange(ym), [ym]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!WORKSPACE_ID) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/notes?workspace_id=${WORKSPACE_ID}&from=${from}&to=${to}&limit=500`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "讀取失敗");
      const rows: NoteRow[] = Array.isArray(j.data) ? j.data : [];
      setNotes(rows.filter((x) => String(x?.id || "").trim()));
    } catch (e: any) { toast({ variant: "destructive", title: "讀取行事曆資料失敗", description: e.message }); setNotes([]); } finally { setLoading(false); }
  }
  
  useEffect(() => { load(); }, [ym]);

  const dayMap = useMemo(() => expandNotesToDayMap(notes), [notes]);
  const monthNoteCount = useMemo(() => notes.length, [notes]);
  const grid = useMemo(() => {
    const [y, m] = ym.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const startDow = first.getDay(); const lastDay = new Date(y, m, 0).getDate();
    const cells: Array<{ date: string | null; day: number | null }> = [];
    for (let i = 0; i < startDow; i++) cells.push({ date: null, day: null });
    for (let d = 1; d <= lastDay; d++) { const date = `${y}-${pad(m)}-${pad(d)}`; cells.push({ date, day: d }); }
    while (cells.length % 7 !== 0) cells.push({ date: null, day: null });
    return cells;
  }, [ym]);

  function prevMonth() { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 2, 1); setYm(monthKey(d)); }
  function nextMonth() { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m, 1); setYm(monthKey(d)); }
  function openNew(date: string) { setDraft({ mode: "new", owners: ["家庭"], title: "新記事", content: "", date_from: date, date_to: date, anchorDate: date }); }
  function openEdit(n: NoteRow) { const id = String(n?.id || "").trim(); if (!id) return; setDraft({ mode: "edit", id, owners: formatOwners(parseOwners(n.owner)), title: n.title ?? "", content: n.content ?? "", date_from: n.date_from ?? n.note_date ?? null, date_to: n.date_to ?? null, anchorDate: n.date_from ?? n.note_date ?? undefined }); }
  function closeDraft() { setDraft(null); }
  function toggleOwner(o: string) { if (!draft) return; const next = new Set(draft.owners); if (next.has(o)) next.delete(o); else next.add(o); const arr = formatOwners(Array.from(next)); setDraft({ ...draft, owners: arr }); }

  async function saveDraft() {
    if (!WORKSPACE_ID || !draft) return;
    const title = String(draft.title || "").trim(); if (!title) { toast({ variant: "destructive", title: "新增/儲存記事失敗", description: "title 不可空白" }); return; }
    const df = draft.date_from ?? null; const dt = draft.date_to ?? draft.date_from ?? null; if (df && dt && dt < df) { toast({ variant: "destructive", title: "日期範圍錯誤", description: "結束日期不可早於開始日期" }); return; }
    setSaving(true);
    try {
      const body = { workspace_id: WORKSPACE_ID, owner: draft.owners, title, content: draft.content ?? "", date_from: df, date_to: dt, is_important: false };
      const url = draft.mode === "new" ? "/api/notes" : `/api/notes/${encodeURIComponent(draft.id || "")}?workspace_id=${WORKSPACE_ID}`;
      const method = draft.mode === "new" ? "POST" : "PATCH";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("失敗");
      toast({ title: "已儲存" }); closeDraft(); await load();
    } catch (e: any) { toast({ variant: "destructive", title: "失敗", description: e.message }); } finally { setSaving(false); }
  }

  function dayOwnerChips(list: NoteRow[]) { const owners = Array.from(new Set(list.flatMap((n) => formatOwners(parseOwners(n.owner))).filter(Boolean))).filter((o) => (OWNER_LIST as readonly string[]).includes(o)); owners.sort((a, b) => OWNER_LIST.indexOf(a as any) - OWNER_LIST.indexOf(b as any)); return owners.slice(0, 3); }

  return (
    <main className="w-full min-h-dvh bg-white flex flex-col">
      {/* ===== Sticky App Bar (滿版) ===== */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="h-14 px-3 flex items-center justify-between gap-2 max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-orange-50 text-orange-600 p-2 rounded-xl border border-orange-100 shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[17px] font-black tracking-tight text-slate-900 truncate">行事曆</h1>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[11px] font-black bg-orange-100 text-orange-700">
                  Calendar
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 truncate">
                以月曆形式檢視行程，點擊加號可新增。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              className="h-9 px-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100"
              onClick={() => router.push("/")}
            >
              回首頁
            </button>

            <button
              className="hidden sm:inline-flex h-9 px-3 rounded-xl text-sm font-bold border border-slate-300 text-slate-700 hover:bg-slate-100 gap-2 items-center"
              onClick={() => router.push("/notes")}
            >
              <ArrowLeft className="w-4 h-4" />
              去記事本
            </button>

            <button
              className="hidden md:inline-flex h-9 px-3 rounded-xl text-sm font-black bg-orange-600 hover:bg-orange-700 text-white shadow-sm gap-2 items-center"
              onClick={() => openNew(ymd(new Date()))}
            >
              <Plus className="w-4 h-4" />
              新增
            </button>
          </div>
        </div>

        {/* 未設定 workspace 提示 */}
        {!WORKSPACE_ID && (
          <div className="px-3 pb-3 max-w-6xl mx-auto w-full">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              未設定 WORKSPACE_ID（請檢查 .env.local）
            </div>
          </div>
        )}

        {/* ===== Month Toolbar ===== */}
        <div className="px-3 pb-2 pt-1 max-w-6xl mx-auto w-full">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 bg-slate-50 rounded-full border border-slate-200 p-0.5 shadow-sm">
              <button
                className="h-9 w-9 rounded-full hover:bg-orange-100 hover:text-orange-600 text-slate-600 grid place-items-center transition-colors"
                onClick={prevMonth}
                aria-label="上個月"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="text-[16px] font-black tracking-tight text-slate-800 tabular-nums px-2">
                {ym}
              </div>

              <button
                className="h-9 w-9 rounded-full hover:bg-orange-100 hover:text-orange-600 text-slate-600 grid place-items-center transition-colors"
                onClick={nextMonth}
                aria-label="下個月"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="text-[11px] font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
              本月記事：<span className="text-orange-600 tabular-nums">{monthNoteCount}</span>
              {loading ? "（載入中…）" : ""}
            </div>
          </div>
        </div>

        {/* ===== Weekday Row (Sticky) ===== */}
        <div className="grid grid-cols-7 border-t border-slate-200 bg-slate-50 max-w-6xl mx-auto w-full">
          {["日", "一", "二", "三", "四", "五", "六"].map((w) => (
            <div
              key={w}
              className="py-1.5 text-center text-[10px] font-black tracking-widest text-slate-500 border-r border-slate-200 last:border-r-0"
            >
              {w}
            </div>
          ))}
        </div>
      </header>

      {/* ===== Body: 可捲動月曆區（滿版無邊距） ===== */}
      <section className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-6xl mx-auto w-full border-x border-slate-200 bg-slate-100/50">
          <div className="grid grid-cols-7 w-full bg-slate-200 gap-px border-b border-slate-200">
            {grid.map((c, idx) => {
              // 空白格
              if (!c.date) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-[120px] sm:min-h-[140px] bg-slate-50/60"
                  />
                );
              }

              const list = dayMap.get(c.date) ?? [];
              const chips = list.length ? dayOwnerChips(list) : [];
              const isToday = c.date === ymd(new Date());

              return (
                <div
                  key={c.date}
                  className={[
                    "relative flex flex-col w-full text-left overflow-hidden",
                    "min-h-[120px] sm:min-h-[140px]",
                    "px-1 py-1.5",
                    isToday ? "bg-orange-50/70" : "bg-white",
                  ].join(" ")}
                >
                  {/* 上列：日期 + owners chips */}
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <div className={cn(
                        "text-[12px] font-black tabular-nums w-6 h-6 flex items-center justify-center rounded-full", 
                        isToday ? "bg-orange-500 text-white shadow-sm shadow-orange-500/30" : "text-slate-700"
                    )}>
                      {c.day}
                    </div>

                    {chips.length > 0 && (
                      <div className="flex items-center gap-[2px] flex-wrap justify-end pt-0.5">
                        {chips.map((o) => {
                          const st = OWNER_STYLE[o] || OWNER_STYLE["家庭"];
                          return (
                            <span
                              key={o}
                              className={[
                                "px-1 py-[2px] rounded text-[8px] font-black border leading-none",
                                st.chip,
                                st.ring.replace("ring-", "border-"),
                              ].join(" ")}
                            >
                              {o}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 事件列表 */}
                  <div className="space-y-[3px]">
                    {list.slice(0, 3).map((n) => {
                      const o = primaryOwner(n.owner);
                      const st = OWNER_STYLE[o] || OWNER_STYLE["家庭"];
                      return (
                        <button
                          key={n.id}
                          type="button"
                          className={[
                            "w-full text-left text-[10px] font-bold truncate leading-tight",
                            "rounded-[4px] px-1.5 py-[4px] border",
                            "active:opacity-80 transition-opacity",
                            st.itemBg,
                          ].join(" ")}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(n);
                          }}
                          title={n.title}
                        >
                          {n.title}
                        </button>
                      );
                    })}

                    {list.length > 3 && (
                      <div className="text-[10px] font-bold text-slate-400 pl-1 mt-1">
                        +{list.length - 3} 則
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="h-28" />
      </section>

      {/* ✅ Draft：響應式 Modal/Drawer (電腦版置中，手機版底部) */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center sm:p-6">
          <button
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity"
            onClick={closeDraft}
            aria-label="關閉"
          />
          <div className="relative w-full sm:max-w-xl bg-white rounded-t-[32px] sm:rounded-3xl shadow-2xl max-h-[86dvh] sm:max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
            {/* 抽屜把手 (僅手機顯示) */}
            <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-[11px] font-black bg-orange-100 text-orange-700">
                      {draft.mode === "new" ? "新增" : "編輯"}
                    </span>
                    <span className="text-[12px] font-bold text-slate-900 tabular-nums">
                      {draft.date_from ?? ""}
                      {draft.date_to && draft.date_to !== draft.date_from ? ` ～ ${draft.date_to}` : ""}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 grid place-items-center transition-colors"
                    onClick={closeDraft}
                    aria-label="關閉"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    className="h-9 px-4 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold shadow-md shadow-orange-600/20 disabled:opacity-60 transition-colors"
                    onClick={saveDraft}
                    disabled={saving}
                  >
                    {saving ? "儲存中" : "儲存"}
                  </button>
                </div>
              </div>

              {/* ✅ 明確加上 text-slate-900 防止深色模式反白 */}
              <input
                className="w-full h-12 px-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none text-slate-900 text-[16px] font-black transition-all placeholder:text-slate-400"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="輸入標題..."
                autoFocus={draft.mode === "new"}
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-[11px] text-slate-500 font-bold ml-1">開始日期</div>
                  {/* ✅ 明確加上 text-slate-900 防止深色模式反白 */}
                  <input
                    type="date"
                    className="w-full h-11 px-3 rounded-2xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none text-slate-900 text-sm font-medium transition-all bg-white"
                    value={draft.date_from ?? ""}
                    onChange={(e) => {
                      const v = e.target.value || null;
                      setDraft({ ...draft, date_from: v, date_to: draft.date_to ?? (v ? v : null) });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] text-slate-500 font-bold ml-1">結束日期</div>
                  {/* ✅ 明確加上 text-slate-900 防止深色模式反白 */}
                  <input
                    type="date"
                    className="w-full h-11 px-3 rounded-2xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none text-slate-900 text-sm font-medium transition-all bg-white"
                    value={draft.date_to ?? ""}
                    onChange={(e) => setDraft({ ...draft, date_to: e.target.value || null })}
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] text-slate-500 font-bold ml-1">選擇分類標籤</div>
                  <div className="flex flex-wrap gap-2">
                    {OWNER_LIST.map((o) => {
                    const active = draft.owners.includes(o);
                    const st = OWNER_STYLE[o];
                    return (
                        <button
                        key={o}
                        type="button"
                        className={[
                            "px-4 py-1.5 rounded-full text-sm font-bold transition-all",
                            active
                            ? `${st.chip} shadow-sm ring-1 ${st.ring}`
                            : "bg-slate-50 text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100",
                        ].join(" ")}
                        onClick={() => toggleOwner(o)}
                        >
                        {o}
                        </button>
                    );
                    })}
                  </div>
              </div>

              {/* ✅ 明確加上 text-slate-900 防止深色模式反白 */}
              <textarea
                className="w-full min-h-[160px] rounded-2xl border border-slate-200 p-4 text-slate-900 text-sm leading-relaxed outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 resize-none transition-all placeholder:text-slate-300 bg-slate-50 focus:bg-white"
                value={draft.content}
                onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                placeholder="點此輸入詳細內容..."
              />

              <div className="h-[env(safe-area-inset-bottom)] sm:h-0" />
            </div>
          </div>
        </div>
      )}

      {/* ===== Mobile FAB ===== */}
      <button
        type="button"
        className="md:hidden fixed right-5 bottom-[calc(16px+env(safe-area-inset-bottom)+72px)] z-30 h-14 w-14 rounded-full bg-orange-600 hover:bg-orange-700 text-white shadow-xl shadow-orange-600/40 grid place-items-center transition-transform active:scale-95"
        onClick={() => openNew(ymd(new Date()))}
        aria-label="新增記事"
      >
        <Plus className="w-6 h-6" />
      </button>
    </main>
  );
}
