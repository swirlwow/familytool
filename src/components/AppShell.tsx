// src/components/AppShell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  LayoutDashboard,
  Calculator,
  History,
  Receipt,
  Wallet,
  CreditCard,
  Tags,
  CalendarDays,
  StickyNote,
  NotebookPen,
} from "lucide-react";
// ✅ 引入 BottomNav
import BottomNav from "./BottomNav";

const NAV_GROUPS = [
  {
    title: "帳務工具",
    items: [
      { name: "記帳", href: "/ledger", icon: LayoutDashboard, theme: "sky" },
      { name: "拆帳結算", href: "/settlement", icon: Calculator, theme: "amber" },
      { name: "結清紀錄", href: "/settlement/history", icon: History, theme: "violet" }, 
      { name: "帳單管理", href: "/bills", icon: Receipt, theme: "rose" },
      { name: "帳戶總覽", href: "/accounts", icon: Wallet, theme: "emerald" },
      { name: "分類管理", href: "/settings/categories", icon: Tags, theme: "slate" },
      { name: "付款方式", href: "/settings/payment-methods", icon: CreditCard, theme: "slate" },
      { name: "資料備份", href: "/settings/backup", icon: Tags, theme: "indigo" }, 
    
    ],
  },
  {
    title: "生活工具",
    items: [
      { name: "記事", href: "/notes", icon: NotebookPen, theme: "pink" },
      { name: "行事曆", href: "/calendar", icon: CalendarDays, theme: "orange" },
      { name: "便條紙", href: "/stickies", icon: StickyNote, theme: "yellow" },
    ],
  },
];

function getThemeStyles(theme: string, active: boolean) {
  if (!active) return "text-slate-600 hover:bg-slate-100 hover:text-slate-900";
  
  switch (theme) {
    case "sky": return "bg-sky-50 text-sky-700 shadow-sm ring-1 ring-sky-200";
    case "amber": return "bg-amber-50 text-amber-700 shadow-sm ring-1 ring-amber-200";
    case "rose": return "bg-rose-50 text-rose-700 shadow-sm ring-1 ring-rose-200";
    case "emerald": return "bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-200";
    case "teal": return "bg-teal-50 text-teal-700 shadow-sm ring-1 ring-teal-200";
    case "cyan": return "bg-cyan-50 text-cyan-700 shadow-sm ring-1 ring-cyan-200";
    case "pink": return "bg-pink-50 text-pink-700 shadow-sm ring-1 ring-pink-200";
    case "indigo": return "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200";
    case "violet": return "bg-violet-50 text-violet-700 shadow-sm ring-1 ring-violet-200";
    case "orange": return "bg-orange-50 text-orange-700 shadow-sm ring-1 ring-orange-200";
    case "yellow": return "bg-yellow-100 text-yellow-800 shadow-sm ring-1 ring-yellow-300";
    case "slate": return "bg-slate-100 text-slate-700 shadow-sm ring-1 ring-slate-300";
    default: return "bg-slate-100 text-slate-900 shadow-sm ring-1 ring-slate-200";
  }
}

function getIconStyles(theme: string, active: boolean) {
  if (!active) return "text-slate-400 group-hover:text-slate-600";
  
  switch (theme) {
    case "sky": return "text-sky-600";
    case "amber": return "text-amber-600";
    case "rose": return "text-rose-600";
    case "emerald": return "text-emerald-600";
    case "teal": return "text-teal-600";
    case "cyan": return "text-cyan-600";
    case "pink": return "text-pink-600";
    case "indigo": return "text-indigo-600";
    case "violet": return "text-violet-600";
    case "orange": return "text-orange-600";
    case "yellow": return "text-yellow-700";
    case "slate": return "text-slate-600";
    default: return "text-slate-600";
  }
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (href === "/settlement" && pathname.startsWith("/settlement/")) return false; 
    if (href !== "/" && pathname.startsWith(href + "/")) return true;
    return false;
  };

  return (
    <div className="drawer lg:drawer-open bg-slate-50">
      <input id="app-drawer" type="checkbox" className="drawer-toggle" />
      
      <div className="drawer-content flex flex-col min-h-screen">
        
        {/* ✅ 已移除手機版最上方的 NextBook Header，讓各頁面專屬的 Header 能夠直接貼齊頂部 */}

        {/* 頁面內容：增加 pb-24 防止被底部導航遮擋 */}
        <div className="flex-1 p-4 lg:p-8 pb-24 lg:pb-8">
            {children}
        </div>

        {/* 底部導航 (手機版顯示) */}
        <BottomNav />
      </div>

      {/* 側邊欄 (桌機版顯示 / 手機版作為 Drawer 彈出) */}
      <div className="drawer-side z-50">
        <label htmlFor="app-drawer" className="drawer-overlay"></label>
        <aside className="min-h-full w-72 bg-white border-r border-slate-200 px-4 py-6 flex flex-col gap-6">
          <div className="px-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md shadow-slate-200">
                <LayoutDashboard className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-slate-900 tracking-tight leading-tight">家庭生活工具</h1>
                <p className="text-[11px] font-medium text-slate-400">Finance & Life Manager</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-6">
            {NAV_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="mb-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">{group.title}</h3>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    const themeClass = getThemeStyles(item.theme || 'slate', active);
                    const iconClass = getIconStyles(item.theme || 'slate', active);
                    const Icon = item.icon;

                    return (
                      <li key={item.href}>
                        <Link 
                            href={item.href} 
                            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${themeClass}`}
                        >
                          <Icon className={`h-5 w-5 transition-colors ${iconClass}`} />
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
          
          {/* Footer Info */}
          <div className="mt-auto px-2 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              System Online
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}