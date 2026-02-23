// src/app/calendar/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const OWNER_STYLE: Record<
  string,
  { chip: string; ring: string; itemBg: string; barBg: string }
> = {
  家庭: {
    chip: "bg-indigo-100 text-indigo-800",
    ring: "ring-indigo-300",
    itemBg: "bg-indigo-50 text-indigo-800 border-indigo-100",
    barBg: "bg-indigo-200/70 text-indigo-900 border-indigo-200",
  },
  爸媽: {
    chip: "bg-orange-200 text-orange-800",
    ring: "ring-orange-300",
    itemBg: "bg-orange-50 text-orange-800 border-orange-100",
    barBg: "bg-orange-200/70 text-orange-900 border-orange-200",
  },
  雅惠: {
    chip: "bg-rose-100 text-rose-700",
    ring: "ring-rose-200",
    itemBg: "bg-rose-50 text-rose-700 border-rose-100",
    barBg: "bg-rose-200/70 text-rose-900 border-rose-200",
  },
  昱元: {
    chip: "bg-blue-100 text-blue-700",
    ring: "ring-blue-200",
    itemBg: "bg-blue-50 text-blue-700 border-blue-100",
    barBg: "bg-blue-200/70 text-blue-900 border-blue-200",
  },
  子逸: {
    chip: "bg-emerald-100 text-emerald-700",
    ring: "ring-emerald-200",
    itemBg: "bg-emerald-50 text-emerald-700 border-emerald-100",
    barBg: "bg-emerald-200/70 text-emerald-900 border-emerald-200",
  },
  英茵: {
    chip: "bg-amber-100 text-amber-800",
    ring: "ring-amber-200",
    itemBg: "bg-amber-50 text-amber-800 border-amber-100",
    barBg: "bg-amber-200/70 text-amber-900 border-amber-200",
  },
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
function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return ymd(d);
}
function cmpDate(a: string, b: string) {
  return a.localeCompare(b);
}
function clampDate(d: string, min: string, max: string) {
  if (cmpDate(d, min) < 0) return min;
  if (cmpDate(d, max) > 0) return max;
  return d;
}
function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const from = `${y}-${pad(m)}-01`;
  const last = new Date(y, m, 0).getDate();
  const to = `${y}-${pad(m)}-${pad(last)}`;
  return { from, to };
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
function noteRange(n: NoteRow) {
  const from = n.date_from || n.note_date;
  const to = n.date_to || n.date_from || n.note_date;
  return { from, to };
}

