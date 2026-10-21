import { CALENDAR_SCOPE } from "@/lib/google-calendar-api";
import { digest, nonce } from "@/lib/google-calendar-crypto";
import { calendarContext, errorReply, privateJson, sameOrigin, STATE_COOKIE } from "@/lib/google-calendar-server";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const context = await calendarContext();
    const locked = await context.lock();
    try {
      const state = await locked.read();
      const value = nonce();
      const verifier = nonce();
      state.pending = { stateHash: digest(value), verifier, expires: Date.now() + 10 * 60000 };
      await locked.storage.save(state);
      context.cookieStore.set(STATE_COOKIE, value, { httpOnly: true, secure: context.config.origin.startsWith("https:"), sameSite: "lax", path: "/api/google-calendar", maxAge: 600 });
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: context.config.clientId, redirect_uri: context.config.redirect, response_type: "code",
        scope: `openid email ${CALENDAR_SCOPE}`, state: value, code_challenge: digest(verifier), code_challenge_method: "S256",
        access_type: "offline", prompt: "consent select_account", ...(state.email ? { login_hint: state.email } : {}),
      }).toString();
      return privateJson({ url: url.toString() });
    } finally { await locked.release(); }
  } catch (error) { return errorReply(error); }
}
