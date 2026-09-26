// Local-only UI verification. All app requests terminate in fixtures.mjs.
const { chromium } = require('C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const output = path.resolve('docs/ui-calendar-backup');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const results = [];
  try {
    for (const width of [1440, 834, 390, 360]) {
      const context = await browser.newContext({ viewport: { width, height: width === 834 ? 1194 : width === 390 ? 844 : width === 360 ? 740 : 1000 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await page.clock.install({ time: new Date('2026-09-26T10:00:00+08:00') });
      await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
      page.on('pageerror', error => errors.push(error.message));
      const shot = async name => {
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: path.join(output, `${width}-${name}.png`), fullPage: false, animations: 'disabled' });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width} ${name}: horizontal overflow`);
      };
      await page.goto('http://127.0.0.1:4287/calendar');
      await page.locator('.calendar-ui').waitFor();
      await page.waitForLoadState('networkidle');
      if (width < 640) await page.getByRole('button', { name: '月', exact: true }).click();
      await page.locator('.calendar-event-bar').first().waitFor();
      await shot('month');
      await page.getByRole('button', { name: '下個月', exact: true }).click();
      assert.match(await page.locator('.calendar-period').innerText(), /10/);
      await page.getByRole('button', { name: '上個月', exact: true }).click();
      await page.getByRole('button', { name: '週', exact: true }).click();
      await page.locator('.calendar-event-card').first().waitFor();
      await page.locator('.calendar-week').evaluate(el => { el.scrollTop = 0; });
      await shot('week');
      await page.locator('.calendar-add').click();
      await page.getByRole('dialog').waitFor();
      await shot('new');
      await page.getByRole('button', { name: '儲存', exact: true }).click();
      await page.getByText('標題不可空白', { exact: true }).waitFor();
      await shot('validation');
      await page.getByLabel('行程標題', { exact: true }).fill('隔離 UI 驗收行程');
      await page.getByLabel('開始日期', { exact: true }).fill('2026-09-26');
      await page.getByLabel('結束日期', { exact: true }).fill('2026-09-25');
      await page.getByRole('button', { name: '儲存', exact: true }).click();
      await page.getByText('結束日期不可早於開始日期', { exact: true }).waitFor();
      await page.getByLabel('結束日期', { exact: true }).fill('2026-09-26');
      await page.getByRole('button', { name: '爸媽', exact: true }).click();
      await page.getByRole('button', { name: '儲存', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: '關閉提示', exact: true }).click();
      await page.locator('.calendar-event-card').filter({ hasText: '隔離 UI 驗收行程' }).click();
      await shot('edit');
      await page.getByRole('button', { name: '刪除行程', exact: true }).click();
      await shot('delete');
      await page.getByRole('button', { name: '取消', exact: true }).click();
      await page.getByRole('button', { name: '刪除行程', exact: true }).click();
      await page.getByRole('button', { name: '確認刪除', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('.calendar-event-card').filter({ hasText: '隔離 UI 驗收行程' }).count(), 0);
      await page.getByRole('button', { name: '月', exact: true }).click();
      await page.getByRole('button', { name: /2026-09-26 尚有/ }).click();
      await page.getByRole('heading', { name: '其他行程', exact: true }).waitFor();
      await shot('overflow');
      await page.locator('.calendar-overflow').getByRole('button', { name: '關閉', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      if (width < 1024) {
        await page.getByRole('button', { name: '更多', exact: true }).click();
        await page.waitForFunction(() => {
          const panel = document.getElementById('family-navigation');
          return panel && getComputedStyle(panel).visibility === 'visible' && Math.abs(panel.getBoundingClientRect().left) < 1;
        });
        await shot('navigation');
        await page.locator('#family-navigation a').first().focus();
        await page.keyboard.press('Escape');
      }
      if (width === 1440) {
        await page.evaluate(() => { window.__fixtureFetch = window.fetch; window.fetch = async (...args) => { await new Promise(resolve => setTimeout(resolve, 1000)); return window.__fixtureFetch(...args); }; });
        await page.locator('.calendar-period button').last().click();
        await page.getByRole('status').filter({ hasText: '載入中…' }).waitFor();
        await shot('loading');
        await page.evaluate(() => { window.fetch = async () => { throw new Error('隔離失敗狀態'); }; });
        await page.locator('.calendar-period button').first().click();
        await page.getByText('行事曆暫時無法讀取', { exact: true }).waitFor();
        await shot('load-error');
        await page.locator('.calendar-add').click();
        await page.getByLabel('行程標題', { exact: true }).fill('失敗狀態驗收');
        await page.getByRole('button', { name: '儲存', exact: true }).click();
        await page.getByText('請稍後再試。', { exact: true }).waitFor();
        await shot('save-error');
        await page.evaluate(() => { window.fetch = async (...args) => { await new Promise(resolve => setTimeout(resolve, 1000)); return window.__fixtureFetch(...args); }; });
        await page.getByRole('button', { name: '儲存', exact: true }).click();
        await page.getByRole('button', { name: '儲存中', exact: true }).waitFor();
        await shot('saving');
        assert.equal(await page.getByRole('button', { name: '儲存中', exact: true }).isDisabled(), true);
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
      }
      await page.goto('http://127.0.0.1:4287/settings/backup');
      await page.locator('.backup-ui').waitFor();
      await shot('backup');
      await page.evaluate(() => { const original = window.fetch; window.fetch = async (...args) => { await new Promise(resolve => setTimeout(resolve, 700)); return original(...args); }; });
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: '下載備份', exact: true }).click();
      await page.getByRole('button', { name: '準備備份中…', exact: true }).waitFor();
      await shot('backup-busy');
      assert.equal(await page.getByRole('button', { name: '準備備份中…', exact: true }).isDisabled(), true);
      const file = await download;
      assert.match(file.suggestedFilename(), /^familytool_backup_.*\.json$/);
      await page.getByText('備份已準備完成', { exact: true }).waitFor();
      await shot('backup-success');
      await page.evaluate(() => { window.fetch = async () => new Response('{}', { status: 500, headers: { 'content-type': 'application/json' } }); });
      await page.getByRole('button', { name: '下載備份', exact: true }).click();
      await page.getByText('備份下載失敗', { exact: true }).waitFor();
      await shot('backup-error');
      results.push({ width, passed: true });
      await context.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ results, errors }, null, 2));
    console.log(JSON.stringify({ results, errors }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
