// Exercise the actual prepared production bundle and generated D1 schema in memory.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {sqliteDatabase} from '../backend/sqlite-adapter.js';
const root=path.resolve(process.argv[2]||'artifacts/statistics-template'),{default:worker}=await import(pathToFileURL(path.join(root,'dist/server/index.js'))),db=sqliteDatabase(),mail=[];
try{
 for(const file of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())db.sqlite.exec(fs.readFileSync(path.join(root,'drizzle',file),'utf8'));
 const base='http://127.0.0.1:4174',env={DB:{prepare:db.prepare,batch:db.batch},AUTH_SECRET:'isolated-template-verification-secret-at-least-32',AUTH_BASE_URL:base,AUTH_MAIL_MODE:'local',AUTH_LOCAL_MAIL:async value=>mail.push(value),GAME_ORIGINS:base};
 const call=async(p,b,cookie='')=>worker.fetch(new Request(base+p,{method:b?'POST':'GET',headers:{Origin:base,'CF-Connecting-IP':'192.0.2.230',...(b?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(b?{body:JSON.stringify(b)}:{})}),env);
 assert.equal((await call('/api/health')).status,200);
 const registered=await call('/api/auth/sign-up/email',{name:'Template verifier',email:'template@example.test',password:'template-only-test-password',callbackURL:base+'/'});assert.equal(registered.status,200,await registered.text());assert.equal(mail.length,1);
 const verified=await worker.fetch(new Request(mail[0].url,{headers:{Origin:base,'CF-Connecting-IP':'192.0.2.230'}}),env);assert.equal(verified.status,302);const cookie=verified.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 const identity=await (await call('/api/player/session',null,cookie)).json();assert.equal(identity.user.name,'Template verifier');
 const created=await call('/api/player/runs',{factionId:'forge'},cookie);assert.equal(created.status,201);const {run}=await created.json();
 const submitted=await call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:0,commands:[{action:'place',args:[18,18]}]},cookie);assert.equal(submitted.status,200,await submitted.clone().text());assert.equal((await submitted.json()).sequence,1);
 assert.equal((await call('/api/player/active',null,cookie)).status,200);assert.equal((await call('/api/player/hall?faction=forge')).status,200);
 console.log(JSON.stringify({status:'passed',checks:['generated additive D1 migrations','built bundle imports','real registration and email verification','D1-compatible authentication','account session','seeded run creation','canonical command replay','cloud continuation','public standings'],tables:db.sqlite.prepare("SELECT count(*) n FROM sqlite_schema WHERE type='table'").get().n},null,2));
}finally{db.sqlite.close();}
