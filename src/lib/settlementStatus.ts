export type SettlementStatus =
  | "not_applicable"
  | "unsettled"
  | "partial"
  | "settled"
  | "overallocated";

const EPSILON = 0.005;

export function settlementStatus(
  splitAmount: number,
  settledAmount: number
): SettlementStatus {
  const split = Number(splitAmount) || 0;
  const settled = Number(settledAmount) || 0;

  if (split <= EPSILON) return "not_applicable";
  if (settled <= EPSILON) return "unsettled";
  if (settled > split + EPSILON) return "overallocated";
  if (settled >= split - EPSILON) return "settled";
  return "partial";
}

export function settlementStatusLabel(status: SettlementStatus) {
  switch (status) {
    case "settled":
      return "已結清";
    case "partial":
      return "部分結清";
    case "overallocated":
      return "分配異常";
    case "unsettled":
      return "未結清";
    default:
      return "不適用";
  }
}
