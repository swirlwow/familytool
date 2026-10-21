import { describe, expect, it, vi } from "vitest";
import { synchronize, type CalendarGateway, type GoogleEvent, type IntegrationState, type SyncStorage } from "./google-calendar-engine";
import { googleEventId, toManagedEvent, type CalendarSource } from "./google-calendar-sync";

const source = (id = "a"): CalendarSource => ({ id, title: "家庭行程", content: "內容", owner: "家庭", note_date: "2026-10-21", date_from: null, date_to: null });
function setup(rows: CalendarSource[] = [source()]) {
  let state: IntegrationState = { version: 1, bindings: {}, calendarId: "app-calendar" };
  let saved = structuredClone(state);
  let revision = "r1";
  const events = new Map<string, GoogleEvent>();
  const db: SyncStorage = {
    snapshot: vi.fn(async () => ({ rows, count: rows.length, revision, complete: true })),
    save: vi.fn(async value => { saved = structuredClone(value); }), guard: vi.fn(async () => {}),
  };
  const google: CalendarGateway = {
    createCalendar: vi.fn(async () => "new-app-calendar"), checkCalendar: vi.fn(async () => {}),
    get: vi.fn(async (_, id) => events.get(id) || null),
    insert: vi.fn(async (_, event) => {
      if (events.has(event.id)) throw new Error("GOOGLE_CONFLICT");
      events.set(event.id, { ...event, etag: "e1" });
    }),
    update: vi.fn(async (_, event) => { events.set(event.id, { ...event, etag: "e2" }); }),
    remove: vi.fn(async (_, id) => { events.set(id, { id, status: "cancelled" }); }),
  };
  function owned(id: string) {
    const event = toManagedEvent("w", source(id))!;
    events.set(event.id, { ...event, etag: "e1" });
    state.bindings[id] = { eventId: event.id, generation: 0, confirmed: true };
    return event.id;
  }
  return { db, google, events, owned, get state() { return state; }, get saved() { return saved; },
    run: () => synchronize("w", state, db, google), restart: () => { state = structuredClone(saved); }, change: () => { revision = "r2"; } };
}
describe("durable one-way Google calendar sync", () => {
  it("updates color-only changes in place and converges without inserts or deletes", async () => {
    const t = setup();
    const id = t.owned("a");
    delete t.events.get(id)!.eventLabelId; // Existing events from before color synchronization.
    expect(await t.run()).toEqual({ created: 0, updated: 1, deleted: 0, unchanged: 0 });
    expect(t.events.get(id)!.eventLabelId).toBe(toManagedEvent("w", source())!.eventLabelId);
    expect(await t.run()).toEqual({ created: 0, updated: 0, deleted: 0, unchanged: 1 });
    expect(t.google.insert).not.toHaveBeenCalled();
    expect(t.google.remove).not.toHaveBeenCalled();
  });
  it("syncs 137 entries with bounded requests and batch persistence", async () => {
    const t = setup(Array.from({ length: 137 }, (_, index) => source(`event-${index}`)));
    let active = 0, maximum = 0;
    vi.mocked(t.google.insert).mockImplementation(async (_, event) => {
      active++; maximum = Math.max(maximum, active);
      await new Promise(resolve => setTimeout(resolve, 1));
      t.events.set(event.id, { ...event, etag: "e1" }); active--;
    });
    expect((await t.run()).created).toBe(137);
    expect(maximum).toBe(4);
    expect(t.db.save).toHaveBeenCalledTimes(71); // 35 reservations + 35 confirmations + final state.
    expect((await t.run()).unchanged).toBe(137);
    expect(t.google.insert).toHaveBeenCalledTimes(137);
  });
  it("saves successful batch siblings before propagating one failure, then resumes without duplicates", async () => {
    const t = setup([source("a"), source("b"), source("c"), source("d")]); t.owned("removed");
    vi.mocked(t.google.insert).mockImplementation(async (_, event) => {
      const sourceId = event.extendedProperties.private.sourceId;
      if (sourceId === "b") throw new Error("temporary quota");
      t.events.set(event.id, { ...event, etag: "e1" });
    });
    await expect(t.run()).rejects.toThrow("temporary quota");
    expect(t.saved.bindings.a.confirmed).toBe(true);
    expect(t.saved.bindings.b.confirmed).toBe(false);
    expect(t.saved.bindings.c.confirmed).toBe(true);
    expect(t.saved.bindings.d.confirmed).toBe(true);
    expect(t.google.remove).not.toHaveBeenCalled();
    t.restart();
    vi.mocked(t.google.insert).mockImplementation(async (_, event) => { t.events.set(event.id, { ...event, etag: "e1" }); });
    expect(await t.run()).toEqual({ created: 1, updated: 0, deleted: 1, unchanged: 3 });
  });
  it("creates all months, repeats without duplicates and restores Google-side edits", async () => {
    const t = setup([source(), { ...source("b"), note_date: "2027-02-01" }]);
    expect(await t.run()).toEqual({ created: 2, updated: 0, deleted: 0, unchanged: 0 });
    expect((await t.run()).unchanged).toBe(2);
    t.events.get(googleEventId("w", "a"))!.summary = "Google edit";
    expect((await t.run()).updated).toBe(1);
    expect(t.events.size).toBe(2);
  });
  it("deletes ONLY durable owned bindings, leaves manual and unrelated events", async () => {
    const t = setup([]);
    const old = t.owned("deleted");
    t.events.set("manual", { id: "manual", summary: "手動" });
    t.events.set(googleEventId("w", "orphan"), { ...toManagedEvent("w", source("orphan"))!, etag: "e" });
    expect((await t.run()).deleted).toBe(1);
    expect(t.google.remove).toHaveBeenCalledExactlyOnceWith("app-calendar", old, "e1");
    expect(t.events.get("manual")!.summary).toBe("手動");
    expect(t.events.get(googleEventId("w", "orphan"))!.status).not.toBe("cancelled");
  });
  it("blocks forged markers and never writes to collisions", async () => {
    const t = setup();
    t.events.set(googleEventId("w", "a"), { id: googleEventId("w", "a"), etag: "e" });
    await expect(t.run()).rejects.toThrow("EVENT_OWNERSHIP_CONFLICT");
    expect(t.google.update).not.toHaveBeenCalled();
    expect(t.google.remove).not.toHaveBeenCalled();
  });
  it("fails closed on wrong-workspace markers during deletion", async () => {
    const t = setup([]); const id = t.owned("a");
    t.events.get(id)!.extendedProperties!.private!.workspaceId = "other";
    await expect(t.run()).rejects.toThrow("EVENT_OWNERSHIP_CONFLICT");
    expect(t.google.remove).not.toHaveBeenCalled();
  });
  it("performs no deletes if any upsert fails", async () => {
    const t = setup(); t.owned("removed");
    vi.mocked(t.google.insert).mockRejectedValueOnce(new Error("rate limit"));
    await expect(t.run()).rejects.toThrow("rate limit");
    expect(t.google.remove).not.toHaveBeenCalled();
    expect((await t.run()).deleted).toBe(1);
  });
  it("recovers ambiguous successful event insertion without duplicate IDs", async () => {
    const t = setup();
    const insert = t.google.insert;
    vi.mocked(t.google.insert).mockImplementationOnce(async (...args) => {
      t.events.set(args[1].id, { ...args[1], etag: "e" });
      throw new Error("timeout after write");
    });
    await expect(t.run()).rejects.toThrow("timeout after write");
    expect(t.saved.bindings.a.confirmed).toBe(false);
    t.restart();
    expect((await t.run()).unchanged).toBe(1);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(t.saved.bindings.a.confirmed).toBe(true);
  });
  it("stops deletions when family source changes during sync", async () => {
    const t = setup(); t.owned("removed");
    vi.mocked(t.google.insert).mockImplementationOnce(async () => { t.change(); });
    await expect(t.run()).rejects.toThrow("SOURCE_CHANGED");
    expect(t.google.remove).not.toHaveBeenCalled();
  });
  it("rejects incomplete snapshot and invalid dates before any Google writes", async () => {
    const t = setup();
    vi.mocked(t.db.snapshot).mockResolvedValueOnce({ rows: [], count: 1, revision: "r", complete: true });
    await expect(t.run()).rejects.toThrow("INCOMPLETE_SYNC_SNAPSHOT");
    expect(t.google.checkCalendar).not.toHaveBeenCalled();
    const invalid = setup([{ ...source(), note_date: "2026-02-30" }]);
    await expect(invalid.run()).rejects.toThrow("INVALID_CALENDAR_DATE");
    expect(invalid.google.insert).not.toHaveBeenCalled();
  });
  it("does not mistake missing calendar for missing events", async () => {
    const t = setup(); vi.mocked(t.google.checkCalendar).mockRejectedValue(new Error("CALENDAR_MISSING"));
    await expect(t.run()).rejects.toThrow("CALENDAR_MISSING");
    expect(t.google.insert).not.toHaveBeenCalled();
    expect(t.google.remove).not.toHaveBeenCalled();
  });
  it("reserves a new generation after confirmed Google deletion", async () => {
    const t = setup(); const id = t.owned("a"); t.events.set(id, { id, status: "cancelled" });
    expect((await t.run()).created).toBe(1);
    expect(t.saved.bindings.a.eventId).toBe(id + "1");
    expect((await t.run()).unchanged).toBe(1);
  });
  it("never trusts an unconfirmed foreign tombstone", async () => {
    const t = setup(); t.events.set(googleEventId("w", "a"), { id: googleEventId("w", "a"), status: "cancelled" });
    await expect(t.run()).rejects.toThrow("EVENT_OWNERSHIP_CONFLICT");
    expect(t.google.insert).not.toHaveBeenCalled();
  });
  it("does not retry non-idempotent calendar creation after an ambiguous result", async () => {
    const t = setup(); delete t.state.calendarId;
    vi.mocked(t.google.createCalendar).mockRejectedValue(new Error("network timeout"));
    await expect(t.run()).rejects.toThrow("network timeout");
    t.restart();
    await expect(t.run()).rejects.toThrow("CALENDAR_CREATION_UNCERTAIN");
    expect(t.google.createCalendar).toHaveBeenCalledTimes(1);
  });
  it("stops before Google mutation after lease loss", async () => {
    const t = setup(); vi.mocked(t.db.guard).mockRejectedValue(new Error("SYNC_BUSY"));
    await expect(t.run()).rejects.toThrow("SYNC_BUSY");
    expect(t.google.insert).not.toHaveBeenCalled();
    expect(t.google.remove).not.toHaveBeenCalled();
  });
  it("propagates ETag conflict and preserves binding for retry", async () => {
    const t = setup([]); t.owned("a");
    vi.mocked(t.google.remove).mockRejectedValue(new Error("GOOGLE_CONFLICT"));
    await expect(t.run()).rejects.toThrow("GOOGLE_CONFLICT");
    expect(t.state.bindings.a).toBeDefined();
    expect(t.state.lastSync).toBeUndefined();
  });
});
