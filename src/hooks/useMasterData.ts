// src/hooks/useMasterData.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WORKSPACE_ID } from "@/lib/appConfig";

/**
 * useMasterData.ts (Stale-While-Revalidate 版本)
 * - 進入頁面時立刻給快取資料（畫面秒出）
 * - 背景一律強制抓取最新資料（解決新增分類後看不到的問題）
 * - single-flight 防重複請求
 * - 強制 fetch 使用 cache: "no-store"
 */

type Cat = { id: string; name: string; group_name: string | null };
type PayMethod = { id: string; name: string };
type Payer = { id: string; name: string };

type MasterData = {
  catsExpense: Cat[];
  catsIncome: Cat[];
  payMethods: PayMethod[];
  payers: Payer[];
};

const cacheKey = (workspaceId: string) => `masterData:${workspaceId}`;

function safeArray<T>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

// 兼容回傳可能是 {data: []} 或直接 []
function unwrapData<T>(json: any): T[] {
  if (!json) return [];
  if (Array.isArray(json)) return json as T[];
  if (Array.isArray(json.data)) return json.data as T[];
  return [];
}

function normalize(d: Partial<MasterData> | null | undefined): MasterData {
  return {
    catsExpense: safeArray<Cat>(d?.catsExpense),
    catsIncome: safeArray<Cat>(d?.catsIncome),
    payMethods: safeArray<PayMethod>(d?.payMethods),
    payers: safeArray<Payer>(d?.payers),
  };
}

// ===== module-level cache (memory) + single-flight =====
let memCache: { workspaceId: string; data: MasterData } | null = null;
let inflight: Promise<MasterData> | null = null;

function readSessionCache(workspaceId: string): MasterData | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(workspaceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: MasterData };
    if (!parsed?.data) return null;
    return normalize(parsed.data);
  } catch {
    return null;
  }
}

function writeSessionCache(workspaceId: string, data: MasterData) {
  try {
    sessionStorage.setItem(cacheKey(workspaceId), JSON.stringify({ at: Date.now(), data }));
  } catch {
    // ignore
  }
}

async function fetchViaLookups(workspaceId: string): Promise<MasterData> {
  // ✅ 強制不快取，確保永遠向資料庫要最新資料
  const r = await fetch(`/api/lookups?workspace_id=${encodeURIComponent(workspaceId)}`, {
    cache: "no-store",
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || "lookups 讀取失敗");

  const d = j?.data || {};
  return normalize({
    catsExpense: safeArray<Cat>(d.categories_expense),
    catsIncome: safeArray<Cat>(d.categories_income),
    payMethods: safeArray<PayMethod>(d.payment_methods),
    payers: safeArray<Payer>(d.payers),
  });
}

async function fetchViaLegacyApis(workspaceId: string): Promise<MasterData> {
  const qs = new URLSearchParams({ workspace_id: workspaceId });
  // ✅ 強制不快取
  const opts = { cache: "no-store" as RequestCache };

  const [rCatsEx, rCatsIn, rPayMethods, rPayers] = await Promise.all([
    fetch(`/api/categories?type=expense&${qs.toString()}`, opts),
    fetch(`/api/categories?type=income&${qs.toString()}`, opts),
    fetch(`/api/payment-methods?${qs.toString()}`, opts),
    fetch(`/api/payers?${qs.toString()}`, opts),
  ]);

  const [jCatsEx, jCatsIn, jPayMethods, jPayers] = await Promise.all([
    rCatsEx.json(),
    rCatsIn.json(),
    rPayMethods.json(),
    rPayers.json(),
  ]);

  if (!rCatsEx.ok) throw new Error(jCatsEx?.error || "categories(expense) 讀取失敗");
  if (!rCatsIn.ok) throw new Error(jCatsIn?.error || "categories(income) 讀取失敗");
  if (!rPayMethods.ok) throw new Error(jPayMethods?.error || "payment-methods 讀取失敗");
  if (!rPayers.ok) throw new Error(jPayers?.error || "payers 讀取失敗");

  return normalize({
    catsExpense: unwrapData<Cat>(jCatsEx),
    catsIncome: unwrapData<Cat>(jCatsIn),
    payMethods: unwrapData<PayMethod>(jPayMethods),
    payers: unwrapData<Payer>(jPayers),
  });
}

async function fetchMasterData(workspaceId: string): Promise<MasterData> {
  if (inflight) return inflight;

  inflight = (async () => {
    let data: MasterData | null = null;

    try {
      data = await fetchViaLookups(workspaceId);
    } catch {
      data = await fetchViaLegacyApis(workspaceId);
    }

    // 寫入快取，供下次「瞬間顯示」使用
    memCache = { workspaceId, data };
    writeSessionCache(workspaceId, data);

    return data;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function useMasterData() {
  const workspaceId = WORKSPACE_ID;

  const [catsExpense, setCatsExpense] = useState<Cat[]>([]);
  const [catsIncome, setCatsIncome] = useState<Cat[]>([]);
  const [payMethods, setPayMethods] = useState<PayMethod[]>([]);
  const [payers, setPayers] = useState<Payer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const applyData = useCallback((d: MasterData) => {
    if (!aliveRef.current) return;
    setCatsExpense(d.catsExpense);
    setCatsIncome(d.catsIncome);
    setPayMethods(d.payMethods);
    setPayers(d.payers);
  }, []);

  const load = useCallback(
    async () => {
      if (!workspaceId) {
        setLoading(false);
        return;
      }

      setError("");
      let hasCache = false;

      // 1) 先嘗試讀取快取 (讓畫面立刻顯示選單，不卡 loading 轉圈圈)
      if (memCache && memCache.workspaceId === workspaceId) {
        applyData(memCache.data);
        hasCache = true;
      } else {
        const s = readSessionCache(workspaceId);
        if (s) {
          memCache = { workspaceId, data: s };
          applyData(s);
          hasCache = true;
        }
      }

      // 如果完全沒有快取，才顯示 loading
      if (!hasCache) {
        setLoading(true);
      }

      // 2) 無論有沒有快取，都在背景發送 API 獲取「最新資料」 (Stale-While-Revalidate)
      try {
        const d = await fetchMasterData(workspaceId);
        applyData(d); // 更新為最新資料
      } catch (e: any) {
        if (!aliveRef.current) return;
        if (!hasCache) setError(e?.message || "讀取失敗");
      } finally {
        if (!aliveRef.current) return;
        setLoading(false);
      }
    },
    [applyData, workspaceId]
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return {
    catsExpense,
    catsIncome,
    payMethods,
    payers,
    loading,
    error,
    refresh,
  };
}
