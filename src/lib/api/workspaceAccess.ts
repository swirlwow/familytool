import "server-only";

import { supabase } from "@/lib/supabaseClient";

export class WorkspaceAccessError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 403 | 500
  ) {
    super(message);
    this.name = "WorkspaceAccessError";
  }
}

export async function assertWorkspaceAccess(workspaceId: string) {
  const normalizedId = workspaceId.trim();
  if (!normalizedId) throw new WorkspaceAccessError("缺少 workspace_id", 400);

  const { data, error } = await supabase
    .from("user_workspaces")
    .select("workspace_id")
    .eq("workspace_id", normalizedId)
    .maybeSingle();

  if (error) {
    console.error("Workspace access check failed", error);
    throw new WorkspaceAccessError("無法確認工作區權限", 500);
  }
  if (!data) throw new WorkspaceAccessError("沒有此工作區的存取權限", 403);

  return normalizedId;
}
