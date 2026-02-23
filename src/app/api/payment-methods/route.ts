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
  const include_inactive = url.searchParams.get("include_inactive") === "1";
  if (!workspace_id) return apiError("missing workspace_id", { status: 400, data: [] });

  let q = supabase
    .from("payment_methods")
    .select("id,workspace_id,name,sort_order,is_active,created_at")
    .eq("workspace_id", workspace_id);

  if (!include_inactive) q = q.eq("is_active", true);

  const { data, error } = await q.order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (error) return apiError(error.message, { status: 500, data: [] });

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request) {
  try {
    const body = await parseJson<Record<string, any>>(req, {});
    const { workspace_id, name } = body || {};
    if (!workspace_id) return apiError("缺少 workspace_id", { status: 400, data: [] });

    const nm = String(name || "").trim();
    if (!nm) return apiError("請輸入付款方式名稱", { status: 400, data: [] });

    const { data: last } = await supabase
      .from("payment_methods")
      .select("sort_order")
      .eq("workspace_id", workspace_id)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextSort = n(last?.[0]?.sort_order) + 10;

    const { data, error } = await supabase
      .from("payment_methods")
      .insert([{ workspace_id, name: nm, sort_order: nextSort, is_active: true }])
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
      if (!nm) return apiError("名稱不可空白", { status: 400, data: [] });
      patch.name = nm;
    }
    if (body.sort_order !== undefined) patch.sort_order = n(body.sort_order);
    if (body.is_active !== undefined) patch.is_active = !!body.is_active;

    const { error } = await supabase.from("payment_methods").update(patch).eq("workspace_id", workspace_id).eq("id", id);
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

    const { error } = await supabase.from("payment_methods").delete().eq("workspace_id", workspace_id).eq("id", id);
    if (error) return apiError(error.message, { status: 500, data: [] });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return apiError(e.message, { status: 500, data: [] });
  }
}
