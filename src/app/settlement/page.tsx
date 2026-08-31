"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calculator,
  RefreshCw,
  ArrowRight,
  History,
  CheckCircle2,
  Calendar,
  ArrowLeft,
  Layers,
  Download,
  AlertTriangle,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { downloadInternalFile } from "@/lib/client/download";
import { TextInputDialog } from "@/components/ui/text-input-dialog";
import { SettlementNav } from "@/components/settlement/SettlementNav";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const WORKSPACE_ID = process.env.NEXT_PUBLIC_WORKSPACE_ID || "";

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type Payer = { id: string; name: string };

type SplitLine = {
  split_id: string;
  entry_id: string;
  entry_date: string;
  creditor_id: string;
  debtor_id: string;
  split_amount: number;
  settled_amount: number;
  remaining_amount: number;
};

type RepaymentSuggestion = {
  debtor_id: string;
  creditor_id: string;
  amount: number;
};

type ConfirmState =
  | null
  | {
      title: string;
      description?: string;
      confirmText?: string;
      cancelText?: string;
      danger?: boolean;
      actionKey?: string; // busy-key
      onConfirm: () => Promise<void> | void;
    };

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function SettlementPage() {
  const router = useRouter();
  const { toast } = useToast();

  const from = "2000-01-01";
  const to = localDateString(new Date());

  const [loading, setLoading] = useState(false);

  const [payers, setPayers] = useState<Payer[]>([]);
  const payerMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of payers) m.set(p.id, p.name);
    return m;
  }, [payers]);

  const nameOf = (id: string) => payerMap.get(id) || id;

  const [net, setNet] = useState<{ payer_id: string; amount: number }[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [splits, setSplits] = useState<SplitLine[]>([]);
  const [settledItems, setSettledItems] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<RepaymentSuggestion[]>([]);
  const [preSettlementSuggestions, setPreSettlementSuggestions] = useState<RepaymentSuggestion[]>([]);
  const displaySplits = useMemo(
    () =>
      splits
        .map((split, index) => ({ split, index }))
        .sort(
          (a, b) =>
            Number(a.split.remaining_amount <= 0) - Number(b.split.remaining_amount <= 0) ||
            a.index - b.index,
        )
        .map(({ split }) => split),
    [splits],
  );
  const [totals, setTotals] = useState({
    split_amount: 0,
    pre_settlement_amount: 0,
    settled_amount: 0,
    remaining_amount: 0,
  });
  const [diagnostics, setDiagnostics] = useState({
    overallocated_split_count: 0,
    overallocated_amount: 0,
  });

  // 每筆 split 的「這次要結清多少」
  const [settleInput, setSettleInput] = useState<Record<string, number>>({});

  // busy map: prevent double click
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  // Confirm dialog
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [repaymentSuggestion, setRepaymentSuggestion] = useState<RepaymentSuggestion | null>(null);
  const [repaymentAmount, setRepaymentAmount] = useState("");

  function showOk(title: string, description?: string) {
    toast({ title, description: description || "" });
  }

  function showError(title: string, raw: any) {
    const detail =
      typeof raw === "string"
        ? raw
        : raw?.error
        ? String(raw.error)
        : raw?.message
        ? String(raw.message)
        : "操作失敗";
    const technical = /(column|schema|relationship|PGRST|HTTP\s*\d|does not exist)/i.test(detail);
    const msg = technical ? "資料暫時無法處理，請稍後重新整理。" : detail;
    toast({ variant: "destructive", title, description: msg });
  }

  async function fetchJson(res: Response) {
    const text = await res.text();
    const j = safeJsonParse(text);
    return { ok: res.ok, status: res.status, data: j ?? { error: text || `HTTP ${res.status}` } };
  }

  function openConfirm(next: NonNullable<ConfirmState>) {
    setConfirmState(next);
  }
  function closeConfirm() {
    setConfirmState(null);
  }

  async function loadPayers() {
    if (!WORKSPACE_ID) return;
    const res = await fetch(`/api/payers?workspace_id=${WORKSPACE_ID}`, { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    setPayers(Array.isArray(j?.data) ? j.data : []);
  }

  async function loadSettlement() {
    if (!WORKSPACE_ID) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/settlement?workspace_id=${WORKSPACE_ID}&from=${from}&to=${to}`, {
        cache: "no-store",
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError("讀取失敗", j?.error || `HTTP ${res.status}`);
        setNet([]);
        setRecent([]);
        setSplits([]);
        setSettledItems([]);
        setTotals({ split_amount: 0, pre_settlement_amount: 0, settled_amount: 0, remaining_amount: 0 });
        setSettleInput({});
        return;
      }

      setNet(Array.isArray(j.net) ? j.net : []);
      setRecent(Array.isArray(j.recent_settlements) ? j.recent_settlements : []);
      setSplits(Array.isArray(j.splits) ? j.splits : []);
      setSettledItems(Array.isArray(j.settled_items) ? j.settled_items : []);
      setSuggestions(Array.isArray(j.suggestions) ? j.suggestions : []);
      setPreSettlementSuggestions(
        Array.isArray(j.pre_settlement_suggestions) ? j.pre_settlement_suggestions : []
      );
      setTotals({
        split_amount: Number(j?.totals?.split_amount || 0),
        pre_settlement_amount: Number(j?.totals?.pre_settlement_amount || 0),
        settled_amount: Number(j?.totals?.settled_amount || 0),
        remaining_amount: Number(j?.totals?.remaining_amount || 0),
      });
      setDiagnostics({
        overallocated_split_count: Number(j?.diagnostics?.overallocated_split_count || 0),
        overallocated_amount: Number(j?.diagnostics?.overallocated_amount || 0),
      });

      const next: Record<string, number> = {};
      for (const s of (Array.isArray(j.splits) ? j.splits : []) as SplitLine[]) {
        next[s.split_id] = s.remaining_amount;
      }
      setSettleInput(next);
    } catch (e: any) {
      showError("讀取失敗", e?.message || "未知錯誤");
      setNet([]);
      setRecent([]);
      setSplits([]);
      setSettledItems([]);
      setSuggestions([]);
      setPreSettlementSuggestions([]);
      setTotals({ split_amount: 0, pre_settlement_amount: 0, settled_amount: 0, remaining_amount: 0 });
      setDiagnostics({ overallocated_split_count: 0, overallocated_amount: 0 });
      setSettleInput({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPayers();
     
  }, []);

  useEffect(() => {
    loadSettlement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payers.length]);

  function exportReconciliation(settlementId?: string) {
    const qs = new URLSearchParams({
      workspace_id: WORKSPACE_ID,
      from,
      to,
      format: "csv",
    });
    if (settlementId) qs.set("settlement_id", settlementId);
    downloadInternalFile(`/api/settlement/reconciliation?${qs.toString()}`);
  }

  function requestLumpSumRepayment(sug: RepaymentSuggestion) {
    setRepaymentSuggestion(sug);
    setRepaymentAmount(String(sug.amount));
  }

  async function confirmLumpSumRepayment() {
    const sug = repaymentSuggestion;
    if (!sug) return false;
    const debtor = nameOf(sug.debtor_id);
    const creditor = nameOf(sug.creditor_id);
    const amt = Number(repaymentAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      showError("還款失敗", { error: "還款金額必須大於 0" });
      return false;
    }
    if (amt > sug.amount) {
      showError("還款失敗", { error: `還款金額不可超過 $${sug.amount.toLocaleString()}` });
      return false;
    }
    
    setLoading(true);
    try {
      const payload = {
        workspace_id: WORKSPACE_ID,
        from,
        to,
        debtor_id: sug.debtor_id,
        creditor_id: sug.creditor_id,
        amount: amt,
        note: `跨月累計至 ${to} 整筆還款結清`,
        request_key: crypto.randomUUID(),
      };
      const res = await fetch("/api/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const j = await fetchJson(res);
      if (!j.ok) {
        showError("還款失敗", j.data);
        return false;
      }
      
      showOk("還款成功", `${debtor} 已成功還款給 ${creditor}：$${amt}`);
      await loadSettlement();
      return true;
    } catch (error: unknown) {
      showError("還款失敗", error);
      return false;
    } finally {
      setLoading(false);
    }
  }

  function requestSettleOneSplit(line: SplitLine) {
    const amt = Number(settleInput[line.split_id] ?? 0);

    if (!amt || amt <= 0) return showError("結清失敗", { error: "結清金額需大於 0" });
    if (amt > line.remaining_amount)
      return showError("結清失敗", { error: `不可大於待結清（最多 ${line.remaining_amount}）` });

    const actionKey = `settle:${line.split_id}`;

    openConfirm({
      title: "確認結清",
      description:
        `${nameOf(line.debtor_id)} → ${nameOf(line.creditor_id)}：${amt}\n` +
        `（split：${line.split_amount}，待結清：${line.remaining_amount}）`,
      confirmText: "確認結清",
      cancelText: "取消",
      danger: false,
      actionKey,
      onConfirm: async () => {
        if (busy[actionKey]) return;

        setBusy((p) => ({ ...p, [actionKey]: true }));
        try {
          const payload = {
            workspace_id: WORKSPACE_ID,
            from,
            to,
            split_id: line.split_id,
            amount: amt,
            note: `跨月累計至 ${to} split 結清`,
            request_key: crypto.randomUUID(),
          };

          const res = await fetch(`/api/settlement/${line.split_id}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const j = await fetchJson(res);
          if (!j.ok) return showError("結清失敗", j.data);

          showOk("結清成功", `${nameOf(line.debtor_id)} → ${nameOf(line.creditor_id)}：${amt}`);
          await loadSettlement();
        } catch (e: any) {
          showError("結清失敗", { error: e.message });
        } finally {
          setBusy((p) => ({ ...p, [actionKey]: false }));
        }
      },
    });
  }

  function requestUndoSettlementItem(it: any) {
    const id = String(it?.id || "").trim();
    if (!id) return showError("撤銷失敗", { error: "缺少 settlement_item id" });

    const debtor = nameOf(it?.settlements?.debtor_id);
    const creditor = nameOf(it?.settlements?.creditor_id);
    const amt = it?.amount;

    const actionKey = `undoItem:${id}`;

    openConfirm({
      title: "確認撤銷（單筆）",
      description: `${debtor} → ${creditor}：${amt}\n此動作會移除這筆結清明細。`,
      confirmText: "確認撤銷",
      cancelText: "取消",
      danger: true,
      actionKey,
      onConfirm: async () => {
        if (busy[actionKey]) return;

        setBusy((p) => ({ ...p, [actionKey]: true }));
        try {
          const res = await fetch(`/api/settlement/items/${id}?workspace_id=${WORKSPACE_ID}`, {
            method: "DELETE",
          });

          const j = await fetchJson(res);
          if (!j.ok) return showError("撤銷失敗", j.data);

          showOk("撤銷成功", `${debtor} → ${creditor}：${amt}`);
          await loadSettlement();
        } catch (e: any) {
          showError("撤銷失敗", { error: e.message });
        } finally {
          setBusy((p) => ({ ...p, [actionKey]: false }));
        }
      },
    });
  }

  function requestUndoWholeSettlement(row: any) {
    const settlementId = String(row?.id || "").trim();
    if (!settlementId) return showError("撤銷失敗", { error: "缺少 settlement id" });

    const debtor = nameOf(row?.debtor_id);
    const creditor = nameOf(row?.creditor_id);
    const amt = row?.amount;
    const period = `${row?.from_date || "?"} ~ ${row?.to_date || "?"}`;

    const actionKey = `undoSet:${settlementId}`;

    openConfirm({
      title: "確認撤銷（整筆結算）",
      description: `${debtor} → ${creditor}：${amt}\n期間：${period}\n\n⚠️ 會刪除此結算底下所有明細`,
      confirmText: "確認撤銷整筆",
      cancelText: "取消",
      danger: true,
      actionKey,
      onConfirm: async () => {
        if (busy[actionKey]) return;

        setBusy((p) => ({ ...p, [actionKey]: true }));
        try {
          const res = await fetch(`/api/settlement/${settlementId}?workspace_id=${WORKSPACE_ID}`, {
            method: "DELETE",
          });

          const j = await fetchJson(res);
          if (!j.ok) return showError("撤銷失敗", j.data);

          showOk("撤銷成功", `${debtor} → ${creditor}：${amt}`);
          await loadSettlement();
        } catch (e: any) {
          showError("撤銷失敗", { error: e.message });
        } finally {
          setBusy((p) => ({ ...p, [actionKey]: false }));
        }
      },
    });
  }

  const netCards = useMemo(() => {
    // net: + = 應收, - = 應付
    return (net ?? []).map((n) => {
      const amt = Number(n.amount || 0);
      return {
        payer_id: n.payer_id,
        net: amt,
        receivable: amt > 0 ? amt : 0,
        payable: amt < 0 ? Math.abs(amt) : 0,
      };
    });
  }, [net]);

  const dialogBusy = !!(confirmState?.actionKey && busy[confirmState.actionKey]);

  return (
    <main className="app-page">
      <div className="app-page-inner">
        <div className="app-header">
          <div className="flex w-full flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-amber-50 text-amber-600 p-2 rounded-lg border border-amber-100">
                <Calculator className="w-5 h-5" />
              </div>
              <h1 className="text-lg font-black text-slate-800">拆帳結算</h1>
            </div>

            <div className="flex gap-2">
              <button
                className="btn btn-ghost btn-sm hidden h-9 min-h-0 rounded-lg font-bold text-slate-500 hover:bg-slate-100 sm:inline-flex"
                onClick={() => router.push("/")}
              >
                回首頁
              </button>
              <button
                className="btn btn-outline btn-sm hidden h-9 min-h-0 rounded-lg border-slate-300 font-bold hover:bg-slate-100 hover:text-slate-700 sm:inline-flex"
                onClick={() => router.push("/ledger")}
              >
                <ArrowLeft className="w-4 h-4" /> 記帳本
              </button>
            </div>
          </div>

          {!WORKSPACE_ID && (
            <div className="px-4 pb-3">
              <div className="alert alert-warning rounded-2xl py-3 text-sm">
                <span>未設定 WORKSPACE_ID（請檢查 .env.local）</span>
              </div>
            </div>
          )}
        </div>

        {/* Dashboard Stats */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SettlementNav active="settlement" />
          <button type="button" className="btn btn-outline btn-sm rounded-lg border-emerald-200 font-bold text-emerald-700"
            onClick={() => exportReconciliation()} title="匯出完整結算對帳明細">
            <Download className="h-4 w-4" aria-hidden="true" />匯出對帳
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Control Panel */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-500">
                  結算期間
                </span>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="font-black text-slate-800">跨月累計</div>
                <div className="mt-1 text-xs text-slate-500">自最早紀錄累計至今日</div>
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>
                  {from} ~ {to}
                </span>
                <button
                  className="flex items-center gap-1 text-amber-600 hover:text-amber-700 font-bold transition-colors"
                  onClick={loadSettlement}
                  disabled={loading}
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                  刷新
                </button>
              </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="grid h-full grid-cols-2 lg:grid-cols-4">
                <div className="flex min-h-24 flex-col justify-center px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-400">
                      拆帳總額
                    </span>
                  </div>
                  <div className="text-xl font-black tabular-nums text-slate-800">
                    ${totals.split_amount.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{splits.length} 筆記錄</div>
                </div>

                <div className="flex min-h-24 flex-col justify-center border-l border-slate-100 px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-blue-600">
                      結算前淨欠款
                    </span>
                  </div>
                  <div className="text-xl font-black tabular-nums text-blue-700">
                    ${totals.pre_settlement_amount.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {preSettlementSuggestions[0]
                      ? `${nameOf(preSettlementSuggestions[0].debtor_id)} → ${nameOf(preSettlementSuggestions[0].creditor_id)}`
                      : "雙向互抵後"}
                  </div>
                </div>

                <div className="flex min-h-28 flex-col justify-center border-t border-emerald-100 bg-emerald-50/60 px-4 py-3 lg:border-l lg:border-t-0">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-black text-emerald-700">
                      已結清
                    </span>
                  </div>
                  <div className="mt-2 text-xl font-black tabular-nums text-emerald-700">
                    ${totals.settled_amount.toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs font-medium text-emerald-700/70">依結算紀錄加總</div>
                </div>

                <div className="flex min-h-28 flex-col justify-center border-l border-t border-amber-100 bg-amber-50/70 px-4 py-3 lg:border-t-0">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                      <History className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-black text-amber-700">
                      待結清
                    </span>
                  </div>
                  <div className="mt-2 text-xl font-black tabular-nums text-amber-700">
                    ${totals.remaining_amount.toLocaleString()}
                  </div>
                  <div className="mt-1 truncate text-xs font-medium text-amber-700/70">
                    {suggestions[0]
                      ? `${nameOf(suggestions[0].debtor_id)} → ${nameOf(suggestions[0].creditor_id)}`
                      : "已互抵完成"}
                  </div>
                </div>
              </div>
          </div>
        </div>

        {diagnostics.overallocated_split_count > 0 && (
          <div className="alert border border-rose-200 bg-rose-50 text-rose-900 rounded-2xl">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <div>
              <div className="font-black">歷史結算明細需要對帳</div>
              <div className="text-sm">
                發現 {diagnostics.overallocated_split_count} 筆拆帳被重複或超額分配，
                超額連結合計 ${diagnostics.overallocated_amount.toLocaleString()}。
                目前淨額以結算批次總額計算，既有資料未被修改；請用「匯出對帳」查看明細。
              </div>
            </div>
          </div>
        )}

        {/* Net Status */}
        <div className="card bg-white shadow-sm border border-slate-200 rounded-3xl overflow-hidden">
          <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
              <h3 className="text-lg font-black text-slate-800">
                目前淨額
              </h3>
            </div>
          </div>

          {/* 應收 / 應付 / 淨額 卡片 */}
          <div className="px-6 py-4 border-b border-slate-100 bg-white">
            {netCards.length === 0 ? null : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {netCards.map((x) => (
                  <div
                    key={x.payer_id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-black text-slate-800">{nameOf(x.payer_id)}</div>
                      <div
                        className={`text-xs font-black px-2 py-1 rounded-lg ${
                          x.net > 0
                            ? "bg-emerald-100 text-emerald-700"
                            : x.net < 0
                            ? "bg-rose-100 text-rose-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        淨額 {x.net > 0 ? "+" : ""}
                        {x.net.toLocaleString()}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-white border border-slate-200 p-3">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          應收
                        </div>
                        <div className="mt-1 font-black text-emerald-600 tabular-nums">
                          {x.receivable.toLocaleString()}
                        </div>
                      </div>
                      <div className="rounded-xl bg-white border border-slate-200 p-3">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          應付
                        </div>
                        <div className="mt-1 font-black text-rose-600 tabular-nums">
                          {x.payable.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-0">
            {net.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm opacity-60">無待結清款項</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr className="bg-white border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wide">
                      <th className="pl-8 py-4">成員</th>
                      <th className="text-right pr-8">淨額 (應收/應付)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {net.map((n) => (
                      <tr
                        key={n.payer_id}
                        className="hover:bg-amber-50/20 border-b border-slate-50 last:border-0 transition-colors"
                      >
                        <td className="pl-8 font-bold text-slate-700 text-base">
                          {nameOf(n.payer_id)}
                        </td>
                        <td
                          className={`pr-8 text-right font-black font-mono text-lg ${
                            n.amount > 0
                              ? "text-emerald-500"
                              : n.amount < 0
                              ? "text-rose-500"
                              : "text-slate-400"
                          }`}
                        >
                          {n.amount > 0 ? "+" : ""}
                          {n.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Suggested Repayments */}
        <div className="card bg-white shadow-sm border border-slate-200 rounded-3xl overflow-hidden">
          <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">
                建議還款
              </h3>
            </div>
            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
              建議結果
            </span>
          </div>

          <div className="p-6">
            {suggestions.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm opacity-60">
                本期帳務已完全結清，無需進行任何還款。
              </div>
            ) : (
              <div className="space-y-4">
                {suggestions.map((sug, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-rose-100 text-rose-700 font-bold px-3 py-1 rounded-xl text-sm">
                        {nameOf(sug.debtor_id)}
                      </div>
                      <div className="text-slate-400 font-medium text-xs">應還款給</div>
                      <div className="bg-emerald-100 text-emerald-700 font-bold px-3 py-1 rounded-xl text-sm">
                        {nameOf(sug.creditor_id)}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 justify-between sm:justify-end">
                      <div className="font-mono font-black text-lg text-slate-800">
                        ${sug.amount.toLocaleString()}
                      </div>
                      <button
                        className="btn btn-sm bg-amber-500 hover:bg-amber-600 border-none text-white font-bold rounded-xl shadow-sm px-4"
                        onClick={() => requestLumpSumRepayment(sug)}
                        disabled={loading}
                      >
                        整筆還款 / 結清
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detailed Splits */}
        <div className="card bg-white shadow-sm border border-slate-200 rounded-3xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
            <div className="flex items-center gap-3">
              <Layers className="w-4 h-4 text-slate-400" />
              <h3 className="text-lg font-black text-slate-800 tracking-tight">本期拆帳來源明細</h3>
            </div>
            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
              拆帳明細
            </span>
          </div>

          <div className="overflow-x-auto">
            {splits.length === 0 ? (
              <div className="p-16 text-center text-slate-400 opacity-60">本期無拆帳明細</div>
            ) : (
              <table className="table w-full">
                <thead>
                  <tr className="text-slate-400 text-xs font-bold uppercase tracking-wide bg-white border-b border-slate-100">
                    <th className="pl-8 py-4">日期</th>
                    <th>應收者</th>
                    <th>應付者</th>
                    <th className="text-right">總額</th>
                    <th className="text-right">已結</th>
                    <th className="text-right">剩餘</th>
                    <th className="text-right w-32">本次結清</th>
                    <th className="pr-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {displaySplits.map((s) => {
                    const disabled = s.remaining_amount <= 0;
                    const actionKey = `settle:${s.split_id}`;
                    const isBusy = !!busy[actionKey];

                    return (
                      <tr
                        key={s.split_id}
                        className="group hover:bg-amber-50/20 border-b border-slate-50 last:border-0 transition-colors"
                      >
                        <td className="pl-8 font-medium text-slate-600 whitespace-nowrap text-sm font-mono">
                          {s.entry_date}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                              {nameOf(s.creditor_id).charAt(0)}
                            </div>
                            <span className="font-bold text-slate-700">{nameOf(s.creditor_id)}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-xs font-bold">
                              {nameOf(s.debtor_id).charAt(0)}
                            </div>
                            <span className="font-bold text-slate-700">{nameOf(s.debtor_id)}</span>
                          </div>
                        </td>
                        <td className="text-right font-black font-mono text-slate-800">
                          ${s.split_amount}
                        </td>
                        <td className="text-right font-mono text-slate-400 font-medium">
                          ${s.settled_amount}
                        </td>
                        <td className="text-right">
                          <div
                            className={`font-mono font-black ${
                              s.remaining_amount > 0 ? "text-rose-500" : "text-slate-400"
                            }`}
                          >
                            ${s.remaining_amount}
                          </div>
                          <span
                            className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-[10px] font-black ${
                              s.remaining_amount > 0
                                ? "bg-amber-50 text-amber-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {s.remaining_amount > 0 ? "未結清" : "已結清"}
                          </span>
                        </td>
                        <td className="text-right">
                          <input
                            type="number"
                            className="input input-bordered input-sm w-24 text-right font-bold rounded-lg focus:border-amber-500 disabled:bg-slate-50 disabled:text-slate-300"
                            value={settleInput[s.split_id] ?? 0}
                            disabled={disabled || isBusy}
                            onChange={(e) =>
                              setSettleInput((prev) => ({
                                ...prev,
                                [s.split_id]: Number(e.target.value),
                              }))
                            }
                          />
                        </td>
                        <td className="text-right pr-8">
                          <button
                            className="btn btn-sm bg-amber-500 hover:bg-amber-600 border-none text-white font-bold shadow-md shadow-amber-500/20 rounded-lg disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                            disabled={disabled || isBusy}
                            onClick={() => requestSettleOneSplit(s)}
                          >
                            {isBusy ? "..." : "結清"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* History Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Settled Items */}
          <div className="card bg-white shadow-sm border border-slate-200 rounded-3xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">
                累計已結清項目
              </h3>
            </div>
            <div className="overflow-x-auto max-h-96">
              {settledItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 opacity-60">尚無紀錄</div>
              ) : (
                <table className="table table-sm w-full">
                  <thead>
                    <tr className="text-slate-400">
                      <th className="pl-6">時間</th>
                      <th>內容</th>
                      <th className="text-right pr-6">金額</th>
                      <th className="text-right pr-6"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {settledItems.map((it: any) => {
                      const actionKey = `undoItem:${it.id}`;
                      const isBusy = !!busy[actionKey];
                      return (
                        <tr key={it.id} className="border-slate-50 hover:bg-slate-50">
                          <td className="pl-6 text-xs text-slate-400 whitespace-nowrap font-mono">
                            {String(it.created_at || "").replace("T", " ").slice(5, 16)}
                          </td>
                          <td>
                            <div className="flex items-center gap-1 text-xs font-bold text-slate-600">
                              {nameOf(it.settlements?.debtor_id)}
                              <ArrowRight className="w-3 h-3 text-slate-300" />
                              {nameOf(it.settlements?.creditor_id)}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                              {it.settlements?.note || "—"}
                            </div>
                          </td>
                          <td className="text-right pr-6 font-mono font-bold text-emerald-600">
                            ${it.amount}
                          </td>
                          <td className="text-right pr-6">
                            <button
                              className="btn btn-xs rounded-lg bg-rose-100 hover:bg-rose-200 border-none text-rose-700 font-bold disabled:opacity-60"
                              disabled={isBusy}
                              onClick={() => requestUndoSettlementItem(it)}
                            >
                              {isBusy ? "..." : "撤銷"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Recent Settlements */}
          <div className="card bg-white shadow-sm border border-slate-200 rounded-3xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <History className="w-4 h-4 text-amber-500" />
              <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">
                近期結算紀錄
              </h3>
            </div>
            <div className="overflow-x-auto max-h-96">
              {recent.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 opacity-60">尚無紀錄</div>
              ) : (
                <table className="table table-sm w-full">
                  <thead>
                    <tr className="text-slate-400">
                      <th className="pl-6">時間</th>
                      <th>內容</th>
                      <th className="text-right pr-6">金額</th>
                      <th className="text-right pr-6"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r: any) => {
                      const actionKey = `undoSet:${r.id}`;
                      const isBusy = !!busy[actionKey];

                      return (
                        <tr key={r.id} className="border-slate-50 hover:bg-slate-50">
                          <td className="pl-6 text-xs text-slate-400 whitespace-nowrap font-mono">
                            {String(r.created_at || "").replace("T", " ").slice(0, 10)}
                          </td>

                          <td>
                            <div className="flex items-center gap-1 text-xs font-bold text-slate-600">
                              {nameOf(r.debtor_id)}
                              <ArrowRight className="w-3 h-3 text-slate-300" />
                              {nameOf(r.creditor_id)}
                            </div>

                            <div className="text-[10px] text-slate-400">
                              {r.from_date} ~ {r.to_date}
                            </div>
                          </td>

                          <td className="text-right pr-6 font-mono font-bold text-slate-800">
                            ${r.amount}
                          </td>

                          <td className="text-right pr-6">
                            <div className="flex justify-end gap-1">
                            <button
                              className="btn btn-xs rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700"
                              onClick={() => exportReconciliation(r.id)}
                              title="匯出此筆結算明細"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              className="btn btn-xs rounded-lg bg-rose-100 hover:bg-rose-200 border-none text-rose-700 font-bold disabled:opacity-60"
                              disabled={isBusy}
                              onClick={() => requestUndoWholeSettlement(r)}
                            >
                              {isBusy ? "..." : "整筆撤銷"}
                            </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Global Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <span className="loading loading-spinner loading-lg text-amber-500"></span>
              <span className="text-sm font-bold text-amber-600 animate-pulse">計算中...</span>
            </div>
          </div>
        )}

        {/* Confirm Dialog (Shadcn) */}
        <AlertDialog
          open={!!confirmState}
          onOpenChange={(open) => {
            if (!open) {
              if (dialogBusy) return;
              closeConfirm();
            }
          }}
        >
          <AlertDialogContent className={`whitespace-pre-line ${dialogBusy ? "opacity-95" : ""}`}>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmState?.title}</AlertDialogTitle>
              {confirmState?.description ? (
                <AlertDialogDescription className="whitespace-pre-line">
                  {confirmState.description}
                </AlertDialogDescription>
              ) : null}
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel onClick={closeConfirm} disabled={dialogBusy}>
                {dialogBusy ? "處理中…" : confirmState?.cancelText || "取消"}
              </AlertDialogCancel>

              <AlertDialogAction
                disabled={dialogBusy}
                className={
                  confirmState?.danger
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }
                onClick={async () => {
                  const fn = confirmState?.onConfirm;
                  const key = confirmState?.actionKey;

                  if (key && busy[key]) return;
                  if (fn) await fn();
                  closeConfirm();
                }}
              >
                {dialogBusy ? "處理中…" : confirmState?.confirmText || "確認"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <TextInputDialog
          open={repaymentSuggestion !== null}
          title="整筆還款／結清"
          description={
            repaymentSuggestion
              ? `${nameOf(repaymentSuggestion.debtor_id)} 還款給 ${nameOf(repaymentSuggestion.creditor_id)}，最多可輸入 $${repaymentSuggestion.amount.toLocaleString()}。`
              : undefined
          }
          label="本次還款金額"
          value={repaymentAmount}
          inputMode="decimal"
          busy={loading}
          confirmLabel="確認還款"
          onValueChange={setRepaymentAmount}
          onConfirm={confirmLumpSumRepayment}
          onOpenChange={(open) => {
            if (!open) setRepaymentSuggestion(null);
          }}
        />
      </div>

    </main>
  );
}
