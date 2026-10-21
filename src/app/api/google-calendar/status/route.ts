import { calendarContext, errorReply, privateJson } from "@/lib/google-calendar-server";
export const runtime = "nodejs";
export async function GET() {
  try {
    const context = await calendarContext();
    const state = await context.read();
    return privateJson({ connected: Boolean(state.refreshToken), email: state.email || null, lastSync: state.lastSync || null });
  } catch (error) { return errorReply(error); }
}
