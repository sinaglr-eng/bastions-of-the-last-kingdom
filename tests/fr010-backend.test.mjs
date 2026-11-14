import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import worker from '../backend/worker.js';
import {sqliteDatabase} from '../backend/sqlite-adapter.js';
import {migrateFr010} from '../backend/migrate-fr010.js';
import {restoreRun,serializeRun} from '../game/core/run-state.js';
import {currentFactionData} from '../game/core/current-data.js';

const base='http://127.0.0.1:4174';
let fixtureNumber=0;
function fixture(){
 const db=sqliteDatabase();db.sqlite.exec(fs.readFileSync(new URL('../backend/migrations/0000_statistics.sql',import.meta.url),'utf8'));migrateFr010(db);const mail=[];
 const env={DB:db,ADMIN_TOKEN:'test-only-owner',AUTH_SECRET:'test-only-auth-secret-at-least-thirty-two-characters',AUTH_BASE_URL:base,AUTH_MAIL_MODE:'local',AUTH_LOCAL_MAIL:async value=>mail.push(value),GAME_ORIGINS:base};
 const ip=`192.0.2.${++fixtureNumber}`;
 const call=async(path,body,cookie='',method=body?'POST':'GET')=>{const r=await worker.fetch(new Request(base+path,{method,headers:{Origin:base,'X-Forwarded-For':ip,'CF-Connecting-IP':ip,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);let value;try{value=await r.clone().json();}catch{}return {r,value};};
 async function account(email='commander@example.test',name='Commander'){const signup=await call('/api/auth/sign-up/email',{name,email,password:'test-password-for-fr010',callbackURL:base+'/'});assert.ok(signup.r.ok,signup.value?.error||JSON.stringify(signup.value));assert.equal(mail.at(-1).kind,'verify');const verified=await worker.fetch(new Request(mail.at(-1).url,{headers:{Origin:base}}),env);assert.ok([200,302].includes(verified.status));const cookie=verified.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');assert.ok(cookie);const session=await call('/api/player/session',null,cookie);assert.ok(session.value.user);return {cookie,user:session.value.user};}
 return {db,env,mail,call,account};
}
test('FR010 real Better Auth verification, session, logout and invalid origin',async()=>{
 const f=fixture();try{const a=await f.account();assert.equal((await f.call('/api/player/session')).value.user,null);assert.equal((await f.call('/api/player/profile',null,a.cookie)).r.status,200);await f.call('/api/auth/sign-out',{},a.cookie);assert.equal((await f.call('/api/player/profile',null,a.cookie)).r.status,401);const r=await worker.fetch(new Request(base+'/api/player/profile',{headers:{Origin:'https://untrusted.example'}}),f.env);assert.equal(r.status,403);}finally{f.db.sqlite.close();}
});
test('FR010 reset email uses expiring Better Auth token and password can actually change',async()=>{
 const f=fixture();try{await f.account();const requested=await f.call('/api/auth/request-password-reset',{email:'commander@example.test',redirectTo:base+'/?reset=1'});assert.ok(requested.r.ok);assert.equal(f.mail.at(-1).kind,'reset');const link=await worker.fetch(new Request(f.mail.at(-1).url),f.env);const token=new URL(link.headers.get('location'),base).searchParams.get('token');assert.ok(token);const reset=await f.call('/api/auth/reset-password',{token,newPassword:'new-password-for-fr010'});assert.ok(reset.r.ok,JSON.stringify(reset.value));const login=await f.call('/api/auth/sign-in/email',{email:'commander@example.test',password:'new-password-for-fr010'});assert.ok(login.r.ok);const repeat=await f.call('/api/auth/reset-password',{token,newPassword:'another-password-for-fr010'});assert.ok(!repeat.r.ok);}finally{f.db.sqlite.close();}
});
test('FR010 Guest creates no account runs and cannot buy or submit commands',async()=>{
 const f=fixture();try{for(const path of ['/api/player/runs','/api/player/purchase'])assert.equal((await f.call(path,{})).r.status,401);assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) n FROM fr010_runs').get().n,0);}finally{f.db.sqlite.close();}
});
test('FR010 purchases, equip and reset use real transaction balances and idempotency',async()=>{
 const f=fixture();try{const a=await f.account();await f.call('/api/player/profile',null,a.cookie);f.db.sqlite.prepare('UPDATE fr010_profiles SET balance=100 WHERE user_id=?').run(a.user.id);
 const request={requestId:crypto.randomUUID(),revision:0,skill:'deep-refit'},one=await f.call('/api/player/purchase',request,a.cookie);assert.equal(one.value.balance,95);assert.equal(one.value.skills['deep-refit'],1);const again=await f.call('/api/player/purchase',request,a.cookie);assert.equal(again.value.balance,95);
 const old=await f.call('/api/player/purchase',{...request,requestId:crypto.randomUUID()},a.cookie);assert.equal(old.r.status,409);
 const equip=await f.call('/api/player/equip',{requestId:crypto.randomUUID(),revision:1,equipped:['deep-refit']},a.cookie);assert.deepEqual(equip.value.equipped,['deep-refit']);
 const reset={requestId:crypto.randomUUID(),revision:2},done=await f.call('/api/player/reset',reset,a.cookie);assert.equal(done.value.balance,100);assert.deepEqual(done.value.skills,{});assert.equal((await f.call('/api/player/reset',reset,a.cookie)).value.balance,100);
 }finally{f.db.sqlite.close();}
});
test('FR010 concurrent purchases cannot spend the same balance twice',async()=>{
 const f=fixture();try{const a=await f.account();f.db.sqlite.prepare('UPDATE fr010_profiles SET balance=5 WHERE user_id=?').run(a.user.id);const answers=await Promise.all(['deep-refit','quartermaster'].map(skill=>f.call('/api/player/purchase',{requestId:crypto.randomUUID(),revision:0,skill},a.cookie)));assert.equal(answers.filter(x=>x.r.ok).length,1);const p=(await f.call('/api/player/profile',null,a.cookie)).value;assert.equal(p.balance,0);assert.equal(Object.keys(p.skills).length,1);}finally{f.db.sqlite.close();}
});
test('FR010 account runs cannot be stolen; canonical replay ignores forged client score',async()=>{
 const f=fixture();try{const a=await f.account(),b=await f.account('other@example.test','Other');const start=await f.call('/api/player/runs',{factionId:'crown'},a.cookie);assert.equal(start.r.status,201);const run=start.value.run,g=restoreRun(currentFactionData('crown'),run.snapshot);for(const[x,z]of [[18,18],[17,18],[19,18],[18,17],[18,19]])g.place(x,z);g.keep();g.startCombat();g.advanceTicks(600,{record:true});const body={batchId:crypto.randomUUID(),sequence:0,commands:g.journal,score:'999999999999'};assert.equal((await f.call(`/api/player/runs/${run.id}/commands`,body,b.cookie)).r.status,404);
 const saved=await f.call(`/api/player/runs/${run.id}/commands`,body,a.cookie);assert.equal(saved.r.status,200,JSON.stringify(saved.value));assert.equal(saved.value.sequence,1);assert.notEqual(saved.value.score,body.score);const repeat=await f.call(`/api/player/runs/${run.id}/commands`,body,a.cookie);assert.equal(repeat.value.sequence,1);assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) n FROM fr010_batches').get().n,1);
 assert.equal((await f.call('/api/player/runs',{factionId:'grove'},a.cookie)).r.status,409);const active=(await f.call('/api/player/active',null,a.cookie)).value;assert.equal(active.run.id,run.id);
 }finally{f.db.sqlite.close();}
});
test('FR010 client commands cannot inject a lineup, award medals or skip combat',async()=>{
 const f=fixture();try{const a=await f.account(),run=(await f.call('/api/player/runs',{factionId:'forge'},a.cookie)).value.run;for(const commands of [[{action:'completeWave',args:[]}],[{action:'place',args:[{family:'dw_worldanvil'}]}],[{action:'advance',ticks:100000}]]){const r=await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:0,commands},a.cookie);assert.ok(!r.r.ok);}assert.equal((await f.call('/api/player/profile',null,a.cookie)).value.balance,0);assert.equal((await f.call('/api/player/active',null,a.cookie)).value.run.sequence,0);}finally{f.db.sqlite.close();}
});
test('FR010 migrations are repeatable and preserve Legacy records',()=>{
 const f=fixture();try{f.db.sqlite.prepare("INSERT INTO runs(id,token_hash,version,mode,seed,started_at,updated_at,name) VALUES ('legacy','hash','0.6.12',50,'42',1,1,'Legacy commander')").run();migrateFr010(f.db);assert.equal(f.db.sqlite.prepare('SELECT name FROM runs WHERE id=?').get('legacy').name,'Legacy commander');}finally{f.db.sqlite.close();}
});
test('FR010 Better Auth also uses the D1-compatible adapter without a native SQLite handle',async()=>{
 const f=fixture();try{f.env.DB={prepare:f.db.prepare,batch:f.db.batch};const a=await f.account('d1@example.test','D1 Commander');assert.equal((await f.call('/api/player/profile',null,a.cookie)).r.status,200);}finally{f.db.sqlite.close();}
});

test('FR010 replayed boss kill and tenth flawless wave require individual manual claims',async()=>{
 const f=fixture();try{const a=await f.account(),run=(await f.call('/api/player/runs',{factionId:'crown'},a.cookie)).value.run,g=restoreRun(currentFactionData('crown'),run.snapshot);
 for(const [x,z]of [[18,18],[17,18],[19,18],[18,17],[18,19]])g.place(x,z);g.keep();g.round=10;g.startCombat();g.progress.streak=9;g.progress.streakBest=9;g.combat.spawnQueue=[];const e=g.combat.spawn('host_10');Object.assign(e,{x:18,z:18,hp:1,maxHp:1,armor:0,evasion:0,shields:0,krakenShell:0,speed:0});g.journal=[];
 // A canonical checkpoint is the server-side fixture; submitted commands cannot set it.
 f.db.sqlite.prepare('UPDATE fr010_runs SET snapshot_json=? WHERE id=?').run(JSON.stringify(serializeRun(g)),run.id);
 let sequence=0,earned;for(let i=0;i<10;i++){g.advanceTicks(60,{record:true});const b={batchId:crypto.randomUUID(),sequence,commands:g.journal.splice(0)};const r=await f.call(`/api/player/runs/${run.id}/commands`,b,a.cookie);assert.equal(r.r.status,200,JSON.stringify(r.value));sequence=r.value.sequence;if(r.value.profile.eligible.length===2){earned={b,r};break;}}
 assert.ok(earned,'Boss must be defeated by ordinary combat');assert.equal(earned.r.value.profile.balance,0);assert.deepEqual(earned.r.value.profile.eligible.map(g=>g.reward).sort(),[1,2]);assert.equal(earned.r.value.profile.grants.length,0);let p=earned.r.value.profile;for(const g of p.eligible){p=(await f.call('/api/player/achievements/claim',{requestId:crypto.randomUUID(),revision:p.revision,achievementId:g.id},a.cookie)).value;}assert.equal(p.balance,3);const repeat=await f.call(`/api/player/runs/${run.id}/commands`,earned.b,a.cookie);assert.equal(repeat.value.profile.balance,3);assert.equal(f.db.sqlite.prepare("SELECT COUNT(*) n FROM fr010_ledger WHERE kind='achievement'").get().n,2);
 }finally{f.db.sqlite.close();}
});

test('FR010 two devices cannot append different commands at the same sequence',async()=>{
 const f=fixture();try{const a=await f.account(),run=(await f.call('/api/player/runs',{factionId:'grove'},a.cookie)).value.run;const answers=await Promise.all([[18,18],[17,18]].map(args=>f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:0,commands:[{action:'place',args}]},a.cookie)));assert.equal(answers.filter(x=>x.r.status===200).length,1);assert.equal(answers.filter(x=>x.r.status===409).length,1);assert.equal((await f.call('/api/player/active',null,a.cookie)).value.run.sequence,1);
 }finally{f.db.sqlite.close();}
});

