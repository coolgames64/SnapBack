// Free AI endpoint. Trusted hosted identity and quotas prevent anonymous key abuse.
import {AIError,groqReady,readAIRequest,compareWithGroq} from './groq.mjs';
import {aiUsageStore} from './ai-usage.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export function createAIHandler({env={},user=null,authAvailable=true,fetcher=fetch,usage=aiUsageStore(env.DB)}={}){
 return async function handle(request){
  const url=new URL(request.url),path=url.pathname;
  if(path.startsWith('/api/billing/'))return json({code:'PAYMENTS_DISABLED',message:'Subscriptions are not offered. AI comparison is free within usage limits.'},410);
  if(!path.startsWith('/api/ai/'))return null;
  if(path==='/api/ai/status'){
   if(request.method!=='GET')return json({message:'Method not allowed.'},405);
   return json({provider:'Groq',free:true,configured:groqReady(env)&&!!usage,authAvailable,signedIn:!!user?.id,monthlyLimit:100,sharedDailyLimit:25,cooldownSeconds:60});
  }
  if(path!=='/api/ai/compare')return json({message:'Not found.'},404);
  if(request.method!=='POST')return json({message:'Method not allowed.'},405);
  if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return json({message:'This request must come from SnapBack.'},403);
  if(!user?.id)return json({code:'SIGN_IN_REQUIRED',message:'Sign in to use free AI. No subscription is required.'},401);
  if(!groqReady(env)||!usage)return json({code:'AI_NOT_CONFIGURED',message:'Free AI is temporarily unavailable. Your photos have not been sent.'},503);
  try{
   const photos=await readAIRequest(request);
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(user.id));
   const member=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
   if(!await usage.take(member))return json({code:'FREE_LIMIT',message:'The free usage limit has been reached. Allow at least one minute between attempts, or try again tomorrow.'},429);
   return json(await compareWithGroq({env,photos,fetcher}));
  }catch(error){
   if(error instanceof AIError)return json({code:error.code,message:error.message},error.status);
   return json({code:'AI_UNAVAILABLE',message:'Free AI is temporarily unavailable. Please try later.'},503);
  }
 };
}
