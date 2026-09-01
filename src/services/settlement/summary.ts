// src/services/settlement/summary.ts
import {
  applySettlements,
  calcNet,
  suggestTransfers,
  round2,
  type SettlementRow,
  type SplitEdge,
} from "@/lib/settlementCalc";
import { SplitLine } from "./types";
import { r2, toNum } from "./utils";
import {
  getSplitsInRange,
  getSettledItemsForUI,
  getRecentSettlementHeaders,
  getSettlementHeadersThroughDate,
} from "./repo";

type SettlementHeader = SettlementRow & {
  note?: string | null;
  settled_date?: string | null;
  created_at?: string | null;
};

function pairKey(debtor_id: string, creditor_id: string) {
  return JSON.stringify([debtor_id, creditor_id]);
}

async function loadSplitLines(params: {
  workspace_id: string;
  from: string;
  to: string;
  settlementRows?: SettlementHeader[];
}) {
  const { workspace_id, from, to } = params;

  const splitRows = await getSplitsInRange({ workspace_id, from, to });
  const settlementRows =
    params.settlementRows ?? (await getSettlementHeadersThroughDate({ workspace_id, to }));

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

  const availableByPair = new Map<string, number>();
  for (const row of settlementRows) {
    const debtor_id = String(row.debtor_id || "");
    const creditor_id = String(row.creditor_id || "");
    const amount = r2(row.amount);
    if (!debtor_id || !creditor_id || amount <= 0) continue;

    const key = pairKey(debtor_id, creditor_id);
    availableByPair.set(key, r2((availableByPair.get(key) ?? 0) + amount));
  }

  const lines: SplitLine[] = rawSplits
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
    .map((s) => {
      const key = pairKey(s.debtor_id, s.creditor_id);
      const available = r2(availableByPair.get(key) ?? 0);
      const settled = r2(Math.min(s.split_amount, available));
      const remaining = r2(Math.max(0, s.split_amount - settled));
      availableByPair.set(key, r2(Math.max(0, available - settled)));

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
    });

  return lines;
}

export async function getSettlementSummary(params: { workspace_id: string; from: string; to: string }) {
  const { workspace_id, from, to } = params;

  const settlementRows = (await getSettlementHeadersThroughDate({
    workspace_id,
    to,
  })) as SettlementHeader[];
  const splitLines = await loadSplitLines({ workspace_id, from, to, settlementRows });

  const edges: SplitEdge[] = splitLines
    .map((x) => ({
      creditor_id: x.creditor_id,
      debtor_id: x.debtor_id,
      amount: round2(x.split_amount),
    }));

  const preSettlementNet = calcNet(edges);
  const preSettlementSuggestions = suggestTransfers(preSettlementNet);
  const adjustedEdges = applySettlements(edges, settlementRows);
  const net = calcNet(adjustedEdges);
  const suggestions = suggestTransfers(net);

  const settled_items = await getSettledItemsForUI({ workspace_id, to });
  const recent_settlements = await getRecentSettlementHeaders({ workspace_id, limit: 10 });
  const splitAmountById = new Map(
    splitLines.map((row) => [row.split_id, r2(row.split_amount)])
  );
  const allocatedBySplit = new Map<string, number>();
  for (const item of settled_items as any[]) {
    const splitId = String(item.split_id || "");
    allocatedBySplit.set(
      splitId,
      r2((allocatedBySplit.get(splitId) || 0) + toNum(item.amount))
    );
  }
  let overallocatedSplitCount = 0;
  let overallocatedAmount = 0;
  for (const [splitId, allocated] of allocatedBySplit) {
    const splitAmount = splitAmountById.get(splitId);
    if (splitAmount !== undefined && allocated > splitAmount + 0.005) {
      overallocatedSplitCount += 1;
      overallocatedAmount += allocated - splitAmount;
    }
  }
  const totals = {
    split_amount: r2(splitLines.reduce((sum, row) => sum + row.split_amount, 0)),
    pre_settlement_amount: r2(
      preSettlementSuggestions.reduce((sum, row) => sum + toNum(row.amount), 0)
    ),
    settled_amount: r2(settlementRows.reduce((sum, row) => sum + toNum(row.amount), 0)),
    remaining_amount: r2(suggestions.reduce((sum, row) => sum + toNum(row.amount), 0)),
  };

  return {
    net,
    suggestions,
    pre_settlement_suggestions: preSettlementSuggestions,
    splits: splitLines,
    settled_items,
    recent_settlements,
    totals,
    diagnostics: {
      overallocated_split_count: overallocatedSplitCount,
      overallocated_amount: r2(overallocatedAmount),
    },
  };
}