test('FR010 invalid four-slot equipment has a useful error and cannot alter the wallet',async()=>{
 const f=fixture();try{const a=await f.account();f.db.sqlite.prepare('UPDATE fr010_profiles SET skills_json=? WHERE user_id=?').run(JSON.stringify({'deep-refit':1,'recruitment-focus':1,'field-logistics':1,quartermaster:1}),a.user.id);const r=await f.call('/api/player/equip',{revision:0,requestId:crypto.randomUUID(),equipped:['deep-refit','recruitment-focus','field-logistics','quartermaster']},a.cookie);assert.equal(r.r.status,400);assert.match(r.value.error,/three/);assert.equal((await f.call('/api/player/profile',null,a.cookie)).value.revision,0);
 }finally{f.db.sqlite.close();}
});

test('FR010 Hall sorts exact large scores and records upgrade loadouts in one competition',async()=>{
 const f=fixture();try{const a=await f.account();for(const score of ['9007199254740993','1000000000000000000','99999999999999999']){const id=crypto.randomUUID();f.db.sqlite.prepare("INSERT INTO fr010_runs(id,user_id,faction_id,ruleset,seed,snapshot_json,loadout_json,started_at,updated_at,finished_at,outcome,score_text,score_digits,highest_wave) VALUES (?,?,'forge','fr010-v1',1,'{}',?,1,1,1,'lost',?,?,70)").run(id,a.user.id,JSON.stringify(score.length===19?{'blood-wrath':3}:{}),score,score.length);}const hall=(await f.call('/api/player/hall?faction=forge',null,a.cookie)).value;assert.deepEqual(hall.top.map(r=>r.score),['1000000000000000000','99999999999999999','9007199254740993']);assert.equal(hall.own.rank,1);assert.equal(hall.top[0].loadout['blood-wrath'],3);assert.equal((await f.call('/api/player/hall?faction=crown')).value.top.length,0);
 }finally{f.db.sqlite.close();}
});

