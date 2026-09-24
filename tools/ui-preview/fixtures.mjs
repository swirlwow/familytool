// No backend fallback: all app fetch calls terminate in this in-memory store.
const make = (names, prefix) => names.map((name, i) => ({ id: `${prefix}-${i}`, name, is_active: true, sort_order: (i + 1) * 10, type: 'expense' }));
const stores = {
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
  const rows = stores[url.pathname];
  if (url.origin !== location.origin || !rows) throw new Error('隔離預覽已阻擋非測試請求');
  if (method === 'GET') return Response.json({ data: rows.filter(row => !url.searchParams.has('type') || row.type === url.searchParams.get('type')) });
  const body = JSON.parse(options.body || '{}');
  let row;
  if (method === 'POST') { row = { ...body, id: crypto.randomUUID(), is_active: true }; rows.push(row); }
  else if (method === 'PATCH') { row = rows.find(item => item.id === body.id); if (row) Object.assign(row, body); }
  else if (method === 'DELETE') { const index = rows.findIndex(item => item.id === (body.id || url.searchParams.get('id'))); if (index >= 0) rows.splice(index, 1); }
  else throw new Error('Unsupported preview method');
  return Response.json({ data: row || null, ok: true });
};
