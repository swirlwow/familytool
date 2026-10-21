import { createHash } from "node:crypto";
import { CALENDAR_COLORS, calendarPrimaryOwner } from "./calendar-colors";

/** Server-side planner only. No Google writes until a complete source snapshot is available. */
export type CalendarSource = {
  id: string;
  title: string;
  content: string;
  owner: string;
  note_date: string | null;
  date_from: string | null;
  date_to: string | null;
};
export type ManagedEvent = {
  id: string;
  summary: string;
  description: string;
  eventLabelId: string;
  start: { date: string };
  end: { date: string };
  extendedProperties: { private: Record<string, string> };
};
export type RemoteEvent = {
  id: string;
  summary?: string;
  eventLabelId?: string;
  status?: string;
  extendedProperties?: { private?: Record<string, string> };
};
/** Persist this binding only AFTER Google confirms a successful insert/update. */
export type SyncBinding = { sourceId: string; eventId: string };
export type SyncPlan = {
  upsert: ManagedEvent[];
  remove: string[];
  blocked: string[];
};

export function googleEventId(workspaceId: string, sourceId: string): string {
  // Google accepts base32hex; lowercase hex is a valid subset. Stable IDs prevent retry duplicates.
  return "ft" + createHash("sha256").update(JSON.stringify([workspaceId, sourceId])).digest("hex");
}

function checkedDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("INVALID_CALENDAR_DATE");
  const date = new Date(value + "T00:00:00.000Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("INVALID_CALENDAR_DATE");
  }
  return date;
}

export function toManagedEvent(workspaceId: string, row: CalendarSource): ManagedEvent | null {
  const from = row.date_from || row.note_date;
  const to = row.date_to || row.date_from || row.note_date;
  if (!from && !to) return null; // Undated notes are not calendar entries.
  if (!from || !to) throw new Error("INCOMPLETE_CALENDAR_DATE");
  checkedDate(from);
  const end = checkedDate(to);
  if (to < from || to >= "9999-12-31") throw new Error("INVALID_CALENDAR_RANGE");
  end.setUTCDate(end.getUTCDate() + 1); // Google all-day end is exclusive.
  return {
    id: googleEventId(workspaceId, row.id),
    summary: row.title,
    eventLabelId: CALENDAR_COLORS[calendarPrimaryOwner(row.owner)].id,
    description: [row.content, `家庭工具｜${row.owner || "家庭"}`].filter(Boolean).join("\n\n"),
    start: { date: from },
    end: { date: end.toISOString().slice(0, 10) },
    extendedProperties: { private: { app: "familytool", workspaceId, sourceId: row.id } },
  };
}

export function planGoogleCalendarSync(input: {
  workspaceId: string;
  sources: CalendarSource[];
  remote: RemoteEvent[];
  bindings: SyncBinding[];
  sourceComplete: boolean;
  remoteComplete: boolean;
}): SyncPlan {
  if (!input.workspaceId || !input.sourceComplete || !input.remoteComplete) {
    throw new Error("INCOMPLETE_SYNC_SNAPSHOT");
  }
  const sourceIds = new Set<string>();
  const desired = new Map<string, ManagedEvent>();
  for (const row of input.sources) {
    if (!row.id || sourceIds.has(row.id)) throw new Error("DUPLICATE_SOURCE_ID");
    sourceIds.add(row.id);
    const event = toManagedEvent(input.workspaceId, row);
    if (event) desired.set(row.id, event);
  }
  const remote = new Map<string, RemoteEvent>();
  for (const event of input.remote) {
    if (!event.id || remote.has(event.id)) throw new Error("DUPLICATE_REMOTE_ID");
    remote.set(event.id, event);
  }
  const owns = (event: RemoteEvent, sourceId: string) => {
    const props = event.extendedProperties?.private;
    return event.id === googleEventId(input.workspaceId, sourceId)
      && props?.app === "familytool"
      && props.workspaceId === input.workspaceId && props.sourceId === sourceId;
  };
  const plan: SyncPlan = { upsert: [], remove: [], blocked: [] };
  for (const [sourceId, event] of desired) {
    const existing = remote.get(event.id);
    if (existing && !owns(existing, sourceId)) {
      plan.blocked.push(event.id); // Never overwrite an unrelated event or an unverified tombstone.
    } else {
      // Always send the current source fields: edits in Google do not become authoritative.
      plan.upsert.push(event);
    }
  }
  for (const binding of input.bindings) {
    if (desired.has(binding.sourceId)) continue;
    const existing = remote.get(binding.eventId);
    if (!existing || existing.status === "cancelled") continue;
    if (owns(existing, binding.sourceId)) plan.remove.push(existing.id);
    else plan.blocked.push(existing.id);
  }
  plan.remove = [...new Set(plan.remove)];
  plan.blocked = [...new Set(plan.blocked)];
  return plan;
}
