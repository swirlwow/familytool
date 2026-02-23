// src/services/settlement/items.ts
import { round2 } from "@/lib/settlementCalc";
import { r2, toNum } from "./utils";
import {
  getSplitById,
  getSettlementItemsOfSplitInPeriod,
  insertSettlementHeader,
  insertSettlementItems,
} from "./repo";
import { loadSplitLines } from "./summary";

export async function createItemForSplit(params: {
  workspace_id: string;
  from: string;
  to: string;
  split_id: string;
  amount: number;
  note?: string | null;
}) {
  const { workspace_id, from, to, split_id, note } = params;
  const amt = round2(toNum(params.amount));
  if (!amt || amt <= 0) throw new Error("amount 必須大於 0");

  const sp = await getSplitById({ workspace_id, split_id });
  if (!sp) throw new Error("split_id 不存在");

  const entry = (sp as any).ledger_entries;
  if (!entry || entry.type !== "expense") throw new Error("此 split 不屬於支出（expense）");
  if (String(entry.entry_date || "") < from || String(entry.entry_date || "") > to) {
    throw new Error("此 split 不在本期期間內");
  }

  const debtor_id = String((sp as any).payer_id || "");
  const creditor_id = String(entry.payer_id || "");
  const splitAmount = r2((sp as any).amount);

  if (!debtor_id || !creditor_id) throw new Error("split 資料不完整");
  if (debtor_id === creditor_id) throw new Error("split debtor/creditor 不可相同");
  if (splitAmount <= 0) throw new Error("split amount 異常");

  const items = await getSettlementItemsOfSplitInPeriod({ workspace_id, split_id, from, to });
  const settled = r2((items ?? []).reduce((s: number, r: any) => s + r2(r.amount), 0));
  const remaining = r2(Math.max(0, splitAmount - settled));

  if (remaining <= 0) throw new Error("此 split 已全額結清");
  if (amt > remaining) throw new Error(`結清金額不可大於待結清（最多 ${remaining}）`);

  const header = await insertSettlementHeader({
    workspace_id,
    debtor_id,
    creditor_id,
    amount: amt,
    from,
    to,
    note: note ? String(note) : `${from.slice(0, 7)} split 結清`,
  });

  await insertSettlementItems({
    items: [
      {
        workspace_id,
        settlement_id: header.id,
        split_id,
        amount: amt,
      },
    ],
  });

  return { success: true, settlement_id: header.id };
}

export async function createSettlementByDebtorCreditor(params: {
  workspace_id: string;
  from: string;
  to: string;
  debtor_id: string;
  creditor_id: string;
  amount: number;
  note?: string | null;
}) {
  const { workspace_id, from, to, debtor_id, creditor_id, note } = params;
  const amt = round2(toNum(params.amount));
  if (!amt || amt <= 0) throw new Error("amount 必須大於 0");
  if (!debtor_id || !creditor_id) throw new Error("缺少 debtor_id / creditor_id");
  if (debtor_id === creditor_id) throw new Error("debtor_id 不可等於 creditor_id");

  const splitLines = await loadSplitLines({ workspace_id, from, to });
  const candidates = splitLines
    .filter((x) => x.debtor_id === debtor_id && x.creditor_id === creditor_id && x.remaining_amount > 0)
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date));

  const totalRemain = round2(candidates.reduce((s, x) => s + x.remaining_amount, 0));
  if (amt > totalRemain) throw new Error(`結清金額不可大於待結清（最多 ${totalRemain}）`);

  const header = await insertSettlementHeader({
    workspace_id,
    debtor_id,
    creditor_id,
    amount: amt,
    from,
    to,
    note: note ? String(note) : `${from.slice(0, 7)} 拆帳結清`,
  });

  let remain = amt;
  const items: Array<{ workspace_id: string; settlement_id: string; split_id: string; amount: number }> = [];

  for (const c of candidates) {
    if (remain <= 0) break;
    const take = round2(Math.min(remain, c.remaining_amount));
    if (take <= 0) continue;

    items.push({
      workspace_id,
      settlement_id: header.id,
      split_id: c.split_id,
      amount: take,
    });

    remain = round2(remain - take);
  }

  if (remain > 0) throw new Error("分配結清明細失敗（remain > 0）");

  await insertSettlementItems({ items });
  return { success: true, settlement_id: header.id };
}
