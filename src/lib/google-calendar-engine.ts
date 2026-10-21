import { googleEventId, toManagedEvent, type CalendarSource, type ManagedEvent, type RemoteEvent } from "./google-calendar-sync";

export type Binding = { eventId: string; generation: number; confirmed: boolean; fingerprint?: string };
export type IntegrationState = {
  version: 1;
  refreshToken?: string;
  googleSub?: string;
  email?: string;
  calendarId?: string;
  calendarCreationPending?: boolean;
  bindings: Record<string, Binding>;
  pending?: { stateHash: string; verifier: string; expires: number };
  lastSync?: string;
};
export type Snapshot = { rows: CalendarSource[]; count: number; revision: string; complete: boolean };
export type GoogleEvent = RemoteEvent & { etag?: string; start?: unknown; end?: unknown; description?: string; recurrence?: string[] };
export interface CalendarGateway {
  createCalendar(): Promise<string>;
  checkCalendar(id: string): Promise<void>;
  get(calendar: string, id: string): Promise<GoogleEvent | null>;
  insert(calendar: string, event: ManagedEvent): Promise<void>;
  update(calendar: string, event: ManagedEvent, etag: string): Promise<void>;
  remove(calendar: string, id: string, etag: string): Promise<void>;
}
export interface SyncStorage {
  snapshot(): Promise<Snapshot>;
  save(state: IntegrationState): Promise<void>;
  guard(): Promise<void>;
}
function snapshotRows(s: Snapshot) {
  if (s.complete !== true || !Array.isArray(s.rows) || s.count !== s.rows.length || !s.revision ||
    new Set(s.rows.map(r => r.id)).size !== s.count) throw new Error("INCOMPLETE_SYNC_SNAPSHOT");
  return s.rows;
}
function owns(event: GoogleEvent, workspace: string, source: string, binding: Binding) {
  const props = event.extendedProperties?.private;
  return event.id === binding.eventId && props?.app === "familytool" && props.workspaceId === workspace && props.sourceId === source;
}
const eventId = (workspace: string, source: string, generation: number) =>
  googleEventId(workspace, source) + (generation ? generation.toString(16) : "");
function same(event: GoogleEvent, desired: ManagedEvent) {
  return event.summary === desired.summary && event.description === desired.description && event.eventLabelId === desired.eventLabelId &&
    JSON.stringify(event.start) === JSON.stringify(desired.start) && JSON.stringify(event.end) === JSON.stringify(desired.end) && !event.recurrence?.length;
}

