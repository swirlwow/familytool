import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ access: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), insert: vi.fn(), update: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/lib/supabaseClient", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/lib/api/workspaceAccess", () => ({
  assertWorkspaceAccess: mocks.access,
  WorkspaceAccessError: class extends Error { constructor(message: string, public status: number) { super(message); } },
}));
import { WorkspaceAccessError } from "@/lib/api/workspaceAccess";
import { GET, POST, PATCH } from "./route";
const id = "00000000-0000-4000-8000-000000000001";
function request(body: unknown) { return new Request("https://example.test/api/ledger/merchants", { method: "POST", body: JSON.stringify(body) }); }

beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue("workspace");
  for (const fn of [mocks.from, mocks.select, mocks.eq, mocks.insert, mocks.update]) fn.mockReturnValue(mocks);
  mocks.order.mockResolvedValue({ data: [{ id, name: "蝦皮", is_active: true }], error: null });
  mocks.maybeSingle.mockResolvedValue({ data: { id, name: "蝦皮", is_active: true }, error: null });
});
describe("merchant API", () => {
  it("loads only the authorized workspace", async () => {
    const response = await GET(new Request("https://example.test/api/ledger/merchants?workspace_id=workspace"));
    expect(response.status).toBe(200);
    expect(mocks.access).toHaveBeenCalledWith("workspace");
    expect(mocks.eq).toHaveBeenCalledWith("workspace_id", "workspace");
  });
  it("adds a normalized name without accepting foreign fields", async () => {
    const response = await POST(request({ workspace_id: "workspace", name: "  全聯   福利中心 ", extra: "ignored" }));
    expect(response.status).toBe(201);
    expect(mocks.insert).toHaveBeenCalledWith({ workspace_id: "workspace", name: "全聯 福利中心" });
  });
  it("rejects empty, non-text, or oversized names", async () => {
    for (const name of ["   ", 123, "a".repeat(121)]) {
      expect((await POST(request({ workspace_id: "workspace", name }))).status).toBe(400);
    }
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("reports duplicate names without creating a second item", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { code: "23505" } });
    expect((await POST(request({ workspace_id: "workspace", name: "蝦皮" }))).status).toBe(409);
  });
  it("supports disabling and renaming without touching ledger records", async () => {
    expect((await PATCH(request({ workspace_id: "workspace", id, name: "新名稱", is_active: false }))).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ name: "新名稱", is_active: false });
    expect(mocks.from).toHaveBeenCalledWith("ledger_merchants");
    expect(mocks.eq).toHaveBeenCalledWith("id", id);
  });
  it("does not accept invalid enable-state or empty patches", async () => {
    expect((await PATCH(request({ workspace_id: "workspace", id, is_active: "false" }))).status).toBe(400);
    expect((await PATCH(request({ workspace_id: "workspace", id }))).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("denies non-member access before querying", async () => {
    mocks.access.mockRejectedValue(new WorkspaceAccessError("denied", 403));
    expect((await POST(request({ workspace_id: "other", name: "蝦皮" }))).status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
