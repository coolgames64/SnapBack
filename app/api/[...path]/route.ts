import {env} from 'cloudflare:workers';
import {createBilling} from '../../../billing.mjs';
export const dynamic='force-dynamic';
async function handle(request:Request){
  // Sites dispatch establishes identity; never read an identity from the request body.
  const id=request.headers.get('oai-authenticated-user-id');
  const email=request.headers.get('oai-authenticated-user-email');
  const handler=createBilling({env,user:id?{id,email}:null});
  return await handler(request)||new Response('Not found',{status:404});
}
export const GET=handle;export const POST=handle;
