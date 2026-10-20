let busy=false;
async function resizedPhoto(source){
 const image=new Image();image.src=source;await image.decode();
 const scale=Math.min(1,1280/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
 const context=canvas.getContext('2d');context.drawImage(image,0,0,canvas.width,canvas.height);
 return canvas.toDataURL('image/jpeg',.8);
}
export async function analysePhotos(reference,current,onStatus=()=>{},consent=false){
 if(busy)throw new Error('A photo comparison is already running.');
 if(!consent)throw new Error('Agree to send these two photos to Groq before comparing.');
 busy=true;
 try{
  onStatus('Preparing your two photos…');
  const [before,after]=await Promise.all([resizedPhoto(reference),resizedPhoto(current)]);
  onStatus('Groq is comparing the reference and current photo…');
  const response=await fetch('/api/ai/compare',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(65000),body:JSON.stringify({reference:before,current:after,consent:true})});
  const result=await response.json();if(!response.ok)throw new Error(result.message||'The comparison could not finish. Please try later.');return result;
 }catch(error){if(error.name==='TimeoutError'||error.name==='AbortError')throw new Error('The comparison timed out. Please try later.');throw error;}finally{busy=false;}
}
