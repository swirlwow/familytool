"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getErrorMessage } from "@/lib/client/feedback";
import { normalizeMerchantName, type LedgerMerchant } from "@/lib/ledger/details";

export function MerchantNameField({ item, busy, onSave }: {
  item: LedgerMerchant;
  busy: boolean;
  onSave: (id: string, name: string) => Promise<LedgerMerchant>;
}) {
  const id = useId();
  const pending = useRef(false);
  const [draft, setDraft] = useState(item.name);
  const [error, setError] = useState("");
  useEffect(() => { setDraft(item.name); }, [item.name]);

  async function commit() {
    if (pending.current) return;
    const name = normalizeMerchantName(draft);
    if (name === item.name) { setDraft(name); setError(""); return; }
    if (!name) { setError("請輸入店家名稱"); return; }
    pending.current = true;
    setError("");
    try {
      const saved = await onSave(item.id, name);
      setDraft(saved.name);
    } catch (cause) {
      setError(getErrorMessage(cause, "儲存失敗，請再試一次"));
    } finally { pending.current = false; }
  }
  return <div className="merchant-name-field">
    <input className="merchant-name-input" aria-label={`店家名稱：${item.name}`}
      value={draft} maxLength={120} readOnly={busy} aria-invalid={!!error}
      aria-describedby={error ? id : undefined} onChange={event => { setDraft(event.target.value); setError(""); }}
      onBlur={() => void commit()} onKeyDown={event => {
        if (event.key === "Enter" && !event.nativeEvent.isComposing) {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") { setDraft(item.name); setError(""); }
      }} />
    {error && <p id={id} role="alert" className="merchant-name-error">{error}</p>}
  </div>;
}
