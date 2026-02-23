// src/app/api/sticky-items/[id]/route.ts
import { NextResponse } from "next/server";
import { apiError, parseJson } from "@/lib/api/http";
import { patchStickyItem, softDeleteStickyItem } from "@/lib/stickiesRepo";


function getIdFromParamsOrUrl(req: Request, params?: any) {
  let id = params?.id;
  if (Array.isArray(id)) id = id[0];
  id = String(id || "").trim();
  if (id) return id;

  const u = new URL(req.url);
  const parts = u.pathname.split("/").filter(Boolean);
  // /api/sticky-items/:id
  const idx = parts.lastIndexOf("sticky-items");
  return idx >= 0 ? String(parts[idx + 1] || "").trim() : "";
}

export async function PATCH(req: Request, ctx: any) {
  try {
    const id = getIdFromParamsOrUrl(req, ctx?.params);
    if (!id) return apiError("缺少ID（path params.id）", { successFalse: true });

    const body = await parseJson<Record<string, any>>(req, {});
    await patchStickyItem(id, {
      text: typeof body?.text === "string" ? body.text : undefined,
      is_done: typeof body?.is_done === "boolean" ? body.is_done : undefined,
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

    await softDeleteStickyItem(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
