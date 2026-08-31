"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WORKSPACE_ID } from "@/lib/appConfig";
import { LedgerSettingsNav } from "@/components/settings/LedgerSettingsNav";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/client/feedback";

// dnd-kit
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
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

function n(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function normGroupName(s: unknown) {
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
    useSortable({
      id: group.id,
      transition: {
        duration: 140,
        easing: "cubic-bezier(0.2, 0, 0, 1)",
      },
    });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? undefined : transition,
    zIndex: isDragging ? 50 : undefined,
    position: "relative",
    willChange: isDragging ? "transform" : undefined,
  };

  const inactive = group.is_active === false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "settings-compact-row group relative flex items-center gap-2 rounded-xl border bg-white p-2.5 shadow-sm transition-colors duration-150 select-none",
        isDragging
          ? "border-violet-400 bg-violet-50/70 shadow-md opacity-95 z-50"
          : "border-slate-200 hover:border-violet-300",
        inactive ? "bg-slate-50/80" : "",
      ].join(" ")}
    >
      {/* 拖曳手柄 */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex h-9 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-violet-50 hover:text-violet-600 active:cursor-grabbing touch-none"
        title="按住拖曳排序"
        aria-label={`調整大分類「${group.name}」順序`}
      >
        <GripVertical className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="settings-row-content flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
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

        <div className="settings-row-actions flex items-center justify-between gap-3 sm:justify-end border-t border-slate-100 sm:border-0 pt-2 sm:pt-0 mt-1 sm:mt-0">
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
              aria-label={`刪除大分類「${group.name}」`}
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
  onNameChange,
  onNameBlur,
  onToggleActive,
  onDelete,
}: {
  row: Category;
  onNameChange: (v: string) => void;
  onNameBlur: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: row.id,
      transition: {
        duration: 140,
        easing: "cubic-bezier(0.2, 0, 0, 1)",
      },
    });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? undefined : transition,
    zIndex: isDragging ? 50 : undefined,
    position: "relative",
    willChange: isDragging ? "transform" : undefined,
  };

  const inactive = row.is_active === false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "settings-compact-row group relative flex items-center gap-2 rounded-xl border bg-white p-2.5 shadow-sm transition-colors duration-150 select-none",
        isDragging
          ? "border-violet-400 bg-violet-50/70 shadow-md opacity-95 z-50"
          : "border-slate-200 hover:border-violet-300",
        inactive ? "bg-slate-50/80" : "",
      ].join(" ")}
    >
      {/* 拖曳手柄 */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex h-9 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-violet-50 hover:text-violet-600 active:cursor-grabbing touch-none"
        title="按住拖曳排序"
        aria-label={`調整小分類「${row.name}」順序`}
      >
        <GripVertical className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="settings-row-content flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="grid flex-1 grid-cols-1 gap-2">
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
          </div>
        </div>

        <div className="settings-row-actions flex items-center justify-between gap-3 lg:justify-end border-t border-slate-100 lg:border-0 pt-2 lg:pt-0 mt-1 lg:mt-0">
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
              aria-label={`刪除小分類「${row.name}」`}
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
  const [newGroup, setNewGroup] = useState("");
  const [newName, setNewName] = useState("");
  const [newGroupName, setNewGroupName] = useState(type === "income" ? "收入" : "");
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: "group"; id: string; name: string }
    | { kind: "category"; id: string; name: string }
    | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadCats = useCallback(async (includeInactive = true) => {
    if (!WORKSPACE_ID) return;
    setLoading(true);
    try {
      const url = `/api/categories?workspace_id=${WORKSPACE_ID}&type=${type}&include_inactive=${
        includeInactive ? "1" : "0"
      }`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(json, "小分類讀取失敗"));
      setRows(Array.isArray(json?.data) ? json.data : []);
    } catch (error: unknown) {
      toast({ variant: "destructive", title: "小分類讀取失敗", description: getErrorMessage(error, "請稍後再試") });
    } finally {
      setLoading(false);
    }
  }, [type]);

  const loadGroups = useCallback(async (includeInactive = true) => {
    if (!WORKSPACE_ID) return;
    setGroupsLoading(true);
    try {
      const url = `/api/category-groups?workspace_id=${WORKSPACE_ID}&type=${type}&include_inactive=${
        includeInactive ? "1" : "0"
      }`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(json, "大分類讀取失敗"));
      setGroups(Array.isArray(json?.data) ? json.data : []);
    } catch (error: unknown) {
      toast({ variant: "destructive", title: "大分類讀取失敗", description: getErrorMessage(error, "請稍後再試") });
    } finally {
      setGroupsLoading(false);
    }
  }, [type]);

  useEffect(() => {
    setNewGroup("");
    setNewGroupName(type === "income" ? "收入" : "");
    void Promise.all([loadCats(true), loadGroups(true)]);
  }, [loadCats, loadGroups, type]);

  // --- Groups ---------------------------------------------------------

  const groupsOrdered = useMemo(() => {
    return groups
      .slice()
      .sort((a, b) => n(a.sort_order) - n(b.sort_order) || a.name.localeCompare(b.name, "zh-Hant"));
  }, [groups]);

  async function patchGroup(
    id: string,
    patchBody: Partial<Pick<CatGroup, "name" | "sort_order" | "is_active">>
  ) {
    if (!WORKSPACE_ID) return;
    const res = await fetch("/api/category-groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: WORKSPACE_ID, id, ...patchBody }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ variant: "destructive", title: "大分類更新失敗", description: getErrorMessage(json, "請稍後再試") });
    }
  }

  async function addGroup() {
    if (!WORKSPACE_ID) {
      toast({ variant: "destructive", title: "無法新增", description: "尚未設定工作區" });
      return;
    }
    const nm = newGroupName.trim();
    if (!nm) {
      toast({ variant: "destructive", title: "請輸入大分類名稱" });
      return;
    }

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
    if (!res.ok) {
      toast({ variant: "destructive", title: "大分類新增失敗", description: getErrorMessage(json, "請稍後再試") });
      return;
    }

    setNewGroupName(type === "income" ? "收入" : "");
    await loadGroups(true);
    await loadCats(true);
    toast({ title: "已新增大分類", description: nm });
  }

  async function removeGroup(id: string, name: string) {
    const res = await fetch("/api/category-groups", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: WORKSPACE_ID, id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(getErrorMessage(json, "可能仍有小分類使用此大分類"));

    await loadGroups(true);
    await loadCats(true);
    toast({ title: "已刪除大分類", description: name });
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

    const changedGroups = next.filter(
      (group) => n(groups.find((current) => current.id === group.id)?.sort_order) !== n(group.sort_order)
    );

    await Promise.all(
      changedGroups.map((group) => patchGroup(group.id, { sort_order: group.sort_order }))
    );

    await loadGroups(true);
    await loadCats(true);
  }

  // --- Categories -----------------------------------------------------

  async function patchCategory(
    id: string,
    patchBody: Partial<Pick<Category, "name" | "group_name" | "sort_order" | "is_active">>
  ) {
    if (!WORKSPACE_ID) return;
    const res = await fetch("/api/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: WORKSPACE_ID, id, ...patchBody }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ variant: "destructive", title: "小分類更新失敗", description: getErrorMessage(json, "請稍後再試") });
    }
  }

  async function addCategory() {
    if (!WORKSPACE_ID) {
      toast({ variant: "destructive", title: "無法新增", description: "尚未設定工作區" });
      return;
    }
    const g = newGroup.trim();
    const nm = newName.trim();
    if (!g) {
      toast({ variant: "destructive", title: "請先選擇大分類" });
      return;
    }
    if (!nm) {
      toast({ variant: "destructive", title: "請輸入小分類名稱" });
      return;
    }

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
    if (!res.ok) {
      toast({ variant: "destructive", title: "小分類新增失敗", description: getErrorMessage(json, "請稍後再試") });
      return;
    }

    setNewName("");
    await loadCats(true);
    toast({ title: "已新增小分類", description: `${g}／${nm}` });
  }

  async function removeCategory(id: string, name: string) {
    const res = await fetch("/api/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: WORKSPACE_ID, id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(getErrorMessage(json, "可能仍有帳務資料使用此小分類"));

    await loadCats(true);
    toast({ title: "已刪除小分類", description: name });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeleting(true);
    try {
      if (target.kind === "group") await removeGroup(target.id, target.name);
      else await removeCategory(target.id, target.name);
      setPendingDelete(null);
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: target.kind === "group" ? "大分類刪除失敗" : "小分類刪除失敗",
        description: getErrorMessage(error, "請稍後再試"),
      });
    } finally {
      setDeleting(false);
    }
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

    const changedRows = next.filter(
      (row) => n(rows.find((current) => current.id === row.id)?.sort_order) !== n(row.sort_order)
    );

    await Promise.all(
      changedRows.map((row) => patchCategory(row.id, { sort_order: row.sort_order }))
    );

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
    <main className="app-page">
      <div className="app-page-inner max-w-6xl">
        
        {/* ✅ Header：黏住頂部 + 縮小 - Violet Theme */}
        <div className="app-header">
          <div className="flex w-full flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-violet-50 text-violet-600 p-2 rounded-lg border border-violet-100">
                <Tags className="w-5 h-5" />
              </div>

              <h1 className="text-lg font-black text-slate-800">記帳設定</h1>
            </div>

            <div className="flex gap-2">
                <button
                    className="btn btn-ghost btn-sm hidden h-9 min-h-0 rounded-lg font-bold text-slate-500 hover:bg-slate-100 sm:inline-flex"
                    onClick={() => router.push("/")}
                >
                    回首頁
                </button>
                <button
                    className="btn btn-outline btn-sm h-9 min-h-0 rounded-lg border-slate-300 font-bold hover:bg-slate-100 hover:text-slate-700"
                    onClick={() => router.push("/ledger")}
                >
                    <ArrowLeft className="w-4 h-4" /> 記帳本
                </button>
            </div>
          </div>
          {!WORKSPACE_ID && (
            <div className="px-4 pb-3">
              <div className="alert alert-warning rounded-2xl py-3 text-sm">
                <span>⚠️ 缺少 WORKSPACE_ID 設定（請檢查 .env.local）</span>
              </div>
            </div>
          )}
        </div>

        <LedgerSettingsNav active="categories" />
        {/* Tabs */}
        <Tabs
          value={type}
          onValueChange={(value) => {
            if (value === "expense" || value === "income") setType(value);
          }}
        >
          <div className="mb-4 flex items-center justify-between gap-4">
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

          <TabsContent value={type} className="mt-0 space-y-5">
            {/* Block 1: 大分類管理 */}
            <Card className="overflow-hidden border-none shadow-none sm:border sm:bg-white sm:shadow-sm sm:rounded-3xl">
              <CardHeader className="rounded-t-3xl border-b border-slate-100 bg-white/50 px-4 py-3 backdrop-blur-sm sm:px-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold text-slate-800">大分類管理</CardTitle>
                </div>
              </CardHeader>

              <CardContent className="min-h-[100px] rounded-b-3xl bg-slate-50/50 p-3 sm:bg-white sm:p-4">
                <div className="settings-inline-add mb-3 flex flex-col gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2 sm:flex-row sm:p-3">
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
                    strategy={rectSortingStrategy}
                  >
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
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
                          onDelete={() => setPendingDelete({ kind: "group", id: g.id, name: g.name })}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>

            {/* Block 2: 小分類清單 */}
            <Card className="overflow-hidden border-none shadow-none sm:border sm:bg-white sm:shadow-sm sm:rounded-3xl">
              <CardHeader className="rounded-t-3xl border-b border-slate-100 bg-white/50 px-4 py-3 backdrop-blur-sm sm:px-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold text-slate-800">小分類清單</CardTitle>
                  <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-500 font-mono">
                    {loading ? "讀取中" : `${rows.length}`}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="min-h-[160px] rounded-b-3xl bg-slate-50/50 p-3 sm:bg-white sm:p-4">
                {/* Create Category */}
                <div className="mb-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2 sm:p-3">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <select
                      className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 font-medium text-slate-800 shadow-sm outline-none transition-colors focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      value={newGroup}
                      onChange={(e) => setNewGroup(e.target.value)}
                      disabled={groupsLoading || groupsOrdered.every((group) => group.is_active === false)}
                      aria-label="選擇大分類"
                    >
                      <option value="">
                        {groupsLoading
                          ? "正在載入大分類…"
                          : groupsOrdered.some((group) => group.is_active !== false)
                            ? "請選擇大分類"
                            : "請先新增大分類"}
                      </option>
                      {groupsOrdered
                        .filter((group) => group.is_active !== false)
                        .map((group) => (
                          <option key={group.id} value={group.name}>
                            {group.name}
                          </option>
                        ))}
                    </select>
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
                <div className="space-y-4">
                  {rows.length === 0 ? (
                    <div className="py-14 text-center text-slate-400 font-semibold opacity-50">
                      目前沒有小分類資料，請在上方選擇大分類並新增。
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
                              strategy={rectSortingStrategy}
                            >
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {orderedList.map((r) => {
                                  return (
                                    <SortableCategoryCard
                                      key={r.id}
                                      row={r}
                                      onNameChange={(v) => {
                                        setRows((prev) =>
                                          prev.map((x) => (x.id === r.id ? { ...x, name: v } : x))
                                        );
                                      }}
                                      onNameBlur={() => patchCategory(r.id, { name: r.name })}
                                      onToggleActive={async () => {
                                        await patchCategory(r.id, { is_active: r.is_active === false });
                                        await loadCats(true);
                                      }}
                                      onDelete={() => setPendingDelete({ kind: "category", id: r.id, name: r.name })}
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

                <div className="mt-4 text-center text-xs text-slate-400">
                  💡 提示：可拖曳卡片左側圖示，或使用鍵盤方向鍵調整順序
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <ConfirmActionDialog
        open={pendingDelete !== null}
        title={pendingDelete?.kind === "group" ? "刪除大分類？" : "刪除小分類？"}
        description={
          pendingDelete
            ? pendingDelete.kind === "group"
              ? `「${pendingDelete.name}」刪除後無法復原。若仍有小分類使用，系統會阻止刪除。`
              : `「${pendingDelete.name}」刪除後無法復原。若仍有帳務資料使用，系統會阻止刪除。`
            : undefined
        }
        confirmLabel="刪除"
        destructive
        busy={deleting}
        onConfirm={confirmDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      />
    </main>
  );
}
