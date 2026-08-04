// src/app/api/bills/route.ts
import { NextResponse } from "next/server";
import { apiError, apiInternalError, apiOperationError, parseJson } from "@/lib/api/http";
import { supabase } from "@/lib/supabaseClient";


function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

const billSelect = `
  id,
  workspace_id,
  template_id,
  period,
  due_date,
  name_snapshot,
  amount_due,
  status,
  paid_total,
  billing_start,
  billing_end,
  source,
  payment_mode,
  paid_at,
  created_at
`;

/** 分帳驗證（與 ledger/route.ts 同邏輯） */
function validateSplits(params: {
  type: "expense" | "income";
  amount: number;
  payer_id?: string | null;
  splits?: any[];
}) {
  const { type, amount, payer_id, splits } = params;

  if (!splits || splits.length === 0) return { ok: true as const };

  if (type !== "expense") return { ok: false as const, error: "拆帳目前只支援『支出』" };
  if (!payer_id) return { ok: false as const, error: "拆帳：請先選擇付款人" };

  let sum = 0;
  for (const s of splits) {
    if (!s?.payer_id) return { ok: false as const, error: "拆帳：請選擇應付者" };
    if (s.payer_id === payer_id) return { ok: false as const, error: "拆帳：應付者不可等於付款人" };

    const a = Number(s?.amount);
    if (!a || a <= 0) return { ok: false as const, error: "拆帳：金額需大於 0" };
    sum += a;
  }

  if (sum > Number(amount)) return { ok: false as const, error: "拆帳：應付總和不可大於支出金額" };
  return { ok: true as const };
}

/**
 * GET /api/bills?workspace_id=...&ym=YYYY-MM
 * or /api/bills?workspace_id=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspace_id = searchParams.get("workspace_id") || "";
    const ym = searchParams.get("ym") || "";
    let from = searchParams.get("from") || "";
    let to = searchParams.get("to") || "";

    if (!workspace_id) return apiError("缺少 workspace_id");

    if (ym && (!from || !to)) {
      const r = monthRange(ym);
      from = r.from;
      to = r.to;
    }
    if (!from || !to) return apiError("缺少 ym 或 from/to");

    let query = supabase
      .from("bill_instances")
      .select(billSelect)
      .eq("workspace_id", workspace_id);

    query = ym
      ? query.eq("period", ym)
      : query.gte("due_date", from).lte("due_date", to);

    const { data, error } = await query
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) return apiInternalError(error, { context: "Load bills", data: [] });

    return NextResponse.json({ data: data || [], from, to });
  } catch (error) {
    return apiInternalError(error, { context: "Load bills", data: [] });
  }
}

/**
 * POST /api/bills
 * body:
 *  - action?: "create" | "pay_to_ledger"
 *
 * ✅ create:
 * { workspace_id, period(YYYY-MM), name_snapshot, amount_due, due_date, billing_start?, billing_end? }
 *
 * ✅ pay_to_ledger:
 * { action:"pay_to_ledger", workspace_id, bill_instance_id, pay_amount, entry_date, payer_id, pay_method?, category_id?, merchant?, note?,
 *   splits?: [{payer_id, amount}] }
 */
