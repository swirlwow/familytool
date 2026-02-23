// src/services/settlement/history.ts
import { clampInt, fmtDate } from "./utils";
import { deleteSettlementHeader, listHistory } from "./repo";

export async function getHistory(params: {
  workspace_id: string;
  from?: string;
  to?: string;
  limit?: any;
}) {
  const { workspace_id } = params;
  if (!workspace_id) throw new Error("缺少 workspace_id");

  const limit = clampInt(params.limit, 50, 1, 200);

  // 預設最近 90 天
  let fromDate = params.from || "";
  let toDate = params.to || "";

  if (!fromDate || !toDate) {
    const now = new Date();
    const toD = new Date(now);
    const fromD = new Date(now);
    fromD.setDate(fromD.getDate() - 90);

    if (!fromDate) fromDate = fmtDate(fromD);
    if (!toDate) toDate = fmtDate(toD);
  }

  const data = await listHistory({ workspace_id, fromDate, toDate, limit });
  return { data };
}

export async function deleteHistory(params: { workspace_id: string; id: string }) {
  const { workspace_id, id } = params;
  if (!workspace_id) throw new Error("缺少 workspace_id");
  if (!id) throw new Error("缺少 id");

  await deleteSettlementHeader({ workspace_id, id });
  return { success: true };
}
