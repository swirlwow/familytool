// No backend fallback: all app fetch calls terminate in this in-memory store.
const make = (names, prefix) => names.map((name, i) => ({ id: `${prefix}-${i}`, name, is_active: true, sort_order: (i + 1) * 10, type: 'expense' }));
const stores = {
  '/api/bills': [{ id: 'bill-preview', period: '2026-09', due_date: '2026-09-30', name_snapshot: '測試水費', amount_due: 600, paid_total: 0, status: 'unpaid', source: 'manual', payment_mode: 'ledger' }],
  '/api/settlement/history': [{ id: 'history-preview', debtor_id: 'payer-0', creditor_id: 'payer-1', amount: 300, from_date: '2026-09-01', to_date: '2026-09-26', created_at: '2026-09-26T08:00:00Z' }],
  '/api/stickies': ['家庭','雅惠','昱元','子逸','英茵'].map((owner, i) => ({ id: 'note-' + i, owner, title: '測試便條 ' + (i + 1), content: '隔離預覽範例，並非正式資料。\n可以測試編輯、搜尋與篩選。', updated_at: '2026-09-26T08:00:00Z' })),
  '/api/category-groups': make(['測試家庭','飲食','日用品','交通'], 'group'),
  '/api/categories': make(['早餐','午餐','晚餐','飲品','其他','交通費'], 'category').map(row => ({ ...row, group_name: '測試家庭' })),
  '/api/payment-methods': make(['現金','測試信用卡','測試銀行帳戶','手機付款'], 'payment'),
  '/api/ledger/merchants': make(['測試早餐店','測試超市','測試網路商店','測試交通公司'], 'merchant'),
  '/api/payers': make(['測試付款人甲','測試付款人乙'], 'payer'),
};
window.__previewRequests = [];
window.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
  const method = options.method || 'GET';
  window.__previewRequests.push({ path: url.pathname, method });
  if (url.origin === location.origin && method === 'GET' && url.pathname === '/api/settlement') return Response.json({
    net: [{ payer_id: 'payer-0', amount: -300 }, { payer_id: 'payer-1', amount: 300 }],
    recent_settlements: [], settled_items: [],
    suggestions: [{ debtor_id: 'payer-0', creditor_id: 'payer-1', amount: 300 }],
    pre_settlement_suggestions: [],
    splits: [{ split_id: 'split-preview', entry_id: 'entry-preview', entry_date: '2026-09-26', creditor_id: 'payer-1', debtor_id: 'payer-0', split_amount: 300, settled_amount: 0, remaining_amount: 300 }],
    totals: { split_amount: 300, pre_settlement_amount: 0, settled_amount: 0, remaining_amount: 300 }
  });
  if (url.origin === location.origin && method === 'GET' && url.pathname === '/api/settlement/reconciliation') return Response.json({ rows: [] });
  const noteId = url.pathname.startsWith('/api/stickies/') ? decodeURIComponent(url.pathname.slice('/api/stickies/'.length)) : null;
  const rows = stores[noteId ? '/api/stickies' : url.pathname];
  if (url.origin !== location.origin || !rows) throw new Error('隔離預覽已阻擋非測試請求');
  if (method === 'GET') return Response.json({ data: rows.filter(row =>
    (!url.searchParams.has('type') || row.type === url.searchParams.get('type')) &&
    (!url.searchParams.has('owner') || row.owner === url.searchParams.get('owner')) &&
    (!url.searchParams.has('q') || (row.title + ' ' + row.content).includes(url.searchParams.get('q')))
  ) });
  const body = JSON.parse(options.body || '{}');
  let row;
  if (method === 'POST') { row = { ...body, id: crypto.randomUUID(), is_active: true, updated_at: new Date().toISOString() }; rows.push(row); }
  else if (method === 'PATCH') { row = rows.find(item => item.id === (noteId || body.id)); if (row) Object.assign(row, body); }
  else if (method === 'DELETE') { const index = rows.findIndex(item => item.id === (noteId || body.id || url.searchParams.get('id'))); if (index >= 0) rows.splice(index, 1); }
  else throw new Error('Unsupported preview method');
  return Response.json({ data: row || null, ok: true });
};
