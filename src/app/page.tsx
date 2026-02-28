// src/app/page.tsx
"use client";

import Link from "next/link";
import {
  Wallet,
  LayoutDashboard,
  Calculator,
  Receipt,
  CreditCard,
  CalendarDays,
  StickyNote,
  NotebookPen,
  ArrowRight,
  Sparkles,
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
  { name: "帳戶總覽", desc: "銀行與信用卡餘額追蹤", href: "/accounts", icon: CreditCard, theme: "emerald" },
];

// 生活工具清單
const lifeTools = [
  { name: "行事曆", desc: "全家行程與排班規劃", href: "/calendar", icon: CalendarDays, theme: "orange" },
  { name: "便條紙", desc: "隨手紀錄與牆上便利貼", href: "/stickies", icon: StickyNote, theme: "yellow" },
  { name: "記事本", desc: "醫療、用藥與長篇紀錄", href: "/notes", icon: NotebookPen, theme: "pink" },
];

// 設定與備份清單
const settingTools = [
  { name: "資料備份", desc: "一鍵匯出全機 JSON", href: "/settings/backup", icon: DatabaseBackup, theme: "indigo" },
  { name: "系統設定", desc: "分類與付款方式管理", href: "/settings/categories", icon: Settings, theme: "slate" },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 md:p-8 lg:p-10 pb-28 md:pb-12">
      <div className="mx-auto max-w-5xl space-y-8 md:space-y-12">
        
        {/* ===== Header Hero Section ===== */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
          {/* 裝飾背景 */}
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-sky-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-amber-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[11px] font-black text-emerald-600 mb-2">
              <Sparkles className="w-3 h-3" /> 系統運作正常
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
              家庭生活工具
            </h1>
            <p className="text-sm md:text-base font-medium text-slate-500 max-w-md leading-relaxed">
              集中管理全家人的日常收支、代墊拆帳、行程規劃與重要備忘，所有資料完全掌握在自己手中。
            </p>
          </div>
        </div>

        {/* ===== 帳務工具 ===== */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 px-1">
            <h2 className="text-lg font-black text-slate-800 tracking-tight">帳務與拆帳</h2>
            <div className="h-px flex-1 bg-slate-200"></div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {financeTools.map((tool) => {
              const Icon = tool.icon;
              const colors = getThemeClasses(tool.theme);
              return (
                <Link key={tool.name} href={tool.href} className="group block outline-none">
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 transition-all duration-300 hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-1 hover:border-slate-300 h-full flex flex-col">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-2.5 md:p-3 rounded-xl transition-colors duration-300 ring-1 ring-inset ${colors}`}>
                        <Icon className="w-5 h-5 md:w-6 md:h-6" />
                      </div>
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-slate-900 group-hover:text-white transition-colors duration-300">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mt-auto">
                      <h3 className="font-bold text-slate-900 text-base md:text-lg">{tool.name}</h3>
                      <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">{tool.desc}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ===== 生活工具 ===== */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 px-1">
            <h2 className="text-lg font-black text-slate-800 tracking-tight">生活與規劃</h2>
            <div className="h-px flex-1 bg-slate-200"></div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {lifeTools.map((tool) => {
              const Icon = tool.icon;
              const colors = getThemeClasses(tool.theme);
              return (
                <Link key={tool.name} href={tool.href} className="group block outline-none">
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 transition-all duration-300 hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-1 hover:border-slate-300 h-full flex flex-col">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-2.5 md:p-3 rounded-xl transition-colors duration-300 ring-1 ring-inset ${colors}`}>
                        <Icon className="w-5 h-5 md:w-6 md:h-6" />
                      </div>
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-slate-900 group-hover:text-white transition-colors duration-300">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mt-auto">
                      <h3 className="font-bold text-slate-900 text-base md:text-lg">{tool.name}</h3>
                      <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">{tool.desc}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ===== 設定與備份 ===== */}
        <section className="space-y-4 pb-8">
          <div className="flex items-center gap-3 px-1">
            <h2 className="text-lg font-black text-slate-800 tracking-tight">設定與備份</h2>
            <div className="h-px flex-1 bg-slate-200"></div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 lg:w-2/3">
            {settingTools.map((tool) => {
              const Icon = tool.icon;
              const colors = getThemeClasses(tool.theme);
              return (
                <Link key={tool.name} href={tool.href} className="group block outline-none">
                  <div className="bg-slate-100/50 border border-slate-200 rounded-2xl p-4 transition-all duration-300 hover:bg-white hover:shadow-md hover:border-slate-300 flex items-center gap-4">
                    <div className={`p-2.5 rounded-xl transition-colors duration-300 ring-1 ring-inset ${colors}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 text-sm">{tool.name}</h3>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">{tool.desc}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

      </div>
    </main>
  );
}
