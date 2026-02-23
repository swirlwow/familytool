// src/app/calendar/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const WORKSPACE_ID = process.env.NEXT_PUBLIC_WORKSPACE_ID || "";

type NoteRow = {
  id: string;
  owner: string;
  title: string;
  content: string;
  note_date: string | null;
  date_from: string | null;
  date_to: string | null;
  updated_at?: string;
};

const OWNER_LIST = ["家庭", "爸媽", "雅惠", "昱元", "子逸", "英茵"] as const;

const OWNER_STYLE: Record<string, { chip: string; ring: string; itemBg: string }> = {
  家庭: {
    chip: "bg-indigo-100 text-indigo-800",
    ring: "ring-indigo-300",
    itemBg: "bg-indigo-50 text-indigo-800 border-indigo-100",
  },
  爸媽: {
    chip: "bg-orange-200 text-orange-800",
    ring: "ring-orange-300",
    itemBg: "bg-orange-50 text-orange-800 border-orange-100",
  },
  雅惠: { chip: "bg-rose-100 text-rose-700", ring: "ring-rose-200", itemBg: "bg-rose-50 text-rose-700 border-rose-100" },
  昱元: { chip: "bg-blue-100 text-blue-700", ring: "ring-blue-200", itemBg: "bg-blue-50 text-blue-700 border-blue-100" },
  子逸: { chip: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-200", itemBg: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  英茵: { chip: "bg-amber-100 text-amber-800", ring: "ring-amber-200", itemBg: "bg-amber-50 text-amber-800 border-amber-100" },
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}
function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function monthKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const from = `${y}-${pad(m)}-01`;
  const last = new Date(y, m, 0).getDate();
  const to = `${y}-${pad(m)}-${pad(last)}`;
  return { from, to };
}
function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return ymd(d);
}
function parseOwners(raw: string | null | undefined): string[] {
  const s = String(raw ?? "").trim();
  if (!s) return ["家庭"];
  if (s.includes("|")) return s.split("|").map((x) => x.trim()).filter(Boolean);
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}
function formatOwners(arr: string[]): string[] {
  const uniq = Array.from(new Set(arr.map((x) => String(x ?? "").trim()).filter(Boolean)));
  const cleaned = uniq.filter((x) => (OWNER_LIST as readonly string[]).includes(x));
  return cleaned.length ? cleaned : ["家庭"];
}
function primaryOwner(rawOwner: string): string {
  const arr = formatOwners(parseOwners(rawOwner));
  return arr[0] || "家庭";
}
function expandNotesToDayMap(notes: NoteRow[]) {
  const map = new Map<string, NoteRow[]>();

  for (const n of notes) {
    const from = n.date_from || n.note_date;
    const to = n.date_to || n.date_from || n.note_date;
    if (!from || !to) continue;

    let cur = from;
    while (cur <= to) {
      const arr = map.get(cur) ?? [];
      arr.push(n);
      map.set(cur, arr);
      cur = addDays(cur, 1);
    }
  }

  for (const [k, v] of map.entries()) {
    v.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
    map.set(k, v);
  }

  return map;
}
function buildMonthGrid(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const startDow = first.getDay();
  const lastDay = new Date(y, m, 0).getDate();

  const cells: { date: string | null; day: number | null }[] = [];
  for (let i = 0; i < startDow; i++) cells.push({ date: null, day: null });
  for (let d = 1; d <= lastDay; d++) cells.push({ date: `${y}-${pad(m)}-${pad(d)}`, day: d });
  while (cells.length < 42) cells.push({ date: null, day: null });
  return cells;
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

export default function CalendarPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [ym, setYm] = useState(monthKey(new Date()));
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
    } catch (e: any) {
      toast({ variant: "destructive", title: "讀取行事曆資料失敗", description: e.message });
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ym]);

  const dayMap = useMemo(() => expandNotesToDayMap(notes), [notes]);
  const grid = useMemo(() => buildMonthGrid(ym), [ym]);

  function prevMonth() {
    const [y, m] = ym.split("-").map(Number);
    setYm(monthKey(new Date(y, m - 2, 1)));
  }
  function nextMonth() {
    const [y, m] = ym.split("-").map(Number);
    setYm(monthKey(new Date(y, m, 1)));
  }

  function openNew(date: string) {
    setDraft({
      mode: "new",
      owners: ["家庭"],
      title: "",
      content: "",
      date_from: date,
      date_to: date,
    });
  }
  function openEdit(n: NoteRow) {
    const id = String(n?.id || "").trim();
    if (!id) return;
    setDraft({
      mode: "edit",
      id,
      owners: formatOwners(parseOwners(n.owner)),
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
    setDraft({ ...draft, owners: formatOwners(Array.from(next)) });
  }

  async function saveDraft() {
    if (!WORKSPACE_ID || !draft) return;

    const title = String(draft.title || "").trim();
    if (!title) {
      toast({ variant: "destructive", title: "儲存失敗", description: "標題不可空白" });
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
      const body = {
        workspace_id: WORKSPACE_ID,
        owner: draft.owners, // ✅ array（多選）
        title,
        content: draft.content ?? "",
        date_from: df,
        date_to: dt,
        is_important: false,
      };

      if (draft.mode === "new") {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || "新增失敗");
        toast({ title: "已新增" });
      } else {
        const id = String(draft.id || "").trim();
        if (!id) throw new Error("缺少ID");

        const res = await fetch(`/api/notes/${encodeURIComponent(id)}?workspace_id=${WORKSPACE_ID}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || "儲存失敗");
        toast({ title: "已儲存" });
      }

      closeDraft();
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "儲存失敗", description: e.message });
    } finally {
      setSaving(false);
    }
  }

  function dayOwnerChips(list: NoteRow[]) {
    const owners = Array.from(new Set(list.flatMap((n) => formatOwners(parseOwners(n.owner))).filter(Boolean))).filter((o) =>
      (OWNER_LIST as readonly string[]).includes(o)
    );
    owners.sort((a, b) => OWNER_LIST.indexOf(a as any) - OWNER_LIST.indexOf(b as any));
    return owners.slice(0, 3);
  }

  return (
    <main className="h-dvh flex flex-col bg-white">
      {/* ===== Header：標題 + 月份膠囊 + 本月記事 同一排 ===== */}
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto w-full px-3 sm:px-4">
          <div className="h-16 grid grid-cols-3 items-center gap-3">
            {/* 左：標題 */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="bg-orange-50 text-orange-600 p-2 rounded-xl border border-orange-100 shrink-0">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="font-black text-[20px] text-slate-900 truncate">行事曆</h1>
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[11px] font-black bg-orange-100 text-orange-700">
                    Calendar
                  </span>
                </div>
                <p className="text-[12px] font-medium text-slate-400 truncate -mt-0.5">點格子新增、點事件編輯（可多選 Owner）</p>
              </div>
            </div>

            {/* 中：月份膠囊（置中） */}
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-2 py-1 shadow-sm">
                <button
                  className="h-8 w-8 rounded-full hover:bg-orange-100 hover:text-orange-600 text-slate-600 grid place-items-center transition-colors"
                  onClick={prevMonth}
                  aria-label="上個月"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="text-[18px] sm:text-[20px] font-black tracking-tight text-slate-900 tabular-nums px-1">
                  {ym}
                </div>

                <button
                  className="h-8 w-8 rounded-full hover:bg-orange-100 hover:text-orange-600 text-slate-600 grid place-items-center transition-colors"
                  onClick={nextMonth}
                  aria-label="下個月"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 右：按鈕（上）＋本月記事（下）同一排內 */}
            <div className="flex justify-end">
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-2">
                  <button
                    className="h-9 px-4 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100"
                    onClick={() => router.push("/")}
                  >
                    回首頁
                  </button>

                  <button
                    className="h-9 px-4 rounded-2xl text-sm font-bold border border-slate-300 text-slate-800 hover:bg-slate-100"
                    onClick={() => router.push("/notes")}
                  >
                    去記事本
                  </button>

                  <button
                    className="h-10 w-10 rounded-full bg-orange-600 hover:bg-orange-700 text-white grid place-items-center shadow-sm"
                    onClick={() => openNew(ymd(new Date()))}
                    aria-label="新增記事"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-[12px] font-bold text-slate-600 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                  本月記事：<span className="text-orange-600 tabular-nums">{notes.length}</span>
                  {loading ? "（載入中…）" : ""}
                </div>
              </div>
            </div>
          </div>

          {!WORKSPACE_ID && (
            <div className="pb-3">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                未設定 WORKSPACE_ID（請檢查 .env.local）
              </div>
            </div>
          )}
        </div>

        {/* Weekday Row */}
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

      {/* ===== Grid 7x6（滿版等高） ===== */}
      <section className="flex-1 overflow-hidden bg-white">
        <div className="max-w-6xl mx-auto w-full h-full border-x border-slate-200 bg-slate-100/50 flex flex-col">
          <div className="grid grid-cols-7 grid-rows-6 flex-1 bg-slate-200 gap-px">
            {grid.map((c, idx) => {
              // 空白格：淡灰底
              if (!c.date) return <div key={`empty-${idx}`} className="bg-slate-100/70" aria-hidden="true" />;

              const list = dayMap.get(c.date) ?? [];
              const chips = list.length ? dayOwnerChips(list) : [];
              const isToday = c.date === ymd(new Date());

              // ✅ 外層非 button：避免 button 包 button
              return (
                <div
                  key={c.date}
                  role="button"
                  tabIndex={0}
                  onClick={() => openNew(c.date!)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openNew(c.date!);
                    }
                  }}
                  className={cn(
                    "relative flex flex-col w-full h-full text-left overflow-hidden",
                    "p-1.5 outline-none transition-colors select-none",
                    "bg-white hover:bg-orange-50/40 active:bg-orange-50/60",
                    "focus:ring-2 focus:ring-orange-500/20",
                    isToday && "bg-orange-50/70"
                  )}
                >
                  {/* 日期 + chips */}
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <div
                      className={cn(
                        "text-[12px] font-black tabular-nums w-6 h-6 flex items-center justify-center rounded-full",
                        isToday ? "bg-orange-500 text-white shadow-sm shadow-orange-500/30" : "text-slate-700"
                      )}
                    >
                      {c.day}
                    </div>

                    {chips.length > 0 && (
                      <div className="flex items-center gap-[2px] flex-wrap justify-end pt-0.5">
                        {chips.map((o) => {
                          const st = OWNER_STYLE[o] || OWNER_STYLE["家庭"];
                          return (
                            <span
                              key={o}
                              className={cn(
                                "px-1 py-[2px] rounded text-[8px] font-black border leading-none",
                                st.chip,
                                st.ring.replace("ring-", "border-")
                              )}
                            >
                              {o}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 事件列表 */}
                  <div className="flex-1 overflow-hidden space-y-[3px]">
                    {list.slice(0, 3).map((n) => {
                      const o = primaryOwner(n.owner);
                      const st = OWNER_STYLE[o] || OWNER_STYLE["家庭"];
                      return (
                        <button
                          key={n.id}
                          type="button"
                          className={cn(
                            "w-full text-left text-[10px] font-bold truncate leading-tight",
                            "rounded-[4px] px-1.5 py-[4px] border",
                            "active:opacity-80 transition-opacity",
                            st.itemBg
                          )}
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
                      <div className="text-[10px] font-bold text-slate-400 pl-1 mt-1">+{list.length - 3} 則</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Mobile FAB */}
      <button
        type="button"
        className="md:hidden fixed right-5 bottom-[calc(16px+env(safe-area-inset-bottom)+72px)] z-30 h-14 w-14 rounded-full bg-orange-600 hover:bg-orange-700 text-white shadow-xl shadow-orange-600/40 grid place-items-center transition-transform active:scale-95"
        onClick={() => openNew(ymd(new Date()))}
        aria-label="新增記事"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* ===== Draft Drawer ===== */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center sm:p-6">
          <button className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={closeDraft} aria-label="關閉" />

          <div className="relative w-full sm:max-w-xl bg-white rounded-t-[32px] sm:rounded-3xl shadow-2xl max-h-[86dvh] sm:max-h-[85vh] overflow-y-auto">
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
                    <span className="text-[12px] font-bold text-slate-500 tabular-nums">
                      {draft.date_from ?? ""}
                      {draft.date_to && draft.date_to !== draft.date_from ? ` ～ ${draft.date_to}` : ""}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 grid place-items-center"
                    onClick={closeDraft}
                    aria-label="關閉"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    className="h-9 px-4 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold shadow-md shadow-orange-600/20 disabled:opacity-60"
                    onClick={saveDraft}
                    disabled={saving}
                  >
                    {saving ? "儲存中" : "儲存"}
                  </button>
                </div>
              </div>

              <input
                className="w-full h-12 px-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none text-slate-900 text-[16px] font-black placeholder:text-slate-400"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="輸入標題..."
                autoFocus={draft.mode === "new"}
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-[11px] text-slate-500 font-bold ml-1">開始日期</div>
                  <input
                    type="date"
                    className="w-full h-11 px-3 rounded-2xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none text-slate-900 text-sm font-medium bg-white"
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
                    className="w-full h-11 px-3 rounded-2xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none text-slate-900 text-sm font-medium bg-white"
                    value={draft.date_to ?? ""}
                    onChange={(e) => setDraft({ ...draft, date_to: e.target.value || null })}
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] text-slate-500 font-bold ml-1">選擇分類標籤（可多選）</div>
                <div className="flex flex-wrap gap-2">
                  {OWNER_LIST.map((o) => {
                    const active = draft.owners.includes(o);
                    const st = OWNER_STYLE[o];
                    return (
                      <button
                        key={o}
                        type="button"
                        className={cn(
                          "px-4 py-1.5 rounded-full text-sm font-bold transition-all",
                          active ? `${st.chip} shadow-sm ring-1 ${st.ring}` : "bg-slate-50 text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100"
                        )}
                        onClick={() => toggleOwner(o)}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
              </div>

              <textarea
                className="w-full min-h-[160px] rounded-2xl border border-slate-200 p-4 text-slate-900 text-sm leading-relaxed outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 resize-none bg-slate-50 focus:bg-white placeholder:text-slate-300"
                value={draft.content}
                onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                placeholder="點此輸入詳細內容..."
              />

              <div className="h-[env(safe-area-inset-bottom)] sm:h-0" />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
