import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { assertWorkspaceAccess, WorkspaceAccessError } from "@/lib/api/workspaceAccess";
import { normalizePurchase, uuid } from "@/lib/purchases";
import { readAllPages } from "@/lib/read-all-pages";

function failure(error: unknown) {
  return NextResponse.json({error:error instanceof Error ? error.message : "購買紀錄處理失敗"}, {status:error instanceof WorkspaceAccessError ? error.status : 400});
}
export async function GET(req: Request) {
  try {
    const workspace=await assertWorkspaceAccess(new URL(req.url).searchParams.get("workspace_id") || "");
    const data=await readAllPages((from,to)=>supabase.from("shopping_purchases").select("*",{count:"exact"})
      .eq("workspace_id",workspace).is("deleted_at",null).order("id").range(from,to),r=>String(r.id));
    return NextResponse.json({data},{headers:{"Cache-Control":"private, no-store"}});
  } catch(error) { return failure(error); }
}
export async function POST(req: Request) {
  try {
    const body=await req.json();
    const workspace=await assertWorkspaceAccess(String(body.workspace_id || ""));
    const key=uuid(body.request_key);
    const args=body.action==="rebuy"
      ? {p_workspace:workspace,p_id:uuid(body.id),p_key:key}
      : {p_workspace:workspace,p_key:key,p_source:body.shopping_item_id ? uuid(body.shopping_item_id) : null,p_data:normalizePurchase(body)};
    if(body.action && body.action!=="rebuy") throw new Error("操作不正確");
    const {data,error}=await supabase.rpc(body.action==="rebuy" ? "rebuy_shopping_purchase" : "record_shopping_purchase",args);
    if(error) throw new Error(error.message);
    return NextResponse.json({data},{status:201});
  } catch(error) { return failure(error); }
}
export async function PATCH(req: Request) {
  try {
    const body=await req.json();
    const workspace=await assertWorkspaceAccess(String(body.workspace_id || ""));
    const id=uuid(body.id);
    const {data:old,error:readError}=await supabase.from("shopping_purchases").select("*").eq("workspace_id",workspace).eq("id",id).is("deleted_at",null).maybeSingle();
    if(readError || !old) throw new Error("找不到購買紀錄");
    const payload=normalizePurchase(body,old.legacy===true);
    const {data,error}=await supabase.from("shopping_purchases").update({...payload,updated_at:new Date().toISOString()})
      .eq("workspace_id",workspace).eq("id",id).is("deleted_at",null).select("*").single();
    if(error) throw new Error(error.message);
    return NextResponse.json({data});
  } catch(error) { return failure(error); }
}
export async function DELETE(req: Request) {
  try {
    const body=await req.json();
    const workspace=await assertWorkspaceAccess(String(body.workspace_id || ""));
    if(body.restore !== undefined && typeof body.restore !== "boolean") throw new Error("恢復選項不正確");
    const {error}=await supabase.rpc("remove_shopping_purchase",{p_workspace:workspace,p_id:uuid(body.id),p_restore:body.restore===true});
    if(error) throw new Error(error.message);
    return NextResponse.json({success:true});
  } catch(error) { return failure(error); }
}
