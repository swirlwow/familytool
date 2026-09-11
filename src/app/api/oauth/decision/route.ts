import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { validatedOAuthRedirect } from "../../../../lib/oauth-decision";

function reply(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return reply({ error: "不允許跨來源授權請求。" }, 403);
  }
  let payload: { authorization_id?: unknown; decision?: unknown };
  try { payload = await request.json(); } catch { return reply({ error: "授權請求格式不正確。" }, 400); }
  if (!payload || typeof payload.authorization_id !== "string" ||
      !/^[A-Za-z0-9_-]{16,256}$/.test(payload.authorization_id) ||
      (payload.decision !== "approve" && payload.decision !== "deny")) {
    return reply({ error: "授權請求不完整。" }, 400);
  }
  const cookieStore = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return reply({ error: "登入已失效，請重新登入。" }, 401);
  const { data: details, error } = await supabase.auth.oauth.getAuthorizationDetails(payload.authorization_id);
  if (error || !details || !("authorization_id" in details)) {
    return reply({ error: "授權已處理或已失效，請回值班工具重新登入。" }, 409);
  }
  const allowLoopback = process.env.NODE_ENV === "development";
  if (!validatedOAuthRedirect(details.redirect_uri, details.redirect_uri, allowLoopback)) {
    return reply({ error: "授權返回網址不正確。" }, 400);
  }
  const result = payload.decision === "approve"
    ? await supabase.auth.oauth.approveAuthorization(payload.authorization_id, { skipBrowserRedirect: true })
    : await supabase.auth.oauth.denyAuthorization(payload.authorization_id, { skipBrowserRedirect: true });
  if (result.error || !result.data) return reply({ error: "授權未完成，請回值班工具重新登入。" }, 400);
  const destination = validatedOAuthRedirect(result.data.redirect_url, details.redirect_uri, allowLoopback);
  if (!destination) return reply({ error: "授權返回網址不正確。" }, 400);
  return reply({ redirect_url: destination });
}
