import { describe, expect, it } from "vitest";
import { seal, unseal, digest, nonce } from "./google-calendar-crypto";
const secret = "test-only-secret-not-a-real-credential";
describe("encrypted integration state", () => {
  it("roundtrips with randomized IVs and no plaintext tokens", () => {
    const a = seal({ refreshToken: "private-token" }, "user:workspace", secret);
    const b = seal({ refreshToken: "private-token" }, "user:workspace", secret);
    expect(a).not.toBe(b); expect(a).not.toContain("private-token");
    expect(unseal(a, "user:workspace", secret)).toEqual({ refreshToken: "private-token" });
  });
  it("rejects ciphertext from another user/workspace or key", () => {
    const value = seal({ x: 1 }, "a:w", secret);
    expect(() => unseal(value, "b:w", secret)).toThrow("GOOGLE_STATE_UNREADABLE");
    expect(() => unseal(value, "a:z", secret)).toThrow("GOOGLE_STATE_UNREADABLE");
    expect(() => unseal(value, "a:w", secret + "changed")).toThrow("GOOGLE_STATE_UNREADABLE");
  });
  it("rejects tampering and malformed envelopes without leaking payload", () => {
    const value = seal({ x: 1 }, "a:w", secret);
    const parts = value.split("."); parts[3] = "AAAA";
    expect(() => unseal(parts.join("."), "a:w", secret)).toThrow("GOOGLE_STATE_UNREADABLE");
    expect(() => unseal("v0.secret", "a:w", secret)).toThrow("GOOGLE_STATE_UNREADABLE");
  });
  it("generates strong URL-safe state and PKCE values", () => {
    const a = nonce(); expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(nonce()); expect(digest(a)).toHaveLength(43);
  });
});
