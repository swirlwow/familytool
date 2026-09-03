"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import {
  ArrowUpRight,
  Calculator,
  CalendarDays,
  DatabaseBackup,
  HouseHeart,
  LayoutDashboard,
  LogOut,
  Receipt,
  ShoppingBasket,
  StickyNote,
  Sun,
  Tags,
  TrendingUp,
  User,
} from "lucide-react";
import BottomNav from "./BottomNav";

const NAV_GROUPS = [
  {
    title: "帳務工具",
    items: [
      { name: "記帳", href: "/ledger", icon: LayoutDashboard },
      { name: "拆帳管理", href: "/settlement", icon: Calculator },
      { name: "帳單管理", href: "/bills", icon: Receipt },
      { name: "記帳設定", href: "/settings/categories", icon: Tags },
      { name: "資料備份", href: "/settings/backup", icon: DatabaseBackup },
    ],
  },
  {
    title: "投資工具",
    items: [
      { name: "股票管理", href: "/investments", icon: TrendingUp },
    ],
  },
  {
    title: "生活工具",
    items: [
      { name: "行事曆", href: "/calendar", icon: CalendarDays },
      { name: "待購清單", href: "/shopping", icon: ShoppingBasket },
      { name: "便條紙", href: "/stickies", icon: StickyNote },
    ],
  },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        router.replace("/login");
      } else if (event === "SIGNED_IN") {
        setUser(session?.user ?? null);
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error("登出失敗:", error);
    }
  };

  const isActive = (href: string) => {
    if (href === "/settings/categories") return ["/settings/categories", "/settings/payment-methods", "/settings/merchants", "/settings/payers"].includes(pathname);
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="drawer lg:drawer-open family-shell">
      <input id="app-drawer" type="checkbox" className="drawer-toggle" checked={drawerOpen} onChange={event => setDrawerOpen(event.target.checked)} />
      <div className="drawer-content flex min-h-screen min-w-0 flex-col">
        <div className="family-content min-w-0 flex-1 pb-24 lg:pb-0">{children}</div>
        <BottomNav onMore={() => setDrawerOpen(true)} expanded={drawerOpen} />
      </div>

      <div className="drawer-side z-50">
        <label htmlFor="app-drawer" className="drawer-overlay" aria-label="關閉導覽"></label>
        <aside id="family-navigation" className="family-sidebar flex min-h-full w-[220px] flex-col px-[18px] py-7" onKeyDown={event => { if (event.key === "Escape") setDrawerOpen(false); }}>
          <Link href="/" className="family-brand" aria-label="回到 FAMILYTOOL 首頁" onClick={() => setDrawerOpen(false)}>
            <span className="family-brand-mark"><HouseHeart aria-hidden="true" /></span>
            <span><strong>FAMILYTOOL</strong><small>家庭生活工具</small></span>
          </Link>

          <Link href="https://shift-leave-manager.vercel.app/" target="_blank" rel="noreferrer" className="shift-shortcut">
            <Sun aria-hidden="true" />
            <span><strong>值班休假</strong><small>開啟管理工具</small></span>
            <ArrowUpRight aria-hidden="true" />
          </Link>

          <nav className="family-nav flex-1" aria-label="主要導覽">
            {NAV_GROUPS.map((group) => (
              <div key={group.title} className="family-nav-group">
                <h3>{group.title}</h3>
                {group.items.map(({ name, href, icon: Icon }) => (
                  <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined} onClick={() => setDrawerOpen(false)} className={isActive(href) ? "family-nav-link active" : "family-nav-link"}>
                    <Icon aria-hidden="true" /><span>{name}</span>
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          {user && (
            <div className="family-user">
              <div><User aria-hidden="true" /><span title={user.email}>{user.email}</span></div>
              <button onClick={handleLogout}><LogOut aria-hidden="true" />登出</button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
