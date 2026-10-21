const STORAGE_KEY='snapback:welcome-tour:v1';
const steps=[
 {eyebrow:'WELCOME TO SNAPBACK',title:'A little order starts here.',description:'Keep a photo of how your space should look. Compare it with a fresh photo whenever you need a reset.',tip:'Five quick steps. No account needed to save photos or compare them manually.',guide:'reference-photo',art:'welcome'},
 {eyebrow:'01 / SAVE YOUR BASELINE',title:'Remember the way it should be.',description:'Choose New setup, give it a name, then upload a reference photo or use your camera. Choose Save setup to keep it in your library.',tip:'Start with a tidy desk, coffee corner or room. The example setups are there to explore, too.',guide:'reference-photo',art:'reference'},
 {eyebrow:'02 / ADD THE HERE AND NOW',title:'Give it a current photo.',description:'Open your saved setup and choose Add current. Upload a new photo, or choose Use camera, Take photo and Use this photo.',tip:'Match the reference angle and lighting. The photo saves automatically. Use the slider or Side by side to see what changed.',guide:'current-photo',art:'current'},
 {eyebrow:'03 / A SECOND PAIR OF EYES',title:'Let AI help you spot changes.',description:'Choose AI comparison, sign in with a verified SnapBack email account, and check both previews. Read the sharing agreement, then choose Compare with Groq.',tip:'AI is free within usage limits and is for adults using it for work. Photos go to Groq only after you agree and start a comparison.',guide:'ai-comparison',art:'ai'},
 {eyebrow:'04 / BACK TO JUST RIGHT',title:'Make your next reset easier.',description:'Review the suggestions yourself. Add useful ones to your checklist, edit the steps and tick them off as you go.',tip:'Your photos and checklist stay in this browser. Use Backup & storage to keep a copy. You can reopen this tour any time with Quick tour.',guide:'review',art:'checklist'}
];
const camera='<svg viewBox="0 0 48 48" aria-hidden="true" fill="none"><path d="M16 14l3-5h10l3 5h7a3 3 0 0 1 3 3v20a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V17a3 3 0 0 1 3-3h7Z" stroke="currentColor" stroke-width="2"/><circle cx="24" cy="26" r="8" stroke="currentColor" stroke-width="2"/></svg>';
const reference='<div class="tour-photo"><img src="/assets/workspace.jpg" alt="Example reference photo of a tidy workspace"><span>REFERENCE / THE WAY IT SHOULD BE</span></div>';
const artwork={
 welcome:`<div class="tour-pair">${reference}<div class="tour-photo tour-placeholder">${camera}<strong>A fresh perspective.</strong><span>CURRENT / THE WAY IT IS NOW</span></div></div><div class="tour-art-caption">ONE REFERENCE. A BETTER RESET.</div>`,
 reference:`<div class="tour-reference">${reference}<div class="tour-example-label"><span>YOUR LIBRARY</span><strong>My workspace</strong><small>1 reference · saved on this device</small></div></div>`,
 current:`<div class="tour-pair">${reference}<div class="tour-photo tour-placeholder">${camera}<strong>Add current photo</strong><small>Upload a photo or use camera</small><span>CURRENT / A FRESH PHOTO</span></div></div><div class="tour-art-caption">SAME SPACE. SIMILAR ANGLE. NEW PHOTO.</div>`,
 ai:`<div class="tour-ai-example"><span class="tour-spark" aria-hidden="true">✦</span><span class="tour-example-chip">FREE AI</span><h3>Two photos. One comparison.</h3><p>Reference + current photo</p><div class="tour-agreement">Your agreement comes first.</div><small>Illustration only · no photos are sent by this tour.</small></div>`,
 checklist:'<div class="tour-checklist"><div><span aria-hidden="true">✓</span><strong>Your reset checklist</strong></div><p><span class="tour-check checked" aria-hidden="true">✓</span>Return items to their places</p><p><span class="tour-check" aria-hidden="true"></span>Review anything that changed</p><p><span class="tour-check" aria-hidden="true"></span>Make it your kind of calm</p><small>Example checklist · make every step your own.</small></div>'
};

export function createWelcomeTour({dialog,onCreateSetup}){
 const find=selector=>dialog.querySelector(selector);
 let current=0,previousFocus=null;
 function remember(){try{localStorage.setItem(STORAGE_KEY,'seen');}catch{/* A blocked preference must never stop someone using their library. */}}
 function close(){remember();dialog.close();if(previousFocus?.isConnected)previousFocus.focus();}
 function render(){
  const step=steps[current];dialog.scrollTop=0;
  find('#tour-eyebrow').textContent=step.eyebrow;
  find('#tour-title').textContent=step.title;
  find('#tour-description').textContent=step.description;
  find('#tour-tip').textContent=step.tip;
  find('#tour-art').innerHTML=artwork[step.art];
  find('#tour-step-count').textContent=`Step ${current+1} of ${steps.length}`;
  const progress=find('#tour-progress');progress.setAttribute('aria-valuenow',String(current+1));progress.style.setProperty('--tour-progress',`${(current+1)/steps.length*100}%`);
  find('#tour-back').hidden=current===0;
  find('#tour-next').textContent=current===steps.length-1?'Create a setup ↗':'Next step →';
  find('#tour-skip').textContent=current===steps.length-1?'Explore my library':'Skip tour';
  find('#tour-instructions').href=`/instructions#${step.guide}`;
 }
 function open(){
  if(dialog.open||document.querySelector('dialog[open]'))return;
  previousFocus=document.activeElement;current=0;render();dialog.showModal();find('#tour-next').focus({preventScroll:true});
 }
 find('#tour-next').onclick=()=>{
  if(current===steps.length-1){close();onCreateSetup();return;}
  current++;render();find('#tour-title').focus({preventScroll:true});
 };
 find('#tour-back').onclick=()=>{if(current>0){current--;render();find('#tour-title').focus({preventScroll:true});}};
 find('#tour-skip').onclick=close;find('#tour-close').onclick=close;
 find('#tour-instructions').onclick=()=>{remember();};
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 return {open,maybeOpen(force=false){
  if(force){open();return;}
  try{if(localStorage.getItem(STORAGE_KEY)!=='seen')open();}catch{/* The manual Quick tour button stays available if preferences cannot be saved. */}
 }};
}
