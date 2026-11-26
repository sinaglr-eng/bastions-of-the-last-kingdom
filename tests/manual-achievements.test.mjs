import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import worker from '../backend/worker.js';
import {sqliteDatabase} from '../backend/sqlite-adapter.js';
import {migrateFr010} from '../backend/migrate-fr010.js';
import {restoreRun,serializeRun} from '../game/core/run-state.js';
import {currentFactionData} from '../game/core/current-data.js';
import {currentSeason,seasonWindow} from '../game/core/seasons.js';
import {achievementCatalog} from '../game/core/achievements.js';

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
const claim=(id,revision=0,requestId=crypto.randomUUID())=>({achievementId:id,revision,requestId,achievementSeason:currentSeason()});
const seed=(f,user,id='champion:crown:frostblade',reward=1)=>f.db.sqlite.prepare('INSERT INTO fr010_eligible VALUES(?,?,?,?,?,NULL)').run(user,id,id.split(':')[1],reward,1);
test('Manual claim is authenticated, server-priced and idempotent across request identities',async()=>{
 const f=fixture();try{const a=await f.account();seed(f,a.user.id);const b=claim('champion:crown:frostblade');
 assert.equal((await f.call('/api/player/achievements/claim',b)).r.status,401);
 const first=await f.call('/api/player/achievements/claim',{...b,reward:999999},a.cookie);assert.equal(first.r.status,200,JSON.stringify(first.value));assert.equal(first.value.balance,1);assert.equal(first.value.grants.length,1);
 assert.equal((await f.call('/api/player/achievements/claim',b,a.cookie)).value.balance,1);
 assert.equal((await f.call('/api/player/achievements/claim',claim(b.achievementId),a.cookie)).value.balance,1);
 assert.equal(f.db.sqlite.prepare("SELECT COUNT(*) n FROM fr010_ledger WHERE kind='achievement'").get().n,1);
 assert.equal((await f.call('/api/player/achievements/claim',{...b,achievementId:'boss:crown:host_10'},a.cookie)).r.status,409);
 }finally{f.db.sqlite.close();}
});
test('Unverified achievements and another account eligibility cannot be claimed',async()=>{
 const f=fixture();try{const a=await f.account(),b=await f.account('other-claim@example.test','Other');seed(f,a.user.id);
 for(const [id,cookie]of [['boss:crown:host_10',a.cookie],['champion:crown:frostblade',b.cookie]])assert.equal((await f.call('/api/player/achievements/claim',claim(id),cookie)).r.status,409);
 assert.equal((await f.call('/api/player/profile',null,a.cookie)).value.balance,0);
 }finally{f.db.sqlite.close();}
});

