"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Status = { connected: boolean; email: string | null; lastSync: string | null };
type Result = { error?: string; code?: string; url?: string; created?: number; updated?: number; deleted?: number; unchanged?: number; lastSync?: string };

export function GoogleCalendarSyncButton() {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [reauthorize, setReauthorize] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [checking, setChecking] = useState(true);
  const inFlight = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/google-calendar/status", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (response.ok) setStatus(data);
        else { setMessage(data.error || "無法讀取 Google 連結狀態"); setHasError(true); }
      }).catch(() => { if (!controller.signal.aborted) { setMessage("無法讀取 Google 連結狀態，點按可重試。"); setHasError(true); } })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    const url = new URL(window.location.href);
    const result = url.searchParams.get("google_calendar");
    if (result) {
      const success = result === "connected";
      const errors: Record<string, string> = {
        OAUTH_CANCELLED: "已取消授權，原本行程沒有變動。",
        OAUTH_EXPIRED: "授權已過期或已使用，請重新連結。",
        GOOGLE_ACCOUNT_MISMATCH: "請重新連結原本的 Google 帳號，未更換同步對象。",
        GOOGLE_PERMISSION: "請確認 Google Calendar API 已啟用，並同意所需權限。",
      };
      toast({ title: success ? "Google 行事曆已連結" : "Google 授權未完成", description: success ? "按「同步 Google」即可同步所有月份；只會刪除家庭工具建立的行程。" : errors[result] || "請重新連結；若持續失敗，請確認授權設定。", ...(success ? {} : { variant: "destructive" as const }) });
      url.searchParams.delete("google_calendar");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    return () => controller.abort();
  }, [toast]);

  async function perform() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setHasError(false);
    setMessage("");
    try {
      let current = status;
      if (!current) {
        const response = await fetch("/api/google-calendar/status", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "無法讀取連結狀態");
        current = data as Status;
        setStatus(current);
      }
      const connect = !current.connected || reauthorize;
      const response = await fetch(`/api/google-calendar/${connect ? "connect" : "sync"}`, { method: "POST" });
      const data = await response.json() as Result;
      if (!response.ok) {
        if (data.code === "GOOGLE_REAUTHORIZE" || data.code === "GOOGLE_PERMISSION") setReauthorize(true);
        throw new Error(data.error || "同步未完成，請稍後重試。");
      }
      if (connect && data.url) {
        const destination = new URL(data.url);
        if (destination.origin !== "https://accounts.google.com") throw new Error("授權網址不正確。");
        window.location.assign(destination.toString());
        return;
      }
      const summary = `新增 ${data.created ?? 0} 筆、更新 ${data.updated ?? 0} 筆、刪除 ${data.deleted ?? 0} 筆、未變動 ${data.unchanged ?? 0} 筆。`;
      setStatus({ ...current, lastSync: data.lastSync || current.lastSync });
      setReauthorize(false);
      setMessage(summary);
      toast({ title: "Google 行事曆同步完成", description: summary });
    } catch (error) {
      const text = error instanceof Error ? error.message : "同步未完成，請稍後重試。";
      setMessage(text);
      setHasError(true);
      toast({ title: "Google 行事曆", description: text, variant: "destructive" });
    } finally { inFlight.current = false; setBusy(false); }
  }
  const label = busy ? "處理中…" : checking ? "讀取狀態中…" : reauthorize ? "重新連結 Google" : !status ? "重試連結狀態" : status.connected ? "同步 Google" : "連結 Google";
  const detail = status?.connected ? `${status.email || "Google"}｜同步所有月份，以家庭工具為準；只刪除本工具建立的行程。${status.lastSync ? ` 上次完成：${new Date(status.lastSync).toLocaleString("zh-TW")}` : ""}` : "連結後同步至專用的「家庭工具」Google 行事曆，不影響其他行程。";
  return <div className="calendar-google-control">
    <button type="button" className="calendar-print-button calendar-google-sync" disabled={busy || checking} onClick={perform} title={message || detail} aria-label={label} aria-busy={busy}>
      <RefreshCw size={18} aria-hidden="true" className={busy ? "animate-spin motion-reduce:animate-none" : ""} /><span>{label}</span>
    </button>
    <div className={`calendar-google-status${hasError ? " calendar-google-status-error" : ""}`} role="status" aria-live="polite" aria-atomic="true">
      <strong>{busy ? "正在處理 Google 行事曆…" : checking ? "正在確認連結狀態…" : reauthorize ? "需要重新授權" : hasError ? "Google 處理未完成" : status?.connected ? "Google 已連結" : "尚未連結 Google"}</strong>
      {status?.connected && <span>最後成功同步：{status.lastSync ? new Date(status.lastSync).toLocaleString("zh-TW") : "尚無成功紀錄"}</span>}
      {message && !busy && <span>{message}</span>}
      {!busy && status?.connected && <span>修改行程後請按同步；以家庭工具為準。</span>}
    </div>
  </div>;
}
