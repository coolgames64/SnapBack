import test from 'node:test';
import assert from 'node:assert/strict';
import {seedSetups,filterSetups,sortSetups,starterChecklist,progress,escapeHTML,safeImage,validateBackup} from '../client/core.js';
const backup=()=>({format:'snapback',version:1,setups:seedSetups(1234)});
test('sorting returns independent lists in the chosen order',()=>{
  const setups=seedSetups(1234),original=setups.map(s=>s.id);
  assert.equal(sortSetups(setups,'name')[0].name,'A little room to focus');
  assert.equal(sortSetups(setups,'newest')[0].id,'sample-coffee');
  setups[2].updatedAt=9999;assert.equal(sortSetups(setups,'updated')[0].id,'sample-home');
  assert.deepEqual(setups.map(s=>s.id),original);
});
test('starter checklists are collection-specific and never share mutable arrays',()=>{
  for(const category of ['Work','Home','Hospitality'])assert.equal(starterChecklist(category).length,4);
  const first=starterChecklist('Work');first.push('extra');assert.equal(starterChecklist('Work').length,4);
  assert.match(starterChecklist('Hospitality')[2],/Restock/);
});
test('search matches names and locations, respects category',()=>{
  const setups=seedSetups();
  assert.equal(filterSetups(setups,'All','COFFEE').length,1);
  assert.equal(filterSetups(setups,'Work','studio').length,1);
  assert.equal(filterSetups(setups,'Home','coffee corner').length,0);
  assert.equal(filterSetups(setups,'All','nothing matches').length,0);
});
test('checklist progress handles empty and completed lists',()=>{
  assert.deepEqual(progress([]),{done:0,total:0,percent:0});
  assert.deepEqual(progress([{done:true},{done:false}]),{done:1,total:2,percent:50});
});
test('escape user input in rendered templates',()=>{
  assert.equal(escapeHTML('<script>"&\''),'&lt;script&gt;&quot;&amp;&#39;');
});
test('backup round trip preserves both photos and checklist',()=>{
  const data=backup();data.setups[0].current='data:image/jpeg;base64,YWJj';data.setups[0].items[0].done=true;
  const restored=validateBackup(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(restored,data.setups);
});
test('reject active images, remote tracking URLs, and path traversal',()=>{
  for(const source of ['javascript:alert(1)','data:image/svg+xml;base64,YWJj','https://example.com/track.jpg','../../.env'])assert.equal(safeImage(source),false);
});
test('reject malformed or duplicate setup and checklist records atomically',()=>{
  for(const mutate of [
    d=>{d.version=2;},d=>{d.setups[0].reference='https://evil.test/pixel';},
    d=>{d.setups[0].name='';},d=>{d.setups.push(d.setups[0]);},
    d=>{d.setups[0].items[0].done='yes';},d=>{d.setups[0].items.push(d.setups[0].items[0]);},
    d=>{d.setups[0].name='x'.repeat(71);},d=>{d.setups[0].createdAt=NaN;}
  ]){const data=backup();mutate(data);assert.throws(()=>validateBackup(data));}
});
test('empty backup is valid and unknown fields are discarded',()=>{
  assert.deepEqual(validateBackup({format:'snapback',version:1,setups:[]}),[]);
  const data=backup();data.setups[0].unexpected='ignored';
  assert.equal('unexpected' in validateBackup(data)[0],false);
});
