import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { assertWorkspaceAccess, WorkspaceAccessError } from "@/lib/api/workspaceAccess";

const WORKSPACE_TABLES = [
  "user_workspaces",
  "members",
  "account_records",
  "accounts",
  "bill_instances",
  "bill_templates",
  "calendar_events",
  "categories",
  "category_groups",
  "ledger_categories",
  "ledger_entries",
  "ledger_merchants",
  "ledger_splits",
  "notes",
  "payers",
  "payment_methods",
  "payments",
  "settlement_items",
  "settlement_split_links",
  "settlements",
  "stickies",
] as const;

async function readWorkspaceTable(table: string, workspaceId: string) {
  const { data, error } = await supabase.from(table).select("*").eq("workspace_id", workspaceId);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = await assertWorkspaceAccess(searchParams.get("workspace_id") || "");

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", workspaceId)
      .maybeSingle();
    if (workspaceError) throw new Error(`workspaces: ${workspaceError.message}`);

    const tables: Record<string, unknown[]> = { workspaces: workspace ? [workspace] : [] };
    for (const table of WORKSPACE_TABLES) {
      tables[table] = await readWorkspaceTable(table, workspaceId);
    }

    const stickyIds = (tables.stickies as Array<{ id?: string }>).map((row) => row.id).filter(Boolean) as string[];
    if (stickyIds.length > 0) {
      const { data, error } = await supabase.from("sticky_items").select("*").in("sticky_id", stickyIds);
      if (error) throw new Error(`sticky_items: ${error.message}`);
      tables.sticky_items = data ?? [];
    } else {
      tables.sticky_items = [];
    }

    const exportedAt = new Date().toISOString();
    const payload = {
      format: "familytool-backup",
      version: 1,
      exported_at: exportedAt,
      workspace_id: workspaceId,
      counts: Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.length])),
      tables,
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="familytool_backup_${exportedAt.slice(0, 10)}.json"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Workspace export failed", error);
    return NextResponse.json({ error: "備份失敗，請稍後再試" }, { status: 500 });
  }
}
