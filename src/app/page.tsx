// src/app/page.tsx
"use client";

import Link from "next/link";
import {
  Wallet,
  LayoutDashboard,
  Calculator,
  Receipt,
  CalendarDays,
  Sun,
  StickyNote,
  ArrowRight,
  DatabaseBackup,
  Settings
} from "lucide-react";

// 定義顏色主題的對應樣式
function getThemeClasses(theme: string) {
  switch (theme) {
    case "sky": return "bg-sky-50 text-sky-600 group-hover:bg-sky-500 group-hover:text-white ring-sky-100";
    case "blue": return "bg-blue-50 text-blue-600 group-hover:bg-blue-500 group-hover:text-white ring-blue-100";
    case "amber": return "bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white ring-amber-100";
    case "rose": return "bg-rose-50 text-rose-600 group-hover:bg-rose-500 group-hover:text-white ring-rose-100";
    case "emerald": return "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white ring-emerald-100";
    case "orange": return "bg-orange-50 text-orange-600 group-hover:bg-orange-500 group-hover:text-white ring-orange-100";
    case "yellow": return "bg-yellow-50 text-yellow-600 group-hover:bg-yellow-500 group-hover:text-white ring-yellow-100";
    case "pink": return "bg-pink-50 text-pink-600 group-hover:bg-pink-500 group-hover:text-white ring-pink-100";
    case "indigo": return "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white ring-indigo-100";
    case "slate": return "bg-slate-50 text-slate-600 group-hover:bg-slate-600 group-hover:text-white ring-slate-100";
    default: return "bg-slate-50 text-slate-600 group-hover:bg-slate-500 group-hover:text-white ring-slate-100";
  }
}

// 帳務工具清單
const financeTools = [
  { name: "記帳本", desc: "日常收支與拆帳", href: "/ledger", icon: Wallet, theme: "sky" },
  { name: "財務儀表板", desc: "收支統計與明細匯出", href: "/ledger/dashboard", icon: LayoutDashboard, theme: "blue" },
  { name: "拆帳結算", desc: "代墊款計算與批次結清", href: "/settlement", icon: Calculator, theme: "amber" },
  { name: "帳單管理", desc: "水電信貸等固定支出", href: "/bills", icon: Receipt, theme: "rose" },
];

// 生活工具清單
const lifeTools = [
  { name: "行事曆", desc: "全家行程與排班規劃", href: "/calendar", icon: CalendarDays, theme: "orange" },
  { name: "便條紙", desc: "隨手紀錄與牆上便利貼", href: "/stickies", icon: StickyNote, theme: "yellow" },
  { name: "值班休假", desc: "值班、補休與特休管理", href: "https://shift-leave-manager.vercel.app/", icon: Sun, theme: "pink" },
];

// 設定與備份清單
const settingTools = [
  { name: "資料備份", desc: "下載完整家庭資料", href: "/settings/backup", icon: DatabaseBackup, theme: "indigo" },
  { name: "系統設定", desc: "分類與付款方式管理", href: "/settings/categories", icon: Settings, theme: "slate" },
];

export default function HomePage() {
  const toolGroups = [
    { title: "帳務", tools: financeTools },
    { title: "生活", tools: lifeTools },
    { title: "設定", tools: settingTools },
  ];

  return (
    <main className="app-page">
      <div className="app-page-inner max-w-5xl">
        <header className="app-header">
          <div>
            <h1 className="text-lg font-black text-slate-900 sm:text-xl">家庭生活工具</h1>
            <p className="mt-0.5 text-xs font-medium text-slate-500">今天要處理什麼？</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            可使用
          </span>
        </header>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
          <section className="app-panel overflow-hidden">
            <div className="app-panel-header">
              <h2 className="font-black text-slate-800">常用帳務</h2>
            </div>
            <div className="grid sm:grid-cols-2">
              {financeTools.map((tool) => {
                const Icon = tool.icon;
                const colors = getThemeClasses(tool.theme);
                return (
                  <Link
                    key={tool.name}
                    href={tool.href}
                    className="group flex min-h-20 items-center gap-3 border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50 sm:odd:border-r"
                  >
                    <span className={`rounded-lg p-2.5 ring-1 ring-inset ${colors}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-slate-900">{tool.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">{tool.desc}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
                  </Link>
                );
              })}
            </div>
          </section>

          <div className="space-y-4">
            {toolGroups.slice(1).map((group) => (
              <section key={group.title} className="app-panel overflow-hidden">
                <div className="app-panel-header">
                  <h2 className="font-black text-slate-800">{group.title}</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {group.tools.map((tool) => {
                    const Icon = tool.icon;
                    const colors = getThemeClasses(tool.theme);
                    return (
                      <Link
                        key={tool.name}
                        href={tool.href}
                        target={tool.href.startsWith("http") ? "_blank" : undefined}
                        rel={tool.href.startsWith("http") ? "noreferrer" : undefined}
                        className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
                      >
                        <span className={`rounded-lg p-2 ring-1 ring-inset ${colors}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-slate-800">{tool.name}</span>
                          <span className="block truncate text-xs text-slate-400">{tool.desc}</span>
                        </span>
                        <ArrowRight className="h-4 w-4 text-slate-300" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
