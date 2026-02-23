// src/lib/notesRepo.ts
import { supabase } from "@/lib/supabaseClient";

export type NoteRow = {
  id: string;
  workspace_id: string;
  owner: string; // ✅ DB仍是text；格式： "家庭" 或 "子逸,雅惠"
  title: string;
  content: string;
  note_date: string | null; // legacy單日
  date_from: string | null;
  date_to: string | null;
  is_important: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const ALLOWED_OWNERS = ["家庭", "雅惠", "昱元", "子逸", "英茵"] as const;

function mustId(row: any) {
  return String(row?.id || row?.note_id || row?.data?.id || "").trim();
}

/** ✅ 兼容你現在資料可能長這樣： "|子逸|"、"|子逸|雅惠|"、"子逸,雅惠"、"子逸 雅惠" */
export function parseOwners(input: any): string[] {
  if (Array.isArray(input)) {
    return input.map((x) => String(x || "").trim()).filter(Boolean);
  }
  const raw = String(input ?? "").trim();
  if (!raw) return [];

  // 1) 先把 |...| 形式拆出來
  if (raw.includes("|")) {
    const arr = raw
      .split("|")
      .map((x) => x.trim())
      .filter(Boolean);
    // 可能變成 ["子逸", "雅惠"] 或 ["家庭"]
    return arr;
  }

  // 2) 逗號 / 空白
  const arr = raw
    .split(/[,\s]+/g)
    .map((x) => x.trim())
    .filter(Boolean);

  return arr;
}

export function formatOwners(owners: string[]): string {
  const cleaned = Array.from(
    new Set(
      owners
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .map((x) => x.replace(/\|/g, "")) // 移除任何殘留 |
    )
  ).filter((x) => (ALLOWED_OWNERS as readonly string[]).includes(x));

  // 沒選就回家庭
  if (cleaned.length === 0) return "家庭";
  return cleaned.join(",");
}

/** ✅ 讓 create/patch 可以吃 owner: string | string[] */
export function normOwnerField(v: any): string {
  const arr = parseOwners(v);
  return formatOwners(arr);
}

/** ✅ overlap（行事曆/清單都適用） */
function applyOverlapFilter(query: any, from?: string, to?: string) {
  if (!from && !to) return query;
  const f = from || "1900-01-01";
  const t = to || "2999-12-31";

  return query.or(
    `and(date_from.lte.${t},date_to.gte.${f}),and(date_from.is.null,note_date.gte.${f},note_date.lte.${t})`
  );
}

export async function listNotes(params: {
  workspace_id: string;
  q?: string;
  from?: string;
  to?: string;
  owner?: string; // ✅ 單一owner過濾（暫維持）
  limit?: number;
}) {
  const { workspace_id, q, from, to, owner, limit = 50 } = params;

  let query = supabase
    .from("notes")
    .select(
      "id, workspace_id, owner, title, content, note_date, date_from, date_to, is_important, created_at, updated_at, deleted_at"
    )
    .eq("workspace_id", workspace_id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  // ✅ 若你要「單人過濾」：owner包含該人（可能是 "子逸,雅惠"）
  if (owner && owner.trim()) {
    const o = owner.trim();
    // ilike %o% 會有誤判，但你 owner 值都固定五個人名，不會撞字，先穩定優先
    query = query.ilike("owner", `%${o}%`);
  }

  if (q && q.trim()) {
    const kw = `%${q.trim()}%`;
    query = query.or(`title.ilike.${kw},content.ilike.${kw}`);
  }

  query = applyOverlapFilter(query, from, to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? [])
    .map((r: any) => ({
      ...r,
      id: mustId(r),
      owner: normOwnerField(r?.owner), // ✅ 回傳乾淨格式（逗號，不含 |）
      date_from: r?.date_from ?? null,
      date_to: r?.date_to ?? null,
    }))
    .filter((r: any) => r.id);

  return rows as NoteRow[];
}

export async function createNote(input: {
  workspace_id: string;
  owner?: string | string[];
  title: string;
  content?: string;
  note_date?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  is_important?: boolean;
}) {
  const {
    workspace_id,
    owner = "家庭",
    title,
    content = "",
    note_date = null,
    date_from = null,
    date_to = null,
    is_important = false,
  } = input;

  const t = String(title ?? "").trim();
  if (!t) throw new Error("title 不可空白");

  const df = date_from ?? note_date ?? null;
  const dt = date_to ?? date_from ?? note_date ?? null;

  const { data, error } = await supabase
    .from("notes")
    .insert([
      {
        workspace_id,
        owner: normOwnerField(owner),
        title: t,
        content,
        note_date: df, // legacy
        date_from: df,
        date_to: dt,
        is_important,
      },
    ])
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const id = mustId(data);
  if (!id) throw new Error("createNote: 缺少 id（insert 回傳異常）");
  return id;
}

export async function getNote(workspace_id: string, id: string) {
  const { data, error } = await supabase
    .from("notes")
    .select(
      "id, workspace_id, owner, title, content, note_date, date_from, date_to, is_important, created_at, updated_at, deleted_at"
    )
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("記事不存在");

  const note = {
    ...data,
    id: mustId(data),
    owner: normOwnerField(data?.owner),
    date_from: data?.date_from ?? null,
    date_to: data?.date_to ?? null,
  };

  if (!note.id) throw new Error("getNote: 缺少 id（資料異常）");
  return note as NoteRow;
}

export async function patchNote(input: {
  workspace_id: string;
  id: string;
  owner?: string | string[];
  title?: string;
  content?: string;
  note_date?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  is_important?: boolean;
}) {
  const { workspace_id, id, ...patch } = input;

  const payload: any = {
    updated_at: new Date().toISOString(),
  };

  if (typeof patch.title !== "undefined") {
    const t = String(patch.title ?? "").trim();
    if (!t) throw new Error("title 不可空白");
    payload.title = t;
  }
  if (typeof patch.content !== "undefined") payload.content = patch.content ?? "";

  if (typeof patch.owner !== "undefined") payload.owner = normOwnerField(patch.owner);

  // ✅ 日期同步：date_from 有值 -> note_date 同步
  const df = patch.date_from ?? patch.note_date ?? undefined;
  const dt = patch.date_to ?? patch.date_from ?? patch.note_date ?? undefined;
  if (typeof df !== "undefined") {
    payload.date_from = df;
    payload.note_date = df;
  }
  if (typeof dt !== "undefined") payload.date_to = dt;

  const { error } = await supabase.from("notes").update(payload).eq("workspace_id", workspace_id).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function softDeleteNote(workspace_id: string, id: string) {
  const { error } = await supabase
    .from("notes")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspace_id)
    .eq("id", id);

  if (error) throw new Error(error.message);
}
