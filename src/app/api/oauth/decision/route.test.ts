import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
  oauth: { getAuthorizationDetails: vi.fn(), approveAuthorization: vi.fn(), denyAuthorization: vi.fn() },
}));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: vi.fn() }) }));
import { POST } from "./route";
const id = "12345678-1234-1234-1234-123456789abc";
const callback = "https://shift.example.test/auth/v1/callback";
const url = "https://family.example.test/api/oauth/decision";
function request(body: unknown = { authorization_id: id, decision: "approve" }, origin = "https://family.example.test") {
  return new Request(url, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks();
  auth.getUser.mockResolvedValue({ data: { user: { id: "synthetic-user" } }, error: null });
  auth.oauth.getAuthorizationDetails.mockResolvedValue({ data: { authorization_id: id, redirect_uri: callback }, error: null });
  auth.oauth.approveAuthorization.mockResolvedValue({ data: { redirect_url: callback + "?code=test" }, error: null });
  auth.oauth.denyAuthorization.mockResolvedValue({ data: { redirect_url: callback + "?error=access_denied" }, error: null });
});
afterEach(() => vi.unstubAllEnvs());
describe("OAuth decision JSON endpoint", () => {
  it("accepts opaque URL-safe Auth authorization identifiers", async () => {
    const opaque = "aB_0123456789-xYz0123456789ABCDE";
    expect((await POST(request({ authorization_id: opaque, decision: "approve" }))).status).toBe(200);
    expect(auth.oauth.getAuthorizationDetails).toHaveBeenCalledWith(opaque);
  });
  it("approves with a no-store JSON response, never a cross-origin form redirect", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ redirect_url: callback + "?code=test" });
    expect(auth.oauth.approveAuthorization).toHaveBeenCalledWith(id, { skipBrowserRedirect: true });
  });
  it("denies without approving", async () => {
    expect((await POST(request({ authorization_id: id, decision: "deny" }))).status).toBe(200);
    expect(auth.oauth.approveAuthorization).not.toHaveBeenCalled();
    expect(auth.oauth.denyAuthorization).toHaveBeenCalled();
  });
  for (const origin of ["https://evil.test", "null", ""]) {
    it("rejects cross-site or absent origin " + origin, async () => {
      expect((await POST(request(undefined, origin))).status).toBe(403);
      expect(auth.getUser).not.toHaveBeenCalled();
    });
  }
  for (const body of [null, {}, { authorization_id: id, decision: "unexpected" }, { authorization_id: id, decision: ["approve"] }, { authorization_id: "bad", decision: "approve" }]) {
    it("rejects invalid body " + JSON.stringify(body), async () => {
      expect((await POST(request(body))).status).toBe(400);
      expect(auth.getUser).not.toHaveBeenCalled();
    });
  }
  it("rejects unauthenticated users", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request())).status).toBe(401);
    expect(auth.oauth.approveAuthorization).not.toHaveBeenCalled();
  });
  it("rejects expired or repeated authorization without approving again", async () => {
    auth.oauth.getAuthorizationDetails.mockResolvedValue({ data: null, error: { message: "not pending" } });
    expect((await POST(request())).status).toBe(409);
    expect(auth.oauth.approveAuthorization).not.toHaveBeenCalled();
  });
  it("rejects unsafe registered callbacks before mutation", async () => {
    auth.oauth.getAuthorizationDetails.mockResolvedValue({ data: { authorization_id: id, redirect_uri: "javascript:bad" }, error: null });
    expect((await POST(request())).status).toBe(400);
    expect(auth.oauth.approveAuthorization).not.toHaveBeenCalled();
  });
  it("does not forward a different callback returned from Auth", async () => {
    auth.oauth.approveAuthorization.mockResolvedValue({ data: { redirect_url: "https://evil.test/" }, error: null });
    expect((await POST(request())).status).toBe(400);
  });
});
