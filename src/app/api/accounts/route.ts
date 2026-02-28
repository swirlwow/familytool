// src/app/api/accounts/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspace_id = searchParams.get("workspace_id");

  if (!workspace_id) {
    return NextResponse.json({ error: "Missing workspace_id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("workspace_id", workspace_id)
    .order("created_at", { ascending: true }); // 或可改為 false 讓最新的在上面

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { workspace_id, type, name, owner_name, account_number, note, is_active } = body;

    if (!workspace_id || !name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("accounts")
      .insert({
        workspace_id,
        type,
        name,
        owner_name,
        account_number, // ✅ 新增：讓 API 知道要寫入帳號
        note,
        is_active: is_active ?? true, 
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { workspace_id, id, type, name, owner_name, account_number, note, is_active } = body;

    if (!workspace_id || !id) {
      return NextResponse.json({ error: "Missing id or workspace_id" }, { status: 400 });
    }

    // 動態組成要更新的資料，有傳進來才更新
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (type !== undefined) updateData.type = type;
    if (name !== undefined) updateData.name = name;
    if (owner_name !== undefined) updateData.owner_name = owner_name;
    if (account_number !== undefined) updateData.account_number = account_number; // ✅ 新增：讓 API 知道要更新帳號
    if (note !== undefined) updateData.note = note;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabase
      .from("accounts")
      .update(updateData)
      .eq("id", id)
      .eq("workspace_id", workspace_id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { workspace_id, id } = body;

    if (!workspace_id || !id) {
      return NextResponse.json({ error: "Missing id or workspace_id" }, { status: 400 });
    }

    const { error } = await supabase
      .from("accounts")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspace_id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
