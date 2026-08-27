"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WORKSPACE_ID } from "@/lib/appConfig";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

import {
  PayMethod,
  apiGetPaymentMethods,
  apiPostPaymentMethod,
  apiPatchPaymentMethod,
  apiDeletePaymentMethod,
  n,
  orderBySortName,
} from "@/lib/api";

import { CreditCard, GripVertical, Trash2, ArrowUpDown, ArrowLeft, Plus } from "lucide-react";

function stopDrag(e: React.SyntheticEvent) {
  e.stopPropagation();
}

function SortablePayMethodCard({
  row,
  onNameChange,
  onNameBlur,
  onToggleActive,
  onDelete,
}: {
  row: PayMethod;
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
        "group relative flex items-center gap-2 rounded-xl border bg-white p-2.5 shadow-sm transition-colors duration-150 select-none",
        isDragging
          ? "border-sky-400 bg-sky-50/70 shadow-md opacity-95 z-50"
          : "border-slate-200 hover:border-sky-300",
        inactive ? "bg-slate-50/80" : "",
      ].join(" ")}
    >
      {/* 拖曳手柄 */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex h-9 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-sky-50 hover:text-sky-600 active:cursor-grabbing touch-none"
        title="按住拖曳排序"
        aria-label={`調整付款方式「${row.name}」順序`}
      >
        <GripVertical className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        {/* 輸入框 */}
        <div className="min-w-0 flex-1 flex items-center gap-3">
          <Input
            value={row.name}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={onNameBlur}
            placeholder="付款方式名稱"
            className={[
              "h-10 border-transparent bg-transparent px-2 text-base font-medium shadow-none transition-all p-0 sm:p-2",
              "focus-visible:border-slate-300 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-sky-500/20 rounded-lg",
              inactive ? "text-slate-500 line-through decoration-slate-300" : "text-slate-900",
            ].join(" ")}
            onPointerDown={stopDrag}
            onKeyDown={stopDrag}
          />
        </div>

        {/* 狀態與按鈕 */}
        <div className="flex items-center justify-between gap-3 sm:justify-end border-t border-slate-100 sm:border-0 pt-2 sm:pt-0 mt-1 sm:mt-0">
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
              onClick={(e) => {
                e.stopPropagation();
                onToggleActive();
              }}
              onPointerDown={stopDrag}
            >
              {inactive ? "啟用" : "停用"}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              onPointerDown={stopDrag}
              title="刪除"
              aria-label={`刪除付款方式「${row.name}」`}
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentMethodsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<PayMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 3 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ordered = useMemo(() => orderBySortName(rows), [rows]);

  const load = useCallback(async () => {
    if (!WORKSPACE_ID) return;
    setLoading(true);
    try {
      const j = await apiGetPaymentMethods({ workspace_id: WORKSPACE_ID, include_inactive: 1 });
      setRows(Array.isArray(j?.data) ? j.data : []);
    } catch (error: unknown) {
      toast({ variant: "destructive", title: "付款方式讀取失敗", description: getErrorMessage(error, "請稍後再試") });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(
    id: string,
    patchBody: { name?: string; sort_order?: number; is_active?: boolean }
  ) {
    if (!WORKSPACE_ID) return;
    try {
      await apiPatchPaymentMethod({ workspace_id: WORKSPACE_ID, id, ...patchBody });
    } catch (error: unknown) {
      toast({ variant: "destructive", title: "付款方式更新失敗", description: getErrorMessage(error, "請稍後再試") });
    }
  }

  async function add() {
    if (!WORKSPACE_ID) {
      toast({ variant: "destructive", title: "無法新增", description: "尚未設定工作區" });
      return;
    }
    const nm = newName.trim();
    if (!nm) {
      toast({ variant: "destructive", title: "請輸入付款方式名稱" });
      return;
    }

    const maxSort = ordered.reduce((m, r) => Math.max(m, n(r.sort_order)), 0);

    try {
      await apiPostPaymentMethod({
        workspace_id: WORKSPACE_ID,
        name: nm,
        sort_order: maxSort + 10,
        is_active: true,
      });
      setNewName("");
      await load();
      toast({ title: "已新增付款方式", description: nm });
    } catch (error: unknown) {
      toast({ variant: "destructive", title: "付款方式新增失敗", description: getErrorMessage(error, "請稍後再試") });
    }
  }

  async function confirmDelete() {
    if (!WORKSPACE_ID || !pendingDelete) return;
    const target = pendingDelete;
    setDeleting(true);
    try {
      await apiDeletePaymentMethod({ workspace_id: WORKSPACE_ID, id: target.id });
      setPendingDelete(null);
      await load();
      toast({ title: "已刪除付款方式", description: target.name });
    } catch (error: unknown) {
      toast({ variant: "destructive", title: "付款方式刪除失敗", description: getErrorMessage(error, "可能仍有帳務資料使用此付款方式") });
    } finally {
      setDeleting(false);
    }
  }

  async function fixSort() {
    if (!WORKSPACE_ID) return;
    setLoading(true);
    try {
      const base = ordered;
      for (let i = 0; i < base.length; i++) {
        const desired = (i + 1) * 10;
        if (n(base[i].sort_order) !== desired) {
          await patch(base[i].id, { sort_order: desired });
        }
      }
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function handleDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || activeId === overId) return;

    const ids = ordered.map((r) => r.id);
    const oldIndex = ids.indexOf(activeId);
    const newIndex = ids.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(ordered, oldIndex, newIndex);
    const nextRows = next.map((r, i) => ({ ...r, sort_order: (i + 1) * 10 }));
    setRows(nextRows);

    const changedRows = nextRows.filter(
      (row) => n(rows.find((current) => current.id === row.id)?.sort_order) !== n(row.sort_order)
    );

    try {
      await Promise.all(
        changedRows.map((row) => patch(row.id, { sort_order: row.sort_order }))
      );
    } finally {
      await load();
    }
  }

  return (
    <main className="app-page">
      <div className="app-page-inner max-w-6xl">
        
        {/* ✅ Header：黏住頂部 + 縮小 - Sky Theme */}
        <div className="app-header">
          <div className="flex w-full flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-sky-50 text-sky-600 p-2 rounded-lg border border-sky-100">
                <CreditCard className="w-5 h-5" />
              </div>

              <h1 className="text-lg font-black text-slate-800">付款方式</h1>
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

        <div className="space-y-5">
          <Card className="overflow-hidden border-none shadow-none sm:border sm:bg-white sm:shadow-sm sm:rounded-3xl">
            <CardHeader className="rounded-t-3xl border-b border-slate-100 bg-white/50 px-4 py-3 backdrop-blur-sm sm:px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-800">所有項目</CardTitle>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={load}
                    disabled={loading}
                    className="h-8 px-2 text-slate-400 hover:text-sky-600 rounded-lg"
                  >
                    {loading ? "..." : "重新整理"}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs rounded-xl border-sky-200 text-sky-700 hover:bg-sky-50 gap-2"
                    onClick={fixSort}
                    disabled={loading || ordered.length === 0}
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    一鍵修復排序
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="min-h-[160px] rounded-b-3xl bg-slate-50/50 p-3 sm:bg-white sm:p-4">
              {/* 新增區塊 */}
              <div className="mb-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2 sm:p-3">
                <div className="flex gap-2">
                  <Input
                    className="h-10 flex-1 border-slate-200 bg-white shadow-sm rounded-xl focus:border-sky-500 font-medium"
                    placeholder="輸入名稱後按 Enter 新增..."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") add();
                    }}
                  />
                  <Button
                    onClick={add}
                    className="h-10 rounded-xl bg-sky-600 px-6 font-bold text-white hover:bg-sky-700 shadow-md shadow-sky-200/50"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    新增
                  </Button>
                </div>
              </div>

              {ordered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <p>目前尚無付款方式，請在上方輸入名稱新增。</p>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={ordered.map((r) => r.id)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {ordered.map((r) => (
                        <SortablePayMethodCard
                          key={r.id}
                          row={r}
                          onNameChange={(v) =>
                            setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, name: v } : x)))
                          }
                          onNameBlur={() => patch(r.id, { name: r.name })}
                          onToggleActive={async () => {
                            await patch(r.id, { is_active: r.is_active === false });
                            await load();
                          }}
                          onDelete={() => setPendingDelete({ id: r.id, name: r.name })}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              <div className="mt-4 text-center text-xs text-slate-400">
                可拖曳左側圖示，或使用鍵盤方向鍵調整順序
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <ConfirmActionDialog
        open={pendingDelete !== null}
        title="刪除付款方式？"
        description={pendingDelete ? `「${pendingDelete.name}」刪除後無法復原。若已有帳務資料使用，系統會阻止刪除。` : undefined}
        confirmLabel="刪除"
        destructive
        busy={deleting}
        onConfirm={confirmDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      />
    </main>
  );
}
