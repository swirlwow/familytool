// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 只記錄 API
  if (process.env.NODE_ENV !== "production" && pathname.startsWith("/api")) {
    console.log(`[API HIT] ${pathname}${search ? "?" + search : ""}`);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
