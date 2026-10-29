// Isolated test-only state, enabled explicitly by ?bills_preview=zero.
const bills = [
  { id: 'bill-zero-test', period: '2026-11', due_date: '2026-11-09', name_snapshot: '測試信用卡－本期溢繳', amount_due: null, paid_total: 0, status: 'awaiting_details', source: 'template', payment_mode: 'status_only', note: null },
  { id: 'bill-positive-test', period: '2026-11', due_date: '2026-11-10', name_snapshot: '測試水費', amount_due: 600, paid_total: 0, status: 'unpaid', source: 'manual', payment_mode: 'ledger', note: '原有備註保留' },
  { id: 'bill-paid-test', period: '2026-11', due_date: '2026-11-08', name_snapshot: '測試已繳帳單', amount_due: 500, paid_total: 500, status: 'paid', paid_at: '2026-11-08T08:00:00.000Z', billing_start: '2026-11-01', billing_end: '2026-11-30', source: 'template', payment_mode: 'status_only', note: '已繳費，不更動金額' },
];
export function billsPreview(url, method, body) {
  if (new URLSearchParams(location.search).get('bills_preview') !== 'zero' || url.pathname !== '/api/bills') return null;
  if (method === 'GET') return Response.json({ data: bills });
  if (method === 'PATCH') {
    const data = JSON.parse(body || '{}');
    const bill = bills.find(row => row.id === data.id);
    if (!bill) return Response.json({ error: '找不到測試帳單' }, { status: 404 });
    Object.assign(bill, data);
    if (bill.status === 'awaiting_details' && bill.amount_due != null && bill.amount_due >= 0 && bill.due_date) bill.status = 'unpaid';
    return Response.json({ success: true });
  }
  return Response.json({ error: '此隔離案例只允許測試帳單資料編輯' }, { status: 400 });
}
