import { NextResponse } from "next/server";
import { apiError, parseJson } from "@/lib/api/http";
import { createShoppingItem, findShoppingDuplicate, listShoppingItems, normalizeShoppingUrl } from "@/lib/shoppingRepo";

function workspaceIdFrom(req: Request, body?: Record<string, unknown>) {
  const { searchParams } = new URL(req.url);
  return String(searchParams.get("workspace_id") ?? body?.workspace_id ?? "").trim();
}

export async function GET(req: Request) {
  try {
    const workspaceId = workspaceIdFrom(req);
    if (!workspaceId) return apiError("缺少 workspace_id", { successFalse: true });
    return NextResponse.json({ success: true, data: await listShoppingItems(workspaceId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取待購清單失敗";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await parseJson<Record<string, unknown>>(req, {});
    const workspaceId = workspaceIdFrom(req, body);
    if (!workspaceId) return apiError("缺少 workspace_id", { successFalse: true });

    const normalizedUrl = normalizeShoppingUrl(body.url);
    if (normalizedUrl && body.force_duplicate !== true) {
      const duplicate = await findShoppingDuplicate(workspaceId, normalizedUrl);
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: `已有相同連結：「${duplicate.name}」`, duplicate },
          { status: 409 },
        );
      }
    }

    const data = await createShoppingItem(workspaceId, { ...body, url: normalizedUrl });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "新增待購項目失敗";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
