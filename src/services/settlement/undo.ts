import { supabase } from "@/lib/supabaseClient";

export async function undoSettlementItem(params: { workspace_id: string; id: string }) {
  const { workspace_id, id } = params;
  if (!workspace_id) throw new Error("缺少 workspace_id");
  if (!id) throw new Error("缺少 id");

  const { data, error } = await supabase.rpc("undo_settlement_item_atomic", {
    p_workspace_id: workspace_id,
    p_item_id: id,
  });
  if (error) throw error;

  return { success: true, settlement_id: String(data) };
}
