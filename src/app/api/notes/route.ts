// src/app/api/notes/route.ts
import { NextResponse } from "next/server";
import { apiError, parseJson } from "@/lib/api/http";
import { createNote, listNotes } from "@/lib/notesRepo";

function getWorkspaceId(req: Request, body?: any) {
  const { searchParams } = new URL(req.url);
  return String(searchParams.get("workspace_id") || body?.workspace_id || "").trim();
}

// ✅ 統一 owner 格式：支援 array / JSON字串 / "|" / ","，最後存成 "家庭|爸媽"
const OWNER_LIST = ["家庭", "爸媽", "雅惠", "昱元", "子逸", "英茵"] as const;

function parseOwnerToArray(raw: any): string[] {
  if (raw == null) return ["家庭"];

  if (Array.isArray(raw)) {
    const arr = raw.map((x) => String(x ?? "").trim()).filter(Boolean);
    return arr.length ? arr : ["家庭"];
  }

  const s = String(raw ?? "").trim();
  if (!s) return ["家庭"];

  // JSON array string: '["家庭","爸媽"]'
  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      const j = JSON.parse(s);
      if (Array.isArray(j)) {
        const arr = j.map((x) => String(x ?? "").trim()).filter(Boolean);
        return arr.length ? arr : ["家庭"];
      }
    } catch {
      // ignore
    }
  }

  if (s.includes("|")) return s.split("|").map((x) => x.trim()).filter(Boolean);
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function normalizeOwner(raw: any): string {
  const arr = parseOwnerToArray(raw);

  // ✅ 白名單過濾 + 去重
  const cleaned = Array.from(
    new Set(arr.map((x) => String(x ?? "").trim()).filter(Boolean))
  ).filter((x) => (OWNER_LIST as readonly string[]).includes(x));

  // ✅ 至少要有一個
  const finalArr = cleaned.length ? cleaned : ["家庭"];

  // ✅ 存成字串（DB 最穩）
  return finalArr.join("|");
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspace_id = getWorkspaceId(req);
    if (!workspace_id) return apiError("缺少 workspace_id", { successFalse: true });

    const q = String(searchParams.get("q") || "");
    const from = String(searchParams.get("from") || "");
    const to = String(searchParams.get("to") || "");
    const owner = String(searchParams.get("owner") || "");
    const limit = Number(searchParams.get("limit") || "50");

    const data = await listNotes({
      workspace_id,
      q: q || undefined,
      from: from || undefined,
      to: to || undefined,
      owner: owner || undefined,
      limit: Number.isFinite(limit) ? limit : 50,
    });

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await parseJson<Record<string, any>>(req, {});
    const workspace_id = getWorkspaceId(req, body);
    if (!workspace_id) return apiError("缺少 workspace_id", { successFalse: true });

    const title = String(body?.title ?? "").trim();
    if (!title) return apiError("title 不可空白", { successFalse: true });

    const id = await createNote({
      workspace_id,
      // ✅ 關鍵：永遠存字串，不再把 array 直接丟進 DB
      owner: normalizeOwner(body?.owner),
      title,
      content: body?.content ?? "",
      note_date: body?.note_date ?? null,
      date_from: body?.date_from ?? null,
      date_to: body?.date_to ?? null,
      is_important: !!body?.is_important,
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
