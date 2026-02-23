// src/lib/stickiesRepo.ts
import { supabase } from "@/lib/supabaseClient";

export type StickyRow = {
  id: string;
  workspace_id: string;
  owner: string;
  title: string;
  content: string | null;
  updated_at: string;
  created_at: string;
  deleted_at: string | null;
};

export type StickyItemRow = {
  id: string;
  sticky_id: string;
  text: string;
  is_done: boolean;
  sort: number;
  updated_at: string;
  created_at: string;
  deleted_at: string | null;
};

function mustId(x: any) {
  return String(x?.id || x?.data?.id || "").trim();
}

function normOwner(v: any) {
  const s = String(v ?? "").trim();
  return s || "家庭";
}

/* =========================
 * Stickies（主表）
 * ========================= */

export async function listStickies(params: {
  workspace_id: string;
  q?: string;
  owner?: string;
  limit?: number;
}) {
  const { workspace_id, q, owner, limit = 200 } = params;

  let query = supabase
    .from("stickies")
    .select("id, workspace_id, owner, title, content, updated_at, created_at, deleted_at")
    .eq("workspace_id", workspace_id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (owner && owner.trim()) query = query.eq("owner", owner.trim());

  if (q && q.trim()) {
    const kw = `%${q.trim()}%`;
    query = query.or(`title.ilike.${kw},content.ilike.${kw}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((r: any) => ({
      ...r,
      id: mustId(r),
      owner: normOwner(r?.owner),
      content: r?.content ?? "",
    }))
    .filter((r: any) => r.id);
}

export async function createSticky(input: {
  workspace_id: string;
  owner?: string;
  title: string;
  content?: string;
}) {
  const { workspace_id, owner = "家庭", title, content = "" } = input;

  const { data, error } = await supabase
    .from("stickies")
    .insert([{ workspace_id, owner: normOwner(owner), title, content }])
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const id = mustId(data);
  if (!id) throw new Error("createSticky: 缺少 id（insert 回傳異常）");
  return id;
}

export async function getSticky(workspace_id: string, id: string) {
  const { data, error } = await supabase
    .from("stickies")
    .select("id, workspace_id, owner, title, content, updated_at, created_at, deleted_at")
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("便條紙不存在");

  const row = {
    ...data,
    id: mustId(data),
    owner: normOwner(data?.owner),
    content: data?.content ?? "",
  };

  if (!row.id) throw new Error("getSticky: 缺少 id（資料異常）");
  return row;
}

export async function patchSticky(input: {
  workspace_id: string;
  id: string;
  owner?: string;
  title?: string;
  content?: string;
}) {
  const { workspace_id, id, ...patch } = input;

  const payload: any = {
    updated_at: new Date().toISOString(),
  };

  if (typeof patch.owner !== "undefined") payload.owner = normOwner(patch.owner);
  if (typeof patch.title !== "undefined") payload.title = patch.title;
  if (typeof patch.content !== "undefined") payload.content = patch.content;

  const { error } = await supabase
    .from("stickies")
    .update(payload)
    .eq("workspace_id", workspace_id)
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function softDeleteSticky(workspace_id: string, id: string) {
  const { error } = await supabase
    .from("stickies")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspace_id)
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/* =========================
 * Sticky Items（子表 sticky_items）
 * 注意：sticky_items 沒有 workspace_id 欄位
 * 欄位用 is_done（不是 done）
 * ========================= */

export async function listStickyItems(sticky_id: string) {
  const { data, error } = await supabase
    .from("sticky_items")
    .select("id, sticky_id, text, is_done, sort, created_at, updated_at, deleted_at")
    .eq("sticky_id", sticky_id)
    .is("deleted_at", null)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((r: any) => ({
      ...r,
      id: mustId(r),
      is_done: !!r?.is_done,
      sort: Number(r?.sort ?? 0),
    }))
    .filter((r: any) => r.id);
}

export async function createStickyItem(sticky_id: string, text: string) {
  const t = String(text || "").trim();
  if (!t) throw new Error("text 不可空白");

  // 取得目前最大 sort，新增用 max+1（避免同時新增排序亂）
  const { data: maxRow, error: maxErr } = await supabase
    .from("sticky_items")
    .select("sort")
    .eq("sticky_id", sticky_id)
    .is("deleted_at", null)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxErr) throw new Error(maxErr.message);
  const nextSort = Number(maxRow?.sort ?? 0) + 1;

  const { data, error } = await supabase
    .from("sticky_items")
    .insert([
      {
        sticky_id,
        text: t,
        is_done: false,
        sort: nextSort,
      },
    ])
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const id = mustId(data);
  if (!id) throw new Error("createStickyItem: 缺少 id（insert 回傳異常）");
  return id;
}

export async function patchStickyItem(item_id: string, patch: { text?: string; is_done?: boolean }) {
  const payload: any = { updated_at: new Date().toISOString() };
  if (typeof patch.text !== "undefined") payload.text = String(patch.text ?? "");
  if (typeof patch.is_done !== "undefined") payload.is_done = !!patch.is_done;

  const { error } = await supabase.from("sticky_items").update(payload).eq("id", item_id);
  if (error) throw new Error(error.message);
}

export async function softDeleteStickyItem(item_id: string) {
  const { error } = await supabase
    .from("sticky_items")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", item_id);

  if (error) throw new Error(error.message);
}

export async function reorderStickyItems(sticky_id: string, orderedIds: string[]) {
  // orderedIds: 依畫面順序
  const ids = (orderedIds || []).map((x) => String(x || "").trim()).filter(Boolean);
  if (ids.length === 0) return;

  // 批次更新 sort（用 Promise.all）
  const now = new Date().toISOString();
  const tasks = ids.map((id, idx) =>
    supabase.from("sticky_items").update({ sort: idx + 1, updated_at: now }).eq("id", id).eq("sticky_id", sticky_id)
  );

  const results = await Promise.all(tasks);
  const err = results.find((r) => r.error)?.error;
  if (err) throw new Error(err.message);
}
