import { supabase } from "@/lib/supabaseClient";
import {
  settlementStatus,
  settlementStatusLabel,
} from "@/lib/settlementStatus";

function n(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function getSettlementReconciliation(params: {
  workspace_id: string;
  from?: string;
  to?: string;
  settlement_id?: string;
}) {
  const { workspace_id, from, to, settlement_id } = params;

  let settlementQuery = supabase
    .from("settlements")
    .select(
      "id, debtor_id, creditor_id, amount, note, settled_date, created_at, from_date, to_date"
    )
    .eq("workspace_id", workspace_id)
    .order("settled_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (from) settlementQuery = settlementQuery.gte("settled_date", from);
  if (to) settlementQuery = settlementQuery.lte("settled_date", to);
  if (settlement_id) settlementQuery = settlementQuery.eq("id", settlement_id);

  const [
    settlementResult,
    itemResult,
    splitResult,
    payerResult,
    categoryResult,
    paymentMethodResult,
  ] = await Promise.all([
    settlementQuery,
    supabase
      .from("settlement_items")
      .select("id, settlement_id, split_id, amount, created_at")
      .eq("workspace_id", workspace_id),
    supabase
      .from("ledger_splits")
      .select(
        `id, payer_id, amount, entry_id,
         ledger_entries!inner(
           id, entry_date, type, amount, payer_id, merchant, note,
           category_id, pay_method, workspace_id
         )`
      )
      .eq("workspace_id", workspace_id),
    supabase.from("payers").select("id, name").eq("workspace_id", workspace_id),
    supabase
      .from("ledger_categories")
      .select("id, name")
      .eq("workspace_id", workspace_id),
    supabase
      .from("payment_methods")
      .select("id, name")
      .eq("workspace_id", workspace_id),
  ]);

  for (const result of [
    settlementResult,
    itemResult,
    splitResult,
    payerResult,
    categoryResult,
    paymentMethodResult,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  const settlements = (settlementResult.data || []).filter(
    (row: any) => !String(row.note || "").startsWith("[DRAFT]")
  ) as any[];
  const allItems = (itemResult.data || []) as any[];
  const allSplits = (splitResult.data || []) as any[];
  const selectedSettlementIds = new Set(settlements.map((row) => String(row.id)));
  const selectedItems = allItems.filter((item) =>
    selectedSettlementIds.has(String(item.settlement_id))
  );

  const payerNames = new Map(
    (payerResult.data || []).map((row: any) => [String(row.id), String(row.name)])
  );
  const categoryNames = new Map(
    (categoryResult.data || []).map((row: any) => [String(row.id), String(row.name)])
  );
  const paymentMethodNames = new Map(
    (paymentMethodResult.data || []).map((row: any) => [String(row.id), String(row.name)])
  );
  const settlementMap = new Map(settlements.map((row) => [String(row.id), row]));
  const splitMap = new Map(allSplits.map((row) => [String(row.id), row]));

  const allocatedBySplit = new Map<string, number>();
  const itemCountBySplit = new Map<string, number>();
  for (const item of allItems) {
    const splitId = String(item.split_id || "");
    allocatedBySplit.set(
      splitId,
      round2((allocatedBySplit.get(splitId) || 0) + n(item.amount))
    );
    itemCountBySplit.set(splitId, (itemCountBySplit.get(splitId) || 0) + 1);
  }

  const allocatedBySettlement = new Map<string, number>();
  for (const item of selectedItems) {
    const settlementId = String(item.settlement_id || "");
    allocatedBySettlement.set(
      settlementId,
      round2((allocatedBySettlement.get(settlementId) || 0) + n(item.amount))
    );
  }

  const rows = selectedItems.map((item) => {
    const settlement = settlementMap.get(String(item.settlement_id)) || {};
    const split = splitMap.get(String(item.split_id)) || {};
    const entry = split.ledger_entries || {};
    const splitAmount = n(split.amount);
    const totalAllocated = allocatedBySplit.get(String(item.split_id)) || 0;
    const status = settlementStatus(splitAmount, totalAllocated);

    return {
      settlement_id: settlement.id || item.settlement_id,
      settlement_date: settlement.settled_date || "",
      settlement_created_at: settlement.created_at || "",
      debtor_id: settlement.debtor_id || "",
      debtor_name:
        payerNames.get(String(settlement.debtor_id || "")) || settlement.debtor_id || "",
      creditor_id: settlement.creditor_id || "",
      creditor_name:
        payerNames.get(String(settlement.creditor_id || "")) ||
        settlement.creditor_id ||
        "",
      settlement_amount: n(settlement.amount),
      settlement_note: settlement.note || "",
      coverage_from: settlement.from_date || "",
      coverage_to: settlement.to_date || "",
      settlement_item_id: item.id,
      allocated_amount: n(item.amount),
      split_id: split.id || item.split_id,
      split_amount: splitAmount,
      split_total_allocated: totalAllocated,
      split_allocation_count: itemCountBySplit.get(String(item.split_id)) || 0,
      status,
      status_label: settlementStatusLabel(status),
      entry_id: entry.id || split.entry_id || "",
      entry_date: entry.entry_date || "",
      entry_amount: n(entry.amount),
      merchant: entry.merchant || "",
      entry_note: entry.note || "",
      category:
        categoryNames.get(String(entry.category_id || "")) || entry.category_id || "",
      payment_method:
        paymentMethodNames.get(String(entry.pay_method || "")) || entry.pay_method || "",
    };
  });

  const overallocatedSplits = allSplits.filter((split) => {
    const entry = split.ledger_entries || {};
    if (entry.type !== "expense" || split.payer_id === entry.payer_id) return false;
    return settlementStatus(
      n(split.amount),
      allocatedBySplit.get(String(split.id)) || 0
    ) === "overallocated";
  });
  const overallocatedAmount = overallocatedSplits.reduce(
    (sum, split) =>
      sum +
      Math.max(
        0,
        (allocatedBySplit.get(String(split.id)) || 0) - n(split.amount)
      ),
    0
  );

  const headers = settlements.map((settlement) => {
    const allocatedAmount = allocatedBySettlement.get(String(settlement.id)) || 0;
    return {
      ...settlement,
      debtor_name:
        payerNames.get(String(settlement.debtor_id || "")) || settlement.debtor_id,
      creditor_name:
        payerNames.get(String(settlement.creditor_id || "")) || settlement.creditor_id,
      allocated_amount: allocatedAmount,
      unlinked_amount: round2(Math.max(0, n(settlement.amount) - allocatedAmount)),
      item_count: selectedItems.filter(
        (item) => String(item.settlement_id) === String(settlement.id)
      ).length,
    };
  });

  return {
    headers,
    rows,
    diagnostics: {
      overallocated_split_count: overallocatedSplits.length,
      overallocated_amount: round2(overallocatedAmount),
      selected_settlement_amount: round2(
        settlements.reduce((sum, row) => sum + n(row.amount), 0)
      ),
      selected_allocated_amount: round2(
        selectedItems.reduce((sum, row) => sum + n(row.amount), 0)
      ),
    },
  };
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function reconciliationCsv(
  data: Awaited<ReturnType<typeof getSettlementReconciliation>>
) {
  const columns: Array<[string, (row: any) => unknown]> = [
    ["結算日期", (row) => row.settlement_date],
    ["結算批次ID", (row) => row.settlement_id],
    ["欠款人", (row) => row.debtor_name],
    ["收款人", (row) => row.creditor_name],
    ["結算金額", (row) => row.settlement_amount],
    ["本筆分配金額", (row) => row.allocated_amount],
    ["帳務日期", (row) => row.entry_date],
    ["店家", (row) => row.merchant],
    ["帳務備註", (row) => row.entry_note],
    ["分類", (row) => row.category],
    ["付款方式", (row) => row.payment_method],
    ["原拆帳金額", (row) => row.split_amount],
    ["該筆累計分配", (row) => row.split_total_allocated],
    ["分配次數", (row) => row.split_allocation_count],
    ["結清狀態", (row) => row.status_label],
    ["帳務ID", (row) => row.entry_id],
    ["拆帳ID", (row) => row.split_id],
  ];

  const exportRows = [
    ...data.rows,
    ...data.headers
      .filter((header: any) => n(header.unlinked_amount) > 0)
      .map((header: any) => ({
        settlement_id: header.id,
        settlement_date: header.settled_date,
        debtor_name: header.debtor_name,
        creditor_name: header.creditor_name,
        settlement_amount: n(header.amount),
        allocated_amount: n(header.unlinked_amount),
        settlement_note: header.note,
        status_label: "未連結帳務明細",
      })),
  ];

  const lines = [
    columns.map(([label]) => csvCell(label)).join(","),
    ...exportRows.map((row) =>
      columns.map(([, read]) => csvCell(read(row))).join(",")
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}