test('FR010 Google starts a real state-protected flow with basic identity scopes only',async()=>{
 const f=fixture();try{Object.assign(f.env,{GOOGLE_CLIENT_ID:'isolated-test-client',GOOGLE_CLIENT_SECRET:'isolated-test-secret'});const result=await f.call('/api/auth/sign-in/social',{provider:'google',callbackURL:base+'/play/',disableRedirect:true});assert.equal(result.r.status,200,JSON.stringify(result.value));const url=new URL(result.value.url);assert.equal(url.hostname,'accounts.google.com');assert.equal(url.searchParams.get('redirect_uri'),base+'/api/auth/callback/google');assert.ok(url.searchParams.get('state'));assert.ok(url.searchParams.get('code_challenge'));assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.ok(result.r.headers.getSetCookie().length);const scopes=url.searchParams.get('scope').split(' ');assert.deepEqual(scopes.sort(),['email','openid','profile']);const forged=await f.call('/api/auth/callback/google?state=forged&code=forged');assert.ok(forged.r.status>=300);assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) n FROM user').get().n,0);const session=(await f.call('/api/player/session')).value;assert.deepEqual(session.auth,{providers:['google'],emailPassword:true});
 }finally{f.db.sqlite.close();}
});

test('FR010 Facebook starts a state-protected flow requesting only basic identity',async()=>{
 const f=fixture();try{Object.assign(f.env,{FACEBOOK_CLIENT_ID:'isolated-facebook-client',FACEBOOK_CLIENT_SECRET:'isolated-facebook-secret'});const result=await f.call('/api/auth/sign-in/social',{provider:'facebook',callbackURL:base+'/play/',disableRedirect:true});assert.equal(result.r.status,200,JSON.stringify(result.value));const url=new URL(result.value.url);assert.equal(url.hostname,'www.facebook.com');assert.equal(url.searchParams.get('redirect_uri'),base+'/api/auth/callback/facebook');assert.ok(url.searchParams.get('state'));assert.deepEqual(url.searchParams.get('scope').split(' ').sort(),['email','public_profile']);assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) n FROM user').get().n,0);}finally{f.db.sqlite.close();}
});

