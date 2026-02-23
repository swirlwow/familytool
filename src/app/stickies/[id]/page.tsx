// src/app/stickies/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Save, Trash2, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// dnd-kit
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const WORKSPACE_ID = process.env.NEXT_PUBLIC_WORKSPACE_ID || "";

type StickyRow = {
  id: string;
  owner: string;
  title: string;
  content: string;
  updated_at: string;
};

type ItemRow = {
  id: string;
  sticky_id: string;
  text: string;
  is_done: boolean;
  sort: number;
};

const OWNERS = ["家庭", "雅惠", "昱元", "子逸", "英茵"] as const;

const OWNER_STYLE: Record<string, { chip: string; dot: string; ring: string }> = {
  家庭: { chip: "bg-slate-100 text-slate-700", dot: "bg-slate-400", ring: "ring-slate-200" },
  雅惠: { chip: "bg-rose-100 text-rose-700", dot: "bg-rose-500", ring: "ring-rose-200" },
  昱元: { chip: "bg-blue-100 text-blue-700", dot: "bg-blue-500", ring: "ring-blue-200" },
  子逸: { chip: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", ring: "ring-emerald-200" },
  英茵: { chip: "bg-amber-100 text-amber-800", dot: "bg-amber-500", ring: "ring-amber-200" },
};

function SortableItemRow({
  item,
  onToggle,
  onEditText,
  onDelete,
}: {
  item: ItemRow;
  onToggle: (id: string, is_done: boolean) => void;
  onEditText: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2",
        item.is_done ? "opacity-70" : "",
      ].join(" ")}
    >
      <button className="btn btn-ghost btn-xs" {...attributes} {...listeners} title="拖曳排序">
        <GripVertical className="w-4 h-4 text-slate-400" />
      </button>

      <input
        type="checkbox"
        className="checkbox checkbox-sm"
        checked={!!item.is_done}
        onChange={(e) => onToggle(item.id, e.target.checked)}
      />

      <input
        className={[
          "flex-1 bg-transparent outline-none text-sm",
          item.is_done ? "line-through text-slate-400" : "text-slate-700",
        ].join(" ")}
        value={item.text}
        onChange={(e) => onEditText(item.id, e.target.value)}
        placeholder="項目內容"
      />

      <button className="btn btn-ghost btn-xs" onClick={() => onDelete(item.id)} title="刪除">
        <Trash2 className="w-4 h-4 text-rose-500" />
      </button>
    </div>
  );
}

