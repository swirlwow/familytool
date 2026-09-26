// No backend fallback: all app fetch calls terminate in this in-memory store.
import { BACKUP_TABLES, makeBackup } from '../../src/lib/backup-format';
import { investmentPreview } from './investment-fixture.mjs';
const make = (names, prefix) => names.map((name, i) => ({ id: `${prefix}-${i}`, name, is_active: true, sort_order: (i + 1) * 10, type: 'expense' }));
const stores = {
  '/api/notes': [
    ['family-trip', '家庭|爸媽', '家庭旅行', '2026-09-24', '2026-09-26'],
    ['family-meal', '家庭', '家庭聚餐', '2026-09-20', '2026-09-20'],
    ['parents', '爸媽', '爸媽回診', '2026-09-22', '2026-09-22'],
    ['library', '子逸', '圖書館', '2026-09-25', '2026-09-25'],
    ['checkup', '雅惠', '健檢', '2026-09-26', '2026-09-26'],
    ['art', '英茵', '繪畫課', '2026-09-26', '2026-09-26'],
    ['sports', '昱元', '運動', '2026-09-26', '2026-09-26'],
    ['dinner', '家庭', '晚餐', '2026-09-26', '2026-09-26'],
  ].map(([id, owner, title, date_from, date_to]) => ({ id, owner, title, date_from, date_to, note_date: date_from, content: '隔離預覽資料，重新整理即重置。', updated_at: '2026-09-26T08:00:00Z' })),
  '/api/ledger': [{ id: 'ledger-preview', entry_date: '2026-09-26', type: 'expense', amount: 150, category_id: 'category-0', payer_id: 'payer-0', pay_method: '現金', merchant: '測試早餐店', consumption_content: '隔離資料早餐', note: '僅供預覽', ledger_splits: [] }],
  '/api/shopping': [{ id: 'shopping-preview', name: '測試保溫杯', status: 'planned', priority: 'normal', requested_by: '測試使用者', purchase_for: '自己', planned_date: '2026-09-30', note: '保留兩個比價來源', created_at: '2026-09-26T08:00:00Z', sources: [{ id: 'source-1', platform: '測試商店甲', url: 'https://example.invalid/a', price: 600, note: '容量 500ml', sort_order: 0 }, { id: 'source-2', platform: '測試商店乙', url: 'https://example.invalid/b', price: 580, note: '運費另計', sort_order: 1 }] }],
  '/api/purchases': [{ id: 'purchase-preview', name: '測試桌燈', purchase_date: '2026-09-20', quantity: 1, total_amount: 800, store: '測試商店甲', url: 'https://example.invalid/lamp', specification: '暖白光', note: '隔離預覽', wishlist_snapshot: { requested_by: '測試使用者', purchase_for: '家庭', priority: 'normal', planned_date: '2026-09-20', note: '原待購備註', sources: [{ platform: '測試商店甲', url: 'https://example.invalid/a', price: 800, note: '來源甲', sort_order: 0 }, { platform: '測試商店乙', url: 'https://example.invalid/b', price: 850, note: '來源乙', sort_order: 1 }] } }],
  '/api/bills': [{ id: 'bill-preview', period: '2026-09', due_date: '2026-09-30', name_snapshot: '測試水費', amount_due: 600, paid_total: 0, status: 'unpaid', source: 'manual', payment_mode: 'ledger' }],
  '/api/settlement/history': [{ id: 'history-preview', debtor_id: 'payer-0', creditor_id: 'payer-1', amount: 300, from_date: '2026-09-01', to_date: '2026-09-26', created_at: '2026-09-26T08:00:00Z' }],
  '/api/stickies': ['家庭','雅惠','昱元','子逸','英茵'].map((owner, i) => ({ id: 'note-' + i, owner, title: '測試便條 ' + (i + 1), content: '隔離預覽範例，並非正式資料。\n可以測試編輯、搜尋與篩選。', updated_at: '2026-09-26T08:00:00Z' })),
  '/api/category-groups': make(['測試家庭','飲食','日用品','交通'], 'group'),
  '/api/categories': make(['早餐','午餐','晚餐','飲品','其他','交通費'], 'category').map(row => ({ ...row, group_name: '測試家庭' })),
  '/api/payment-methods': make(['現金','測試信用卡','測試銀行帳戶','手機付款'], 'payment'),
  '/api/ledger/merchants': make(['測試早餐店','測試超市','測試網路商店','測試交通公司'], 'merchant'),
  '/api/payers': make(['大帥哥','大美女'], 'payer'),
};
window.__previewRequests = [];
window.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
  const method = options.method || 'GET';
  window.__previewRequests.push({ path: url.pathname, method });
  if (url.origin === location.origin && method === 'GET' && url.pathname === '/api/investments') return Response.json({ data: investmentPreview });
  if (url.origin === location.origin && method === 'GET' && url.pathname === '/api/export') {
    const tables = Object.fromEntries(BACKUP_TABLES.family.map(name => [name, []]));
    tables.notes = stores['/api/notes'];
    return Response.json(await makeBackup('family', 'ui-preview-only', tables));
  }
  if (url.origin === location.origin && method === 'GET' && url.pathname === '/api/lookups') return Response.json({ data: {
    historical_categories_expense: stores['/api/categories'], historical_categories_income: [],
    historical_payment_methods: stores['/api/payment-methods'], categories_expense: stores['/api/categories'],
    categories_income: [], payment_methods: stores['/api/payment-methods'], payers: stores['/api/payers']
  } });
  if (url.origin === location.origin && method === 'GET' && url.pathname === '/api/settlement') return Response.json({
    net: [{ payer_id: 'payer-0', amount: -300 }, { payer_id: 'payer-1', amount: 300 }],
    recent_settlements: [], settled_items: [],
    suggestions: [{ debtor_id: 'payer-0', creditor_id: 'payer-1', amount: 300 }],
    pre_settlement_suggestions: [],
    splits: [{ split_id: 'split-preview', entry_id: 'entry-preview', entry_date: '2026-09-26', creditor_id: 'payer-1', debtor_id: 'payer-0', split_amount: 300, settled_amount: 0, remaining_amount: 300 }],
    totals: { split_amount: 300, pre_settlement_amount: 0, settled_amount: 0, remaining_amount: 300 }
  });
  if (url.origin === location.origin && method === 'GET' && url.pathname === '/api/settlement/reconciliation') return Response.json({ rows: [] });
  const noteBase = url.pathname.startsWith('/api/notes/') ? '/api/notes' : '/api/stickies';
  const noteId = url.pathname.startsWith(noteBase + '/') ? decodeURIComponent(url.pathname.slice(noteBase.length + 1)) : null;
  const rows = stores[noteId ? noteBase : url.pathname];
  if (url.origin !== location.origin || !rows) throw new Error('隔離預覽已阻擋非測試請求');
  if (method === 'GET') return Response.json({ data: rows.filter(row =>
    (!url.searchParams.has('type') || row.type === url.searchParams.get('type')) &&
    (!url.searchParams.has('owner') || row.owner === url.searchParams.get('owner')) &&
    (!url.searchParams.has('q') || (row.title + ' ' + row.content).includes(url.searchParams.get('q')))
  ) });
  const body = JSON.parse(options.body || '{}');
  if (url.pathname.startsWith('/api/notes') && Array.isArray(body.owner)) body.owner = body.owner.join('|');
  let row;
  if (method === 'POST') { row = { ...body, id: crypto.randomUUID(), is_active: true, updated_at: new Date().toISOString() }; rows.push(row); }
  else if (method === 'PATCH') { row = rows.find(item => item.id === (noteId || body.id)); if (row) Object.assign(row, body); }
  else if (method === 'DELETE') { const index = rows.findIndex(item => item.id === (noteId || body.id || url.searchParams.get('id'))); if (index >= 0) rows.splice(index, 1); }
  else throw new Error('Unsupported preview method');
  return Response.json({ data: row || null, ok: true });
};