test('FR010 Facebook identity cannot access progress until email ownership is verified',async()=>{
 const f=fixture(),originalFetch=globalThis.fetch;try{
  Object.assign(f.env,{FACEBOOK_CLIENT_ID:'isolated-facebook-client',FACEBOOK_CLIENT_SECRET:'isolated-facebook-secret'});
  globalThis.fetch=async input=>{const url=new URL(String(input?.url||input));if(url.hostname==='graph.facebook.com'&&url.pathname==='/debug_token')return Response.json({data:{is_valid:true,app_id:f.env.FACEBOOK_CLIENT_ID,user_id:'isolated-facebook-subject'}});if(url.hostname==='graph.facebook.com'&&url.pathname==='/me')return Response.json({id:'isolated-facebook-subject',name:'Lina Example',email:'facebook@example.test',picture:{data:{url:'https://example.test/avatar'}}});throw Error('Unexpected provider request: '+url.origin+url.pathname);};
  const login=await f.call('/api/auth/sign-in/social',{provider:'facebook',callbackURL:base+'/play/',idToken:{token:'isolated-facebook-token',accessToken:'isolated-facebook-token'}});
  assert.equal(f.mail.at(-1)?.kind,'verify',JSON.stringify(login.value));
  const row=f.db.sqlite.prepare('SELECT emailVerified FROM user WHERE email=?').get('facebook@example.test');assert.equal(row.emailVerified,0);
  const cookie=login.r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');assert.equal((await f.call('/api/player/profile',null,cookie)).r.status,401);
  const verified=await worker.fetch(new Request(f.mail.at(-1).url,{headers:{Origin:base}}),f.env);const verifiedCookie=verified.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');assert.equal((await f.call('/api/player/session',null,verifiedCookie)).value.user.name,'Lina');assert.equal((await f.call('/api/player/profile',null,verifiedCookie)).r.status,200);
 }finally{globalThis.fetch=originalFetch;f.db.sqlite.close();}
});

