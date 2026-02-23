// src/lib/domain/settlement/calc.ts
export function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function sumAmounts(rows: Array<{ amount?: any }>) {
  return round2((rows ?? []).reduce((s, r) => s + round2(toNum(r.amount)), 0));
}

export function remainingAmount(total: any, settled: any) {
  const t = round2(toNum(total));
  const s = round2(toNum(settled));
  return round2(Math.max(0, t - s));
}

export type SplitRemaining = {
  split_id: string;
  debtor_id: string;   // split.payer_id
  creditor_id: string; // entry.payer_id
  amount: number;      // remaining
  entry_date?: string;
  entry_id?: string;
};

export type GroupKey = `${string}__${string}`;

export function groupByDebtorCreditor(rows: SplitRemaining[]) {
  const map = new Map<GroupKey, SplitRemaining[]>();
  for (const r of rows) {
    const key = `${r.debtor_id}__${r.creditor_id}` as GroupKey;
    const arr = map.get(key) ?? [];
    arr.push(r);
    map.set(key, arr);
  }
  return map;
}

export function calcGroupTotal(rows: SplitRemaining[]) {
  return sumAmounts(rows.map(r => ({ amount: r.amount })));
}