export default function StickyDetailPage() {
  const router = useRouter();
  const params = useParams<any>();
  const { toast } = useToast();

  // ✅ 兼容：params.id 可能是 string 或 string[]
  const raw = params?.id;
  const id = Array.isArray(raw) ? String(raw[0] || "") : String(raw || "");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [sticky, setSticky] = useState<StickyRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [newText, setNewText] = useState("");

  const ownerStyle = useMemo(() => OWNER_STYLE[sticky?.owner || "家庭"] || OWNER_STYLE["家庭"], [sticky?.owner]);

  async function load() {
    if (!WORKSPACE_ID) return;
    if (!id) return;

    setLoading(true);
    try {
      // 1) sticky 本體（要 workspace_id）
      const res1 = await fetch(`/api/stickies/${encodeURIComponent(id)}?workspace_id=${WORKSPACE_ID}`, {
        cache: "no-store",
      });
      const j1 = await res1.json().catch(() => ({}));
      if (!res1.ok) throw new Error(j1.error || "讀取便條紙失敗");
      setSticky(j1.data ?? null);

      // 2) items（✅同樣要 workspace_id）
      const res2 = await fetch(`/api/stickies/${encodeURIComponent(id)}/items?workspace_id=${WORKSPACE_ID}`, {
        cache: "no-store",
      });
      const j2 = await res2.json().catch(() => ({}));
      if (!res2.ok) throw new Error(j2.error || "讀取清單失敗");

      setItems(Array.isArray(j2.data) ? j2.data : []);
    } catch (e: any) {
      toast({ variant: "destructive", title: "讀取失敗", description: e.message });
      setSticky(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function saveSticky() {
    if (!WORKSPACE_ID || !id || !sticky) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/stickies/${encodeURIComponent(id)}?workspace_id=${WORKSPACE_ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: WORKSPACE_ID,
          owner: sticky.owner,
          title: sticky.title,
          content: sticky.content, // ✅ 文章內文
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

  async function deleteSticky() {
    if (!WORKSPACE_ID || !id) return;
    if (!confirm("確定刪除這張便條紙？（會一併刪除清單項目）")) return;

    try {
      const res = await fetch(`/api/stickies/${encodeURIComponent(id)}?workspace_id=${WORKSPACE_ID}`, {
        method: "DELETE",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "刪除失敗");

      toast({ title: "已刪除" });
      router.push("/stickies");
    } catch (e: any) {
      toast({ variant: "destructive", title: "刪除失敗", description: e.message });
    }
  }

  async function addItem(text: string) {
    const t = text.trim();
    if (!t) return;

    try {
      const res = await fetch(`/api/stickies/${encodeURIComponent(id)}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: WORKSPACE_ID, text: t }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "新增項目失敗");

      setNewText("");
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "新增失敗", description: e.message });
    }
  }

  async function toggleItem(itemId: string, is_done: boolean) {
    try {
      const res = await fetch(`/api/sticky-items/${encodeURIComponent(itemId)}?workspace_id=${WORKSPACE_ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: WORKSPACE_ID, is_done }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "更新失敗");

      setItems((prev) => prev.map((x) => (x.id === itemId ? { ...x, is_done } : x)));
    } catch (e: any) {
      toast({ variant: "destructive", title: "更新失敗", description: e.message });
    }
  }

  function editItemText(itemId: string, text: string) {
    setItems((prev) => prev.map((x) => (x.id === itemId ? { ...x, text } : x)));
  }

  async function persistItemText(itemId: string) {
    const it = items.find((x) => x.id === itemId);
    if (!it) return;

    try {
      const res = await fetch(`/api/sticky-items/${encodeURIComponent(itemId)}?workspace_id=${WORKSPACE_ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: WORKSPACE_ID, text: it.text }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "儲存項目失敗");
    } catch (e: any) {
      toast({ variant: "destructive", title: "儲存失敗", description: e.message });
    }
  }

  async function deleteItem(itemId: string) {
    if (!confirm("刪除此項目？")) return;

    try {
      const res = await fetch(`/api/sticky-items/${encodeURIComponent(itemId)}?workspace_id=${WORKSPACE_ID}`, {
        method: "DELETE",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "刪除項目失敗");

      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "刪除失敗", description: e.message });
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    setItems((prev) => {
      const oldIdx = prev.findIndex((x) => x.id === active.id);
      const newIdx = prev.findIndex((x) => x.id === over.id);
      const next = arrayMove(prev, oldIdx, newIdx);

      // ✅ 存 sort（要 workspace_id）
      fetch(`/api/stickies/${encodeURIComponent(id)}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: WORKSPACE_ID, orderedIds: next.map((x) => x.id) }),
      }).catch(() => {});

      return next;
    });
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // id 還沒出來 → 只顯示載入中，不吐「缺少ID」
  if (!id) {
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
            <div className="flex items-center gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => router.push("/stickies")}>
                <ArrowLeft className="w-4 h-4" /> 返回
              </button>
              <div className="font-black text-slate-800">便條紙清單</div>
            </div>

            <div className="flex gap-2">
              <button className="btn btn-outline btn-sm rounded-xl" onClick={deleteSticky} disabled={saving || loading}>
                <Trash2 className="w-4 h-4 text-rose-500" /> 刪除
              </button>
              <button className="btn btn-primary btn-sm rounded-xl" onClick={saveSticky} disabled={saving || loading}>
                <Save className="w-4 h-4" /> {saving ? "儲存中…" : "儲存"}
              </button>
            </div>
          </div>
        </div>

        {loading && <div className="text-center text-slate-400 py-10">載入中…</div>}

        {!loading && !sticky && <div className="text-center text-slate-400 py-16">找不到這張便條紙（可能已刪除）</div>}

        {!loading && sticky && (
          <div className="card bg-white shadow-sm border border-slate-200 rounded-3xl">
            <div className="card-body p-6 space-y-4">
              {/* owner 按鈕 */}
              <div className="flex flex-wrap gap-2">
                {OWNERS.map((o) => {
                  const active = sticky.owner === o;
                  const st = OWNER_STYLE[o];
                  return (
                    <button
                      key={o}
                      className={[
                        "px-3 py-1.5 rounded-full text-sm font-bold ring-1 transition",
                        active ? `${st.chip} ${st.ring}` : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                      ].join(" ")}
                      onClick={() => setSticky({ ...sticky, owner: o })}
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

              {/* 標題 */}
              <input
                className="input input-bordered w-full rounded-2xl text-lg font-black"
                value={sticky.title ?? ""}
                onChange={(e) => setSticky({ ...sticky, title: e.target.value })}
                placeholder="清單標題（例如：待辦 / 行李清單 / 重要備忘）"
              />

              {/* ✅ 文章內文 content */}
              <div className="space-y-1">
                <div className="text-xs text-slate-400">內文（備註 / 說明）</div>
                <textarea
                  className="textarea textarea-bordered w-full rounded-2xl min-h-[140px] whitespace-pre-line"
                  value={sticky.content ?? ""}
                  onChange={(e) => setSticky({ ...sticky, content: e.target.value })}
                  placeholder="例如：這張清單的用途、注意事項、連結、備忘…"
                />
              </div>

              {/* 快速新增 */}
              <div className="flex flex-col md:flex-row gap-2">
                <div className="flex-1 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <Plus className="w-4 h-4 text-slate-400" />
                  <input
                    className="bg-transparent outline-none w-full text-sm"
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addItem(newText);
                    }}
                    placeholder="快速新增項目（Enter）"
                  />
                </div>

                <button className="btn btn-outline rounded-2xl" onClick={() => addItem(newText)}>
                  新增
                </button>

                <span
                  className={[
                    "px-3 py-2 rounded-2xl text-xs font-black inline-flex items-center gap-2",
                    ownerStyle.chip,
                  ].join(" ")}
                >
                  <span className={["w-2 h-2 rounded-full", ownerStyle.dot].join(" ")} />
                  {sticky.owner}
                </span>
              </div>

              {/* 清單 */}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={items.map((x) => x.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {items.map((it) => (
                      <div
                        key={it.id}
                        onBlur={() => persistItemText(it.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLElement).blur();
                        }}
                      >
                        <SortableItemRow item={it} onToggle={toggleItem} onEditText={editItemText} onDelete={deleteItem} />
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {items.length === 0 && <div className="text-center text-slate-400 py-10">目前沒有項目，先輸入一個項目按 Enter 🙂</div>}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
