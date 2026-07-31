"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, Check, Pencil, Plus, RefreshCw, X } from "lucide-react";

type BillTemplate = {
  id: string;
  name: string;
  amount_default: number | null;
  amount_mode: "fixed" | "variable";
  schedule_type: "monthly" | "months";
  schedule_months: number[] | null;
  due_day: number | null;
  payment_mode: "ledger" | "status_only";
  starts_on: string;
  ends_on: string | null;
  active: boolean;
};

type TemplateForm = {
  name: string;
  amount_default: string;
  amount_mode: "fixed" | "variable";
  schedule_type: "monthly" | "months";
  schedule_months: number[];
  due_day: string;
  payment_mode: "ledger" | "status_only";
  starts_on: string;
};

const monthLabels = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function emptyForm(): TemplateForm {
  return {
    name: "",
    amount_default: "",
    amount_mode: "fixed",
    schedule_type: "monthly",
    schedule_months: [],
    due_day: "",
    payment_mode: "ledger",
    starts_on: currentMonth(),
  };
}

function scheduleLabel(template: BillTemplate) {
  if (template.schedule_type === "monthly") return "每月";
  return (template.schedule_months || []).map((month) => monthLabels[month - 1]).join("、");
}

export function BillTemplateManager({ workspaceId }: { workspaceId: string | null }) {
  const [rows, setRows] = useState<BillTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BillTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TemplateForm>(emptyForm);

  const activeCount = useMemo(() => rows.filter((row) => row.active).length, [rows]);

  const loadTemplates = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/bill-templates?workspace_id=${workspaceId}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "讀取模板失敗");
      setRows(Array.isArray(payload?.data) ? payload.data : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "讀取模板失敗");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function openEdit(template: BillTemplate) {
    setEditing(template);
    setForm({
      name: template.name,
      amount_default: template.amount_default == null ? "" : String(template.amount_default),
      amount_mode: template.amount_mode,
      schedule_type: template.schedule_type,
      schedule_months: template.schedule_months || [],
      due_day: template.due_day == null ? "" : String(template.due_day),
      payment_mode: template.payment_mode,
      starts_on: template.starts_on.slice(0, 7),
    });
    setShowForm(true);
  }

  function toggleMonth(month: number) {
    setForm((current) => ({
      ...current,
      schedule_months: current.schedule_months.includes(month)
        ? current.schedule_months.filter((value) => value !== month)
        : [...current.schedule_months, month].sort((a, b) => a - b),
    }));
  }

  async function saveTemplate() {
    if (!workspaceId) return;
    if (!form.name.trim()) return alert("請輸入模板名稱");
    if (form.amount_mode === "fixed" && Number(form.amount_default) <= 0) return alert("固定金額需大於 0");
    if (form.schedule_type === "months" && form.schedule_months.length === 0) return alert("請至少選擇一個月份");

    setSaving(true);
    try {
      const response = await fetch("/api/bill-templates", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          id: editing?.id,
          name: form.name.trim(),
          amount_default: form.amount_mode === "fixed" ? Number(form.amount_default) : null,
          amount_mode: form.amount_mode,
          schedule_type: form.schedule_type,
          schedule_months: form.schedule_type === "months" ? form.schedule_months : null,
          due_day: form.due_day ? Number(form.due_day) : null,
          payment_mode: form.payment_mode,
          starts_on: form.starts_on,
          active: editing?.active ?? true,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "儲存模板失敗");
      setShowForm(false);
      await loadTemplates();
    } catch (caught) {
      alert(caught instanceof Error ? caught.message : "儲存模板失敗");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(template: BillTemplate) {
    if (!workspaceId) return;
    const response = await fetch("/api/bill-templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: workspaceId,
        id: template.id,
        active: !template.active,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return alert(payload?.error || "更新模板失敗");
    await loadTemplates();
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-base font-black text-slate-800">固定帳單</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-400">{activeCount} 個使用中，共 {rows.length} 個</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm rounded-lg"
            onClick={() => void loadTemplates()}
            disabled={loading}
            title="重新載入"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button type="button" className="btn btn-sm rounded-lg border-none bg-rose-500 text-white hover:bg-rose-600" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            新增
          </button>
        </div>
      </div>

      {error ? <div className="m-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div> : null}

      {rows.length === 0 && !loading ? (
        <div className="px-6 py-10 text-center text-sm font-medium text-slate-400">還沒有固定帳單</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((template) => (
            <article
              key={template.id}
              className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-4 py-3 sm:px-5 md:grid-cols-[minmax(190px,1.4fr)_minmax(170px,1fr)_minmax(110px,0.65fr)_auto] md:items-center ${
                template.active ? "" : "bg-slate-50 opacity-60"
              }`}
            >
              <div className="col-span-2 min-w-0 md:col-span-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-bold text-slate-800">{template.name}</h3>
                  <span className={`badge badge-sm border-none ${template.payment_mode === "status_only" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {template.payment_mode === "status_only" ? "只更新狀態" : "連動記帳"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-400">{template.starts_on.slice(0, 7)} 起</div>
              </div>

              <div className="col-span-2 flex min-w-0 items-center gap-2 text-sm font-medium text-slate-600 md:col-span-1">
                <CalendarRange className="h-4 w-4 text-slate-400" />
                <span>{scheduleLabel(template)}</span>
                <span className="text-slate-300">·</span>
                <span>{template.due_day ? `${template.due_day} 日前` : "待填到期日"}</span>
              </div>

              <div className="font-mono text-sm font-bold tabular-nums text-slate-700">
                {template.amount_mode === "fixed"
                  ? `$${Number(template.amount_default || 0).toLocaleString()}`
                  : "待填金額"}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button type="button" className="btn btn-ghost btn-sm rounded-lg" onClick={() => openEdit(template)} title="編輯">
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">編輯</span>
                </button>
                <button
                  type="button"
                  className={`btn btn-sm rounded-lg ${template.active ? "btn-ghost text-slate-500" : "border-none bg-emerald-600 text-white hover:bg-emerald-700"}`}
                  onClick={() => void toggleActive(template)}
                >
                  {template.active ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                  {template.active ? "停用" : "使用"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="modal modal-open bg-slate-900/40">
          <div className="modal-box max-w-2xl rounded-lg p-0">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="font-black text-slate-800">{editing ? "編輯固定帳單" : "新增固定帳單"}</h3>
              <button type="button" className="btn btn-ghost btn-sm rounded-lg" onClick={() => setShowForm(false)} title="關閉">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[72vh] space-y-5 overflow-y-auto p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="form-control md:col-span-2">
                  <span className="label-text mb-1 text-xs font-bold text-slate-500">帳單名稱</span>
                  <input className="input input-bordered w-full rounded-lg" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                </label>

                <div>
                  <span className="mb-1 block text-xs font-bold text-slate-500">金額</span>
                  <div className="join w-full">
                    <button type="button" className={`btn join-item flex-1 ${form.amount_mode === "fixed" ? "bg-slate-800 text-white" : ""}`} onClick={() => setForm((current) => ({ ...current, amount_mode: "fixed" }))}>固定</button>
                    <button type="button" className={`btn join-item flex-1 ${form.amount_mode === "variable" ? "bg-slate-800 text-white" : ""}`} onClick={() => setForm((current) => ({ ...current, amount_mode: "variable", amount_default: "" }))}>每期填寫</button>
                  </div>
                </div>

                <label className="form-control">
                  <span className="label-text mb-1 text-xs font-bold text-slate-500">固定金額</span>
                  <input
                    type="number"
                    min="0"
                    className="input input-bordered w-full rounded-lg font-mono"
                    value={form.amount_default}
                    disabled={form.amount_mode === "variable"}
                    onChange={(event) => setForm((current) => ({ ...current, amount_default: event.target.value }))}
                  />
                </label>

                <div>
                  <span className="mb-1 block text-xs font-bold text-slate-500">產生週期</span>
                  <div className="join w-full">
                    <button type="button" className={`btn join-item flex-1 ${form.schedule_type === "monthly" ? "bg-slate-800 text-white" : ""}`} onClick={() => setForm((current) => ({ ...current, schedule_type: "monthly", schedule_months: [] }))}>每月</button>
                    <button type="button" className={`btn join-item flex-1 ${form.schedule_type === "months" ? "bg-slate-800 text-white" : ""}`} onClick={() => setForm((current) => ({ ...current, schedule_type: "months" }))}>指定月份</button>
                  </div>
                </div>

                <label className="form-control">
                  <span className="label-text mb-1 text-xs font-bold text-slate-500">每月到期日</span>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    className="input input-bordered w-full rounded-lg"
                    placeholder="可稍後填寫"
                    value={form.due_day}
                    onChange={(event) => setForm((current) => ({ ...current, due_day: event.target.value }))}
                  />
                </label>
              </div>

              {form.schedule_type === "months" ? (
                <fieldset>
                  <legend className="mb-2 text-xs font-bold text-slate-500">產生月份</legend>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {monthLabels.map((label, index) => {
                      const month = index + 1;
                      const selected = form.schedule_months.includes(month);
                      return (
                        <button
                          key={label}
                          type="button"
                          className={`btn btn-sm rounded-lg ${selected ? "border-none bg-rose-500 text-white hover:bg-rose-600" : "btn-outline border-slate-200"}`}
                          onClick={() => toggleMonth(month)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="form-control">
                  <span className="label-text mb-1 text-xs font-bold text-slate-500">付款處理</span>
                  <select className="select select-bordered w-full rounded-lg" value={form.payment_mode} onChange={(event) => setForm((current) => ({ ...current, payment_mode: event.target.value as TemplateForm["payment_mode"] }))}>
                    <option value="ledger">付款並寫入記帳</option>
                    <option value="status_only">只標記已繳</option>
                  </select>
                </label>

                <label className="form-control">
                  <span className="label-text mb-1 text-xs font-bold text-slate-500">開始月份</span>
                  <input type="month" className="input input-bordered w-full rounded-lg" value={form.starts_on} onChange={(event) => setForm((current) => ({ ...current, starts_on: event.target.value }))} />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <button type="button" className="btn btn-ghost rounded-lg" onClick={() => setShowForm(false)}>取消</button>
              <button type="button" className="btn rounded-lg border-none bg-rose-500 px-6 text-white hover:bg-rose-600" onClick={() => void saveTemplate()} disabled={saving}>
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                儲存
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={() => setShowForm(false)} aria-label="關閉模板視窗" />
        </div>
      ) : null}
    </section>
  );
}
