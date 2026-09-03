import { NextResponse } from "next/server";
import { apiError, parseJson } from "@/lib/api/http";
import { deleteShoppingItem, findShoppingDuplicate, normalizeShoppingUrl, updateShoppingItem } from "@/lib/shoppingRepo";

function workspaceIdFrom(req: Request, body?: Record<string, unknown>) {
  const { searchParams } = new URL(req.url);
  return String(searchParams.get("workspace_id") ?? body?.workspace_id ?? "").trim();
}

async function idFromContext(context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  return String(params.id ?? "").trim();
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = await idFromContext(context);
    if (!id) return apiError("缺少待購項目 ID", { successFalse: true });
    const body = await parseJson<Record<string, unknown>>(req, {});
    const workspaceId = workspaceIdFrom(req, body);
    if (!workspaceId) return apiError("缺少 workspace_id", { successFalse: true });

    if ("url" in body) {
      const normalizedUrl = normalizeShoppingUrl(body.url);
      body.url = normalizedUrl;
      if (normalizedUrl && body.force_duplicate !== true) {
        const duplicate = await findShoppingDuplicate(workspaceId, normalizedUrl);
        if (duplicate && duplicate.id !== id) {
          return NextResponse.json(
            { success: false, error: `已有相同連結：「${duplicate.name}」`, duplicate },
            { status: 409 },
          );
        }
      }
    }

    return NextResponse.json({ success: true, data: await updateShoppingItem(workspaceId, id, body) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新待購項目失敗";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = await idFromContext(context);
    if (!id) return apiError("缺少待購項目 ID", { successFalse: true });
    const workspaceId = workspaceIdFrom(req);
    if (!workspaceId) return apiError("缺少 workspace_id", { successFalse: true });
    await deleteShoppingItem(workspaceId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "刪除待購項目失敗";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
