import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/http";
import { validateSplits } from "@/lib/ledger/splits";
import { supabase } from "@/lib/supabaseClient";


export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspace_id = searchParams.get("workspace_id") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    if (!workspace_id) return apiError("缺少 workspace_id");
    if (!from || !to) return apiError("缺少 from/to");

    const { data, error } = await supabase
      .from("ledger_entries")
      .select(`
  id,
  entry_date,
  type,
  amount,
  category_id,
  pay_method,
  merchant,
  note,
  bill_instance_id,
  payer_id,
  created_at,
  ledger_splits (
    payer_id,
    amount
  )
`)

      .eq("workspace_id", workspace_id)
      .gte("entry_date", from)
      .lte("entry_date", to)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message, data: [] }, { status: 500 });
    return NextResponse.json({ data: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, data: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      workspace_id,
      entry_date,
      type,
      amount,
      category_id,
      pay_method,
      merchant,
      note,
      bill_instance_id,
      payer_id,
      splits,
    } = body || {};

    if (!workspace_id) return apiError("缺少 workspace_id");
    if (!entry_date) return apiError("缺少 entry_date");
    if (!type || (type !== "expense" && type !== "income")) return apiError("type 必須為 expense/income");
    const amt = Number(amount);
    if (!amt || amt <= 0) return apiError("amount 必須大於 0");

    const splitCheck = validateSplits({ type, amount: amt, payer_id: payer_id || null, splits });
    if (!splitCheck.ok) return apiError(splitCheck.error);

    // ✅ FK 保護：category_id 若不是合法 uuid or 不存在，就清掉避免爆 FK
    let safeCategoryId: string | null = category_id || null;
    if (safeCategoryId && typeof safeCategoryId === "string") {
      const uuidRe =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRe.test(safeCategoryId)) {
        safeCategoryId = null;
      } else {
        const { data: c, error: cErr } = await supabase
          .from("ledger_categories")
          .select("id")
          .eq("workspace_id", workspace_id)
          .eq("id", safeCategoryId)
          .maybeSingle();
        if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
        if (!c) safeCategoryId = null;
      }
    } else {
      safeCategoryId = null;
    }

    // 1) insert entry
    const { data: entry, error: insErr } = await supabase
      .from("ledger_entries")
      .insert([
        {
          workspace_id,
          entry_date,
          type,
          amount: amt,
          category_id: safeCategoryId,
          pay_method: pay_method || null,
          merchant: merchant || null,
          note: note || null,
          bill_instance_id: bill_instance_id || null,
          payer_id: payer_id || null,
        },
      ])
      .select("id")
      .single();

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    // 2) insert splits (optional) ✅ 改成 entry_id
    if (Array.isArray(splits) && splits.length > 0) {
      const rows = splits.map((s: any) => ({
        workspace_id,
        entry_id: entry.id, // ✅ HERE
        payer_id: s.payer_id,
        amount: Number(s.amount),
      }));

      const { error: spErr } = await supabase.from("ledger_splits").insert(rows);
      if (spErr) {
        return NextResponse.json({ error: `記帳成功，但拆帳寫入失敗：${spErr.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, id: entry.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      workspace_id,
      id,
      entry_date,
      type,
      amount,
      category_id,
      pay_method,
      merchant,
      note,
      payer_id,
      splits,
    } = body || {};

    if (!workspace_id) return apiError("缺少 workspace_id");
    if (!id) return apiError("缺少 id");
    if (!entry_date) return apiError("缺少 entry_date");
    if (!type || (type !== "expense" && type !== "income")) return apiError("type 必須為 expense/income");
    const amt = Number(amount);
    if (!amt || amt <= 0) return apiError("amount 必須大於 0");

    const splitCheck = validateSplits({ type, amount: amt, payer_id: payer_id || null, splits });
    if (!splitCheck.ok) return apiError(splitCheck.error);

    // ✅ FK 保護：category_id 若不是合法 uuid or 不存在，就清掉避免爆 FK
    let safeCategoryId: string | null = category_id || null;
    if (safeCategoryId && typeof safeCategoryId === "string") {
      const uuidRe =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRe.test(safeCategoryId)) {
        safeCategoryId = null;
      } else {
        const { data: c, error: cErr } = await supabase
          .from("ledger_categories")
          .select("id")
          .eq("workspace_id", workspace_id)
          .eq("id", safeCategoryId)
          .maybeSingle();
        if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
        if (!c) safeCategoryId = null;
      }
    } else {
      safeCategoryId = null;
    }

    // 1) update entry
    const { error: upErr } = await supabase
      .from("ledger_entries")
      .update({
        entry_date,
        type,
        amount: amt,
        category_id: safeCategoryId,
        pay_method: pay_method || null,
        merchant: merchant || null,
        note: note || null,
        payer_id: payer_id || null,
      })
      .eq("workspace_id", workspace_id)
      .eq("id", id);

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    // 2) refresh splits: delete then insert ✅ 改成 entry_id
    const { error: delSpErr } = await supabase
      .from("ledger_splits")
      .delete()
      .eq("workspace_id", workspace_id)
      .eq("entry_id", id); // ✅ HERE

    if (delSpErr) return NextResponse.json({ error: delSpErr.message }, { status: 500 });

    if (Array.isArray(splits) && splits.length > 0) {
      const rows = splits.map((s: any) => ({
        workspace_id,
        entry_id: id, // ✅ HERE
        payer_id: s.payer_id,
        amount: Number(s.amount),
      }));
      const { error: insSpErr } = await supabase.from("ledger_splits").insert(rows);
      if (insSpErr) return NextResponse.json({ error: insSpErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { workspace_id, id } = body || {};

    if (!workspace_id) return apiError("缺少 workspace_id");
    if (!id) return apiError("缺少 id");

    // 1) delete splits first ✅ 改成 entry_id
    const { error: delSpErr } = await supabase
      .from("ledger_splits")
      .delete()
      .eq("workspace_id", workspace_id)
      .eq("entry_id", id); // ✅ HERE

    if (delSpErr) return NextResponse.json({ error: delSpErr.message }, { status: 500 });

    // 2) delete entry
    const { error: delErr } = await supabase
      .from("ledger_entries")
      .delete()
      .eq("workspace_id", workspace_id)
      .eq("id", id);

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
