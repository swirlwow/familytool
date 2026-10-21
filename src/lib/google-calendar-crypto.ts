import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";

// A distinct HKDF key is derived for this feature; rotating the OAuth client secret
// requires migrating ciphertext with the old key before rotation. Never log tokens.
function key(secret: string) {
  if (secret.length < 16) throw new Error("GOOGLE_NOT_CONFIGURED");
  return Buffer.from(hkdfSync("sha256", secret, "familytool-google-calendar-v1", "encrypted-integration-state", 32));
}
export function seal(value: unknown, context: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}
export function unseal<T>(value: string, context: string, secret: string): T {
  try {
    const [version, iv, tag, data, extra] = value.split(".");
    if (version !== "v1" || extra || !iv || !tag || !data) throw new Error();
    const cipher = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(iv, "base64url"));
    cipher.setAAD(Buffer.from(context));
    cipher.setAuthTag(Buffer.from(tag, "base64url"));
    return JSON.parse(Buffer.concat([cipher.update(Buffer.from(data, "base64url")), cipher.final()]).toString("utf8"));
  } catch { throw new Error("GOOGLE_STATE_UNREADABLE"); }
}
export const digest = (value: string) => createHash("sha256").update(value).digest("base64url");
export const nonce = () => randomBytes(32).toString("base64url");
