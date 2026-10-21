import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { googleConfig } from "./google-calendar-api";
import { seal, unseal } from "./google-calendar-crypto";
import type { IntegrationState, Snapshot, SyncStorage } from "./google-calendar-engine";

export const STATE_COOKIE = "ft_google_calendar_state";
export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== googleConfig().origin || new URL(request.url).origin !== googleConfig().origin) throw new Error("ORIGIN_FORBIDDEN");
}
export async function calendarContext() {
  const cookieStore = await cookies();
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: values => values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error("LOGIN_REQUIRED");
  const userId = user.id;
  const workspace = process.env.NEXT_PUBLIC_WORKSPACE_ID;
  if (!workspace) throw new Error("WORKSPACE_FORBIDDEN");
  const member = await client.from("user_workspaces").select("workspace_id").eq("user_id", user.id).eq("workspace_id", workspace).maybeSingle();
  if (member.error || !member.data) throw new Error("WORKSPACE_FORBIDDEN");
  const context = `${user.id}:${workspace}`;
  const config = googleConfig();
  const query = () => client.from("google_calendar_connections");
  const own = () => query().select("ciphertext,lock_token,lock_until").eq("user_id", user.id).eq("workspace_id", workspace);
  async function read() {
    const result = await own().maybeSingle();
    if (result.error) throw new Error("GOOGLE_STORAGE_UNAVAILABLE");
    const state = result.data?.ciphertext ? unseal<IntegrationState>(result.data.ciphertext, context, config.secret) : { version: 1 as const, bindings: {} };
    if (state.version !== 1 || !state.bindings) throw new Error("GOOGLE_STATE_UNREADABLE");
    return state;
  }
  async function lock() {
    const token = randomUUID();
    const acquired = await client.rpc("google_calendar_lock", { p_workspace: workspace, p_token: token });
    if (acquired.error) throw new Error("GOOGLE_STORAGE_UNAVAILABLE");
    if (acquired.data !== true) throw new Error("SYNC_BUSY");
    // Deadline is far shorter than the 10-minute database lease and the route limit.
    const deadline = Date.now() + 180000;
    const guard = async () => {
      if (Date.now() > deadline) throw new Error("SYNC_TIME_LIMIT");
      const result = await own().eq("lock_token", token).gt("lock_until", new Date(Date.now() + 15000).toISOString()).maybeSingle();
      if (result.error || !result.data) throw new Error("SYNC_BUSY");
    };
    const storage: SyncStorage = {
      guard,
      async save(state) {
        await guard();
        const result = await query().update({ ciphertext: seal(state, context, config.secret), updated_at: new Date().toISOString() })
          .eq("user_id", userId).eq("workspace_id", workspace).eq("lock_token", token).select("user_id").maybeSingle();
        if (result.error || !result.data) throw new Error("GOOGLE_STORAGE_UNAVAILABLE");
      },
      async snapshot() {
        await guard();
        const result = await client.rpc("google_calendar_snapshot", { p_workspace: workspace });
        if (result.error || !result.data) throw new Error("INCOMPLETE_SYNC_SNAPSHOT");
        return result.data as Snapshot;
      },
    };
    return { storage, read, async release() {
      const result = await query().update({ lock_token: null, lock_until: null }).eq("user_id", userId).eq("workspace_id", workspace).eq("lock_token", token);
      if (result.error) throw new Error("GOOGLE_STORAGE_UNAVAILABLE");
    } };
  }
  return { workspace, cookieStore, config, read, lock };
}

const messages: Record<string, string> = {
  GOOGLE_NOT_CONFIGURED: "Google 行事曆設定尚未完成，請確認此環境的三個授權設定。",
  LOGIN_REQUIRED: "登入已失效，請重新登入家庭工具。",
  WORKSPACE_FORBIDDEN: "沒有此家庭工作區的存取權限。",
  ORIGIN_FORBIDDEN: "請從已設定的家庭工具網址操作。",
  GOOGLE_STORAGE_UNAVAILABLE: "同步儲存區尚未就緒或暫時無法存取，請稍後再試。",
  GOOGLE_STATE_UNREADABLE: "授權紀錄無法解密，請由管理者確認金鑰版本；不會覆蓋既有同步紀錄。",
  GOOGLE_REAUTHORIZE: "Google 授權已失效，請重新連結原本的 Google 帳號。",
  GOOGLE_PERMISSION: "Google 權限不足，請確認 Calendar API 已啟用並允許所需權限。",
  GOOGLE_CONFLICT: "Google 行程剛被修改，這次已停止，請再同步一次。",
  GOOGLE_RATE_LIMIT: "Google 暫時限制請求次數，請稍後再試。",
  SYNC_BUSY: "另一個同步或授權程序正在執行，請稍後再試。",
  SYNC_TIME_LIMIT: "這次處理時間已到，已完成的部分已保存，請再次同步繼續。",
  SOURCE_CHANGED: "同步期間家庭行程有變動，請再次同步以更新最新內容。",
  INCOMPLETE_SYNC_SNAPSHOT: "無法完整讀取家庭行程，已停止同步以避免誤刪。",
  EVENT_OWNERSHIP_CONFLICT: "發現無法確認來源的 Google 行程，已停止，沒有覆蓋或刪除該行程。",
  CALENDAR_CREATION_UNCERTAIN: "Google 專用行事曆建立結果待確認，請由管理者檢查，避免重複建立。",
  CALENDAR_MISSING: "原本的 Google 專用行事曆已無法存取，請先由管理者確認，不會改用其他行事曆。",
  GOOGLE_ACCOUNT_MISMATCH: "請選擇原本連結的 Google 帳號；為保護既有行程，未更換同步對象。",
  OAUTH_EXPIRED: "授權已過期或已使用，請回行事曆重新連結。",
  OAUTH_CANCELLED: "你已取消 Google 授權，原本行程沒有變動。",
};
export function errorReply(error: unknown) {
  const code = error instanceof Error && error.message in messages ? error.message : "GOOGLE_REQUEST_FAILED";
  const status = code === "LOGIN_REQUIRED" ? 401 : code === "WORKSPACE_FORBIDDEN" || code === "ORIGIN_FORBIDDEN" ? 403 : code === "SYNC_BUSY" ? 409 : 400;
  return Response.json({ code, error: messages[code] || "同步未完成，已處理的部分已保存。請稍後重試；不會因失敗而刪除其他行程。" }, { status, headers: { "Cache-Control": "no-store" } });
}
export const privateJson = (value: unknown) => Response.json(value, { headers: { "Cache-Control": "no-store" } });
