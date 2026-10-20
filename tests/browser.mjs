// Optional: npm install --no-save playwright && npx playwright install chromium
// Run with the app serving: node tests/browser.mjs
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM?{executablePath:process.env.PLAYWRIGHT_CHROMIUM}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1050},acceptDownloads:true});
const page=await context.newPage();
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=process.env.TEST_URL||'http://127.0.0.1:4173';
const errors=[];const outbound=[];const uploads=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{
 const url=new URL(request.url());
 if(['http:','https:'].includes(url.protocol)&&url.origin!==new URL(base).origin)outbound.push(request.url());
 if(['POST','PUT','PATCH'].includes(request.method()))uploads.push(request.url());
});
let checks=0;
async function check(name,fn){await fn();checks++;console.log(`PASS ${name}`);}
try{
 await page.goto(base);await page.locator('.setup-card').first().waitFor();
 await check('starter library and private photo assets',async()=>{assert.equal(await page.locator('.setup-card').count(),3);assert.equal(await page.locator('#comparison-empty').isVisible(),true);});
 await check('search and collection filters',async()=>{
  await page.locator('#search').fill('studio');assert.equal(await page.locator('.setup-card').count(),1);
  await page.locator('#search').fill('does-not-exist');assert.equal(await page.locator('.empty-state').count(),1);
  await page.locator('#search').fill('');await page.locator('[data-filter="Home"]').click();assert.equal(await page.locator('.setup-card').count(),1);
  await page.locator('[data-filter="All"]').click();
 });
 await check('library sorting and summary',async()=>{
  await page.locator('#sort-setups').selectOption('name');assert.match(await page.locator('.setup-card').first().textContent(),/A little room to focus/);
  assert.match(await page.locator('#library-summary').textContent(),/3 saved setups/);await page.locator('#sort-setups').selectOption('newest');
 });
 await check('create dialog rejects missing and invalid photos',async()=>{
  await page.locator('#new-setup').click();await page.locator('#setup-name').fill('Test studio reset');await page.locator('#save-setup').click();
  assert.match(await page.locator('#form-error').textContent(),/reference photo/);
  await page.locator('#setup-file').setInputFiles({name:'test.txt',mimeType:'text/plain',buffer:Buffer.from('not a photo')});
  assert.match(await page.locator('#form-error').textContent(),/JPG/);
  await page.locator('#setup-file').setInputFiles({name:'broken.jpg',mimeType:'image/jpeg',buffer:Buffer.from('not a jpeg')});
  await page.waitForFunction(()=>document.querySelector('#form-error').textContent.includes('cannot read'));
 });
 await check('upload and persist a new reference setup',async()=>{
  await page.locator('#setup-file').setInputFiles(path.join(root,'client/assets/workspace.jpg'));
  await page.waitForFunction(()=>!document.querySelector('#save-setup').disabled);
  await page.locator('#setup-location').fill('Upstairs');await page.locator('#save-setup').click();
  await page.locator('#setup-dialog').waitFor({state:'hidden'});
  assert.equal(await page.locator('.setup-card').count(),4);
  assert.equal(await page.locator('#detail-name').textContent(),'Test studio reset');
  assert.match(await page.locator('#reference-image').getAttribute('src'),/^data:image\/jpeg/);
 });
 await check('add, edit, complete and reset checklist',async()=>{
  await page.locator('#new-item').fill('Return the notebook');await page.locator('#add-item-form button').click();
  await page.locator('.checklist-row').waitFor();await page.locator('.checklist-row input[type=text]').fill('Return the blue notebook');
  await page.locator('.checklist-row input[type=text]').press('Enter');
  await page.locator('.checklist-row input[type=checkbox]').check();
  await page.waitForFunction(()=>document.querySelector('#checklist-count').textContent==='1 / 1');
  await page.locator('#reset-checklist').click();
  await page.waitForFunction(()=>document.querySelector('#checklist-count').textContent==='0 / 1');
 });
 await check('current upload and working slider',async()=>{
  await page.locator('#current-file').setInputFiles(path.join(root,'client/assets/coffee.jpg'));
  await page.locator('#comparison-empty').waitFor({state:'hidden'});
  await page.locator('#compare-slider').fill('28');
  assert.equal(await page.locator('#comparison').evaluate(el=>el.style.getPropertyValue('--position')),'28%');
  assert.equal(await page.locator('#comparison-status').textContent(),'Drag to compare');
 });
 await check('comparison modes and expanded view preserve the working controls',async()=>{
  await page.locator('[data-mode=split]').click();assert.equal(await page.locator('#comparison').getAttribute('data-mode'),'split');
  assert.equal(await page.locator('#compare-slider').isVisible(),false);
  await page.locator('[data-mode=reference]').click();assert.equal(await page.locator('#current-image').isVisible(),false);
  await page.locator('[data-mode=current]').click();assert.equal(await page.locator('#reference-image').isVisible(),false);
  await page.locator('#expand-comparison').click();assert.equal(await page.locator('#compare-dialog').isVisible(),true);
  await page.locator('[data-mode=slider]').click();await page.locator('#compare-slider').fill('66');
  assert.equal(await page.locator('#comparison').evaluate(el=>el.style.getPropertyValue('--position')),'66%');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#compare-dialog').isVisible(),false);
  await page.locator('.compare-column > .compare-panel').waitFor({state:'attached'});
  assert.equal(await page.locator('.compare-column > .compare-panel').count(),1);
 });
 await check('photos and edited checklist survive reload',async()=>{
  await page.reload();await page.locator('.setup-card').first().waitFor();
  assert.equal(await page.locator('#detail-name').textContent(),'Test studio reset');
  assert.equal(await page.locator('#comparison-empty').isVisible(),false);
  assert.equal(await page.locator('.checklist-row input[type=text]').inputValue(),'Return the blue notebook');
 });
 await check('AI requires a verified subscription and fails closed while Klarna setup is pending',async()=>{
  await page.locator('#ai-button').click();await page.waitForFunction(()=>document.querySelector('#billing-status').textContent.includes('pending'));
  assert.equal(await page.locator('#ai-run').isDisabled(),true);assert.equal(await page.locator('#subscribe-button').isDisabled(),true);
  assert.match(await page.locator('#subscription-panel').textContent(),/£4.99/);
  await page.locator('#ai-dialog [data-close]').click();
 });
 await check('edit setup and checklist overview',async()=>{
  await page.locator('#edit-setup').click();await page.locator('#setup-name').fill('Test studio updated');await page.locator('#save-setup').click();
  await page.locator('#setup-dialog').waitFor({state:'hidden'});await page.locator('[data-view="checklists"]').click();
  assert.equal(await page.locator('.summary-card').count(),4);
  await page.locator('.summary-card').filter({hasText:'Test studio updated'}).click();
  assert.equal(await page.locator('#detail-name').textContent(),'Test studio updated');
  await page.locator('[data-view="library"]').click();
 });
 await check('backup export and additive import',async()=>{
  await page.locator('#backup-button').click();const downloading=page.waitForEvent('download');await page.locator('#export-backup').click();
  const download=await downloading;const backupPath=await download.path();
  await page.locator('#backup-file').setInputFiles(backupPath);await page.locator('#info-dialog').waitFor({state:'hidden'});
  assert.equal(await page.locator('.setup-card').count(),8);
 });
 await check('desktop and mobile layouts do not overflow',async()=>{
  for(const width of [1440,768,390,320]){
   await page.setViewportSize({width,height:1000});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,`overflow at ${width}px`);
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('#mobile-backup-button').click();assert.equal(await page.locator('#export-backup').isVisible(),true);
  await page.locator('#info-dialog [data-close]').click();
  await page.screenshot({path:process.env.SCREENSHOT_MOBILE||path.join(root,'../snapback-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1050});
  await page.screenshot({path:process.env.SCREENSHOT_DESKTOP||path.join(root,'../snapback-desktop.png'),fullPage:true});
 });
 await check('remove current, replace reference, remove a checklist step',async()=>{
  await page.locator('#remove-current').click();await page.locator('#comparison-empty').waitFor();
  await page.locator('#reference-file').setInputFiles(path.join(root,'client/assets/living.jpg'));
  await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Saved on this device');
  await page.locator('.remove-item').click();await page.waitForFunction(()=>document.querySelector('#checklist-count').textContent==='0 / 0');
 });
 await check('editable starter checklist',async()=>{
  assert.equal(await page.locator('#checklist-starter').isVisible(),true);await page.locator('#use-starter').click();
  await page.waitForFunction(()=>document.querySelectorAll('.checklist-row').length===4);
  assert.equal(await page.locator('.checklist-row input[type=text]').first().inputValue(),'Clear the work surface');
  assert.equal(await page.locator('#checklist-starter').isVisible(),false);
 });
 await check('duplicate is an independent reusable setup with reset checks and no current photo',async()=>{
  await page.locator('#current-file').setInputFiles(path.join(root,'client/assets/coffee.jpg'));await page.locator('#comparison-empty').waitFor({state:'hidden'});
  await page.locator('.checklist-row input[type=checkbox]').first().check();await page.waitForFunction(()=>document.querySelector('#checklist-count').textContent==='1 / 4');
  const original=await page.locator('.setup-card.selected').getAttribute('data-setup');
  await page.locator('#duplicate-setup').click();await page.waitForFunction(()=>document.querySelector('#detail-name').textContent.endsWith('(copy)'));
  assert.equal(await page.locator('.setup-card').count(),9);assert.equal(await page.locator('#checklist-count').textContent(),'0 / 4');
  assert.equal(await page.locator('#comparison-empty').isVisible(),true);
  await page.locator('.checklist-row input[type=text]').first().fill('A different step');await page.locator('.checklist-row input[type=text]').first().press('Enter');
  await page.locator(`[data-setup="${original}"]`).click();assert.equal(await page.locator('.checklist-row input[type=text]').first().inputValue(),'Clear the work surface');
 });
 await check('delete all records; empty library persists without reseeding',async()=>{
  while(await page.locator('.setup-card').count()){
   await page.locator('#delete-setup').click();await page.locator('#confirm-delete').click();await page.locator('#confirm-dialog').waitFor({state:'hidden'});
  }
  await page.reload();await page.locator('#setup-grid .empty-state').waitFor();assert.equal(await page.locator('.setup-card').count(),0);
 });
 assert.deepEqual(errors,[],'No browser runtime errors');assert.deepEqual(outbound,[],'No external requests');assert.deepEqual(uploads,[],'No photo uploads');
 console.log(`PASS ${checks} browser scenarios; no runtime errors or outbound requests`);
}finally{await browser.close();}
