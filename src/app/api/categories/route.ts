import { NextResponse } from "next/server";
import { apiError, parseJson } from "@/lib/api/http";
import { supabase } from "@/lib/supabaseClient";

function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const workspace_id = url.searchParams.get("workspace_id");
  const type = url.searchParams.get("type"); // expense / income
  const include_inactive = url.searchParams.get("include_inactive") === "1";

  if (!workspace_id) return apiError("missing workspace_id", { status: 400, data: [] });

  // 1) 先抓 categories
  let q = supabase
    .from("ledger_categories")
    .select("id,workspace_id,name,type,group_name,sort_order,is_active,created_at")
    .eq("workspace_id", workspace_id);

  if (type) q = q.eq("type", type);
  if (!include_inactive) q = q.eq("is_active", true);

  const { data, error } = await q;
  if (error) return apiError(error.message, { status: 500, data: [] });

  const cats = Array.isArray(data) ? data : [];

  // 2) 抓大分類排序（category_groups）
  const groupOrder = new Map<string, number>();
  if (type === "expense" || type === "income") {
    const { data: gs, error: gErr } = await supabase
      .from("category_groups")
      .select("name,sort_order,is_active")
      .eq("workspace_id", workspace_id)
      .eq("type", type)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (!gErr) {
      (gs ?? []).forEach((g: any, idx: number) => {
        groupOrder.set(String(g.name), n(g.sort_order ?? idx * 10));
      });
    }
  }

  // 3) 排序：group_sort → category.sort_order → name
  cats.sort((a: any, b: any) => {
    const ga = String(a.group_name || "").trim();
    const gb = String(b.group_name || "").trim();

    const ao = groupOrder.has(ga) ? (groupOrder.get(ga) as number) : 999999;
    const bo = groupOrder.has(gb) ? (groupOrder.get(gb) as number) : 999999;
    if (ao !== bo) return ao - bo;

    const sa = n(a.sort_order);
    const sb = n(b.sort_order);
    if (sa !== sb) return sa - sb;

    return String(a.name).localeCompare(String(b.name), "zh-Hant");
  });

  return NextResponse.json({ data: cats });
}

export async function POST(req: Request) {
  try {
    const body = await parseJson<Record<string, any>>(req, {});
    const { workspace_id, name, type, group_name, sort_order, is_active } = body || {};

    if (!workspace_id) return apiError("缺少 workspace_id", { status: 400, data: [] });

    const nm = String(name || "").trim();
    if (!nm) return apiError("請輸入分類名稱", { status: 400, data: [] });

    const tp = String(type || "").trim();
    if (tp !== "expense" && tp !== "income") return apiError("type 必須是 expense 或 income", { status: 400, data: [] });

    const gnRaw = String(group_name ?? "").trim();
    const gn = gnRaw ? gnRaw : null;

    const { data, error } = await supabase
      .from("ledger_categories")
      .insert([
        {
          workspace_id,
          name: nm,
          type: tp,
          group_name: gn,
          sort_order: n(sort_order),
          is_active: is_active === undefined ? true : !!is_active,
        },
      ])
      .select("id")
      .single();

    if (error) return apiError(error.message, { status: 500, data: [] });
    return NextResponse.json({ success: true, id: data?.id });
  } catch (e: any) {
    return apiError(e.message, { status: 500, data: [] });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await parseJson<Record<string, any>>(req, {});
    const { workspace_id, id } = body || {};
    if (!workspace_id || !id) return apiError("缺少 workspace_id / id", { status: 400, data: [] });

    const patch: any = {};

    if (body.name !== undefined) {
      const nm = String(body.name || "").trim();
      if (!nm) return apiError("分類名稱不可空白", { status: 400, data: [] });
      patch.name = nm;
    }
    if (body.type !== undefined) {
      const tp = String(body.type || "").trim();
      if (tp !== "expense" && tp !== "income") return apiError("type 必須是 expense 或 income", { status: 400, data: [] });
      patch.type = tp;
    }
    if (body.group_name !== undefined) {
      const gn = String(body.group_name ?? "").trim();
      patch.group_name = gn ? gn : null;
    }
    if (body.sort_order !== undefined) patch.sort_order = n(body.sort_order);
    if (body.is_active !== undefined) patch.is_active = !!body.is_active;

    const { error } = await supabase
      .from("ledger_categories")
      .update(patch)
      .eq("workspace_id", workspace_id)
      .eq("id", id);

    if (error) return apiError(error.message, { status: 500, data: [] });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return apiError(e.message, { status: 500, data: [] });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await parseJson<Record<string, any>>(req, {});
    const { workspace_id, id } = body || {};
    if (!workspace_id || !id) return apiError("缺少 workspace_id / id", { status: 400, data: [] });

    const { error } = await supabase
      .from("ledger_categories")
      .delete()
      .eq("workspace_id", workspace_id)
      .eq("id", id);

    if (error) return apiError(error.message, { status: 500, data: [] });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return apiError(e.message, { status: 500, data: [] });
  }
}
