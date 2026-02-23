import { NextResponse } from "next/server";
import { apiError, parseJson } from "@/lib/api/http";
import { patchEvent, softDeleteEvent } from "@/lib/calendarRepo";


export async function PATCH(req: Request, ctx: any) {
  try {
    const body = await parseJson<Record<string, any>>(req, {});
    const { workspace_id, ...patch } = body || {};
    const id = ctx.params.id;

    if (!workspace_id) return apiError("缺少 workspace_id");
    if (!id) return apiError("缺少 id");

    await patchEvent({ workspace_id, id, ...patch });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: any) {
  try {
    const { searchParams } = new URL(req.url);
    const workspace_id = searchParams.get("workspace_id") || "";
    const id = ctx.params.id;

    if (!workspace_id) return apiError("缺少 workspace_id");
    if (!id) return apiError("缺少 id");

    await softDeleteEvent(workspace_id, id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
