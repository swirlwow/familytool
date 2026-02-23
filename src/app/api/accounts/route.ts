// src/app/api/accounts/route.ts
import { NextResponse } from "next/server";
import { apiError, parseJson } from "@/lib/api/http";
import { supabase } from "@/lib/supabaseClient";


function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/**
 * GET /accounts?workspace_id=...&include_inactive=1&type=bank|cash|credit_card
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const workspace_id = url.searchParams.get("workspace_id") || "";
    const include_inactive = url.searchParams.get("include_inactive") === "1";
    const type = (url.searchParams.get("type") || "").trim(); // optional

    if (!workspace_id) return apiError("missing workspace_id", { data: [] });

    let q = supabase
      .from("accounts")
      .select("id,workspace_id,name,type,owner_name,note,sort_order,is_active,created_at")
      .eq("workspace_id", workspace_id);

    if (!include_inactive) q = q.eq("is_active", true);
    if (type) q = q.eq("type", type);

    const { data, error } = await q
      .order("type", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) return NextResponse.json({ error: error.message, data: [] }, { status: 500 });
    return NextResponse.json({ data: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, data: [] }, { status: 500 });
  }
}

/**
 * POST /accounts
 * body: { workspace_id, name, type, owner_name, note?, sort_order?, is_active? }
 * - 若沒帶 sort_order：同 type 取 max(sort_order)+10
 */
export async function POST(req: Request) {
  try {
    const body = await parseJson<Record<string, any>>(req, {});
    const { workspace_id, name, type, owner_name, note, sort_order, is_active } = body || {};

    if (!workspace_id) return apiError("缺少 workspace_id", { data: [] });
    const nm = String(name || "").trim();
    const tp = String(type || "").trim();
    const owner = String(owner_name || "").trim();

    if (!nm) return apiError("請輸入帳戶名稱", { data: [] });
    if (!owner) return apiError("請輸入持有人（例如：媽媽/先生）", { data: [] });
    if (!["bank", "cash", "credit_card"].includes(tp)) {
      return apiError("type 必須是 bank/cash/credit_card", { data: [] });
    }

    let finalSort = n(sort_order);
    if (!finalSort) {
      const { data: maxRows, error: maxErr } = await supabase
        .from("accounts")
        .select("sort_order")
        .eq("workspace_id", workspace_id)
        .eq("type", tp)
        .order("sort_order", { ascending: false })
        .limit(1);

      if (maxErr) return NextResponse.json({ error: maxErr.message }, { status: 500 });
      const maxSort = n(maxRows?.[0]?.sort_order);
      finalSort = maxSort + 10;
    }

    const { data, error } = await supabase
      .from("accounts")
      .insert([
        {
          workspace_id,
          name: nm,
          type: tp,
          owner_name: owner,
          note: note ? String(note) : null,
          sort_order: finalSort,
          is_active: is_active === undefined ? true : !!is_active,
        },
      ])
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, id: data?.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * PATCH /accounts
 * body: { workspace_id, id, name?, owner_name?, note?, type?, sort_order?, is_active? }
 */
export async function PATCH(req: Request) {
  try {
    const body = await parseJson<Record<string, any>>(req, {});
    const { workspace_id, id } = body || {};

    if (!workspace_id || !id) return apiError("缺少 workspace_id / id", { data: [] });

    const patch: any = {};

    if (body.name !== undefined) {
      const nm = String(body.name || "").trim();
      if (!nm) return apiError("帳戶名稱不可空白", { data: [] });
      patch.name = nm;
    }

    if (body.owner_name !== undefined) {
      const ow = String(body.owner_name || "").trim();
      if (!ow) return apiError("持有人不可空白", { data: [] });
      patch.owner_name = ow;
    }

    if (body.note !== undefined) patch.note = body.note ? String(body.note) : null;

    if (body.type !== undefined) {
      const tp = String(body.type || "").trim();
      if (!["bank", "cash", "credit_card"].includes(tp)) {
        return apiError("type 必須是 bank/cash/credit_card", { data: [] });
      }
      patch.type = tp;
    }

    if (body.sort_order !== undefined) patch.sort_order = n(body.sort_order);
    if (body.is_active !== undefined) patch.is_active = !!body.is_active;

    const { error } = await supabase
      .from("accounts")
      .update(patch)
      .eq("workspace_id", workspace_id)
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * DELETE /accounts
 * body: { workspace_id, id }
 * - 真的刪除（不是停用）
 */
export async function DELETE(req: Request) {
  try {
    const body = await parseJson<Record<string, any>>(req, {});
    const { workspace_id, id } = body || {};

    if (!workspace_id || !id) return apiError("缺少 workspace_id / id", { data: [] });

    const { error } = await supabase
      .from("accounts")
      .delete()
      .eq("workspace_id", workspace_id)
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
