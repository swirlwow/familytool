export type LedgerType = "expense" | "income";

export type SplitItem = {
  payer_id?: string | null;
  amount?: number | string | null;
};

export function validateSplits(params: {
  type: LedgerType;
  amount: number;
  payer_id?: string | null;
  splits?: SplitItem[];
}) {
  const { type, amount, payer_id, splits } = params;

  if (!splits || splits.length === 0) return { ok: true as const };

  if (type !== "expense") return { ok: false as const, error: "拆帳目前只支援『支出』" };
  if (!payer_id) return { ok: false as const, error: "拆帳：請先選擇付款人" };

  let sum = 0;
  for (const s of splits) {
    if (!s?.payer_id) return { ok: false as const, error: "拆帳：請選擇應付者" };
    if (s.payer_id === payer_id) return { ok: false as const, error: "拆帳：應付者不可等於付款人" };

    const a = Number((s as any)?.amount);
    if (!a || a <= 0) return { ok: false as const, error: "拆帳：金額需大於 0" };
    sum += a;
  }

  if (sum > Number(amount)) return { ok: false as const, error: "拆帳：應付總和不可大於支出金額" };
  return { ok: true as const };
}