export async function POST(req: Request) {
  try {
    const body = await parseJson<Record<string, any>>(req, {});
    const action = String(body?.action || "create");

    if (action === "create") {
      const { workspace_id, period, name_snapshot, amount_due, due_date, billing_start, billing_end } = body || {};

      if (!workspace_id) return apiError("缺少 workspace_id");
      if (!period) return apiError("缺少 period（YYYY-MM）");
      if (!name_snapshot) return apiError("缺少 name_snapshot");
      const amt = round2(toNum(amount_due));
      if (!amt || amt <= 0) return apiError("amount_due 必須大於 0");
      if (!due_date) return apiError("缺少 due_date");

      const { data, error } = await supabase
        .from("bill_instances")
        .insert([
          {
            workspace_id,
            template_id: null, // 不用模板
            period: String(period),
            due_date: String(due_date),
            name_snapshot: String(name_snapshot),
            amount_due: amt,
            status: "unpaid",
            paid_total: 0,
            billing_start: billing_start ? String(billing_start) : null,
            billing_end: billing_end ? String(billing_end) : null,
            source: "manual",
            payment_mode: "ledger",
          },
        ])
        .select(billSelect)
        .single();

      if (error) return apiInternalError(error, { context: "Create bill" });
      return NextResponse.json({ success: true, data });
    }

    if (action === "pay_to_ledger") {
      const {
        workspace_id,
        bill_instance_id,
        pay_amount,
        entry_date,
        payer_id,
        pay_method,
        category_id,
        merchant,
        note,
        splits,
        request_key,
      } = body || {};

      if (!workspace_id) return apiError("缺少 workspace_id");
      if (!bill_instance_id) return apiError("缺少 bill_instance_id");
      if (!entry_date) return apiError("缺少 entry_date");
      if (!payer_id) return apiError("缺少 payer_id（誰先付錢）");
      if (!request_key) return apiError("缺少 request_key");

      const payAmt = round2(toNum(pay_amount));
      if (!payAmt || payAmt <= 0) return apiError("pay_amount 必須大於 0");

      // 分帳驗證（帳單付款寫入記帳，視為 expense）
      const splitCheck = validateSplits({
        type: "expense",
        amount: payAmt,
        payer_id: payer_id || null,
        splits: Array.isArray(splits) ? splits : [],
      });
      if (!splitCheck.ok) return apiError(splitCheck.error);

      const { data, error } = await supabase.rpc("pay_bill_to_ledger_atomic", {
        p_workspace_id: workspace_id,
        p_bill_instance_id: bill_instance_id,
        p_pay_amount: payAmt,
        p_entry_date: String(entry_date),
        p_payer_id: payer_id,
        p_pay_method: pay_method || null,
        p_category_id: category_id || null,
        p_merchant: merchant || null,
        p_note: note ? String(note) : null,
        p_splits: Array.isArray(splits) ? splits : [],
        p_request_key: String(request_key),
      });

      if (error) return apiOperationError(error, { context: "Pay bill" });
      return NextResponse.json({ success: true, ...(data as Record<string, unknown>) });
    }

    if (action === "mark_paid") {
      const { workspace_id, bill_instance_id, paid_at } = body || {};
      if (!workspace_id) return apiError("缺少 workspace_id");
      if (!bill_instance_id) return apiError("缺少 bill_instance_id");

      const { data: bill, error: billError } = await supabase
        .from("bill_instances")
        .select("id, amount_due, payment_mode, status")
        .eq("workspace_id", workspace_id)
        .eq("id", bill_instance_id)
        .single();

      if (billError) return apiInternalError(billError, { context: "Load bill for status update" });
      if (!bill) return apiError("找不到帳單");
      if (bill.payment_mode !== "status_only") return apiError("此帳單需透過付款流程寫入記帳");

      const amountDue = round2(toNum(bill.amount_due));
      if (amountDue <= 0) return apiError("請先填寫帳單金額");
      if (bill.status === "paid") return NextResponse.json({ success: true, already_paid: true });

      const paidAt = paid_at ? new Date(String(paid_at)) : new Date();
      if (Number.isNaN(paidAt.getTime())) return apiError("付款日期格式錯誤");

      const { data: updated, error } = await supabase
        .from("bill_instances")
        .update({
          paid_total: amountDue,
          status: "paid",
          paid_at: paidAt.toISOString(),
        })
        .eq("workspace_id", workspace_id)
        .eq("id", bill_instance_id)
        .eq("payment_mode", "status_only")
        .select("id")
        .single();

      if (error) return apiInternalError(error, { context: "Mark bill paid" });
      if (!updated) return apiError("帳單狀態未更新");

      return NextResponse.json({
        success: true,
        bill_instance_id,
        paid_total: amountDue,
        status: "paid",
        ledger_entry_id: null,
      });
    }

    return apiError("不支援的 action");
  } catch (error) {
    return apiOperationError(error, { context: "Process bill action" });
  }
}

/**
 * PATCH /api/bills
 * body: { workspace_id, id, name_snapshot?, due_date?, amount_due?, status?, paid_total?, billing_start?, billing_end? }
 */
export async function PATCH(req: Request) {
  try {
    const body = await parseJson<Record<string, any>>(req, {});
    const { workspace_id, id } = body || {};
    if (!workspace_id) return apiError("缺少 workspace_id");
    if (!id) return apiError("缺少 id");

    const { data: current, error: currentError } = await supabase
      .from("bill_instances")
      .select("amount_due, due_date, status")
      .eq("workspace_id", workspace_id)
      .eq("id", id)
      .single();

    if (currentError) return apiInternalError(currentError, { context: "Load bill for update" });
    if (!current) return apiError("找不到帳單");

    const patch: Record<string, string | number | null> = {};
    if (body.name_snapshot != null) patch.name_snapshot = String(body.name_snapshot);
    if (body.due_date !== undefined) patch.due_date = body.due_date ? String(body.due_date) : null;
    if (body.billing_start !== undefined) patch.billing_start = body.billing_start ? String(body.billing_start) : null;
    if (body.billing_end !== undefined) patch.billing_end = body.billing_end ? String(body.billing_end) : null;

    if (body.amount_due !== undefined) {
      const amt = round2(toNum(body.amount_due));
      if (!amt || amt <= 0) return apiError("amount_due 必須大於 0");
      patch.amount_due = amt;
    }
    if (body.paid_total !== undefined || body.status !== undefined) {
      return apiError("帳單付款狀態只能透過付款或標記已繳流程更新");
    }

    if (current.status === "awaiting_details") {
      const nextAmount = patch.amount_due ?? current.amount_due;
      const nextDueDate = patch.due_date !== undefined ? patch.due_date : current.due_date;
      if (nextAmount != null && toNum(nextAmount) > 0 && nextDueDate) patch.status = "unpaid";
    }

    const { error } = await supabase.from("bill_instances").update(patch).eq("workspace_id", workspace_id).eq("id", id);
    if (error) return apiInternalError(error, { context: "Update bill" });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiOperationError(error, { context: "Update bill" });
  }
}

/**
 * DELETE /api/bills
 * body: { workspace_id, id }
 */
export async function DELETE(req: Request) {
  try {
    const body = await parseJson<Record<string, any>>(req, {});
    const { workspace_id, id } = body || {};
    if (!workspace_id) return apiError("缺少 workspace_id");
    if (!id) return apiError("缺少 id");

    const { count, error: referenceError } = await supabase
      .from("ledger_entries")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace_id)
      .eq("bill_instance_id", id);

    if (referenceError) return apiInternalError(referenceError, { context: "Check bill ledger references" });
    if ((count || 0) > 0) return apiError("此帳單已有記帳紀錄，不能刪除");

    const { error } = await supabase.from("bill_instances").delete().eq("workspace_id", workspace_id).eq("id", id);
    if (error) return apiInternalError(error, { context: "Delete bill" });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiOperationError(error, { context: "Delete bill" });
  }
}
