import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../backend/worker.js';
import {sqliteDatabase} from '../backend/sqlite-adapter.js';
import {migrateFr010} from '../backend/migrate-fr010.js';
import {currentFactionData} from '../game/core/current-data.js';
import {replayCommands} from '../game/core/run-journal.js';
import {serializeRun,restoreRun} from '../game/core/run-state.js';
test('FR011 actual authenticated Worker replay grants a boss chest once and freezes only new-client equipment',async()=>{
 const db=sqliteDatabase();db.sqlite.exec(fs.readFileSync('backend/migrations/0000_statistics.sql','utf8'));migrateFr010(db);const base='http://127.0.0.1:4174',mail=[],env={DB:db,AUTH_SECRET:'isolated-fr011-test-secret-at-least-32-characters',AUTH_BASE_URL:base,GAME_ORIGINS:base,AUTH_MAIL_MODE:'local',AUTH_LOCAL_MAIL:async m=>mail.push(m)};
 let cookie='';const call=async(path,body)=>{const r=await worker.fetch(new Request(base+path,{method:body?'POST':'GET',headers:{Origin:base,'CF-Connecting-IP':'192.0.2.211',Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:r.status,value:await r.json()};};
 try{
  assert.equal((await call('/api/player/artifacts')).status,401);await call('/api/auth/sign-up/email',{name:'Vault test',email:'fr011-api@example.test',password:'local-test-fr011-password',callbackURL:base+'/'});const verified=await worker.fetch(new Request(mail.at(-1).url,{headers:{Origin:base,'CF-Connecting-IP':'192.0.2.211'}}),env);cookie=verified.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');const session=(await call('/api/player/session')).value,user=session.user.id;
  db.sqlite.prepare("UPDATE artifact_accounts SET owned_json='[\"N-01\"]',equipment_json='{\"weapon\":\"N-01\"}' WHERE user_id=?").run(user);
  let created=await call('/api/player/runs',{factionId:'crown'});assert.equal(created.status,201);assert.deepEqual(created.value.run.snapshot.artifactEquipment,{});
  created=await call('/api/player/runs',{factionId:'crown',artifactVersion:1,commanderRulesVersion:2,replace:true});assert.equal(created.status,201);const run=created.value.run;assert.deepEqual(run.snapshot.artifactEquipment,{weapon:'N-01'});
  db.sqlite.prepare("UPDATE artifact_accounts SET equipment_json='{}' WHERE user_id=?").run(user);
  const g=restoreRun(currentFactionData('crown'),run.snapshot);for(const [x,z]of [[18,18],[17,18],[19,18],[18,17],[18,19]])g.place(x,z);g.keep();g.startCombat();g.round=10;g.completedWaves=9;g.combat.spawnQueue=[];const t=g.towers.find(t=>t.state==='active'),boss=g.combat.spawn('host_10');Object.assign(boss,{hp:1,maxHp:1,x:t.x+1,z:t.z,speed:0,physicalImmune:false,magicImmune:false,armor:0});g.journal=[];db.sqlite.prepare('UPDATE fr010_runs SET snapshot_json=? WHERE id=?').run(JSON.stringify(serializeRun(g)),run.id);
  g.advanceTicks(600,{record:true});
  const batch={batchId:crypto.randomUUID(),sequence:0,commands:g.journal},result=await call(`/api/player/runs/${run.id}/commands`,batch);assert.equal(result.status,200,JSON.stringify(result.value));const vault=result.value.profile.artifacts;assert.equal(vault.chests.length,1);assert.equal(vault.chests[0].status,'ready');assert.equal(vault.highestTier,1);assert.equal(result.value.profile.balance,session.profile.balance);
  const retry=await call(`/api/player/runs/${run.id}/commands`,batch);assert.equal(retry.status,200);assert.equal(retry.value.profile.artifacts.chests.length,1);const active=(await call('/api/player/active')).value.run;assert.deepEqual(active.snapshot.artifactEquipment,{weapon:'N-01'});
  const open={requestId:crypto.randomUUID(),revision:0,tier:1,count:1},opened=await call('/api/player/artifacts/open',open);assert.equal(opened.status,200,JSON.stringify(opened.value));const repeated=await call('/api/player/artifacts/open',open);assert.deepEqual(opened.value.receipt,repeated.value.receipt);assert.equal(opened.value.artifacts.revision,repeated.value.artifacts.revision);
 }finally{db.sqlite.close();}
});
