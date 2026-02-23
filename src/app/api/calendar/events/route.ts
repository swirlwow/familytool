import { NextResponse } from "next/server";
import { apiError, parseJson } from "@/lib/api/http";
import { listEvents, createEvent } from "@/lib/calendarRepo";


export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspace_id = searchParams.get("workspace_id") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    if (!workspace_id) return apiError("缺少 workspace_id");
    if (!from || !to) return apiError("缺少 from/to（ISO）");

    const data = await listEvents({ workspace_id, from, to });
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, data: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await parseJson<Record<string, any>>(req, {});
    const { workspace_id, title, description, start_at, end_at, all_day, color, location } = body || {};

    if (!workspace_id) return apiError("缺少 workspace_id");
    if (!title) return apiError("缺少 title");
    if (!start_at) return apiError("缺少 start_at（ISO）");

    const id = await createEvent({
      workspace_id,
      title: String(title),
      description: String(description ?? ""),
      start_at: String(start_at),
      end_at: end_at ? String(end_at) : null,
      all_day: all_day !== undefined ? !!all_day : true,
      color: color ? String(color) : "amber",
      location: location ? String(location) : "",
    });

    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
