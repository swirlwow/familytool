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
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
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
const DRAFT_PREFIX = "[DRAFT] ";

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
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

async function createDraft(workspace_id: string, from: string, to: string) {
  const res = await fetch("/api/settlement/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace_id, from, to, replace: 1 }),
  });
  const text = await res.text();
  const j = safeJsonParse(text) ?? { error: text || `HTTP ${res.status}` };
  if (!res.ok) throw new Error(j?.error || "產生草稿失敗");
  return j;
}

async function clearDraft(workspace_id: string, from: string, to: string) {
  const res = await fetch("/api/settlement/draft/clear", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace_id, from, to }),
  });

  const text = await res.text();
  let j: any = null;
  try {
    j = JSON.parse(text);
  } catch {
    j = { error: text || `HTTP ${res.status}` };
  }

  if (!res.ok) throw new Error(j?.error || "清除草稿失敗");
  return j;
}

async function confirmDraft(workspace_id: string, from: string, to: string) {
  const res = await fetch("/api/settlement/draft/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace_id, from, to }),
  });

  const text = await res.text();
  let j: any = null;
  try {
    j = JSON.parse(text);
  } catch {
    j = { error: text || `HTTP ${res.status}` };
  }

  if (!res.ok) throw new Error(j?.error || "確認草稿失敗");
  return j;
}

