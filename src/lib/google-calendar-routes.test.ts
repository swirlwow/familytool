import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({ context: vi.fn(), origin: vi.fn(), token: vi.fn(), identity: vi.fn(), sync: vi.fn() }));
vi.mock("./google-calendar-server", async importOriginal => {
  const real = await importOriginal<typeof import("./google-calendar-server")>();
  return { ...real, calendarContext: mock.context, sameOrigin: mock.origin };
});
vi.mock("./google-calendar-api", async importOriginal => {
  const real = await importOriginal<typeof import("./google-calendar-api")>();
  return { ...real, tokenRequest: mock.token, googleIdentity: mock.identity };
});
vi.mock("./google-calendar-engine", () => ({ synchronize: mock.sync }));
import { POST as connect } from "../app/api/google-calendar/connect/route";
import { GET as callback } from "../app/api/google-calendar/callback/route";
import { GET as status } from "../app/api/google-calendar/status/route";
import { POST as sync } from "../app/api/google-calendar/sync/route";
import { digest } from "./google-calendar-crypto";
import type { IntegrationState } from "./google-calendar-engine";

let state: IntegrationState;
let context: { config: { clientId: string; secret: string; redirect: string; origin: string }; workspace: string; cookieStore: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> }; read: ReturnType<typeof vi.fn>; lock: ReturnType<typeof vi.fn> };
let storage: { save: ReturnType<typeof vi.fn>; guard: ReturnType<typeof vi.fn>; snapshot: ReturnType<typeof vi.fn> };
let release: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GOOGLE_CALENDAR_CLIENT_ID", "client");
  vi.stubEnv("GOOGLE_CALENDAR_CLIENT_SECRET", "test-only-fake-secret");
  vi.stubEnv("GOOGLE_CALENDAR_REDIRECT_URI", "https://familytool.vercel.app/api/google-calendar/callback");
  state = { version: 1, bindings: {} };
  storage = { save: vi.fn(async () => {}), guard: vi.fn(async () => {}), snapshot: vi.fn() };
  release = vi.fn(async () => {});
  context = { config: { clientId: "client", secret: "test-only-fake-secret", redirect: "https://familytool.vercel.app/api/google-calendar/callback", origin: "https://familytool.vercel.app" }, workspace: "workspace", cookieStore: { get: vi.fn(() => ({ value: "state-value" })), set: vi.fn() }, read: vi.fn(async () => state), lock: vi.fn() };
  context.lock.mockResolvedValue({ storage, release, read: context.read });
  mock.context.mockResolvedValue(context); mock.origin.mockImplementation(() => {});
  mock.token.mockResolvedValue({ access_token: "access", refresh_token: "refresh" });
  mock.identity.mockResolvedValue({ sub: "google-user", email: "test@example.com" });
  mock.sync.mockResolvedValue({ created: 1, updated: 2, deleted: 0, unchanged: 3 });
});
afterEach(() => vi.unstubAllEnvs());
const request = () => new Request("https://familytool.vercel.app/api/google-calendar/sync", { method: "POST", headers: { Origin: "https://familytool.vercel.app" } });
const returnRequest = (query = "state=state-value&code=code") => new Request("https://familytool.vercel.app/api/google-calendar/callback?" + query);
function pending() { state.pending = { stateHash: digest("state-value"), verifier: "verifier", expires: Date.now() + 60000 }; }
describe("Google authorization and sync routes", () => {
  it("returns a least-privilege offline PKCE URL and secure state cookie", async () => {
    const response = await connect(request()); const body = await response.json(); const url = new URL(body.url);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("scope")).toBe("openid email https://www.googleapis.com/auth/calendar.app.created");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(body).not.toHaveProperty("secret");
    expect(state.pending!.stateHash).toBe(digest(url.searchParams.get("state")!));
    expect(context.cookieStore.set.mock.calls[0][2]).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", maxAge: 600 });
    expect(release).toHaveBeenCalledOnce();
  });
  it("rejects unauthorized and cross-origin requests before Google writes", async () => {
    mock.origin.mockImplementationOnce(() => { throw new Error("ORIGIN_FORBIDDEN"); });
    expect((await sync(request())).status).toBe(403);
    mock.context.mockRejectedValueOnce(new Error("LOGIN_REQUIRED"));
    expect((await connect(request())).status).toBe(401);
    expect(mock.token).not.toHaveBeenCalled();
    expect(mock.sync).not.toHaveBeenCalled();
  });
  it("fails closed on concurrent lock contention", async () => {
    context.lock.mockRejectedValueOnce(new Error("SYNC_BUSY"));
    expect((await sync(request())).status).toBe(409);
    expect(mock.sync).not.toHaveBeenCalled();
  });
  it("rejects absent/mismatched state and expired authorization", async () => {
    pending();
    let response = await callback(returnRequest("state=wrong&code=code"));
    expect(response.headers.get("location")).toContain("google_calendar=OAUTH_EXPIRED");
    state.pending!.expires = Date.now() - 1;
    response = await callback(returnRequest());
    expect(response.headers.get("location")).toContain("google_calendar=OAUTH_EXPIRED");
    expect(mock.token).not.toHaveBeenCalled();
  });
  it("consumes state once, handles denial, and blocks replay", async () => {
    pending();
    expect((await callback(returnRequest("state=state-value&error=access_denied"))).headers.get("location")).toContain("OAUTH_CANCELLED");
    expect(state.pending).toBeUndefined();
    expect((await callback(returnRequest())).headers.get("location")).toContain("OAUTH_EXPIRED");
    expect(mock.token).not.toHaveBeenCalled();
  });
  it("stores credentials on success but never returns them to the browser", async () => {
    pending();
    const response = await callback(returnRequest("state=state-value&code=code&next=https://evil.example"));
    expect(response.headers.get("location")).toBe("https://familytool.vercel.app/calendar?google_calendar=connected");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(state.refreshToken).toBe("refresh");
    expect(mock.token).toHaveBeenCalledWith(expect.objectContaining({ code_verifier: "verifier" }));
    const body = await (await status()).json();
    expect(body).toEqual({ connected: true, email: "test@example.com", lastSync: null });
    expect(JSON.stringify(body)).not.toContain("refresh");
  });
  it("preserves bindings and rejects accidental switch of Google account", async () => {
    pending(); state.googleSub = "original-user"; state.refreshToken = "original-token"; state.calendarId = "original-calendar";
    const response = await callback(returnRequest());
    expect(response.headers.get("location")).toContain("GOOGLE_ACCOUNT_MISMATCH");
    expect(state.refreshToken).toBe("original-token"); expect(state.calendarId).toBe("original-calendar");
  });
  it("sync uses server-selected workspace and refresh token, never browser payload", async () => {
    state.googleSub = "user"; state.refreshToken = "stored-refresh";
    const response = await sync(new Request(request(), { body: JSON.stringify({ workspace: "attacker", calendar: "primary" }) }));
    expect(response.status).toBe(200);
    expect(mock.token).toHaveBeenCalledWith({ grant_type: "refresh_token", refresh_token: "stored-refresh" });
    expect(mock.sync.mock.calls[0][0]).toBe("workspace");
    expect(await response.json()).toMatchObject({ created: 1, updated: 2, deleted: 0 });
    expect(release).toHaveBeenCalledOnce();
  });
  it("releases lock after refresh failure and returns no raw provider error", async () => {
    state.googleSub = "user"; state.refreshToken = "stored-refresh";
    mock.token.mockRejectedValueOnce(new Error("provider response contains token secret"));
    const response = await sync(request()); const body = await response.text();
    expect(response.status).toBe(400); expect(body).not.toContain("secret");
    expect(release).toHaveBeenCalledOnce(); expect(mock.sync).not.toHaveBeenCalled();
  });
});
