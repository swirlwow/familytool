"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, LayoutDashboard, Menu, Shuffle } from "lucide-react";

const NAV_ITEMS = [
  { name: "首頁", href: "/", icon: Home },
  { name: "記帳", href: "/ledger", icon: LayoutDashboard },
  { name: "行事曆", href: "/calendar", icon: CalendarDays },
  { name: "拆帳", href: "/settlement", icon: Shuffle },
];

export default function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="family-bottom-nav lg:hidden" aria-label="手機導覽">
      {NAV_ITEMS.map(({ name, href, icon: Icon }) => (
        <Link key={href} href={href} className={isActive(href) ? "active" : ""}>
          <Icon aria-hidden="true" /><span>{name}</span>
        </Link>
      ))}
      <label htmlFor="app-drawer"><Menu aria-hidden="true" /><span>更多</span></label>
    </nav>
  );
}
