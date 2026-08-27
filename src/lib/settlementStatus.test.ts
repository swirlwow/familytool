import { describe, expect, it } from "vitest";

import { settlementStatus, settlementStatusLabel } from "./settlementStatus";

describe("settlementStatus", () => {
  it.each([
    [0, 0, "not_applicable"],
    [100, 0, "unsettled"],
    [100, 40, "partial"],
    [100, 100, "settled"],
    [100, 101, "overallocated"],
  ] as const)("maps %s / %s to %s", (split, settled, expected) => {
    expect(settlementStatus(split, settled)).toBe(expected);
  });

  it("uses the configured tolerance around exact settlement", () => {
    expect(settlementStatus(100, 99.996)).toBe("settled");
  });

  it("returns user-facing labels", () => {
    expect(settlementStatusLabel("partial")).toBe("部分結清");
    expect(settlementStatusLabel("overallocated")).toBe("分配異常");
  });
});
