// src/app/api/stickies/route.ts
import { NextResponse } from "next/server";
import { apiError, parseJson } from "@/lib/api/http";
import { createSticky, listStickies } from "@/lib/stickiesRepo";


export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const workspace_id = String(searchParams.get("workspace_id") || "").trim();
    if (!workspace_id) return apiError("缺少 workspace_id", { successFalse: true });

    const q = String(searchParams.get("q") || "").trim();
    const owner = String(searchParams.get("owner") || "").trim();
    const limit = Number(searchParams.get("limit") || 200);

    const data = await listStickies({ workspace_id, q, owner, limit });
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await parseJson<Record<string, any>>(req, {});

    const workspace_id = String(body?.workspace_id || "").trim();
    if (!workspace_id) return apiError("缺少 workspace_id", { successFalse: true });

    const id = await createSticky({
      workspace_id,
      owner: body?.owner,
      title: body?.title,
      content: body?.content ?? "",
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
