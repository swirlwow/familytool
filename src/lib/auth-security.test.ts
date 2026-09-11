import { describe, expect, it } from "vitest";
import { safeReturnPath } from "./auth-return-path";
import { validatedOAuthRedirect } from "./oauth-decision";

describe("local return paths", () => {
  for (const value of ["/", "/settings", "/records?month=2026-09", "/oauth/consent?authorization_id=abc", "/calendar#today"]) {
    it("preserves " + value, () => expect(safeReturnPath(value)).toBe(value));
  }
  for (const value of [null, "", "https://evil.test", "//evil.test", "/\\evil.test", "/%5cevil.test",
    "/%2fevil.test", "/%252fevil.test", "/%255cevil.test", "/%0a/evil.test", " /settings", "/bad%", "/a/..//evil.test",
    "/" + String.fromCharCode(9) + "/evil.test", "javascript:alert(1)"]) {
    it("rejects " + JSON.stringify(value), () => expect(safeReturnPath(value)).toBe("/"));
  }
});

describe("registered OAuth callback binding", () => {
  const registered = "https://shift.example.test/auth/v1/callback";
  it("allows authorization code and denial responses", () => {
    expect(validatedOAuthRedirect(registered + "?code=test&state=state", registered)).toBe(registered + "?code=test&state=state");
    expect(validatedOAuthRedirect(registered + "?error=access_denied", registered)).toBe(registered + "?error=access_denied");
  });
  for (const result of ["https://evil.test/auth/v1/callback", "https://shift.example.test/other",
    "https://user@shift.example.test/auth/v1/callback", registered + "#token",
    "javascript:alert(1)", "http://shift.example.test/auth/v1/callback", registered.replace("https://", "https:\\")]) {
    it("rejects mismatched or unsafe " + result, () => expect(validatedOAuthRedirect(result, registered)).toBeNull());
  }
  it("allows loopback only in the explicit development case", () => {
    expect(validatedOAuthRedirect("http://127.0.0.1:55325/callback?code=test", "http://127.0.0.1:55325/callback")).toBeNull();
    expect(validatedOAuthRedirect("http://127.0.0.1:55325/callback?code=test", "http://127.0.0.1:55325/callback", true)).not.toBeNull();
    expect(validatedOAuthRedirect("http://evil.test/callback", "http://evil.test/callback", true)).toBeNull();
  });
  it("preserves registered callback query parameters", () => {
    expect(validatedOAuthRedirect(registered + "?app=shift&code=test", registered + "?app=shift")).not.toBeNull();
    expect(validatedOAuthRedirect(registered + "?app=other&code=test", registered + "?app=shift")).toBeNull();
  });
});
