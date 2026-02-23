// src/services/settlement/utils.ts
import { round2 } from "@/lib/settlementCalc";

export function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function clampInt(v: any, def = 20, min = 1, max = 200) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export function pad2(x: number) {
  return String(x).padStart(2, "0");
}

export function fmtDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function r2(v: any) {
  return round2(toNum(v));
}
