// src/app/api/export/route.ts
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseClient";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspace_id = searchParams.get("workspace_id");

  if (!workspace_id) {
    return NextResponse.json({ error: "Missing workspace_id" }, { status: 400 });
  }

  const supabase = getSupabase();
  
  const tables = [
    "payers",
    "payment_methods",
    "category_groups",
    "categories",
    "ledger",
    "ledger_splits",
    "notes",
    "stickies",
    "bill_templates",
    "bill_instances",
    "settlement_drafts",
    "settlement_draft_items",
    "settlement_history",
    "settlement_history_items"
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const backupData: Record<string, any> = {};

  for (const table of tables) {
    try {
      // ✅ 加上 as any，繞過 Supabase 的嚴格型別檢查
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from(table as any)
        .select("*")
        .eq("workspace_id", workspace_id);
      
      if (!error && data) {
        backupData[table] = data;
      }
    // ✅ 捕捉錯誤強制指定為 any，符合 ESLint 規範
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error(`Error exporting table ${table}:`, err.message);
    }
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(backupData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="familytool_backup_${dateStr}.json"`,
    },
  });
}
