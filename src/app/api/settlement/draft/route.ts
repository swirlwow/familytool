// src/app/api/settlement/draft/route.ts
import { NextResponse } from "next/server";
import { apiError, parseJson } from "@/lib/api/http";
import { supabase } from "@/lib/supabaseClient";
import {
  remainingAmount,
  groupByDebtorCreditor,
  calcGroupTotal,
  type SplitRemaining,
  round2,
  toNum,
} from "@/lib/domain/settlement/calc";

const DRAFT_PREFIX = "[DRAFT] ";

export async function POST(req: Request) {
  try {
    const body = await parseJson<Record<string, any>>(req, {});
    const { workspace_id, from, to, replace } = body || {};

    if (!workspace_id) return apiError("缺少 workspace_id");
    if (!from || !to) return apiError("缺少 from/to（YYYY-MM-DD）");

    // 0) 是否先清掉同期間 draft
    if (replace) {
      const { data: drafts, error: dErr } = await supabase
        .from("settlements")
        .select("id,note")
        .eq("workspace_id", workspace_id)
        .eq("from_date", from)
        .eq("to_date", to)
        .like("note", `${DRAFT_PREFIX}%`);

      if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

      const ids = (drafts ?? []).map((r: any) => r.id).filter(Boolean);
      if (ids.length) {
        // 先刪 items，再刪 header（避免 FK）
        const { error: delItemsErr } = await supabase
          .from("settlement_items")
          .delete()
          .eq("workspace_id", workspace_id)
          .in("settlement_id", ids);

        if (delItemsErr) return NextResponse.json({ error: delItemsErr.message }, { status: 500 });

        const { error: delHeadErr } = await supabase
          .from("settlements")
          .delete()
          .eq("workspace_id", workspace_id)
          .in("id", ids);

        if (delHeadErr) return NextResponse.json({ error: delHeadErr.message }, { status: 500 });
      }
    }

    // 1) 撈本期所有 splits（只抓 expense）
    // ledger_splits.payer_id = debtor
    // ledger_entries.payer_id = creditor
    const { data: splits, error: spErr } = await supabase
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
      .eq("ledger_entries.workspace_id", workspace_id)
      .eq("ledger_entries.type", "expense")
      .gte("ledger_entries.entry_date", from)
      .lte("ledger_entries.entry_date", to);

    if (spErr) return NextResponse.json({ error: spErr.message }, { status: 500 });

    const splitRows = (splits ?? []) as any[];

    if (!splitRows.length) {
      return NextResponse.json({ success: true, created: 0, message: "本期沒有可結清的 split" });
    }

    // 2) 查本期已結清（依 split_id 彙總）
    const splitIds = splitRows.map(r => r.id).filter(Boolean);
    const { data: items, error: itErr } = await supabase
      .from("settlement_items")
      .select(
        `
        split_id,
        amount,
        settlements!inner(
          id,
          from_date,
          to_date,
          workspace_id
        )
      `
      )
      .eq("workspace_id", workspace_id)
      .in("split_id", splitIds)
      .eq("settlements.workspace_id", workspace_id)
      .eq("settlements.from_date", from)
      .eq("settlements.to_date", to);

    if (itErr) return NextResponse.json({ error: itErr.message }, { status: 500 });

    const settledMap = new Map<string, number>();
    for (const r of items ?? []) {
      const sid = String((r as any).split_id || "");
      const amt = round2(toNum((r as any).amount));
      if (!sid) continue;
      settledMap.set(sid, round2((settledMap.get(sid) ?? 0) + amt));
    }

    // 3) 算 remaining rows
    const remainRows: SplitRemaining[] = [];
    for (const sp of splitRows) {
      const sid = String(sp.id || "");
      const entry = (sp as any).ledger_entries;
      const debtor_id = String(sp.payer_id || "");
      const creditor_id = String(entry?.payer_id || "");
      const total = round2(toNum(sp.amount));
      const settled = round2(settledMap.get(sid) ?? 0);
      const rem = remainingAmount(total, settled);

      if (!sid || !debtor_id || !creditor_id) continue;
      if (debtor_id === creditor_id) continue;
      if (rem <= 0) continue;

      remainRows.push({
        split_id: sid,
        debtor_id,
        creditor_id,
        amount: rem,
        entry_date: String(entry?.entry_date || ""),
        entry_id: String(entry?.id || ""),
      });
    }

    if (!remainRows.length) {
      return NextResponse.json({ success: true, created: 0, message: "本期 split 皆已結清" });
    }

    // 4) 分組 → 建 draft settlements + items
    const groups = groupByDebtorCreditor(remainRows);

    let created = 0;

    for (const [key, rows] of groups) {
      const [debtor_id, creditor_id] = key.split("__");
      const total = calcGroupTotal(rows);

      // 建 header
      const note = `${DRAFT_PREFIX}${from.slice(0, 7)} 建議結算（${rows.length}筆）`;

      const { data: header, error: hErr } = await supabase
        .from("settlements")
        .insert([
          {
            workspace_id,
            debtor_id,
            creditor_id,
            amount: total,
            from_date: from,
            to_date: to,
            note,
            from_payer_id: debtor_id,
            to_payer_id: creditor_id,
          },
        ])
        .select("id")
        .single();

      if (hErr) return NextResponse.json({ error: hErr.message }, { status: 500 });

      // 建 items（每個 split 一筆）
      const payload = rows.map(r => ({
        workspace_id,
        settlement_id: header.id,
        split_id: r.split_id,
        amount: r.amount,
      }));

      const { error: insErr } = await supabase.from("settlement_items").insert(payload);
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

      created += 1;
    }

    return NextResponse.json({ success: true, created });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
