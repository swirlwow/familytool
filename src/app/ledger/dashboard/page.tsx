// src/app/ledger/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { WORKSPACE_ID } from "@/lib/appConfig";
import { useMasterData } from "@/hooks/useMasterData";

type LedgerEntry = {
  id: string;
  entry_date: string; // YYYY-MM-DD
  type: "expense" | "income";
  amount: number;
  category_id: string | null;
  pay_method: string | null; // payment_methods.id
  merchant: string | null;
  note: string | null;
  payer_id: string | null;
  created_at: string;
  // ✅ 補上拆帳的型別
  ledger_splits?: Array<{ payer_id: string; amount: number }>;
};

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1);
}
function toCsvCell(v: any) {
  const s = String(v ?? "");
  if (/[,"\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}
function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function rangeLastNDays(n: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (n - 1));
  return { from: ymd(from), to: ymd(to) };
}
function rangeThisMonth() {
  const t = new Date();
  return { from: ymd(startOfMonth(t)), to: ymd(endOfMonth(t)) };
}
function rangeLastMonth() {
  const t = new Date();
  const firstThis = startOfMonth(t);
  const lastMonthEnd = new Date(firstThis.getFullYear(), firstThis.getMonth(), 0);
  const lastMonthStart = startOfMonth(lastMonthEnd);
  return { from: ymd(lastMonthStart), to: ymd(lastMonthEnd) };
}
function rangeThisYear() {
  const t = new Date();
  return { from: ymd(startOfYear(t)), to: ymd(endOfMonth(t)) };
}

export default function LedgerDashboardPage() {
  const {
    catsExpense,
    catsIncome,
    payMethods,
    payers,
    loading: masterLoading,
    error: masterError,
    refresh: refreshMaster,
  } = useMasterData();

  // 預設：本月
  const init = rangeThisMonth();
  const [from, setFrom] = useState<string>(init.from);
  const [to, setTo] = useState<string>(init.to);

  // 類型：支出 / 收入 / 全部
  const [typeFilter, setTypeFilter] = useState<"expense" | "income" | "all">("expense");

  // 分類篩選
  const [groupFilter, setGroupFilter] = useState<string>("__ALL__");
  const [categoryFilter, setCategoryFilter] = useState<string>("__ALL__");

  // 關鍵字
  const [keyword, setKeyword] = useState<string>("");

  // 點擊複製提示
  const [copied, setCopied] = useState<string>("");

  const [rows, setRows] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  async function fetchLedger() {
    setLoading(true);
    setErr("");
    try {
      const qs = new URLSearchParams({
        workspace_id: WORKSPACE_ID ?? "",
        from,
        to,
      });
      const r = await fetch(`/api/ledger?${qs.toString()}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "ledger 讀取失敗");
      setRows((j.data || []) as LedgerEntry[]);
    } catch (e: any) {
      setErr(e?.message || "讀取失敗");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  // maps：付款人 / 付款方式 / 分類
  const maps = useMemo(() => {
    const payerMap = new Map<string, string>();
    const pmMap = new Map<string, string>();
    const catMap = new Map<string, { name: string; group_name: string }>();

    (payers || []).forEach((p) => payerMap.set(p.id, p.name));
    (payMethods || []).forEach((p) => pmMap.set(p.id, p.name));

    const allCats = [...(catsExpense || []), ...(catsIncome || [])];
    allCats.forEach((c: any) => {
      catMap.set(c.id, {
        name: c.name,
        group_name: (c.group_name || "未分組").trim() || "未分組",
      });
    });

    return { payerMap, pmMap, catMap };
  }, [payers, payMethods, catsExpense, catsIncome]);

  // activeCats：下拉選單依類型切換
  const activeCats = useMemo(() => {
    if (typeFilter === "expense") return catsExpense || [];
    if (typeFilter === "income") return catsIncome || [];
    return [...(catsExpense || []), ...(catsIncome || [])];
  }, [catsExpense, catsIncome, typeFilter]);

  const groupOptions = useMemo(() => {
    const set = new Set<string>();
    activeCats.forEach((c: any) =>
      set.add((c.group_name || "未分組").trim() || "未分組")
    );
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, "zh-Hant"));
  }, [activeCats]);

  const categoryOptions = useMemo(() => {
    const list = activeCats
      .filter((c: any) => {
        if (groupFilter === "__ALL__") return true;
        const g = (c.group_name || "未分組").trim() || "未分組";
        return g === groupFilter;
      })
      .map((c: any) => ({ id: c.id, name: c.name, group_name: c.group_name }));
    return list.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  }, [activeCats, groupFilter]);

  useEffect(() => {
    setCategoryFilter("__ALL__");
  }, [groupFilter]);

  // keyword 內容：把一筆資料可搜尋文字「展開」
  function rowSearchText(x: LedgerEntry) {
    const c = x.category_id ? maps.catMap.get(x.category_id) : null;
    const group = c?.group_name || "未分類";
    const cat = c?.name || "未分類";
    const payer = x.payer_id ? maps.payerMap.get(x.payer_id) || "" : "";
    const pm = x.pay_method ? maps.pmMap.get(x.pay_method) || x.pay_method : "";
    return [
      x.entry_date,
      x.type === "expense" ? "支出" : "收入",
      String(x.amount ?? ""),
      group,
      cat,
      payer,
      pm,
      x.merchant || "",
      x.note || "",
    ]
      .join(" ")
      .toLowerCase();
  }

  // 套用篩選（含 keyword）
  const filteredRows = useMemo(() => {
    let r = rows.slice();

    if (typeFilter !== "all") r = r.filter((x) => x.type === typeFilter);

    if (groupFilter !== "__ALL__") {
      r = r.filter((x) => {
        const c = x.category_id ? maps.catMap.get(x.category_id) : null;
        const g = c?.group_name || "未分類";
        return g === groupFilter;
      });
    }

    if (categoryFilter !== "__ALL__") {
      r = r.filter((x) => x.category_id === categoryFilter);
    }

    const kw = keyword.trim().toLowerCase();
    if (kw) {
      r = r.filter((x) => rowSearchText(x).includes(kw));
    }

    return r;
  }, [rows, typeFilter, groupFilter, categoryFilter, keyword, maps.catMap, maps.payerMap, maps.pmMap]);

  // KPI
  const totalExpense = useMemo(() => {
    return filteredRows
      .filter((x) => x.type === "expense")
      .reduce((s, x) => s + Number(x.amount || 0), 0);
  }, [filteredRows]);

  const totalIncome = useMemo(() => {
    return filteredRows
      .filter((x) => x.type === "income")
      .reduce((s, x) => s + Number(x.amount || 0), 0);
  }, [filteredRows]);

  const net = totalIncome - totalExpense;

  // 大分類統計：支出 / 收入分開
  const groupSummaryExpense = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of filteredRows) {
      if (x.type !== "expense") continue;
      const c = x.category_id ? maps.catMap.get(x.category_id) : null;
      const g = c?.group_name || "未分類";
      m.set(g, (m.get(g) || 0) + Number(x.amount || 0));
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredRows, maps.catMap]);

  const groupSummaryIncome = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of filteredRows) {
      if (x.type !== "income") continue;
      const c = x.category_id ? maps.catMap.get(x.category_id) : null;
      const g = c?.group_name || "未分類";
      m.set(g, (m.get(g) || 0) + Number(x.amount || 0));
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredRows, maps.catMap]);

  const categorySummaryByType = useMemo(() => {
    const want: ("expense" | "income")[] =
      typeFilter === "expense"
        ? ["expense"]
        : typeFilter === "income"
          ? ["income"]
          : ["expense", "income"];

    const m = new Map<
      string,
      { type: "expense" | "income"; name: string; group: string; amount: number }
    >();

    for (const x of filteredRows) {
      if (!want.includes(x.type)) continue;

      const catId = x.category_id || "__NO_CAT__";
      const c = x.category_id ? maps.catMap.get(x.category_id) : null;
      const name = c?.name || "未分類";
      const group = c?.group_name || "未分類";

      const key = `${x.type}||${group}||${catId}`;
      const cur = m.get(key) || { type: x.type, name, group, amount: 0 };
      cur.amount += Number(x.amount || 0);
      m.set(key, cur);
    }

    return Array.from(m.values()).sort((a, b) => b.amount - a.amount);
  }, [filteredRows, maps.catMap, typeFilter]);

  function exportDetailCsv() {
    const header = [
      "日期",
      "類型",
      "金額",
      "大分類",
      "小分類",
      "付款人",
      "付款方式",
      "店家",
      "備註",
      "id",
    ].join(",");

    const body = filteredRows
      .map((x) => {
        const c = x.category_id ? maps.catMap.get(x.category_id) : null;
        const group = c?.group_name || "未分類";
        const cat = c?.name || "未分類";
        const payer = x.payer_id ? maps.payerMap.get(x.payer_id) || "" : "";
        const pm = x.pay_method ? maps.pmMap.get(x.pay_method) || x.pay_method : "";
        return [
          toCsvCell(x.entry_date),
          toCsvCell(x.type === "expense" ? "支出" : "收入"),
          toCsvCell(x.amount),
          toCsvCell(group),
          toCsvCell(cat),
          toCsvCell(payer),
          toCsvCell(pm),
          toCsvCell(x.merchant || ""),
          toCsvCell(x.note || ""),
          toCsvCell(x.id),
        ].join(",");
      })
      .join("\n");

    const blob = new Blob([header + "\n" + body], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger_detail_${from}_${to}_${typeFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportSummaryCsv() {
    const header = ["類型", "大分類", "小分類", "金額"].join(",");

    const lines = categorySummaryByType.map((x) => {
      return [
        toCsvCell(x.type === "expense" ? "支出" : "收入"),
        toCsvCell(x.group),
        toCsvCell(x.name),
        toCsvCell(x.amount),
      ].join(",");
    });

    const blob = new Blob([header + "\n" + lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger_summary_${from}_${to}_${typeFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ✅ 新增：匯出拆帳明細 CSV 功能
  function exportSplitsCsv() {
    const header = [
      "日期",
      "大分類",
      "小分類",
      "店家",
      "總金額",
      "代墊/付款人",
      "應付/分攤人",
      "分攤金額",
      "備註",
      "交易ID",
    ].join(",");

    const lines: string[] = [];

    filteredRows.forEach((x) => {
      const sp = Array.isArray(x.ledger_splits) ? x.ledger_splits : [];
      if (sp.length === 0) return; // 只匯出有拆帳的資料

      const c = x.category_id ? maps.catMap.get(x.category_id) : null;
      const group = c?.group_name || "未分類";
      const cat = c?.name || "未分類";
      const payer = x.payer_id ? maps.payerMap.get(x.payer_id) || "" : "";

      sp.forEach((split) => {
        const splitPayer = split.payer_id ? maps.payerMap.get(split.payer_id) || split.payer_id : "";
        lines.push([
          toCsvCell(x.entry_date),
          toCsvCell(group),
          toCsvCell(cat),
          toCsvCell(x.merchant || ""),
          toCsvCell(x.amount),
          toCsvCell(payer),
          toCsvCell(splitPayer),
          toCsvCell(split.amount),
          toCsvCell(x.note || ""),
          toCsvCell(x.id),
        ].join(","));
      });
    });

    if (lines.length === 0) {
      alert("此搜尋條件下，沒有任何包含「拆帳」的明細資料。");
      return;
    }

    const blob = new Blob([header + "\n" + lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger_splits_detail_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const titleText =
    typeFilter === "income" ? "收入" : typeFilter === "all" ? "收支" : "支出";

  const mergedError = err || masterError;

  function applyZiyiMedical() {
    setTypeFilter("expense");

    const wantGroup = "兒子";
    const wantCat = "醫療費";

    const groups = new Set<string>();
    (catsExpense || []).forEach((c: any) => {
      const g = (c.group_name || "未分組").trim() || "未分組";
      groups.add(g);
    });

    const groupExists = Array.from(groups).includes(wantGroup);

    if (groupExists) {
      setGroupFilter(wantGroup);

      const hit = (catsExpense || []).find((c: any) => {
        const g = (c.group_name || "未分組").trim() || "未分組";
        return g === wantGroup && String(c.name || "").trim() === wantCat;
      });

      if (hit?.id) {
        setCategoryFilter(hit.id);
        return;
      }

      setCategoryFilter("__ALL__");
      setKeyword("醫療");
      return;
    }

    setGroupFilter("__ALL__");
    setCategoryFilter("__ALL__");
    setKeyword("子逸 醫療");
  }

  async function copyRow(x: LedgerEntry) {
    const c = x.category_id ? maps.catMap.get(x.category_id) : null;
    const group = c?.group_name || "未分類";
    const cat = c?.name || "未分類";
    const payer = x.payer_id ? maps.payerMap.get(x.payer_id) || "" : "";
    const pm = x.pay_method ? maps.pmMap.get(x.pay_method) || x.pay_method : "";
    const text = [
      x.entry_date,
      x.type === "income" ? "收入" : "支出",
      `${Number(x.amount || 0).toLocaleString()}`,
      group,
      cat,
      x.merchant || "—",
      payer,
      pm,
      x.note || "",
    ]
      .filter(Boolean)
      .join(" / ");

    try {
      await navigator.clipboard.writeText(text);
      setCopied("已複製");
      setTimeout(() => setCopied(""), 900);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied("已複製");
        setTimeout(() => setCopied(""), 900);
      } catch {
        setCopied("複製失敗");
        setTimeout(() => setCopied(""), 900);
      }
    }
  }

  function setRange(kind: "thisMonth" | "lastMonth" | "d7" | "d30" | "thisYear") {
    const r =
      kind === "thisMonth"
        ? rangeThisMonth()
        : kind === "lastMonth"
          ? rangeLastMonth()
          : kind === "d7"
            ? rangeLastNDays(7)
            : kind === "d30"
              ? rangeLastNDays(30)
              : rangeThisYear();
    setFrom(r.from);
    setTo(r.to);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            財務儀表板
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            依日期區間與分類篩選，提供統計與明細（可匯出 CSV）
          </p>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {copied ? (
            <span className="text-xs font-black bg-slate-900 text-white px-3 py-1.5 rounded-lg">
              {copied}
            </span>
          ) : null}

          {/* ✅ 新增的匯出拆帳明細按鈕 */}
          <button
            onClick={exportSplitsCsv}
            className={cn(
              "px-4 py-2 rounded-lg font-bold shadow-sm",
              "bg-amber-500 text-white hover:bg-amber-600 border-none",
              "disabled:opacity-60"
            )}
            disabled={loading || masterLoading}
          >
            匯出拆帳明細 CSV
          </button>
          <button
            onClick={exportSummaryCsv}
            className={cn(
              "px-4 py-2 rounded-lg font-bold shadow-sm",
              "bg-slate-900 text-white hover:bg-slate-800",
              "disabled:opacity-60"
            )}
            disabled={loading || masterLoading}
          >
            匯出分類彙總 CSV
          </button>
          <button
            onClick={exportDetailCsv}
            className={cn(
              "px-4 py-2 rounded-lg font-bold shadow-sm",
              "bg-blue-600 text-white hover:bg-blue-500",
              "disabled:opacity-60"
            )}
            disabled={loading || masterLoading}
          >
            匯出明細 CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setRange("thisMonth")}
          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-sm"
        >
          本月
        </button>
        <button
          onClick={() => setRange("lastMonth")}
          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-sm"
        >
          上月
        </button>
        <button
          onClick={() => setRange("d7")}
          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-sm"
        >
          近 7 天
        </button>
        <button
          onClick={() => setRange("d30")}
          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-sm"
        >
          近 30 天
        </button>
        <button
          onClick={() => setRange("thisYear")}
          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-sm"
        >
          今年
        </button>

        <span className="mx-1 w-px bg-slate-200" />

        <button
          onClick={applyZiyiMedical}
          className={cn(
            "px-3 py-2 rounded-xl font-black text-sm",
            "bg-amber-100 hover:bg-amber-200 text-amber-900",
            "disabled:opacity-60"
          )}
          disabled={masterLoading}
          title="一鍵篩選：大分類 子逸 / 小分類 醫療"
        >
          子逸醫療
        </button>
      </div>

      {/* Filters Card */}
      <div className="border rounded-2xl p-4 bg-white shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="space-y-1">
            <div className="text-xs font-bold text-slate-500">起日</div>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs font-bold text-slate-500">迄日</div>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs font-bold text-slate-500">類型</div>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={typeFilter}
              onChange={(e) => {
                const v = e.target.value as "expense" | "income" | "all";
                setTypeFilter(v);
                setGroupFilter("__ALL__");
                setCategoryFilter("__ALL__");
              }}
            >
              <option value="expense">支出</option>
              <option value="income">收入</option>
              <option value="all">全部</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-bold text-slate-500">大分類</div>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              disabled={masterLoading}
            >
              <option value="__ALL__">全部</option>
              {groupOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-bold text-slate-500">小分類</div>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              disabled={masterLoading}
            >
              <option value="__ALL__">全部</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-bold text-slate-500">關鍵字</div>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="店家/備註/分類/付款人…"
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-slate-500">
            目前條件：{from} ～ {to} / {titleText} /{" "}
            {groupFilter === "__ALL__" ? "大分類：全部" : `大分類：${groupFilter}`}
            {categoryFilter === "__ALL__"
              ? " / 小分類：全部"
              : ` / 小分類：${categoryOptions.find((x) => x.id === categoryFilter)?.name || ""
              }`}
            {keyword.trim() ? ` / 關鍵字：「${keyword.trim()}」` : ""}
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchLedger}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-bold",
                "bg-slate-100 hover:bg-slate-200 text-slate-800",
                "disabled:opacity-60"
              )}
              disabled={loading}
              title="重新讀取（明細）"
            >
              重新讀取
            </button>

            <button
              onClick={refreshMaster}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-bold",
                "bg-slate-100 hover:bg-slate-200 text-slate-800",
                "disabled:opacity-60"
              )}
              disabled={masterLoading}
              title="重新讀取分類/付款人/付款方式"
            >
              更新分類資料
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {mergedError ? (
        <div className="border border-red-200 bg-red-50 text-red-700 rounded-xl p-3">
          讀取失敗：{mergedError}
        </div>
      ) : null}

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl p-4 bg-red-50 border border-red-100">
          <p className="text-sm text-slate-700 font-bold">總支出</p>
          <p className="text-2xl font-black text-red-600 mt-1">
            {totalExpense.toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl p-4 bg-green-50 border border-green-100">
          <p className="text-sm text-slate-700 font-bold">總收入</p>
          <p className="text-2xl font-black text-green-600 mt-1">
            {totalIncome.toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl p-4 bg-slate-50 border border-slate-100">
          <p className="text-sm text-slate-700 font-bold">淨額</p>
          <p
            className={cn(
              "text-2xl font-black mt-1",
              net >= 0 ? "text-green-700" : "text-red-700"
            )}
          >
            {net.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Group Summary Card */}
        <div className="border border-slate-200 rounded-3xl p-6 bg-white shadow-sm space-y-4">
          <div className="flex items-end justify-between gap-3 flex-wrap border-b border-slate-100 pb-3">
            <h2 className="text-lg font-black text-slate-900">
              {typeFilter === "income"
                ? "大分類收入統計"
                : typeFilter === "all"
                  ? "大分類統計"
                  : "大分類支出統計"}
            </h2>

            <div className="text-sm text-slate-500">
              統計僅依目前條件（日期/類型/分類/關鍵字）
            </div>
          </div>

          {loading || masterLoading ? (
            <div className="text-slate-500 py-4">載入中…</div>
          ) : typeFilter === "all" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* expense */}
              <div className="rounded-2xl border border-slate-100 p-4 bg-slate-50/50">
                <div className="text-sm font-black mb-3 text-red-600 tracking-wide border-b border-slate-200 pb-2">
                  支出排行
                </div>
                {groupSummaryExpense.length === 0 ? (
                  <div className="text-slate-400 text-sm py-2">
                    此條件下沒有支出資料
                  </div>
                ) : (
                  <div className="space-y-2">
                    {groupSummaryExpense.map(([name, amt]) => (
                      <div
                        key={"ex-" + name}
                        className="flex justify-between items-center bg-white border border-slate-100 rounded-xl px-4 py-2.5 shadow-sm"
                      >
                        <span className="text-slate-700 font-bold text-sm">
                          {name}
                        </span>
                        <span className="font-black text-red-600 tabular-nums">
                          ${amt.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* income */}
              <div className="rounded-2xl border border-slate-100 p-4 bg-slate-50/50">
                <div className="text-sm font-black mb-3 text-green-600 tracking-wide border-b border-slate-200 pb-2">
                  收入排行
                </div>
                {groupSummaryIncome.length === 0 ? (
                  <div className="text-slate-400 text-sm py-2">
                    此條件下沒有收入資料
                  </div>
                ) : (
                  <div className="space-y-2">
                    {groupSummaryIncome.map(([name, amt]) => (
                      <div
                        key={"in-" + name}
                        className="flex justify-between items-center bg-white border border-slate-100 rounded-xl px-4 py-2.5 shadow-sm"
                      >
                        <span className="text-slate-700 font-bold text-sm">
                          {name}
                        </span>
                        <span className="font-black text-green-600 tabular-nums">
                          ${amt.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
              {(() => {
                const list = typeFilter === "income" ? groupSummaryIncome : groupSummaryExpense;
                const colorClass = typeFilter === "income" ? "text-green-600" : "text-red-600";

                if (list.length === 0) {
                  return (
                    <div className="text-slate-400 py-4 col-span-full">
                      此條件下沒有資料
                    </div>
                  );
                }

                return list.map(([name, amt]) => (
                  <div
                    key={name}
                    className="flex justify-between items-center bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100 rounded-xl px-4 py-3"
                  >
                    <span className="text-slate-800 font-bold text-sm">{name}</span>
                    <span className={cn("font-black tabular-nums", colorClass)}>
                      ${amt.toLocaleString()}
                    </span>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>

        {/* Details List Card */}
        <div className="border border-slate-200 rounded-3xl p-6 bg-white shadow-sm space-y-4">
          <div className="flex items-end justify-between gap-3 flex-wrap border-b border-slate-100 pb-3">
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              {typeFilter === "income"
                ? "收入明細"
                : typeFilter === "all"
                  ? "收支明細"
                  : "支出明細"}
            </h2>

            <div className="text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg font-bold">
              共 {filteredRows.length.toLocaleString()} 筆（點列可複製）
            </div>
          </div>

          {!loading && !masterLoading && filteredRows.length === 0 ? (
            <div className="text-slate-500 py-8 font-medium">此條件下沒有明細資料</div>
          ) : (
            <div className="space-y-3">
              <div className="md:hidden space-y-3">
                {filteredRows
                  .slice()
                  .sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1))
                  .map((x) => {
                    const c = x.category_id ? maps.catMap.get(x.category_id) : null;
                    const group = c?.group_name || "未分類";
                    const cat = c?.name || "未分類";
                    const payer = x.payer_id ? maps.payerMap.get(x.payer_id) || "" : "";
                    const pm = x.pay_method ? maps.pmMap.get(x.pay_method) || x.pay_method : "";
                    const isIncome = x.type === "income";

                    return (
                      <button
                        key={x.id}
                        type="button"
                        onClick={() => copyRow(x)}
                        className={cn(
                          "w-full text-left",
                          "border border-slate-200 bg-white rounded-2xl p-4 shadow-sm",
                          "active:scale-[0.99] transition",
                          "hover:bg-slate-50"
                        )}
                        title="點一下複製這筆摘要"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-bold text-slate-500 font-mono">
                              {x.entry_date}
                            </div>
                            <div className="mt-2">
                              <span
                                className={cn(
                                  "inline-flex items-center px-2 py-1 rounded-md text-[11px] font-black",
                                  isIncome
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                                )}
                              >
                                {isIncome ? "收入" : "支出"}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-[11px] font-black text-slate-400">金額</div>
                            <div
                              className={cn(
                                "text-2xl font-black tabular-nums leading-tight",
                                isIncome ? "text-green-600" : "text-red-600"
                              )}
                            >
                              {Number(x.amount || 0).toLocaleString()}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                            <div className="text-[11px] font-black text-slate-400">分類</div>
                            <div className="mt-1 font-black text-slate-800">{group}</div>
                            <div className="text-xs font-bold text-slate-500 mt-1">{cat}</div>
                          </div>

                          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                            <div className="text-[11px] font-black text-slate-400">店家</div>
                            <div className="mt-1 font-bold text-slate-800 break-words">
                              {x.merchant || "—"}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 p-3">
                          <div className="text-[11px] font-black text-slate-400">付款</div>
                          <div className="mt-1 grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-[10px] font-black text-slate-400">付款人</div>
                              <div className="font-bold text-slate-700 mt-1">{payer || "—"}</div>
                            </div>
                            <div>
                              <div className="text-[10px] font-black text-slate-400">付款方式</div>
                              <div className="font-bold text-slate-700 mt-1">{pm || "—"}</div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="text-[11px] font-black text-slate-400">備註</div>
                          <div className="mt-1 text-sm text-slate-600 break-words">
                            {x.note || "—"}
                          </div>
                        </div>

                        <div className="mt-3 text-[11px] font-bold text-slate-400">
                          點一下可複製此筆摘要
                        </div>
                      </button>
                    );
                  })}
              </div>

              <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-[820px] w-full text-sm">
                  <thead className="bg-slate-100 text-slate-500 uppercase tracking-wider text-[11px] font-black border-b border-slate-200">
                    <tr className="text-center">
                      <th className="px-2 py-2 w-[50px]">日期</th>
                      <th className="px-2 py-2 w-[20px]">類型</th>
                      <th className="px-2 py-2 w-[80px] text-right">金額</th>
                      <th className="px-2 py-2 w-[100px]">分類</th>
                      <th className="px-2 py-2 w-[160px]">店家</th>
                      <th className="px-2 py-2 w-[100px]">付款</th>
                      <th className="px-2 py-2">備註</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredRows
                      .slice()
                      .sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1))
                      .map((x) => {
                        const c = x.category_id ? maps.catMap.get(x.category_id) : null;
                        const group = c?.group_name || "未分類";
                        const cat = c?.name || "未分類";
                        const payer = x.payer_id ? maps.payerMap.get(x.payer_id) || "" : "";
                        const pm = x.pay_method ? maps.pmMap.get(x.pay_method) || x.pay_method : "";
                        const isIncome = x.type === "income";

                        return (
                          <tr
                            key={x.id}
                            className="hover:bg-slate-50 transition-colors cursor-copy"
                            onClick={() => copyRow(x)}
                            title="點一下複製這筆摘要"
                          >
                            <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-600">
                              {x.entry_date}
                            </td>

                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black",
                                  isIncome
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                                )}
                              >
                                {isIncome ? "收入" : "支出"}
                              </span>
                            </td>

                            <td
                              className={cn(
                                "px-4 py-3 text-right font-black tabular-nums whitespace-nowrap text-base",
                                isIncome ? "text-green-600" : "text-red-600"
                              )}
                            >
                              {Number(x.amount || 0).toLocaleString()}
                            </td>

                            <td className="px-4 py-3">
                              <div className="leading-tight">
                                <div className="font-black text-slate-800">{group}</div>
                                <div className="text-slate-500 text-xs font-bold mt-1">{cat}</div>
                              </div>
                            </td>

                            <td className="px-4 py-3 font-medium text-slate-700">
                              {x.merchant || "—"}
                            </td>

                            <td className="px-4 py-3">
                              <div className="leading-tight">
                                <div className="font-bold text-slate-700">{payer || "—"}</div>
                                <div className="text-slate-500 text-xs font-bold mt-1">{pm || "—"}</div>
                              </div>
                            </td>

                            <td className="px-4 py-3 text-slate-500 break-words">
                              {x.note || "—"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div >
  );
}
