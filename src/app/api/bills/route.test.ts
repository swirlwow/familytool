import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabaseClient", () => ({ supabase: mocks }));
import { POST, PATCH } from "./route";
const input = { workspace_id: "workspace", id: "bill", period: "2026-11", name_snapshot: "測試信用卡", due_date: "2026-11-09", amount_due: 0 };
const request = (body: unknown) => new Request("http://localhost/api/bills", { method: "POST", body: JSON.stringify(body) });
let chain: Record<string, ReturnType<typeof vi.fn>>;
beforeEach(() => {
  vi.resetAllMocks();
  chain = Object.fromEntries(["select", "eq", "insert", "update", "single"].map(key => [key, vi.fn()]));
  for (const key of ["select", "eq", "insert", "update"]) chain[key].mockReturnValue(chain);
  chain.single.mockResolvedValue({ data: { id: "bill", amount_due: null, due_date: null, status: "awaiting_details" }, error: null });
  mocks.from.mockReturnValue(chain);
});
describe("bill API zero amount and bill-only notes", () => {
  it("creates explicit zero without calling any payment RPC", async () => {
    expect((await POST(request({ ...input, note: " 上期溢繳，本期免繳 " }))).status).toBe(200);
    expect(chain.insert).toHaveBeenCalledWith([expect.objectContaining({ amount_due: 0, note: "上期溢繳，本期免繳", paid_total: 0, status: "unpaid" })]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("completes a variable bill with zero and keeps payment fields unchanged", async () => {
    expect((await PATCH(request({ ...input, note: "本期免繳" }))).status).toBe(200);
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ amount_due: 0, status: "unpaid", note: "本期免繳" }));
    expect(chain.update.mock.calls[0][0]).not.toHaveProperty("paid_total");
    expect(chain.update.mock.calls[0][0]).not.toHaveProperty("paid_at");
    expect(chain.eq).toHaveBeenCalledWith("workspace_id", "workspace");
    expect(chain.eq).toHaveBeenCalledWith("id", "bill");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects blank, negative, null and invalid amounts instead of treating them as zero", async () => {
    for (const amount_due of ["", " ", null, "abc", -1, false, [], {}]) {
      expect((await POST(request({ ...input, amount_due }))).status).toBe(400);
      expect((await PATCH(request({ ...input, amount_due }))).status).toBe(400);
    }
    expect(chain.insert).not.toHaveBeenCalled(); expect(chain.update).not.toHaveBeenCalled();
  });
  it("preserves omitted notes, clears explicit empty notes, and supports note-only edits", async () => {
    await PATCH(request(input));
    expect(chain.update.mock.calls[0][0]).not.toHaveProperty("note");
    await PATCH(request({ workspace_id: "workspace", id: "bill", note: "" }));
    expect(chain.update.mock.calls[1][0]).toEqual({ note: null });
    await PATCH(request({ workspace_id: "workspace", id: "bill", note: "應繳資訊\n未繳資訊" }));
    expect(chain.update.mock.calls[2][0]).toEqual({ note: "應繳資訊\n未繳資訊" });
  });
  it("rejects malformed notes and attempts to change payment status", async () => {
    for (const note of [123, {}, "x".repeat(2001)]) {
      expect((await POST(request({ ...input, note }))).status).toBe(400);
      expect((await PATCH(request({ ...input, note }))).status).toBe(400);
    }
    for (const field of [{ status: "paid" }, { paid_total: 100 }]) expect((await PATCH(request({ ...input, ...field }))).status).toBe(400);
    expect(chain.update).not.toHaveBeenCalled();
  });
  it("edits paid bill notes without changing settled amounts, dates or status", async () => {
    chain.single.mockResolvedValue({ data: { id: "bill", amount_due: 500, due_date: "2026-11-08", status: "paid" }, error: null });
    expect((await PATCH(request({ workspace_id: "workspace", id: "bill", note: "已繳確認" }))).status).toBe(200);
    expect(chain.update).toHaveBeenCalledWith({ note: "已繳確認" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("keeps zero payments rejected and does not mark zero-due bills paid", async () => {
    expect((await POST(request({ ...input, action: "pay_to_ledger", bill_instance_id: "bill", pay_amount: 0, entry_date: "2026-11-09", payer_id: "payer", request_key: "key" }))).status).toBe(400);
    chain.single.mockResolvedValue({ data: { id: "bill", amount_due: 0, payment_mode: "status_only", status: "unpaid" }, error: null });
    expect((await POST(request({ ...input, action: "mark_paid", bill_instance_id: "bill" }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(chain.update).not.toHaveBeenCalled();
  });
  it("rejects direct edits to every paid bill field except note", async () => {
    chain.single.mockResolvedValue({ data: { amount_due: 500, due_date: "2026-11-08", status: "paid" }, error: null });
    for (const change of [{ amount_due: 0 }, { due_date: "2026-12-01" }, { billing_start: null }, { billing_end: null }, { name_snapshot: "changed" }, { paid_at: null }, { status: "unpaid" }, { paid_total: 0 }]) {
      expect((await PATCH(request({ workspace_id: "workspace", id: "bill", note: "不得部分寫入", ...change }))).status).toBe(400);
    }
    expect(chain.update).not.toHaveBeenCalled();
  });
  it("guards updates against a payment completing after the initial read", async () => {
    await PATCH(request(input));
    expect(chain.eq).toHaveBeenCalledWith("status", "awaiting_details");
  });
  it("does not claim success if an update affected no bill", async () => {
    chain.single.mockResolvedValueOnce({ data: { amount_due: 0, due_date: "2026-11-09", status: "unpaid" }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    expect((await PATCH(request(input))).status).toBe(400);
  });
});
