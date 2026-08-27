"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type LedgerMonthCacheEntry = {
  rows: unknown[];
  updatedAt: number;
};

const ledgerMonthCache = new Map<string, LedgerMonthCacheEntry>();
const ledgerMonthRequests = new Map<string, Promise<unknown[]>>();
const LEDGER_CACHE_TTL_MS = 30_000;

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

async function fetchLedgerMonth(key: string, url: string) {
  const existing = ledgerMonthRequests.get(key);
  if (existing) return existing;

  const request = (async () => {
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || "記帳資料讀取失敗");
    const data = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.rows)
        ? json.rows
        : [];
    ledgerMonthCache.set(key, { rows: data, updatedAt: Date.now() });
    return data as unknown[];
  })();

  ledgerMonthRequests.set(key, request);
  try {
    return await request;
  } finally {
    ledgerMonthRequests.delete(key);
  }
}

export function useLedgerMonth<T = Record<string, unknown>>(workspaceId: string, ym: string) {
  const { from, to } = useMemo(() => monthRange(ym), [ym]);
  const cacheKey = `${workspaceId}:${from}:${to}`;
  const requestUrl = `/api/ledger?workspace_id=${encodeURIComponent(workspaceId)}&from=${from}&to=${to}`;
  const activeCacheKey = useRef(cacheKey);
  activeCacheKey.current = cacheKey;

  const [loading, setLoading] = useState(() => !ledgerMonthCache.has(cacheKey));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<T[]>(() =>
    (ledgerMonthCache.get(cacheKey)?.rows ?? []) as T[]
  );

  const load = useCallback(async (force = false) => {
    if (!workspaceId) return;

    const cached = ledgerMonthCache.get(cacheKey);
    const cacheIsFresh = cached && Date.now() - cached.updatedAt < LEDGER_CACHE_TTL_MS;
    if (cached) {
      setRows(cached.rows as T[]);
      setLoading(false);
    } else {
      setRows([]);
      setLoading(true);
    }

    if (cacheIsFresh && !force) return;

    setRefreshing(Boolean(cached));
    setError("");
    try {
      const data = await fetchLedgerMonth(cacheKey, requestUrl);
      if (activeCacheKey.current === cacheKey) setRows(data as T[]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "記帳資料讀取失敗");
      if (!cached && activeCacheKey.current === cacheKey) setRows([]);
    } finally {
      if (activeCacheKey.current === cacheKey) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [cacheKey, requestUrl, workspaceId]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return { from, to, rows, loading, refreshing, error, refresh };
}
