// src/app/api/bills/route.ts
import { NextResponse } from "next/server";
import { apiError, parseJson } from "@/lib/api/http";
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

    const { data, error } = await supabase
      .from("bill_instances")
      .select(
        `
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
        created_at
      `
      )
      .eq("workspace_id", workspace_id)
      .gte("due_date", from)
      .lte("due_date", to)
      .order("due_date", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message, data: [] }, { status: 500 });

    return NextResponse.json({ data: data || [], from, to });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, data: [] }, { status: 500 });
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
          },
        ])
        .select(
          `id, period, due_date, name_snapshot, amount_due, status, paid_total, billing_start, billing_end, created_at`
        )
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
      } = body || {};

      if (!workspace_id) return apiError("缺少 workspace_id");
      if (!bill_instance_id) return apiError("缺少 bill_instance_id");
      if (!entry_date) return apiError("缺少 entry_date");
      if (!payer_id) return apiError("缺少 payer_id（誰先付錢）");

      const payAmt = round2(toNum(pay_amount));
      if (!payAmt || payAmt <= 0) return apiError("pay_amount 必須大於 0");

      // 先撈帳單，算剩餘可付
      const { data: bill, error: bErr } = await supabase
        .from("bill_instances")
        .select("id, amount_due, paid_total, status, name_snapshot, period")
        .eq("workspace_id", workspace_id)
        .eq("id", bill_instance_id)
        .single();

      if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });
      if (!bill) return apiError("找不到帳單");

      const due = round2(toNum(bill.amount_due));
      const paid = round2(toNum(bill.paid_total));
      const remain = round2(due - paid);

      if (remain <= 0) return apiError("此帳單已結清，無需再付款");
      if (payAmt > remain) return apiError(`付款金額不可大於待付金額（待付：${remain}）`);

      // 分帳驗證（帳單付款寫入記帳，視為 expense）
      const splitCheck = validateSplits({
        type: "expense",
        amount: payAmt,
        payer_id: payer_id || null,
        splits: Array.isArray(splits) ? splits : [],
      });
      if (!splitCheck.ok) return apiError(splitCheck.error);

      // ✅ 寫入 ledger_entries（expense）
      const { data: entry, error: insErr } = await supabase
        .from("ledger_entries")
        .insert([
          {
            workspace_id,
            entry_date: String(entry_date),
            type: "expense",
            amount: payAmt,
            category_id: category_id || null,
            pay_method: pay_method || null,
            merchant: merchant || null,
            note: note ? String(note) : `帳單付款：${bill.name_snapshot || ""}（${bill.period || ""}）`,
            bill_instance_id: bill_instance_id,
            payer_id: payer_id,
          },
        ])
        .select("id")
        .single();

      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

      // ✅ 寫入 ledger_splits（可選）
      if (Array.isArray(splits) && splits.length > 0) {
        const rows = splits.map((s: any) => ({
          workspace_id,
          entry_id: entry.id, // ✅ 你現在 ledger 正確用 entry_id
          payer_id: s.payer_id,
          amount: round2(toNum(s.amount)),
        }));

        const { error: spErr } = await supabase.from("ledger_splits").insert(rows);
        if (spErr) {
          // 這裡不回滾 entry（簡化），但會告知
          return NextResponse.json(
            { error: `帳單付款已寫入記帳，但拆帳寫入失敗：${spErr.message}` },
            { status: 500 }
          );
        }
      }

      // ✅ 回寫 bill_instances：paid_total/status
      const nextPaid = round2(paid + payAmt);
      const nextRemain = round2(due - nextPaid);
      const nextStatus = nextRemain <= 0 ? "paid" : nextPaid > 0 ? "partial" : "unpaid";

      const { error: upErr } = await supabase
        .from("bill_instances")
        .update({ paid_total: nextPaid, status: nextStatus })
        .eq("workspace_id", workspace_id)
        .eq("id", bill_instance_id);

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

      return NextResponse.json({
        success: true,
        ledger_entry_id: entry.id,
        bill_instance_id,
        paid_total: nextPaid,
        status: nextStatus,
        remaining: nextRemain,
      });
    }

    return apiError("不支援的 action");
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
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

    const patch: any = {};
    if (body.name_snapshot != null) patch.name_snapshot = String(body.name_snapshot);
    if (body.due_date != null) patch.due_date = String(body.due_date);
    if (body.billing_start !== undefined) patch.billing_start = body.billing_start ? String(body.billing_start) : null;
    if (body.billing_end !== undefined) patch.billing_end = body.billing_end ? String(body.billing_end) : null;

    if (body.amount_due != null) {
      const amt = round2(toNum(body.amount_due));
      if (!amt || amt <= 0) return apiError("amount_due 必須大於 0");
      patch.amount_due = amt;
    }
    if (body.paid_total != null) patch.paid_total = round2(toNum(body.paid_total));
    if (body.status != null) patch.status = String(body.status);

    const { error } = await supabase.from("bill_instances").update(patch).eq("workspace_id", workspace_id).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
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

    const { error } = await supabase.from("bill_instances").delete().eq("workspace_id", workspace_id).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
