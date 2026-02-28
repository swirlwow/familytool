// src/app/settings/backup/page.tsx
"use client";

import { DatabaseBackup, Download, ShieldCheck } from "lucide-react";
import { WORKSPACE_ID } from "@/lib/appConfig";

export default function BackupPage() {
  function handleDownload() {
    if (!WORKSPACE_ID) {
      alert("未設定 WORKSPACE_ID");
      return;
    }
    // 直接開啟 API 網址，瀏覽器會自動下載 JSON 檔案
    window.open(`/api/export?workspace_id=${WORKSPACE_ID}`, "_blank");
  }

  return (
    <main className="min-h-screen bg-slate-50 relative">
      <div className="mx-auto max-w-4xl space-y-6">
        
        {/* Header */}
        <div className="card bg-white/90 backdrop-blur-md shadow-sm border border-slate-200 rounded-3xl sticky top-0 z-40">
          <div className="card-body p-4 flex flex-row items-center gap-3">
            <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl border border-indigo-100">
              <DatabaseBackup className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight">資料備份</h1>
              <p className="text-xs font-medium text-slate-400">Data Backup & Export</p>
            </div>
          </div>
        </div>

        {/* 備份說明卡片 */}
        <div className="card bg-white shadow-sm border border-slate-200 rounded-3xl overflow-hidden">
          <div className="p-6 md:p-8 space-y-6">
            <div className="flex items-start gap-4">
              <div className="bg-emerald-100 text-emerald-600 p-3 rounded-2xl shrink-0">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-black text-slate-800">一鍵全機備份 (JSON)</h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                  點擊下方按鈕，系統會將您在「記帳本、拆帳紀錄、帳單、行事曆、便條紙」等所有模組的資料，打包成一份純文字的 <strong>JSON 檔案</strong> 下載到您的設備中。
                </p>
                <p className="text-sm text-slate-500 leading-relaxed">
                  這份檔案可以永久保存在您的電腦或隨身碟裡。未來無論您是要轉移到其他資料庫、或者轉檔成 Excel 觀看，都擁有一份最完整的原始紀錄，確保您的資料 100% 掌握在自己手中。
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm font-bold text-slate-600">
                目前綁定的空間 ID：<span className="font-mono text-indigo-600 ml-1">{WORKSPACE_ID}</span>
              </div>
              
              <button
                onClick={handleDownload}
                className="btn bg-indigo-600 hover:bg-indigo-700 text-white border-none rounded-2xl px-8 font-black shadow-md shadow-indigo-600/30 w-full sm:w-auto"
              >
                <Download className="w-4 h-4 mr-1" />
                下載 JSON 備份檔
              </button>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}