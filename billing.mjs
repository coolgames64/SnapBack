// Direct Klarna setup boundary. No Stripe SDK, API calls or payment links.
// Until merchant onboarding and the recurring billing backend are completed,
// no checkout is created and no request can grant a paid entitlement.
import {groqReady} from './groq.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const pending={code:'KLARNA_SETUP_REQUIRED',message:'Klarna merchant setup is pending. No payment can be taken and Plus AI remains locked.'};
export function createBilling({env={},user=null}={}){
 return async function handle(request){
  const url=new URL(request.url),path=url.pathname;
  if(!path.startsWith('/api/billing/')&&!path.startsWith('/api/ai/'))return null;
  if(path==='/api/billing/status'){
   if(request.method!=='GET')return json({message:'Method not allowed.'},405);
   return json({provider:'Klarna',configured:false,setupRequired:true,aiConfigured:groqReady(env),aiProvider:'Groq',aiMonthlyLimit:100,signedIn:!!user?.id,active:false,hasCustomer:false,testMode:true,price:{amount:499,currency:'gbp',interval:'month'}});
  }
  if(!['/api/billing/checkout','/api/billing/portal','/api/billing/confirm','/api/ai/compare'].includes(path))return json({message:'Not found.'},404);
  const method=path==='/api/billing/confirm'?'GET':'POST';
  if(request.method!==method)return json({message:'Method not allowed.'},405);
  if(request.method==='POST'&&(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site'))return json({message:'This request must come from SnapBack.'},403);
  if(!user?.id)return json({code:'SIGN_IN_REQUIRED',message:'Sign in to manage Plus access.'},401);
  return json(pending,503);
 };
}
