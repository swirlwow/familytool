// src/app/api/stickies/[id]/items/route.ts
import { NextResponse } from "next/server";
import { apiError, parseJson } from "@/lib/api/http";
import { createStickyItem, listStickyItems, reorderStickyItems } from "@/lib/stickiesRepo";


function getIdFromParamsOrUrl(req: Request, params?: any) {
  let id = params?.id;
  if (Array.isArray(id)) id = id[0];
  id = String(id || "").trim();
  if (id) return id;

  const u = new URL(req.url);
  const parts = u.pathname.split("/").filter(Boolean);
  // /api/stickies/:id/items
  const idx = parts.lastIndexOf("stickies");
  return idx >= 0 ? String(parts[idx + 1] || "").trim() : "";
}

export async function GET(req: Request, ctx: any) {
  try {
    const sticky_id = getIdFromParamsOrUrl(req, ctx?.params);
    if (!sticky_id) return apiError("缺少ID（path params.id）", { successFalse: true });

    const data = await listStickyItems(sticky_id);
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: any) {
  try {
    const sticky_id = getIdFromParamsOrUrl(req, ctx?.params);
    if (!sticky_id) return apiError("缺少ID（path params.id）", { successFalse: true });

    const body = await parseJson<Record<string, any>>(req, {});
    const text = String(body?.text || "").trim();
    if (!text) return apiError("text 不可空白", { successFalse: true });

    const id = await createStickyItem(sticky_id, text);
    return NextResponse.json({ success: true, data: { id } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// ✅ 拖曳排序：PATCH /api/stickies/:id/items  { orderedIds: string[] }
export async function PATCH(req: Request, ctx: any) {
  try {
    const sticky_id = getIdFromParamsOrUrl(req, ctx?.params);
    if (!sticky_id) return apiError("缺少ID（path params.id）", { successFalse: true });

    const body = await parseJson<Record<string, any>>(req, {});
    const orderedIds = Array.isArray(body?.orderedIds) ? body.orderedIds : [];
    if (orderedIds.length === 0) return apiError("orderedIds 不可空白", { successFalse: true });

    await reorderStickyItems(sticky_id, orderedIds);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
