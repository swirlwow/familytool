import { NextResponse } from "next/server";
import { apiError, apiInternalError, apiOperationError } from "@/lib/api/http";
import { validateSplits } from "@/lib/ledger/splits";
import { validConsumptionContent } from "@/lib/ledger/details";
import { supabase } from "@/lib/supabaseClient";
import { settlementStatus } from "@/lib/settlementStatus";


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
  consumption_content,
  note,
  bill_instance_id,
  payer_id,
  created_at,
  ledger_splits (
    id,
    payer_id,
    amount
  )
`)

      .eq("workspace_id", workspace_id)
      .gte("entry_date", from)
      .lte("entry_date", to)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) return apiInternalError(error, { context: "Load ledger", data: [] });

    const entries = (data || []) as any[];
    const splitIds = entries.flatMap((entry) =>
      (entry.ledger_splits || [])
        .filter(
          (split: any) =>
            split.id &&
            split.payer_id !== entry.payer_id &&
            Number(split.amount || 0) > 0
        )
        .map((split: any) => split.id)
    );

    const allocatedBySplit = new Map<string, number>();
    if (splitIds.length > 0) {
      const { data: items, error: itemError } = await supabase
        .from("settlement_items")
        .select("split_id, amount")
        .eq("workspace_id", workspace_id)
        .in("split_id", splitIds);

      if (itemError) {
        return apiInternalError(itemError, { context: "Load settlement allocations", data: [] });
      }

      for (const item of items || []) {
        const splitId = String((item as any).split_id || "");
        allocatedBySplit.set(
          splitId,
          (allocatedBySplit.get(splitId) || 0) + Number((item as any).amount || 0)
        );
      }
    }

    const enriched = entries.map((entry) => {
      const relevantSplits = (entry.ledger_splits || []).filter(
        (split: any) =>
          split.payer_id !== entry.payer_id && Number(split.amount || 0) > 0
      );

      const splits = (entry.ledger_splits || []).map((split: any) => {
        const splitAmount =
          split.payer_id === entry.payer_id ? 0 : Number(split.amount || 0);
        const settledAmount = allocatedBySplit.get(String(split.id || "")) || 0;
        return {
          ...split,
          settled_amount: settledAmount,
          settlement_status: settlementStatus(splitAmount, settledAmount),
        };
      });

      const splitAmount = relevantSplits.reduce(
        (sum: number, split: any) => sum + Number(split.amount || 0),
        0
      );
      const settledAmount = relevantSplits.reduce(
        (sum: number, split: any) =>
          sum + (allocatedBySplit.get(String(split.id || "")) || 0),
        0
      );

      return {
        ...entry,
        ledger_splits: splits,
        settlement_split_amount: splitAmount,
        settlement_settled_amount: settledAmount,
        settlement_status: settlementStatus(splitAmount, settledAmount),
      };
    });

    return NextResponse.json({ data: enriched });
  } catch (error) {
    return apiInternalError(error, { context: "Load ledger", data: [] });
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
      request_key,
    } = body || {};

    if (!validConsumptionContent(body?.consumption_content)) return apiError("消費內容最多 1000 個字");

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
        if (cErr) return apiInternalError(cErr, { context: "Validate ledger category" });
        if (!c) safeCategoryId = null;
      }
    } else {
      safeCategoryId = null;
    }

    const { data: entryId, error: rpcError } = await supabase.rpc(
      "create_ledger_entry_with_details",
      {
        p_workspace_id: workspace_id,
        p_entry_date: entry_date,
        p_type: type,
        p_amount: amt,
        p_category_id: safeCategoryId,
        p_pay_method: pay_method || null,
        p_merchant: merchant || null,
        p_note: note || null,
        p_bill_instance_id: bill_instance_id || null,
        p_payer_id: payer_id || null,
        p_splits: Array.isArray(splits) ? splits : [],
        p_request_key: request_key ? String(request_key) : null,
        p_consumption_content: body.consumption_content || null,
      }
    );

    if (rpcError) return apiOperationError(rpcError, { context: "Create ledger entry" });
    return NextResponse.json({ success: true, id: entryId });
  } catch (error) {
    return apiOperationError(error, { context: "Create ledger entry" });
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
        if (cErr) return apiInternalError(cErr, { context: "Validate ledger category" });
        if (!c) safeCategoryId = null;
      }
    } else {
      safeCategoryId = null;
    }

    if (!validConsumptionContent(body.consumption_content)) return apiError("消費內容最多 1000 個字");
    // An older client omitting this field must not erase existing content.
    const hasContent = Object.prototype.hasOwnProperty.call(body, "consumption_content");
    const { error: rpcError } = await supabase.rpc(hasContent ? "update_ledger_entry_with_details" : "update_ledger_entry_atomic", {
      p_workspace_id: workspace_id,
      p_entry_id: id,
      p_entry_date: entry_date,
      p_type: type,
      p_amount: amt,
      p_category_id: safeCategoryId,
      p_pay_method: pay_method || null,
      p_merchant: merchant || null,
      p_note: note || null,
      p_payer_id: payer_id || null,
      p_splits: Array.isArray(splits) ? splits : [],
      ...(hasContent ? { p_consumption_content: body.consumption_content || null } : {}),
    });

    if (rpcError) return apiOperationError(rpcError, { context: "Update ledger entry" });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiOperationError(error, { context: "Update ledger entry" });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { workspace_id, id } = body || {};

    if (!workspace_id) return apiError("缺少 workspace_id");
    if (!id) return apiError("缺少 id");

    const { error: rpcError } = await supabase.rpc("delete_ledger_entry_atomic", {
      p_workspace_id: workspace_id,
      p_entry_id: id,
    });
    if (rpcError) return apiOperationError(rpcError, { context: "Delete ledger entry" });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiOperationError(error, { context: "Delete ledger entry" });
  }
}
