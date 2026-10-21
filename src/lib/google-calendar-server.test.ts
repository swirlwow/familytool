import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({ create: vi.fn(), cookie: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mock.create }));
vi.mock("next/headers", () => ({ cookies: mock.cookie }));
import { calendarContext, sameOrigin } from "./google-calendar-server";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GOOGLE_CALENDAR_CLIENT_ID", "client");
  vi.stubEnv("GOOGLE_CALENDAR_CLIENT_SECRET", "test-only-fake-secret");
  vi.stubEnv("GOOGLE_CALENDAR_REDIRECT_URI", "https://familytool.vercel.app/api/google-calendar/callback");
  vi.stubEnv("NEXT_PUBLIC_WORKSPACE_ID", "workspace");
  mock.cookie.mockResolvedValue({ getAll: () => [], set: vi.fn() });
});
afterEach(() => vi.unstubAllEnvs());
describe("server authorization boundary", () => {
  it("only accepts the configured origin, not a sibling deployment or absent Origin", () => {
    expect(() => sameOrigin(new Request("https://familytool.vercel.app/api/google-calendar/sync", { headers: { Origin: "https://familytool.vercel.app" } }))).not.toThrow();
    for (const origin of ["https://evil.example", "https://familytool-preview.vercel.app", "null", ""]) {
      expect(() => sameOrigin(new Request("https://familytool.vercel.app/api/google-calendar/sync", { headers: { Origin: origin } }))).toThrow("ORIGIN_FORBIDDEN");
    }
    expect(() => sameOrigin(new Request("https://other.example/api/google-calendar/sync", { headers: { Origin: "https://familytool.vercel.app" } }))).toThrow("ORIGIN_FORBIDDEN");
  });
  it("verifies the user with Auth, rejects a missing user before touching data", async () => {
    const from = vi.fn();
    mock.create.mockReturnValue({ auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: null })) }, from });
    await expect(calendarContext()).rejects.toThrow("LOGIN_REQUIRED");
    expect(from).not.toHaveBeenCalled();
  });
  it("checks membership for the authenticated user and server-selected workspace", async () => {
    const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(async () => ({ data: null, error: null })) };
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain);
    const from = vi.fn(() => chain);
    mock.create.mockReturnValue({ auth: { getUser: vi.fn(async () => ({ data: { user: { id: "verified-user" } }, error: null })) }, from });
    await expect(calendarContext()).rejects.toThrow("WORKSPACE_FORBIDDEN");
    expect(from).toHaveBeenCalledExactlyOnceWith("user_workspaces");
    expect(chain.eq.mock.calls).toEqual([["user_id", "verified-user"], ["workspace_id", "workspace"]]);
  });
});
