// src/app/settings/backup/page.tsx
"use client";

import { DatabaseBackup, Download, ShieldCheck } from "lucide-react";
import { WORKSPACE_ID } from "@/lib/appConfig";
import { toast } from "@/hooks/use-toast";
import { useRef, useState } from "react";
import { fetchBackupFile } from "@/lib/client/backup-download";

export default function BackupPage() {
  const [downloading, setDownloading] = useState(false);
  const inFlight = useRef(false);
  async function handleDownload() {
    if (inFlight.current) return;
    if (!WORKSPACE_ID) {
      toast({ variant: "destructive", title: "無法下載備份", description: "尚未設定工作區" });
      return;
    }
    inFlight.current = true;
    setDownloading(true);
    try {
      const blob = await fetchBackupFile(`/api/export?workspace_id=${encodeURIComponent(WORKSPACE_ID)}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `familytool_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: "備份已準備完成", description: "已交由瀏覽器下載，請確認下載清單。" });
    } catch (error) {
      toast({ variant: "destructive", title: "備份下載失敗", description: error instanceof Error ? error.message : "請稍後重試。" });
    } finally {
      inFlight.current = false;
      setDownloading(false);
    }
  }

  return (
    <main className="app-page relative">
      <div className="app-page-inner max-w-4xl">
        
        {/* Header */}
        <div className="app-header justify-start">
            <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl border border-indigo-100">
              <DatabaseBackup className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-800">資料備份</h1>
              <p className="text-xs font-medium text-slate-400">下載完整資料</p>
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
                <h2 className="text-lg font-black text-slate-800">完整資料備份</h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                  下載內容包含記帳、拆帳、帳單、行事曆、記事與便條紙，檔案格式為 JSON。
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm font-bold text-slate-600">備份目前家庭空間</div>
              
              <button
                onClick={handleDownload}
                disabled={downloading}
                aria-busy={downloading}
                className="btn bg-indigo-600 hover:bg-indigo-700 text-white border-none rounded-2xl px-8 font-black shadow-md shadow-indigo-600/30 w-full sm:w-auto"
              >
                <Download className="w-4 h-4 mr-1" />
                {downloading ? "準備備份中…" : "下載備份"}
              </button>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
