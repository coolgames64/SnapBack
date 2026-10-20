import {env} from 'cloudflare:workers';
import {createAuthContext} from '../../../auth.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return await createAuthContext({request,env}).handle();}
