import {env} from 'cloudflare:workers';
import {createAuthContext} from '../../../auth.mjs';
import {createAIHandler} from '../../../ai-api.mjs';
export const dynamic='force-dynamic';
async function handle(request:Request){
 const auth=createAuthContext({request,env});
 const accountResponse=await auth.handle();if(accountResponse)return accountResponse;
 try{
  // Supabase verifies the cookie with its Auth server. ChatGPT headers are not used.
  const user=new URL(request.url).pathname==='/api/ai/compare'?await auth.getUser():null;
  const statusUser=new URL(request.url).pathname==='/api/ai/status'?await auth.getUser():user;
  const result=await createAIHandler({env,user:statusUser,authAvailable:auth.configured})(request);
  return auth.finish(result||new Response('Not found',{status:404}));
 }catch{return auth.finish(Response.json({message:'Account verification is temporarily unavailable.'},{status:503}));}
}
export const GET=handle;export const POST=handle;
