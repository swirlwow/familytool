// src/services/settlement/repo.ts
import { supabase } from "@/lib/supabaseClient";

export async function getSplitsInRange(params: { workspace_id: string; from: string; to: string }) {
  const { workspace_id, from, to } = params;

  const { data, error } = await supabase
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
    .gte("ledger_entries.entry_date", from)
    .lte("ledger_entries.entry_date", to);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSettlementItemsByPeriod(params: { workspace_id: string; from: string; to: string }) {
  const { workspace_id, from, to } = params;

  const { data, error } = await supabase
    .from("settlement_items")
    .select(
      `
      split_id,
      amount,
      settlements!inner(
        id,
        workspace_id,
        from_date,
        to_date
      )
    `
    )
    .eq("workspace_id", workspace_id)
    .eq("settlements.from_date", from)
    .eq("settlements.to_date", to);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSettledItemsForUI(params: { workspace_id: string; from: string; to: string }) {
  const { workspace_id, from, to } = params;

  const { data, error } = await supabase
    .from("settlement_items")
    .select(
      `
      id,
      amount,
      split_id,
      created_at,
      settlements!inner(
        id,
        debtor_id,
        creditor_id,
        amount,
        note,
        created_at,
        from_date,
        to_date
      )
    `
    )
    .eq("workspace_id", workspace_id)
    .eq("settlements.from_date", from)
    .eq("settlements.to_date", to)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getRecentSettlementHeaders(params: { workspace_id: string; limit?: number }) {
  const { workspace_id, limit = 10 } = params;

  const { data, error } = await supabase
    .from("settlements")
    .select("id, debtor_id, creditor_id, amount, note, created_at, from_date, to_date")
    .eq("workspace_id", workspace_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSplitById(params: { workspace_id: string; split_id: string }) {
  const { workspace_id, split_id } = params;

  const { data, error } = await supabase
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

  if (error) throw new Error(error.message);
  return data;
}

export async function getSettlementItemsOfSplitInPeriod(params: {
  workspace_id: string;
  split_id: string;
  from: string;
  to: string;
}) {
  const { workspace_id, split_id, from, to } = params;

  const { data, error } = await supabase
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

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function insertSettlementHeader(params: {
  workspace_id: string;
  debtor_id: string;
  creditor_id: string;
  amount: number;
  from: string;
  to: string;
  note: string;
}) {
  const { workspace_id, debtor_id, creditor_id, amount, from, to, note } = params;

  const { data, error } = await supabase
    .from("settlements")
    .insert([
      {
        workspace_id,
        debtor_id,
        creditor_id,
        amount,
        from_date: from,
        to_date: to,
        note,
        from_payer_id: debtor_id,
        to_payer_id: creditor_id,
      },
    ])
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data; // { id }
}

export async function insertSettlementItems(params: {
  items: Array<{ workspace_id: string; settlement_id: string; split_id: string; amount: number }>;
}) {
  const { items } = params;
  const { error } = await supabase.from("settlement_items").insert(items);
  if (error) throw new Error(error.message);
}

export async function listHistory(params: {
  workspace_id: string;
  fromDate: string;
  toDate: string;
  limit: number;
}) {
  const { workspace_id, fromDate, toDate, limit } = params;

  const { data, error } = await supabase
    .from("settlements")
    .select("id, workspace_id, debtor_id, creditor_id, amount, note, created_at, settled_date, from_date, to_date")
    .eq("workspace_id", workspace_id)
    .gte("settled_date", fromDate)
    .lte("settled_date", toDate)
    .order("settled_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function deleteSettlementHeader(params: { workspace_id: string; id: string }) {
  const { workspace_id, id } = params;

  const { error } = await supabase.from("settlements").delete().eq("workspace_id", workspace_id).eq("id", id);
  if (error) throw new Error(error.message);
}
// 取得單筆 settlement_item（含 settlement_id）
export async function getSettlementItemById(params: { workspace_id: string; id: string }) {
  const { workspace_id, id } = params;

  const { data, error } = await supabase
    .from("settlement_items")
    .select("id, workspace_id, settlement_id, split_id, amount, created_at")
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteSettlementItemById(params: { workspace_id: string; id: string }) {
  const { workspace_id, id } = params;

  const { error } = await supabase
    .from("settlement_items")
    .delete()
    .eq("workspace_id", workspace_id)
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function countSettlementItemsBySettlementId(params: { workspace_id: string; settlement_id: string }) {
  const { workspace_id, settlement_id } = params;

  const { count, error } = await supabase
    .from("settlement_items")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace_id)
    .eq("settlement_id", settlement_id);

  if (error) throw new Error(error.message);
  return count ?? 0;
}
