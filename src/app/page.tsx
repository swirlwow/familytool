"use client";

import Link from "next/link";
import { Wallet, LayoutDashboard, Calculator, Receipt, CalendarDays, ShoppingBasket, Sun, StickyNote, TrendingUp, ArrowUpRight, DatabaseBackup, Settings, House } from "lucide-react";
import "./home-harmony.css";

// Presentation groups only. All existing destinations and descriptions are retained.
const groups = [
  { title: "常用帳務", tone: "finance", icon: Wallet, tools: [
    { name: "記帳本", desc: "日常收支與拆帳", href: "/ledger", icon: Wallet, color: "blue" },
    { name: "財務儀表板", desc: "收支統計與明細匯出", href: "/ledger/dashboard", icon: LayoutDashboard, color: "teal" },
    { name: "拆帳管理", desc: "代墊款計算與批次結清", href: "/settlement", icon: Calculator, color: "orange" },
    { name: "帳單管理", desc: "水電信貸等固定支出", href: "/bills", icon: Receipt, color: "blue" },
  ] },
  { title: "投資", tone: "investment", icon: TrendingUp, tools: [
    { name: "股票買賣管理", desc: "持股、成本與損益紀錄", href: "/investments", icon: TrendingUp, color: "orange" },
  ] },
  { title: "生活", tone: "life", icon: House, tools: [
    { name: "行事曆", desc: "全家行程與排班規劃", href: "/calendar", icon: CalendarDays, color: "blue" },
    { name: "待購清單", desc: "保存連結與安排採買", href: "/shopping", icon: ShoppingBasket, color: "teal" },
    { name: "便條紙", desc: "隨手紀錄與牆上便利貼", href: "/stickies", icon: StickyNote, color: "orange" },
    { name: "值班休假", desc: "值班、補休與特休管理", href: "https://shift-leave-manager.vercel.app/", icon: Sun, color: "coral" },
  ] },
  { title: "設定", tone: "settings", icon: Settings, tools: [
    { name: "資料備份", desc: "下載完整家庭資料", href: "/settings/backup", icon: DatabaseBackup, color: "blue" },
    { name: "記帳設定", desc: "分類、付款方式與店家管理", href: "/settings/categories", icon: Settings, color: "purple" },
  ] },
];

export default function HomePage() {
  return (
    <main className="app-page home-harmony">
      <div className="home-inner">
        <header className="home-hero">
          <img className="home-hero-art" src="/images/home-family-garden.webp" alt="" width="1800" height="600" fetchPriority="high" />
          <div className="home-hero-copy">
            <span className="home-eyebrow">FAMILYTOOL</span>
            <h1>家庭生活工具</h1>
            <p>讓家務更簡單・讓生活更美好</p>
            <span className="home-prompt">今天要處理什麼？</span>
          </div>
        </header>
        <div className="home-groups">
          {groups.map((group) => {
            const GroupIcon = group.icon;
            return (
              <section key={group.tone} className={`home-section home-section--${group.tone}`} aria-labelledby={`home-${group.tone}`}>
                <header className="home-section-heading">
                  <GroupIcon aria-hidden="true" />
                  <h2 id={`home-${group.tone}`}>{group.title}</h2>
                </header>
                <div className="home-tools">
                  {group.tools.map((tool) => {
                    const Icon = tool.icon;
                    const external = tool.href.startsWith("http");
                    return (
                      <Link className="home-tool" href={tool.href} key={tool.href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
                        <span className={`home-tool-icon home-tool-icon--${tool.color}`}><Icon aria-hidden="true" strokeWidth={2.2} /></span>
                        <span className="home-tool-name">{tool.name}{external && <ArrowUpRight aria-label="另開分頁" />}</span>
                        <span className="home-tool-desc">{tool.desc}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
