// No backend fallback: all app fetch calls terminate in this in-memory store.
const make = (names, prefix) => names.map((name, i) => ({ id: `${prefix}-${i}`, name, is_active: true, sort_order: (i + 1) * 10, type: 'expense' }));
const stores = {
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
