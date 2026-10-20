// Tests use fake camera frames and mocked free-AI responses, never real charges.
import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM?{executablePath:process.env.PLAYWRIGHT_CHROMIUM}:{}),args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const base=process.env.TEST_URL||'http://127.0.0.1:4173';
const context=await browser.newContext({permissions:['camera'],viewport:{width:390,height:844}}),page=await context.newPage();
const errors=[],external=[],uploads=[];page.on('pageerror',e=>errors.push(e.message));
page.on('console',message=>{if(message.type()==='error')console.log('Browser diagnostic:',message.text());});
context.on('request',r=>{const url=new URL(r.url());if(['http:','https:'].includes(url.protocol)&&url.origin!==new URL(base).origin)external.push(r.url());if(['POST','PUT'].includes(r.method()))uploads.push(r.url());});
try{
 await page.goto(base);await page.locator('.setup-card').first().waitFor();
 await page.locator('#new-setup').click();await page.locator('#setup-name').fill('Camera test');await page.locator('#take-photo').click();
 await page.waitForFunction(()=>!document.querySelector('#camera-capture').disabled);
 assert.equal(await page.locator('#camera-video').evaluate(v=>v.srcObject.getVideoTracks()[0].readyState),'live');
 await page.locator('#camera-capture').click();assert.equal(await page.locator('#camera-video').evaluate(v=>v.srcObject),null);
 assert.match(await page.locator('#camera-preview').getAttribute('src'),/^data:image\/jpeg/);
 await page.locator('#camera-retake').click();await page.waitForFunction(()=>!document.querySelector('#camera-capture').disabled);
 await page.locator('#camera-switch').click();await page.waitForFunction(()=>!document.querySelector('#camera-capture').disabled);
 await page.locator('#camera-capture').click();await page.locator('#camera-use').click();await page.locator('#camera-dialog').waitFor({state:'hidden'});
 await page.locator('#save-setup').click();await page.locator('#setup-dialog').waitFor({state:'hidden'});
 assert.equal(await page.locator('#detail-name').textContent(),'Camera test');console.log('PASS built-in camera capture, retake, switch, save and stream cleanup');
 await page.locator('#upload-current').click();await page.locator('#picker-camera').click();await page.waitForFunction(()=>!document.querySelector('#camera-capture').disabled);
 assert.equal(await page.locator('#camera-guide-control').isVisible(),true);await page.locator('#camera-guide-toggle').uncheck();assert.equal(await page.locator('#camera-guide').isVisible(),false);
 const track=await page.evaluateHandle(()=>document.querySelector('#camera-video').srcObject.getVideoTracks()[0]);await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.querySelector('#camera-video').srcObject===null);assert.equal(await track.evaluate(t=>t.readyState),'ended');console.log('PASS reference overlay and camera stops on cancel');
 await page.locator('#ai-button').click();await page.waitForFunction(()=>document.querySelector('#service-status').textContent.includes('local preview'));
 await page.evaluate(()=>localStorage.setItem('snapback_plus','true'));await page.locator('#refresh-ai-status').click();assert.equal(await page.locator('#ai-run').isDisabled(),true);await page.locator('#ai-dialog [data-close]').click();
 console.log('PASS browser flag cannot bypass hosted sign-in');
 await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('denied','NotAllowedError');};});
 await page.reload();await page.locator('.setup-card').first().waitFor();await page.locator('#upload-current').click();await page.locator('#picker-camera').click();
 await page.waitForFunction(()=>document.querySelector('#camera-status').textContent.includes('denied'));assert.equal(await page.locator('#camera-upload').isVisible(),true);await page.locator('#camera-dialog [data-close]').click();
 console.log('PASS camera denial provides a working upload fallback');
 // Isolated test-only replies simulate a signed-in free user and Groq report; no live AI call.
 await page.route('**/api/ai/status',r=>r.fulfill({json:{configured:true,signedIn:true,authAvailable:true,free:true}}));
 await page.route('**/api/ai/compare',async r=>{
  const body=r.request().postDataJSON();assert.equal(body.consent,true);assert.match(body.reference,/^data:image\/jpeg;base64,/);
  await r.fulfill({json:{provider:'Groq',comparable:true,summary:'Test fixture: a cup may be missing.',limitations:['Check the photo yourself.'],changes:[{label:'Cup',observation:'Test fixture: one fewer cup is visible.',action:'Check and replace the cup.',caution:'It may be hidden.',confidence:'medium'}]}});
 });
 await page.locator('#reference-file').setInputFiles('client/assets/workspace.jpg');await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Saved on this device');
 await page.locator('#current-file').setInputFiles('client/assets/living.jpg');await page.locator('#comparison-empty').waitFor({state:'hidden'});
 await page.locator('#ai-button').click();await page.locator('#ai-run').waitFor();assert.equal(await page.locator('#ai-run').isDisabled(),true);await page.locator('#ai-consent').check();await page.waitForFunction(()=>!document.querySelector('#ai-run').disabled);await page.locator('#ai-run').click();
 await page.waitForFunction(()=>/Comparison complete|could not|too long/.test(document.querySelector('#ai-status').textContent),null,{timeout:120000});
 assert.match(await page.locator('#ai-status').textContent(),/Comparison complete/);
 assert.match(await page.locator('#ai-status').textContent(),/Groq/);
 assert.equal(await page.locator('#ai-consent').isChecked(),false);
 assert.equal(await page.locator('.ai-counts').count(),1);
 if(await page.locator('[data-ai-suggestion]').count()){
  await page.locator('[data-ai-suggestion]').first().click();await page.waitForFunction(()=>document.querySelector('[data-ai-suggestion]').textContent.includes('Added'));
 }
 await page.screenshot({path:'../../work/snapback-ai-test.png',fullPage:true});
 console.log('PASS consent, mocked Groq report and checklist suggestion (no live Groq call)');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.equal(uploads.length,1);assert(uploads[0].endsWith('/api/ai/compare'));console.log('PASS only explicit comparison POST, no external browser requests or runtime errors');
}finally{await browser.close();}
