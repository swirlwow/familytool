// src/services/settlement/summary.ts
import { calcNet, suggestTransfers, round2, type SplitEdge } from "@/lib/settlementCalc";
import { SplitLine } from "./types";
import { r2, toNum } from "./utils";
import {
  getSplitsInRange,
  getSettlementItemsByPeriod,
  getSettledItemsForUI,
  getRecentSettlementHeaders,
} from "./repo";

export async function loadSplitLines(params: { workspace_id: string; from: string; to: string }) {
  const { workspace_id, from, to } = params;

  const splitRows = await getSplitsInRange({ workspace_id, from, to });

  // 只取 expense 且 creditor != debtor
  const rawSplits = (splitRows ?? [])
    .map((r: any) => {
      const e = r.ledger_entries;
      if (!e || e.type !== "expense") return null;

      const split_id = String(r.id || "");
      const entry_id = String(r.entry_id || e.id || "");
      const entry_date = String(e.entry_date || "");
      const creditor_id = String(e.payer_id || "");
      const debtor_id = String(r.payer_id || "");
      const split_amount = round2(toNum(r.amount));

      if (!split_id || !entry_id || !entry_date) return null;
      if (!creditor_id || !debtor_id) return null;
      if (creditor_id === debtor_id) return null;
      if (split_amount <= 0) return null;

      return { split_id, entry_id, entry_date, creditor_id, debtor_id, split_amount };
    })
    .filter(Boolean) as Array<{
    split_id: string;
    entry_id: string;
    entry_date: string;
    creditor_id: string;
    debtor_id: string;
    split_amount: number;
  }>;

  const itemRows = await getSettlementItemsByPeriod({ workspace_id, from, to });

  const settledMap = new Map<string, number>();
  for (const it of itemRows ?? []) {
    const sid = String((it as any).split_id || "");
    const amt = r2((it as any).amount);
    if (!sid || amt <= 0) continue;
    settledMap.set(sid, r2((settledMap.get(sid) ?? 0) + amt));
  }

  const lines: SplitLine[] = rawSplits
    .map((s) => {
      const settled = r2(settledMap.get(s.split_id) ?? 0);
      const remaining = r2(Math.max(0, s.split_amount - settled));
      return {
        split_id: s.split_id,
        entry_id: s.entry_id,
        entry_date: s.entry_date,
        creditor_id: s.creditor_id,
        debtor_id: s.debtor_id,
        split_amount: s.split_amount,
        settled_amount: settled,
        remaining_amount: remaining,
      };
    })
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date));

  return lines;
}

export async function getSettlementSummary(params: { workspace_id: string; from: string; to: string }) {
  const { workspace_id, from, to } = params;

  const splitLines = await loadSplitLines({ workspace_id, from, to });

  const edges: SplitEdge[] = splitLines
    .filter((x) => x.remaining_amount > 0)
    .map((x) => ({
      creditor_id: x.creditor_id,
      debtor_id: x.debtor_id,
      amount: round2(x.remaining_amount),
    }));

  const net = calcNet(edges);
  const suggestions = suggestTransfers(net);

  const settled_items = await getSettledItemsForUI({ workspace_id, from, to });
  const recent_settlements = await getRecentSettlementHeaders({ workspace_id, limit: 10 });

  return { net, suggestions, splits: splitLines, settled_items, recent_settlements };
}
