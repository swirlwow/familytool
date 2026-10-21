/** Approved Google web palette. Shared by the calendar UI and Google event labels. */
export const CALENDAR_COLORS = {
  家庭: { id: "f147ca1e-0000-4000-8000-000000000001", background: "#b39ddb", name: "紫藤色", className: "bg-[#b39ddb] text-[#202124] border-[#b39ddb]" },
  爸媽: { id: "f147ca1e-0000-4000-8000-000000000002", background: "#f09300", name: "芒果黃", className: "bg-[#f09300] text-[#202124] border-[#f09300]" },
  雅惠: { id: "f147ca1e-0000-4000-8000-000000000003", background: "#e67c73", name: "紅鶴色", className: "bg-[#e67c73] text-[#202124] border-[#e67c73]" },
  昱元: { id: "f147ca1e-0000-4000-8000-000000000004", background: "#039be5", name: "孔雀藍", className: "bg-[#039be5] text-[#202124] border-[#039be5]" },
  子逸: { id: "f147ca1e-0000-4000-8000-000000000005", background: "#7cb342", name: "開心果綠", className: "bg-[#7cb342] text-[#202124] border-[#7cb342]" },
  英茵: { id: "f147ca1e-0000-4000-8000-000000000006", background: "#f6bf26", name: "香蕉黃", className: "bg-[#f6bf26] text-[#202124] border-[#f6bf26]" },
} as const;

export const CALENDAR_OWNERS = Object.keys(CALENDAR_COLORS) as Array<keyof typeof CALENDAR_COLORS>;
export function calendarPrimaryOwner(raw: string | null | undefined): keyof typeof CALENDAR_COLORS {
  const value = String(raw ?? "").trim();
  // Keep the existing first-valid-owner rule, including historical comma-separated values.
  return value.split(value.includes("|") ? "|" : ",").map(owner => owner.trim())
    .find((owner): owner is keyof typeof CALENDAR_COLORS => Object.hasOwn(CALENDAR_COLORS, owner)) || "家庭";
}
export type EventLabel = { id: string; backgroundColor: string; name?: string };
export const CALENDAR_EVENT_LABELS: EventLabel[] = CALENDAR_OWNERS.map(owner => ({
  id: CALENDAR_COLORS[owner].id, backgroundColor: CALENDAR_COLORS[owner].background, name: `家庭工具｜${owner}`,
}));

/** Preserve all unrelated Google labels. Only the six stable app-owned IDs are managed. */
export function mergeCalendarLabels(existing: EventLabel[]): EventLabel[] {
  const owned = new Map(CALENDAR_EVENT_LABELS.map(label => [label.id, label]));
  const result = existing.map(label => owned.get(label.id) || label);
  for (const label of CALENDAR_EVENT_LABELS) if (!existing.some(old => old.id === label.id)) result.push(label);
  if (result.length > 200) throw new Error("CALENDAR_LABEL_LIMIT");
  return result;
}
