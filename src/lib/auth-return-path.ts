/** Only local application paths may be used as post-login destinations. */
export function safeReturnPath(value: string | null | undefined): string {
  if (!value || value !== value.trim()) return "/";
  let decoded = value;
  for (let round = 0; round < 6; round++) {
    if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\") ||
        [...decoded].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return "/";
    try {
      const url = new URL(decoded, "https://return.invalid");
      if (url.origin !== "https://return.invalid" || url.pathname.startsWith("//")) return "/";
      const next = decodeURIComponent(decoded);
      if (next === decoded) return value;
      decoded = next;
    } catch { return "/"; }
  }
  return "/";
}
