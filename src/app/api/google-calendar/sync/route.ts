import { calendarGateway, tokenRequest } from "@/lib/google-calendar-api";
import { synchronize } from "@/lib/google-calendar-engine";
import { calendarContext, errorReply, privateJson, sameOrigin } from "@/lib/google-calendar-server";
export const runtime = "nodejs";
export const maxDuration = 240;
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const context = await calendarContext();
    const locked = await context.lock();
    try {
      const state = await locked.read();
      if (!state.refreshToken || !state.googleSub) throw new Error("GOOGLE_REAUTHORIZE");
      const tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: state.refreshToken });
      if (tokens.refresh_token) { state.refreshToken = tokens.refresh_token; await locked.storage.save(state); }
      const counts = await synchronize(context.workspace, state, locked.storage, calendarGateway(tokens.access_token));
      return privateJson({ ...counts, lastSync: state.lastSync });
    } finally { await locked.release(); }
  } catch (error) { return errorReply(error); }
}