test('FR010 player nickname updates preserve progress and account deletion removes only that owner',async()=>{
 const f=fixture();try{const a=await f.account(),b=await f.account('other-delete@example.test','Other');for(const account of [a,b])await f.call('/api/player/runs',{factionId:'crown'},account.cookie);const renamed=await f.call('/api/player/nickname',{name:'New Nick'},a.cookie);assert.equal(renamed.r.status,200);assert.equal((await f.call('/api/player/session',null,a.cookie)).value.user.name,'New Nick');assert.ok((await f.call('/api/player/active',null,a.cookie)).value.run);
 assert.equal((await f.call('/api/player/delete-account',{confirmation:'wrong'},a.cookie)).r.status,400);assert.equal((await f.call('/api/player/delete-account',{confirmation:'DELETE'},a.cookie)).r.status,200);assert.equal((await f.call('/api/player/profile',null,a.cookie)).r.status,401);assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) n FROM fr010_runs WHERE user_id=?').get(a.user.id).n,0);assert.ok((await f.call('/api/player/active',null,b.cookie)).value.run);assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) n FROM user WHERE id=?').get(b.user.id).n,1);
 }finally{f.db.sqlite.close();}
});

test('FR010 Apple callback origin exception cannot authorize account mutations',async()=>{
 const f=fixture();try{const r=await worker.fetch(new Request(base+'/api/player/runs',{method:'POST',headers:{Origin:'https://appleid.apple.com','Content-Type':'application/json'},body:JSON.stringify({factionId:'crown'})}),f.env);assert.equal(r.status,403);}finally{f.db.sqlite.close();}
});

test('FR010 verified Google identity provisions once and restores the same cloud run without a game password',async()=>{
 const f=fixture(),originalFetch=globalThis.fetch;try{
  Object.assign(f.env,{GOOGLE_CLIENT_ID:'isolated-sso-client',GOOGLE_CLIENT_SECRET:'isolated-sso-secret'});const {publicKey,privateKey}=await generateKeyPair('RS256'),jwk={...await exportJWK(publicKey),kid:'isolated-sso-key',alg:'RS256',use:'sig'};
  globalThis.fetch=async input=>{const url=String(input?.url||input);assert.match(url,/^https:\/\/www.googleapis.com\/oauth2\/v3\/certs/);return Response.json({keys:[jwk]});};
  const token=await new SignJWT({sub:'isolated-google-subject',email:'sso@example.test',email_verified:true,name:'Lina Example',given_name:'Lina',nonce:'isolated-nonce'}).setProtectedHeader({alg:'RS256',kid:jwk.kid}).setIssuer('https://accounts.google.com').setAudience(f.env.GOOGLE_CLIENT_ID).setIssuedAt().setExpirationTime('1h').sign(privateKey);
  const login=async()=>f.call('/api/auth/sign-in/social',{provider:'google',callbackURL:base+'/play/',idToken:{token,nonce:'isolated-nonce'}});
  const first=await login();assert.equal(first.r.status,200,JSON.stringify(first.value));const cookie=first.r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; '),identity=(await f.call('/api/player/session',null,cookie)).value;assert.equal(identity.user.name,'Lina');assert.equal(identity.user.email,'sso@example.test');
  const run=(await f.call('/api/player/runs',{factionId:'grove'},cookie)).value.run;assert.equal((await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:0,commands:[{action:'place',args:[18,18]}]},cookie)).r.status,200);
  await f.call('/api/player/nickname',{name:'Lina Commander'},cookie);await f.call('/api/auth/sign-out',{},cookie);const second=await login();assert.equal(second.r.status,200,JSON.stringify(second.value));const nextCookie=second.r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');assert.equal((await f.call('/api/player/session',null,nextCookie)).value.user.id,identity.user.id);assert.equal((await f.call('/api/player/session',null,nextCookie)).value.user.name,'Lina Commander');const restored=(await f.call('/api/player/active',null,nextCookie)).value.run;assert.equal(restored.id,run.id);assert.equal(restored.sequence,1);assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) n FROM user').get().n,1);assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) n FROM account WHERE password IS NOT NULL').get().n,0);
  assert.equal((await f.call('/api/auth/sign-in/social',{provider:'google',idToken:{token,nonce:'wrong-nonce'}})).r.status,401);
 }finally{globalThis.fetch=originalFetch;f.db.sqlite.close();}
});
