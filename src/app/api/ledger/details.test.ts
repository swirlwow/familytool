import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabaseClient", () => ({ supabase: { rpc } }));
import { POST, PATCH } from "./route";

const entry = { workspace_id: "workspace", id: "entry", entry_date: "2026-08-31", type: "expense", amount: 500, merchant: "蝦皮@保冷壺", note: "原始備註", splits: [] };
function request(body: unknown) {
  return new Request("https://example.test/api/ledger", { method: "POST", body: JSON.stringify(body) });
}
beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: "entry", error: null }); });
describe("ledger consumption content API", () => {
  it("creates details atomically while preserving merchant, note and amount", async () => {
    const response = await POST(request({ ...entry, consumption_content: "2500ml 保冷壺" }));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("create_ledger_entry_with_details", expect.objectContaining({
      p_merchant: entry.merchant, p_note: entry.note, p_amount: 500, p_consumption_content: "2500ml 保冷壺", p_splits: [],
    }));
  });
  it("updates and can clear content", async () => {
    await PATCH(request({ ...entry, consumption_content: "" }));
    expect(rpc).toHaveBeenCalledWith("update_ledger_entry_with_details", expect.objectContaining({ p_consumption_content: null }));
  });
  it("keeps old clients from clearing content by omission", async () => {
    await PATCH(request(entry));
    expect(rpc.mock.calls[0][0]).toBe("update_ledger_entry_atomic");
    expect(rpc.mock.calls[0][1]).not.toHaveProperty("p_consumption_content");
  });
  it("rejects invalid content before writing", async () => {
    for (const content of [123, {}, "a".repeat(1001)]) {
      expect((await POST(request({ ...entry, consumption_content: content }))).status).toBe(400);
      expect((await PATCH(request({ ...entry, consumption_content: content }))).status).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
  });
  it("still rejects invalid split allocation", async () => {
    const response = await POST(request({ ...entry, payer_id: "a", splits: [{ payer_id: "b", amount: 600 }], consumption_content: "保冷壺" }));
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