/** Partial writes are durable and retryable. No deletes after an incomplete upsert phase. */
export async function synchronize(workspace: string, state: IntegrationState, db: SyncStorage, google: CalendarGateway) {
  const original = await db.snapshot();
  const desired = new Map<string, ManagedEvent>();
  for (const row of snapshotRows(original)) {
    const event = toManagedEvent(workspace, row); // Validate ALL dates before any Google write.
    if (event) desired.set(row.id, event);
  }
  if (!state.calendarId) {
    if (state.calendarCreationPending) throw new Error("CALENDAR_CREATION_UNCERTAIN");
    state.calendarCreationPending = true;
    await db.save(state); // Non-idempotent calendar insert must not be blindly retried.
    await db.guard();
    try { state.calendarId = await google.createCalendar(); }
    catch (error) {
      // Explicit auth/validation refusal cannot have created a calendar. Timeouts,
      // ambiguous transport failures and server errors retain the pending guard.
      if (error && typeof error === "object" && "status" in error && [400, 401, 403].includes(Number(error.status))) {
        state.calendarCreationPending = false;
        await db.save(state);
      }
      throw error;
    }
    state.calendarCreationPending = false;
    await db.save(state);
  }
  const calendar = state.calendarId;
  await db.guard();
  await google.checkCalendar(calendar); // A missing calendar must NOT look like missing events.
  const counts = { created: 0, updated: 0, deleted: 0, unchanged: 0 };
  const entries = [...desired];
  // Bound Google requests to four at a time. Persist each batch once, rather than
  // several database round trips per event. No parallel writes to encrypted state.
  for (let offset = 0; offset < entries.length; offset += 4) {
    await db.guard();
    let dirty = false;
    const batch = entries.slice(offset, offset + 4).map(([source, desiredEvent]) => {
      if (!state.bindings[source]) {
        state.bindings[source] = { eventId: eventId(workspace, source, 0), generation: 0, confirmed: false };
        dirty = true;
      }
      return { source, desiredEvent, binding: state.bindings[source], remote: null as GoogleEvent | null, advanced: false };
    });
    if (dirty) await db.save(state); // Reserve ALL stable IDs before any Google insert.
    const reads = await Promise.allSettled(batch.map(item => google.get(calendar, item.binding.eventId)));
    for (let index = 0; index < reads.length; index++) {
      const read = reads[index];
      if (read.status === "rejected") throw read.reason;
      batch[index].remote = read.value;
    }
    dirty = false;
    for (const item of batch) {
      if (item.remote?.status !== "cancelled" && (item.remote || item.binding.fingerprint !== "deleted")) continue;
      if (!item.binding.confirmed) throw new Error("EVENT_OWNERSHIP_CONFLICT");
      item.binding = { eventId: eventId(workspace, item.source, item.binding.generation + 1), generation: item.binding.generation + 1, confirmed: false };
      state.bindings[item.source] = item.binding;
      item.advanced = true;
      dirty = true;
    }
    if (dirty) {
      await db.save(state); // New generations must also be durable before inserts.
      const advanced = batch.filter(item => item.advanced);
      const advancedReads = await Promise.allSettled(advanced.map(item => google.get(calendar, item.binding.eventId)));
      for (let index = 0; index < advancedReads.length; index++) {
        const read = advancedReads[index];
        if (read.status === "rejected") throw read.reason;
        advanced[index].remote = read.value;
      }
    }
    for (const item of batch) {
      if (item.remote && (item.remote.status === "cancelled" || !owns(item.remote, workspace, item.source, item.binding) || !item.remote.etag)) {
        throw new Error("EVENT_OWNERSHIP_CONFLICT");
      }
    }
    await db.guard();
    const results = await Promise.allSettled(batch.map(async item => {
      const event = { ...item.desiredEvent, id: item.binding.eventId };
      if (!item.remote) { await google.insert(calendar, event); return "created" as const; }
      if (same(item.remote, event)) return "unchanged" as const;
      await google.update(calendar, event, item.remote.etag!);
      return "updated" as const;
    }));
    dirty = false;
    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      if (result.status !== "fulfilled") continue;
      counts[result.value]++;
      const binding = batch[index].binding;
      if (!binding.confirmed || binding.fingerprint === "deleted") {
        binding.confirmed = true;
        delete binding.fingerprint;
        dirty = true;
      }
    }
    if (dirty) await db.save(state); // Persist successful siblings even if one request failed.
    const failure = results.find(result => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  }
  // Re-check the full source after the upsert phase, and again before EACH deletion.
  // Concurrent family edits abort this run; the next click reconciles from fresh data.
  for (const [source, binding] of Object.entries(state.bindings)) {
    if (desired.has(source)) continue;
    const fresh = await db.snapshot();
    snapshotRows(fresh);
    if (fresh.revision !== original.revision) throw new Error("SOURCE_CHANGED");
    await db.guard();
    const remote = await google.get(calendar, binding.eventId);
    if (remote && remote.status !== "cancelled") {
      if (!binding.confirmed || !owns(remote, workspace, source, binding) || !remote.etag) throw new Error("EVENT_OWNERSHIP_CONFLICT");
      await db.guard();
      await google.remove(calendar, binding.eventId, remote.etag);
      counts.deleted++;
    }
    // Keep the binding/generation as a tombstone so a restored source cannot reuse a deleted ID.
    binding.fingerprint = "deleted";
    await db.save(state);
  }
  const final = await db.snapshot();
  snapshotRows(final);
  if (final.revision !== original.revision) throw new Error("SOURCE_CHANGED");
  state.lastSync = new Date().toISOString();
  await db.save(state);
  return counts;
}
