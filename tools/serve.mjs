import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {spawn} from 'node:child_process';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const port=4174,url=`http://127.0.0.1:${port}/`;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.wav':'audio/wav'};
try{await stat(resolve(root,'index.html'));}catch{console.error('Production files are missing. Run pnpm install, then pnpm build.');process.exit(1);}
const server=createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
  if(!file.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403);res.end('Forbidden');return;}
  const body=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${port} is already in use. If the game is running, open ${url}`:e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{
 console.log(`Bastions of the Last Kingdom\nPlay at ${url}\nKeep this window open while playing. Ctrl+C stops the server.`);
 if(process.argv.includes('--open')){
  if(process.platform==='win32')spawn('cmd.exe',['/c','start','',url],{windowsHide:true});
  else spawn(process.platform==='darwin'?'open':'xdg-open',[url]);
 }
});
