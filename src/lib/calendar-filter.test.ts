import { describe, expect, it } from "vitest";
import { matchesCalendarOwner, toggleCalendarOwnerFilter } from "./calendar-filter";

describe("calendar owner display filter", () => {
  it("supports any selected person without duplicating shared events", () => {
    const events = ["雅惠", "子逸", "雅惠|子逸", "家庭"];
    expect(events.filter(owner => matchesCalendarOwner(owner, ["雅惠", "子逸"]))).toEqual(["雅惠", "子逸", "雅惠|子逸"]);
    expect(matchesCalendarOwner("家庭", [])).toBe(true);
  });
  it("toggles people independently and returns to all when none remain", () => {
    expect(toggleCalendarOwnerFilter(["雅惠"], "子逸")).toEqual(["雅惠", "子逸"]);
    expect(toggleCalendarOwnerFilter(["雅惠", "子逸"], "雅惠")).toEqual(["子逸"]);
    expect(toggleCalendarOwnerFilter(["子逸"], "子逸")).toEqual([]);
    expect(toggleCalendarOwnerFilter(["雅惠", "子逸"], "all")).toEqual([]);
  });
  it("includes a shared event for every assigned owner", () => {
    expect(matchesCalendarOwner("家庭|爸媽", "家庭")).toBe(true);
    expect(matchesCalendarOwner("家庭|爸媽", "爸媽")).toBe(true);
    expect(matchesCalendarOwner("家庭|爸媽", "昱元")).toBe(false);
    expect(matchesCalendarOwner(" 昱元, 雅惠 ", "雅惠")).toBe(true);
  });
  it("does not automatically add family events to a personal calendar", () => {
    expect(matchesCalendarOwner("家庭", "子逸")).toBe(false);
    expect(matchesCalendarOwner("子逸", "子逸")).toBe(true);
  });
  it("preserves all events under all and treats empty assignments as family", () => {
    expect(matchesCalendarOwner("legacy", "all")).toBe(true);
    expect(matchesCalendarOwner(null, "家庭")).toBe(true);
    expect(matchesCalendarOwner("", "雅惠")).toBe(false);
  });
});
