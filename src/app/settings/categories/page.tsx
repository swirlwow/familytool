"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WORKSPACE_ID } from "@/lib/appConfig";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// dnd-kit
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Icons
import { GripVertical, Tags, ArrowLeft, ArrowUpDown, Plus } from "lucide-react";

type Category = {
  id: string;
  name: string;
  type: "expense" | "income";
  group_name?: string | null;
  sort_order?: number;
  is_active?: boolean;
};

type CatGroup = {
  id: string;
  name: string;
  type: "expense" | "income";
  sort_order: number;
  is_active: boolean;
};

function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function normGroupName(s: any) {
  const t = String(s || "").trim();
  return t ? t : "（未分類）";
}

// --- Component: 大分類卡片 (Sortable) ---
function SortableGroupCard({
  group,
  onNameChange,
  onNameBlur,
  onToggleActive,
  onDelete,
}: {
  group: CatGroup;
  onNameChange: (v: string) => void;
  onNameBlur: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: group.id });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: "relative",
  };

  const inactive = group.is_active === false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "group relative flex items-center gap-2 rounded-xl border bg-white p-3 shadow-sm transition-all select-none",
        isDragging
          ? "border-violet-400 ring-2 ring-violet-400/20 shadow-xl scale-[1.02] z-50"
          : "border-slate-200 hover:border-violet-300 hover:shadow-md",
        inactive ? "bg-slate-50/80" : "",
      ].join(" ")}
    >
      {/* 拖曳手柄 */}
      <div
        {...attributes}
        {...listeners}
        className="flex h-8 w-6 cursor-grab items-center justify-center rounded hover:bg-slate-100 active:cursor-grabbing text-slate-400 hover:text-slate-600 touch-none"
        title="按住拖曳排序"
      >
        <GripVertical className="h-5 w-5" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 flex items-center gap-3">
          <Input
            className={[
              "h-10 border-transparent bg-transparent px-2 text-base font-medium shadow-none transition-all p-0 sm:p-2",
              "focus-visible:border-slate-300 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-violet-500/20 rounded-lg",
              inactive ? "text-slate-500 line-through decoration-slate-300" : "text-slate-900",
            ].join(" ")}
            value={group.name}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={onNameBlur}
            placeholder="大分類名稱"
            onPointerDown={(e) => e.stopPropagation()} 
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end border-t border-slate-100 sm:border-0 pt-2 sm:pt-0 mt-1 sm:mt-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-slate-300">
              #{n(group.sort_order)}
            </span>
            <Badge
              variant={inactive ? "outline" : "default"}
              className={[
                "pointer-events-none px-2 py-0.5 text-[10px] font-bold tracking-wide border-0 shadow-none",
                inactive
                  ? "bg-slate-100 text-slate-400"
                  : "bg-emerald-50 text-emerald-700",
              ].join(" ")}
            >
              {inactive ? "停用" : "啟用"}
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={[
                "h-8 px-3 text-xs font-medium rounded-lg",
                inactive
                  ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                  : "text-amber-600 hover:text-amber-700 hover:bg-amber-50",
              ].join(" ")}
              onClick={onToggleActive}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {inactive ? "啟用" : "停用"}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              onClick={onDelete}
              title="刪除"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <span className="text-lg leading-none">×</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Component: 小分類卡片 (Sortable) ---
