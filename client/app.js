import {createCamera} from './camera.js';
import {analysePhotos} from './ai.js';
import {createWelcomeTour} from './welcome-tour.js';
import {uid, escapeHTML as esc, progress, filterSetups, sortSetups, starterChecklist, validateBackup, openDatabase, loadLibrary, transaction, imageFromFile, MAX_BACKUP_BYTES} from './core.js';

const $ = selector => document.querySelector(selector);
const icons = {
  copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  expand:'<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  checklist:'<path d="m3 6 2 2 3-4M11 6h10M3 13l2 2 3-4M11 13h10M3 20l2 2 3-4M11 20h10"/>',
  camera:'<path d="M8 5 9.5 3h5L16 5h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><circle cx="12" cy="12" r="4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  download:'<path d="M12 3v13m-5-5 5 5 5-5M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  edit:'<path d="m16 3 5 5M3 21l5-1 13-13a2 2 0 0 0-5-5L3 15Z"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  compare:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 2v20m-5-7-3-3 3-3m10 0 3 3-3 3"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 8.5a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 2.5M12 17h.01"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>'
};
function icon(name) { return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.image}</svg>`; }
function hydrateIcons(root=document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
let db, setups=[], selectedId=null, filter='All', query='', view='library', editingId=null, draftReference=null, queue=Promise.resolve(), toastTimer, photoBusy=false;
let sortOrder='newest', comparisonMode='slider', draftGeneration=0;
const camera=createCamera($('#camera-dialog'));
const welcomeTour=createWelcomeTour({dialog:$('#welcome-tour-dialog'),onCreateSetup:()=>openSetup()});
const active = () => setups.find(s => s.id === selectedId);
function toast(message, error=false) {
  const el=$('#toast'); el.textContent=message; el.hidden=false; el.classList.toggle('error',error);
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>{el.hidden=true;},error?6500:3500);
}
function report(error) {
  const message = error?.name === 'QuotaExceededError' ? 'Device storage is full. Export a backup, then remove photos you no longer need.' : error?.message || 'That could not be saved. Please try again.';
  $('#save-status').textContent='Not saved — please try again'; toast(message,true);
}
function commit(task) {
  const next = queue.then(async()=>{
    if (!db) throw new Error('Local storage is unavailable. Allow browser storage and reload SnapBack.');
    $('#save-status').textContent='Saving…';
    await task();
    $('#save-status').textContent='Saved on this device';
  });
  queue=next.catch(()=>{});
  return next;
}
function updateSetup(id, change, render=true) {
  return commit(async()=>{
    const original=setups.find(s=>s.id===id);
    if(!original) throw new Error('This setup is no longer available.');
    const copy=structuredClone(original); change(copy); copy.updatedAt=Date.now();
    await transaction(db,['setups'],'readwrite',tx=>tx.objectStore('setups').put(copy));
    setups=setups.map(s=>s.id===id?copy:s);
    if(render) renderAll(); else {renderCards();renderSummaries();renderProgress();}
  });
}
function openInfo(title, html) {
  $('#info-title').textContent=title; $('#info-content').innerHTML=html; hydrateIcons($('#info-dialog'));
  $('#info-dialog').showModal();
}
function renderCards() {
  const filtered=sortSetups(filterSetups(setups,filter,query),sortOrder);
  const ready=setups.filter(s=>s.current).length;
  $('#library-summary').textContent=`${setups.length} saved ${setups.length===1?'setup':'setups'} · ${ready} ready to compare${filter!=='All'||query?` · ${filtered.length} shown`:''}`;
  $('#nav-count').textContent=setups.length; $('#all-count').textContent=setups.length;
  $('#setup-grid').innerHTML=filtered.length?filtered.map(s=>`<button class="setup-card ${s.id===selectedId?'selected':''}" data-setup="${esc(s.id)}" aria-pressed="${s.id===selectedId}"><div class="card-image"><img src="${esc(s.reference)}" alt="${esc(s.name)} reference" loading="lazy"><span class="card-badge">${esc(s.category.toUpperCase())}</span>${s.id===selectedId?'<span class="card-selected" aria-hidden="true">✓</span>':''}</div><div class="card-content"><div class="card-topline"><h3>${esc(s.name)}</h3><span class="card-arrow" aria-hidden="true">↗</span></div><p>${esc(s.location || 'Your personal space')}${s.isDemo?' · Example setup':''}</p><div class="card-meta"><span>${icon('image')} ${s.current?'2 photos':'1 reference'}</span><span><i class="status-dot"></i>${s.current?'Ready to compare':'Reference saved'}</span></div></div></button>`).join(''):`<div class="empty-state"><span>${icon('image')}</span><h3>${setups.length?'A little space to search again.':'Your first setup starts here.'}</h3><p>${setups.length?'Try a different name or collection.':'Save a reference photo and make your next reset easier.'}</p><button class="button primary" id="empty-new">Create a setup</button></div>`;
  $('#setup-grid').querySelectorAll('[data-setup]').forEach(el=>el.onclick=()=>selectSetup(el.dataset.setup,matchMedia('(max-width:700px)').matches));
  if($('#empty-new')) $('#empty-new').onclick=()=>openSetup();
}
function selectSetup(id, scroll=false) {
  if(selectedId!==id)comparisonMode='slider';
  selectedId=id;renderAll();
  if(scroll) $('#detail').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderProgress() {
  const s=active(); if(!s) return;
  const p=progress(s.items);
  $('#checklist-count').textContent=`${p.done} / ${p.total}`;
  $('#checklist-progress').style.width=`${p.percent}%`;
  $('#checklist-status').textContent=p.total && p.done===p.total?'All set. Back to just right.':'Saved on this device';
}
function renderChecklist() {
  const s=active(); if(!s) return;
  $('#checklist-starter').hidden=s.items.length>0;
  $('#checklist-items').innerHTML=s.items.length?s.items.map(item=>`<div class="checklist-row ${item.done?'done':''}" data-item="${esc(item.id)}"><input type="checkbox" ${item.done?'checked':''} aria-label="Mark ${esc(item.text)} complete"><input type="text" value="${esc(item.text)}" maxlength="180" aria-label="Checklist item text"><button class="remove-item" aria-label="Remove ${esc(item.text)}">×</button></div>`).join(''):'<p class="checklist-intro" style="padding-top:18px">A blank slate. Add your first reset step below.</p>';
  $('#checklist-items').querySelectorAll('[data-item]').forEach(row=>{
    const id=row.dataset.item, setupId=s.id;
    row.querySelector('[type=checkbox]').onchange=async event=>{
      const checked=event.target.checked;
      row.classList.toggle('done',checked);
      try { await updateSetup(setupId,copy=>{const item=copy.items.find(i=>i.id===id);if(item)item.done=checked;},false); }
      catch(error) { report(error);renderChecklist(); }
    };
    row.querySelector('[type=text]').onchange=async event=>{
      const text=event.target.value.trim();
      if(!text){event.target.value=active()?.items.find(i=>i.id===id)?.text||'';toast('Give this checklist step a name.',true);return;}
      try {await updateSetup(setupId,copy=>{const item=copy.items.find(i=>i.id===id);if(item)item.text=text;},false);}
      catch(error){report(error);renderChecklist();}
    };
    row.querySelector('[type=text]').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();event.target.blur();}};
    row.querySelector('.remove-item').onclick=()=>updateSetup(setupId,copy=>{copy.items=copy.items.filter(i=>i.id!==id);}).catch(report);
  });
  renderProgress();
}
function renderSummaries() {
  $('#all-checklists').innerHTML=setups.length?setups.map(s=>{
    const p=progress(s.items);
    return `<button class="summary-card" data-summary="${esc(s.id)}"><span class="subtle-tag">${esc(s.category)}</span><h3>${esc(s.name)}</h3><p>${p.done} of ${p.total} steps complete</p><ul>${s.items.slice(0,3).map(i=>`<li>${esc(i.text)}</li>`).join('')}</ul><span class="text-button">Open checklist ↗</span></button>`;
  }).join(''):'<div class="empty-state"><h3>No checklists yet.</h3><p>Create a setup to start your first checklist.</p></div>';
  $('#all-checklists').querySelectorAll('[data-summary]').forEach(el=>el.onclick=()=>selectSetup(el.dataset.summary,true));
}
function renderDetail() {
  const s=active();$('#detail').hidden=!s;if(!s)return;
  $('#detail-name').textContent=s.name;
  $('#detail-description').textContent=(s.isDemo?'Example setup · ':'')+(s.description||s.location||'A reference for your next reset.');
  $('#reference-image').src=s.reference;$('#current-image').src=s.current||s.reference;
  $('#reference-image').alt=`Reference for ${s.name}`;$('#current-image').alt=s.current?`Current photo of ${s.name}`:'';
  const has=!!s.current;
  $('#comparison').classList.toggle('has-current',has);
  $('#remove-current').hidden=!has;
  $('#upload-current-label').textContent=has?'Replace current':'Add current';
  $('#comparison-status').textContent=has?'Drag to compare':'Reference saved';
  $('#compare-hint').innerHTML=icon('info')+(has?'Slide to compare · left: reference · right: current':'Match the original angle for the clearest comparison.');
  $('#compare-slider').value=50;$('#comparison').style.setProperty('--position','50%');
  renderComparisonMode();
  renderChecklist();
}
function renderComparisonMode() {
  const has=!!active()?.current;
  const mode=has?comparisonMode:(comparisonMode==='reference'?'reference':'slider');
  if(!has && comparisonMode!=='reference')comparisonMode='slider';
  $('#comparison').dataset.mode=mode;
  $('#comparison-empty').hidden=has || mode==='reference';
  $('#compare-slider').hidden=!has || mode!=='slider';
  $('#slider-line').hidden=!has || mode!=='slider';
  $('.reference-label').hidden=mode==='current';$('.current-label').hidden=!has || mode==='reference';
  $('#reference-image').hidden=mode==='current';$('#current-image').hidden=mode==='reference';
  document.querySelectorAll('[data-mode]').forEach(button=>{
    button.disabled=!has && !['reference','slider'].includes(button.dataset.mode);
    const selected=button.dataset.mode===mode;
    button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
  });
  const hints={slider:'Drag to compare',split:'Two views, one reset',reference:'Your saved reference',current:'Your current photo'};
  $('#comparison-status').textContent=has?hints[mode]:'Reference saved';
  $('#compare-hint').innerHTML=icon('info')+(mode==='split'?'Reference on the left · current on the right':mode==='reference'?'Your baseline. Use it to guide your next reset.':mode==='current'?'Your latest photo. Compare it with the saved reference.':has?'Slide to compare · left: reference · right: current':'Match the original angle for the clearest comparison.');
}
function renderAll() {renderCards();renderDetail();renderSummaries();}
function setView(next) {
  view=next;$('#library-view').hidden=view!=='library';$('#checklists-view').hidden=view!=='checklists';
  $('#page-crumb').textContent=view==='library'?'Setup library':'My checklists';
  document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
}
function openSetup(setup=null) {
  draftGeneration++;
  editingId=setup?.id||null;draftReference=setup?.reference||null;
  $('#setup-form').reset();$('#form-error').textContent='';
  $('#setup-dialog-title').textContent=setup?'Edit your setup':'Save a new setup';
  $('#setup-name').value=setup?.name||'';$('#setup-category').value=setup?.category||'Work';
  $('#setup-location').value=setup?.location||'';$('#setup-description').value=setup?.description||'';
  $('#save-setup').disabled=false;photoBusy=false;renderDraft();$('#setup-dialog').showModal();
}
function renderDraft() {
  $('#new-preview').hidden=!draftReference;
  if(draftReference)$('#new-preview').src=draftReference;else $('#new-preview').removeAttribute('src');
  $('#drop-copy').hidden=!!draftReference;
}
async function readDraft(file) {
  if(!file)return;
  const generation=++draftGeneration;
  photoBusy=true;$('#save-setup').disabled=true;$('#form-error').textContent='Preparing your photo…';
  try {const reference=await imageFromFile(file);if(generation===draftGeneration){draftReference=reference;if(!editingId&&!$('#setup-name').value.trim())$('#setup-name').value=file.name.replace(/\.[^.]+$/,'').replace(/[-_]+/g,' ').slice(0,70);renderDraft();$('#form-error').textContent='';}}
  catch(error){if(generation===draftGeneration)$('#form-error').textContent=error.message;}
  finally{if(generation===draftGeneration){photoBusy=false;$('#save-setup').disabled=false;}}
}
async function saveNewSetup(event) {
  event.preventDefault();if(photoBusy)return;
  const name=$('#setup-name').value.trim();
  if(!name){$('#form-error').textContent='Give your setup a name.';$('#setup-name').focus();return;}
  if(!draftReference){$('#form-error').textContent='Add a reference photo to save this setup.';return;}
  const id=editingId,reference=draftReference;
  const fields={name,category:$('#setup-category').value,location:$('#setup-location').value.trim(),description:$('#setup-description').value.trim()};
  $('#save-setup').disabled=true;
  try {
    if(id) await updateSetup(id,s=>{const changed=s.reference!==reference;Object.assign(s,fields,{reference});if(changed){s.current=null;s.isDemo=false;}});
    else {
      const now=Date.now();const setup={id:uid(),...fields,reference,current:null,items:[],createdAt:now,updatedAt:now,isDemo:false};
      await commit(async()=>{
        await transaction(db,['setups'],'readwrite',tx=>tx.objectStore('setups').put(setup));
        setups.unshift(setup);selectedId=setup.id;filter='All';query='';$('#search').value='';
        document.querySelectorAll('[data-filter]').forEach(el=>el.classList.toggle('active',el.dataset.filter==='All'));
      });
    }
    $('#setup-dialog').close();setView('library');renderAll();toast(id?'Setup updated':'Your setup is saved. Ready for its first reset.');
    $('#detail').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){$('#form-error').textContent=error.message;report(error);}
  finally{$('#save-setup').disabled=false;}
}
async function replacePhoto(file, kind) {
  const s=active();if(!s||!file)return;
  const id=s.id;
  toast('Preparing your photo…');
  try {
    const image=await imageFromFile(file);
    await updateSetup(id,copy=>{
      copy[kind]=image;
      if(kind==='reference'){copy.current=null;copy.isDemo=false;}
    });
    toast(kind==='current'?'Current photo saved. Drag the slider to compare.':'New reference saved. Add a new current photo to compare.');
  }catch(error){report(error);}
}
let aiSnapshot=null,aiBusy=false,aiReady=false;
function updateAIButton(){ $('#ai-run').disabled=!aiReady||!aiSnapshot?.current||aiBusy||!$('#ai-consent').checked; }
async function refreshAIStatus(){
  aiReady=false;updateAIButton();$('#service-status').textContent='Checking free AI availability…';$('#ai-sign-in').hidden=true;
  try{
    const response=await fetch('/api/ai/status',{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('AI availability could not be checked. Please try again.');
    const status=await response.json();
    aiReady=!!status.configured&&!!status.signedIn;
    $('#ai-sign-in').hidden=!status.authAvailable||!!status.signedIn;
    $('#service-status').textContent=!status.authAvailable?'Email accounts are being set up. Free AI will be available after account setup.':!status.configured?'Groq is temporarily unavailable. Your library and manual comparison are ready to use.':!status.signedIn?'Sign in to use free AI. No subscription or payment details needed.':'Free AI is ready. Review your photos and agree to share them below.';
    updateAIButton();
  }catch(error){aiReady=false;updateAIButton();$('#service-status').textContent=error.message;}
}
function showAI(){
  const s=active();if(!s)return;aiSnapshot={id:s.id,reference:s.reference,current:s.current};
  $('#ai-reference').src=s.reference;$('#ai-current').hidden=!s.current;
  $('#ai-current-empty').hidden=!!s.current;
  $('#ai-add-current-label').textContent=s.current?'Replace current photo':'Add current photo';
  if(s.current)$('#ai-current').src=s.current;else $('#ai-current').removeAttribute('src');
  $('#ai-consent').checked=false;aiReady=false;updateAIButton();
  $('#ai-results').innerHTML='';$('#ai-status').textContent=s.current?'Review the two photos, then agree to share them for this comparison.':'Add a current photo to this setup first.';
  $('#ai-dialog').showModal();refreshAIStatus();
}
async function startAI(){
  if(!aiSnapshot?.current||aiBusy||!$('#ai-consent').checked)return;const snapshot={...aiSnapshot};aiBusy=true;$('#ai-run').disabled=true;$('#ai-results').innerHTML='';
  try{
    const result=await analysePhotos(snapshot.reference,snapshot.current,text=>{$('#ai-status').textContent=text;},$('#ai-consent').checked);
    const original=setups.find(s=>s.id===snapshot.id);
    if(!original||original.reference!==snapshot.reference||original.current!==snapshot.current)throw new Error('The photos changed. Close this window and start a new comparison.');
    $('#ai-status').textContent='Comparison complete · Groq';
    $('#ai-results').innerHTML=`<h3>${!result.comparable?'Try a clearer comparison':result.changes.length?'Possible changes to review':'No clear differences found'}</h3><p class="muted">${esc(result.summary)}</p>`+
      result.changes.map((change,i)=>`<article class="ai-finding"><span class="subtle-tag">${esc(change.label)} · ${esc(change.confidence)} confidence</span><h4>${esc(change.observation)}</h4><p>${esc(change.caution)}</p><p><strong>Suggested reset:</strong> ${esc(change.action)}</p><button class="button small" data-ai-suggestion="${i}">Add review step to checklist</button></article>`).join('')+
      (result.limitations.length?`<details class="ai-counts"><summary>What Groq could not verify</summary><ul>${result.limitations.map(text=>`<li>${esc(text)}</li>`).join('')}</ul></details>`:'');
    $('#ai-results').querySelectorAll('[data-ai-suggestion]').forEach(button=>button.onclick=async()=>{
      button.disabled=true;
      try{
        await updateSetup(snapshot.id,copy=>{if(copy.reference!==snapshot.reference||copy.current!==snapshot.current)throw new Error('The photos changed. Run a new comparison.');if(copy.items.length>=100)throw new Error('This checklist already has 100 steps.');copy.items.push({id:uid(),text:result.changes[Number(button.dataset.aiSuggestion)].action,done:false});});
        button.textContent='Added to checklist ✓';
      }catch(error){button.disabled=false;toast(error.message,true);}
    });
  }catch(error){$('#ai-status').textContent=error.message;}
  finally{aiBusy=false;$('#ai-consent').checked=false;refreshAIStatus();}
}
async function openCamera(kind){
  const targetId=active()?.id,editingGeneration=draftGeneration;
  const result=await camera.open({title:kind==='draft'?'Capture your reference':kind==='current'?'Capture the current setup':'Capture a new reference',reference:kind==='current'?active()?.reference:null});
  if(!result)return;
  if(result.upload){$(kind==='draft'?'#setup-file':`#${kind}-file`).click();return;}
  if(kind==='draft'){
    if(editingGeneration!==draftGeneration)return;
    draftReference=result.photo;renderDraft();$('#form-error').textContent='';
  }else{
    try{await updateSetup(targetId,copy=>{copy[kind]=result.photo;if(kind==='reference'){copy.current=null;copy.isDemo=false;}});toast('Camera photo saved on this device');}catch(error){report(error);}
  }
}
async function showBackup() {
  const bytes=new Blob([JSON.stringify(setups)]).size;
  openInfo('Your space. Your data.',`<p>${setups.length} setups · approximately ${(bytes/1024/1024).toFixed(1)} MB stored for this library.</p><div class="info-callout">Photos and checklists are stored in this browser using IndexedDB. They do not sync between devices. Clearing browser data removes them. Download a backup to keep a copy.</div><button class="button primary" id="export-backup">${icon('download')}Export library</button><button class="button" id="import-backup">${icon('upload')}Import backup</button><input id="backup-file" type="file" accept="application/json,.json" hidden><p>Import adds setups as new copies. Existing setups are preserved. Backups contain your photos, so keep them somewhere private.</p><button class="text-button" id="persistent-storage">Request persistent browser storage</button><p id="storage-status" role="status"></p><h3>Example library</h3><p>The three starter setups are editable examples. Their checklists are illustrative, not AI findings.</p><button class="button" id="remove-examples">Remove example setups</button>`);
  $('#export-backup').onclick=async()=>{
    await queue;
    const data={format:'snapback',version:1,exportedAt:new Date().toISOString(),setups};
    download(`snapback-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(data,null,2),'application/json');
    toast('Backup downloaded');
  };
  $('#import-backup').onclick=()=>$('#backup-file').click();
  $('#backup-file').onchange=async event=>{
    const file=event.target.files[0];if(!file)return;
    try{
      if(file.size>MAX_BACKUP_BYTES)throw new Error('Please choose a backup under 80 MB.');
      const records=validateBackup(JSON.parse(await file.text()));
      const copies=records.map(s=>({...s,id:uid(),items:s.items.map(i=>({...i,id:uid()})),updatedAt:Date.now()}));
      await commit(async()=>{
        await transaction(db,['setups'],'readwrite',tx=>copies.forEach(s=>tx.objectStore('setups').put(s)));
        setups.unshift(...copies);if(copies.length)selectedId=copies[0].id;
      });
      renderAll();$('#info-dialog').close();toast(`${copies.length} setups imported as new copies.`);
    }catch(error){report(error instanceof SyntaxError?new Error('That file is not valid JSON. Choose a SnapBack backup.'):error);}
    finally{event.target.value='';}
  };
  $('#persistent-storage').onclick=async()=>{
    try{const granted=await navigator.storage?.persist?.();$('#storage-status').textContent=granted?'Persistent storage granted. Keep a backup as well.':'The browser did not grant persistent storage. Export backups regularly.';}
    catch{$('#storage-status').textContent='Persistent storage is unavailable. You can still export a backup.';}
  };
  $('#remove-examples').onclick=async()=>{
    try{
      const examples=setups.filter(s=>s.isDemo);
      await commit(async()=>{
        await transaction(db,['setups'],'readwrite',tx=>examples.forEach(s=>tx.objectStore('setups').delete(s.id)));
        setups=setups.filter(s=>!s.isDemo);if(!active())selectedId=setups[0]?.id||null;
      });
      renderAll();$('#info-dialog').close();toast(`${examples.length} example setups removed`);
    }catch(error){report(error);}
  };
}
function download(name, contents, type) {
  const url=URL.createObjectURL(new Blob([contents],{type}));
  const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function wireEvents() {
  $('#restart-tour').onclick=welcomeTour.open;$('#welcome-tour').onclick=welcomeTour.open;
  document.querySelectorAll('[data-close]').forEach(el=>el.onclick=()=>el.closest('dialog').close());
  document.querySelectorAll('[data-view]').forEach(el=>el.onclick=()=>setView(el.dataset.view));
  $('.brand').onclick=event=>{event.preventDefault();setView('library');window.scrollTo({top:0,behavior:'smooth'});};
  document.querySelectorAll('[data-filter]').forEach(el=>el.onclick=()=>{
    filter=el.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b===el));renderCards();
  });
  $('#search').oninput=event=>{query=event.target.value;renderCards();};
  $('#sort-setups').onchange=event=>{sortOrder=event.target.value;renderCards();};
  document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{comparisonMode=button.dataset.mode;renderComparisonMode();});
  const comparisonPanel=$('.compare-panel');
  const comparisonAnchor=document.createComment('Comparison panel position');comparisonPanel.before(comparisonAnchor);
  $('#expand-comparison').onclick=()=>{
    $('#compare-dialog-title').textContent=active()?.name||'A closer look';
    $('#expanded-comparison').append(comparisonPanel);$('#expand-comparison').hidden=true;$('#compare-dialog').showModal();
  };
  $('#compare-dialog').addEventListener('close',()=>{comparisonAnchor.after(comparisonPanel);$('#expand-comparison').hidden=false;$('#expand-comparison').focus();});
  $('#setup-dialog').addEventListener('close',()=>{draftGeneration++;});
  $('#use-starter').onclick=()=>{
    const s=active();if(!s)return;
    updateSetup(s.id,copy=>{if(!copy.items.length)copy.items=starterChecklist(copy.category).map(text=>({id:uid(),text,done:false}));}).then(()=>toast('Starter steps added. Edit them to fit your space.')).catch(report);
  };
  $('#duplicate-setup').onclick=async()=>{
    const s=active();if(!s)return;
    const now=Date.now(),copy={...structuredClone(s),id:uid(),name:`${s.name.slice(0,63)} (copy)`,current:null,isDemo:false,createdAt:now,updatedAt:now,
      items:s.items.map(item=>({...item,id:uid(),done:false}))};
    try{
      await commit(async()=>{
        await transaction(db,['setups'],'readwrite',tx=>tx.objectStore('setups').put(copy));setups.unshift(copy);selectedId=copy.id;
      });
      filter='All';query='';$('#search').value='';document.querySelectorAll('[data-filter]').forEach(el=>el.classList.toggle('active',el.dataset.filter==='All'));
      setView('library');renderAll();toast('Setup copied. Rename it or add a new reference.');
    }catch(error){report(error);}
  };
  $('#upload-setup').onclick=()=>{openSetup();$('#setup-file').click();};
  const libraryDrop=$('#library-drop');
  ['dragenter','dragover'].forEach(type=>libraryDrop.addEventListener(type,event=>{event.preventDefault();libraryDrop.classList.add('dragging');}));
  ['dragleave','drop'].forEach(type=>libraryDrop.addEventListener(type,event=>{event.preventDefault();libraryDrop.classList.remove('dragging');}));
  libraryDrop.addEventListener('drop',event=>{const file=event.dataTransfer.files[0];if(file){openSetup();readDraft(file);}});
  $('#new-setup').onclick=()=>openSetup();$('#edit-setup').onclick=()=>openSetup(active());
  $('#choose-photo').onclick=()=>$('#setup-file').click();$('#take-photo').onclick=()=>openCamera('draft');
  ['#setup-file','#camera-file'].forEach(id=>$(id).onchange=async event=>{await readDraft(event.target.files[0]);event.target.value='';});
  $('#setup-form').onsubmit=saveNewSetup;
  const drop=$('#reference-drop');
  ['dragenter','dragover'].forEach(event=>drop.addEventListener(event,e=>{e.preventDefault();drop.classList.add('dragging');}));
  ['dragleave','drop'].forEach(event=>drop.addEventListener(event,e=>{e.preventDefault();drop.classList.remove('dragging');}));
  drop.addEventListener('drop',event=>readDraft(event.dataTransfer.files[0]));
  $('#empty-upload').onclick=()=>openPhotoPicker('current');$('#upload-current').onclick=()=>openPhotoPicker('current');
  $('#replace-reference').onclick=()=>openPhotoPicker('reference');
  $('#current-file').onchange=async event=>{await replacePhoto(event.target.files[0],'current');event.target.value='';};
  $('#reference-file').onchange=async event=>{await replacePhoto(event.target.files[0],'reference');event.target.value='';};
  $('#remove-current').onclick=()=>{const s=active();if(s)updateSetup(s.id,copy=>{copy.current=null;}).catch(report);};
  $('#compare-slider').oninput=event=>{
    $('#comparison').style.setProperty('--position',`${event.target.value}%`);
    event.target.setAttribute('aria-valuetext',`${event.target.value}% reference, ${100-event.target.value}% current`);
  };
  $('#add-item-form').onsubmit=async event=>{
    event.preventDefault();const s=active(),text=$('#new-item').value.trim();if(!s||!text)return;
    if(s.items.length>=100){toast('This checklist has reached 100 steps.',true);return;}
    try{await updateSetup(s.id,copy=>{copy.items.push({id:uid(),text,done:false});});$('#new-item').value='';$('#new-item').focus();}
    catch(error){report(error);}
  };
  $('#reset-checklist').onclick=()=>{const s=active();if(s)updateSetup(s.id,copy=>copy.items.forEach(i=>{i.done=false;})).catch(report);};
  let deleteId=null;
  $('#delete-setup').onclick=()=>{deleteId=selectedId;$('#confirm-dialog').showModal();};
  $('#confirm-delete').onclick=async()=>{
    const id=deleteId;$('#confirm-delete').disabled=true;
    try{
      await commit(async()=>{
        await transaction(db,['setups'],'readwrite',tx=>tx.objectStore('setups').delete(id));
        setups=setups.filter(s=>s.id!==id);if(selectedId===id)selectedId=setups[0]?.id||null;
      });
      $('#confirm-dialog').close();renderAll();toast('Setup removed from this device');
    }catch(error){report(error);}finally{$('#confirm-delete').disabled=false;}
  };
  $('#ai-consent').onchange=updateAIButton;$('#ai-run').onclick=startAI;$('#refresh-ai-status').onclick=refreshAIStatus;
  $('#ai-button').onclick=showAI;$('#backup-button').onclick=showBackup;$('#mobile-backup-button').onclick=showBackup;
  $('#ai-add-current').onclick=()=>{$('#ai-dialog').close();openPhotoPicker('current');};
}
function openPhotoPicker(kind) {
  openInfo(kind==='current'?'Capture the here and now.':'Update your reference.',`<p>${kind==='current'?'Use a similar angle and lighting to your saved reference. After saving, choose AI comparison to review your two photos.':'Replacing your reference also clears the current photo. Your checklist stays saved.'}</p><button class="button primary" id="picker-upload">${icon('upload')}Upload a photo</button><button class="button" id="picker-camera">${icon('camera')}Use camera</button><p>Photos are saved on this device. AI sharing is a separate choice. JPG, PNG and WebP are supported. HEIC works when your browser can decode it.</p>`);
  const input=$(`#${kind}-file`);
  $('#picker-upload').onclick=()=>{input.removeAttribute('capture');$('#info-dialog').close();input.click();};
  $('#picker-camera').onclick=()=>{$('#info-dialog').close();openCamera(kind);};
}
async function init() {
  hydrateIcons();wireEvents();
  fetch('/api/auth/session',{cache:'no-store',signal:AbortSignal.timeout(10000)}).then(r=>r.ok?r.json():null).then(session=>{if(session?.authenticated){$('#account-link').textContent='My account ↗';$('#account-link').setAttribute('aria-label','Open your SnapBack account');}}).catch(()=>{});
  try{
    db=await openDatabase();setups=await loadLibrary(db);setups.sort((a,b)=>b.createdAt-a.createdAt);
    selectedId=setups[0]?.id||null;renderAll();
    $('#save-status').textContent='Your library is saved on this device';
    const params=new URLSearchParams(location.search);
    if(params.get('ai')==='1'){history.replaceState(null,'',location.pathname);showAI();}
    else{
      const forceTour=params.get('tour')==='1';
      if(forceTour){params.delete('tour');history.replaceState(null,'',location.pathname+(params.size?`?${params}`:'')+location.hash);}
      welcomeTour.maybeOpen(forceTour);
    }
  }catch(error){
    report(error);$('#setup-grid').innerHTML='<div class="empty-state"><h3>We need a little space.</h3><p>Local storage could not be opened. Allow browser storage, close other SnapBack tabs, then reload. Your existing data has not been cleared.</p><button class="button primary" id="retry-storage">Try again</button></div>';
    $('#retry-storage').onclick=()=>location.reload();
  }
}
init();
