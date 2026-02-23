import { NextResponse } from "next/server";
import { apiError, parseJson } from "@/lib/api/http";
import { supabase } from "@/lib/supabaseClient";

const DRAFT_PREFIX = "[DRAFT] ";

export async function POST(req: Request) {
  try {
    const body = await parseJson<Record<string, any>>(req, {});
    const { workspace_id, from, to } = body || {};

    if (!workspace_id) return apiError("缺少 workspace_id");
    if (!from || !to) return apiError("缺少 from/to（YYYY-MM-DD）");

    // 找出本期所有 draft headers
    const { data: drafts, error: dErr } = await supabase
      .from("settlements")
      .select("id,note")
      .eq("workspace_id", workspace_id)
      .eq("from_date", from)
      .eq("to_date", to)
      .like("note", `${DRAFT_PREFIX}%`);

    if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

    const ids = (drafts ?? []).map((r: any) => r.id).filter(Boolean);
    if (!ids.length) return NextResponse.json({ success: true, deleted: 0 });

    // 先刪 items，再刪 headers
    const { error: delItemsErr } = await supabase
      .from("settlement_items")
      .delete()
      .eq("workspace_id", workspace_id)
      .in("settlement_id", ids);

    if (delItemsErr) return NextResponse.json({ error: delItemsErr.message }, { status: 500 });

    const { error: delHeadErr } = await supabase
      .from("settlements")
      .delete()
      .eq("workspace_id", workspace_id)
      .in("id", ids);

    if (delHeadErr) return NextResponse.json({ error: delHeadErr.message }, { status: 500 });

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
