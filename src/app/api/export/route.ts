import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { assertWorkspaceAccess, WorkspaceAccessError } from "@/lib/api/workspaceAccess";
import { backupResponse } from "@/lib/backup-response";
export const maxDuration=60;
export async function GET(request:Request) {
  try {
    const workspaceId=await assertWorkspaceAccess(new URL(request.url).searchParams.get('workspace_id')||'');
    const {data,error}=await supabase.rpc('export_family_backup',{p_workspace_id:workspaceId});
    if(error||!data) throw new Error('BACKUP_READ_FAILED');
    return await backupResponse('family',workspaceId,data);
  } catch(error) {
    if(error instanceof WorkspaceAccessError) return NextResponse.json({error:error.message},{status:error.status});
    return NextResponse.json({error:'備份失敗或資料超過線上備份上限，未產生備份檔；請重試或聯絡管理員。'},{status:500,headers:{'Cache-Control':'no-store'}});
  }
}
