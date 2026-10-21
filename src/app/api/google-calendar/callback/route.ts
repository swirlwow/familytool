import { NextResponse } from "next/server";
import { googleConfig, googleIdentity, tokenRequest } from "@/lib/google-calendar-api";
import { digest } from "@/lib/google-calendar-crypto";
import { calendarContext, errorReply, STATE_COOKIE } from "@/lib/google-calendar-server";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  let result = "connected";
  try {
    const context = await calendarContext();
    const url = new URL(request.url);
    const value = url.searchParams.get("state");
    const cookie = context.cookieStore.get(STATE_COOKIE)?.value;
    context.cookieStore.set(STATE_COOKIE, "", { httpOnly: true, secure: context.config.origin.startsWith("https:"), sameSite: "lax", path: "/api/google-calendar", maxAge: 0 });
    if (!value || value.length > 128 || !cookie || value !== cookie) throw new Error("OAUTH_EXPIRED");
    const locked = await context.lock();
    try {
      const state = await locked.read();
      const pending = state.pending;
      if (!pending || pending.expires < Date.now() || pending.stateHash !== digest(value)) throw new Error("OAUTH_EXPIRED");
      delete state.pending;
      await locked.storage.save(state); // Consume once BEFORE exchanging the code, including denied consent.
      if (url.searchParams.has("error")) throw new Error("OAUTH_CANCELLED");
      const code = url.searchParams.get("code");
      if (!code || code.length > 4096) throw new Error("OAUTH_EXPIRED");
      const tokens = await tokenRequest({ grant_type: "authorization_code", code, code_verifier: pending.verifier, redirect_uri: context.config.redirect });
      const identity = await googleIdentity(tokens.access_token);
      if (state.googleSub && state.googleSub !== identity.sub) throw new Error("GOOGLE_ACCOUNT_MISMATCH");
      if (!tokens.refresh_token && !state.refreshToken) throw new Error("GOOGLE_REAUTHORIZE");
      state.refreshToken = tokens.refresh_token || state.refreshToken;
      state.googleSub = identity.sub;
      state.email = identity.email;
      await locked.storage.save(state);
    } finally { await locked.release(); }
  } catch (error) {
    const safe = await errorReply(error).json();
    result = safe.code;
  }
  // Fixed destination: never honor callback return URLs supplied by the browser.
  try {
    const destination = new URL("/calendar", googleConfig().origin);
    destination.searchParams.set("google_calendar", result);
    const response = NextResponse.redirect(destination, 303);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) { return errorReply(error); }
}
