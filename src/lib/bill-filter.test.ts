import { describe, expect, it } from "vitest";
import { matchesBillFilter } from "./bills";
const base = { name_snapshot: "ABC 信用卡", note: "上期溢繳", amount_due: 500, paid_total: 0, due_date: "2026-10-28", status: "unpaid" };
describe("bill search and status filters", () => {
  it("combines case-insensitive name/note search and status", () => {
    expect(matchesBillFilter(base, " abc ", "overdue", "2026-10-29")).toBe(true);
    expect(matchesBillFilter(base, "溢繳", "unpaid", "2026-10-29")).toBe(true);
    expect(matchesBillFilter(base, "水費", "unpaid", "2026-10-29")).toBe(false);
  });
  it("does not call incomplete, exempt or paid bills overdue", () => {
    for (const bill of [{ ...base, amount_due: null }, { ...base, amount_due: 0 }, { ...base, status: "paid", paid_total: 500 }])
      expect(matchesBillFilter(bill, "", "overdue", "2026-10-29")).toBe(false);
    expect(matchesBillFilter(base, "", "overdue", "2026-10-28")).toBe(false);
  });
  it("distinguishes paid, exempt, incomplete and partial payments", () => {
    expect(matchesBillFilter({ ...base, status: "paid" }, "", "paid", "2026-10-29")).toBe(true);
    expect(matchesBillFilter({ ...base, amount_due: 0 }, "", "no_payment_due", "2026-10-29")).toBe(true);
    expect(matchesBillFilter({ ...base, due_date: null }, "", "awaiting_details", "2026-10-29")).toBe(true);
    const partial = { ...base, status: "partial", paid_total: 200 };
    expect(matchesBillFilter(partial, "", "partial", "2026-10-29")).toBe(true);
    expect(matchesBillFilter(partial, "", "unpaid", "2026-10-29")).toBe(true);
  });
});
