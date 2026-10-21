import { describe, expect, it } from "vitest";
import { CALENDAR_COLORS, CALENDAR_EVENT_LABELS, calendarPrimaryOwner, mergeCalendarLabels } from "./calendar-colors";
import { toManagedEvent } from "./google-calendar-sync";

describe("approved Google calendar palette", () => {
  it("uses the exact six approved colors and high-contrast dark text", () => {
    expect(Object.values(CALENDAR_COLORS).map(color => color.background)).toEqual([
      "#b39ddb", "#f09300", "#e67c73", "#039be5", "#7cb342", "#f6bf26",
    ]);
    for (const color of Object.values(CALENDAR_COLORS)) {
      expect(color.className).toContain(`bg-[${color.background}]`);
      expect(color.className).toContain("text-[#202124]");
      const luminance = (hex: string) => {
        const rgb = hex.slice(1).match(/../g)!.map(value => parseInt(value, 16) / 255)
          .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
      };
      expect((luminance(color.background) + .05) / (luminance("#202124") + .05)).toBeGreaterThanOrEqual(4.5);
    }
    expect(new Set(CALENDAR_EVENT_LABELS.map(label => label.id)).size).toBe(6);
  });
  it("keeps first valid owner ordering, legacy comma data and family fallback", () => {
    expect(calendarPrimaryOwner(" 不存在 | 子逸 | 雅惠 ")).toBe("子逸");
    expect(calendarPrimaryOwner("昱元,雅惠")).toBe("昱元");
    expect(calendarPrimaryOwner("__proto__")).toBe("家庭");
    expect(calendarPrimaryOwner(null)).toBe("家庭");
    const event = toManagedEvent("w", { id: "a", title: "title", content: "", owner: " 子逸 | 雅惠", note_date: "2026-10-21", date_from: null, date_to: null })!;
    expect(event.eventLabelId).toBe(CALENDAR_COLORS.子逸.id);
  });
  it("preserves unrelated labels and is idempotent without mutating input", () => {
    const manual = { id: "manual", backgroundColor: "#123456", name: "私人" };
    const original = [manual, { ...CALENDAR_EVENT_LABELS[0], backgroundColor: "#ffffff" }];
    const result = mergeCalendarLabels(original);
    expect(result[0]).toEqual(manual);
    expect(result).toHaveLength(7);
    expect(result[1]).toEqual(CALENDAR_EVENT_LABELS[0]);
    expect(original[1].backgroundColor).toBe("#ffffff");
    expect(mergeCalendarLabels(result)).toEqual(result);
    expect(() => mergeCalendarLabels(Array.from({ length: 200 }, (_, i) => ({ id: String(i), backgroundColor: "#123456" })))).toThrow("CALENDAR_LABEL_LIMIT");
  });
});
