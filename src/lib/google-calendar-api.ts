import "server-only";
import type { CalendarGateway, GoogleEvent } from "./google-calendar-engine";
import type { ManagedEvent } from "./google-calendar-sync";

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
export function googleConfig() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  const redirect = process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim();
  if (!clientId || !secret || secret.length < 16 || !redirect) throw new Error("GOOGLE_NOT_CONFIGURED");
  const url = new URL(redirect);
  const local = process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((!local && url.protocol !== "https:") || url.pathname !== "/api/google-calendar/callback" || url.search || url.hash || url.username || url.password) throw new Error("GOOGLE_NOT_CONFIGURED");
  return { clientId, secret, redirect, origin: url.origin };
}
export class GoogleError extends Error {
  constructor(public status: number) {
    super(status === 401 ? "GOOGLE_REAUTHORIZE" : status === 403 ? "GOOGLE_PERMISSION" :
      status === 409 || status === 412 ? "GOOGLE_CONFLICT" : status === 429 ? "GOOGLE_RATE_LIMIT" : "GOOGLE_REQUEST_FAILED");
  }
}
export async function tokenRequest(values: Record<string, string>) {
  const config = googleConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(10000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...values, client_id: config.clientId, client_secret: config.secret }),
  });
  if (!response.ok) throw new Error(response.status === 400 || response.status === 401 ? "GOOGLE_REAUTHORIZE" : "GOOGLE_REQUEST_FAILED");
  const data = await response.json() as { access_token?: string; refresh_token?: string; scope?: string };
  if (!data.access_token || ((values.grant_type === "authorization_code" || data.scope !== undefined) && !data.scope?.split(" ").includes(CALENDAR_SCOPE))) throw new Error("GOOGLE_PERMISSION");
  return data as typeof data & { access_token: string };
}
export async function googleIdentity(token: string) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new GoogleError(response.status);
  const data = await response.json() as { sub?: string; email?: string; email_verified?: boolean };
  if (!data.sub || !data.email || !data.email_verified) throw new Error("GOOGLE_PERMISSION");
  return { sub: data.sub, email: data.email };
}
export function calendarGateway(token: string): CalendarGateway {
  const base = "https://www.googleapis.com/calendar/v3/calendars";
  const path = (calendar: string, id?: string) => `${base}/${encodeURIComponent(calendar)}${id === undefined ? "" : `/events/${encodeURIComponent(id)}`}`;
  async function request(url: string, method = "GET", body?: unknown, etag?: string) {
    const response = await fetch(url, {
      method, cache: "no-store", signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(etag ? { "If-Match": etag } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return response;
  }
  async function checked(response: Response) {
    if (!response.ok) throw new GoogleError(response.status);
    return response;
  }
  return {
    async createCalendar() {
      const response = await checked(await request(base, "POST", { summary: "家庭工具", description: "由 FAMILYTOOL 建立與同步；請以家庭工具中的行程為準。", timeZone: "Asia/Taipei" }));
      const data = await response.json() as { id?: string };
      if (!data.id || data.id === "primary") throw new Error("CALENDAR_CREATION_UNCERTAIN");
      return data.id;
    },
    async checkCalendar(id) {
      if (id === "primary") throw new Error("EVENT_OWNERSHIP_CONFLICT");
      const response = await request(path(id));
      if (response.status === 404 || response.status === 410) throw new Error("CALENDAR_MISSING");
      await checked(response);
    },
    async get(calendar, id) {
      const response = await request(path(calendar, id));
      if (response.status === 404) return null;
      if (response.status === 410) return { id, status: "cancelled" };
      await checked(response);
      const data = await response.json() as GoogleEvent;
      if (data.id !== id) throw new Error("EVENT_OWNERSHIP_CONFLICT");
      return data;
    },
    async insert(calendar, event) {
      const response = await checked(await request(`${path(calendar)}/events?sendUpdates=none`, "POST", event));
      const data = await response.json() as GoogleEvent;
      if (data.id !== event.id) throw new Error("EVENT_OWNERSHIP_CONFLICT");
    },
    async update(calendar, event: ManagedEvent, etag) {
      // PUT restores all app-owned event fields, removing Google-side time/recurrence edits.
      await checked(await request(`${path(calendar, event.id)}?sendUpdates=none`, "PUT", { ...event, status: "confirmed" }, etag));
    },
    async remove(calendar, id, etag) {
      const response = await request(`${path(calendar, id)}?sendUpdates=none`, "DELETE", undefined, etag);
      if (response.status !== 404 && response.status !== 410) await checked(response);
    },
  };
}
