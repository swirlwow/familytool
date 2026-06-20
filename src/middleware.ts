import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 放行靜態資源與圖片
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes("favicon.ico") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 建立伺服器端 Supabase Client 以更新會話 (Session)
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-url.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // 取得當前使用者（這會自動刷新過期的 token）
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = pathname === "/login";
  const isPublicApi = pathname === "/api/calendar/feed";
  const isApiRoute = pathname.startsWith("/api/");

  // 1. 如果未登入，且試圖存取受保護的路徑
  if (!user && !isLoginPage && !isPublicApi) {
    if (isApiRoute) {
      // API 路由直接回傳 401 錯誤，避免被轉址為 HTML 登入頁
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // 一般頁面跳轉至登入頁
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // 2. 如果已登入，且試圖存取登入頁，直接導向首頁
  if (user && isLoginPage) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * 匹配所有請求路徑，除了以下排除的靜態資源路徑：
     * - _next/static (靜態檔案)
     * - _next/image (圖片優化服務)
     * - favicon.ico (圖標)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
