const {chromium}=require('C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const ts=require('typescript');
const out='docs/ui-reports/final-acceptance';
fs.mkdirSync(out,{recursive:true});
const routes=['ledger','ledger/dashboard','settlement','bills','investments','calendar','shopping','stickies','settings/backup','settings/categories','settlement/history','settings/payment-methods','settings/merchants','settings/payers','stickies/note-0'];
// Compare business-bearing expressions against the pre-finalization commit.
const base='5c52539';
function expressions(source){
 source=source.replace(/\r\n/g,'\n');
 const file=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const result=[];
 function visit(n){
  if(ts.isCallExpression(n)&&/^(fetch|useState|useMemo|useCallback|useEffect)$/.test(n.expression.getText(file))) result.push(n.getText(file));
  if(ts.isJsxAttribute(n)&&/^on[A-Z]/.test(n.name.getText(file))) result.push(n.getText(file));
  ts.forEachChild(n,visit);
 }
 visit(file);return result;
}
for(const file of ['src/app/investments/page.tsx','src/app/ledger/page.tsx','src/components/AppShell.tsx']){
 assert.deepEqual(expressions(fs.readFileSync(file,'utf8')),expressions(cp.execFileSync('git',['show',base+':'+file],{encoding:'utf8'})),file+' state/hooks/events must stay unchanged');
}
const results={base,viewports:[],interactions:[],errors:[],blockedRequests:[],mutations:[]};
(async()=>{
 const browser=await chromium.launch();
 try{
  for(const width of [1440,834,390]){
   const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
   await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='127.0.0.1')return r.continue();results.blockedRequests.push(u.origin);return r.abort();});
   const page=await context.newPage();
   page.on('pageerror',e=>results.errors.push(e.message));
   const check=async(name)=>{
    await page.waitForTimeout(250);
    const fits=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
    assert.ok(fits,name+' overflow at '+width);
    const mutations=await page.evaluate(()=>(window.__previewRequests||[]).filter(r=>['POST','PUT','PATCH','DELETE'].includes(r.method)));
    results.mutations.push(...mutations);assert.equal(mutations.length,0,name+' must not mutate data');
    await page.screenshot({path:out+'/'+width+'-'+name.replaceAll('/','-')+'.png',animations:'disabled'});
   };
   for(const route of routes){
    await page.goto('http://127.0.0.1:4287/'+route);
    await page.locator('main').waitFor();await page.waitForTimeout(300);
    assert.ok((await page.locator('main').innerText()).length>10,route+' must render');
    await check(route);results.viewports.push({width,route,passed:true});
    if(route==='ledger') assert.equal(await page.locator('.ledger-records-panel .touch-pan-y').first().evaluate(e=>getComputedStyle(e).padding),'0px','swipe backing must not show at rest');
   }
   await page.goto('http://127.0.0.1:4287/shopping');
   await page.getByRole('button',{name:'購買紀錄',exact:true}).click();
   await page.getByText('測試桌燈',{exact:true}).waitFor();await check('shopping-purchases');
   await page.getByRole('button',{name:'待購清單',exact:true}).click();
   await page.getByRole('button',{name:'移除 測試保溫杯',exact:true}).click();
   await page.getByRole('alertdialog').waitFor();await check('shopping-confirm');
   await page.getByRole('button',{name:'取消',exact:true}).click();
   await page.getByRole('alertdialog').waitFor({state:'detached'});
   assert.equal(await page.getByRole('alertdialog').count(),0);
   await check('shopping-cancelled');
   results.interactions.push({width,name:'shopping tabs and delete cancellation',passed:true});
   await page.goto('http://127.0.0.1:4287/investments');
   for(const name of ['交易紀錄','股利紀錄','股權異動','基本資料','現有持股']){
    await page.getByRole('button',{name,exact:true}).click();await check('investments-'+name);
   }
   await page.getByRole('button',{name:'新增買進',exact:true}).click();
   await page.getByRole('button',{name:'取消',exact:true}).waitFor();await check('investments-editor');
   await page.getByRole('button',{name:'取消',exact:true}).click();
   results.interactions.push({width,name:'investment tabs and editor cancellation',passed:true});
   await page.goto('http://127.0.0.1:4287/calendar');
   await page.locator('button[aria-label="新增行程"]:visible').first().click();
   await page.locator('.calendar-editor').waitFor();await check('calendar-editor');
   await page.keyboard.press('Escape');
   await page.locator('.calendar-editor').waitFor({state:'detached'});
   assert.equal(await page.locator('.calendar-editor').count(),0);
   results.interactions.push({width,name:'calendar editor open and escape',passed:true});
   await context.close();console.log('PASS viewport '+width);
  }
  assert.deepEqual(results.errors,[]);assert.deepEqual(results.blockedRequests,[]);assert.deepEqual(results.mutations,[]);
  console.log('PASS: 45 page/viewport checks, 9 interaction groups, unchanged hooks/events, no writes');
 }finally{await browser.close();fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1});
