// src/app/notes/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parseOwners } from "@/lib/notesRepo";

const WORKSPACE_ID = process.env.NEXT_PUBLIC_WORKSPACE_ID || "";

type NoteRow = {
  id: string;
  owner: string; // DB pipe string: |子逸|雅惠|
  title: string;
  content: string;
  note_date: string | null;
  date_from: string | null;
  date_to: string | null;
  updated_at: string;
};

const OWNERS = ["家庭", "雅惠", "昱元", "子逸", "英茵"] as const;

const OWNER_STYLE: Record<string, { chip: string; dot: string; ring: string }> = {
  家庭: { chip: "bg-slate-100 text-slate-700", dot: "bg-slate-400", ring: "ring-slate-200" },
  雅惠: { chip: "bg-rose-100 text-rose-700", dot: "bg-rose-500", ring: "ring-rose-200" },
  昱元: { chip: "bg-blue-100 text-blue-700", dot: "bg-blue-500", ring: "ring-blue-200" },
  子逸: { chip: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", ring: "ring-emerald-200" },
  英茵: { chip: "bg-amber-100 text-amber-800", dot: "bg-amber-500", ring: "ring-amber-200" },
};

function fmt10(s?: string | null) {
  if (!s) return "";
  return String(s).slice(0, 10);
}

function isValidYmd(s: string) {
  // very lightweight check: YYYY-MM-DD
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default function NoteDetailPage() {
  const router = useRouter();
  const params = useParams<any>();
  const { toast } = useToast();

  // ✅ params.id 兼容 string|string[]
  const raw = params?.id;
  const id = Array.isArray(raw) ? String(raw[0] || "") : String(raw || "");
  const noteId = id.trim();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [note, setNote] = useState<NoteRow | null>(null);

  // draft fields
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftOwners, setDraftOwners] = useState<string[]>(["家庭"]);
  const [dateMode, setDateMode] = useState<"single" | "range">("single");
  const [df, setDf] = useState<string>(""); // date_from
  const [dt, setDt] = useState<string>(""); // date_to

  const ownerChips = useMemo(() => {
    const arr = draftOwners.length ? draftOwners : ["家庭"];
    return arr;
  }, [draftOwners]);

  // ✅ 避免缺少ID：id 未就緒不打 API
  async function load() {
    if (!WORKSPACE_ID) return;
    if (!noteId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}?workspace_id=${WORKSPACE_ID}`, {
        cache: "no-store",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "讀取記事失敗");

      const data: NoteRow | null = j?.data ?? null;
      if (!data?.id) throw new Error("資料異常：缺少 id");

      setNote(data);

      // init drafts
      setDraftTitle(String(data.title ?? ""));
      setDraftContent(String(data.content ?? ""));

      const owners = parseOwners(data.owner);
      setDraftOwners(owners.length ? owners : ["家庭"]);

      const from = data.date_from ?? data.note_date ?? "";
      const to = data.date_to ?? data.date_from ?? data.note_date ?? "";

      if (from && to && from !== to) setDateMode("range");
      else setDateMode("single");

      setDf(from ? fmt10(from) : "");
      setDt(to ? fmt10(to) : (from ? fmt10(from) : ""));
    } catch (e: any) {
      toast({ variant: "destructive", title: "讀取失敗", description: e.message });
      setNote(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (noteId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  function toggleOwner(o: string) {
    setDraftOwners((prev) => {
      const exists = prev.includes(o);
      const next = exists ? prev.filter((x) => x !== o) : [...prev, o];

      // ✅ 至少保留 1 個 owner（避免空掉後被當成家庭）
      return next.length ? next : ["家庭"];
    });
  }

  async function save() {
    if (!WORKSPACE_ID || !noteId) {
      toast({ variant: "destructive", title: "儲存失敗", description: "缺少ID" });
      return;
    }
    const t = draftTitle.trim();
    if (!t) {
      toast({ variant: "destructive", title: "儲存失敗", description: "title 不可空白" });
      return;
    }

    // ✅ 日期：single -> df=dt；range -> df/dt
    const from = df.trim();
    const to = (dateMode === "range" ? dt.trim() : df.trim());

    // 允許不填日期：但你要行事曆顯示就一定要有 from/to
    if (from && !isValidYmd(from)) {
      toast({ variant: "destructive", title: "儲存失敗", description: "起日格式需為 YYYY-MM-DD" });
      return;
    }
    if (to && !isValidYmd(to)) {
      toast({ variant: "destructive", title: "儲存失敗", description: "迄日格式需為 YYYY-MM-DD" });
      return;
    }
    if (from && to && to < from) {
      toast({ variant: "destructive", title: "儲存失敗", description: "迄日不可早於起日" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}?workspace_id=${WORKSPACE_ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: WORKSPACE_ID,
          title: t,
          content: draftContent,
          owners: draftOwners.length ? draftOwners : ["家庭"], // ✅ 重點：一定要送 owners
          // ✅ 重點：一定要送日期（才會出現在行事曆）
          date_from: from || null,
          date_to: (to || from) ? (to || from) : null,
        }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "儲存失敗");

      toast({ title: "已儲存" });
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "儲存失敗", description: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!WORKSPACE_ID || !noteId) {
      toast({ variant: "destructive", title: "刪除失敗", description: "缺少ID" });
      return;
    }
    if (!confirm("確定刪除這則記事？")) return;

    try {
      const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}?workspace_id=${WORKSPACE_ID}`, {
        method: "DELETE",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "刪除失敗");

      toast({ title: "已刪除" });
      router.push("/notes");
    } catch (e: any) {
      toast({ variant: "destructive", title: "刪除失敗", description: e.message });
    }
  }

  // ✅ id 還沒就緒
  if (!noteId) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl text-center text-slate-400 py-16">載入中…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="card bg-white shadow-sm border border-slate-200 rounded-3xl">
          <div className="card-body p-6 flex items-center justify-between gap-3">
            <button className="btn btn-ghost btn-sm" onClick={() => router.push("/notes")}>
              <ArrowLeft className="w-4 h-4" /> 返回
            </button>

            <div className="flex gap-2">
              <button className="btn btn-outline btn-sm rounded-xl" onClick={del} disabled={saving || loading}>
                <Trash2 className="w-4 h-4 text-rose-500" /> 刪除
              </button>
              <button className="btn btn-primary btn-sm rounded-xl" onClick={save} disabled={saving || loading}>
                <Save className="w-4 h-4" /> {saving ? "儲存中…" : "儲存"}
              </button>
            </div>
          </div>
        </div>

        {loading && <div className="text-center text-slate-400 py-10">載入中…</div>}

        {!loading && !note && (
          <div className="text-center text-slate-400 py-16">找不到這則記事（可能已刪除）</div>
        )}

        {!loading && note && (
          <div className="card bg-white shadow-sm border border-slate-200 rounded-3xl">
            <div className="card-body p-6 space-y-5">
              {/* ✅ OWNER 多選 chips */}
              <div className="flex flex-wrap gap-2">
                {OWNERS.map((o) => {
                  const active = draftOwners.includes(o);
                  const st = OWNER_STYLE[o];
                  return (
                    <button
                      key={o}
                      type="button"
                      className={[
                        "px-3 py-1.5 rounded-full text-sm font-bold ring-1 transition",
                        active ? `${st.chip} ${st.ring}` : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                      ].join(" ")}
                      onClick={() => toggleOwner(o)}
                      title="可多選"
                    >
                      <span
                        className={[
                          "inline-block w-2 h-2 rounded-full mr-2 align-middle",
                          active ? st.dot : "bg-slate-300",
                        ].join(" ")}
                      />
                      {o}
                    </button>
                  );
                })}
              </div>

              {/* Title */}
              <input
                className="input input-bordered w-full rounded-2xl text-lg font-black"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="標題"
              />

              {/* ✅ 日期 / 日期區間 */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={[
                      "px-3 py-1.5 rounded-full text-sm font-black ring-1",
                      dateMode === "single" ? "bg-white text-slate-800 ring-slate-300" : "bg-transparent text-slate-500 ring-slate-200",
                    ].join(" ")}
                    onClick={() => {
                      setDateMode("single");
                      setDt(df || "");
                    }}
                  >
                    單日
                  </button>
                  <button
                    type="button"
                    className={[
                      "px-3 py-1.5 rounded-full text-sm font-black ring-1",
                      dateMode === "range" ? "bg-white text-slate-800 ring-slate-300" : "bg-transparent text-slate-500 ring-slate-200",
                    ].join(" ")}
                    onClick={() => {
                      setDateMode("range");
                      if (!dt) setDt(df || "");
                    }}
                  >
                    區間
                  </button>

                  <div className="ml-auto text-xs text-slate-400">
                    {df ? `起日：${df}` : "未設定日期"}{dateMode === "range" && dt ? ` / 迄日：${dt}` : ""}
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-3">
                  <label className="flex-1">
                    <div className="text-xs text-slate-500 mb-1 font-bold">起日</div>
                    <input
                      type="date"
                      className="input input-bordered w-full rounded-xl"
                      value={df}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDf(v);
                        if (dateMode === "single") setDt(v);
                        else if (dt && dt < v) setDt(v);
                      }}
                    />
                  </label>

                  <label className={`flex-1 ${dateMode === "range" ? "" : "opacity-40 pointer-events-none"}`}>
                    <div className="text-xs text-slate-500 mb-1 font-bold">迄日</div>
                    <input
                      type="date"
                      className="input input-bordered w-full rounded-xl"
                      value={dt}
                      onChange={(e) => setDt(e.target.value)}
                    />
                  </label>
                </div>

                <div className="text-[11px] text-slate-400">
                  行事曆顯示需要設定日期（起日/迄日）。單日＝起日；區間＝起日到迄日。
                </div>
              </div>

              {/* Content */}
              <textarea
                className="textarea textarea-bordered rounded-2xl w-full min-h-[220px] text-sm leading-relaxed p-4"
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                placeholder="輸入記事內容…"
              />

              {/* Preview chips row */}
              <div className="flex flex-wrap gap-2">
                {ownerChips.map((o) => {
                  const st = OWNER_STYLE[o] || OWNER_STYLE["家庭"];
                  return (
                    <span key={o} className={["px-2.5 py-1 rounded-full text-xs font-black", st.chip].join(" ")}>
                      {o}
                    </span>
                  );
                })}
              </div>

              <div className="text-xs text-slate-400">
                更新：{fmt10(note.updated_at)}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
