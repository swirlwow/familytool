import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/http";
import { supabase } from "@/lib/supabaseClient";


function getLastPathSegment(reqUrl: string) {
  const u = new URL(reqUrl);
  const parts = u.pathname.split("/").filter(Boolean);
  return parts.at(-1) || "";
}

/**
 * DELETE /api/settlement/items/:id?workspace_id=...
 * 撤銷單筆 settlement_items
 */
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const workspace_id = url.searchParams.get("workspace_id") || "";
    const id = getLastPathSegment(req.url).trim();

    if (!workspace_id) return apiError("缺少 workspace_id", { status: 400, extra: { url: req.url } });
    if (!id) return apiError("缺少 id", { status: 400, extra: { url: req.url } });

    const { error } = await supabase
      .from("settlement_items")
      .delete()
      .eq("workspace_id", workspace_id)
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
