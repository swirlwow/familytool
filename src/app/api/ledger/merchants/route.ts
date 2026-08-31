import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { apiError, apiInternalError } from "@/lib/api/http";
import { assertWorkspaceAccess, WorkspaceAccessError } from "@/lib/api/workspaceAccess";
import { normalizeMerchantName } from "@/lib/ledger/details";

function failure(error: unknown) {
  if (error instanceof WorkspaceAccessError) return apiError(error.message, { status: error.status });
  return apiInternalError(error, { context: "Manage ledger merchants" });
}

export async function GET(req: Request) {
  try {
    const workspaceId = await assertWorkspaceAccess(new URL(req.url).searchParams.get("workspace_id") || "");
    const { data, error } = await supabase.from("ledger_merchants")
      .select("id,name,is_active").eq("workspace_id", workspaceId).order("name");
    if (error) return failure(error);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

async function save(req: Request, editing: boolean) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.workspace_id !== "string") return apiError("缺少工作區");
    const workspaceId = await assertWorkspaceAccess(body.workspace_id);
    const fields: { name?: string; is_active?: boolean } = {};
    if (!editing || body.name !== undefined) {
      if (typeof body.name !== "string") return apiError("請輸入店家名稱");
      const name = normalizeMerchantName(body.name);
      if (!name || name.length > 120) return apiError("店家名稱請填寫 1–120 個字");
      fields.name = name;
    }
    if (body.is_active !== undefined) {
      if (typeof body.is_active !== "boolean") return apiError("啟用狀態不正確");
      fields.is_active = body.is_active;
    }
    if (editing && (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id) || !Object.keys(fields).length)) {
      return apiError("缺少有效的店家或修改內容");
    }
    const query = editing
      ? supabase.from("ledger_merchants").update(fields).eq("workspace_id", workspaceId).eq("id", body.id)
      : supabase.from("ledger_merchants").insert({ workspace_id: workspaceId, ...fields });
    const { data, error } = await query.select("id,name,is_active").maybeSingle();
    if (error?.code === "23505") return apiError("這個店家已存在；若已停用，可從管理重新啟用。", { status: 409 });
    if (error) return failure(error);
    if (!data) return apiError("找不到這個店家", { status: 404 });
    return NextResponse.json({ data }, { status: editing ? 200 : 201 });
  } catch (error) { return failure(error); }
}

export async function POST(req: Request) { return save(req, false); }
export async function PATCH(req: Request) { return save(req, true); }
