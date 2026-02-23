import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/http";
import { supabase } from "@/lib/supabaseClient";


function getLastPathSegment(reqUrl: string) {
  const u = new URL(reqUrl);
  const parts = u.pathname.split("/").filter(Boolean);
  return parts.at(-1) || "";
}

/**
 * DELETE /api/settlement/:id?workspace_id=...
 * 撤銷整筆 settlements（先刪 items，再刪 header）
 */
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const workspace_id = url.searchParams.get("workspace_id") || "";

    // ✅ 直接從 URL pathname 抓最後一段當 settlement_id
    const settlement_id = getLastPathSegment(req.url).trim();

    if (!workspace_id) return apiError("缺少 workspace_id", { status: 400, extra: { url: req.url } });
    if (!settlement_id || settlement_id === "settlement")
      return apiError("缺少 settlement id", { status: 400, extra: { url: req.url } });

    // 1) 刪掉 items
    const { error: itemErr } = await supabase
      .from("settlement_items")
      .delete()
      .eq("workspace_id", workspace_id)
      .eq("settlement_id", settlement_id);

    if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });

    // 2) 刪掉 header
    const { error: headErr } = await supabase
      .from("settlements")
      .delete()
      .eq("workspace_id", workspace_id)
      .eq("id", settlement_id);

    if (headErr) return NextResponse.json({ error: headErr.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
