import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import worker from './worker.js';
import {sqliteDatabase} from './sqlite-adapter.js';
import {migrateFr010} from './migrate-fr010.js';

const root=fileURLToPath(new URL('../',import.meta.url)),directory=process.env.STATISTICS_DATA_DIR||path.join(root,'artifacts','statistics');fs.mkdirSync(directory,{recursive:true});
const db=sqliteDatabase(path.join(directory,'bastions.sqlite'));
if(!db.sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name='runs'").get())db.sqlite.exec(fs.readFileSync(new URL('./migrations/0000_statistics.sql',import.meta.url),'utf8'));
migrateFr010(db);
const keyfile=path.join(directory,'owner-token.txt');if(!fs.existsSync(keyfile))fs.writeFileSync(keyfile,randomBytes(32).toString('hex'),{mode:0o600});
const env={DB:db,ADMIN_TOKEN:process.env.ADMIN_TOKEN||fs.readFileSync(keyfile,'utf8').trim(),GAME_ORIGINS:process.env.GAME_ORIGINS||'http://127.0.0.1:4174,http://127.0.0.1:5173,http://localhost:4174,http://localhost:5173,https://sinaglr-eng.github.io'};
const authKeyFile=path.join(directory,'auth-secret.txt');if(!fs.existsSync(authKeyFile))fs.writeFileSync(authKeyFile,randomBytes(48).toString('hex'),{mode:0o600});
Object.assign(env,{AUTH_SECRET:process.env.AUTH_SECRET||fs.readFileSync(authKeyFile,'utf8').trim(),AUTH_BASE_URL:process.env.AUTH_BASE_URL||'http://127.0.0.1:4174',AUTH_MAIL_MODE:process.env.AUTH_MAIL_MODE||'local',AUTH_ENABLE_EMAIL:process.env.AUTH_ENABLE_EMAIL,...Object.fromEntries(['FACEBOOK_CLIENT_ID','FACEBOOK_CLIENT_SECRET','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','APPLE_CLIENT_ID','APPLE_TEAM_ID','APPLE_KEY_ID','APPLE_PRIVATE_KEY'].map(key=>[key,process.env[key]])),RESEND_API_KEY:process.env.RESEND_API_KEY,AUTH_EMAIL_FROM:process.env.AUTH_EMAIL_FROM,AUTH_LOCAL_MAIL:async mail=>{const folder=path.join(directory,'mailbox');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,Date.now()+'-'+randomBytes(4).toString('hex')+'.json'),JSON.stringify(mail,null,2),{mode:0o600});}});
if((process.env.HOST||'127.0.0.1')!=='127.0.0.1'&&env.AUTH_MAIL_MODE==='local')throw Error('Local mailbox mode requires loopback binding.');
const port=Number(process.env.PORT)||4180,host=process.env.HOST||'127.0.0.1';
const server=http.createServer(async(req,res)=>{try{
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>500000){res.writeHead(413);res.end('Request too large.');return;}chunks.push(chunk);}
  const request=new Request(`http://${host}:${port}${req.url}`,{method:req.method,headers:{...req.headers,'cf-connecting-ip':req.socket.remoteAddress},...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
  const result=await worker.fetch(request,env);if(process.env.STATISTICS_DEBUG==='1')console.log(req.method,new URL(request.url).pathname,result.status);const headers=Object.fromEntries(result.headers),cookies=result.headers.getSetCookie();if(cookies.length)headers['set-cookie']=cookies;res.writeHead(result.status,headers);res.end(Buffer.from(await result.arrayBuffer()));
}catch(error){console.error(error.message);res.writeHead(500);res.end('Statistics service unavailable.');}});
server.listen(port,host,()=>console.log(`Persistent statistics API: http://${host}:${port} (SQLite in ${directory})`));
const stop=()=>server.close(()=>{db.sqlite.close();process.exit(0);});process.on('SIGINT',stop);process.on('SIGTERM',stop);