function SortableCategoryCard({
  row,
  currentGroup,
  onNameChange,
  onNameBlur,
  onGroupChange,
  onGroupBlur,
  onToggleActive,
  onDelete,
}: {
  row: Category;
  currentGroup: string;
  onNameChange: (v: string) => void;
  onNameBlur: () => void;
  onGroupChange: (v: string) => void;
  onGroupBlur: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.id });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: "relative",
  };

  const inactive = row.is_active === false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "group relative flex items-center gap-2 rounded-xl border bg-white p-3 shadow-sm transition-all select-none",
        isDragging
          ? "border-violet-400 ring-2 ring-violet-400/20 shadow-xl scale-[1.02] z-50"
          : "border-slate-200 hover:border-violet-300 hover:shadow-md",
        inactive ? "bg-slate-50/80" : "",
      ].join(" ")}
    >
      {/* 拖曳手柄 */}
      <div
        {...attributes}
        {...listeners}
        className="flex h-8 w-6 cursor-grab items-center justify-center rounded hover:bg-slate-100 active:cursor-grabbing text-slate-400 hover:text-slate-600 touch-none"
        title="按住拖曳排序"
      >
        <GripVertical className="h-5 w-5" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="grid flex-1 grid-cols-1 gap-2 lg:grid-cols-2">
            <Input
              className={[
                "h-10 border-transparent bg-transparent px-2 text-base font-medium shadow-none transition-all p-0 sm:p-2",
                "focus-visible:border-slate-300 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-violet-500/20 rounded-lg",
                inactive ? "text-slate-500 line-through decoration-slate-300" : "text-slate-900",
              ].join(" ")}
              value={row.name}
              onChange={(e) => onNameChange(e.target.value)}
              onBlur={onNameBlur}
              placeholder="小分類名稱"
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />

            <Input
              className={[
                "h-10 border-transparent bg-transparent px-2 text-sm text-slate-600 shadow-none transition-all p-0 sm:p-2",
                "focus-visible:border-slate-300 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-violet-500/20 rounded-lg",
              ].join(" ")}
              value={currentGroup}
              onChange={(e) => onGroupChange(e.target.value)}
              onBlur={onGroupBlur}
              placeholder="所屬大分類"
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 lg:justify-end border-t border-slate-100 lg:border-0 pt-2 lg:pt-0 mt-1 lg:mt-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-slate-300">
              #{n(row.sort_order)}
            </span>
            <Badge
              variant={inactive ? "outline" : "default"}
              className={[
                "pointer-events-none px-2 py-0.5 text-[10px] font-bold tracking-wide border-0 shadow-none",
                inactive
                  ? "bg-slate-100 text-slate-400"
                  : "bg-emerald-50 text-emerald-700",
              ].join(" ")}
            >
              {inactive ? "停用" : "啟用"}
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={[
                "h-8 px-3 text-xs font-medium rounded-lg",
                inactive
                  ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                  : "text-amber-600 hover:text-amber-700 hover:bg-amber-50",
              ].join(" ")}
              onClick={onToggleActive}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {inactive ? "啟用" : "停用"}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              onClick={onDelete}
              title="刪除"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <span className="text-lg leading-none">×</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const router = useRouter();
  const [type, setType] = useState<"expense" | "income">("expense");

  // 小分類
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  // 大分類
  const [groups, setGroups] = useState<CatGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  // 新增輸入框狀態
  const [newGroup, setNewGroup] = useState(type === "income" ? "收入" : "");
  const [newName, setNewName] = useState("");
  const [newGroupName, setNewGroupName] = useState(type === "income" ? "收入" : "");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  async function loadCats(includeInactive = true) {
    if (!WORKSPACE_ID) return;
    setLoading(true);
    try {
      const url = `/api/categories?workspace_id=${WORKSPACE_ID}&type=${type}&include_inactive=${
        includeInactive ? "1" : "0"
      }`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      setRows(Array.isArray(json?.data) ? json.data : []);
    } finally {
      setLoading(false);
    }
  }

  async function loadGroups(includeInactive = true) {
    if (!WORKSPACE_ID) return;
    setGroupsLoading(true);
    try {
      const url = `/api/category-groups?workspace_id=${WORKSPACE_ID}&type=${type}&include_inactive=${
        includeInactive ? "1" : "0"
      }`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      setGroups(Array.isArray(json?.data) ? json.data : []);
    } finally {
      setGroupsLoading(false);
    }
  }

  useEffect(() => {
    setNewGroup(type === "income" ? "收入" : "");
    setNewGroupName(type === "income" ? "收入" : "");
    loadCats(true);
    loadGroups(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // --- Groups ---------------------------------------------------------

  const groupsOrdered = useMemo(() => {
    return groups
      .slice()
      .sort((a, b) => n(a.sort_order) - n(b.sort_order) || a.name.localeCompare(b.name, "zh-Hant"));
  }, [groups]);

  async function patchGroup(id: string, patchBody: any) {
    if (!WORKSPACE_ID) return;
    const res = await fetch("/api/category-groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: WORKSPACE_ID, id, ...patchBody }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) alert(json?.error || "更新大分類失敗");
  }

  async function addGroup() {
    if (!WORKSPACE_ID) return alert("未設定 WORKSPACE_ID");
    const nm = newGroupName.trim();
    if (!nm) return alert("請輸入大分類名稱");

    const maxSort = groupsOrdered.reduce((m, g) => Math.max(m, n(g.sort_order)), 0);

    const res = await fetch("/api/category-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: WORKSPACE_ID,
        type,
        name: nm,
        sort_order: maxSort + 10,
        is_active: true,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) return alert(json?.error || "新增大分類失敗");

    setNewGroupName(type === "income" ? "收入" : "");
    await loadGroups(true);
    await loadCats(true);
  }

  async function deleteGroup(id: string, name: string) {
    if (!WORKSPACE_ID) return;
    if (!confirm(`確定刪除大分類「${name}」？\n（若尚有小分類仍掛在此分類，可能會失敗）`)) return;

    const res = await fetch("/api/category-groups", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: WORKSPACE_ID, id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return alert(json?.error || "刪除大分類失敗");

    await loadGroups(true);
    await loadCats(true);
  }

  async function fixGroupSort() {
    if (!WORKSPACE_ID) return;
    setGroupsLoading(true);
    try {
      const base = groupsOrdered;
      for (let i = 0; i < base.length; i++) {
        const desired = (i + 1) * 10;
        if (n(base[i].sort_order) !== desired) {
          await patchGroup(base[i].id, { sort_order: desired });
        }
      }
      await loadGroups(true);
      await loadCats(true);
    } finally {
      setGroupsLoading(false);
    }
  }

  async function handleDragEndForBigGroup(e: DragEndEvent) {
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || activeId === overId) return;

    const ids = groupsOrdered.map((g) => g.id);
    const oldIndex = ids.indexOf(activeId);
    const newIndex = ids.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(groupsOrdered, oldIndex, newIndex).map((g, i) => ({
      ...g,
      sort_order: (i + 1) * 10,
    }));

    setGroups((prev) => prev.map((x) => next.find((k) => k.id === x.id) || x));

    for (const g of next) {
      await patchGroup(g.id, { sort_order: g.sort_order });
    }

    await loadGroups(true);
    await loadCats(true);
  }

  // --- Categories -----------------------------------------------------

  async function patchCategory(id: string, patchBody: any) {
    if (!WORKSPACE_ID) return;
    const res = await fetch("/api/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: WORKSPACE_ID, id, ...patchBody }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) alert(json?.error || "更新小分類失敗");
  }

  async function addCategory() {
    if (!WORKSPACE_ID) return alert("未設定 WORKSPACE_ID");
    const g = newGroup.trim();
    const nm = newName.trim();
    if (!g) return alert("請輸入大分類");
    if (!nm) return alert("請輸入小分類名稱");

    const sameGroup = rows.filter((r) => normGroupName(r.group_name) === normGroupName(g));
    const maxSort = sameGroup.reduce((m, r) => Math.max(m, n(r.sort_order)), 0);

    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: WORKSPACE_ID,
        type,
        group_name: g,
        name: nm,
        sort_order: maxSort + 10,
        is_active: true,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) return alert(json?.error || "新增小分類失敗");

    setNewName("");
    await loadCats(true);
  }

  async function deleteCategory(id: string, name: string) {
    if (!WORKSPACE_ID) return;
    if (!confirm(`確定刪除小分類「${name}」？`)) return;

    const res = await fetch("/api/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: WORKSPACE_ID, id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return alert(json?.error || "刪除小分類失敗");

    await loadCats(true);
  }

  async function fixCategorySortAll() {
    if (!WORKSPACE_ID) return;
    setLoading(true);
    try {
      // 依「大分類排序」逐組修復小分類 sort_order
      for (const g of groupsOrdered) {
        const gname = g.name;
        const list = rows
          .filter((r) => normGroupName(r.group_name) === normGroupName(gname))
          .slice()
          .sort((a, b) => n(a.sort_order) - n(b.sort_order) || a.name.localeCompare(b.name, "zh-Hant"));

        for (let i = 0; i < list.length; i++) {
          const desired = (i + 1) * 10;
          if (n(list[i].sort_order) !== desired) {
            await patchCategory(list[i].id, { sort_order: desired });
          }
        }
      }

      // 其他未出現在 group 表的 group_name
      const known = new Set(groupsOrdered.map((g) => normGroupName(g.name)));
      const extraGroupNames = Array.from(
        new Set(rows.map((r) => normGroupName(r.group_name)).filter((x) => !known.has(x)))
      ).sort((a, b) => a.localeCompare(b, "zh-Hant"));

      for (const gname of extraGroupNames) {
        const list = rows
          .filter((r) => normGroupName(r.group_name) === gname)
          .slice()
          .sort((a, b) => n(a.sort_order) - n(b.sort_order) || a.name.localeCompare(b.name, "zh-Hant"));
        for (let i = 0; i < list.length; i++) {
          const desired = (i + 1) * 10;
          if (n(list[i].sort_order) !== desired) {
            await patchCategory(list[i].id, { sort_order: desired });
          }
        }
      }

      await loadCats(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleDragEndForGroup(e: DragEndEvent, groupName: string) {
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || activeId === overId) return;

    const list = rows
      .filter((r) => normGroupName(r.group_name) === groupName)
      .slice()
      .sort((a, b) => n(a.sort_order) - n(b.sort_order) || a.name.localeCompare(b.name, "zh-Hant"));

    const ids = list.map((x) => x.id);
    const oldIndex = ids.indexOf(activeId);
    const newIndex = ids.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(list, oldIndex, newIndex).map((r, i) => ({
      ...r,
      sort_order: (i + 1) * 10,
    }));

    setRows((prev) => prev.map((x) => next.find((k) => k.id === x.id) || x));

    for (const r of next) {
      await patchCategory(r.id, { sort_order: r.sort_order });
    }

    await loadCats(true);
  }

  // --- Derived: rowsByGroup ------------------------------------------

  const rowsByGroup = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const g of groupsOrdered) map.set(g.name, []);

    for (const r of rows) {
      const gname = normGroupName(r.group_name);
      if (!map.has(gname)) map.set(gname, []);
      map.get(gname)!.push(r);
    }

    const out: Array<[string, Category[]]> = [];
    for (const [gname, list] of map.entries()) {
      list.sort((a, b) => n(a.sort_order) - n(b.sort_order) || a.name.localeCompare(b.name, "zh-Hant"));
      out.push([gname, list]);
    }

    const orderedNames = new Set(groupsOrdered.map((g) => g.name));
    const first: Array<[string, Category[]]> = [];
    const rest: Array<[string, Category[]]> = [];
    for (const it of out) (orderedNames.has(it[0]) ? first : rest).push(it);
    rest.sort((a, b) => a[0].localeCompare(b[0], "zh-Hant"));
    return [...first, ...rest];
  }, [rows, groupsOrdered]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        
        {/* ✅ Header：黏住頂部 + 縮小 - Violet Theme */}
        <div className="card bg-white/90 backdrop-blur-md shadow-sm border border-slate-200 rounded-2xl sticky top-0 z-40">
          <div className="card-body p-3 flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-violet-50 text-violet-600 p-2 rounded-lg border border-violet-100">
                <Tags className="w-5 h-5" />
              </div>

              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-slate-800">分類管理</h1>
                <div className="badge badge-sm bg-violet-100 text-violet-700 border-none font-bold hidden sm:inline-flex">
                  Settings
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
                    className="btn btn-outline btn-sm h-9 min-h-0 rounded-xl font-bold border-slate-300 hover:bg-slate-100 hover:text-slate-700 gap-2"
                    onClick={() => router.push("/ledger")}
                >
                    <ArrowLeft className="w-4 h-4" /> 記帳本
                </button>
            </div>
          </div>

          <div className="px-4 pb-3 -mt-1">
            <p className="text-[11px] font-medium text-slate-400">
                管理您的收支分類，拖曳左側手柄可調整順序。大分類改名會同步更新關聯的小分類。
            </p>
          </div>

          {!WORKSPACE_ID && (
            <div className="px-4 pb-3">
              <div className="alert alert-warning rounded-2xl py-3 text-sm">
                <span>⚠️ 缺少 WORKSPACE_ID 設定（請檢查 .env.local）</span>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={type} onValueChange={(v) => setType(v as any)}>
          <div className="flex items-center justify-between mb-6 gap-4">
            <TabsList className="rounded-full bg-white border border-slate-200 p-1 shadow-sm h-11">
              <TabsTrigger
                value="expense"
                className="rounded-full px-6 h-9 data-[state=active]:bg-violet-600 data-[state=active]:text-white font-bold"
              >
                支出
              </TabsTrigger>
              <TabsTrigger
                value="income"
                className="rounded-full px-6 h-9 data-[state=active]:bg-violet-600 data-[state=active]:text-white font-bold"
              >
                收入
              </TabsTrigger>
            </TabsList>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-slate-500 hover:text-violet-600 rounded-xl"
                onClick={() => {
                  loadGroups(true);
                  loadCats(true);
                }}
              >
                重新整理
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex h-9 rounded-xl border-slate-200 text-slate-500 hover:bg-slate-50 gap-2"
                onClick={async () => {
                  await fixGroupSort();
                  await fixCategorySortAll();
                }}
                disabled={groupsOrdered.length === 0 && rows.length === 0}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                一鍵修復排序
              </Button>
            </div>
          </div>

          <TabsContent value={type} className="mt-0 space-y-8">
            {/* Block 1: 大分類管理 */}
            <Card className="overflow-hidden border-none shadow-none sm:border sm:bg-white sm:shadow-sm sm:rounded-3xl">
              <CardHeader className="border-b border-slate-100 bg-white/50 px-6 py-4 backdrop-blur-sm rounded-t-3xl">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold text-slate-800">大分類管理</CardTitle>
                </div>
              </CardHeader>

              <CardContent className="min-h-[100px] p-4 sm:p-6 bg-slate-50/50 sm:bg-white rounded-b-3xl">
                <div className="mb-4 flex flex-col sm:flex-row gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2 sm:p-3">
                  <Input
                    className="h-10 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 placeholder:text-slate-400 font-medium"
                    placeholder={type === "income" ? "例如：收入" : "例如：飲食 / 交通 / 固定支出"}
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                  />
                  <Button
                    onClick={addGroup}
                    className="h-10 w-full sm:w-auto rounded-lg bg-violet-600 px-6 font-bold text-white hover:bg-violet-700 shadow-md shadow-violet-200/50"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    新增
                  </Button>
                </div>

                {groupsLoading && (
                  <div className="text-center py-4 text-sm text-slate-500">讀取中…</div>
                )}

                {!groupsLoading && groupsOrdered.length === 0 && (
                  <div className="text-center py-8 text-sm text-slate-400">
                    目前沒有大分類資料
                  </div>
                )}

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEndForBigGroup}
                >
                  <SortableContext
                    items={groupsOrdered.map((g) => g.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {groupsOrdered.map((g) => (
                        <SortableGroupCard
                          key={g.id}
                          group={g}
                          onNameChange={(v) => {
                            setGroups((prev) =>
                              prev.map((x) => (x.id === g.id ? { ...x, name: v } : x))
                            );
                          }}
                          onNameBlur={() => patchGroup(g.id, { name: g.name })}
                          onToggleActive={async () => {
                            await patchGroup(g.id, { is_active: g.is_active === false });
                            await loadGroups(true);
                            await loadCats(true);
                          }}
                          onDelete={() => deleteGroup(g.id, g.name)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>

            {/* Block 2: 小分類清單 */}
            <Card className="overflow-hidden border-none shadow-none sm:border sm:bg-white sm:shadow-sm sm:rounded-3xl">
              <CardHeader className="border-b border-slate-100 bg-white/50 px-6 py-4 backdrop-blur-sm rounded-t-3xl">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold text-slate-800">小分類清單</CardTitle>
                  <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-500 font-mono">
                    {loading ? "Loading..." : `${rows.length}`}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="min-h-[300px] p-4 sm:p-6 bg-slate-50/50 sm:bg-white rounded-b-3xl">
                {/* Create Category */}
                <div className="mb-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      className="h-10 flex-1 border-slate-200 bg-white shadow-sm rounded-xl focus:border-violet-500"
                      placeholder="大分類（例如：飲食）"
                      value={newGroup}
                      onChange={(e) => setNewGroup(e.target.value)}
                    />
                    <Input
                      className="h-10 flex-1 border-slate-200 bg-white shadow-sm rounded-xl focus:border-violet-500"
                      placeholder="小分類（例如：早餐）"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                    <Button
                      onClick={addCategory}
                      className="h-10 w-full sm:w-auto rounded-xl bg-sky-500 px-6 font-bold text-white hover:bg-sky-600 shadow-md shadow-sky-200/50"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      新增
                    </Button>
                  </div>
                </div>

                {/* Lists */}
                <div className="space-y-6">
                  {rows.length === 0 ? (
                    <div className="py-14 text-center text-slate-400 font-semibold opacity-50">
                      目前沒有小分類資料。
                    </div>
                  ) : (
                    rowsByGroup.map(([gname, list]) => {
                      const normalizedGroup = normGroupName(gname);
                      const orderedList = list
                        .slice()
                        .sort(
                          (a, b) =>
                            n(a.sort_order) - n(b.sort_order) ||
                            a.name.localeCompare(b.name, "zh-Hant")
                        );

                      return (
                        <div key={gname} className="relative">
                          <div className="mb-3 flex items-center gap-2 pl-1">
                            <div className="h-2 w-2 rounded-full bg-violet-400" />
                            <h3 className="text-sm font-bold text-slate-700">{gname}</h3>
                            <span className="text-xs text-slate-400 font-mono">({orderedList.length})</span>
                          </div>

                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={(e) => handleDragEndForGroup(e, normalizedGroup)}
                          >
                            <SortableContext
                              items={orderedList.map((x) => x.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="space-y-2">
                                {orderedList.map((r) => {
                                  const currentGroup = normGroupName(r.group_name || gname);

                                  return (
                                    <SortableCategoryCard
                                      key={r.id}
                                      row={r}
                                      currentGroup={currentGroup}
                                      onNameChange={(v) => {
                                        setRows((prev) =>
                                          prev.map((x) => (x.id === r.id ? { ...x, name: v } : x))
                                        );
                                      }}
                                      onNameBlur={() => patchCategory(r.id, { name: r.name })}
                                      onGroupChange={(v) => {
                                        setRows((prev) =>
                                          prev.map((x) => (x.id === r.id ? { ...x, group_name: v } : x))
                                        );
                                      }}
                                      onGroupBlur={() => patchCategory(r.id, { group_name: currentGroup })}
                                      onToggleActive={async () => {
                                        await patchCategory(r.id, { is_active: r.is_active === false });
                                        await loadCats(true);
                                      }}
                                      onDelete={() => deleteCategory(r.id, r.name)}
                                    />
                                  );
                                })}
                              </div>
                            </SortableContext>
                          </DndContext>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-8 text-center text-xs text-slate-400">
                  💡 提示：按住卡片左側圖示即可上下拖曳排序
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}