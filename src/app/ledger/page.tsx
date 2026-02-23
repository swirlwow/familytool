// src/app/ledger/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { WORKSPACE_ID } from "@/lib/appConfig";
import {
  Calendar,
  TrendingDown,
  TrendingUp,
  Plus,
  Edit3,
  Trash2,
  Split,
  Wallet,
  User,
  CreditCard,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { useLedgerMonth } from "@/hooks/useLedgerMonth";
import { useMasterData } from "@/hooks/useMasterData";

// ===== Types =====
type SplitRow = { payer_id: string; amount: number };

type Cat = {
  id: string;
  name: string;
  group_name?: string | null;
  sort_order?: number | null;
};

type Payer = { id: string; name: string };
type PayMethod = { id: string; name: string };

type LedgerRow = {
  id: string;
  entry_date: string;
  type: "expense" | "income";
  amount: number;
  category_id?: string | null;
  pay_method?: string | null;
  payer_id?: string | null;
  merchant?: string | null;
  note?: string | null;
  ledger_splits?: Array<{ payer_id: string; amount: number }>;
  bill_instance_id?: string | null;
};

function ymNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export default function LedgerPage() {
  const [ym, setYm] = useState(ymNow());

  // ✅ 這裡一定要 string，避免 Vercel build 看到 string|null 報錯
  const workspaceId: string = WORKSPACE_ID ?? "";

  // Hooks（不改 API）
  const { from, to, rows, loading: rowsLoading, refresh } = useLedgerMonth(
    workspaceId,
    ym
  );

  // ✅ 重點：useMasterData 可能初始是 undefined/null，全部先用 [] 保護
  const master = useMasterData() as any;
  const catsExpense: Cat[] = Array.isArray(master?.catsExpense) ? master.catsExpense : [];
  const catsIncome: Cat[] = Array.isArray(master?.catsIncome) ? master.catsIncome : [];
  const payMethods: PayMethod[] = Array.isArray(master?.payMethods) ? master.payMethods : [];
  const payers: Payer[] = Array.isArray(master?.payers) ? master.payers : [];

  const safeRows: LedgerRow[] = Array.isArray(rows) ? (rows as any) : [];

  // --- 新增表單 State ---
  const [type, setType] = useState<"expense" | "income">("expense");
  const [entryDate, setEntryDate] = useState(todayStr());
  const [amount, setAmount] = useState<number | "">("");
  const [groupName, setGroupName] = useState<string>("");
  const [lastExpenseGroup, setLastExpenseGroup] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [payMethod, setPayMethod] = useState<string>("");
  const [merchant, setMerchant] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [payerId, setPayerId] = useState<string>("");
  const [useSplit, setUseSplit] = useState(false);
  const [splits, setSplits] = useState<SplitRow[]>([]);

  // --- 編輯表單 State ---
  const [editing, setEditing] = useState<LedgerRow | null>(null);
  const [editForm, setEditForm] = useState({
    entry_date: todayStr(),
    type: "expense" as "expense" | "income",
    amount: 0,
    group_name: "",
    category_id: "",
    pay_method: "",
    merchant: "",
    note: "",
    payer_id: "",
    useSplit: false,
    splits: [] as SplitRow[],
  });

  // --- 計算邏輯 ---
  const cats: Cat[] = type === "expense" ? catsExpense : catsIncome;

  const groups = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cats) {
      const g = (c.group_name || "").trim();
      if (!g) continue;
      const so = n(c.sort_order);
      map.set(g, map.has(g) ? Math.min(map.get(g)!, so) : so);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], "zh-Hant"))
      .map(([g]) => g);
  }, [cats]);

  const subcats = useMemo(() => {
    if (!groupName) return [];
    return cats
      .filter((c) => (c.group_name || "").trim() === groupName)
      .sort((a, b) => n(a.sort_order) - n(b.sort_order));
  }, [cats, groupName]);

  const totalExpense = useMemo(
    () => safeRows.filter((r) => r.type === "expense").reduce((a, r) => a + Number(r.amount || 0), 0),
    [safeRows]
  );
  const totalIncome = useMemo(
    () => safeRows.filter((r) => r.type === "income").reduce((a, r) => a + Number(r.amount || 0), 0),
    [safeRows]
  );

  function payerName(id?: string | null) {
    return payers.find((p) => p.id === id)?.name ?? (id || "");
  }

  // ✅ 顯示 大分類 / 小分類
  function catName(id?: string | null) {
    const all = [...catsExpense, ...catsIncome];
    const c = all.find((x) => x.id === id);
    if (!c) return "";
    const g = (c.group_name || "").trim();
    return g ? `${g} / ${c.name}` : c.name;
  }

  // Effect: 切換類型時自動選第一個群組
  useEffect(() => {
    if (type !== "expense") return;
    if (groupName) return;
    if (groups.length > 0) setGroupName(groups[0]);
  }, [groups, type, groupName]);

  // Effect: 記憶支出大分類
  useEffect(() => {
    if (type === "expense") setLastExpenseGroup(groupName || "");
  }, [groupName, type]);

  // Effect: 拆帳自動帶入另一人
  useEffect(() => {
    if (!useSplit) return;
    if (!payerId) return;
    const other = payers.find((p) => p.id !== payerId)?.id || "";
    if (!other) return;
    setSplits((prev) => {
      if (!prev || prev.length === 0) return [{ payer_id: other, amount: 0 }];
      return prev.map((s) => ({ ...s, payer_id: s.payer_id === payerId ? other : s.payer_id }));
    });
  }, [payerId, useSplit, payers]);

  // 驗證拆帳
  function validateSplitLocal(params: {
    type: string;
    amount: number;
    payer_id?: string | null;
    splits: SplitRow[];
  }) {
    const { type, amount, payer_id, splits } = params;
    if (!splits || splits.length === 0) return { ok: true as const };
    if (type !== "expense") return { ok: false as const, error: "拆帳目前只支援『支出』" };
    if (!payer_id) return { ok: false as const, error: "拆帳：請先選擇付款人" };

    let sum = 0;
    for (const s of splits) {
      if (!s.payer_id) return { ok: false as const, error: "拆帳：請選擇應付者" };
      if (s.payer_id === payer_id) return { ok: false as const, error: "拆帳：應付者不可等於付款人" };
      const a = Number(s.amount);
      if (!a || a <= 0) return { ok: false as const, error: "拆帳：金額需大於 0" };
      sum += a;
    }
    if (sum > Number(amount)) return { ok: false as const, error: "拆帳：應付總和不可大於支出金額" };
    return { ok: true as const };
  }

  // --- API 操作 ---
  async function submitNew() {
    if (!WORKSPACE_ID) return alert("未設定 WORKSPACE_ID");
    if (!entryDate) return alert("請選擇日期");
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) return alert("請輸入大於 0 的金額");

    if (useSplit) {
      const check = validateSplitLocal({ type, amount: numAmount, payer_id: payerId || null, splits });
      if (!check.ok) return alert(check.error);
    }

    try {
      const res = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: WORKSPACE_ID,
          entry_date: entryDate,
          type,
          amount: numAmount,
          category_id: categoryId || null,
          pay_method: payMethod || null,
          merchant: merchant || null,
          note: note || null,
          payer_id: payerId || null,
          splits: useSplit ? splits : [],
        }),
      });
      if (res.ok) {
        setAmount(""); // 復原為空
        setNote("");
        setMerchant("");
        setUseSplit(false);
        setSplits([]);
        refresh();
      } else {
        alert("新增失敗");
      }
    } catch {
      alert("新增錯誤");
    }
  }

  async function deleteRow(r: LedgerRow) {
    if (
      !confirm(
        `確定刪除這筆記帳？\n${r.entry_date} ${r.type === "expense" ? "支出" : "收入"} $${r.amount}`
      )
    )
      return;
    await fetch("/api/ledger", {
      method: "DELETE",
      body: JSON.stringify({ workspace_id: WORKSPACE_ID, id: r.id }),
    });
    refresh();
  }

  // 開啟編輯 Modal
  function openEdit(r: LedgerRow) {
    setEditing(r);
    const all = [...catsExpense, ...catsIncome];
    const c = all.find((x) => x.id === (r.category_id || ""));
    const sp = Array.isArray((r as any).ledger_splits) ? (r as any).ledger_splits : [];

    setEditForm({
      entry_date: r.entry_date,
      type: r.type,
      amount: Number(r.amount),
      group_name: c?.group_name || "",
      category_id: (r.category_id as any) || "",
      pay_method: (r.pay_method as any) || "",
      merchant: r.merchant || "",
      note: r.note || "",
      payer_id: (r.payer_id as any) || "",
      useSplit: sp.length > 0,
      splits: sp.map((s: any) => ({ payer_id: s.payer_id, amount: Number(s.amount) })),
    });
  }

  async function submitEdit() {
    if (!editing) return;

    if (editForm.useSplit) {
      const check = validateSplitLocal({
        type: editForm.type,
        amount: editForm.amount,
        payer_id: editForm.payer_id || null,
        splits: editForm.splits,
      });
      if (!check.ok) return alert(check.error);
    }

    const res = await fetch("/api/ledger", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: WORKSPACE_ID,
        id: editing.id,
        ...editForm,
      }),
    });

    if (res.ok) {
      setEditing(null);
      refresh();
    } else {
      alert("修改失敗");
    }
  }

  // 編輯模式的分類計算
  const editCats: Cat[] = editForm.type === "expense" ? catsExpense : catsIncome;

  const editGroups = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of editCats) {
      const g = (c.group_name || "").trim();
      if (!g) continue;
      const so = n(c.sort_order);
      map.set(g, map.has(g) ? Math.min(map.get(g)!, so) : so);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], "zh-Hant"))
      .map(([g]) => g);
  }, [editCats]);

  const editSubcats = useMemo(() => {
    if (!editForm.group_name) return [];
    return editCats
      .filter((c) => (c.group_name || "").trim() === editForm.group_name)
      .sort((a, b) => n(a.sort_order) - n(b.sort_order));
  }, [editCats, editForm.group_name]);

  return (
    // ✅ 手機版 px-2 py-4 靠邊；電腦版維持 md:p-6 lg:p-8 寬敞
    <main className="min-h-screen bg-slate-50 px-2 py-4 md:p-6 lg:p-8 pb-24 md:pb-8">
      {/* ✅ 電腦版維持 max-w-6xl 寬度，不壓縮 */}
      <div className="mx-auto max-w-6xl space-y-4 md:space-y-6">
        
        {/* Sticky Header */}
        <div className="card bg-white/90 backdrop-blur-md shadow-sm border border-slate-200 rounded-2xl sticky top-0 z-40">
          <div className="card-body p-2.5 md:p-3 flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="bg-sky-50 text-sky-600 p-1.5 md:p-2 rounded-lg border border-sky-100">
                <Wallet className="w-5 h-5 md:w-5 md:h-5" />
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-lg font-black text-slate-800 tracking-tight">記帳本</h1>
                <div className="badge badge-sm bg-sky-100 text-sky-700 border-none font-bold hidden sm:inline-flex">
                  Ledger
                </div>
              </div>
            </div>
            <div className="flex gap-1.5 md:gap-2">
              <Link href="/ledger/dashboard" className="btn btn-outline btn-sm h-8 md:h-9 min-h-0 rounded-xl font-bold px-2.5 md:px-3 text-xs md:text-sm text-slate-600 border-slate-300">
                財務儀表板
              </Link>
              <Link
                href="/"
                className="btn btn-ghost btn-sm h-8 md:h-9 min-h-0 rounded-xl font-bold text-slate-500 hover:bg-slate-100 px-2.5 md:px-3 hidden sm:inline-flex"
              >
                回首頁
              </Link>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-3 md:gap-4 sm:grid-cols-3">
          <div className="card bg-white shadow-sm border border-slate-200 rounded-2xl md:rounded-3xl">
            <div className="card-body p-4 md:p-5 flex flex-col justify-center">
              <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
                <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 text-sky-500" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">統計月份</span>
              </div>
              <input
                type="month"
                className="input input-sm md:input-md input-bordered w-full font-bold text-base md:text-lg bg-slate-50 border-slate-200 focus:border-sky-500 rounded-xl"
                value={ym}
                onChange={(e) => setYm(e.target.value)}
              />
              <div className="mt-1.5 md:mt-2 text-[10px] md:text-xs text-slate-400 font-mono tracking-tighter">
                {from} ~ {to}
              </div>
            </div>
          </div>

          <StatCard
            title="本月支出"
            value={`$${totalExpense.toLocaleString()}`}
            theme="rose"
            icon={TrendingDown}
            loading={rowsLoading}
          />
          <StatCard
            title="本月收入"
            value={`$${totalIncome.toLocaleString()}`}
            theme="emerald"
            icon={TrendingUp}
            loading={rowsLoading}
          />
        </div>

        {/* ===== New Entry Form ===== */}
        <div className="card bg-white shadow-md border border-slate-200 rounded-2xl md:rounded-3xl overflow-visible">
          <div className="bg-slate-50/50 px-4 md:px-6 py-3 md:py-4 border-b border-slate-200 flex items-center justify-between rounded-t-2xl md:rounded-t-3xl">
            <h2 className="font-black text-base md:text-lg text-slate-800 flex items-center gap-2">
              <div className="bg-sky-500 text-white p-1 rounded-md md:rounded-lg">
                <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </div>{" "}
              新增記帳
            </h2>
          </div>

          {/* ✅ 手機版縮小 Padding 與 Gap，電腦版維持 md:p-6 與 md:gap-5 */}
          <div className="card-body p-4 md:p-6 space-y-4 md:space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-4 md:gap-5 items-end">
              
              {/* 日期 */}
              <div className="col-span-1 md:col-span-1">
                <label className="label py-0.5 md:py-1 mb-0.5 md:mb-0">
                  <span className="label-text font-bold text-slate-400 text-[11px] md:text-xs uppercase">日期</span>
                </label>
                <input
                  type="date"
                  className="input input-sm md:input-md input-bordered w-full rounded-xl focus:border-sky-500 text-sm md:text-base font-medium"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                />
              </div>

              {/* 類型 */}
              <div className="col-span-1 md:col-span-1">
                <label className="label py-0.5 md:py-1 mb-0.5 md:mb-0">
                  <span className="label-text font-bold text-slate-400 text-[11px] md:text-xs uppercase">類型</span>
                </label>
                <select
                  className={`select select-sm md:select-md select-bordered w-full rounded-xl font-bold focus:border-sky-500 ${
                    type === "expense" ? "text-rose-500" : "text-emerald-500"
                  }`}
                  value={type}
                  onChange={(e: any) => {
                    setType(e.target.value);
                    if (e.target.value === "income") {
                      setGroupName("收入");
                      setCategoryId("");
                    } else {
                      setGroupName(lastExpenseGroup || groups[0] || "");
                      setCategoryId("");
                    }
                    if (e.target.value !== "expense") {
                      setUseSplit(false);
                      setSplits([]);
                    }
                  }}
                >
                  <option value="expense">支出</option>
                  <option value="income">收入</option>
                </select>
              </div>

              {/* 金額 (手機2欄/電腦2欄) */}
              <div className="col-span-2 md:col-span-2">
                <label className="label py-0.5 md:py-1 mb-0.5 md:mb-0">
                  <span className="label-text font-bold text-slate-400 text-[11px] md:text-xs uppercase">金額</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-base md:text-lg font-black text-slate-300">
                    $
                  </span>
                  <input
                    type="number"
                    className="input input-bordered w-full pl-8 md:pl-10 text-lg md:text-xl font-black tabular-nums rounded-xl focus:border-sky-500 h-10 md:h-12"
                    value={amount}
                    placeholder="0"
                    onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
                  />
                </div>
              </div>

              {/* 大分類 */}
              <div className="col-span-1 md:col-span-2">
                <label className="label py-0.5 md:py-1 mb-0.5 md:mb-0">
                  <span className="label-text font-bold text-slate-400 text-[11px] md:text-xs uppercase">大分類</span>
                </label>
                <select
                  className="select select-sm md:select-md select-bordered w-full rounded-xl text-sm md:text-base focus:border-sky-500"
                  value={groupName}
                  onChange={(e) => {
                    setGroupName(e.target.value);
                    setCategoryId("");
                  }}
                >
                  <option value="">（不選）</option>
                  {groups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* 小分類 */}
              <div className="col-span-1 md:col-span-2">
                <label className="label py-0.5 md:py-1 mb-0.5 md:mb-0">
                  <span className="label-text font-bold text-slate-400 text-[11px] md:text-xs uppercase">小分類</span>
                </label>
                <select
                  className="select select-sm md:select-md select-bordered w-full rounded-xl text-sm md:text-base focus:border-sky-500"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={!groupName}
                >
                  <option value="">（不選）</option>
                  {subcats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 付款方式 */}
              <div className="col-span-1 md:col-span-2">
                <label className="label py-0.5 md:py-1 mb-0.5 md:mb-0">
                  <span className="label-text font-bold text-slate-400 text-[11px] md:text-xs uppercase">付款方式</span>
                </label>
                <select
                  className="select select-sm md:select-md select-bordered w-full rounded-xl text-sm md:text-base focus:border-sky-500"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
                  <option value="">（不選）</option>
                  {payMethods.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 付款人 */}
              <div className="col-span-1 md:col-span-2">
                <label className="label py-0.5 md:py-1 mb-0.5 md:mb-0">
                  <span className="label-text font-bold text-slate-400 text-[11px] md:text-xs uppercase">誰先付錢</span>
                </label>
                <select
                  className="select select-sm md:select-md select-bordered w-full rounded-xl text-sm md:text-base font-bold focus:border-sky-500 text-sky-700"
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                >
                  <option value="">（不選）</option>
                  {payers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 店家 */}
              <div className="col-span-2 md:col-span-2">
                <label className="label py-0.5 md:py-1 mb-0.5 md:mb-0">
                  <span className="label-text font-bold text-slate-400 text-[11px] md:text-xs uppercase">店家 / 對象</span>
                </label>
                <input
                  className="input input-sm md:input-md input-bordered w-full rounded-xl text-sm md:text-base focus:border-sky-500"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="例如：7-11"
                />
              </div>

              {/* 備註 */}
              <div className="col-span-2 md:col-span-2">
                <label className="label py-0.5 md:py-1 mb-0.5 md:mb-0">
                  <span className="label-text font-bold text-slate-400 text-[11px] md:text-xs uppercase">備註</span>
                </label>
                <input
                  className="input input-sm md:input-md input-bordered w-full rounded-xl text-sm md:text-base focus:border-sky-500"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="備註..."
                />
              </div>

              {/* Split Bill */}
              <div className="col-span-2 md:col-span-4 mt-2 md:mt-0">
                <div
                  className={`p-3.5 md:p-5 rounded-2xl md:rounded-3xl border transition-all duration-300 ${
                    useSplit ? "bg-sky-50 border-sky-200" : "bg-slate-50 border-slate-100 opacity-60 md:opacity-100"
                  }`}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <label className="flex items-center gap-3 md:gap-4 cursor-pointer">
                      <input
                        type="checkbox"
                        className="toggle toggle-info toggle-sm md:toggle-md"
                        checked={useSplit}
                        onChange={(e) => {
                          if (e.target.checked && type !== "expense") {
                            alert("僅支出可拆帳");
                            return;
                          }
                          setUseSplit(e.target.checked);
                          if (!e.target.checked) setSplits([]);
                          else {
                            const other = payerId ? payers.find((p) => p.id !== payerId)?.id || "" : "";
                            setSplits([{ payer_id: other, amount: 0 }]);
                          }
                        }}
                      />
                      <div className="font-bold text-sm md:text-base text-slate-700 flex items-center gap-1.5 md:gap-2">
                        <Split className="w-3.5 h-3.5 md:w-4 md:h-4 text-sky-500" /> 拆帳 / 代墊分攤
                      </div>
                    </label>
                  </div>

                  {useSplit && (
                    <div className="mt-4 md:mt-5 space-y-3 md:space-y-4">
                      {splits.map((s, idx) => (
                        <div key={idx} className="flex flex-row md:gap-3 items-center gap-2">
                          <div className="flex-1">
                            <select
                              className="select select-bordered select-sm md:select-md w-full rounded-xl font-bold text-xs md:text-sm"
                              value={s.payer_id}
                              onChange={(e) =>
                                setSplits((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, payer_id: e.target.value } : r))
                                )
                              }
                            >
                              <option value="">（應付者）</option>
                              {payers
                                .filter((p) => p.id !== payerId)
                                .map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div className="w-24 md:w-40 relative">
                            <span className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300">
                              $
                            </span>
                            <input
                              type="number"
                              className="input input-bordered input-sm md:input-md w-full pl-6 md:pl-6 font-black rounded-xl text-xs md:text-sm"
                              value={s.amount || ""}
                              onChange={(e) =>
                                setSplits((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, amount: Number(e.target.value) } : r))
                                )
                              }
                            />
                          </div>

                          <button
                            className="btn btn-ghost text-rose-500 btn-sm md:px-4 rounded-xl px-2"
                            onClick={() => setSplits((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="w-4 h-4 md:w-4 md:h-4" />
                            <span className="hidden md:inline ml-1">移除</span>
                          </button>
                        </div>
                      ))}

                      <button
                        className="btn btn-ghost btn-xs md:btn-sm text-sky-600 font-bold"
                        onClick={() => {
                          const other = payerId ? payers.find((p) => p.id !== payerId)?.id || "" : "";
                          setSplits((prev) => [...prev, { payer_id: other, amount: 0 }]);
                        }}
                      >
                        ＋ 新增一位分攤者
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 提交按鈕：手機版 w-full，電腦版靠右 */}
              <div className="col-span-2 md:col-span-4 flex justify-end mt-4 md:mt-2">
                <button
                  className="btn bg-sky-600 hover:bg-sky-700 text-white rounded-xl md:rounded-2xl px-10 font-black shadow-md shadow-sky-200/30 w-full md:w-auto"
                  onClick={submitNew}
                >
                  確認新增
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ===== List ===== */}
        <div className="card bg-white shadow-sm border border-slate-200 rounded-2xl md:rounded-3xl overflow-hidden">
          <div className="px-5 py-4 md:px-8 md:py-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5 md:gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
              <h2 className="text-lg md:text-xl font-black text-slate-800 italic tracking-tight">TRANSACTIONS</h2>
            </div>
            <div className="flex items-center gap-2">
              {rowsLoading && <span className="loading loading-spinner loading-xs text-sky-500"></span>}
              <span className="text-[10px] font-black opacity-40 tracking-widest uppercase">{safeRows.length} 筆</span>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {safeRows.length === 0 ? (
              <div className="p-16 md:p-20 text-center opacity-30 font-black italic text-base md:text-lg">本月尚無任何記帳資料。</div>
            ) : (
              safeRows.map((r) => {
                const sp = Array.isArray(r.ledger_splits) ? r.ledger_splits : [];
                const isExp = r.type === "expense";

                return (
                  <div
                    key={r.id}
                    className="group relative px-4 py-3 md:px-8 md:py-5 hover:bg-slate-50 transition-colors"
                  >
                    {/* 操作按鈕 */}
                    <div className="absolute right-2 md:right-3 top-2.5 md:top-3 flex gap-0.5 md:gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        className="btn btn-ghost btn-xs h-7 w-7 md:h-8 md:w-8 p-0 min-h-0 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50"
                        onClick={() => openEdit(r)}
                        aria-label="編輯"
                      >
                        <Edit3 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      </button>
                      <button
                        className="btn btn-ghost btn-xs h-7 w-7 md:h-8 md:w-8 p-0 min-h-0 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        onClick={() => deleteRow(r)}
                        aria-label="刪除"
                      >
                        <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      </button>
                    </div>

                    <div className="flex items-start gap-3 md:gap-4 min-w-0 pr-14 md:pr-0">
                      <div
                        className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center font-black text-sm md:text-base shrink-0 border-2 ${
                          isExp
                            ? "bg-rose-50 text-rose-500 border-rose-100"
                            : "bg-emerald-50 text-emerald-500 border-emerald-100"
                        }`}
                      >
                        {isExp ? "支" : "收"}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span
                            className={`text-lg md:text-xl font-black tabular-nums tracking-tighter leading-none ${
                              isExp ? "text-rose-500" : "text-emerald-500"
                            }`}
                          >
                            ${Number(r.amount).toLocaleString()}
                          </span>
                          <span className="text-[10px] md:text-xs font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md">
                            {r.entry_date}
                          </span>

                          {sp.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 font-black text-[9px] uppercase">
                              拆帳
                            </span>
                          )}

                          {r.bill_instance_id && (
                            <span className="px-1.5 py-0.5 rounded border border-slate-200 text-slate-400 font-black text-[9px] uppercase">
                              帳單
                            </span>
                          )}
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 md:gap-2 text-xs md:text-sm font-medium text-slate-500">
                          <span className="text-slate-700 font-extrabold border-b-2 border-slate-100 pb-0.5 mr-0.5 md:mr-1">
                            {catName(r.category_id) || "未分類"}
                          </span>

                          {r.pay_method && (
                            <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded-md text-[10px] md:text-xs text-slate-500 border border-slate-200/50 whitespace-nowrap">
                              <CreditCard className="w-2.5 h-2.5 md:w-3 md:h-3" />
                              {r.pay_method}
                            </span>
                          )}

                          {r.payer_id && (
                            <span className="flex items-center gap-1 bg-sky-50 px-1.5 py-0.5 rounded-md text-[10px] md:text-xs text-sky-700 font-bold border border-sky-100 whitespace-nowrap">
                              <User className="w-2.5 h-2.5 md:w-3 md:h-3" />
                              {payerName(r.payer_id)} 先付
                            </span>
                          )}

                          {r.merchant && (
                            <span className="text-indigo-600 font-bold flex items-center ml-0.5 md:ml-1 truncate max-w-[100px] md:max-w-none">
                              @ {r.merchant}
                            </span>
                          )}

                          {r.note && (
                            <span
                              className="text-violet-600 font-normal max-w-[150px] sm:max-w-[220px] md:max-w-[320px] truncate ml-0.5 md:ml-1"
                              title={r.note}
                            >
                              ({r.note})
                            </span>
                          )}
                        </div>

                        {sp.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {sp.map((x, i) => (
                              <div
                                key={i}
                                className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[9px] md:text-[10px] font-black text-slate-500"
                              >
                                {payerName(x.payer_id)}: ${Number(x.amount)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ===== Edit Modal ===== */}
      {editing && (
        <div className="modal modal-open bg-slate-900/40 backdrop-blur-sm p-2 sm:p-0">
          <div className="modal-box w-full max-w-2xl rounded-2xl md:rounded-3xl p-0 shadow-2xl border border-white/20">
            <div className="bg-slate-50 px-5 md:px-8 py-4 md:py-6 flex items-start justify-between border-b border-slate-200">
              <div>
                <h3 className="text-lg md:text-xl font-black text-slate-800">修改記帳內容</h3>
                <div className="text-[10px] md:text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                  Transaction Editor
                </div>
              </div>
              <button className="btn btn-sm btn-circle btn-ghost" onClick={() => setEditing(null)}>
                ✕
              </button>
            </div>

            <div className="p-5 md:p-8 space-y-4 md:space-y-6 max-h-[70vh] overflow-y-auto bg-white">
              <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-4">
                <div className="col-span-1">
                  <label className="label py-0 mb-1">
                    <span className="label-text font-bold text-[10px] opacity-40 uppercase">日期</span>
                  </label>
                  <input
                    type="date"
                    className="input input-sm md:input-md input-bordered w-full rounded-xl font-bold focus:border-sky-500"
                    value={editForm.entry_date}
                    onChange={(e) => setEditForm({ ...editForm, entry_date: e.target.value })}
                  />
                </div>

                <div className="col-span-1">
                  <label className="label py-0 mb-1">
                    <span className="label-text font-bold text-[10px] opacity-40 uppercase">類型</span>
                  </label>
                  <select
                    className="select select-sm md:select-md select-bordered w-full rounded-xl font-bold focus:border-sky-500"
                    value={editForm.type}
                    onChange={(e) => {
                      const t = e.target.value as "expense" | "income";
                      setEditForm({
                        ...editForm,
                        type: t,
                        group_name: t === "income" ? "收入" : "",
                        category_id: "",
                        useSplit: t === "expense" ? editForm.useSplit : false,
                        splits: t === "expense" ? editForm.splits : [],
                      });
                    }}
                  >
                    <option value="expense">支出</option>
                    <option value="income">收入</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="label py-0 mb-1">
                    <span className="label-text font-bold text-[10px] opacity-40 uppercase">金額</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered w-full text-2xl md:text-3xl font-black tabular-nums py-6 md:py-8 rounded-xl focus:border-sky-500"
                    value={editForm.amount || ""}
                    onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })}
                  />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="label py-0 mb-1">
                    <span className="label-text font-bold text-[10px] opacity-40 uppercase">大分類</span>
                  </label>
                  <select
                    className="select select-sm md:select-md select-bordered w-full rounded-xl font-medium focus:border-sky-500"
                    value={editForm.group_name}
                    onChange={(e) => setEditForm({ ...editForm, group_name: e.target.value, category_id: "" })}
                  >
                    <option value="">（不選）</option>
                    {editGroups.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="label py-0 mb-1">
                    <span className="label-text font-bold text-[10px] opacity-40 uppercase">小分類</span>
                  </label>
                  <select
                    className="select select-sm md:select-md select-bordered w-full rounded-xl font-medium focus:border-sky-500"
                    value={editForm.category_id}
                    onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}
                    disabled={!editForm.group_name}
                  >
                    <option value="">（不選）</option>
                    {editSubcats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="label py-0 mb-1">
                    <span className="label-text font-bold text-[10px] opacity-40 uppercase">付款方式</span>
                  </label>
                  <select
                    className="select select-sm md:select-md select-bordered w-full rounded-xl font-medium focus:border-sky-500"
                    value={editForm.pay_method}
                    onChange={(e) => setEditForm({ ...editForm, pay_method: e.target.value })}
                  >
                    <option value="">（不選）</option>
                    {payMethods.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="label py-0 mb-1">
                    <span className="label-text font-bold text-[10px] opacity-40 uppercase">付款人</span>
                  </label>
                  <select
                    className="select select-sm md:select-md select-bordered w-full rounded-xl font-bold text-sky-700 focus:border-sky-500"
                    value={editForm.payer_id}
                    onChange={(e) => {
                      const nextPayer = e.target.value;
                      const other = nextPayer ? payers.find((p) => p.id !== nextPayer)?.id || "" : "";
                      const nextSplits = (editForm.splits || []).map((s) => ({
                        ...s,
                        payer_id: s.payer_id === nextPayer ? other : s.payer_id,
                      }));
                      setEditForm({ ...editForm, payer_id: nextPayer, splits: nextSplits });
                    }}
                  >
                    <option value="">（不選）</option>
                    {payers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="label py-0 mb-1">
                    <span className="label-text font-bold text-[10px] opacity-40 uppercase">店家 / 對象</span>
                  </label>
                  <input
                    className="input input-sm md:input-md input-bordered w-full rounded-xl focus:border-sky-500"
                    value={editForm.merchant}
                    onChange={(e) => setEditForm({ ...editForm, merchant: e.target.value })}
                  />
                </div>

                <div className="col-span-2">
                  <label className="label py-0 mb-1">
                    <span className="label-text font-bold text-[10px] opacity-40 uppercase">備註</span>
                  </label>
                  <input
                    className="input input-sm md:input-md input-bordered w-full rounded-xl focus:border-sky-500"
                    value={editForm.note}
                    onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                  />
                </div>
              </div>

              <div className={`p-4 md:p-6 rounded-2xl border transition-all duration-300 ${editForm.useSplit ? "bg-sky-50 border-sky-200" : "bg-slate-50 border-slate-100"}`}>
                <label className="flex items-center gap-3 cursor-pointer mb-3 md:mb-4">
                  <input
                    type="checkbox"
                    className="toggle toggle-info toggle-sm md:toggle-md"
                    checked={editForm.useSplit}
                    onChange={(e) => {
                      if (e.target.checked && editForm.type !== "expense") {
                        alert("拆帳目前只支援『支出』");
                        return;
                      }
                      if (!e.target.checked) {
                        setEditForm({ ...editForm, useSplit: false, splits: [] });
                        return;
                      }
                      const payer = editForm.payer_id || "";
                      const other = payer ? payers.find((p) => p.id !== payer)?.id || "" : "";
                      setEditForm({
                        ...editForm,
                        useSplit: true,
                        splits: (editForm.splits || []).length ? editForm.splits : [{ payer_id: other, amount: 0 }],
                      });
                    }}
                  />
                  <div className="font-bold text-sm text-slate-700">修改拆帳內容</div>
                </label>

                {editForm.useSplit && (
                  <div className="space-y-3">
                    {(editForm.splits || []).map((s, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <select
                          className="select select-bordered select-sm md:select-md w-full rounded-lg md:rounded-xl font-bold text-xs md:text-sm"
                          value={s.payer_id}
                          onChange={(e) => {
                            const next = (editForm.splits || []).map((r, i) =>
                              i === idx ? { ...r, payer_id: e.target.value } : r
                            );
                            setEditForm({ ...editForm, splits: next });
                          }}
                        >
                          <option value="">（應付者）</option>
                          {payers
                            .filter((p) => p.id !== editForm.payer_id)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </select>

                        <div className="relative w-28 md:w-32 shrink-0">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] md:text-xs font-bold text-slate-400">
                            $
                          </span>
                          <input
                            type="number"
                            className="input input-bordered input-sm md:input-md w-full pl-5 md:pl-6 font-black rounded-lg md:rounded-xl text-xs md:text-sm"
                            value={s.amount || ""}
                            onChange={(e) => {
                              const next = (editForm.splits || []).map((r, i) =>
                                i === idx ? { ...r, amount: Number(e.target.value) } : r
                              );
                              setEditForm({ ...editForm, splits: next });
                            }}
                          />
                        </div>

                        <button
                          className="btn btn-ghost text-rose-500 btn-sm px-2 rounded-lg"
                          onClick={() => {
                            const next = (editForm.splits || []).filter((_, i) => i !== idx);
                            setEditForm({ ...editForm, splits: next });
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </button>
                      </div>
                    ))}

                    <button
                      className="btn btn-ghost btn-xs md:btn-sm text-sky-600 font-bold"
                      onClick={() => {
                        const payer = editForm.payer_id || "";
                        const other = payer ? payers.find((p) => p.id !== payer)?.id || "" : "";
                        const next = [...(editForm.splits || []), { payer_id: other, amount: 0 }];
                        setEditForm({ ...editForm, splits: next });
                      }}
                    >
                      ＋ 新增分攤
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-50 px-5 md:px-8 py-4 flex justify-end gap-3 border-t border-slate-200 rounded-b-2xl md:rounded-b-3xl">
              <button
                className="btn btn-ghost btn-sm md:btn-md rounded-xl text-slate-600 font-bold"
                onClick={() => setEditing(null)}
              >
                取消
              </button>
              <button
                className="btn bg-sky-600 hover:bg-sky-700 text-white border-none btn-sm md:btn-md rounded-xl md:rounded-2xl px-6 md:px-8 font-black shadow-md"
                onClick={submitEdit}
              >
                確認修改
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setEditing(null)}></div>
        </div>
      )}

      {/* ✅ 若 workspaceId 空值，給提示 */}
      {!WORKSPACE_ID ? (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold shadow-lg z-50">
          缺少 NEXT_PUBLIC_WORKSPACE_ID（Vercel / .env.local 尚未設定）
        </div>
      ) : null}
    </main>
  );
}