test('5,300 verified kills unlock one seasonal claim at a time and pay each tier once',async t=>{
 const f=fixture();t.after(()=>f.db.sqlite.close());
 const {user,cookie}=await f.account();
 // Seed authoritative replay summaries for two factions; the claim carries no kill evidence.
 const now=Date.now(),run=f.db.sqlite.prepare(`INSERT INTO fr010_runs
  (id,user_id,faction_id,ruleset,seed,snapshot_json,loadout_json,started_at,updated_at,finished_at,outcome,progress_json)
  VALUES(?,?,?,?,1,'{}','{}',?,?,?,'lost',?)`);
 for(const [faction,kills] of [['crown',2300],['grove',3000]]){
   run.run(crypto.randomUUID(),user.id,faction,currentFactionData(faction).rulesetRevision,now,now,now,JSON.stringify({kills}));
 }
 const getProfile=async()=>{
   const {r,value}=await f.call('/api/player/profile',null,cookie);
   assert.equal(r.status,200,JSON.stringify(value));return value;
 };
 const submit=body=>f.call('/api/player/achievements/claim',body,cookie);
 const killRows=rows=>rows.filter(row=>row.id.startsWith('kills:global:'));
 let profile=await getProfile();
 const season=profile.achievementSeason,oldSeason=currentSeason(seasonWindow(season).start-1);
 const request=target=>({...claim('kills:global:'+target,profile.revision),achievementSeason:season});
 const stale=await submit({...request(100),achievementSeason:oldSeason});
 assert.equal(stale.r.status,409);assert.match(stale.value.error,/season/i);
 const skipped=await submit(request(5000));
 assert.equal(skipped.r.status,409);
 const medalsBefore=profile.balance,xpBefore=profile.xpTotal;
 let medals=0,xp=0;
 for(const [target,reward,experience] of [[100,1,2],[1000,2,4],[5000,3,6]]){
   const id='kills:global:'+target;
   assert.equal(profile.seasonalKills.total,5300);
   assert.equal(profile.seasonalKills.nextTarget,target);
   assert.deepEqual(killRows(profile.eligible).map(row=>row.id),[id]);
   assert.deepEqual(killRows(achievementCatalog(currentFactionData('crown'),profile)).map(row=>row.id),[id]);
   const body=request(target);
   const paid=await submit(body);assert.equal(paid.r.status,200,JSON.stringify(paid.value));
   medals+=reward;xp+=experience;
   for(const receipt of [paid,await submit(body),await submit(request(target))]){
     assert.equal(receipt.r.status,200,JSON.stringify(receipt.value));
     assert.equal(receipt.value.claimReceipt.receiptId,paid.value.claimReceipt.receiptId);
     assert.equal(receipt.value.claimReceipt.amount,experience);
     assert.equal(receipt.value.balance,medalsBefore+medals);assert.equal(receipt.value.xpTotal,xpBefore+xp);
   }
   profile=await getProfile();
 }
 assert.equal(profile.seasonalKills.nextTarget,10000);
 assert.deepEqual(killRows(profile.eligible),[]);
 assert.deepEqual(killRows(achievementCatalog(currentFactionData('crown'),profile)).map(row=>row.id),['kills:global:10000']);
 assert.equal(killRows(profile.grants).length,3);
 assert.equal((await submit(request(10000))).r.status,409);
 assert.equal(f.db.sqlite.prepare("SELECT SUM(amount) AS medals FROM fr010_ledger WHERE user_id=? AND kind='achievement'").get(user.id).medals,6);
});
test('Concurrent claims from two devices pay a verified achievement once',async()=>{
 const f=fixture();try{const a=await f.account();seed(f,a.user.id);const answers=await Promise.all([1,2].map(()=>f.call('/api/player/achievements/claim',claim('champion:crown:frostblade'),a.cookie)));
 assert.ok(answers.some(r=>r.r.ok));const p=(await f.call('/api/player/profile',null,a.cookie)).value;assert.equal(p.balance,1);assert.equal(p.grants.length,1);assert.equal(f.db.sqlite.prepare("SELECT SUM(amount) n FROM fr010_ledger WHERE kind='achievement'").get().n,1);
 }finally{f.db.sqlite.close();}
});
test('Claim and purchase serialize against one revision without lost or negative funds',async()=>{
 const f=fixture();try{const a=await f.account();seed(f,a.user.id,'boss:crown:host_10',2);f.db.sqlite.prepare('UPDATE fr010_profiles SET balance=5 WHERE user_id=?').run(a.user.id);
 await Promise.all([f.call('/api/player/achievements/claim',claim('boss:crown:host_10'),a.cookie),f.call('/api/player/purchase',{revision:0,requestId:crypto.randomUUID(),skill:'morale-boost'},a.cookie)]);
 const p=(await f.call('/api/player/profile',null,a.cookie)).value;assert.equal(p.balance,5+(p.grants.length?2:0)-(p.skills['morale-boost']?5:0));assert.ok(p.balance>=0);
 }finally{f.db.sqlite.close();}
});
test('Migration treats previously paid grants as claimed, preserving wallet and timestamps on repeat',async()=>{
 const f=fixture();try{const a=await f.account();f.db.sqlite.prepare('UPDATE fr010_profiles SET balance=17 WHERE user_id=?').run(a.user.id);f.db.sqlite.prepare('INSERT INTO fr010_grants VALUES(?,?,?,?,?)').run(a.user.id,'boss:crown:host_10','crown',2,1234);
 f.db.sqlite.exec("DROP TABLE fr010_eligible;DELETE FROM game_schema_migrations WHERE name='0002_manual_achievements.sql'");migrateFr010(f.db);migrateFr010(f.db);
 const p=(await f.call('/api/player/profile',null,a.cookie)).value;assert.equal(p.balance,17);assert.equal(p.grants[0].id,'boss:global:host_10');assert.equal(p.grants[0].factionId,null);assert.equal(p.grants[0].createdAt,1234);assert.equal(p.eligible.length,0);assert.equal(f.db.sqlite.prepare('SELECT verified_at FROM fr010_eligible WHERE user_id=? AND achievement_id=?').get(a.user.id,'boss:crown:host_10').verified_at,1234);assert.equal((await f.call('/api/player/achievements/claim',claim(p.grants[0].id),a.cookie)).value.balance,17);
 }finally{f.db.sqlite.close();}
});
test('Verified discoveries feed new game secrecy and collections before rewards are claimed',async()=>{
 const f=fixture();try{const a=await f.account();seed(f,a.user.id,'champion:crown:ladyclaire');const created=await f.call('/api/player/runs',{factionId:'crown'},a.cookie),g=restoreRun(currentFactionData('crown'),created.value.run.snapshot);
 assert.ok(g.discoveries.has('ladyclaire'));assert.equal((await f.call('/api/player/profile',null,a.cookie)).value.balance,0);
 await f.call('/api/player/reset',{requestId:crypto.randomUUID(),revision:0},a.cookie);assert.equal((await f.call('/api/player/profile',null,a.cookie)).value.eligible.length,1);
 }finally{f.db.sqlite.close();}
});
test('Claim eligibility survives loss and replacement; account deletion clears it only for its owner',async()=>{
 const f=fixture();try{const a=await f.account(),b=await f.account('preserve@example.test','Preserve');seed(f,a.user.id);seed(f,b.user.id);
 await f.call('/api/player/runs',{factionId:'crown'},a.cookie);await f.call('/api/player/runs',{factionId:'forge',replace:true},a.cookie);assert.equal((await f.call('/api/player/profile',null,a.cookie)).value.eligible.length,1);
 assert.equal((await f.call('/api/player/delete-account',{confirmation:'DELETE'},a.cookie)).r.status,200);assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) n FROM fr010_eligible WHERE user_id=?').get(a.user.id).n,0);assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) n FROM fr010_eligible WHERE user_id=?').get(b.user.id).n,1);
 }finally{f.db.sqlite.close();}
});
test('All-faction Hall includes real podium and exact own-neighbor gap without changing run ranking',async()=>{
 const f=fixture();try{const a=await f.account(),b=await f.account('higher@example.test','Higher');
 for(const [uid,faction,score]of [[b.user.id,'grove','9007199254740995'],[a.user.id,'crown','9007199254740993']])f.db.sqlite.prepare("INSERT INTO fr010_runs(id,user_id,faction_id,ruleset,seed,snapshot_json,loadout_json,started_at,updated_at,finished_at,outcome,score_text,score_digits,highest_wave) VALUES(?,?,?,'fr010-v1',1,'{}','{}',1,1,1,'lost',?,?,63)").run(crypto.randomUUID(),uid,faction,score,score.length);
 const hall=(await f.call('/api/player/hall?faction=all&view=own',null,a.cookie)).value;assert.equal(hall.total,2);assert.equal(hall.podium.length,2);assert.equal(hall.own.rank,2);assert.equal(hall.gap,'2');assert.equal(hall.next.name,'Higher');
 }finally{f.db.sqlite.close();}
});
