const {chromium}=require('C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const out='docs/ui-reports/home-acceptance';
fs.mkdirSync(out,{recursive:true});
const old=cp.execFileSync('git',['show','HEAD:src/app/page.tsx'],{encoding:'utf8'});
const current=fs.readFileSync('src/app/page.tsx','utf8');
const destinations=s=>[...s.matchAll(/href: "([^"]+)"/g)].map(x=>x[1]).sort();
assert.deepEqual(destinations(current),destinations(old));
(async()=>{
 const browser=await chromium.launch();
 const results={viewports:[],links:[],errors:[],externalRequests:[],mutations:[]};
 try {
  for(const width of [1487,834,390]) {
   const context=await browser.newContext({viewport:{width,height:1058},reducedMotion:'reduce'});
   await context.route('**/*',route=>{if(new URL(route.request().url()).hostname==='127.0.0.1')return route.continue();results.externalRequests.push(route.request().url());return route.abort();});
   const page=await context.newPage();page.on('pageerror',e=>results.errors.push(e.message));
   await page.goto('http://127.0.0.1:4287/');await page.locator('.home-tool').first().waitFor();
   await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(400);
   assert.equal(await page.locator('.home-tool').count(),11);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);
   assert.ok(await page.locator('.home-hero-art').evaluate(e=>e.complete&&e.naturalWidth>0),'hero loaded');
   await page.screenshot({path:`${out}/${width}.png`,fullPage:true});
   results.viewports.push({width,passed:true});
   if(width===1487) {
    for(const href of destinations(current).filter(x=>!x.startsWith('http'))) {
     await page.locator(`.home-tool[href="${href}"]`).click();await page.waitForURL('**'+href);
     await page.locator('main').waitFor();assert.ok((await page.locator('main').innerText()).length>10);
     results.mutations.push(...await page.evaluate(()=>(window.__previewRequests||[]).filter(r=>['POST','PUT','PATCH','DELETE'].includes(r.method))));
     results.links.push(href);await page.goto('http://127.0.0.1:4287/');
    }
    assert.equal(await page.locator('.home-tool[target="_blank"]').getAttribute('href'),'https://shift-leave-manager.vercel.app/');
   }
   await context.close();
  }
  assert.deepEqual(results.errors,[]);assert.deepEqual(results.externalRequests,[]);assert.deepEqual(results.mutations,[]);
  fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
