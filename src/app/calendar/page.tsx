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
    <main className="w-screen min-h-dvh bg-white flex flex-col">
      {/* ===== Sticky App Bar (滿版) ===== */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="h-14 px-3 flex items-center justify-between gap-2">
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
                以月曆形式檢視行程，點擊日期可快速新增記事。
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

        {/* 未設定 workspace 提示（滿版且貼邊） */}
        {!WORKSPACE_ID && (
          <div className="px-3 pb-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              未設定 WORKSPACE_ID（請檢查 .env.local）
            </div>
          </div>
        )}

        {/* ===== Month Toolbar (像 Google：貼在 header 下方) ===== */}
        <div className="px-2 pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                className="h-10 w-10 rounded-full hover:bg-orange-50 hover:text-orange-600 text-slate-700 grid place-items-center"
                onClick={prevMonth}
                aria-label="上個月"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="text-[18px] font-black tracking-tight text-slate-900 tabular-nums">
                {ym}
              </div>

              <button
                className="h-10 w-10 rounded-full hover:bg-orange-50 hover:text-orange-600 text-slate-700 grid place-items-center"
                onClick={nextMonth}
                aria-label="下個月"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="text-[12px] font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
              本月記事：<span className="text-orange-600 tabular-nums">{monthNoteCount}</span>
              {loading ? "（載入中…）" : ""}
            </div>
          </div>
        </div>

        {/* ===== Weekday Row (Sticky) ===== */}
        <div className="grid grid-cols-7 border-t border-slate-200 bg-white">
          {["日", "一", "二", "三", "四", "五", "六"].map((w) => (
            <div
              key={w}
              className="py-2 text-center text-[11px] font-black tracking-widest text-slate-500"
            >
              {w}
            </div>
          ))}
        </div>
      </header>

      {/* ===== Body: 可捲動月曆區（滿版） ===== */}
      <section className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-7 w-full">
          {grid.map((c, idx) => {
            // 空白格：維持格線
            if (!c.date) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[96px] md:min-h-[112px] border-r border-b border-slate-200 bg-slate-50/50"
                />
              );
            }

            const list = dayMap.get(c.date) ?? [];
            const chips = list.length ? dayOwnerChips(list) : [];
            const isToday = c.date === ymd(new Date());

            return (
              <button
                key={c.date}
                type="button"
                onClick={() => openNew(c.date!)}
                className={[
                  "relative text-left w-full",
                  "min-h-[96px] md:min-h-[112px]",
                  "border-r border-b border-slate-200",
                  "px-2 pt-2 pb-2",
                  "transition-colors",
                  isToday ? "bg-orange-50/40" : "bg-white hover:bg-slate-50",
                ].join(" ")}
              >
                {/* 上列：日期 + owners chips（縮小到像 Google） */}
                <div className="flex items-start justify-between gap-2">
                  <div className={["text-[13px] font-black tabular-nums", isToday ? "text-orange-700" : "text-slate-700"].join(" ")}>
                    {c.day}
                  </div>

                  {chips.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      {chips.map((o) => {
                        const st = OWNER_STYLE[o] || OWNER_STYLE["家庭"];
                        return (
                          <span
                            key={o}
                            className={[
                              "px-1.5 py-0.5 rounded-md text-[9px] font-black border",
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

                {/* 事件列表：最多 3 條，超過顯示 +N（維持你原規則） */}
                <div className="mt-1 space-y-1">
                  {list.slice(0, 3).map((n) => {
                    const o = primaryOwner(n.owner);
                    const st = OWNER_STYLE[o] || OWNER_STYLE["家庭"];
                    return (
                      <div
                        key={n.id}
                        className={[
                          "w-full text-[11px] font-bold truncate",
                          "rounded-md px-2 py-1 border",
                          "active:opacity-80",
                          st.itemBg,
                        ].join(" ")}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(n);
                        }}
                        title={n.title}
                      >
                        {n.title}
                      </div>
                    );
                  })}

                  {list.length > 3 && (
                    <div className="text-[11px] font-bold text-slate-400 pl-1">
                      +{list.length - 3} 則
                    </div>
                  )}
                </div>

                {/* hover + icon（桌機才明顯） */}
                <div className="pointer-events-none absolute inset-0 opacity-0 hover:opacity-100 transition-opacity hidden md:flex items-center justify-center">
                  <div className="h-9 w-9 rounded-full bg-orange-50 border border-orange-100 grid place-items-center">
                    <Plus className="w-5 h-5 text-orange-500" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 底部留白避免 FAB/底部工具列遮到 */}
        <div className="h-28" />
      </section>

      {/* ===== Draft：保持你原本卡片，但改成「手機底部抽屜」更像 Google（純 UI） ===== */}
      {draft && (
        <div className="fixed inset-0 z-50">
          <button
            className="absolute inset-0 bg-black/25"
            onClick={closeDraft}
            aria-label="關閉"
          />
          <div className="absolute left-0 right-0 bottom-0 bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 max-h-[86dvh] overflow-y-auto">
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-orange-100 text-orange-700">
                      {draft.mode === "new" ? "新增" : "編輯"}
                    </span>
                    <span className="text-[12px] font-bold text-slate-500 tabular-nums">
                      {draft.date_from ?? ""}
                      {draft.date_to && draft.date_to !== draft.date_from ? ` ～ ${draft.date_to}` : ""}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="h-10 w-10 rounded-xl bg-orange-600 hover:bg-orange-700 text-white grid place-items-center disabled:opacity-60"
                    onClick={saveDraft}
                    disabled={saving}
                    aria-label="儲存"
                  >
                    <Save className="w-5 h-5" />
                  </button>
                  <button
                    className="h-10 w-10 rounded-xl hover:bg-slate-100 text-slate-500 grid place-items-center"
                    onClick={closeDraft}
                    aria-label="關閉"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <input
                className="w-full h-11 px-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-orange-500 outline-none text-[15px] font-black"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="標題"
                autoFocus={draft.mode === "new"}
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-[11px] text-slate-500 font-bold ml-1">開始日期</div>
                  <input
                    type="date"
                    className="w-full h-11 px-3 rounded-2xl border border-slate-200 focus:border-orange-500 outline-none"
                    value={draft.date_from ?? ""}
                    onChange={(e) => {
                      const v = e.target.value || null;
                      setDraft({ ...draft, date_from: v, date_to: draft.date_to ?? (v ? v : null) });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] text-slate-500 font-bold ml-1">結束日期</div>
                  <input
                    type="date"
                    className="w-full h-11 px-3 rounded-2xl border border-slate-200 focus:border-orange-500 outline-none"
                    value={draft.date_to ?? ""}
                    onChange={(e) => setDraft({ ...draft, date_to: e.target.value || null })}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {OWNER_LIST.map((o) => {
                  const active = draft.owners.includes(o);
                  const st = OWNER_STYLE[o];
                  return (
                    <button
                      key={o}
                      type="button"
                      className={[
                        "px-3 py-1.5 rounded-full text-sm font-bold ring-1 transition-all",
                        active
                          ? `${st.chip} ${st.ring} ring-2 shadow-sm`
                          : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-50",
                      ].join(" ")}
                      onClick={() => toggleOwner(o)}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>

              <textarea
                className="w-full min-h-[140px] rounded-2xl border border-slate-200 p-4 text-sm leading-relaxed outline-none focus:border-orange-500 resize-none"
                value={draft.content}
                onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                placeholder="輸入記事內容..."
              />

              <div className="h-[env(safe-area-inset-bottom)]" />
            </div>
          </div>
        </div>
      )}

      {/* ===== Mobile FAB（避開底部 + safe-area） ===== */}
      <button
        type="button"
        className="md:hidden fixed right-4 bottom-[calc(16px+env(safe-area-inset-bottom)+72px)] z-40 h-14 w-14 rounded-full bg-orange-600 hover:bg-orange-700 text-white shadow-xl shadow-orange-600/30 grid place-items-center"
        onClick={() => openNew(ymd(new Date()))}
        aria-label="新增記事"
      >
        <Plus className="w-7 h-7" />
      </button>
    </main>
  );
}
