import { round2 } from "@/lib/settlementCalc";
import { supabase } from "@/lib/supabaseClient";
import { getSplitById } from "./repo";
import { toNum } from "./utils";

async function createSettlement(params: {
  workspace_id: string;
  from: string;
  to: string;
  debtor_id: string;
  creditor_id: string;
  amount: number;
  note: string;
  split_id: string | null;
  request_key: string;
}) {
  const { data, error } = await supabase.rpc("create_settlement_atomic", {
    p_workspace_id: params.workspace_id,
    p_from: params.from,
    p_to: params.to,
    p_debtor_id: params.debtor_id,
    p_creditor_id: params.creditor_id,
    p_amount: params.amount,
    p_note: params.note,
    p_split_id: params.split_id,
    p_request_key: params.request_key,
  });

  if (error) throw error;
  return { success: true, settlement_id: String(data) };
}

export async function createItemForSplit(params: {
  workspace_id: string;
  from: string;
  to: string;
  split_id: string;
  amount: number;
  request_key: string;
  note?: string | null;
}) {
  const { workspace_id, from, to, split_id, request_key, note } = params;
  const amount = round2(toNum(params.amount));
  if (amount <= 0) throw new Error("amount 必須大於 0");
  if (!request_key) throw new Error("缺少 request_key");

  const split = await getSplitById({ workspace_id, split_id });
  if (!split) throw new Error("split_id 不存在");

  const entry = (split as any).ledger_entries;
  if (!entry || entry.type !== "expense") throw new Error("此 split 不屬於支出（expense）");

  const debtor_id = String((split as any).payer_id || "");
  const creditor_id = String(entry.payer_id || "");
  if (!debtor_id || !creditor_id) throw new Error("split 資料不完整");

  return createSettlement({
    workspace_id,
    from,
    to,
    debtor_id,
    creditor_id,
    amount,
    note: note ? String(note) : `${from.slice(0, 7)} split 結清`,
    split_id,
    request_key,
  });
}

export async function createSettlementByDebtorCreditor(params: {
  workspace_id: string;
  from: string;
  to: string;
  debtor_id: string;
  creditor_id: string;
  amount: number;
  request_key: string;
  note?: string | null;
}) {
  const { workspace_id, from, to, debtor_id, creditor_id, request_key, note } = params;
  const amount = round2(toNum(params.amount));
  if (amount <= 0) throw new Error("amount 必須大於 0");
  if (!debtor_id || !creditor_id) throw new Error("缺少 debtor_id / creditor_id");
  if (debtor_id === creditor_id) throw new Error("debtor_id 不可等於 creditor_id");
  if (!request_key) throw new Error("缺少 request_key");

  return createSettlement({
    workspace_id,
    from,
    to,
    debtor_id,
    creditor_id,
    amount,
    note: note ? String(note) : `${from.slice(0, 7)} 拆帳結清`,
    split_id: null,
    request_key,
  });
}
