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

    // 找出本期 draft headers
    const { data: drafts, error: dErr } = await supabase
      .from("settlements")
      .select("id,note")
      .eq("workspace_id", workspace_id)
      .eq("from_date", from)
      .eq("to_date", to)
      .like("note", `${DRAFT_PREFIX}%`);

    if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

    const rows = (drafts ?? []) as any[];
    if (!rows.length) return NextResponse.json({ success: true, confirmed: 0 });

    // 逐筆更新 note（移除 DRAFT_PREFIX）
    for (const r of rows) {
      const id = r.id;
      const note = String(r.note || "");
      const nextNote = note.startsWith(DRAFT_PREFIX) ? note.slice(DRAFT_PREFIX.length) : note;

      const { error: upErr } = await supabase
        .from("settlements")
        .update({ note: nextNote })
        .eq("workspace_id", workspace_id)
        .eq("id", id);

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, confirmed: rows.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
