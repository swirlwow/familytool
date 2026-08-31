const date = new Date().toLocaleDateString('en-CA');
const long = '測試用超長名稱ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const payer = { id: 'payer-1', name: long, is_active: true };
const group = { id: 'group-1', name: long, type: 'expense', sort_order: 10, is_active: true };
const category = { id: 'category-1', name: long, group_name: long, type: 'expense', sort_order: 10, is_active: true };
const merchant = { id: 'merchant-1', name: long, is_active: true };
const sticky = { id: 'sticky-1', title: long, content: long.repeat(4), owner: '家庭', updated_at: new Date().toISOString() };
const ledger = { id: 'ledger-1', entry_date: date, type: 'expense', amount: 123456789.5, category_id: category.id, pay_method: long, merchant: long, consumption_content: long, note: long, payer_id: payer.id, created_at: new Date().toISOString(), ledger_splits: [], settlement_split_amount: 0, settlement_settled_amount: 0, settlement_status: 'none' };
const bill = { id: 'bill-1', name_snapshot: long, amount_due: 123456789.5, paid_total: 0, due_date: date, period_start: date, period_end: date, status: 'unpaid', payment_mode: 'ledger' };
const split = { split_id: 'split-1', entry_date: date, creditor_id: payer.id, debtor_id: 'payer-2', split_amount: 123456789.5, settled_amount: 0, remaining_amount: 123456789.5 };

export function installFixtures() {
  window.uiTestErrors = [];
  window.addEventListener('error', event => window.uiTestErrors.push(event.message));
  window.addEventListener('unhandledrejection', event => window.uiTestErrors.push(String(event.reason)));
  const empty = new URLSearchParams(location.search).has('empty');
  const rows = value => empty ? [] : value;
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) throw new Error('UI harness blocks non-fixture requests');
    const method = options.method ?? (input instanceof Request ? input.method : 'GET');
    // Never persist test operations; no API or database connection exists in this preview.
    if (method !== 'GET') return Response.json({ error: '隔離驗收模式：未寫入任何資料' }, { status: 409 });
    let data = [];
    switch (url.pathname) {
      case '/api/lookups': return Response.json({ data: { categories_expense: rows([category]), categories_income: [], payment_methods: rows([{ id: 'method-1', name: long }]), payers: rows([payer, { id: 'payer-2', name: '測試付款人乙' }]) } });
      case '/api/payers': data = rows([payer, { id: 'payer-2', name: '測試付款人乙', is_active: true }]); break;
      case '/api/category-groups': data = rows([group]); break;
      case '/api/categories': data = rows([category]); break;
      case '/api/payment-methods': data = rows([{ id: 'method-1', name: long, is_active: true, sort_order: 10 }]); break;
      case '/api/ledger/merchants': data = rows([merchant]); break;
      case '/api/ledger': data = rows([ledger]); break;
      case '/api/bills': data = rows([bill, { ...bill, id: 'bill-2', name_snapshot: '測試信用卡', payment_mode: 'status_only' }]); break;
      case '/api/stickies': data = rows([sticky]); break;
      case '/api/stickies/sticky-1': data = empty ? null : sticky; break;
      case '/api/notes': data = rows([{ id: 'note-1', title: long, content: long, owner: '家庭', date_from: date, date_to: date, is_all_day: true }]); break;
      case '/api/settlement': return Response.json({ net: [], recent_settlements: [], splits: rows([split]), settled_items: [], suggestions: [], totals: { split_amount: empty ? 0 : split.split_amount, remaining_amount: empty ? 0 : split.remaining_amount } });
    }
    return Response.json({ data });
  };
}
