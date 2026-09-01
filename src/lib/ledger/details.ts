export function normalizeMerchantName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function validConsumptionContent(value: unknown): boolean {
  return value == null || (typeof value === "string" && value.length <= 1000);
}

export type LedgerMerchant = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
};
