import { NextResponse } from "next/server";
import { apiError, apiInternalError, parseJson } from "@/lib/api/http";
import { assertWorkspaceAccess, WorkspaceAccessError } from "@/lib/api/workspaceAccess";
import { createInvestmentRecord, deleteInvestmentRecord, getInvestmentSnapshot, updateInvestmentRecord } from "@/lib/investments";

const workspaceFrom = (request: Request, body?: Record<string, unknown>) => {
  const { searchParams } = new URL(request.url);
  return String(searchParams.get("workspace_id") ?? body?.workspace_id ?? "").trim();
};

function failure(error: unknown, fallback: string) {
  if (error instanceof WorkspaceAccessError) return apiError(error.message, { status: error.status, successFalse: true });
  if (error instanceof Error && /^(請輸入|缺少|找不到|不支援|交易|股數|成交價|手續費|交易稅|股利|幣別|券商|股票|已有|相同|\d{4}-)/.test(error.message)) {
    return apiError(error.message, { status: 400, successFalse: true });
  }
  return apiInternalError(error, { context: fallback, message: fallback, successFalse: true });
}

export async function GET(request: Request) {
  try {
    const workspaceId = await assertWorkspaceAccess(workspaceFrom(request));
    return NextResponse.json({ success: true, data: await getInvestmentSnapshot(workspaceId) });
  } catch (error) { return failure(error, "讀取股票資料失敗"); }
}

export async function POST(request: Request) {
  try {
    const body = await parseJson<Record<string, unknown>>(request, {});
    const workspaceId = await assertWorkspaceAccess(workspaceFrom(request, body));
    const resource = String(body.resource ?? "");
    return NextResponse.json({ success: true, data: await createInvestmentRecord(workspaceId, resource, body) }, { status: 201 });
  } catch (error) { return failure(error, "新增股票資料失敗"); }
}

export async function PATCH(request: Request) {
  try {
    const body = await parseJson<Record<string, unknown>>(request, {});
    const workspaceId = await assertWorkspaceAccess(workspaceFrom(request, body));
    const resource = String(body.resource ?? "");
    const id = String(body.id ?? "");
    return NextResponse.json({ success: true, data: await updateInvestmentRecord(workspaceId, resource, id, body) });
  } catch (error) { return failure(error, "更新股票資料失敗"); }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = await assertWorkspaceAccess(workspaceFrom(request));
    await deleteInvestmentRecord(workspaceId, String(searchParams.get("resource") ?? ""), String(searchParams.get("id") ?? ""));
    return NextResponse.json({ success: true });
  } catch (error) { return failure(error, "刪除股票資料失敗"); }
}
