"use client";

import { useRef, useState } from "react";

export default function ConsentActions({ authorizationId }: { authorizationId: string }) {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function decide(decision: "approve" | "deny") {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/oauth/decision", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorization_id: authorizationId, decision }),
      });
      const data = await response.json();
      if (!response.ok || typeof data.redirect_url !== "string") {
        throw new Error(typeof data.error === "string" ? data.error : "授權未完成，請重新開啟登入流程。");
      }
      const destination = new URL(data.redirect_url);
      if (!["https:", "http:"].includes(destination.protocol) || destination.username || destination.password) {
        throw new Error("授權返回網址不正確。");
      }
      // Top-level navigation after a same-origin JSON request; retain form-action 'self'.
      window.location.assign(destination.toString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "連線失敗，請稍後再試。");
      inFlight.current = false;
      setBusy(false);
    }
  }
  return <div className="mt-6">
    {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
    <div className="grid grid-cols-2 gap-3" aria-busy={busy}>
      <button type="button" disabled={busy} onClick={() => decide("deny")} className="rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-700 disabled:opacity-50">取消</button>
      <button type="button" disabled={busy} onClick={() => decide("approve")} className="rounded-xl bg-rose-500 px-4 py-3 font-bold text-white disabled:opacity-50">{busy ? "處理中…" : "允許並繼續"}</button>
    </div>
  </div>;
}
