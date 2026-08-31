import { describe, expect, it } from "vitest";
import { choiceOptions, collapsedChoices } from "./choice-layout";

describe("ledger single choices", () => {
  it("keeps managed ordering, deduplicates and provides an empty choice", () => {
    expect(choiceOptions([{ value: "b", label: "B" }, { value: "a", label: "A" }, { value: "b", label: "B" }], "")).toEqual([
      { value: "", label: "不選" }, { value: "b", label: "B" }, { value: "a", label: "A" },
    ]);
  });
  it("retains a historical selection absent from active options", () => {
    expect(choiceOptions([], "旧店家")).toEqual([{ value: "", label: "不選" }, { value: "旧店家", label: "保留原值：旧店家" }]);
  });
  it("only includes two actual rows, not a fixed item count", () => {
    expect(collapsedChoices([{ top: 0, height: 40 }, { top: 0, height: 40 }, { top: 46, height: 60 }, { top: 112, height: 40 }])).toEqual({ count: 3, height: 106 });
  });
  it("handles a single row and empty option sets", () => {
    expect(collapsedChoices([{ top: 0, height: 44 }])).toEqual({ count: 1, height: 44 });
    expect(collapsedChoices([])).toEqual({ count: 0, height: 0 });
  });
});
