import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { calendarGateway, CALENDAR_SCOPE, googleConfig, googleIdentity, tokenRequest } from "./google-calendar-api";
import { toManagedEvent } from "./google-calendar-sync";
import { CALENDAR_EVENT_LABELS } from "./calendar-colors";
const mockFetch = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch); mockFetch.mockReset();
  vi.stubEnv("GOOGLE_CALENDAR_CLIENT_ID", "test-client");
  vi.stubEnv("GOOGLE_CALENDAR_CLIENT_SECRET", "test-only-fake-secret");
  vi.stubEnv("GOOGLE_CALENDAR_REDIRECT_URI", "https://familytool.vercel.app/api/google-calendar/callback");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
describe("Google HTTP boundary", () => {
  it("merges labels under the existing scope with ETag and preserves manual labels", async () => {
    const api = calendarGateway("token");
    const manual = { id: "manual", backgroundColor: "#123456", name: "private" };
    mockFetch.mockResolvedValueOnce(json({ id: "secondary", etag: '"calendar-etag"', labelProperties: { eventLabels: [manual] } }))
      .mockResolvedValueOnce(json({ id: "secondary" }));
    await api.checkCalendar("secondary");
    expect(mockFetch.mock.calls[0][0]).toContain("eventLabelVersion=1");
    const request = mockFetch.mock.calls[1][1];
    expect(request.method).toBe("PATCH");
    expect(request.headers["If-Match"]).toBe('"calendar-etag"');
    expect(JSON.parse(request.body).labelProperties.eventLabels).toEqual([manual, ...CALENDAR_EVENT_LABELS]);
  });
  it("does not write unchanged labels or overwrite concurrent label edits", async () => {
    const api = calendarGateway("token");
    mockFetch.mockResolvedValueOnce(json({ id: "secondary", etag: "e", labelProperties: { eventLabels: CALENDAR_EVENT_LABELS } }));
    await api.checkCalendar("secondary");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    mockFetch.mockResolvedValueOnce(json({ id: "secondary", etag: "e" }))
      .mockResolvedValueOnce(new Response(null, { status: 412 }));
    await expect(api.checkCalendar("secondary")).rejects.toThrow("GOOGLE_CONFLICT");
  });
  it("opts event reads and writes into exact label colors instead of legacy color IDs", async () => {
    const api = calendarGateway("token");
    const event = toManagedEvent("w", { id: "a", title: "title", content: "", owner: "爸媽", note_date: "2026-10-21", date_from: null, date_to: null })!;
    mockFetch.mockResolvedValueOnce(json({ ...event, etag: "e" }));
    expect((await api.get("secondary", event.id))!.eventLabelId).toBe(event.eventLabelId);
    mockFetch.mockResolvedValueOnce(json({ id: event.id }));
    await api.insert("secondary", event);
    mockFetch.mockResolvedValueOnce(json({ id: event.id }));
    await api.update("secondary", event, "e");
    for (const [url, request] of mockFetch.mock.calls) {
      expect(url).toContain("eventLabelVersion=1");
      if (request.body) expect(JSON.parse(request.body).eventLabelId).toBe(event.eventLabelId);
    }
  });
  it("rejects missing secrets or unsafe redirect configuration", () => {
    vi.stubEnv("GOOGLE_CALENDAR_REDIRECT_URI", "https://familytool.vercel.app/api/google-calendar/callback?next=evil");
    expect(googleConfig).toThrow("GOOGLE_NOT_CONFIGURED");
    vi.stubEnv("GOOGLE_CALENDAR_CLIENT_SECRET", "");
    expect(googleConfig).toThrow("GOOGLE_NOT_CONFIGURED");
  });
  it("exchanges code with PKCE and server credentials only in POST body", async () => {
    mockFetch.mockResolvedValue(json({ access_token: "token", refresh_token: "refresh", scope: CALENDAR_SCOPE }));
    await tokenRequest({ grant_type: "authorization_code", code: "code", code_verifier: "verifier" });
    const [url, request] = mockFetch.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(request.body.get("code_verifier")).toBe("verifier");
    expect(request.body.get("client_secret")).toBe("test-only-fake-secret");
    expect(request.cache).toBe("no-store");
  });
  it("rejects consent without minimum calendar scope, accepts omitted refresh-response scope", async () => {
    mockFetch.mockResolvedValueOnce(json({ access_token: "token", scope: "openid email" }));
    await expect(tokenRequest({ grant_type: "authorization_code" })).rejects.toThrow("GOOGLE_PERMISSION");
    mockFetch.mockResolvedValueOnce(json({ access_token: "token" }));
    await expect(tokenRequest({ grant_type: "refresh_token" })).resolves.toMatchObject({ access_token: "token" });
  });
  it("returns sanitized errors instead of Google response bodies", async () => {
    mockFetch.mockResolvedValue(json({ error: "invalid_grant", private: "secret-value" }, 400));
    await expect(tokenRequest({ grant_type: "refresh_token" })).rejects.toThrow("GOOGLE_REAUTHORIZE");
  });
  it("validates identity through Google's token-authenticated endpoint", async () => {
    mockFetch.mockResolvedValue(json({ sub: "google-user", email: "example@example.com", email_verified: true }));
    expect(await googleIdentity("token")).toEqual({ sub: "google-user", email: "example@example.com" });
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe("Bearer token");
  });
  it("does not allow primary calendar; missing calendar is not an empty calendar", async () => {
    const api = calendarGateway("token");
    await expect(api.checkCalendar("primary")).rejects.toThrow("EVENT_OWNERSHIP_CONFLICT");
    expect(mockFetch).not.toHaveBeenCalled();
    mockFetch.mockResolvedValue(new Response(null, { status: 404 }));
    await expect(api.checkCalendar("secondary")).rejects.toThrow("CALENDAR_MISSING");
  });
  it("distinguishes missing, deleted and rate-limited events", async () => {
    const api = calendarGateway("token");
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect(await api.get("secondary", "event")).toBeNull();
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 410 }));
    expect(await api.get("secondary", "event")).toEqual({ id: "event", status: "cancelled" });
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 429 }));
    await expect(api.get("secondary", "event")).rejects.toThrow("GOOGLE_RATE_LIMIT");
  });
  it("uses ETags for updates and deletes and never silently ignores conflicts", async () => {
    const api = calendarGateway("token");
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await api.remove("calendar@example.com", "event", '"etag"');
    expect(mockFetch.mock.calls[0][0]).toContain("calendar%40example.com/events/event");
    expect(mockFetch.mock.calls[0][1].headers["If-Match"]).toBe('"etag"');
    const event = toManagedEvent("w", { id: "a", title: "title", content: "", owner: "", note_date: "2026-10-21", date_from: null, date_to: null })!;
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 412 }));
    await expect(api.update("calendar", event, "new-etag")).rejects.toThrow("GOOGLE_CONFLICT");
  });
});
