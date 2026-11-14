import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {spawn} from 'node:child_process';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const port=4174,url=`http://127.0.0.1:${port}/`;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.wav':'audio/wav','.mp3':'audio/mpeg'};
const api=process.env.LOCAL_PLAYER_API||'http://127.0.0.1:4180';let backend;
try{const r=await fetch(api+'/api/health',{signal:AbortSignal.timeout(1500)});if(!r.ok)throw Error('Backend is unavailable.');}catch{backend=spawn(process.execPath,[fileURLToPath(new URL('../backend/server.mjs',import.meta.url))],{stdio:'inherit',windowsHide:true});}
try{await stat(resolve(root,'index.html'));}catch{console.error('Production files are missing. Run pnpm install, then pnpm build.');process.exit(1);}
if(backend){let ready=false;for(let attempt=0;attempt<60&&!ready;attempt++){if(backend.exitCode!==null)throw Error('Account backend stopped before startup.');try{ready=(await fetch(api+'/api/health',{signal:AbortSignal.timeout(500)})).ok;}catch{}if(!ready)await new Promise(r=>setTimeout(r,100));}if(!ready){backend.kill();throw Error('Account backend did not become ready.');}}
const server=createServer(async(req,res)=>{
 try{
  const requestPath=new URL(req.url,url).pathname;
  if(requestPath.startsWith('/api/')){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>500000){res.writeHead(413);res.end('Request too large.');return;}chunks.push(chunk);}const headers={...req.headers};delete headers.host;const result=await fetch(api+req.url,{method:req.method,headers,redirect:'manual',...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});const outgoing=Object.fromEntries(result.headers),cookies=result.headers.getSetCookie();if(cookies.length)outgoing['set-cookie']=cookies;res.writeHead(result.status,outgoing);res.end(Buffer.from(await result.arrayBuffer()));return;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/bastions-of-the-last-kingdom\//,'/');
  const file=resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
  if(!file.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403);res.end('Forbidden');return;}
  const body=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);
 }catch{res.writeHead(404);res.end('Not found');}
});
const shutdown=()=>{backend?.kill();server.close();};process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);process.on('exit',()=>backend?.kill());
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${port} is already in use. If the game is running, open ${url}`:e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{
 console.log(`Forged Alliances TD\nPlay at ${url}\nKeep this window open while playing. Ctrl+C stops the server.`);
 if(process.argv.includes('--open')){
  if(process.platform==='win32')spawn('cmd.exe',['/c','start','',url],{windowsHide:true});
  else spawn(process.platform==='darwin'?'open':'xdg-open',[url]);
 }
});
