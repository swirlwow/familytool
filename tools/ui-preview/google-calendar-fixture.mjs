// Isolated UI-only responses. Never calls Google or the application backend.
export function googleCalendarPreview(path, method) {
  if (!path.startsWith('/api/google-calendar/')) return null;
  const scenario = new URL(location.href).searchParams.get('google_preview') || 'connected';
  if (path.endsWith('/status') && method === 'GET') return Response.json({ connected: scenario !== 'unconnected', email: 'preview@example.invalid', lastSync: null });
  if (path.endsWith('/sync') && method === 'POST') {
    if (scenario === 'reauthorize') return Response.json({ code: 'GOOGLE_REAUTHORIZE', error: '模擬：Google 授權已失效，請重新連結原本帳號。' }, { status: 400 });
    if (scenario === 'failure') return Response.json({ code: 'SOURCE_CHANGED', error: '模擬：同步期間家庭行程有變動，請再次同步。' }, { status: 400 });
    return new Promise(resolve => setTimeout(() => resolve(Response.json({ created: 2, updated: 1, deleted: 1, unchanged: 4, lastSync: new Date().toISOString() })), 400));
  }
  return Response.json({ code: 'PREVIEW_ONLY', error: '這是隔離預覽，不會開啟真實 Google 授權或寫入行程。' }, { status: 400 });
}
