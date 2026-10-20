import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {AIError,parsePhoto,readAIRequest,compareWithGroq,validateReport,MAX_BODY} from '../groq.mjs';import {aiUsageStore} from '../ai-usage.mjs';
const photo='data:image/jpeg;base64,'+Buffer.from([255,216,255,224,0,1,2,3,4,5,6,7]).toString('base64');
const report={comparable:true,summary:'A cup may be missing.',limitations:['The counter is partly hidden.'],changes:[{label:'Cup',observation:'One fewer cup is visible.',action:'Check and replace the cup.',caution:'It may be hidden.',confidence:'medium'}]};
const body={reference:photo,current:photo,consent:true};
const req=(value=body,headers={})=>new Request('https://snapback.test/api/ai/compare',{method:'POST',headers:{origin:'https://snapback.test','content-type':'application/json',...headers},body:JSON.stringify(value)});
test('photo validation rejects URLs, mislabeled types and malformed base64',()=>{assert.equal(parsePhoto(photo).mimeType,'image/jpeg');for(const p of ['https://example.com/x.jpg',photo.replace('jpeg','png'),'data:image/jpeg;base64,AAAA',photo+'?',photo+'A'])assert.throws(()=>parsePhoto(p),AIError);});
test('comparison requires explicit consent and bounded JSON',async()=>{await assert.rejects(readAIRequest(req({...body,consent:false})),e=>e.code==='CONSENT_REQUIRED');await assert.rejects(readAIRequest(req(body,{'content-length':String(MAX_BODY+1)})),e=>e.status===413);await assert.rejects(readAIRequest(req(body,{'content-type':'text/plain'})),e=>e.status===415);assert.equal((await readAIRequest(req())).reference.mimeType,'image/jpeg');});
test('stream body cap works without content-length',async()=>{const large={...body,reference:'a'.repeat(MAX_BODY)};await assert.rejects(readAIRequest(req(large)),e=>e.status===413);});
test('Groq request uses only the fixed vision endpoint, two images and bounded JSON',async()=>{
 const env={GROQ_API_KEY:'fixture-only',GROQ_FREE_PLAN:'true'};
 const result=await compareWithGroq({env,photos:{reference:parsePhoto(photo),current:parsePhoto(photo)},fetcher:async(url,options)=>{
  assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');assert.equal(options.headers.Authorization,'Bearer '+env.GROQ_API_KEY);
  const sent=JSON.parse(options.body);assert.equal(sent.model,'qwen/qwen3.8-27b');assert.equal(sent.messages[1].content[1].image_url.url,photo);assert.equal(sent.messages[1].content[3].image_url.url,photo);assert.equal(sent.reasoning_effort,'none');assert.equal(sent.max_completion_tokens,2048);
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(report)}}]});
 }});assert.equal(result.provider,'Groq');assert.equal(result.changes[0].action,report.changes[0].action);
});
test('Groq is locked without credentials or the Free-plan setting',async()=>{for(const env of [{},{GROQ_API_KEY:'fixture-only',GROQ_FREE_PLAN:'false'}])await assert.rejects(compareWithGroq({env,photos:{},fetcher:()=>{throw Error('no call');}}),e=>e.code==='AI_NOT_CONFIGURED');});
test('invalid output is rejected and incomparable photos cannot yield checklist actions',()=>{assert.throws(()=>validateReport({...report,changes:[{action:'bad'}]}),AIError);assert.throws(()=>validateReport({...report,changes:Array(13).fill(report.changes[0])}),AIError);assert.deepEqual(validateReport({...report,comparable:false}).changes,[]);});
test('actual SQLite counters enforce member, minute, daily and shared monthly limits',async()=>{
 const db=new DatabaseSync(':memory:');try{
  db.exec(await readFile(new URL('../drizzle/0001_sweet_dreaming_celestial.sql',import.meta.url),'utf8'));
  const binding={prepare(sql){return {bind(...args){return {first:async()=>db.prepare(sql).get(...args)||null};}};}};
  const usage=aiUsageStore(binding),now=Date.UTC(2026,9,20);
  assert.equal(await usage.take('one',now),true);
  assert.equal(await usage.take('one',now+1000),false);
  assert.equal(await usage.take('other',now+2000),false);
  assert.equal(await usage.take('one',now+60000),true);
  for(let i=2;i<25;i++)assert.equal(await usage.take('one',now+i*60000),true);
  assert.equal(await usage.take('one',now+25*60000),false);
  assert.equal(await usage.take('one',now+86400000),true);
  db.prepare('UPDATE ai_usage SET requests=100 WHERE member=? AND period=?').run('one','2026-10');
  assert.equal(await usage.take('one',now+86460000),false);
  assert.equal(await usage.take('one',Date.UTC(2026,10,1)),true);
  db.prepare('UPDATE ai_usage SET requests=1000 WHERE member=? AND period=?').run('__all__','2026-10');
  assert.equal(await usage.take('new-member',now+172800000),false);
  assert.equal(db.prepare('SELECT requests FROM ai_usage WHERE member=? AND period=?').get('__all__','2026-10').requests,1000);
 }finally{db.close();}
});
