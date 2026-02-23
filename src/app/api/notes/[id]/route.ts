// src/app/api/notes/[id]/route.ts
import { NextResponse } from "next/server";
import { apiError, parseJson } from "@/lib/api/http";
import { getNote, patchNote, softDeleteNote } from "@/lib/notesRepo";


function getWorkspaceId(req: Request, body?: any) {
  const { searchParams } = new URL(req.url);
  return String(searchParams.get("workspace_id") || body?.workspace_id || "").trim();
}

function getIdFromParamsOrUrl(req: Request, params?: any) {
  let id = params?.id;
  if (Array.isArray(id)) id = id[0];
  id = String(id || "").trim();
  if (id) return id;

  const u = new URL(req.url);
  const parts = u.pathname.split("/").filter(Boolean);
  const idx = parts.lastIndexOf("notes");
  return idx >= 0 ? String(parts[idx + 1] || "").trim() : "";
}

export async function GET(req: Request, ctx: any) {
  try {
    const id = getIdFromParamsOrUrl(req, ctx?.params);
    if (!id) return apiError("缺少ID（path params.id）", { successFalse: true });

    const workspace_id = getWorkspaceId(req);
    if (!workspace_id) return apiError("缺少 workspace_id", { successFalse: true });

    const data = await getNote(workspace_id, id);
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: any) {
  try {
    const id = getIdFromParamsOrUrl(req, ctx?.params);
    if (!id) return apiError("缺少ID（path params.id）", { successFalse: true });

    const body = await parseJson<Record<string, any>>(req, {});
    const workspace_id = getWorkspaceId(req, body);
    if (!workspace_id) return apiError("缺少 workspace_id", { successFalse: true });

    await patchNote({
      workspace_id,
      id,
      owner: body?.owner,
      title: body?.title,
      content: body?.content,
      date_from: body?.date_from,
      date_to: body?.date_to,
      note_date: body?.note_date,
      is_important: body?.is_important,
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: any) {
  try {
    const id = getIdFromParamsOrUrl(req, ctx?.params);
    if (!id) return apiError("缺少ID（path params.id）", { successFalse: true });

    const workspace_id = getWorkspaceId(req);
    if (!workspace_id) return apiError("缺少 workspace_id", { successFalse: true });

    await softDeleteNote(workspace_id, id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
