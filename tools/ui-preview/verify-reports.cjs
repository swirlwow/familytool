const { chromium } = require('C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const out = 'docs/ui-reports';
fs.mkdirSync(out, { recursive: true });
const normalized = s => s.replace(/\r\n/g, '\n').replace(/^import ["'].*reports-ui.css["'];\n/m, '').replace(/ reports-ui (investments|dashboard)-ui/g, '').replace(/dashboard-(presets|filters) /g, '');
for (const path of ['src/app/investments/page.tsx', 'src/app/ledger/dashboard/page.tsx']) {
  assert.equal(normalized(fs.readFileSync(path, 'utf8')), normalized(execFileSync('git', ['show', 'HEAD:' + path], { encoding: 'utf8' })), 'Only imports and presentation classes may change: ' + path);
}
(async () => {
 const browser = await chromium.launch({ headless: true });
 const results = [];
 try {
  for (const width of [1440, 1024, 834, 390, 360]) {
   const context = await browser.newContext({ viewport: { width, height: 1000 } });
   await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
   const page = await context.newPage();
   await page.clock.install({ time: new Date('2026-09-26T10:00:00+08:00') });
   const errors = [];
   page.on('pageerror', err => errors.push(err.message));
   const capture = async name => {
    await page.screenshot({ path: out + '/' + width + '-' + name + '.png', animations: 'disabled' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal page overflow: ' + width + ' ' + name);
   };
   await page.goto('http://127.0.0.1:4287/investments');
   await page.getByRole('tab', { name: '永豐-大美女' }).waitFor();
   await capture('holdings');
   if (width >= 1024) {
    const tops = await page.locator('[class*="investmentActions"] > button').evaluateAll(nodes => nodes.map(n => Math.round(n.getBoundingClientRect().top)));
    assert.equal(new Set(tops).size, 1, 'Desktop actions must stay on one row');
   }
   for (const [tab, name] of [['交易紀錄','transactions'], ['股利紀錄','dividends'], ['股權異動','actions'], ['基本資料','settings']]) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    if (name === 'actions') await page.getByRole('tab', { name: '永豐-大帥哥' }).click();
    await capture(name);
   }
   for (const [label, name] of [['新增買進','buy'], ['新增賣出','sell'], ['新增股利','dividend'], ['新增減資','reduction'], ['帳戶','account'], ['股票','security']]) {
    await page.getByRole('button', { name: label, exact: true }).first().click();
    await page.getByRole('button', { name: '關閉', exact: true }).waitFor();
    await capture('modal-' + name);
    await page.getByRole('button', { name: '關閉', exact: true }).click();
   }
   await page.goto('http://127.0.0.1:4287/ledger/dashboard');
   await page.getByText('總支出', { exact: true }).waitFor();
   await capture('dashboard');
   if (width < 768) await page.getByRole('button', { name: '篩選條件' }).click();
   await page.getByPlaceholder('店家/消費內容/備註/分類/付款人…').fill('不存在的測試');
   await capture('dashboard-empty');
   assert.deepEqual(errors, []);
   assert.ok(await page.evaluate(() => window.__previewRequests.every(r => r.method === 'GET')));
   results.push({ width, screenshots: 13, runtimeErrors: 0, noOverflow: true });
   await context.close();
  }
  fs.writeFileSync(out + '/results.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
 } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
