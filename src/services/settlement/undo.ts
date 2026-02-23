// src/services/settlement/undo.ts
import {
  getSettlementItemById,
  deleteSettlementItemById,
  countSettlementItemsBySettlementId,
  deleteSettlementHeader,
} from "./repo";

export async function undoSettlementItem(params: { workspace_id: string; id: string }) {
  const { workspace_id, id } = params;
  if (!workspace_id) throw new Error("缺少 workspace_id");
  if (!id) throw new Error("缺少 id");

  const item = await getSettlementItemById({ workspace_id, id });
  if (!item) throw new Error("找不到 settlement_item");

  const settlement_id = String((item as any).settlement_id || "");
  if (!settlement_id) throw new Error("settlement_id 不存在");

  // 1) 刪掉明細
  await deleteSettlementItemById({ workspace_id, id });

  // 2) 若 header 下面已無任何 items，則刪 header
  const remainCount = await countSettlementItemsBySettlementId({ workspace_id, settlement_id });
  if (remainCount <= 0) {
    await deleteSettlementHeader({ workspace_id, id: settlement_id });
  }

  return { success: true, settlement_id };
}
