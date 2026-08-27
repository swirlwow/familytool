import { describe, expect, it } from "vitest";

import {
  calcGroupTotal,
  groupByDebtorCreditor,
  remainingAmount,
  round2,
  sumAmounts,
  toNum,
  type SplitRemaining,
} from "./calc";

describe("settlement calculations", () => {
  it("normalizes invalid values and rounds money to two decimals", () => {
    expect(toNum("12.3")).toBe(12.3);
    expect(toNum("not-a-number")).toBe(0);
    expect(round2(10.005)).toBe(10.01);
    expect(sumAmounts([{ amount: "10.005" }, { amount: 1.335 }, {}])).toBe(11.35);
  });

  it("never returns a negative remaining amount", () => {
    expect(remainingAmount(100, 35.25)).toBe(64.75);
    expect(remainingAmount(100, 120)).toBe(0);
  });

  it("groups debts by debtor and creditor", () => {
    const rows: SplitRemaining[] = [
      { split_id: "1", debtor_id: "a", creditor_id: "b", amount: 20 },
      { split_id: "2", debtor_id: "a", creditor_id: "b", amount: 30.5 },
      { split_id: "3", debtor_id: "c", creditor_id: "b", amount: 10 },
    ];
    const groups = groupByDebtorCreditor(rows);
    expect(groups.size).toBe(2);
    expect(calcGroupTotal(groups.get("a__b") ?? [])).toBe(50.5);
  });
});
