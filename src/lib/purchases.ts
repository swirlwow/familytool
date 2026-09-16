export type Purchase = {
  id: string; workspace_id: string; shopping_item_id: string | null; request_key: string;
  name: string; purchase_date: string | null; quantity: number; total_amount: number | null;
  store: string | null; url: string | null; specification: string | null; note: string | null;
  legacy: boolean; created_at: string; updated_at: string;
};
export function purchaseDate(value: unknown, optional = false): string | null {
  if ((value === "" || value == null) && optional) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) throw new Error("請填寫有效的購買日期");
  return value;
}
function text(value: unknown, max: number): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max) throw new Error("文字格式或長度不正確");
  return value.trim() || null;
}
function decimal(value: unknown, required: boolean, max: number, digits: number): number | null {
  if (value == null || value === "") { if (required) throw new Error("請填寫數量"); return null; }
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+(\.\d+)?$/.test(value))) throw new Error("金額或數量格式不正確");
  const n=Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max || (required && n === 0)) throw new Error("金額或數量超出範圍");
  if (Math.abs(n * 10**digits - Math.round(n * 10**digits)) > 0.0001) throw new Error(`最多可填小數點後 ${digits} 位`);
  return n;
}
export function normalizePurchase(input: Record<string, unknown>, allowUnknownDate = false) {
  const name=text(input.name,200); if (!name) throw new Error("請填寫品名");
  let url=text(input.url,2048);
  if(url) {
    try { const parsed=new URL(url); if(!["http:","https:"].includes(parsed.protocol)) throw new Error(); url=parsed.toString(); }
    catch { throw new Error("商品連結僅支援有效的 http 或 https 網址"); }
  }
  return { name,purchase_date:purchaseDate(input.purchase_date,allowUnknownDate),
    quantity:decimal(input.quantity ?? 1,true,999999999.999,3)!,
    total_amount:decimal(input.total_amount,false,999999999999.99,2),
    store:text(input.store,120),url,specification:text(input.specification,300),note:text(input.note,1000) };
}
export function uuid(value: unknown): string {
  if(typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error("識別碼不正確");
  return value;
}
export function filterPurchases(rows: Purchase[], query: string, from: string, to: string, store: string) {
  const term=query.trim().toLocaleLowerCase();
  return rows.filter(r=>(!from || (r.purchase_date && r.purchase_date>=from)) &&
    (!to || (r.purchase_date && r.purchase_date<=to)) && (!store || r.store===store) &&
    (!term || [r.name,r.specification,r.store,r.note].some(v=>v?.toLocaleLowerCase().includes(term))))
    .sort((a,b)=>(b.purchase_date || "").localeCompare(a.purchase_date || "") || b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
}
