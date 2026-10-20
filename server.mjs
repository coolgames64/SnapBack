// Local UI preview has no trusted identity; cloud AI needs hosted sign-in.
import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import {createAIHandler} from './ai-api.mjs';

const root=path.resolve(fileURLToPath(new URL('./client/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json; charset=utf-8'};
const headers={
  'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer',
  'Content-Security-Policy':"default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  'Permissions-Policy':'camera=(self), microphone=(), geolocation=()'
};
const aiStatus={available:false,code:'AI_NOT_CONFIGURED',message:'AI comparison is not connected. No photos are uploaded or analysed. No billing is enabled.'};
function json(response,status,data){response.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});response.end(JSON.stringify(data));}
export function createServer() {
  return http.createServer(async(request,response)=>{
    try{
      const url=new URL(request.url,'http://localhost');
      if(url.pathname.startsWith('/api/billing/')||url.pathname.startsWith('/api/ai/')){
        // The simple local server deliberately has no trusted identity; headers from local clients are never trusted.
        const webRequest=new Request(`http://${request.headers.host}${request.url}`,{method:request.method,headers:request.headers});
        const result=await createAIHandler({env:process.env,user:null,authAvailable:false})(webRequest);
        response.writeHead(result.status,{...headers,...Object.fromEntries(result.headers)});response.end(Buffer.from(await result.arrayBuffer()));return;
      }
      if(url.pathname==='/api/compare'){
        // Fail closed before reading any body. Do not mistake a browser flag for authentication.
        if(request.method!=='POST'){response.setHeader('Allow','POST');json(response,405,{code:'METHOD_NOT_ALLOWED'});return;}
        const origin=request.headers.origin;
        if(origin && origin!==`http://${request.headers.host}`){json(response,403,{code:'ORIGIN_REJECTED'});return;}
        json(response,503,aiStatus);return;
      }
      if(!['GET','HEAD'].includes(request.method)){response.setHeader('Allow','GET, HEAD');json(response,405,{code:'METHOD_NOT_ALLOWED'});return;}
      let pathname;
      try{pathname=decodeURIComponent(url.pathname);}catch{json(response,400,{code:'BAD_PATH'});return;}
      if(pathname.includes('\0')||pathname.split('/').some(part=>part.startsWith('.'))){json(response,404,{code:'NOT_FOUND'});return;}
      const filename=path.resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
      if(!filename.startsWith(root+path.sep)){json(response,404,{code:'NOT_FOUND'});return;}
      try{
        if(!(await stat(filename)).isFile())throw new Error('Not a file');
        const bytes=await readFile(filename);
        response.writeHead(200,{...headers,'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-cache'});
        response.end(request.method==='HEAD'?undefined:bytes);
      }catch{json(response,404,{code:'NOT_FOUND'});}
    }catch{json(response,500,{code:'SERVER_ERROR'});}
  });
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1';
  const server=createServer();
  server.listen(port,host,()=>console.log(`SnapBack is ready at http://${host}:${server.address().port}`));
}
