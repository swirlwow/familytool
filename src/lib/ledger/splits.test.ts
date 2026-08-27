import { describe, expect, it } from "vitest";

import { validateSplits } from "./splits";

describe("validateSplits", () => {
  it("allows an expense without splits", () => {
    expect(validateSplits({ type: "expense", amount: 500, payer_id: "payer-a" })).toEqual({ ok: true });
  });

  it("rejects splits on income entries", () => {
    const result = validateSplits({
      type: "income",
      amount: 500,
      payer_id: "payer-a",
      splits: [{ payer_id: "payer-b", amount: 100 }],
    });
    expect(result).toEqual({ ok: false, error: "拆帳目前只支援『支出』" });
  });

  it("rejects the payer as a debtor", () => {
    const result = validateSplits({
      type: "expense",
      amount: 500,
      payer_id: "payer-a",
      splits: [{ payer_id: "payer-a", amount: 100 }],
    });
    expect(result).toEqual({ ok: false, error: "拆帳：應付者不可等於付款人" });
  });

  it("accepts numeric strings and rejects totals above the expense", () => {
    expect(
      validateSplits({
        type: "expense",
        amount: 300,
        payer_id: "payer-a",
        splits: [
          { payer_id: "payer-b", amount: "100.5" },
          { payer_id: "payer-c", amount: "199.5" },
        ],
      })
    ).toEqual({ ok: true });

    expect(
      validateSplits({
        type: "expense",
        amount: 300,
        payer_id: "payer-a",
        splits: [{ payer_id: "payer-b", amount: 300.01 }],
      })
    ).toEqual({ ok: false, error: "拆帳：應付總和不可大於支出金額" });
  });
});
