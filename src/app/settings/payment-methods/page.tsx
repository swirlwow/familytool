"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WORKSPACE_ID } from "@/lib/appConfig";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

import {
  PayMethod,
  apiGetPaymentMethods,
  apiPostPaymentMethod,
  apiPatchPaymentMethod,
  apiDeletePaymentMethod,
  n,
  orderBySortName,
} from "@/lib/api";

import { CreditCard, GripVertical, Power, Trash2, ArrowUpDown, ArrowLeft, Plus } from "lucide-react";

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
          ? "border-sky-400 ring-2 ring-sky-400/20 shadow-xl scale-[1.02] z-50"
          : "border-slate-200 hover:border-sky-300 hover:shadow-md",
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
            >
              <Trash2 className="w-4 h-4" />
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const ordered = useMemo(() => orderBySortName(rows), [rows]);

  async function load() {
    if (!WORKSPACE_ID) return;
    setLoading(true);
    try {
      const j = await apiGetPaymentMethods({ workspace_id: WORKSPACE_ID, include_inactive: 1 });
      setRows(Array.isArray(j?.data) ? j.data : []);
    } catch (e: any) {
      alert(e?.message || "讀取失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function patch(id: string, patchBody: any) {
    if (!WORKSPACE_ID) return;
    try {
      await apiPatchPaymentMethod({ workspace_id: WORKSPACE_ID, id, ...patchBody });
    } catch (e: any) {
      alert(e?.message || "更新失敗");
    }
  }

  async function add() {
    if (!WORKSPACE_ID) return alert("未設定 WORKSPACE_ID");
    const nm = newName.trim();
    if (!nm) return alert("請輸入付款方式名稱");

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
    } catch (e: any) {
      alert(e?.message || "新增失敗");
    }
  }

  async function del(id: string, name: string) {
    if (!WORKSPACE_ID) return;
    if (!confirm(`確定刪除付款方式「${name}」？`)) return;

    try {
      await apiDeletePaymentMethod({ workspace_id: WORKSPACE_ID, id });
      await load();
    } catch (e: any) {
      alert(e?.message || "刪除失敗");
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

    try {
      for (let i = 0; i < nextRows.length; i++) {
        await patch(nextRows[i].id, { sort_order: (i + 1) * 10 });
      }
    } finally {
      await load();
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        
        {/* ✅ Header：黏住頂部 + 縮小 - Sky Theme */}
        <div className="card bg-white/90 backdrop-blur-md shadow-sm border border-slate-200 rounded-3xl sticky top-0 z-40">
          <div className="card-body p-4 flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-sky-50 text-sky-600 p-2 rounded-lg border border-sky-100">
                <CreditCard className="w-5 h-5" />
              </div>

              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-slate-800">付款方式</h1>
                <div className="badge badge-sm bg-sky-100 text-sky-700 border-none font-bold hidden sm:inline-flex">
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
          {!WORKSPACE_ID && (
            <div className="px-4 pb-3">
              <div className="alert alert-warning rounded-2xl py-3 text-sm">
                <span>⚠️ 缺少 WORKSPACE_ID 設定（請檢查 .env.local）</span>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-8">
          <Card className="overflow-hidden border-none shadow-none sm:border sm:bg-white sm:shadow-sm sm:rounded-3xl">
            <CardHeader className="border-b border-slate-100 bg-white/50 px-6 py-4 backdrop-blur-sm rounded-t-3xl">
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

            <CardContent className="min-h-[300px] p-4 sm:p-6 bg-slate-50/50 sm:bg-white rounded-b-3xl">
              {/* 新增區塊 */}
              <div className="mb-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 sm:p-4">
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
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 opacity-50">
                  <p>目前尚無付款方式</p>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={ordered.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
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
                          onDelete={() => del(r.id, r.name)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              <div className="mt-8 text-center text-xs text-slate-400">
                💡 提示：按住卡片左側圖示即可上下拖曳排序
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
