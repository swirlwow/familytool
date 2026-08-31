import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBackupFile } from "./backup-download";
afterEach(() => vi.unstubAllGlobals());
describe("backup download feedback", () => {
  it("preserves a valid backup file", async () => {
    const payload = { format: "familytool-backup", tables: { ledger: [] } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
    expect(JSON.parse(await (await fetchBackupFile("/api/export")).text())).toEqual(payload);
  });
  it("rejects expired-login HTML instead of saving it as a backup", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("login", { headers: { "content-type": "text/html" } })));
    await expect(fetchBackupFile("/api/export")).rejects.toThrow("登入");
  });
  it("rejects API failure and incomplete JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "failed" }, { status: 500 })));
    await expect(fetchBackupFile("/api/export")).rejects.toThrow();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: [] })));
    await expect(fetchBackupFile("/api/export")).rejects.toThrow("不完整");
  });
});
