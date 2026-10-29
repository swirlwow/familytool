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

export const BILL_FILTERS = [
  ["all", "全部"], ["unpaid", "待繳"], ["partial", "部分付款"],
  ["paid", "已繳"], ["no_payment_due", "本期免繳"],
  ["awaiting_details", "待補資料"], ["overdue", "逾期未繳"],
] as const;
export type BillFilter = typeof BILL_FILTERS[number][0];
export function matchesBillFilter(bill: BillDetails & { name_snapshot: string; note?: string | null; paid_total: number }, query: string, filter: BillFilter, today: string): boolean {
  const text = `${bill.name_snapshot}\n${bill.note || ""}`.normalize("NFKC").toLocaleLowerCase();
  if (!text.includes(query.trim().normalize("NFKC").toLocaleLowerCase())) return false;
  if (filter === "all") return true;
  if (filter === "paid") return bill.status === "paid";
  if (bill.status === "paid") return false;
  if (filter === "awaiting_details") return billNeedsDetails(bill);
  if (filter === "no_payment_due") return billNoPaymentDue(bill);
  if (billNeedsDetails(bill) || billNoPaymentDue(bill)) return false;
  const remains = Number(bill.amount_due) > Number(bill.paid_total);
  if (filter === "overdue") return remains && bill.due_date! < today;
  if (filter === "partial") return remains && bill.status === "partial";
  return remains;
}
