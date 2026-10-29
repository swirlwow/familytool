/** Empty/unknown is not the same thing as an explicitly entered zero. */
export function parseBillAmount(value: unknown): number | null {
  if ((typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && !value.trim())) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  return Number.isFinite(rounded) ? rounded : null;
}

export const BILL_NOTE_MAX_LENGTH = 2000;
export function validBillNote(value: unknown): boolean {
  return value == null || (typeof value === "string" && value.length <= BILL_NOTE_MAX_LENGTH);
}

type BillDetails = { amount_due: number | null; due_date: string | null; status: string };
export function billNeedsDetails(bill: BillDetails): boolean {
  return bill.status === "awaiting_details" || !bill.due_date || parseBillAmount(bill.amount_due) === null;
}
export function billNoPaymentDue(bill: BillDetails): boolean {
  return !billNeedsDetails(bill) && parseBillAmount(bill.amount_due) === 0;
}
