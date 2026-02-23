"use client";

import { useEffect, useMemo, useState } from "react";

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export function useLedgerMonth(workspaceId: string, ym: string) {
  const { from, to } = useMemo(() => monthRange(ym), [ym]);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]); // 暫用 any 以相容您的 LedgerRow

  async function refresh() {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ledger?workspace_id=${workspaceId}&from=${from}&to=${to}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      const data = Array.isArray(json?.data) ? json.data : Array.isArray(json?.rows) ? json.rows : [];
      setRows(data);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, from, to]);

  return { from, to, rows, loading, refresh };
}