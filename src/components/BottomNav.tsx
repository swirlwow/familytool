"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  NotebookPen, 
  CalendarDays, 
  StickyNote, 
  Shuffle,
  Menu
} from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();

  // 定義底部導航的 4~5 個核心功能
  // "Menu" 按鈕用來觸發原本的側邊欄 (Drawer)
  const NAV_ITEMS = [
    { name: "記帳", href: "/ledger", icon: NotebookPen, theme: "sky" },
    { name: "行事曆", href: "/calendar", icon: CalendarDays, theme: "teal" },
    { name: "便條", href: "/stickies", icon: StickyNote, theme: "yellow" },
    { name: "拆帳", href: "/settlement", icon: Shuffle, theme: "amber" },
  ];

  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (href !== "/" && pathname.startsWith(href + "/")) return true;
    return false;
  };

  // 取得顏色樣式 (與 Sidebar 邏輯類似，但針對底部導航優化)
  const getColorClass = (theme: string, active: boolean) => {
    if (!active) return "text-slate-400 hover:text-slate-600";
    
    switch (theme) {
      case "sky": return "text-sky-600";
      case "teal": return "text-teal-600";
      case "yellow": return "text-yellow-600";
      case "amber": return "text-amber-600";
      default: return "text-slate-800";
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 lg:hidden pb-safe">
      <div className="flex items-center justify-around h-16 px-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const colorClass = getColorClass(item.theme, active);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${active ? "opacity-100" : "opacity-70"}`}
            >
              <div className={`relative p-1 rounded-xl transition-all duration-300 ${active ? "bg-slate-50 -translate-y-1" : ""}`}>
                <Icon className={`w-6 h-6 ${colorClass}`} strokeWidth={active ? 2.5 : 2} />
                {active && (
                  <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-current ${colorClass}`} />
                )}
              </div>
              <span className={`text-[10px] font-bold ${active ? "text-slate-800" : "text-slate-400"}`}>
                {item.name}
              </span>
            </Link>
          );
        })}

        {/* 更多功能 (觸發 Drawer) */}
        <label
          htmlFor="app-drawer"
          className="flex flex-col items-center justify-center w-full h-full space-y-1 cursor-pointer text-slate-400 hover:text-slate-600 active:scale-95 transition-transform"
        >
          <Menu className="w-6 h-6" />
          <span className="text-[10px] font-bold">更多</span>
        </label>
      </div>
    </div>
  );
}