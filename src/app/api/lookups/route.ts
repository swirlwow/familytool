import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/http";
import { supabase } from "@/lib/supabaseClient";

function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}


function sortGroups(gs: any[]) {
  return (gs ?? [])
    .slice()
    .sort((a, b) => n(a.sort_order) - n(b.sort_order) || String(a.name).localeCompare(String(b.name), "zh-Hant"));
}

function sortCats(cats: any[], groupOrderMap: Map<string, number>) {
  return (cats ?? [])
    .slice()
    .sort((a, b) => {
      const ga = String(a.group_name || "").trim();
      const gb = String(b.group_name || "").trim();

      const ao = groupOrderMap.has(ga) ? (groupOrderMap.get(ga) as number) : 999999;
      const bo = groupOrderMap.has(gb) ? (groupOrderMap.get(gb) as number) : 999999;
      if (ao !== bo) return ao - bo;

      const sa = n(a.sort_order);
      const sb = n(b.sort_order);
      if (sa !== sb) return sa - sb;

      return String(a.name).localeCompare(String(b.name), "zh-Hant");
    });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const workspace_id = url.searchParams.get("workspace_id") || "";
  if (!workspace_id) return apiError("missing workspace_id");

  // payers
  const { data: payers, error: payersErr } = await supabase
    .from("payers")
    .select("id,name")
    .eq("workspace_id", workspace_id)
    .order("created_at", { ascending: true });

  if (payersErr) return apiError(payersErr.message, { status: 500 });

  // payment methods
  const { data: payment_methods, error: pmErr } = await supabase
    .from("payment_methods")
    .select("id,name,sort_order,is_active")
    .eq("workspace_id", workspace_id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (pmErr) return apiError(pmErr.message, { status: 500 });

  // groups expense/income
  const { data: gExp, error: gExpErr } = await supabase
    .from("category_groups")
    .select("id,workspace_id,name,type,sort_order,is_active")
    .eq("workspace_id", workspace_id)
    .eq("type", "expense")
    .eq("is_active", true);

  if (gExpErr) return apiError(gExpErr.message, { status: 500 });

  const { data: gInc, error: gIncErr } = await supabase
    .from("category_groups")
    .select("id,workspace_id,name,type,sort_order,is_active")
    .eq("workspace_id", workspace_id)
    .eq("type", "income")
    .eq("is_active", true);

  if (gIncErr) return apiError(gIncErr.message, { status: 500 });

  const groups_expense = sortGroups(gExp ?? []);
  const groups_income = sortGroups(gInc ?? []);

  const expOrder = new Map<string, number>();
  groups_expense.forEach((g: any, idx: number) => expOrder.set(String(g.name), n(g.sort_order ?? idx * 10)));

  const incOrder = new Map<string, number>();
  groups_income.forEach((g: any, idx: number) => incOrder.set(String(g.name), n(g.sort_order ?? idx * 10)));

  // categories expense/income
  const { data: cExp, error: cExpErr } = await supabase
    .from("ledger_categories")
    .select("id,workspace_id,name,type,group_name,sort_order,is_active,created_at")
    .eq("workspace_id", workspace_id)
    .eq("type", "expense")
    .eq("is_active", true);

  if (cExpErr) return apiError(cExpErr.message, { status: 500 });

  const { data: cInc, error: cIncErr } = await supabase
    .from("ledger_categories")
    .select("id,workspace_id,name,type,group_name,sort_order,is_active,created_at")
    .eq("workspace_id", workspace_id)
    .eq("type", "income")
    .eq("is_active", true);

  if (cIncErr) return apiError(cIncErr.message, { status: 500 });

  const categories_expense = sortCats(cExp ?? [], expOrder);
  const categories_income = sortCats(cInc ?? [], incOrder);

  return NextResponse.json({
    data: {
      payers: payers ?? [],
      payment_methods: (payment_methods ?? []).map((x: any) => ({ id: x.id, name: x.name })),
      groups_expense,
      groups_income,
      categories_expense,
      categories_income,
    },
  });
}
