import { NextResponse } from "next/server";
import { apiError, parseJson } from "@/lib/api/http";
import { supabase } from "@/lib/supabaseClient";
import { round2 } from "@/lib/settlementCalc";


function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * POST /api/settlement/:split_id/items
 * body: { workspace_id, from, to, amount, note? }
 */
export async function POST(req: Request, { params }: any) {
  try {
    const body = await parseJson<Record<string, any>>(req, {});
    const { workspace_id, from, to, amount, note } = body || {};

    const split_id = String(body?.split_id || params?.id || "").trim();
    const amt = round2(toNum(amount));

    if (!workspace_id) return apiError("缺少 workspace_id");
    if (!from || !to) return apiError("缺少 from/to");
    if (!split_id) return apiError("缺少 split_id");
    if (!amt || amt <= 0) return apiError("amount 必須大於 0");

    // 1) 取 split（含 entry）
    const { data: sp, error: spErr } = await supabase
      .from("ledger_splits")
      .select(
        `
        id,
        amount,
        payer_id,
        entry_id,
        ledger_entries!inner(
          id,
          payer_id,
          entry_date,
          type,
          workspace_id
        )
      `
      )
      .eq("workspace_id", workspace_id)
      .eq("id", split_id)
      .maybeSingle();

    if (spErr) return NextResponse.json({ error: spErr.message }, { status: 500 });
    if (!sp) return apiError("split_id 不存在");

    const entry = (sp as any).ledger_entries;
    if (!entry || entry.type !== "expense") return apiError("此 split 不屬於支出（expense）");
    if (String(entry.entry_date || "") < from || String(entry.entry_date || "") > to) {
      return apiError("此 split 不在本期期間內");
    }

    const debtor_id = String((sp as any).payer_id || "");
    const creditor_id = String(entry.payer_id || "");
    const splitAmount = round2(toNum((sp as any).amount));

    if (!debtor_id || !creditor_id) return apiError("split 資料不完整");
    if (debtor_id === creditor_id) return apiError("split debtor/creditor 不可相同");
    if (splitAmount <= 0) return apiError("split amount 異常");

    // 2) 算本期此 split 已結清
    const { data: items, error: itErr } = await supabase
      .from("settlement_items")
      .select(
        `
        amount,
        settlements!inner(
          from_date,
          to_date,
          workspace_id
        )
      `
      )
      .eq("workspace_id", workspace_id)
      .eq("split_id", split_id)
      .eq("settlements.from_date", from)
      .eq("settlements.to_date", to);

    if (itErr) return NextResponse.json({ error: itErr.message }, { status: 500 });

    const settled = round2((items ?? []).reduce((s: number, r: any) => s + round2(toNum(r.amount)), 0));
    const remaining = round2(Math.max(0, splitAmount - settled));
    if (remaining <= 0) return apiError("此 split 已全額結清");
    if (amt > remaining) return apiError(`結清金額不可大於待結清（最多 ${remaining}）`);

    // 3) 建 header
    const { data: header, error: hErr } = await supabase
      .from("settlements")
      .insert([
        {
          workspace_id,
          debtor_id,
          creditor_id,
          amount: amt,
          from_date: from,
          to_date: to,
          note: note ? String(note) : `${from.slice(0, 7)} split 結清`,
          from_payer_id: debtor_id,
          to_payer_id: creditor_id,
        },
      ])
      .select("id")
      .single();

    if (hErr) return NextResponse.json({ error: hErr.message }, { status: 500 });

    // 4) 建 item
    const { error: insErr } = await supabase.from("settlement_items").insert([
      {
        workspace_id,
        settlement_id: header.id,
        split_id,
        amount: amt,
      },
    ]);

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    return NextResponse.json({ success: true, settlement_id: header.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
