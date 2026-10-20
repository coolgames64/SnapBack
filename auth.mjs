// Hosted sign-in is owned by Sites. This module never accepts passwords or issues sessions.
export function safeReturnPath(value='/'){
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\x00-\x20]/.test(value))return '/';
 try{const url=new URL(value,'https://snapback.local');if(url.origin!=='https://snapback.local'||url.pathname!=='/')return '/';return url.pathname+url.search+url.hash;}catch{return '/';}
}
export function createAuthHandler({user=null,authAvailable=true}={}){
 return async request=>{
  const url=new URL(request.url);if(url.pathname!=='/api/auth/session')return null;
  if(request.method!=='GET')return Response.json({message:'Method not allowed.'},{status:405,headers:{'Cache-Control':'no-store','Allow':'GET'}});
  const returnTo=safeReturnPath(url.searchParams.get('return_to')||'/');
  return Response.json({authenticated:!!user?.id,authAvailable,displayName:user?.email||'Your SnapBack account',returnTo,signInPath:'/signin-with-chatgpt?return_to='+encodeURIComponent(returnTo),signOutPath:'/signout-with-chatgpt?return_to=%2Flogin'},{headers:{'Cache-Control':'no-store','Vary':'Cookie'}});
 };
}
