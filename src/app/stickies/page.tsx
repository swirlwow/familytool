"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StickyNote, Plus, Search, Trash2, Pencil, Save, X, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const WORKSPACE_ID = process.env.NEXT_PUBLIC_WORKSPACE_ID || "";

type StickyRow = {
  id: string;
  owner: string;
  title: string;
  content: string;
  updated_at: string;
};

const OWNERS = ["全部", "家庭", "雅惠", "昱元", "子逸", "英茵"] as const;

const OWNER_STYLE: Record<string, { chip: string; dot: string; ring: string }> = {
  家庭: { chip: "bg-slate-100 text-slate-700", dot: "bg-slate-400", ring: "ring-slate-200" },
  雅惠: { chip: "bg-rose-100 text-rose-700", dot: "bg-rose-500", ring: "ring-rose-200" },
  昱元: { chip: "bg-blue-100 text-blue-700", dot: "bg-blue-500", ring: "ring-blue-200" },
  子逸: { chip: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", ring: "ring-emerald-200" },
  英茵: { chip: "bg-amber-100 text-amber-800", dot: "bg-amber-500", ring: "ring-amber-200" },
  全部: { chip: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-500", ring: "ring-yellow-200" },
};

function fmtDate(s: string) {
  if (!s) return "";
  return String(s).slice(0, 10);
}

export default function StickiesPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [q, setQ] = useState("");
  const [owner, setOwner] = useState<(typeof OWNERS)[number]>("全部");
  const [list, setList] = useState<StickyRow[]>([]);
  const [loading, setLoading] = useState(false);

  // 同頁編輯狀態
  const [editingId, setEditingId] = useState<string>("");
  const [draftOwner, setDraftOwner] = useState<string>("家庭");
  const [draftTitle, setDraftTitle] = useState<string>("");
  const [draftContent, setDraftContent] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!WORKSPACE_ID) return;

    setLoading(true);
    try {
      const usp = new URLSearchParams();
      usp.set("workspace_id", WORKSPACE_ID);
      if (q.trim()) usp.set("q", q.trim());
      if (owner !== "全部") usp.set("owner", owner);
      usp.set("limit", "200");

      const res = await fetch(`/api/stickies?${usp.toString()}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "讀取失敗");

      const rows: StickyRow[] = Array.isArray(j.data) ? j.data : [];
      setList(rows.filter((x) => String(x?.id || "").trim()));
    } catch (e: any) {
      toast({ variant: "destructive", title: "讀取便條紙失敗", description: e.message });
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  async function createNew() {
    try {
      if (!WORKSPACE_ID) throw new Error("未設定 WORKSPACE_ID（請檢查 .env.local）");

      const res = await fetch("/api/stickies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: WORKSPACE_ID,
          owner: owner === "全部" ? "家庭" : owner,
          title: owner === "全部" ? "新便條" : `${owner} 便條`,
          content: "",
        }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "新增失敗");

      const id = String(j?.data?.id || "").trim();
      if (!id) throw new Error("新增成功但缺少 id");

      await load();

      setTimeout(() => {
        const row =
          list.find((x) => x.id === id) || {
            id,
            owner: owner === "全部" ? "家庭" : owner,
            title: "新便條",
            content: "",
            updated_at: new Date().toISOString(),
          };
        beginEdit(row);
      }, 100);
    } catch (e: any) {
      toast({ variant: "destructive", title: "新增便條紙失敗", description: e.message });
    }
  }

  function beginEdit(row: StickyRow) {
    const id = String(row?.id || "").trim();
    if (!id) return;
    setEditingId(id);
    setDraftOwner(String(row.owner || "家庭"));
    setDraftTitle(String(row.title || ""));
    setDraftContent(String(row.content || ""));
  }

  function cancelEdit() {
    setEditingId("");
    setDraftOwner("家庭");
    setDraftTitle("");
    setDraftContent("");
  }

  async function saveEdit(row: StickyRow) {
    const id = String(row?.id || "").trim();
    if (!WORKSPACE_ID || !id) {
      toast({ variant: "destructive", title: "儲存失敗", description: "缺少ID（row.id）" });
      return;
    }
    const title = String(draftTitle || "").trim();
    if (!title) {
      toast({ variant: "destructive", title: "儲存失敗", description: "標題不可空白" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/stickies/${encodeURIComponent(id)}?workspace_id=${WORKSPACE_ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: WORKSPACE_ID,
          owner: String(draftOwner || "家庭").trim() || "家庭",
          title,
          content: String(draftContent || ""),
        }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "儲存失敗");

      setList((prev) =>
        prev.map((x) =>
          x.id === id ? { ...x, owner: draftOwner, title, content: draftContent, updated_at: new Date().toISOString() } : x
        )
      );

      toast({ title: "已儲存" });
      cancelEdit();
    } catch (e: any) {
      toast({ variant: "destructive", title: "儲存失敗", description: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row: StickyRow) {
    const id = String(row?.id || "").trim();
    if (!WORKSPACE_ID || !id) return;
    if (!confirm("確定刪除這張便條紙？")) return;

    try {
      const res = await fetch(`/api/stickies/${encodeURIComponent(id)}?workspace_id=${WORKSPACE_ID}`, {
        method: "DELETE",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "刪除失敗");

      toast({ title: "已刪除" });
      setList((prev) => prev.filter((x) => x.id !== id));
      if (editingId === id) cancelEdit();
    } catch (e: any) {
      toast({ variant: "destructive", title: "刪除失敗", description: e.message });
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]);

  const countText = useMemo(() => `共 ${list.length} 張`, [list]);

  // ✅ 產生固定的隨機旋轉角度 (避免 Hydration 錯誤)
  function getRotation(id: string) {
    const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const rotations = ["rotate-1", "-rotate-1", "rotate-2", "-rotate-2", "rotate-0"];
    return rotations[hash % rotations.length];
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-6">
        
        {/* ✅ Header：黏住頂部 + 縮小 - Yellow Theme */}
        <div className="card bg-white/90 backdrop-blur-md shadow-sm border border-slate-200 rounded-2xl sticky top-0 z-40">
          <div className="card-body p-3 flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-amber-50 text-amber-700 p-2 rounded-lg border border-amber-100">
                <StickyNote className="w-5 h-5" />
              </div>

              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-slate-800">便條紙</h1>
                <div className="badge badge-sm bg-amber-100 text-amber-700 border-none font-bold hidden sm:inline-flex">
                  Stickies
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

              {/* ✅ 桌機保留新增；手機改用 FAB */}
              <button
                className="hidden md:inline-flex btn h-9 min-h-0 bg-amber-500 hover:bg-amber-600 text-white border-none rounded-xl px-4 font-black shadow-md shadow-amber-200/30 gap-2"
                onClick={createNew}
              >
                <Plus className="w-4 h-4" /> 新增
              </button>
            </div>
          </div>

          <div className="px-4 pb-3 -mt-1">
            <p className="text-[11px] font-medium text-slate-400">
              隨手紀錄、清單備忘，像牆上的便利貼一樣直觀。
            </p>
          </div>

          {!WORKSPACE_ID && (
            <div className="px-4 pb-3">
              <div className="alert alert-warning rounded-2xl py-3 text-sm bg-white border border-slate-200">
                未設定 WORKSPACE_ID（請檢查 .env.local）
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
                    className="input input-bordered w-full pl-10 rounded-xl focus:border-amber-400 bg-slate-50 border-slate-200 focus:bg-white transition-all"
                    placeholder="搜尋便條標題或內容..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && load()}
                  />
                </div>
                <button
                  className="btn btn-outline border-slate-200 text-slate-600 hover:text-amber-600 hover:border-amber-200 hover:bg-yellow-50 rounded-xl px-6"
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
                  {OWNERS.map((o) => {
                    const active = owner === o;
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
                        onClick={() => setOwner(o)}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${active ? st.dot : "bg-slate-300"}`} />
                        {o}
                      </button>
                    );
                  })}
                </div>
                <div className="text-xs font-medium text-slate-400 text-right shrink-0">
                  {loading ? <span className="loading loading-spinner loading-xs text-amber-500"></span> : countText}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stickies Wall */}
        {!loading && list.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
            <div className="bg-amber-100 p-6 rounded-full mb-4">
              <StickyNote className="w-12 h-12 text-amber-400" />
            </div>
            <div className="font-bold text-slate-400 text-lg">目前沒有便條紙</div>
            <p className="text-slate-400 text-sm mt-1">點擊右下角「＋」建立第一張便利貼吧！</p>
          </div>
        )}

        {!loading && list.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start px-2">
            {list.map((s) => {
              const st = OWNER_STYLE[s.owner] || OWNER_STYLE["家庭"];
              const isEditing = editingId === s.id;
              const rotationClass = isEditing ? "rotate-0 scale-105 z-20" : getRotation(s.id);

              return (
                <div
                  key={s.id}
                  className={`
                    relative transition-all duration-300 group flex flex-col min-h-[220px]
                    ${rotationClass}
                    ${isEditing
                      ? "bg-white border-2 border-amber-400 shadow-xl"
                      : "bg-amber-100 border border-amber-200 shadow-sm shadow-amber-900/5 hover:shadow-md hover:shadow-amber-900/10 hover:-translate-y-1 hover:z-10"
                    }
                    rounded-sm
                  `}
                >
                  {/* Tape Effect */}
                  {!isEditing && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-8 bg-white/40 rotate-1 backdrop-blur-[1px] shadow-sm pointer-events-none z-10"></div>
                  )}

                  <div className="card-body p-5 flex flex-col h-full">
                    {/* Header: Owner & Actions */}
                    <div className="flex items-center justify-between mb-3 relative z-10">
                      {!isEditing ? (
                        <span className="px-2 py-0.5 rounded-sm text-[10px] font-black tracking-wide border border-black/5 bg-white/50 text-slate-600">
                          {s.owner}
                        </span>
                      ) : (
                        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide max-w-[200px]">
                          {(["家庭", "雅惠", "昱元", "子逸", "英茵"] as const).map((o) => {
                            const active = draftOwner === o;
                            const st2 = OWNER_STYLE[o];
                            return (
                              <button
                                key={o}
                                onClick={() => setDraftOwner(o)}
                                className={`w-4 h-4 rounded-full border ${active ? "ring-2 ring-offset-1 ring-slate-400" : "opacity-40 hover:opacity-100"
                                  } ${st2.dot.replace("text-", "bg-")}`}
                                title={o}
                              />
                            );
                          })}
                        </div>
                      )}

                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isEditing ? (
                          <>
                            <button className="btn btn-ghost btn-xs btn-square rounded-md hover:bg-black/10" onClick={() => beginEdit(s)}>
                              <Pencil className="w-3.5 h-3.5 text-slate-600" />
                            </button>
                            <button className="btn btn-ghost btn-xs btn-square rounded-md hover:bg-black/10" onClick={() => deleteRow(s)}>
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn btn-primary btn-xs btn-square rounded-md bg-amber-500 hover:bg-amber-600 border-none text-white shadow-sm"
                              onClick={() => saveEdit(s)}
                              disabled={saving}
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button className="btn btn-ghost btn-xs btn-square rounded-md text-slate-400 hover:bg-black/5" onClick={cancelEdit}>
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    {!isEditing ? (
                      <h3 className={`font-black text-xl text-slate-800 mb-2 leading-tight ${s.content ? "" : "flex-1 flex items-center"}`}>
                        {s.title?.trim() ? s.title : <span className="opacity-40 italic">（未命名）</span>}
                      </h3>
                    ) : (
                      <input
                        className="input input-sm w-full font-black text-xl bg-transparent border-b border-amber-300 rounded-none px-0 focus:outline-none focus:border-amber-500 mb-2 placeholder:text-slate-300"
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        placeholder="標題"
                        autoFocus
                      />
                    )}

                    {/* Content */}
                    <div className="flex-1 min-h-[80px]">
                      {!isEditing ? (
                        <div className="text-sm text-slate-700 whitespace-pre-line leading-relaxed font-medium font-mono opacity-80">
                          {String(s.content || "").trim() ? s.content : (
                            <span className="text-slate-400 italic text-xs">（點擊編輯撰寫內容…）</span>
                          )}
                        </div>
                      ) : (
                        <textarea
                          className="textarea textarea-ghost w-full p-0 text-sm leading-relaxed focus:bg-transparent focus:outline-none resize-none h-full min-h-[120px]"
                          value={draftContent}
                          onChange={(e) => setDraftContent(e.target.value)}
                          placeholder="輸入內容..."
                        />
                      )}
                    </div>

                    {/* Footer Date */}
                    {!isEditing && (
                      <div className="mt-4 pt-2 border-t border-black/5 text-[10px] font-bold text-slate-400/80 text-right">
                        {fmtDate(s.updated_at)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ✅ Mobile FAB：新增便條 */}
      <button
        type="button"
        className="md:hidden fixed right-6 bottom-24 z-50 btn btn-circle btn-lg bg-amber-500 hover:bg-amber-600 border-none text-white shadow-xl shadow-amber-500/30"
        onClick={createNew}
        aria-label="新增便條"
      >
        <Plus className="w-6 h-6" />
      </button>

    </main>
  );
}