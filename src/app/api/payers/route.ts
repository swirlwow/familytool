import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const workspace_id = url.searchParams.get("workspace_id");
  const include_inactive = url.searchParams.get("include_inactive") === "1";

  if (!workspace_id) {
    return NextResponse.json({ error: "missing workspace_id" }, { status: 400 });
  }

  let q = supabase
    .from("payers")
    .select("id,name,is_active,created_at")
    .eq("workspace_id", workspace_id);

  if (!include_inactive) q = q.eq("is_active", true);

  const { data, error } = await q.order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspace_id, name } = body;

    if (!workspace_id || !name) {
      return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
    }

    const nm = String(name).trim();
    if (!nm) return NextResponse.json({ error: "name 不可為空" }, { status: 400 });

    const { error } = await supabase.from("payers").insert([
      {
        workspace_id,
        name: nm,
        is_active: true,
      },
    ]);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { workspace_id, id } = body;

    if (!workspace_id || !id) {
      return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
    }

    const patch: any = {};

    if (body.name !== undefined) {
      const nm = String(body.name ?? "").trim();
      if (!nm) return NextResponse.json({ error: "name 不可為空" }, { status: 400 });
      patch.name = nm;
    }
    if (body.is_active !== undefined) patch.is_active = !!body.is_active;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "沒有可更新欄位" }, { status: 400 });
    }

    const { error } = await supabase
      .from("payers")
      .update(patch)
      .eq("workspace_id", workspace_id)
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
