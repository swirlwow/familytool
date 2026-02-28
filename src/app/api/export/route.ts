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
  
  // 將系統中所有的資料表列出來
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

  const backupData: Record<string, any> = {};

  // 跑迴圈把每個表的資料撈出來
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("workspace_id", workspace_id);
      
      if (!error && data) {
        backupData[table] = data;
      }
    } catch (err) {
      console.error(`Error exporting table ${table}:`, err);
    }
  }

  // 設定 Header，讓瀏覽器收到時自動觸發「下載檔案」
  const dateStr = new Date().toISOString().slice(0, 10); // 取得 YYYY-MM-DD
  return new NextResponse(JSON.stringify(backupData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="familytool_backup_${dateStr}.json"`,
    },
  });
}