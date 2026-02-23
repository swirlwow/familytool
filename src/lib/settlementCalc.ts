// src/lib/settlementCalc.ts

export type SplitEdge = {
  creditor_id: string; // 付款人（應收）
  debtor_id: string;   // 應付者（欠錢）
  amount: number;
};

export type SettlementRow = {
  debtor_id: string;
  creditor_id: string;
  amount: number;
};

export function round2(n: number) {
  // 避免 0.30000000004
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** 更保險：避免 key split 問題（就算不太可能） */
function keyPair(debtor_id: string, creditor_id: string) {
  return JSON.stringify([debtor_id, creditor_id]);
}
function parseKey(k: string): { debtor_id: string; creditor_id: string } | null {
  try {
    const arr = JSON.parse(k);
    if (!Array.isArray(arr) || arr.length !== 2) return null;
    return { debtor_id: String(arr[0] || ""), creditor_id: String(arr[1] || "") };
  } catch {
    return null;
  }
}

/**
 * 把拆帳邊（誰欠誰多少）減掉已結清（settlements）
 * - edges: 來源是 ledger_splits -> 轉成 debtor->creditor 的欠款邊
 * - settlements: 已結清的 debtor->creditor
 */
export function applySettlements(edges: SplitEdge[], settlements: SettlementRow[]) {
  const m = new Map<string, number>();

  for (const e of edges) {
    if (!e?.debtor_id || !e?.creditor_id) continue;
    const amt = Number(e.amount);
    if (!Number.isFinite(amt) || amt <= 0) continue;

    const k = keyPair(e.debtor_id, e.creditor_id);
    m.set(k, round2((m.get(k) ?? 0) + amt));
  }

  for (const s of settlements) {
    if (!s?.debtor_id || !s?.creditor_id) continue;
    const amt = Number(s.amount);
    if (!Number.isFinite(amt) || amt <= 0) continue;

    const k = keyPair(s.debtor_id, s.creditor_id);
    m.set(k, round2((m.get(k) ?? 0) - amt));
  }

  // 轉回 edges，並濾掉 <=0
  const out: SplitEdge[] = [];
  for (const [k, v] of m.entries()) {
    const amount = round2(v);
    if (amount <= 0) continue;

    const p = parseKey(k);
    if (!p) continue;

    out.push({ debtor_id: p.debtor_id, creditor_id: p.creditor_id, amount });
  }

  // 穩定排序（方便 debug）
  out.sort((a, b) =>
    (a.debtor_id + a.creditor_id).localeCompare(b.debtor_id + b.creditor_id, "en")
  );

  return out;
}

/**
 * 由 edges 計算每個人的淨額：
 * - creditor +amount（應收）
 * - debtor   -amount（應付）
 */
export function calcNet(edges: SplitEdge[]) {
  const net = new Map<string, number>();

  for (const e of edges) {
    const amt = round2(Number(e.amount));
    if (!amt || amt <= 0) continue;

    net.set(e.creditor_id, round2((net.get(e.creditor_id) ?? 0) + amt));
    net.set(e.debtor_id, round2((net.get(e.debtor_id) ?? 0) - amt));
  }

  return Array.from(net.entries())
    .map(([payer_id, amount]) => ({ payer_id, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * 由 net 推出最簡結清建議（greedy）
 * 產出：debtor -> creditor
 */
export function suggestTransfers(netRows: { payer_id: string; amount: number }[]) {
  const creditors = netRows
    .filter((x) => round2(x.amount) > 0)
    .map((x) => ({ payer_id: x.payer_id, amount: round2(x.amount) }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = netRows
    .filter((x) => round2(x.amount) < 0)
    .map((x) => ({ payer_id: x.payer_id, amount: round2(-x.amount) }))
    .sort((a, b) => b.amount - a.amount);

  const out: { debtor_id: string; creditor_id: string; amount: number }[] = [];

  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];

    const amt = round2(Math.min(d.amount, c.amount));
    if (amt > 0) out.push({ debtor_id: d.payer_id, creditor_id: c.payer_id, amount: amt });

    d.amount = round2(d.amount - amt);
    c.amount = round2(c.amount - amt);

    if (d.amount <= 0) i++;
    if (c.amount <= 0) j++;
  }

  return out;
}
