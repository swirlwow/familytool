// src/app/api/notes/route.ts
import { NextResponse } from "next/server";
import { apiError, parseJson } from "@/lib/api/http";
import { createNote, listNotes } from "@/lib/notesRepo";


function getWorkspaceId(req: Request, body?: any) {
  const { searchParams } = new URL(req.url);
  return String(searchParams.get("workspace_id") || body?.workspace_id || "").trim();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspace_id = getWorkspaceId(req);
    if (!workspace_id) return apiError("缺少 workspace_id", { successFalse: true });

    const q = String(searchParams.get("q") || "");
    const from = String(searchParams.get("from") || "");
    const to = String(searchParams.get("to") || "");
    const owner = String(searchParams.get("owner") || "");
    const limit = Number(searchParams.get("limit") || "50");

    const data = await listNotes({
      workspace_id,
      q: q || undefined,
      from: from || undefined,
      to: to || undefined,
      owner: owner || undefined,
      limit: Number.isFinite(limit) ? limit : 50,
    });

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await parseJson<Record<string, any>>(req, {});
    const workspace_id = getWorkspaceId(req, body);
    if (!workspace_id) return apiError("缺少 workspace_id", { successFalse: true });

    const title = String(body?.title ?? "").trim();
    if (!title) return apiError("title 不可空白", { successFalse: true });

    const id = await createNote({
      workspace_id,
      owner: body?.owner,
      title,
      content: body?.content ?? "",
      note_date: body?.note_date ?? null,
      date_from: body?.date_from ?? null,
      date_to: body?.date_to ?? null,
      is_important: !!body?.is_important,
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
