"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WORKSPACE_ID } from "@/lib/appConfig";

/**
 * useMasterData.ts（最穩版本）
 * - 不新增檔案
 * - 維持原回傳欄位：catsExpense / catsIncome / payMethods / payers
 * - 優先使用 /api/lookups（1 次拿齊）
 * - 若 lookups 失敗，fallback 回原本 4 支 API（不改任何既有 API）
 * - sessionStorage + memory 快取（TTL）
 * - single-flight 防重複請求
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

const TTL_MS = 10 * 60 * 1000; // 10分鐘（可自行調）
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
let memCache: { at: number; workspaceId: string; data: MasterData } | null = null;
let inflight: Promise<MasterData> | null = null;

function readSessionCache(workspaceId: string): MasterData | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(workspaceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: MasterData };
    if (!parsed?.at || !parsed?.data) return null;
    if (Date.now() - parsed.at > TTL_MS) return null;
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
  const r = await fetch(`/api/lookups?workspace_id=${encodeURIComponent(workspaceId)}`);
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || "lookups 讀取失敗");

  const d = j?.data || {};
  // lookups 資料結構：categories_expense / categories_income / payment_methods / payers
  return normalize({
    catsExpense: safeArray<Cat>(d.categories_expense),
    catsIncome: safeArray<Cat>(d.categories_income),
    payMethods: safeArray<PayMethod>(d.payment_methods),
    payers: safeArray<Payer>(d.payers),
  });
}

async function fetchViaLegacyApis(workspaceId: string): Promise<MasterData> {
  const qs = new URLSearchParams({ workspace_id: workspaceId });

  const [rCatsEx, rCatsIn, rPayMethods, rPayers] = await Promise.all([
    fetch(`/api/categories?type=expense&${qs.toString()}`),
    fetch(`/api/categories?type=income&${qs.toString()}`),
    fetch(`/api/payment-methods?${qs.toString()}`),
    fetch(`/api/payers?${qs.toString()}`),
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

    // 1) 優先 lookups（一次拿齊）
    try {
      data = await fetchViaLookups(workspaceId);
    } catch {
      // 2) fallback：原本 4 支 API
      data = await fetchViaLegacyApis(workspaceId);
    }

    // 寫入快取
    memCache = { at: Date.now(), workspaceId, data };
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

  // 避免 StrictMode mount/unmount 造成 setState on unmounted
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
    async (opts?: { force?: boolean }) => {
      if (!workspaceId) {
        setLoading(false);
        return;
      }

      setError("");

      // 1) 快取（除非 force）
      if (!opts?.force) {
        if (memCache && memCache.workspaceId === workspaceId && Date.now() - memCache.at <= TTL_MS) {
          applyData(memCache.data);
          setLoading(false);
          return;
        }

        const s = readSessionCache(workspaceId);
        if (s) {
          memCache = { at: Date.now(), workspaceId, data: s };
          applyData(s);
          setLoading(false);
          return;
        }
      }

      // 2) 抓資料
      setLoading(true);
      try {
        const d = await fetchMasterData(workspaceId);
        applyData(d);
      } catch (e: any) {
        if (!aliveRef.current) return;
        setError(e?.message || "讀取失敗");
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
    await load({ force: true });
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
