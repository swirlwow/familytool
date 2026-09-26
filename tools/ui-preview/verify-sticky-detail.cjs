const { chromium } = require('C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const file = 'src/app/stickies/[id]/page.tsx';
const normalize = s => s.replace(/\r\n/g,'\n').replace('import "../sticky-detail-ui.css";\n','').replace('app-page sticky-detail-ui','app-page');
assert.equal(normalize(fs.readFileSync(file,'utf8')), normalize(execFileSync('git',['show','HEAD:'+file],{encoding:'utf8'})));
fs.mkdirSync('docs/ui-sticky-detail',{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  for(const width of [1440,834,390,360]){
   const context=await browser.newContext({viewport:{width,height:1000}});
   await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:4287/stickies/note-0');
   await page.getByPlaceholder('項目內容').first().waitFor();
   assert.equal(await page.getByPlaceholder('項目內容').count(),2);
   assert.equal(await page.getByPlaceholder('清單標題（例如：待辦 / 行李清單 / 重要備忘）').inputValue(),'測試便條 1');
   const shot=async name=>{
    await page.screenshot({path:'docs/ui-sticky-detail/'+width+'-'+name+'.png',animations:'disabled'});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   };
   await shot('edit');
   await page.getByRole('group',{name:'便條紙操作'}).getByRole('button',{name:'刪除',exact:true}).click();
   await page.getByRole('alertdialog').waitFor();
   await shot('delete');
   await page.getByRole('button',{name:'取消',exact:true}).click();
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('PASS: four widths, original logic unchanged, detail and confirmation screenshots');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
