/** Match the exact registered callback, not a client-supplied return URL. */
export function validatedOAuthRedirect(value: string, registered: string, allowLoopback = false): string | null {
  try {
    if ([value, registered].some(text => text.includes("\\") || [...text].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127))) return null;
    const result = new URL(value);
    const expected = new URL(registered);
    const allowedProtocol = (url: URL) => url.protocol === "https:" ||
      (allowLoopback && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
    if (!allowedProtocol(result) || !allowedProtocol(expected) || result.username || result.password ||
        expected.username || expected.password || result.hash || expected.hash ||
        result.origin !== expected.origin || result.pathname !== expected.pathname) return null;
    for (const [key, val] of expected.searchParams) {
      if (result.searchParams.getAll(key).length !== expected.searchParams.getAll(key).length ||
          !result.searchParams.getAll(key).includes(val)) return null;
    }
    return result.toString();
  } catch { return null; }
}
