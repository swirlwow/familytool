// src/app/api/settlement/history/route.ts
import { NextResponse } from "next/server";
import { apiError, parseJson } from "@/lib/api/http";
import { getHistory, deleteHistory } from "@/services/settlement/history";


export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspace_id = searchParams.get("workspace_id") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const limit = searchParams.get("limit");

    if (!workspace_id) return apiError("缺少 workspace_id");

    const result = await getHistory({ workspace_id, from, to, limit });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message, data: [] }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await parseJson<Record<string, any>>(req, {});
    const { workspace_id, id } = body || {};

    if (!workspace_id) return apiError("缺少 workspace_id");
    if (!id) return apiError("缺少 id");

    const result = await deleteHistory({ workspace_id, id });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
