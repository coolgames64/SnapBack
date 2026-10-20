export function createCamera(dialog) {
  const get=id=>dialog.querySelector(id);
  const video=get('#camera-video'),preview=get('#camera-preview'),guide=get('#camera-guide');
  let stream=null,generation=0,shot=null,resolveResult=null,facing='environment';
  function stop(){stream?.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;}
  function showError(error){
    const messages={NotAllowedError:'Camera permission was denied. Allow camera access for this site, or upload a photo below.',NotFoundError:'No camera was found. You can upload a photo instead.',NotReadableError:'The camera is busy. Close other camera apps and try again.',OverconstrainedError:'This camera setting is unavailable. Try switching the camera.'};
    get('#camera-status').textContent=messages[error?.name]||error?.message||'The camera could not start. Try again or upload a photo.';
    get('#camera-capture').disabled=true;get('#camera-retry').hidden=false;
  }
  async function start(){
    stop();const token=++generation;shot=null;preview.hidden=true;video.hidden=false;guide.hidden=!get('#camera-guide-toggle').checked;
    get('#camera-use').hidden=true;get('#camera-retake').hidden=true;get('#camera-capture').hidden=false;get('#camera-capture').disabled=true;get('#camera-retry').hidden=true;
    get('#camera-status').textContent='Waiting for camera permission…';
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access needs HTTPS and a supported browser. Try opening SnapBack in Safari or Chrome, or upload a photo.');
      const next=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:1600},height:{ideal:1200}},audio:false});
      if(token!==generation||!dialog.open){next.getTracks().forEach(track=>track.stop());return;}
      stream=next;video.srcObject=next;
      await video.play();
      if(token!==generation||!dialog.open)return;
      video.classList.toggle('mirrored',next.getVideoTracks()[0]?.getSettings().facingMode==='user');
      get('#camera-status').textContent='Line up the scene, then take a photo. No video is recorded.';
      get('#camera-capture').disabled=false;
    }catch(error){if(token===generation&&dialog.open){stop();showError(error);}}
  }
  get('#camera-capture').onclick=()=>{
    if(!video.videoWidth||!video.videoHeight)return;
    const scale=Math.min(1,1600/Math.max(video.videoWidth,video.videoHeight)),canvas=document.createElement('canvas');
    canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
    canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);shot=canvas.toDataURL('image/jpeg',.86);
    preview.src=shot;preview.hidden=false;video.hidden=true;guide.hidden=true;stop();
    get('#camera-capture').hidden=true;get('#camera-use').hidden=false;get('#camera-retake').hidden=false;
    get('#camera-status').textContent='Camera stopped. Keep this photo or take another.';
  };
  get('#camera-retake').onclick=start;get('#camera-retry').onclick=start;
  get('#camera-switch').onclick=()=>{facing=facing==='environment'?'user':'environment';start();};
  get('#camera-guide-toggle').onchange=event=>{guide.hidden=!event.target.checked||!!shot;};
  get('#camera-use').onclick=()=>{if(shot)dialog.close('use');};
  get('#camera-upload').onclick=()=>dialog.close('upload');
  dialog.addEventListener('close',()=>{
    generation++;stop();const resolve=resolveResult;resolveResult=null;
    const result=dialog.returnValue==='use'?{photo:shot}:dialog.returnValue==='upload'?{upload:true}:null;
    shot=null;preview.removeAttribute('src');guide.removeAttribute('src');resolve?.(result);
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open){generation++;stop();dialog.close();}});
  window.addEventListener('pagehide',()=>{generation++;stop();});
  return {
    open({title='Take a photo',reference=null}={}){
      if(dialog.open)return Promise.resolve(null);
      get('#camera-title').textContent=title;get('#camera-guide-control').hidden=!reference;
      if(reference)guide.src=reference;else guide.removeAttribute('src');
      get('#camera-guide-toggle').checked=!!reference;dialog.returnValue='';dialog.showModal();
      const promise=new Promise(resolve=>{resolveResult=resolve;});start();return promise;
    }
  };
}
