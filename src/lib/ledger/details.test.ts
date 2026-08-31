import { describe, expect, it } from "vitest";
import { normalizeMerchantName, validConsumptionContent } from "./details";

describe("ledger details", () => {
  it("normalizes only newly entered merchant names", () => {
    expect(normalizeMerchantName("  全聯   福利中心  ")).toBe("全聯 福利中心");
    expect(normalizeMerchantName("蝦皮@2500ml保冷壺")).toBe("蝦皮@2500ml保冷壺");
  });
  it("allows optional content and caps new text at 1000 characters", () => {
    for (const value of [undefined, null, "", "保冷壺", "a".repeat(1000)]) {
      expect(validConsumptionContent(value)).toBe(true);
    }
    for (const value of [123, {}, [], false, "a".repeat(1001)]) {
      expect(validConsumptionContent(value)).toBe(false);
    }
  });
});
