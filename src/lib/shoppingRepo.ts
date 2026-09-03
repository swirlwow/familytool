import { supabase } from "@/lib/supabaseClient";

export const SHOPPING_STATUSES = ["pending", "planned", "waiting_sale", "purchased", "skipped"] as const;
export const SHOPPING_PRIORITIES = ["low", "normal", "high"] as const;
export type ShoppingStatus = (typeof SHOPPING_STATUSES)[number];
export type ShoppingPriority = (typeof SHOPPING_PRIORITIES)[number];

export type ShoppingItem = {
  id: string;
  workspace_id: string;
  name: string;
  url: string | null;
  estimated_price: number | null;
  platform: string | null;
  requested_by: string | null;
  purchase_for: string | null;
  priority: ShoppingPriority;
  planned_date: string | null;
  status: ShoppingStatus;
  note: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const COLUMNS = "id, workspace_id, name, url, estimated_price, platform, requested_by, purchase_for, priority, planned_date, status, note, sort_order, created_at, updated_at, deleted_at";

function cleanOptional(value: unknown, maxLength = 500) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}

export function normalizeShoppingUrl(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.length > 2048) throw new Error("商品連結過長");
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("商品連結格式不正確");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("商品連結僅支援 http 或 https");
  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  return parsed.toString();
}

export function inferShoppingPlatform(url: string | null) {
  if (!url) return null;
  const host = new URL(url).hostname.replace(/^www\./, "");
  const known: Array<[RegExp, string]> = [
    [/shopee\./, "蝦皮"],
    [/momo\./, "momo"],
    [/pchome\./, "PChome"],
    [/costco\./, "好市多"],
    [/rakuten\./, "樂天"],
    [/amazon\./, "Amazon"],
    [/uniqlo\./, "UNIQLO"],
  ];
  return known.find(([pattern]) => pattern.test(host))?.[1] ?? host;
}

function inferShoppingName(url: string | null, platform: string | null) {
  if (!url) return "";
  const segment = new URL(url).pathname.split("/").filter(Boolean).at(-1);
  if (segment && !/^\d+$/.test(segment)) {
    try {
      const decoded = decodeURIComponent(segment).replace(/[-_]+/g, " ").trim();
      if (decoded && decoded.length <= 80) return decoded;
    } catch {
      // Use the stable fallback below.
    }
  }
  return platform ? `${platform} 待確認商品` : "待確認商品";
}

function normalizePrice(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error("預估價格格式不正確");
  return Math.round(number * 100) / 100;
}

function assertStatus(value: unknown): ShoppingStatus {
  const status = String(value ?? "pending") as ShoppingStatus;
  if (!SHOPPING_STATUSES.includes(status)) throw new Error("待購狀態不正確");
  return status;
}

function assertPriority(value: unknown): ShoppingPriority {
  const priority = String(value ?? "normal") as ShoppingPriority;
  if (!SHOPPING_PRIORITIES.includes(priority)) throw new Error("優先程度不正確");
  return priority;
}

export async function listShoppingItems(workspaceId: string) {
  const { data, error } = await supabase.from("shopping_items").select(COLUMNS)
    .eq("workspace_id", workspaceId).is("deleted_at", null)
    .order("sort_order", { ascending: true }).order("created_at", { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as ShoppingItem[];
}

export async function findShoppingDuplicate(workspaceId: string, url: string) {
  const { data, error } = await supabase.from("shopping_items").select("id, name")
    .eq("workspace_id", workspaceId).eq("url", url).is("deleted_at", null).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data as { id: string; name: string } | null;
}

export async function createShoppingItem(workspaceId: string, input: Record<string, unknown>) {
  const url = normalizeShoppingUrl(input.url);
  const platform = cleanOptional(input.platform, 120) ?? inferShoppingPlatform(url);
  const name = cleanOptional(input.name, 200) ?? inferShoppingName(url, platform);
  if (!name) throw new Error("請輸入商品名稱或貼上商品連結");

  const { data: latest, error: latestError } = await supabase.from("shopping_items").select("sort_order")
    .eq("workspace_id", workspaceId).is("deleted_at", null)
    .order("sort_order", { ascending: false }).limit(1).maybeSingle();
  if (latestError) throw new Error(latestError.message);

  const { data, error } = await supabase.from("shopping_items").insert({
    workspace_id: workspaceId,
    name,
    url,
    estimated_price: normalizePrice(input.estimated_price),
    platform,
    requested_by: cleanOptional(input.requested_by, 80),
    purchase_for: cleanOptional(input.purchase_for, 80),
    priority: assertPriority(input.priority),
    planned_date: cleanOptional(input.planned_date, 10),
    status: assertStatus(input.status),
    note: cleanOptional(input.note, 1000),
    sort_order: Number(latest?.sort_order ?? 0) + 10,
  }).select(COLUMNS).single();
  if (error) throw new Error(error.message);
  return data as ShoppingItem;
}

export async function updateShoppingItem(workspaceId: string, id: string, input: Record<string, unknown>) {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("name" in input) {
    const name = cleanOptional(input.name, 200);
    if (!name) throw new Error("商品名稱不可空白");
    payload.name = name;
  }
  if ("url" in input) payload.url = normalizeShoppingUrl(input.url);
  if ("estimated_price" in input) payload.estimated_price = normalizePrice(input.estimated_price);
  if ("platform" in input) payload.platform = cleanOptional(input.platform, 120);
  if ("requested_by" in input) payload.requested_by = cleanOptional(input.requested_by, 80);
  if ("purchase_for" in input) payload.purchase_for = cleanOptional(input.purchase_for, 80);
  if ("priority" in input) payload.priority = assertPriority(input.priority);
  if ("planned_date" in input) payload.planned_date = cleanOptional(input.planned_date, 10);
  if ("status" in input) payload.status = assertStatus(input.status);
  if ("note" in input) payload.note = cleanOptional(input.note, 1000);

  const { data, error } = await supabase.from("shopping_items").update(payload)
    .eq("workspace_id", workspaceId).eq("id", id).is("deleted_at", null).select(COLUMNS).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("找不到這筆待購項目");
  return data as ShoppingItem;
}

export async function deleteShoppingItem(workspaceId: string, id: string) {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("shopping_items")
    .update({ deleted_at: now, updated_at: now }).eq("workspace_id", workspaceId).eq("id", id)
    .is("deleted_at", null).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("找不到這筆待購項目");
}