// Month weeks: always 6 rows × 7
type Cell = { date: string | null; day: number | null; inMonth: boolean };
function buildMonthWeeks(ym: string): Cell[][] {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const startDow = first.getDay();
  const lastDay = new Date(y, m, 0).getDate();

  const cells: Cell[] = [];
  for (let i = 0; i < startDow; i++) cells.push({ date: null, day: null, inMonth: false });
  for (let d = 1; d <= lastDay; d++) {
    cells.push({ date: `${y}-${pad(m)}-${pad(d)}`, day: d, inMonth: true });
  }
  while (cells.length < 42) cells.push({ date: null, day: null, inMonth: false });

  const weeks: Cell[][] = [];
  for (let i = 0; i < 42; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// Week range Sun..Sat
function weekRangeByAnchor(anchorYmd: string) {
  const d = new Date(anchorYmd + "T00:00:00");
  const dow = d.getDay(); // 0=Sun
  const start = new Date(d);
  start.setDate(start.getDate() - dow);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { from: ymd(start), to: ymd(end) };
}
function weekLabel(from: string, to: string) {
  return `${from} ~ ${to}`;
}

// Month view segments within a week
type Seg = {
  id: string;
  note: NoteRow;
  startIdx: number;
  endIdx: number;
  segFrom: string;
  segTo: string;
};

function buildWeekSegments(weekDates: Array<string | null>, notes: NoteRow[]) {
  const dates = weekDates.filter(Boolean) as string[];
  if (dates.length === 0) return { lanes: [] as Seg[][], hiddenByDate: new Map<string, number>() };

  const weekStart = dates[0];
  const weekEnd = dates[dates.length - 1];

  const segs: Seg[] = [];
  for (const n of notes) {
    const r = noteRange(n);
    if (!r.from || !r.to) continue;
    if (cmpDate(r.to, weekStart) < 0) continue;
    if (cmpDate(r.from, weekEnd) > 0) continue;

    const segFrom = clampDate(r.from, weekStart, weekEnd);
    const segTo = clampDate(r.to, weekStart, weekEnd);

    const startIdx = weekDates.findIndex((x) => x === segFrom);
    const endIdx = weekDates.findIndex((x) => x === segTo);
    if (startIdx < 0 || endIdx < 0) continue;

    segs.push({ id: String(n.id), note: n, startIdx, endIdx, segFrom, segTo });
  }

  segs.sort((a, b) => {
    const c1 = cmpDate(a.segFrom, b.segFrom);
    if (c1 !== 0) return c1;
    const lenA = a.endIdx - a.startIdx;
    const lenB = b.endIdx - b.startIdx;
    return lenB - lenA;
  });

  const lanes: Seg[][] = [];
  const hiddenByDate = new Map<string, number>();

  function overlaps(a: Seg, b: Seg) {
    return !(a.endIdx < b.startIdx || b.endIdx < a.startIdx);
  }

  for (const s of segs) {
    let placed = false;
    for (const lane of lanes) {
      if (!lane.some((x) => overlaps(x, s))) {
        lane.push(s);
        placed = true;
        break;
      }
    }
    if (!placed) {
      if (lanes.length < 3) lanes.push([s]);
      else hiddenByDate.set(s.segFrom, (hiddenByDate.get(s.segFrom) || 0) + 1);
    }
  }

  for (const lane of lanes) lane.sort((a, b) => a.startIdx - b.startIdx);

  return { lanes, hiddenByDate };
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
  const { toast } = useToast();

  const [mode, setMode] = useState<"month" | "week">("month");
  const [ym, setYm] = useState(monthKey(new Date()));
  const [weekAnchor, setWeekAnchor] = useState(ymd(new Date()));

  const queryRange = useMemo(() => {
    if (mode === "month") return monthRange(ym);
    return weekRangeByAnchor(weekAnchor);
  }, [mode, ym, weekAnchor]);

  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  // Swipe (week view)
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const isSwiping = useRef(false);
  const swipeCooldownRef = useRef(false);

  async function load() {
    if (!WORKSPACE_ID) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/notes?workspace_id=${WORKSPACE_ID}&from=${queryRange.from}&to=${queryRange.to}&limit=500`,
        { cache: "no-store" }
      );
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
  }, [mode, ym, weekAnchor]);

  function prev() {
    if (mode === "month") {
      const [y, m] = ym.split("-").map(Number);
      setYm(monthKey(new Date(y, m - 2, 1)));
    } else {
      setWeekAnchor(addDays(weekAnchor, -7));
    }
  }
  function next() {
    if (mode === "month") {
      const [y, m] = ym.split("-").map(Number);
      setYm(monthKey(new Date(y, m, 1)));
    } else {
      setWeekAnchor(addDays(weekAnchor, 7));
    }
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
    const nextSet = new Set(draft.owners);
    if (nextSet.has(o)) nextSet.delete(o);
    else nextSet.add(o);
    setDraft({ ...draft, owners: formatOwners(Array.from(nextSet)) });
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
        owner: draft.owners,
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

  // Month view
  const monthWeeks = useMemo(() => buildMonthWeeks(ym), [ym]);

  // Week view
  const weekRange = useMemo(() => weekRangeByAnchor(weekAnchor), [weekAnchor]);
  const weekDays = useMemo(() => {
    const days: string[] = [];
    let cur = weekRange.from;
    for (let i = 0; i < 7; i++) {
      days.push(cur);
      cur = addDays(cur, 1);
    }
    return days;
  }, [weekRange.from]);

  // Week view: auto scroll to today when visible in this week
  useEffect(() => {
    if (mode !== "week") return;
    const today = ymd(new Date());
    const el = document.getElementById(`week-day-${today}`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [mode, weekDays]);

  // Swipe handlers (week view)
  function onWeekTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (draft) return;
    const t = e.touches[0];
    swipeStartX.current = t.clientX;
    swipeStartY.current = t.clientY;
    isSwiping.current = false;
  }
  function onWeekTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (draft) return;
    if (swipeStartX.current == null || swipeStartY.current == null) return;

    const t = e.touches[0];
    const dx = t.clientX - swipeStartX.current;
    const dy = t.clientY - swipeStartY.current;

    if (!isSwiping.current) {
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        isSwiping.current = true;
      }
    }
  }
  function onWeekTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    if (draft) return;
    if (swipeCooldownRef.current) return;

    const startX = swipeStartX.current;
    const startY = swipeStartY.current;
    swipeStartX.current = null;
    swipeStartY.current = null;

    if (startX == null || startY == null) return;
    if (!isSwiping.current) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    if (Math.abs(dx) < 60) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.2) return;

    swipeCooldownRef.current = true;
    window.setTimeout(() => (swipeCooldownRef.current = false), 250);

    if (dx < 0) setWeekAnchor((prev) => addDays(prev, 7)); // left -> next week
    else setWeekAnchor((prev) => addDays(prev, -7)); // right -> prev week
  }

  const countText = notes.length;

  return (
    <main className="h-dvh flex flex-col bg-white">
      {/* ===== Header (移除 回首頁/去記事本) ===== */}
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
                <p className="text-[12px] font-medium text-slate-400 truncate -mt-0.5">
                  {mode === "month"
                    ? "月視圖：多日事件橫跨顯示（跨週切角）"
                    : "週視圖：左右滑動切換週"}
                </p>
              </div>
            </div>

            {/* 中：模式 + 膠囊（置中，同排） */}
            <div className="flex justify-center items-center gap-2">
              <div className="inline-flex items-center bg-slate-50 border border-slate-200 rounded-full p-1 shadow-sm">
                <button
                  type="button"
                  className={cn(
                    "h-8 px-3 rounded-full text-sm font-black transition-colors",
                    mode === "month"
                      ? "bg-orange-600 text-white shadow-sm"
                      : "text-slate-700 hover:bg-slate-100"
                  )}
                  onClick={() => setMode("month")}
                >
                  月
                </button>
                <button
                  type="button"
                  className={cn(
                    "h-8 px-3 rounded-full text-sm font-black transition-colors",
                    mode === "week"
                      ? "bg-orange-600 text-white shadow-sm"
                      : "text-slate-700 hover:bg-slate-100"
                  )}
                  onClick={() => setMode("week")}
                >
                  週
                </button>
              </div>

              <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full px-2 py-1 shadow-sm">
                <button
                  className="h-8 w-8 rounded-full hover:bg-orange-100 hover:text-orange-600 text-slate-600 grid place-items-center transition-colors"
                  onClick={prev}
                  aria-label={mode === "month" ? "上個月" : "上一週"}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="text-[15px] sm:text-[18px] font-black tracking-tight text-slate-900 tabular-nums px-1 whitespace-nowrap">
                  {mode === "month" ? ym : weekLabel(weekRange.from, weekRange.to)}
                </div>

                <button
                  className="h-8 w-8 rounded-full hover:bg-orange-100 hover:text-orange-600 text-slate-600 grid place-items-center transition-colors"
                  onClick={next}
                  aria-label={mode === "month" ? "下個月" : "下一週"}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 右：新增 + 計數 */}
            <div className="flex justify-end">
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-2">
                  <button
                    className="h-10 w-10 rounded-full bg-orange-600 hover:bg-orange-700 text-white grid place-items-center shadow-sm"
                    onClick={() => openNew(ymd(new Date()))}
                    aria-label="新增記事"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-[12px] font-bold text-slate-600 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                  {mode === "month" ? "本月記事：" : "本週記事："}
                  <span className="text-orange-600 tabular-nums">{countText}</span>
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

      {/* ===== Body ===== */}
      <section className="flex-1 overflow-hidden bg-white">
        <div className="max-w-6xl mx-auto w-full h-full border-x border-slate-200 bg-slate-100/50 flex flex-col">
          {/* ===== Month view ===== */}
          {mode === "month" && (
            <div className="flex-1 overflow-hidden bg-slate-200">
              <div className="grid grid-rows-6 h-full gap-px">
                {monthWeeks.map((week, wi) => {
                  const weekDates = week.map((c) => c.date);
                  const { lanes, hiddenByDate } = buildWeekSegments(weekDates, notes);

                  return (
                    <div key={`wk-${wi}`} className="relative bg-white">
                      <div className="grid grid-cols-7 h-full gap-px bg-slate-200">
                        {week.map((c, di) => {
                          if (!c.date) {
                            return <div key={`empty-${wi}-${di}`} className="bg-slate-100/70" />;
                          }

                          const isToday = c.date === ymd(new Date());
                          const hidden = hiddenByDate.get(c.date) || 0;

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
                                "relative hover:bg-orange-50/40 active:bg-orange-50/60 transition-colors outline-none",
                                "p-1.5 select-none",
                                isToday && "bg-orange-50/70",
                                !c.inMonth ? "bg-slate-50/70" : "bg-white"
                              )}
                            >
                              <div className="flex items-start justify-between">
                                <div
                                  className={cn(
                                    "text-[12px] font-black tabular-nums w-6 h-6 flex items-center justify-center rounded-full",
                                    isToday
                                      ? "bg-orange-500 text-white shadow-sm shadow-orange-500/30"
                                      : "text-slate-700"
                                  )}
                                >
                                  {c.day}
                                </div>

                                {hidden > 0 && (
                                  <div className="text-[10px] font-black text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                                    +{hidden}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="pointer-events-none absolute inset-x-0 top-[34px] px-1.5">
                        <div className="grid grid-cols-7 gap-x-px">
                          {lanes.map((lane, li) => (
                            <div
                              key={`lane-${wi}-${li}`}
                              className="col-span-7 grid grid-cols-7 gap-x-px"
                              style={{ marginTop: li === 0 ? 0 : 6 }}
                            >
                              {lane.map((seg) => {
                                const owner = primaryOwner(seg.note.owner);
                                const st = OWNER_STYLE[owner] || OWNER_STYLE["家庭"];

                                const fullFrom = seg.note.date_from || seg.note.note_date || seg.segFrom;
                                const fullTo =
                                  seg.note.date_to ||
                                  seg.note.date_from ||
                                  seg.note.note_date ||
                                  seg.segTo;

                                const continuesFromPrev = seg.segFrom !== fullFrom;
                                const continuesToNext = seg.segTo !== fullTo;

                                return (
                                  <button
                                    key={`${seg.id}-${seg.segFrom}-${seg.segTo}-${li}`}
                                    type="button"
                                    className={cn(
                                      "pointer-events-auto h-5 border text-[10px] font-black truncate px-2 text-left relative",
                                      st.barBg,
                                      continuesFromPrev && "rounded-r-md rounded-l-none pl-2.5",
                                      continuesToNext && "rounded-l-md rounded-r-none pr-2.5",
                                      !continuesFromPrev && !continuesToNext && "rounded-md"
                                    )}
                                    style={{
                                      gridColumn: `${seg.startIdx + 1} / ${seg.endIdx + 2}`,
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEdit(seg.note);
                                    }}
                                    title={`${seg.note.title}（${seg.segFrom} ~ ${seg.segTo}）`}
                                  >
                                    {continuesFromPrev && (
                                      <span className="absolute left-0 top-0 bottom-0 w-2.5">
                                        <span className="absolute left-0 top-0 bottom-0 w-2.5 bg-white/60 [clip-path:polygon(0%_0%,100%_50%,0%_100%)]" />
                                      </span>
                                    )}
                                    {continuesToNext && (
                                      <span className="absolute right-0 top-0 bottom-0 w-2.5">
                                        <span className="absolute right-0 top-0 bottom-0 w-2.5 bg-white/60 [clip-path:polygon(100%_0%,0%_50%,100%_100%)]" />
                                      </span>
                                    )}
                                    {seg.note.title}
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== Week view (Swipe to change week) ===== */}
          {mode === "week" && (
            <div
              className="flex-1 bg-slate-200 overflow-x-auto"
              onTouchStart={onWeekTouchStart}
              onTouchMove={onWeekTouchMove}
              onTouchEnd={onWeekTouchEnd}
            >
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 flex items-center justify-between">
                <span>左右滑動切換週</span>
                <span className="tabular-nums">{weekLabel(weekRange.from, weekRange.to)}</span>
              </div>

              <div className="grid grid-cols-7 h-[calc(100%-40px)] gap-px">
                {weekDays.map((d) => {
                  const isToday = d === ymd(new Date());
                  const todays = notes
                    .filter((n) => {
                      const r = noteRange(n);
                      if (!r.from || !r.to) return false;
                      return cmpDate(r.from, d) <= 0 && cmpDate(r.to, d) >= 0;
                    })
                    .sort((a, b) =>
                      String(b.updated_at || "").localeCompare(String(a.updated_at || ""))
                    );

                  return (
                    <div
                      key={d}
                      id={`week-day-${d}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setWeekAnchor(d);
                        openNew(d);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setWeekAnchor(d);
                          openNew(d);
                        }
                      }}
                      className={cn(
                        "bg-white p-2.5 flex flex-col outline-none hover:bg-orange-50/40 active:bg-orange-50/60 transition-colors",
                        isToday && "bg-orange-50/70"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className={cn(
                            "text-[12px] font-black tabular-nums w-8 h-8 flex items-center justify-center rounded-full",
                            isToday
                              ? "bg-orange-500 text-white shadow-sm shadow-orange-500/30"
                              : "text-slate-800 bg-slate-50 border border-slate-200"
                          )}
                        >
                          {d.slice(8, 10)}
                        </div>
                        <div className="text-[11px] font-bold text-slate-400">{d}</div>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                        {todays.length === 0 && (
                          <div className="text-[12px] font-bold text-slate-300 mt-6 text-center">
                            （無事項）
                          </div>
                        )}

                        {todays.map((n) => {
                          const owner = primaryOwner(n.owner);
                          const st = OWNER_STYLE[owner] || OWNER_STYLE["家庭"];
                          const r = noteRange(n);

                          return (
                            <button
                              key={n.id}
                              type="button"
                              className={cn(
                                "w-full text-left rounded-xl border p-2 transition-opacity active:opacity-80",
                                st.itemBg
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(n);
                              }}
                              title={n.title}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-[12px] font-black truncate">{n.title}</div>
                                <span
                                  className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-black border",
                                    st.chip,
                                    st.ring.replace("ring-", "border-")
                                  )}
                                >
                                  {owner}
                                </span>
                              </div>
                              <div className="text-[11px] font-bold text-slate-500 mt-1">
                                {r.from}
                                {r.to && r.to !== r.from ? ` ~ ${r.to}` : ""}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
          <button
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            onClick={closeDraft}
            aria-label="關閉"
          />

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
                          active
                            ? `${st.chip} shadow-sm ring-1 ${st.ring}`
                            : "bg-slate-50 text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100"
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