export default function SettlementPage() {
  const router = useRouter();
  const { toast } = useToast();

  const today = new Date();
  const [month, setMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  );
  const [cumulative, setCumulative] = useState(false);

  const baseRange = useMemo(() => monthRange(month), [month]);
  const from = cumulative ? "2000-01-01" : baseRange.from;
  const to = baseRange.to;

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

  // 每筆 split 的「這次要結清多少」
  const [settleInput, setSettleInput] = useState<Record<string, number>>({});

  // busy map: prevent double click
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  // Confirm dialog
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  function showOk(title: string, description?: string) {
    toast({ title, description: description || "" });
  }

  function showError(title: string, raw: any) {
    const msg =
      typeof raw === "string"
        ? raw
        : raw?.error
        ? String(raw.error)
        : raw?.message
        ? String(raw.message)
        : "操作失敗";
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
        setSettleInput({});
        return;
      }

      setNet(Array.isArray(j.net) ? j.net : []);
      setRecent(Array.isArray(j.recent_settlements) ? j.recent_settlements : []);
      setSplits(Array.isArray(j.splits) ? j.splits : []);
      setSettledItems(Array.isArray(j.settled_items) ? j.settled_items : []);

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
      setSettleInput({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSettlement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, cumulative, payers.length]);

  async function doCreateDraft() {
    if (!WORKSPACE_ID) return;
    try {
      setLoading(true);
      await createDraft(WORKSPACE_ID, from, to);
      showOk("已產生本期草稿", "可在「近期結算紀錄」看到 DRAFT 標記");
      await loadSettlement();
    } catch (e: any) {
      showError("產生草稿失敗", e?.message);
    } finally {
      setLoading(false);
    }
  }

  async function doConfirmDraft() {
    if (!WORKSPACE_ID) return;
    try {
      setLoading(true);
      const j = await confirmDraft(WORKSPACE_ID, from, to);
      showOk("已確認草稿", `共 ${j?.confirmed ?? 0} 筆`);
      await loadSettlement();
    } catch (e: any) {
      showError("確認草稿失敗", e?.message);
    } finally {
      setLoading(false);
    }
  }

  async function doClearDraft() {
    if (!WORKSPACE_ID) return;
    try {
      setLoading(true);
      const j = await clearDraft(WORKSPACE_ID, from, to);
      showOk("已清除草稿", `共刪除 ${j?.deleted ?? 0} 筆`);
      await loadSettlement();
    } catch (e: any) {
      showError("清除草稿失敗", e?.message);
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
            note: `${month}${cumulative ? "（累計）" : ""} split 結清`,
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

  const sumSplit = useMemo(() => splits.reduce((s, x) => s + Number(x.split_amount || 0), 0), [splits]);
  const sumSettled = useMemo(
    () => splits.reduce((s, x) => s + Number(x.settled_amount || 0), 0),
    [splits]
  );
  const sumRemaining = useMemo(
    () => splits.reduce((s, x) => s + Number(x.remaining_amount || 0), 0),
    [splits]
  );

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
    <main className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* ✅ Header：改為「黏住頂部 + 縮小」(對齊記帳頁) */}
        <div className="card bg-white/90 backdrop-blur-md shadow-sm border border-slate-200 rounded-2xl sticky top-0 z-40">
          <div className="card-body p-3 flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-amber-50 text-amber-600 p-2 rounded-lg border border-amber-100">
                <Calculator className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-slate-800">建議結算</h1>
                <div className="badge badge-sm bg-amber-100 text-amber-700 border-none font-bold hidden sm:inline-flex">
                  Settlement
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                className="btn btn-ghost btn-sm h-9 min-h-0 rounded-xl font-bold text-slate-500 hover:bg-slate-100"
                onClick={() => router.push("/")}
              >
                回首頁
              </button>
              <button
                className="btn btn-outline btn-sm h-9 min-h-0 rounded-xl font-bold border-slate-300 hover:bg-slate-100 hover:text-slate-700 gap-2"
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Control Panel */}
          <div className="card bg-white shadow-sm border border-slate-200 rounded-3xl">
            <div className="card-body p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  結算期間
                </span>
              </div>

              <input
                type="month"
                className="input input-bordered w-full font-bold text-lg bg-slate-50 border-slate-200 focus:border-amber-500 rounded-xl"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />

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

              <div className="mt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="toggle toggle-warning toggle-xs"
                    checked={cumulative}
                    onChange={(e) => setCumulative(e.target.checked)}
                  />
                  <span className="text-xs font-bold text-slate-500">跨月累計</span>
                </label>
              </div>

              {/* ✅ 桌機維持原位；手機改到底部 sticky bar */}
              <div className="mt-3 grid grid-cols-1 gap-2 hidden md:grid">
                <button
                  className="btn btn-sm bg-amber-600 hover:bg-amber-700 border-none text-white font-bold rounded-xl"
                  disabled={loading || !WORKSPACE_ID}
                  onClick={doCreateDraft}
                >
                  一鍵產生草稿
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 border-none text-white font-bold rounded-xl"
                    disabled={loading || !WORKSPACE_ID}
                    onClick={doConfirmDraft}
                  >
                    確認草稿
                  </button>

                  <button
                    className="btn btn-sm bg-slate-200 hover:bg-slate-300 border-none text-slate-700 font-bold rounded-xl"
                    disabled={loading || !WORKSPACE_ID}
                    onClick={doClearDraft}
                  >
                    清除草稿
                  </button>
                </div>

                <div className="mt-2 text-[10px] text-slate-400">
                  草稿會以 <span className="font-mono">{DRAFT_PREFIX}</span> 標記在 note（不影響既有結清功能）
                </div>
              </div>

              {/* ✅ 手機：只保留提示文字（按鈕移到底部） */}
              <div className="mt-3 md:hidden text-[10px] text-slate-400">
                草稿會以 <span className="font-mono">{DRAFT_PREFIX}</span> 標記在 note（不影響既有結清功能）
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="card bg-white shadow-sm border border-slate-200 rounded-3xl md:col-span-3">
            <div className="card-body p-5">
              <div className="grid grid-cols-3 gap-4 h-full">
                <div className="flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      拆帳總額
                    </span>
                    <span className="badge badge-xs bg-slate-100 text-slate-500 border-none hidden lg:inline-flex">
                      Total
                    </span>
                  </div>
                  <div className="text-2xl lg:text-3xl font-black tabular-nums text-slate-800">
                    ${sumSplit.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{splits.length} 筆記錄</div>
                </div>

                <div className="flex flex-col justify-center border-l border-slate-100 pl-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">
                      已結清
                    </span>
                    <span className="badge badge-xs bg-emerald-100 text-emerald-600 border-none hidden lg:inline-flex">
                      Settled
                    </span>
                  </div>
                  <div className="text-2xl lg:text-3xl font-black tabular-nums text-emerald-500">
                    ${sumSettled.toLocaleString()}
                  </div>
                </div>

                <div className="flex flex-col justify-center border-l border-slate-100 pl-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">
                      待結清
                    </span>
                    <span className="badge badge-xs bg-amber-100 text-amber-600 border-none hidden lg:inline-flex">
                      Remaining
                    </span>
                  </div>
                  <div className="text-2xl lg:text-3xl font-black tabular-nums text-amber-500">
                    ${sumRemaining.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Net Status */}
        <div className="card bg-white shadow-sm border border-slate-200 rounded-3xl overflow-hidden">
          <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">
                目前淨額 (Net Status)
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

        {/* Detailed Splits */}
        <div className="card bg-white shadow-sm border border-slate-200 rounded-3xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
            <div className="flex items-center gap-3">
              <Layers className="w-4 h-4 text-slate-400" />
              <h3 className="text-lg font-black text-slate-800 tracking-tight">本期拆帳來源明細</h3>
            </div>
            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
              Ledger Splits
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
                    <th>應收 (Creditor)</th>
                    <th>欠款 (Debtor)</th>
                    <th className="text-right">總額</th>
                    <th className="text-right">已結</th>
                    <th className="text-right">剩餘</th>
                    <th className="text-right w-32">本次結清</th>
                    <th className="pr-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {splits.map((s) => {
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
                        <td
                          className={`text-right font-mono font-black ${
                            s.remaining_amount > 0 ? "text-rose-500" : "text-slate-300"
                          }`}
                        >
                          ${s.remaining_amount}
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
                本期已結清項目
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

                      const note = String(r.note || "");
                      const isDraft = note.startsWith("[DRAFT]");

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

                              {isDraft && (
                                <span className="badge badge-xs bg-slate-200 text-slate-600 border-none ml-2">
                                  DRAFT
                                </span>
                              )}
                            </div>

                            <div className="text-[10px] text-slate-400">
                              {r.from_date} ~ {r.to_date}
                            </div>
                          </td>

                          <td className="text-right pr-6 font-mono font-bold text-slate-800">
                            ${r.amount}
                          </td>

                          <td className="text-right pr-6">
                            <button
                              className="btn btn-xs rounded-lg bg-rose-100 hover:bg-rose-200 border-none text-rose-700 font-bold disabled:opacity-60"
                              disabled={isBusy}
                              onClick={() => {
                                if (isDraft) {
                                  openConfirm({
                                    title: "清除本期草稿？",
                                    description:
                                      "會刪除本期所有 DRAFT 結算與明細。\n此動作無法復原。",
                                    confirmText: "確認清除",
                                    cancelText: "取消",
                                    danger: true,
                                    actionKey: `clearDraft:${from}:${to}`,
                                    onConfirm: async () => {
                                      try {
                                        await doClearDraft();
                                      } catch (e: any) {
                                        showError("清除失敗", e?.message);
                                      }
                                    },
                                  });
                                } else {
                                  requestUndoWholeSettlement(r);
                                }
                              }}
                            >
                              {isBusy ? "..." : isDraft ? "刪除草稿" : "整筆撤銷"}
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
      </div>

      {/* ✅ 手機底部 Sticky Bar：三顆大按鈕更好按 */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40">
        <div className="bg-white/95 backdrop-blur border-t border-slate-200 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <div className="grid grid-cols-3 gap-2">
            <button
              className="btn h-12 min-h-0 rounded-2xl bg-amber-600 hover:bg-amber-700 border-none text-white font-black disabled:bg-slate-200 disabled:text-slate-400"
              disabled={loading || !WORKSPACE_ID}
              onClick={doCreateDraft}
            >
              產生草稿
            </button>

            <button
              className="btn h-12 min-h-0 rounded-2xl bg-emerald-600 hover:bg-emerald-700 border-none text-white font-black disabled:bg-slate-200 disabled:text-slate-400"
              disabled={loading || !WORKSPACE_ID}
              onClick={doConfirmDraft}
            >
              確認草稿
            </button>

            <button
              className="btn h-12 min-h-0 rounded-2xl bg-slate-200 hover:bg-slate-300 border-none text-slate-700 font-black disabled:bg-slate-200 disabled:text-slate-400"
              disabled={loading || !WORKSPACE_ID}
              onClick={doClearDraft}
            >
              清除草稿
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}