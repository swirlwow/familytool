import { describe, expect, it } from "vitest";
import { addCalendarOverflow } from "./calendar-overflow";

describe("hidden calendar events remain accessible", () => {
  const dates = [null, "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", null, null];
  it("includes a hidden multi-day event on every covered date, not just its first day", () => {
    const hidden = new Map<string, { id: string }[]>();
    addCalendarOverflow(hidden, dates, 1, 3, { id: "shared-trip" });
    for (const date of ["2026-11-02", "2026-11-03", "2026-11-04"]) expect(hidden.get(date)).toEqual([{ id: "shared-trip" }]);
    expect(hidden.has("2026-11-05")).toBe(false);
  });
  it("preserves other events without duplicate entries or empty-date keys", () => {
    const hidden = new Map([["2026-11-03", [{ id: "appointment" }]]]);
    addCalendarOverflow(hidden, dates, 0, 3, { id: "trip" });
    addCalendarOverflow(hidden, dates, 1, 3, { id: "trip" });
    expect(hidden.get("2026-11-03")).toEqual([{ id: "appointment" }, { id: "trip" }]);
    expect(hidden.size).toBe(3);
  });
});
