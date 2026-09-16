import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ access: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabaseClient", () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }));
vi.mock("@/lib/api/workspaceAccess", () => ({
  assertWorkspaceAccess: mocks.access,
  WorkspaceAccessError: class extends Error { constructor(message: string, public status: number) { super(message); } },
}));
import { POST, PATCH, DELETE } from "./route";
import { WorkspaceAccessError } from "@/lib/api/workspaceAccess";

const id = "11111111-1111-4111-8111-111111111111";
const input = { workspace_id: "workspace", request_key: id, name: "杯子", purchase_date: "2026-09-16", quantity: 1 };
function request(body: unknown) { return new Request("http://localhost/api/purchases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }

describe("purchase API boundaries", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.access.mockResolvedValue("workspace"); mocks.rpc.mockResolvedValue({ data: { id }, error: null }); });
  it("rejects foreign workspace before any mutation", async () => {
    mocks.access.mockRejectedValue(new WorkspaceAccessError("禁止", 403));
    expect((await POST(request(input))).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("records unknown amount and passes a stable idempotency key", async () => {
    expect((await POST(request(input))).status).toBe(201);
    expect(mocks.rpc).toHaveBeenCalledWith("record_shopping_purchase", expect.objectContaining({ p_key: id, p_source: null, p_data: expect.objectContaining({ total_amount: null }) }));
  });
  it("rejects malformed source and date without mutation", async () => {
    expect((await POST(request({ ...input, shopping_item_id: "invalid" }))).status).toBe(400);
    expect((await POST(request({ ...input, purchase_date: "" }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rebuy uses the dedicated operation without requiring a fabricated purchase date", async () => {
    expect((await POST(request({ workspace_id: "workspace", request_key: id, id, action: "rebuy" }))).status).toBe(201);
    expect(mocks.rpc).toHaveBeenCalledWith("rebuy_shopping_purchase", { p_workspace: "workspace", p_key: id, p_id: id });
  });
  it("requires an actual boolean to restore a wishlist item", async () => {
    expect((await DELETE(request({ workspace_id: "workspace", id, restore: "false" }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect((await DELETE(request({ workspace_id: "workspace", id, restore: true }))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("remove_shopping_purchase", { p_workspace: "workspace", p_id: id, p_restore: true });
  });
  it("whitelists edits and preserves legacy unknown dates", async () => {
    const chain = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn(), update: vi.fn(), single: vi.fn() };
    for (const name of ["select", "eq", "is", "update"] as const) chain[name].mockReturnValue(chain);
    chain.maybeSingle.mockResolvedValue({ data: { id, legacy: true }, error: null });
    chain.single.mockResolvedValue({ data: { id }, error: null });
    mocks.from.mockReturnValue(chain);
    expect((await PATCH(request({ ...input, id, purchase_date: "", legacy: false, shopping_item_id: id, deleted_at: "2026-01-01" }))).status).toBe(200);
    const payload = chain.update.mock.calls[0][0];
    expect(payload.purchase_date).toBeNull();
    for (const field of ["legacy", "shopping_item_id", "deleted_at", "workspace_id", "id"]) expect(payload).not.toHaveProperty(field);
  });
});
