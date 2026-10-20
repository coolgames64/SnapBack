// Supabase owns accounts, password hashing, PKCE and session rotation.
// No ChatGPT identity header or browser flag can grant an email-account session.
import {createServerClient,parseCookieHeader,serializeCookieHeader} from '@supabase/ssr';
export function safeReturnPath(value='/'){
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\x00-\x20]/.test(value))return '/';
 try{const url=new URL(value,'https://snapback.local');if(url.origin!=='https://snapback.local'||url.pathname!=='/')return '/';return url.pathname+url.search+url.hash;}catch{return '/';}
}
export function emailAuthReady(env={}){
 return env.SUPABASE_AUTH_READY==='true'&&/^https:\/\/[a-z0-9]{10,40}\.supabase\.co\/?$/.test(env.SUPABASE_URL||'')&&/^sb_publishable_[A-Za-z0-9_-]+$/.test(env.SUPABASE_PUBLISHABLE_KEY||'');
}
export function authUsageStore(db){
 if(!db)return null;
 async function reserve(member,period,limit){return !!await db.prepare(`INSERT INTO ai_usage (member,period,requests,last_request) VALUES (?,?,1,0) ON CONFLICT(member,period) DO UPDATE SET requests=requests+1 WHERE requests < ? RETURNING requests`).bind(member,period,limit).first();}
 return {async take(email,now=Date.now()){
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(email.toLowerCase()));
  const member='auth:'+Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
  const period='auth:'+Math.floor(now/900000);
  return await reserve(member,period,8)&&await reserve('auth:all',period,200);
 }};
}
class AuthError extends Error {constructor(message,status=400,code='AUTH_ERROR'){super(message);this.status=status;this.code=code;}}
async function readForm(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AuthError('Expected a sign-in request.',415);
 const reader=request.body?.getReader();if(!reader)throw new AuthError('Enter your account details.');
 let size=0,chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw new AuthError('Account request is too large.',413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new AuthError('Invalid account request.');}
 if(!body||typeof body!=='object'||Array.isArray(body))throw new AuthError('Invalid account request.');return body;
}
function checkEmail(value){if(typeof value!=='string'||value.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(value.trim()))throw new AuthError('Enter a valid email address.');return value.trim().toLowerCase();}
function checkPassword(value,creating){if(typeof value!=='string'||value.length>128||value.length<(creating?12:1))throw new AuthError(creating?'Use a password of 12–128 characters.':'Enter your password.');return value;}
function providerError(error,action){
 if(!error)return;
 if(error.status===429||['over_email_send_rate_limit','over_request_rate_limit'].includes(error.code))throw new AuthError('Too many account attempts. Please try again later.',429,'AUTH_LIMIT');
 if(error.code==='email_not_confirmed')throw new AuthError('Confirm your email address before signing in. Check your inbox.');
 if(action==='signin'&&['invalid_credentials','user_banned'].includes(error.code))throw new AuthError('Email or password not recognised.',401);
 if(error.code==='weak_password')throw new AuthError('Choose a stronger password with at least 12 characters.');
 throw new AuthError('The account service could not complete this request. Please try again later.',503,'AUTH_UNAVAILABLE');
}
export function createAuthContext({request,env={},clientFactory=createServerClient,usage=authUsageStore(env.DB)}={}){
 const url=new URL(request.url),configured=emailAuthReady(env)&&!!usage;
 const cookieWrites=new Map(),extraHeaders=new Headers();
 const cookieOptions={name:'snapback-auth',path:'/',httpOnly:true,secure:url.protocol==='https:',sameSite:'lax'};
 let client=null,userPromise;
 if(configured)client=clientFactory(env.SUPABASE_URL,env.SUPABASE_PUBLISHABLE_KEY,{cookieOptions,cookies:{getAll:()=>parseCookieHeader(request.headers.get('cookie')||''),setAll:(cookies,headers={})=>{for(const cookie of cookies)cookieWrites.set(cookie.name,cookie);for(const [key,value] of Object.entries(headers))extraHeaders.set(key,value);}}});
 const finish=response=>{
  const headers=new Headers(response.headers);for(const [key,value] of extraHeaders)headers.set(key,value);
  headers.set('Cache-Control','private, no-store');headers.set('Vary','Cookie');headers.set('Referrer-Policy','no-referrer');
  for(const {name,value,options} of cookieWrites.values())headers.append('Set-Cookie',serializeCookieHeader(name,value,{...options,httpOnly:true,secure:cookieOptions.secure,sameSite:'lax',path:'/'}));
  return new Response(response.body,{status:response.status,headers});
 };
 const json=(value,status=200)=>finish(Response.json(value,{status}));
 async function getUser(){
  if(!configured||!/(?:^|;\s*)snapback-auth(?:\.\d+)?=/.test(request.headers.get('cookie')||''))return null;
  userPromise??=client.auth.getUser().then(({data,error})=>{if(error||!data?.user?.email_confirmed_at||typeof data.user.id!=='string'||typeof data.user.email!=='string')return null;return {id:'supabase:'+data.user.id,email:data.user.email};});
  return userPromise;
 }
 async function handle(){
  const path=url.pathname;
  if(path==='/auth/complete'){
   if(request.method!=='GET')return json({message:'Method not allowed.'},405);
   const returnTo=safeReturnPath(url.searchParams.get('return_to')||'/');
   if(!configured||!url.searchParams.get('code'))return finish(Response.redirect(new URL('/login?error=confirmation',url.origin),303));
   try{const {error}=await client.auth.exchangeCodeForSession(url.searchParams.get('code'));if(error)throw error;return finish(Response.redirect(new URL(url.searchParams.get('flow')==='recovery'?'/login?mode=update':returnTo,url.origin),303));}catch{return finish(Response.redirect(new URL('/login?error=confirmation',url.origin),303));}
  }
  if(!path.startsWith('/api/auth/'))return null;
  if(path==='/api/auth/session'){
   if(request.method!=='GET')return json({message:'Method not allowed.'},405);
   try{const user=await getUser();return json({provider:'email',configured,authAvailable:configured,authenticated:!!user,displayName:user?.email||'',returnTo:safeReturnPath(url.searchParams.get('return_to')||'/')});}catch{return json({message:'Account status could not be checked. Please try again.'},503);}
  }
  const action=path.slice('/api/auth/'.length);
  if(!['signin','signup','reset','update','signout'].includes(action))return json({message:'Not found.'},404);
  if(request.method!=='POST')return json({message:'Method not allowed.'},405);
  if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return json({message:'Use this form from SnapBack.'},403);
  if(!configured)return json({code:'AUTH_SETUP_REQUIRED',message:'Email accounts are being set up. You can still use your local photo library.'},503);
  try{
   if(action==='signout'){
    let revoked=true;try{const {error}=await client.auth.signOut({scope:'local'});revoked=!error;}catch{revoked=false;}
    // Expire all cookie chunks even when there was no current Supabase session.
    for(const cookie of parseCookieHeader(request.headers.get('cookie')||''))if(cookie.name.startsWith('snapback-auth'))cookieWrites.set(cookie.name,{...cookie,value:'',options:{maxAge:0}});
    return json({message:revoked?'Signed out.':'Signed out of this browser. Server revocation could not be confirmed.',redirect:'/login'});
   }
   const body=await readForm(request);
   if(action==='update'){
    const user=await getUser();if(!user)throw new AuthError('Sign in or open your reset email again.',401);
    const password=checkPassword(body.password,true);
    if(!await usage.take(user.email))throw new AuthError('Too many account attempts. Try again later.',429,'AUTH_LIMIT');
    const {error}=await client.auth.updateUser({password});providerError(error,action);return json({message:'Password updated. You can open your library.',redirect:'/'});
   }
   const email=checkEmail(body.email),password=action==='reset'?null:checkPassword(body.password,action==='signup');
   if(!await usage.take(email))throw new AuthError('Too many account attempts. Please try again later.',429,'AUTH_LIMIT');
   const returnTo=safeReturnPath(body.returnTo||'/');
   const callback=new URL('/auth/complete',url.origin);callback.searchParams.set('return_to',returnTo);
   if(action==='signin'){
    const {data,error}=await client.auth.signInWithPassword({email,password});providerError(error,action);
    if(!data?.user?.email_confirmed_at){await client.auth.signOut({scope:'local'});throw new AuthError('Confirm your email address before signing in.');}
    return json({message:'Signed in.',redirect:returnTo});
   }
   if(action==='signup'){
    const {error}=await client.auth.signUp({email,password,options:{emailRedirectTo:callback.href}});providerError(error,action);
    return json({message:'If this address can be registered, check your inbox to confirm it. Open the link in this browser, then sign in.'});
   }
   callback.searchParams.set('flow','recovery');
   const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:callback.href});providerError(error,action);
   return json({message:'If an account exists for this address, a reset email is on its way. Open its link in this browser.'});
  }catch(error){return json({code:error instanceof AuthError?error.code:'AUTH_UNAVAILABLE',message:error instanceof AuthError?error.message:'The account service is unavailable. Try again later.'},error instanceof AuthError?error.status:503);}
 }
 return {configured,getUser,handle,finish};
}
