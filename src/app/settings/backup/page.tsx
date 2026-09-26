// src/app/settings/backup/page.tsx
"use client";

import { Download, LoaderCircle, ShieldCheck } from "lucide-react";
import "./backup-ui.css";
import "../../calendar-backup-ui.css";
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
    <main className="app-page backup-ui relative" aria-label="資料備份">
      <div className="app-page-inner backup-layout">
        <p className="backup-notice">下載前自動驗證資料表筆數與校驗碼。不含登入密碼、平台金鑰及外部附件；檔案含私人資料，請妥善保存。還原請先在隔離環境驗證。</p>
        {/* 備份說明卡片 */}
        <div className="backup-card card bg-white border overflow-hidden">
          <div className="backup-card-inner">
            <div className="backup-intro">
              <div className="backup-shield">
                <ShieldCheck className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-black text-slate-800">完整業務資料備份</h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                  下載內容包含記帳、拆帳、帳單、行事曆、記事與便條紙，檔案格式為 JSON。
                </p>
              </div>
            </div>

            <div className="backup-action-row">
              <div className="text-sm font-bold text-slate-600">備份目前家庭空間（含待購比價、股票交易、股利與股權異動）</div>

              <button
                onClick={handleDownload}
                disabled={downloading}
                aria-busy={downloading}
                className="backup-download"
              >
                {downloading ? <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />}
                {downloading ? "準備備份中…" : "下載備份"}
              </button>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
