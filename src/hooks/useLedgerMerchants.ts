"use client";

import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/client/feedback";
import type { LedgerMerchant } from "@/lib/ledger/details";

function orderMerchants(items: LedgerMerchant[]) {
  return items.slice().sort((a, b) =>
    Number(a.sort_order || 0) - Number(b.sort_order || 0)
    || a.name.localeCompare(b.name, "zh-Hant")
  );
}

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
        setItems(orderMerchants(result.data || []));
      } catch (cause) {
        if (!controller.signal.aborted) setError(getErrorMessage(cause, "店家載入失敗"));
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [workspaceId, revision]);

  const save = useCallback(async (fields: { id?: string; name?: string; is_active?: boolean; sort_order?: number }) => {
    const payload = fields.id ? fields : {
      ...fields,
      sort_order: fields.sort_order ?? items.reduce((max, item) => Math.max(max, Number(item.sort_order || 0)), 0) + 10,
    };
    const response = await fetch("/api/ledger/merchants", {
      method: payload.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: workspaceId, ...payload }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(getErrorMessage(result, "店家儲存失敗"));
    const item = result.data as LedgerMerchant;
    setItems(current => orderMerchants([...current.filter(row => row.id !== item.id), item]));
    return item;
  }, [items, workspaceId]);

  const reorder = useCallback(async (nextItems: LedgerMerchant[]) => {
    const normalized = nextItems.map((item, index) => ({ ...item, sort_order: (index + 1) * 10 }));
    const changed = normalized.filter(item =>
      Number(items.find(current => current.id === item.id)?.sort_order) !== item.sort_order
    );
    setItems(normalized);
    try {
      await Promise.all(changed.map(async item => {
        const response = await fetch("/api/ledger/merchants", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspace_id: workspaceId, id: item.id, sort_order: item.sort_order }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(getErrorMessage(result, "店家排序儲存失敗"));
      }));
    } catch (cause) {
      setItems(items);
      throw cause;
    }
  }, [items, workspaceId]);

  return { items, loading, error, save, reorder, retry: () => setRevision(value => value + 1) };
}
