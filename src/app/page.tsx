"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div>
        <h1 className="text-2xl font-bold">家庭生活工具</h1>
        <p className="opacity-70">
          記帳、帳單、帳戶、就醫紀錄與全家行事曆
        </p>
      </div>

      {/* 快捷卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/ledger" className="card bg-base-100 shadow hover:shadow-md transition">
          <div className="card-body">
            <h2 className="card-title">記帳</h2>
            <p className="opacity-70">
              一般記帳、付款人、拆帳
            </p>
            <div className="card-actions justify-end">
              <span className="btn btn-primary btn-sm">前往</span>
            </div>
          </div>
        </Link>

        <Link href="/bills" className="card bg-base-100 shadow hover:shadow-md transition">
          <div className="card-body">
            <h2 className="card-title">帳單</h2>
            <p className="opacity-70">
              本月應繳、已繳、繳費紀錄
            </p>
            <div className="card-actions justify-end">
              <span className="btn btn-primary btn-sm">前往</span>
            </div>
          </div>
        </Link>

        <Link href="/accounts" className="card bg-base-100 shadow hover:shadow-md transition">
          <div className="card-body">
            <h2 className="card-title">帳戶紀錄</h2>
            <p className="opacity-70">
              信用卡 / 銀行帳戶（純紀錄）
            </p>
            <div className="card-actions justify-end">
              <span className="btn btn-outline btn-sm">準備中</span>
            </div>
          </div>
        </Link>
      </div>
<button className="btn btn-primary">DaisyUI 測試</button>
      {/* 後續功能 */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title">接下來會有</h2>
          <ul className="list-disc list-inside opacity-80 space-y-1">
            <li>誰欠誰結算（A / B 月結）</li>
            <li>就醫 / 用藥 / 回診紀錄（媽媽 & 小孩）</li>
            <li>全家共用行事曆</li>
            <li>股票 / 投資紀錄（純備忘）</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
