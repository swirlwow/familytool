import { describe, expect, it } from "vitest";
import { googleEventId, planGoogleCalendarSync, toManagedEvent, type CalendarSource } from "./google-calendar-sync";

const row: CalendarSource = { id: "note-1", title: "家庭行程", content: "內容", owner: "家庭", note_date: "2026-10-21", date_from: null, date_to: null };
const event = toManagedEvent("workspace-1", row)!;
const defaults = { workspaceId: "workspace-1", sources: [row], remote: [], bindings: [], sourceComplete: true, remoteComplete: true };

describe("Google calendar source-authoritative sync planning", () => {
  it("uses stable, Google-compatible IDs and isolates workspaces", () => {
    expect(googleEventId("workspace-1", row.id)).toMatch(/^[0-9a-v]{5,1024}$/);
    expect(googleEventId("workspace-1", row.id)).toBe(event.id);
    expect(googleEventId("workspace-2", row.id)).not.toBe(event.id);
  });
  it("converts inclusive all-day dates to an exclusive end", () => {
    expect(event.end.date).toBe("2026-10-22");
    expect(toManagedEvent("w", { ...row, date_from: "2026-12-30", date_to: "2027-01-02" })!.end.date).toBe("2027-01-03");
  });
  it("handles leap days and does not infer times from titles", () => {
    const value = toManagedEvent("w", { ...row, title: "17:00接孩子", note_date: "2028-02-29" })!;
    expect(value.start).toEqual({ date: "2028-02-29" });
    expect(value.end.date).toBe("2028-03-01");
  });
  it("ignores undated notes", () => {
    expect(toManagedEvent("w", { ...row, note_date: null })).toBeNull();
  });
  it("rejects malformed dates and reversed ranges before making any plan", () => {
    expect(() => toManagedEvent("w", { ...row, note_date: "2026-02-30" })).toThrow();
    expect(() => toManagedEvent("w", { ...row, date_from: "2026-10-22", date_to: "2026-10-21" })).toThrow();
  });
  it("refuses partial month/filter/paginated snapshots", () => {
    expect(() => planGoogleCalendarSync({ ...defaults, sourceComplete: false })).toThrow("INCOMPLETE_SYNC_SNAPSHOT");
    expect(() => planGoogleCalendarSync({ ...defaults, remoteComplete: false })).toThrow("INCOMPLETE_SYNC_SNAPSHOT");
  });
  it("always restores source fields even after Google-side edits", () => {
    expect(planGoogleCalendarSync({ ...defaults, remote: [{ ...event, summary: "edited" }] }).upsert).toEqual([event]);
  });
  it("only deletes a confirmed binding with matching ownership markers", () => {
    expect(planGoogleCalendarSync({ ...defaults, sources: [], remote: [event], bindings: [{ sourceId: row.id, eventId: event.id }] }).remove).toEqual([event.id]);
    expect(planGoogleCalendarSync({ ...defaults, sources: [], remote: [event] }).remove).toEqual([]);
  });
  it("does not touch manual events or another workspace", () => {
    const other = { ...event, extendedProperties: { private: { app: "familytool", workspaceId: "another", sourceId: row.id } } };
    const plan = planGoogleCalendarSync({ ...defaults, sources: [], remote: [other, { id: "manual" }], bindings: [{ sourceId: row.id, eventId: event.id }] });
    expect(plan.remove).toEqual([]);
    expect(plan.blocked).toEqual([event.id]);
  });
  it("blocks an ID collision without matching ownership", () => {
    const plan = planGoogleCalendarSync({ ...defaults, remote: [{ id: event.id }] });
    expect(plan.upsert).toEqual([]);
    expect(plan.blocked).toEqual([event.id]);
  });
  it("does not issue deletes for already cancelled or missing events", () => {
    const bindings = [{ sourceId: row.id, eventId: event.id }];
    expect(planGoogleCalendarSync({ ...defaults, sources: [], remote: [{ ...event, status: "cancelled" }], bindings }).remove).toEqual([]);
    expect(planGoogleCalendarSync({ ...defaults, sources: [], bindings }).remove).toEqual([]);
  });
  it("rejects duplicate source or remote identifiers", () => {
    expect(() => planGoogleCalendarSync({ ...defaults, sources: [row, row] })).toThrow("DUPLICATE_SOURCE_ID");
    expect(() => planGoogleCalendarSync({ ...defaults, remote: [event, event] })).toThrow("DUPLICATE_REMOTE_ID");
  });
});
