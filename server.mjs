import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createAIService} from './ai-backend.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const assets=new Set(['index.html','style.css','app.js','idea-ui.js','idea-design.js','ai-ui.js','analyzer.js','assessment.js','semantic.js','distributed.js','translator.js','generator.js','migration-report.js','report-pdf.js','review-ui.js','diagram-ui.js','diagram-layout.js']);
export function createServer(service=createAIService()){
 const json=(res,status,data)=>res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(JSON.stringify(data));
 return http.createServer(async(req,res)=>{
  try{
   const host=req.headers.host,port=req.socket.localPort;
   if(!['127.0.0.1:'+port,'localhost:'+port].includes(host)){json(res,403,{error:'Local host required.'});return;}
   const pathname=decodeURIComponent(new URL(req.url,'http://'+host).pathname);
   if(pathname.startsWith('/api/')){
    if(req.headers.origin&&req.headers.origin!=='http://'+host){json(res,403,{error:'Same-origin request required.'});return;}
    if(pathname==='/api/ai/status'&&req.method==='GET'){json(res,200,service.status());return;}
    if(req.method!=='POST'||req.headers['x-flow-request']!=='1'||!req.headers['content-type']?.startsWith('application/json')){json(res,403,{error:'Use the local Flow UI for AI requests.'});return;}
    if(!['/api/ai/analyze','/api/ai/approve','/api/ai/generate'].includes(pathname)){json(res,404,{error:'Unknown endpoint.'});return;}
    const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>2000000){json(res,413,{error:'Request exceeds 2 MB.'});return;}chunks.push(chunk);}
    let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{json(res,400,{error:'Invalid JSON request.'});return;}
    const result=await service[pathname.split('/').pop()](body);json(res,200,result);return;
   }
   if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
   const name=pathname==='/'?'index.html':pathname.slice(1);
   if(!assets.has(name)&&!/^vendor\/(?:[a-z-]+\.js|licenses\/[a-z]+\.txt)$/.test(name)){res.writeHead(404).end('Not found');return;}
   const data=await readFile(path.join(root,name));res.writeHead(200,{'Content-Type':{'.js':'text/javascript','.html':'text/html','.css':'text/css','.txt':'text/plain'}[path.extname(name)],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}).end(req.method==='HEAD'?undefined:data);
  }catch(error){json(res,400,{error:error.code==='ENOENT'?'Not found':error.message});}
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{process.loadEnvFile(path.join(root,'.env'));}catch(error){if(error.code!=='ENOENT')throw error;}
 createServer().listen(Number(process.env.PORT||5173),'127.0.0.1',()=>console.log('Flow: http://127.0.0.1:'+(process.env.PORT||5173)));
}
