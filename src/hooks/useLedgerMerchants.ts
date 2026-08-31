"use client";

import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/client/feedback";
import type { LedgerMerchant } from "@/lib/ledger/details";

export function useLedgerMerchants(workspaceId: string) {
  const [items, setItems] = useState<LedgerMerchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/ledger/merchants?workspace_id=${encodeURIComponent(workspaceId)}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(getErrorMessage(result, "店家載入失敗"));
        setItems(result.data || []);
      } catch (cause) {
        if (!controller.signal.aborted) setError(getErrorMessage(cause, "店家載入失敗"));
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [workspaceId, revision]);

  const save = useCallback(async (fields: { id?: string; name?: string; is_active?: boolean }) => {
    const response = await fetch("/api/ledger/merchants", {
      method: fields.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: workspaceId, ...fields }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(getErrorMessage(result, "店家儲存失敗"));
    const item = result.data as LedgerMerchant;
    setItems(current => [...current.filter(row => row.id !== item.id), item].sort((a, b) => a.name.localeCompare(b.name, "zh-Hant")));
    return item;
  }, [workspaceId]);

  return { items, loading, error, save, retry: () => setRevision(value => value + 1) };
}
