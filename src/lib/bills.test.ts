import { describe, expect, it } from "vitest";
import { parseBillAmount, billNeedsDetails, billNoPaymentDue, validBillNote } from "./bills";

describe("bill zero-due and notes", () => {
  it("accepts explicit zero and positive amounts but not empty, invalid or negative input", () => {
    for (const value of [0, "0", "0.00"]) expect(parseBillAmount(value)).toBe(0);
    expect(parseBillAmount("123.45")).toBe(123.45);
    for (const value of [null, undefined, "", " ", false, [], {}, "abc", NaN, Infinity, -1, "-0.001", 1e308]) expect(parseBillAmount(value)).toBeNull();
  });
  it("distinguishes missing details, zero due and an actual payment", () => {
    const complete = { amount_due: 0, due_date: "2026-11-09", status: "unpaid" };
    expect(billNeedsDetails(complete)).toBe(false);
    expect(billNoPaymentDue(complete)).toBe(true);
    for (const bill of [{ ...complete, amount_due: null }, { ...complete, due_date: null }, { ...complete, status: "awaiting_details" }]) {
      expect(billNeedsDetails(bill)).toBe(true);
      expect(billNoPaymentDue(bill)).toBe(false);
    }
    expect(billNoPaymentDue({ ...complete, amount_due: 100 })).toBe(false);
  });
  it("allows clearing or multiline notes and bounds their length", () => {
    for (const value of [null, undefined, "", "上期溢繳\n本期免繳", "字".repeat(2000)]) expect(validBillNote(value)).toBe(true);
    for (const value of [123, {}, [], "字".repeat(2001)]) expect(validBillNote(value)).toBe(false);
  });
});
