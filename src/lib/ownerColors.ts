// src/lib/ownerColors.ts
export type OwnerKey = "家庭" | "雅惠" | "昱元" | "子逸" | "英茵";

export const OWNER_LIST: OwnerKey[] = ["家庭", "雅惠", "昱元", "子逸", "英茵"];

export function normalizeOwner(v: any): OwnerKey {
  const s = String(v || "").trim();
  if (OWNER_LIST.includes(s as OwnerKey)) return s as OwnerKey;
  return "家庭";
}

/** Badge 用（小塊標籤） */
export function ownerBadgeClass(owner: any) {
  switch (normalizeOwner(owner)) {
    case "家庭":
      return "bg-slate-100 text-slate-700";
    case "雅惠":
      return "bg-rose-100 text-rose-700";
    case "昱元":
      return "bg-indigo-100 text-indigo-700";
    case "子逸":
      return "bg-emerald-100 text-emerald-700";
    case "英茵":
      return "bg-amber-100 text-amber-800";
  }
}

/** Pill 按鈕用（你那排可點按鈕） */
export function ownerPillClass(owner: any, active: boolean) {
  const base = "rounded-full font-bold border transition";
  const size = "px-4 py-2 text-sm";

  const inactive = "bg-white text-slate-700 border-slate-200 hover:bg-slate-50";

  if (!active) return [base, size, inactive].join(" ");

  switch (normalizeOwner(owner)) {
    case "家庭":
      return [base, size, "bg-slate-800 text-white border-slate-800 shadow-sm"].join(" ");
    case "雅惠":
      return [base, size, "bg-rose-600 text-white border-rose-600 shadow-sm"].join(" ");
    case "昱元":
      return [base, size, "bg-indigo-600 text-white border-indigo-600 shadow-sm"].join(" ");
    case "子逸":
      return [base, size, "bg-emerald-600 text-white border-emerald-600 shadow-sm"].join(" ");
    case "英茵":
      return [base, size, "bg-amber-500 text-white border-amber-500 shadow-sm"].join(" ");
  }
}
