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
  if (type !== "expense" && type !== "income") return apiError("type 必須是 expense 或 income", { status: 400, data: [] });

  let q = supabase
    .from("category_groups")
    .select("id,workspace_id,name,type,sort_order,is_active,created_at")
    .eq("workspace_id", workspace_id)
    .eq("type", type);

  if (!include_inactive) q = q.eq("is_active", true);

  const { data, error } = await q.order("sort_order", { ascending: true });
  if (error) return apiError(error.message, { status: 500, data: [] });

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request) {
  try {
    const body = await parseJson<Record<string, any>>(req, {});
    const { workspace_id, type, name } = body || {};
    if (!workspace_id) return apiError("缺少 workspace_id", { status: 400, data: [] });
    if (type !== "expense" && type !== "income") return apiError("type 必須是 expense 或 income", { status: 400, data: [] });

    const nm = String(name || "").trim();
    if (!nm) return apiError("請輸入大分類名稱", { status: 400, data: [] });

    // 自動排到最後
    const { data: last } = await supabase
      .from("category_groups")
      .select("sort_order")
      .eq("workspace_id", workspace_id)
      .eq("type", type)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextSort = n(last?.[0]?.sort_order) + 10;

    const { data, error } = await supabase
      .from("category_groups")
      .insert([{ workspace_id, type, name: nm, sort_order: nextSort, is_active: true }])
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
    const newName = body.name !== undefined ? String(body.name || "").trim() : undefined;

    if (body.sort_order !== undefined) patch.sort_order = n(body.sort_order);
    if (body.is_active !== undefined) patch.is_active = !!body.is_active;
    if (newName !== undefined) {
      if (!newName) return apiError("大分類名稱不可空白", { status: 400, data: [] });
      patch.name = newName;
    }

    // 先查舊名稱（要做改名同步）
    let oldName: string | null = null;
    if (newName !== undefined) {
      const { data: oldRow, error: oldErr } = await supabase
        .from("category_groups")
        .select("name")
        .eq("workspace_id", workspace_id)
        .eq("id", id)
        .single();

      if (oldErr) return apiError(oldErr.message, { status: 500, data: [] });
      oldName = String(oldRow?.name ?? "");
    }

    const { error } = await supabase
      .from("category_groups")
      .update(patch)
      .eq("workspace_id", workspace_id)
      .eq("id", id);

    if (error) return apiError(error.message, { status: 500, data: [] });

    // 改名：同步更新 ledger_categories.group_name
    if (newName !== undefined && oldName && oldName !== newName) {
      const { error: syncErr } = await supabase
        .from("ledger_categories")
        .update({ group_name: newName })
        .eq("workspace_id", workspace_id)
        .eq("group_name", oldName);

      if (syncErr) return apiError(`大分類已更新，但同步小分類失敗：${syncErr.message}`, { status: 500, data: [] });
    }

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

    // 查名稱（刪除前要把小分類 group_name 清空）
    const { data: row, error: rErr } = await supabase
      .from("category_groups")
      .select("name")
      .eq("workspace_id", workspace_id)
      .eq("id", id)
      .single();

    if (rErr) return apiError(rErr.message, { status: 500, data: [] });
    const name = String(row?.name ?? "");

    // 小分類 group_name 清空（保留小分類本身）
    const { error: clrErr } = await supabase
      .from("ledger_categories")
      .update({ group_name: null })
      .eq("workspace_id", workspace_id)
      .eq("group_name", name);

    if (clrErr) return apiError(`刪除前清空小分類 group_name 失敗：${clrErr.message}`, { status: 500, data: [] });

    const { error } = await supabase
      .from("category_groups")
      .delete()
      .eq("workspace_id", workspace_id)
      .eq("id", id);

    if (error) return apiError(error.message, { status: 500, data: [] });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return apiError(e.message, { status: 500, data: [] });
  }
}
