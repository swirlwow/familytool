import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-url.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

// 用於瀏覽器端 (Client-side) 的單例客戶端
let clientSideSupabase: any = null;

function getActiveClient() {
  if (typeof window !== "undefined") {
    if (!clientSideSupabase) {
      clientSideSupabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);
    }
    return clientSideSupabase;
  }

  // 伺服器端 (Server-side) 動態依據當前 Request 的 Cookies 建立客戶端
  try {
    const { cookies } = require("next/headers");
    const cookieStore = cookies(); // Next.js 15/16 中會回傳 Promise

    return createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        async getAll() {
          const store = await cookieStore;
          return store.getAll();
        },
        async setAll(cookiesToSet) {
          try {
            const store = await cookieStore;
            cookiesToSet.forEach(({ name, value, options }) =>
              store.set(name, value, options)
            );
          } catch {
            // 忽略設定失敗 (例如在 Server Component 渲染期間不允許設定 Cookie)
          }
        },
      },
    });
  } catch {
    // 構建期間 (Build-time) 或靜態頁面生成時的備用匿名客戶端
    return createSupabaseClient(supabaseUrl, supabaseAnonKey);
  }
}

// 導出一個 JS Proxy，動態代理所有對 `supabase` 的方法與屬性存取
export const supabase: SupabaseClient = new Proxy({} as any, {
  get(target, prop, receiver) {
    const activeClient = getActiveClient();
    const value = Reflect.get(activeClient, prop, receiver);
    if (typeof value === "function") {
      return value.bind(activeClient);
    }
    return value;
  },
  set(target, prop, value, receiver) {
    const activeClient = getActiveClient();
    return Reflect.set(activeClient, prop, value, receiver);
  }
}) as any as SupabaseClient;
