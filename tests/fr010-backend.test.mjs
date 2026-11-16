import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {IDBFactory} from 'fake-indexeddb';
import {RunStore} from '../game/run-store.js';
import {PlayerClient} from '../game/player-client.js';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import worker from '../backend/worker.js';
import {sqliteDatabase} from '../backend/sqlite-adapter.js';
import {migrateFr010} from '../backend/migrate-fr010.js';
import {restoreRun,serializeRun} from '../game/core/run-state.js';
import {currentFactionData} from '../game/core/current-data.js';
import {Game} from '../game/core/game.js';
import {combatTowerStats,towerStats} from '../game/core/math.js';
import {factionCollectionAchievements} from '../game/core/faction-achievements.js';
import {recipeFamily} from '../game/core/recipes.js';

const base='http://127.0.0.1:4174';
test('new Commander skill purchases enforce each account gate, sequential costs and idempotency',async()=>{
 const gates={'field-promotion':[200,410,850],'decisive-strike':[330,720,1000],'fortified-keep':[20,150,500],'extended-range':[150,410,720]},f=fixture();try{
  const a=await f.account();f.db.sqlite.prepare('UPDATE fr010_profiles SET balance=500 WHERE user_id=?').run(a.user.id);
  for(const[skill,thresholds]of Object.entries(gates))for(let level=1;level<=3;level++){
   f.db.sqlite.prepare('UPDATE account_progression SET xp_total=? WHERE user_id=?').run(thresholds[level-1]-1,a.user.id);
   const before=(await f.call('/api/player/profile',null,a.cookie)).value,denied=await f.call('/api/player/purchase',{requestId:crypto.randomUUID(),revision:before.revision,skill,rank:3},a.cookie);
   assert.equal(denied.r.status,400,skill+' below rank '+level);assert.equal((await f.call('/api/player/profile',null,a.cookie)).value.balance,before.balance);
   f.db.sqlite.prepare('UPDATE account_progression SET xp_total=? WHERE user_id=?').run(thresholds[level-1],a.user.id);
   const request={requestId:crypto.randomUUID(),revision:before.revision,skill,rank:3},paid=await f.call('/api/player/purchase',request,a.cookie);
   assert.equal(paid.r.status,200,JSON.stringify(paid.value));assert.equal(paid.value.skills[skill],level);assert.equal(paid.value.balance,before.balance-[5,10,20][level-1]);
   const retry=await f.call('/api/player/purchase',request,a.cookie);assert.equal(retry.value.balance,paid.value.balance);assert.equal(retry.value.skills[skill],level);
  }
 }finally{f.db.sqlite.close();}
});

test('verified command replay uses the run frozen loadout after profile changes and ignores client health claims',async()=>{
 const f=fixture();try{
  const a=await f.account();f.db.sqlite.prepare('UPDATE account_progression SET xp_total=1000 WHERE user_id=?').run(a.user.id);
  f.db.sqlite.prepare('UPDATE fr010_profiles SET skills_json=?,equipped_json=? WHERE user_id=?').run('{"fortified-keep":1}','["fortified-keep"]',a.user.id);
  const created=await f.call('/api/player/runs',{factionId:'crown'},a.cookie);assert.equal(created.r.status,201,JSON.stringify(created.value));const run=created.value.run;
  assert.deepEqual(run.snapshot.loadout,{'fortified-keep':1});assert.equal(restoreRun(currentFactionData('crown'),run.snapshot).lives,35);
  f.db.sqlite.prepare('UPDATE fr010_profiles SET skills_json=?,equipped_json=? WHERE user_id=?').run('{"fortified-keep":3}','["fortified-keep"]',a.user.id);
  const request={batchId:crypto.randomUUID(),sequence:0,commands:[{action:'place',args:[18,18]}],loadout:{'fortified-keep':3},maxLives:45,health:45},saved=await f.call(`/api/player/runs/${run.id}/commands`,request,a.cookie);
  assert.equal(saved.r.status,200,JSON.stringify(saved.value));const active=(await f.call('/api/player/active',null,a.cookie)).value.run,g=restoreRun(currentFactionData('crown'),active.snapshot);
  assert.deepEqual(active.snapshot.loadout,{'fortified-keep':1});assert.equal(g.lives,35);assert.equal(g.maxLives,35);
  const retry=await f.call(`/api/player/runs/${run.id}/commands`,request,a.cookie);assert.equal(retry.value.sequence,saved.value.sequence);
 }finally{f.db.sqlite.close();}
});

test('Commander promotion replay raises only the chosen current recruit and preserves authoritative target limits',async()=>{
 const f=fixture();try{
  const a=await f.account();f.db.sqlite.prepare('UPDATE account_progression SET xp_total=1000 WHERE user_id=?').run(a.user.id);
  f.db.sqlite.prepare('UPDATE fr010_profiles SET skills_json=?,equipped_json=? WHERE user_id=?').run('{"field-promotion":3,"field-logistics":3}','["field-promotion","field-logistics"]',a.user.id);
  const run=(await f.call('/api/player/runs',{factionId:'forge',commanderRulesVersion:2},a.cookie)).value.run,places=[[18,18],[17,18],[19,18],[18,17],[18,19]];
  const command=(action,...args)=>({action,args}),early=await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:0,commands:[...places.slice(0,3).map(p=>command('place',...p)),command('activateGeneral','field-promotion',1)]},a.cookie);
  assert.equal(early.r.status,200,JSON.stringify(early.value));let saved=(await f.call('/api/player/active',null,a.cookie)).value.run,g=restoreRun(currentFactionData('forge'),saved.snapshot);
  assert.equal(g.commandPoints.value,13);assert.ok(g.roundCandidates.every(c=>c.tower.tier===1));
  const invalid=await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:1,commands:[...places.slice(3).map(p=>command('place',...p)),command('activateGeneral','field-promotion'),command('activateGeneral','field-promotion',999999),command('activateGeneral','field-promotion',1.5)]},a.cookie);assert.equal(invalid.r.status,200,JSON.stringify(invalid.value));saved=(await f.call('/api/player/active',null,a.cookie)).value.run;g=restoreRun(currentFactionData('forge'),saved.snapshot);assert.ok(g.roundCandidates.every(c=>c.tower.tier===1));assert.equal(g.commandPoints.value,13);
  const target=g.roundCandidates[0].tower.id,promoted=await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:2,commands:[command('select',target),command('activateGeneral','field-promotion',target),command('activateGeneral','field-promotion',target)],promotedRanks:[6,6,6,6,6]},a.cookie);
  assert.equal(promoted.r.status,200,JSON.stringify(promoted.value));saved=(await f.call('/api/player/active',null,a.cookie)).value.run;g=restoreRun(currentFactionData('forge'),saved.snapshot);
  assert.equal(g.phase,'select');assert.equal(g.roundCandidates.find(c=>c.tower.id===target).tower.tier,2);assert.ok(g.roundCandidates.filter(c=>c.tower.id!==target).every(c=>c.tower.tier===1));assert.equal(g.commandPoints.value,10);
  const second=g.roundCandidates.find(c=>c.tower.id!==target).tower.id,secondPromotion=await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:3,commands:[command('select',second),command('activateGeneral','field-promotion',second)]},a.cookie);assert.equal(secondPromotion.r.status,200,JSON.stringify(secondPromotion.value));saved=(await f.call('/api/player/active',null,a.cookie)).value.run;g=restoreRun(currentFactionData('forge'),saved.snapshot);assert.equal(g.roundCandidates.find(c=>c.tower.id===second).tower.tier,2);assert.equal(g.commandPoints.value,7);
  const objectTarget=await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:4,commands:[command('activateGeneral','field-promotion',{towerId:target})]},a.cookie);assert.equal(objectTarget.r.status,400);
  const retained=await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:4,commands:[command('select',target),command('keep'),command('activateGeneral','field-promotion',target)]},a.cookie);
  assert.equal(retained.r.status,200,JSON.stringify(retained.value));saved=(await f.call('/api/player/active',null,a.cookie)).value.run;g=restoreRun(currentFactionData('forge'),saved.snapshot);
  assert.equal(g.phase,'ready');assert.equal(g.towers.find(t=>t.state==='active').tier,2);assert.equal(g.commandPoints.value,7);
 }finally{f.db.sqlite.close();}
});

test('run creation negotiates frozen Commander rules for cached and current clients and rejects invalid versions',async()=>{
 const f=fixture();try{const a=await f.account(),user=a.user.id;f.db.sqlite.prepare('UPDATE account_progression SET xp_total=1000 WHERE user_id=?').run(user);f.db.sqlite.prepare('UPDATE fr010_profiles SET skills_json=?,equipped_json=? WHERE user_id=?').run('{"field-promotion":3,"field-logistics":3}','["field-promotion","field-logistics"]',user);
  for(const version of [null,0,1,3,'2',{},[]]){const denied=await f.call('/api/player/runs',{factionId:'forge',replace:true,commanderRulesVersion:version},a.cookie);assert.equal(denied.r.status,400,JSON.stringify({version,result:denied.value}));}assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) n FROM fr010_runs WHERE user_id=?').get(user).n,0);
  const legacy=(await f.call('/api/player/runs',{factionId:'forge'},a.cookie)).value.run;assert.equal(legacy.snapshot.commanderRulesVersion,1);const command=(action,...args)=>({action,args}),commands=[...[[18,18],[17,18],[19,18],[18,17],[18,19]].map(p=>command('place',...p)),command('activateGeneral','field-promotion')];
  const oldReplay=await f.call(`/api/player/runs/${legacy.id}/commands`,{batchId:crypto.randomUUID(),sequence:0,commands,commanderRulesVersion:2},a.cookie);assert.equal(oldReplay.r.status,200,JSON.stringify(oldReplay.value));let saved=(await f.call('/api/player/active',null,a.cookie)).value.run,g=restoreRun(currentFactionData('forge'),saved.snapshot);assert.equal(g.general.commanderRulesVersion,1);assert.ok(g.roundCandidates.every(c=>c.tower.tier===2));assert.equal(g.commandPoints.value,10);
  const current=(await f.call('/api/player/runs',{factionId:'forge',replace:true,commanderRulesVersion:2},a.cookie)).value.run;assert.equal(current.snapshot.commanderRulesVersion,2);const newReplay=await f.call(`/api/player/runs/${current.id}/commands`,{batchId:crypto.randomUUID(),sequence:0,commands},a.cookie);assert.equal(newReplay.r.status,200,JSON.stringify(newReplay.value));saved=(await f.call('/api/player/active',null,a.cookie)).value.run;g=restoreRun(currentFactionData('forge'),saved.snapshot);assert.equal(g.general.commanderRulesVersion,2);assert.ok(g.roundCandidates.every(c=>c.tower.tier===1));assert.equal(g.commandPoints.value,13);
 }finally{f.db.sqlite.close();}
});

test('Extended Range replay freezes its rank, charges 200 gold once per wave and restores the global range buff',async()=>{
 const f=fixture();try{const a=await f.account(),user=a.user.id;f.db.sqlite.prepare('UPDATE account_progression SET xp_total=1000 WHERE user_id=?').run(user);f.db.sqlite.prepare('UPDATE fr010_profiles SET skills_json=?,equipped_json=? WHERE user_id=?').run('{"extended-range":1,"quartermaster":1}','["extended-range","quartermaster"]',user);
  const created=await f.call('/api/player/runs',{factionId:'forge'},a.cookie);assert.equal(created.r.status,201,JSON.stringify(created.value));const run=created.value.run,command=(action,...args)=>({action,args});
  f.db.sqlite.prepare('UPDATE fr010_profiles SET skills_json=? WHERE user_id=?').run('{"extended-range":3,"quartermaster":1}',user);
  const beforeCombat=await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:0,commands:[...[[18,18],[17,18],[19,18],[18,17],[18,19]].map(p=>command('place',...p)),command('keep'),command('activateGeneral','extended-range')]},a.cookie);assert.equal(beforeCombat.r.status,200,JSON.stringify(beforeCombat.value));
  let saved=(await f.call('/api/player/active',null,a.cookie)).value.run,g=restoreRun(currentFactionData('forge'),saved.snapshot),active=g.towers.filter(t=>t.state==='active');assert.equal(g.economy.gold,490);assert.equal(g.commandPoints.value,3);
  const activation={batchId:crypto.randomUUID(),sequence:1,commands:[command('startCombat'),command('activateGeneral','extended-range'),command('activateGeneral','extended-range')],gold:999999,loadout:{'extended-range':3},goldCost:0},paid=await f.call(`/api/player/runs/${run.id}/commands`,activation,a.cookie);assert.equal(paid.r.status,200,JSON.stringify(paid.value));
  saved=(await f.call('/api/player/active',null,a.cookie)).value.run;g=restoreRun(currentFactionData('forge'),saved.snapshot);active=g.towers.filter(t=>t.state==='active');assert.equal(g.economy.gold,290);assert.equal(g.commandPoints.value,3);assert.equal(g.general.level('extended-range'),1);assert.ok(active.every(t=>combatTowerStats(t,g.towers,g.data).stats.range===towerStats(t,g.data).range+1));
  assert.equal((await f.call(`/api/player/runs/${run.id}/commands`,activation,a.cookie)).value.sequence,2);
  const repeated=await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:2,commands:[command('activateGeneral','extended-range')]},a.cookie);assert.equal(repeated.r.status,200);saved=(await f.call('/api/player/active',null,a.cookie)).value.run;g=restoreRun(currentFactionData('forge'),saved.snapshot);assert.equal(g.economy.gold,290);
  // Trusted isolated server-state fixture: finish this wave with one actual
  // nearby enemy so ordinary completion resets the temporary buff naturally.
  g.combat.spawnQueue=[];const enemy=g.combat.spawn('host_01');Object.assign(enemy,{x:active[0].x+1,z:active[0].z,hp:1,speed:0});g.journal=[];f.db.sqlite.prepare('UPDATE fr010_runs SET snapshot_json=? WHERE id=?').run(JSON.stringify(serializeRun(g)),run.id);g.advanceTicks(600,{record:true});assert.equal(g.phase,'build');
  const finished=await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:3,commands:g.journal},a.cookie);assert.equal(finished.r.status,200,JSON.stringify(finished.value));saved=(await f.call('/api/player/active',null,a.cookie)).value.run;g=restoreRun(currentFactionData('forge'),saved.snapshot);assert.equal(g.round,2);assert.equal(g.economy.gold,340);assert.ok(g.towers.filter(t=>t.state==='active').every(t=>combatTowerStats(t,g.towers,g.data).stats.range===towerStats(t,g.data).range));
  const next=await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:4,commands:[...[[20,18],[21,18],[20,17],[21,17],[22,18]].map(p=>command('place',...p)),command('keep'),command('startCombat'),command('activateGeneral','extended-range')]},a.cookie);assert.equal(next.r.status,200,JSON.stringify(next.value));saved=(await f.call('/api/player/active',null,a.cookie)).value.run;g=restoreRun(currentFactionData('forge'),saved.snapshot);assert.equal(g.economy.gold,140);assert.equal(g.commandPoints.value,3);assert.ok(g.towers.filter(t=>t.state==='active').every(t=>combatTowerStats(t,g.towers,g.data).stats.range===towerStats(t,g.data).range+1));
 }finally{f.db.sqlite.close();}
});

test('Extended Range replay cannot invent activation gold or consume a use when funds are insufficient',async()=>{
 const f=fixture();try{const a=await f.account(),user=a.user.id;f.db.sqlite.prepare('UPDATE account_progression SET xp_total=1000 WHERE user_id=?').run(user);f.db.sqlite.prepare('UPDATE fr010_profiles SET skills_json=?,equipped_json=? WHERE user_id=?').run('{"extended-range":3}','["extended-range"]',user);
  const created=await f.call('/api/player/runs',{factionId:'forge'},a.cookie);assert.equal(created.r.status,201,JSON.stringify(created.value));const run=created.value.run,command=(action,...args)=>({action,args}),attempt=await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:0,commands:[...[[18,18],[17,18],[19,18],[18,17],[18,19]].map(p=>command('place',...p)),command('keep'),command('startCombat'),command('activateGeneral','extended-range')],gold:999999,goldCost:0},a.cookie);assert.equal(attempt.r.status,200,JSON.stringify(attempt.value));
  let saved=(await f.call('/api/player/active',null,a.cookie)).value.run,g=restoreRun(currentFactionData('forge'),saved.snapshot);assert.equal(g.economy.gold,90);assert.equal(g.commandPoints.value,3);const tower=g.towers.find(t=>t.state==='active');assert.equal(combatTowerStats(tower,g.towers,g.data).stats.range,towerStats(tower,g.data).range);
  g.economy.gold=200;f.db.sqlite.prepare('UPDATE fr010_runs SET snapshot_json=? WHERE id=?').run(JSON.stringify(serializeRun(g)),run.id);
  const paid=await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:1,commands:[command('activateGeneral','extended-range')]},a.cookie);assert.equal(paid.r.status,200,JSON.stringify(paid.value));saved=(await f.call('/api/player/active',null,a.cookie)).value.run;g=restoreRun(currentFactionData('forge'),saved.snapshot);assert.equal(g.economy.gold,0);assert.equal(g.commandPoints.value,3);assert.equal(combatTowerStats(g.towers.find(t=>t.state==='active'),g.towers,g.data).stats.range,towerStats(g.towers.find(t=>t.state==='active'),g.data).range+2);
 }finally{f.db.sqlite.close();}
});

test('legacy promotion journals replay through an explicit rules boundary without changing their queued meaning',async()=>{
 const f=fixture();try{const a=await f.account(),user=a.user.id;f.db.sqlite.prepare('UPDATE account_progression SET xp_total=1000 WHERE user_id=?').run(user);f.db.sqlite.prepare('UPDATE fr010_profiles SET skills_json=?,equipped_json=? WHERE user_id=?').run('{"field-promotion":3,"field-logistics":3}','["field-promotion","field-logistics"]',user);
  const created=await f.call('/api/player/runs',{factionId:'forge'},a.cookie);assert.equal(created.r.status,201,JSON.stringify(created.value));const run=created.value.run,legacy=structuredClone(run.snapshot),root=legacy.graph.nodes[legacy.graph.root.r].value;delete legacy.commanderRulesVersion;delete legacy.graph.nodes[root.general.r].value.commanderRulesVersion;
  // An isolated pre-cutover server save: no client snapshot is accepted by the
  // command endpoint. Later batches must restore this old policy faithfully.
  f.db.sqlite.prepare('UPDATE fr010_runs SET snapshot_json=? WHERE id=?').run(JSON.stringify(legacy),run.id);const command=(action,...args)=>({action,args});
  const oldBatch={batchId:crypto.randomUUID(),sequence:0,commands:[...[[18,18],[17,18],[19,18],[18,17],[18,19]].map(p=>command('place',...p)),command('activateGeneral','field-promotion',null)]},first=await f.call(`/api/player/runs/${run.id}/commands`,oldBatch,a.cookie);assert.equal(first.r.status,200,JSON.stringify(first.value));
  let saved=(await f.call('/api/player/active',null,a.cookie)).value.run,g=restoreRun(currentFactionData('forge'),saved.snapshot);assert.equal(g.general.commanderRulesVersion,1);assert.ok(g.roundCandidates.every(c=>c.tower.tier===2));assert.equal(g.commandPoints.value,10);assert.equal(g.general.uses['field-promotion'],1);
  const rerolled=await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:1,commands:[command('reroll')]},a.cookie);assert.equal(rerolled.r.status,200,JSON.stringify(rerolled.value));saved=(await f.call('/api/player/active',null,a.cookie)).value.run;g=restoreRun(currentFactionData('forge'),saved.snapshot);assert.ok(g.roundCandidates.every(c=>c.tower.tier===2));assert.equal(g.commandPoints.value,9);assert.equal(g.general.uses['field-promotion'],1);
  const cutover=await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:2,commands:[command('adoptCommanderRules',2)]},a.cookie);assert.equal(cutover.r.status,200,JSON.stringify(cutover.value));saved=(await f.call('/api/player/active',null,a.cookie)).value.run;g=restoreRun(currentFactionData('forge'),saved.snapshot);assert.equal(g.general.commanderRulesVersion,2);assert.ok(g.roundCandidates.every(c=>c.tower.tier===2));assert.equal(g.general.uses['field-promotion'],1);assert.equal(g.draft.promotionRankCap,undefined);
  const noLegacy=await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:3,commands:[command('adoptCommanderRules',1),command('activateGeneral','field-promotion',null),command('keep'),command('startCombat')]},a.cookie);assert.equal(noLegacy.r.status,200,JSON.stringify(noLegacy.value));saved=(await f.call('/api/player/active',null,a.cookie)).value.run;g=restoreRun(currentFactionData('forge'),saved.snapshot);assert.equal(g.general.commanderRulesVersion,2);assert.equal(g.commandPoints.value,9);
  g.combat.spawnQueue=[];const active=g.towers.find(t=>t.state==='active'),enemy=g.combat.spawn('host_01');Object.assign(enemy,{x:active.x+1,z:active.z,hp:1,speed:0});g.journal=[];f.db.sqlite.prepare('UPDATE fr010_runs SET snapshot_json=? WHERE id=?').run(JSON.stringify(serializeRun(g)),run.id);g.advanceTicks(600,{record:true});assert.equal(g.phase,'build');
  const completed=await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:4,commands:g.journal},a.cookie);assert.equal(completed.r.status,200,JSON.stringify(completed.value));
  const selected=await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:5,commands:[...[[20,18],[21,18],[20,17],[21,17],[22,18]].map(p=>command('place',...p)),command('select',6),command('activateGeneral','field-promotion',6)]},a.cookie);assert.equal(selected.r.status,200,JSON.stringify(selected.value));saved=(await f.call('/api/player/active',null,a.cookie)).value.run;g=restoreRun(currentFactionData('forge'),saved.snapshot);assert.equal(g.roundCandidates.find(c=>c.tower.id===6).tower.tier,2);assert.ok(g.roundCandidates.filter(c=>c.tower.id!==6).every(c=>c.tower.tier===1));assert.equal(g.commandPoints.value,6);assert.equal(g.general.uses['field-promotion'],2);
  const newReroll=await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:6,commands:[command('reroll')]},a.cookie);assert.equal(newReroll.r.status,200,JSON.stringify(newReroll.value));saved=(await f.call('/api/player/active',null,a.cookie)).value.run;g=restoreRun(currentFactionData('forge'),saved.snapshot);assert.ok(g.roundCandidates.every(c=>c.tower.tier===1));assert.equal(g.commandPoints.value,5);assert.equal(g.general.uses['field-promotion'],2);
 }finally{f.db.sqlite.close();}
});

test('Commander strike replay credits a real boss kill and persists its single use without tower MVP attribution',async()=>{
 const f=fixture();try{
  const a=await f.account();f.db.sqlite.prepare('UPDATE account_progression SET xp_total=1000 WHERE user_id=?').run(a.user.id);
  f.db.sqlite.prepare('UPDATE fr010_profiles SET skills_json=?,equipped_json=? WHERE user_id=?').run('{"decisive-strike":3,"fortified-keep":3}','["decisive-strike","fortified-keep"]',a.user.id);
  const run=(await f.call('/api/player/runs',{factionId:'crown'},a.cookie)).value.run,g=restoreRun(currentFactionData('crown'),run.snapshot);
  for(const[x,z]of [[18,18],[17,18],[19,18],[18,17],[18,19]])g.place(x,z);g.keep();g.setTowerAttackPaused(g.selection.id,true);
  // Isolated server-state fixture: exercise the finishing edge for both real
  // enemy classes without pretending that the setup completed earlier waves.
  g.round=10;g.completedWaves=9;g.progress.highestWave=9;g.startCombat();g.combat.spawnQueue=[];
  const boss=g.combat.spawn('host_10'),ordinary=g.combat.spawn('host_01');boss.hp=boss.maxHp*.05;ordinary.hp=ordinary.maxHp*.2;g.journal=[];
  f.db.sqlite.prepare('UPDATE fr010_runs SET snapshot_json=? WHERE id=?').run(JSON.stringify(serializeRun(g)),run.id);
  const command=(action,...args)=>({action,args}),used=await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:0,commands:[command('activateGeneral','decisive-strike'),{action:'advance',ticks:1}],score:'999999999999'},a.cookie);
  assert.equal(used.r.status,200,JSON.stringify(used.value));let saved=(await f.call('/api/player/active',null,a.cookie)).value.run,restored=restoreRun(currentFactionData('crown'),saved.snapshot);
  assert.equal(restored.kills,2);assert.equal(restored.progress.bossKills,1);assert.equal(restored.commandPoints.value,8);assert.equal(restored.lives,45);assert.ok(restored.towers.every(t=>(t.mvpLevel||0)===0));
  assert.ok(restored.progress.bosses.has('host_10'));assert.ok((await f.call('/api/player/profile',null,a.cookie)).value.eligible.some(r=>r.id==='boss:global:host_10'));
  const nextCommands=[...[[20,18],[21,18],[20,17],[21,17],[22,18]].map(p=>command('place',...p)),command('keep'),command('startCombat'),{action:'advance',ticks:16}],next=await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:1,commands:nextCommands},a.cookie);
  assert.equal(next.r.status,200,JSON.stringify(next.value));saved=(await f.call('/api/player/active',null,a.cookie)).value.run;restored=restoreRun(currentFactionData('crown'),saved.snapshot);const before=restored.combat.enemies.map(e=>[e.id,e.hp]);assert.ok(before.length>0);
  const duplicate=await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:2,commands:[command('activateGeneral','decisive-strike')]},a.cookie);assert.equal(duplicate.r.status,200,JSON.stringify(duplicate.value));
  saved=(await f.call('/api/player/active',null,a.cookie)).value.run;restored=restoreRun(currentFactionData('crown'),saved.snapshot);assert.deepEqual(restored.combat.enemies.map(e=>[e.id,e.hp]),before);assert.equal(restored.commandPoints.value,8);
 }finally{f.db.sqlite.close();}
});
test('approved reset affects every player once, rejects old defenses and preserves account identities and old standings',async()=>{
 const f=fixture();try{const a=await f.account(),b=await f.account('reset-second@example.test','Second'),old=[];
 for(const account of [a,b]){const r=await f.call('/api/player/runs',{factionId:'crown'},account.cookie);old.push(r.value.run);f.db.sqlite.prepare('UPDATE fr010_profiles SET balance=50,skills_json=?,equipped_json=? WHERE user_id=?').run('{"war-horn":1}','["war-horn"]',account.user.id);f.db.sqlite.prepare('UPDATE account_progression SET xp_total=500,permanent_json=? WHERE user_id=?').run('{"war-horn":1}',account.user.id);f.db.sqlite.prepare('INSERT INTO fr010_eligible VALUES(?,?,\'crown\',2,1,NULL)').run(account.user.id,'boss:crown:host_10');}
 const history=crypto.randomUUID();f.db.sqlite.prepare("INSERT INTO fr010_runs(id,user_id,faction_id,ruleset,seed,snapshot_json,loadout_json,started_at,updated_at,finished_at,outcome,score_text,score_digits,highest_wave) VALUES(?,?,'crown','fr010-v1',1,'{}','{}',1,1,2,'lost','9007199254740993123',19,29)").run(history,a.user.id);
 // Isolated fixture: simulate deployment immediately before the one-time reset.
 f.db.sqlite.prepare('DELETE FROM progression_resets').run();
 for(let i=0;i<2;i++){const account=[a,b][i],p=(await f.call('/api/player/session',null,account.cookie)).value;assert.equal(p.user.id,account.user.id);assert.equal(p.profile.balance,0);assert.equal(p.profile.xpTotal,0);assert.deepEqual(p.profile.skills,{});assert.deepEqual(p.profile.equipped,[]);assert.deepEqual(p.profile.permanentUnlocks,{});assert.equal(p.profile.eligible.length,0);assert.equal(p.profile.grants.length,0);assert.deepEqual(p.profile.progress,{});assert.equal((await f.call('/api/player/active',null,account.cookie)).value.run,null);
 assert.equal((await f.call(`/api/player/runs/${old[i].id}/commands`,{batchId:crypto.randomUUID(),sequence:0,commands:[{action:'place',args:[18,18]}]},account.cookie)).r.status,409);assert.equal((await f.call(`/api/player/runs/${old[i].id}/results`,{kind:'end'},account.cookie)).r.status,409);
 const created=await f.call('/api/player/runs',{factionId:'grove'},account.cookie);assert.equal(created.r.status,201);assert.deepEqual(created.value.run.snapshot.loadout,{});}
 assert.equal((await f.call('/api/player/hall?faction=crown')).value.top[0].score,'9007199254740993123');assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) n FROM user').get().n,2);assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) n FROM progression_resets').get().n,1);
 f.db.sqlite.prepare('INSERT INTO fr010_eligible VALUES(?,?,\'crown\',2,1,NULL)').run(a.user.id,'boss:crown:host_10');const p=(await f.call('/api/player/profile',null,a.cookie)).value,paid=(await f.call('/api/player/achievements/claim',{requestId:crypto.randomUUID(),revision:p.revision,achievementId:'boss:crown:host_10'},a.cookie)).value;assert.equal(paid.balance,2);assert.equal((await f.call('/api/player/profile',null,a.cookie)).value.balance,2);
 }finally{f.db.sqlite.close();}
});
test('XP recovery replays an offline final tick through the real Worker after closing the client, then settles exactly once',async()=>{
 const f=fixture(),storage=new RunStore({indexedDB:new IDBFactory()});try{
  const a=await f.account(),created=(await f.call('/api/player/runs',{factionId:'crown'},a.cookie)).value.run,g=restoreRun(currentFactionData('crown'),created.snapshot);
  g.round=38;g.completedWaves=37;g.progress.highestWave=37;g.progress.bosses=new Set(['host_10','host_20','host_30']);g.progress.bossKills=3;g.phase='ready';g.lives=1;g.startCombat();g.combat.spawnQueue=[];const enemy=g.combat.spawn('host_01');enemy.pathIndex=enemy.route.length;g.journal=[];
  f.db.sqlite.prepare('UPDATE fr010_runs SET snapshot_json=?,highest_wave=37,progress_json=? WHERE id=?').run(JSON.stringify(serializeRun(g)),JSON.stringify({bosses:[...g.progress.bosses]}),g.runId);f.db.sqlite.prepare('UPDATE account_progression SET xp_total=190 WHERE user_id=?').run(a.user.id);
  g.advanceTicks(1,{record:true});assert.equal(g.phase,'lost');const offline=new PlayerClient({store:storage,fetcher:async()=>{throw Error('Offline');}});offline.user=a.user;offline.profile={revision:0,xpTotal:190};offline.progressionEpoch=g.progressionEpoch;await offline.attach(g);assert.ok(await storage.batch(g.runId,1));
  const fetcher=async(url,options={})=>(await f.call(String(url).replace('./api','/api'),options.body?JSON.parse(options.body):null,a.cookie)).r;
  const returned=new PlayerClient({store:storage,fetcher});await returned.initialize();assert.equal(returned.profile.xpTotal,202);assert.equal(returned.profile.balance,0);assert.equal(returned.profile.grants.length,0);assert.equal(await storage.batch(g.runId,1),null);assert.equal(f.db.sqlite.prepare('SELECT outcome FROM fr010_runs WHERE id=?').get(g.runId).outcome,'lost');
  const reopened=new PlayerClient({store:storage,fetcher});await reopened.initialize();assert.equal(reopened.profile.xpTotal,202);assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) n FROM account_xp_receipts').get().n,1);
 }finally{storage.close();f.db.sqlite.close();}
});
import {eligibleChampion} from '../game/core/account-progression.js';
let fixtureNumber=0;
function fixture(){
 const db=sqliteDatabase();db.sqlite.exec(fs.readFileSync(new URL('../backend/migrations/0000_statistics.sql',import.meta.url),'utf8'));migrateFr010(db);const mail=[];
 const env={DB:db,ADMIN_TOKEN:'test-only-owner',AUTH_SECRET:'test-only-auth-secret-at-least-thirty-two-characters',AUTH_BASE_URL:base,AUTH_MAIL_MODE:'local',AUTH_LOCAL_MAIL:async value=>mail.push(value),GAME_ORIGINS:base};
 const ip=`192.0.2.${++fixtureNumber}`;
 const call=async(path,body,cookie='',method=body?'POST':'GET')=>{const r=await worker.fetch(new Request(base+path,{method,headers:{Origin:base,'X-Forwarded-For':ip,'CF-Connecting-IP':ip,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);let value;try{value=await r.clone().json();}catch{}return {r,value};};
 async function account(email='commander@example.test',name='Commander'){const signup=await call('/api/auth/sign-up/email',{name,email,password:'test-password-for-fr010',callbackURL:base+'/'});assert.ok(signup.r.ok,signup.value?.error||JSON.stringify(signup.value));assert.equal(mail.at(-1).kind,'verify');const verified=await worker.fetch(new Request(mail.at(-1).url,{headers:{Origin:base,'CF-Connecting-IP':ip}}),env);assert.ok([200,302].includes(verified.status));const cookie=verified.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');assert.ok(cookie);const session=await call('/api/player/session',null,cookie);assert.ok(session.value.user);return {cookie,user:session.value.user};}
 return {db,env,mail,call,account};
}
function storedEvidence(f,user,{faction='crown',champions=[],bosses=[],streak=0,highestWave=streak,campaign=false,outcome='abandoned',developer=false,epoch,startedAt,summary=true}={}){
 const marker=f.db.sqlite.prepare('SELECT id,completed_at FROM progression_resets').get(),g=new Game(currentFactionData(faction),{seed:42,runId:crypto.randomUUID(),accountId:user});
 g.progressionEpoch=epoch??marker.id;g.progress.champions=new Set(champions);g.progress.bosses=new Set(bosses);g.progress.bossKills=bosses.length;g.progress.streakBest=streak;g.progress.highestWave=highestWave;g.progress.campaign=campaign;g.developerMode=developer;
 const progress=summary?{champions,bosses,bossKills:bosses.length,streakBest:streak,campaign}:{};
 f.db.sqlite.prepare('INSERT INTO fr010_runs(id,user_id,faction_id,ruleset,seed,snapshot_json,loadout_json,started_at,updated_at,outcome,highest_wave,progress_json) VALUES(?,?,?,?,42,?,\'{}\',?,?,?,?,?)').run(g.runId,user,faction,g.data.rulesetRevision,JSON.stringify(serializeRun(g)),startedAt??Math.max(Date.now(),marker.completed_at),Date.now(),outcome,highestWave,JSON.stringify(progress));return g;
}

test('global entitlement reconciliation preserves historical payments, receipts, purchases and exact scores',async()=>{
 const f=fixture();try{const a=await f.account(),user=a.user.id;
  f.db.sqlite.prepare('UPDATE fr010_profiles SET balance=77,skills_json=?,equipped_json=? WHERE user_id=?').run('{"war-horn":1}','["war-horn"]',user);f.db.sqlite.prepare('UPDATE account_progression SET xp_total=887,credited_waves=19 WHERE user_id=?').run(user);
  const originals=[['boss:crown:host_10','crown',2,100],['boss:forge:host_10','forge',2,101],['streak:crown:10','crown',1,102],['streak:grove:10','grove',1,103],['boss-collection:forge','forge',5,104]];
  for(const row of originals)f.db.sqlite.prepare('INSERT INTO fr010_grants VALUES(?,?,?,?,?)').run(user,...row);
  for(const id of ['boss:grove:host_10','boss:crown:host_20','boss:forge:host_20'])f.db.sqlite.prepare('INSERT INTO fr010_eligible VALUES(?,?,?,2,1,NULL)').run(user,id,id.split(':')[1]);
  const requestId=crypto.randomUUID(),oldReceipt={receiptId:'achievement:streak:crown:10',status:'confirmed',xpBefore:12,xpAfter:13,amount:1,levelBefore:1,levelAfter:1,newSkills:[]},receiptJSON=JSON.stringify(oldReceipt);
  f.db.sqlite.prepare("INSERT INTO fr010_ledger VALUES(?,?,0,'claim',?,1)").run(user,'request:'+requestId,'streak:crown:10');f.db.sqlite.prepare("INSERT INTO fr010_ledger VALUES(?,?,0,'xp-claim',?,1)").run(user,'xp-claim:streak:crown:10',receiptJSON);f.db.sqlite.prepare("INSERT INTO fr010_ledger VALUES(?,?,-5,'purchase','historical purchase',1)").run(user,'historical-purchase');
  const score=crypto.randomUUID();f.db.sqlite.prepare("INSERT INTO fr010_runs(id,user_id,faction_id,ruleset,seed,snapshot_json,loadout_json,started_at,updated_at,outcome,score_text,score_digits,highest_wave) VALUES(?,?,'crown','fr010-v1',42,'{}','{}',1,1,'lost','9007199254740993123',19,50)").run(score,user);
  const before={ledger:f.db.sqlite.prepare('SELECT * FROM fr010_ledger WHERE user_id=? ORDER BY entry_id').all(user),xp:f.db.sqlite.prepare('SELECT * FROM account_xp_ledger WHERE user_id=? ORDER BY source_id').all(user),score:f.db.sqlite.prepare('SELECT * FROM fr010_runs WHERE id=?').get(score)};
  const p=(await f.call('/api/player/profile',null,a.cookie)).value;assert.equal(p.balance,77);assert.equal(p.xpTotal,887);assert.deepEqual(p.skills,{'war-horn':1});assert.deepEqual(p.equipped,['war-horn']);assert.deepEqual(p.grants.map(g=>g.id).sort(),['boss-collection:global','boss:global:host_10','streak:global:10']);assert.ok(p.grants.every(g=>g.factionId===null));assert.deepEqual(p.eligible.map(g=>g.id),['boss:global:host_20']);
  const retry=await f.call('/api/player/achievements/claim',{requestId,revision:0,achievementId:'streak:crown:10'},a.cookie);assert.equal(retry.r.status,200);assert.deepEqual(retry.value.claimReceipt,oldReceipt);assert.equal(retry.value.balance,77);assert.equal(retry.value.xpTotal,887);
  const already=await f.call('/api/player/achievements/claim',{requestId:crypto.randomUUID(),revision:p.revision,achievementId:'boss:global:host_10'},a.cookie);assert.equal(already.value.balance,77);
  assert.deepEqual(f.db.sqlite.prepare('SELECT * FROM fr010_ledger WHERE user_id=? ORDER BY entry_id').all(user),before.ledger);assert.deepEqual(f.db.sqlite.prepare('SELECT * FROM account_xp_ledger WHERE user_id=? ORDER BY source_id').all(user),before.xp);assert.deepEqual(f.db.sqlite.prepare('SELECT * FROM fr010_runs WHERE id=?').get(score),before.score);
  for(const[id,faction,reward,created]of originals)assert.deepEqual({...f.db.sqlite.prepare('SELECT faction_id,reward,created_at FROM fr010_grants WHERE user_id=? AND achievement_id=?').get(user,id)},{faction_id:faction,reward,created_at:created});
 }finally{f.db.sqlite.close();}
});

test('legacy and canonical pending claims race for one shared payout and keep exact request identity',async()=>{
 const f=fixture();try{const a=await f.account(),user=a.user.id;for(const faction of ['crown','forge'])f.db.sqlite.prepare('INSERT INTO fr010_eligible VALUES(?,?,?,2,1,NULL)').run(user,`streak:${faction}:20`,faction);
  const p=(await f.call('/api/player/profile',null,a.cookie)).value;assert.equal(p.eligible.filter(e=>e.id==='streak:global:20').length,1);
  const requests=['streak:global:20','streak:forge:20'].map(achievementId=>({requestId:crypto.randomUUID(),revision:p.revision,achievementId})),responses=await Promise.all(requests.map(b=>f.call('/api/player/achievements/claim',b,a.cookie)));assert.ok(responses.some(r=>r.r.status===200));
  const after=(await f.call('/api/player/profile',null,a.cookie)).value;assert.equal(after.balance,2);assert.equal(after.xpTotal,2);assert.equal(after.grants.filter(g=>g.id==='streak:global:20').length,1);assert.equal(f.db.sqlite.prepare("SELECT COUNT(*) n FROM fr010_ledger WHERE user_id=? AND kind='achievement'").get(user).n,1);
  for(let i=0;i<responses.length;i++)if(responses[i].r.status===200){const again=await f.call('/api/player/achievements/claim',requests[i],a.cookie);assert.equal(again.r.status,200);assert.equal(again.value.balance,2);}
  const paid=f.db.sqlite.prepare("SELECT entry_id,detail FROM fr010_ledger WHERE user_id=? AND kind='claim'").get(user),request=requests.find(r=>'request:'+r.requestId===paid.entry_id);assert.equal(paid.detail,request.achievementId);
 }finally{f.db.sqlite.close();}
});

test('Basic champion backfill uses verified current-epoch progress and snapshot Sets, then permits one manual claim',async()=>{
 const f=fixture();try{const a=await f.account(),user=a.user.id,basics=faction=>Object.entries(currentFactionData(faction).towers).filter(([,u])=>u.advanced&&u.classification?.toLowerCase()==='basic').map(([id])=>id),crown=basics('crown'),forge=basics('forge'),grove=basics('grove');
  f.db.sqlite.prepare('UPDATE fr010_profiles SET balance=9 WHERE user_id=?').run(user);f.db.sqlite.prepare('UPDATE account_progression SET xp_total=16 WHERE user_id=?').run(user);
  storedEvidence(f,user,{champions:crown,summary:false});const valid=storedEvidence(f,user,{faction:'forge',champions:[forge[0],'dw_shieldguard']});storedEvidence(f,user,{faction:'grove',champions:[grove[0]],developer:true});storedEvidence(f,user,{faction:'forge',champions:[forge[1]],startedAt:1});storedEvidence(f,user,{faction:'forge',champions:[forge[2]],epoch:'initial'});storedEvidence(f,user,{faction:'grove',champions:[grove[1]],outcome:'reset'});
  const p=(await f.call('/api/player/profile',null,a.cookie)).value;assert.equal(p.balance,9);assert.equal(p.xpTotal,16);const champions=p.eligible.filter(e=>e.id.startsWith('champion:'));assert.equal(champions.length,crown.length+1);assert.ok(crown.every(id=>champions.some(e=>e.id==='champion:crown:'+id)));assert.ok(champions.some(e=>e.id==='champion:forge:'+forge[0]));assert.ok(p.eligible.some(e=>e.id==='collection:crown:5'));
  const repeat=(await f.call('/api/player/profile',null,a.cookie)).value;assert.equal(repeat.revision,p.revision);assert.deepEqual(repeat.eligible,p.eligible);
  const request={requestId:crypto.randomUUID(),revision:p.revision,achievementId:'champion:crown:'+crown[0]},paid=await f.call('/api/player/achievements/claim',request,a.cookie);assert.equal(paid.r.status,200);assert.equal(paid.value.balance,10);assert.equal(paid.value.xpTotal,17);assert.equal((await f.call('/api/player/achievements/claim',request,a.cookie)).value.xpTotal,17);
  f.db.sqlite.prepare('UPDATE fr010_runs SET sequence=1,progress_json=? WHERE id=?').run(JSON.stringify({champions:[forge[0],forge[1]]}),valid.runId);const newer=(await f.call('/api/player/profile',null,a.cookie)).value;assert.equal(newer.eligible.filter(e=>e.id==='champion:forge:'+forge[1]).length,1);assert.equal(newer.balance,10);assert.equal(newer.xpTotal,17);
 }finally{f.db.sqlite.close();}
});

test('global boss collection combines factions while flawless milestones use the best single run',async()=>{
 const f=fixture();try{const a=await f.account(),user=a.user.id;storedEvidence(f,user,{bosses:['host_10','host_20'],streak:9});const second=storedEvidence(f,user,{faction:'forge',bosses:['host_30','host_40'],streak:8});storedEvidence(f,user,{faction:'grove',bosses:['host_50'],streak:7});
  const p=(await f.call('/api/player/profile',null,a.cookie)).value;assert.equal(p.eligible.filter(e=>e.id.startsWith('boss:global:')).length,5);assert.equal(p.eligible.filter(e=>e.id==='boss-collection:global').length,1);assert.equal(p.eligible.filter(e=>e.id.startsWith('streak:')).length,0);assert.equal(p.balance,0);assert.equal(p.xpTotal,0);
  f.db.sqlite.prepare('UPDATE fr010_runs SET sequence=1,progress_json=? WHERE id=?').run(JSON.stringify({bosses:['host_30','host_40'],streakBest:20}),second.runId);const later=(await f.call('/api/player/profile',null,a.cookie)).value;assert.deepEqual(later.eligible.filter(e=>e.id.startsWith('streak:')).map(e=>e.id).sort(),['streak:global:10','streak:global:20']);
 }finally{f.db.sqlite.close();}
});

test('shared reconciliation rolls back atomically and concurrent retries never alter wallet or XP',async()=>{
 const f=fixture();try{const a=await f.account(),user=a.user.id;f.db.sqlite.prepare('UPDATE fr010_profiles SET balance=21 WHERE user_id=?').run(user);f.db.sqlite.prepare('UPDATE account_progression SET xp_total=99 WHERE user_id=?').run(user);f.db.sqlite.prepare("INSERT INTO fr010_grants VALUES(?,'boss:crown:host_10','crown',2,1234)").run(user);f.db.sqlite.prepare("INSERT INTO fr010_eligible VALUES(?,'streak:forge:10','forge',1,1,NULL)").run(user);
  const before=f.db.sqlite.prepare('SELECT revision FROM fr010_profiles WHERE user_id=?').get(user).revision,batch=f.db.batch;f.db.batch=statements=>batch([...statements,f.db.prepare('INSERT INTO deliberately_missing_entitlement_fixture VALUES(1)')]);
  assert.equal((await f.call('/api/player/profile',null,a.cookie)).r.status,503);assert.equal(f.db.sqlite.prepare("SELECT COUNT(*) n FROM fr010_grants WHERE user_id=? AND achievement_id='boss:global:host_10'").get(user).n,0);assert.equal(f.db.sqlite.prepare('SELECT revision FROM fr010_profiles WHERE user_id=?').get(user).revision,before);
  f.db.batch=batch;const results=await Promise.all([f.call('/api/player/profile',null,a.cookie),f.call('/api/player/profile',null,a.cookie)]);assert.ok(results.every(r=>r.r.status===200));assert.ok(results.every(r=>r.value.balance===21&&r.value.xpTotal===99));assert.equal(f.db.sqlite.prepare("SELECT COUNT(*) n FROM fr010_grants WHERE user_id=? AND achievement_id='boss:global:host_10'").get(user).n,1);assert.equal(f.db.sqlite.prepare('SELECT revision FROM fr010_profiles WHERE user_id=?').get(user).revision,before+1);
 }finally{f.db.sqlite.close();}
});

test('legacy achievement backfill reads large snapshots individually and never materializes them with all()',async()=>{
 const f=fixture();let originalPrepare;try{const a=await f.account(),user=a.user.id,basic=faction=>Object.entries(currentFactionData(faction).towers).find(([,u])=>u.advanced&&u.classification?.toLowerCase()==='basic')[0],valid=basic('crown');
  for(const options of [{champions:[valid],summary:false},{faction:'forge',champions:[basic('forge')],developer:true,summary:false},{faction:'grove',champions:[basic('grove')],epoch:'initial',summary:false}]){const g=storedEvidence(f,user,options);g.legacyFixturePadding='x'.repeat(512*1024);f.db.sqlite.prepare('UPDATE fr010_runs SET snapshot_json=? WHERE id=?').run(JSON.stringify(serializeRun(g)),g.runId);}
  const allQueries=[],snapshotReads=[];originalPrepare=f.db.prepare;
  const trace=(statement,sql)=>{const bind=statement.bind.bind(statement),all=statement.all.bind(statement),first=statement.first.bind(statement);statement.bind=(...args)=>trace(bind(...args),sql);statement.all=(...args)=>{if(/FROM fr010_runs/i.test(sql))allQueries.push(sql);return all(...args);};statement.first=(...args)=>{if(/SELECT snapshot_json FROM fr010_runs/i.test(sql))snapshotReads.push(sql);return first(...args);};return statement;};
  f.db.prepare=sql=>trace(originalPrepare(sql),sql);const result=await f.call('/api/player/profile',null,a.cookie);assert.equal(result.r.status,200,JSON.stringify(result.value));
  assert.equal(snapshotReads.length,3);assert.ok(allQueries.length>0);assert.ok(allQueries.every(sql=>!/^SELECT \*/i.test(sql)&&!sql.includes('snapshot_json')));assert.deepEqual(result.value.eligible.filter(e=>e.id.startsWith('champion:')).map(e=>e.id),['champion:crown:'+valid]);assert.equal(result.value.balance,0);assert.equal(result.value.xpTotal,0);
 }finally{if(originalPrepare)f.db.prepare=originalPrepare;f.db.sqlite.close();}
});
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

test('XP API: Intermediate and Basic champions grant their own medals and XP once',async()=>{
 const f=fixture();try{const a=await f.account(),d=currentFactionData('crown'),normal=Object.keys(d.towers).find(id=>d.towers[id].classification?.toLowerCase()==='intermediate'),basic=Object.keys(d.towers).find(id=>d.towers[id].advanced&&d.towers[id].classification?.toLowerCase()==='basic');
 for(const id of [normal,basic])f.db.sqlite.prepare('INSERT INTO fr010_eligible VALUES(?,?,\'crown\',1,1,NULL)').run(a.user.id,'champion:crown:'+id);
 let p=(await f.call('/api/player/profile',null,a.cookie)).value;assert.equal(p.eligible.length,2);assert.equal(p.xpTotal,0);
 const request={requestId:crypto.randomUUID(),revision:p.revision,achievementId:'champion:crown:'+normal},first=await f.call('/api/player/achievements/claim',request,a.cookie);assert.equal(first.r.status,200);assert.equal(first.value.balance,1);assert.equal(first.value.xpTotal,2);
 assert.equal((await f.call('/api/player/achievements/claim',request,a.cookie)).value.xpTotal,2);
 const requestBasic={requestId:crypto.randomUUID(),revision:first.value.revision,achievementId:'champion:crown:'+basic},paidBasic=await f.call('/api/player/achievements/claim',requestBasic,a.cookie);assert.equal(paidBasic.r.status,200);assert.equal(paidBasic.value.balance,2);assert.equal(paidBasic.value.xpTotal,3);assert.equal((await f.call('/api/player/achievements/claim',requestBasic,a.cookie)).value.xpTotal,3);assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) n FROM fr010_grants').get().n,2);
 }finally{f.db.sqlite.close();}
});
test('XP API: account level gates are authoritative even with enough medals; Claim can open a gate',async()=>{
 const f=fixture();try{const a=await f.account();f.db.sqlite.prepare('UPDATE fr010_profiles SET balance=100 WHERE user_id=?').run(a.user.id);f.db.sqlite.prepare('UPDATE account_progression SET xp_total=108 WHERE user_id=?').run(a.user.id);
 let p=(await f.call('/api/player/profile',null,a.cookie)).value;const denied=await f.call('/api/player/purchase',{requestId:crypto.randomUUID(),revision:p.revision,skill:'morale-boost'},a.cookie);assert.equal(denied.r.status,400);assert.match(denied.value.error,/Level 5/);
 const d=currentFactionData('crown'),id='champion:crown:'+Object.keys(d.towers).find(id=>d.towers[id].classification?.toLowerCase()==='intermediate');f.db.sqlite.prepare('INSERT INTO fr010_eligible VALUES(?,?,\'crown\',1,1,NULL)').run(a.user.id,id);
 p=(await f.call('/api/player/achievements/claim',{requestId:crypto.randomUUID(),revision:p.revision,achievementId:id},a.cookie)).value;assert.equal(p.xpTotal,110);assert.deepEqual(p.equipped,[]);assert.equal(p.skills['morale-boost'],undefined);
 const bought=await f.call('/api/player/purchase',{requestId:crypto.randomUUID(),revision:p.revision,skill:'morale-boost'},a.cookie);assert.equal(bought.r.status,200);assert.equal(bought.value.skills['morale-boost'],1);assert.equal(bought.value.balance,96);assert.deepEqual(bought.value.equipped,[]);
 }finally{f.db.sqlite.close();}
});
test('XP API: legacy owned skill survives reset and remains purchasable below new level',async()=>{
 const f=fixture();try{const a=await f.account();f.db.sqlite.prepare('DELETE FROM account_xp_ledger WHERE user_id=?').run(a.user.id);f.db.sqlite.prepare('DELETE FROM account_progression WHERE user_id=?').run(a.user.id);f.db.sqlite.prepare('UPDATE fr010_profiles SET balance=10,skills_json=? WHERE user_id=?').run('{"war-horn":1}',a.user.id);
 let p=(await f.call('/api/player/profile',null,a.cookie)).value;assert.equal(p.permanentUnlocks['war-horn'],1);p=(await f.call('/api/player/reset',{requestId:crypto.randomUUID(),revision:p.revision},a.cookie)).value;assert.equal(p.xpTotal,0);assert.equal(p.permanentUnlocks['war-horn'],1);
 p=(await f.call('/api/player/purchase',{requestId:crypto.randomUUID(),revision:p.revision,skill:'war-horn'},a.cookie)).value;assert.equal(p.skills['war-horn'],1);assert.equal(p.balance,5);const denied=await f.call('/api/player/purchase',{requestId:crypto.randomUUID(),revision:p.revision,skill:'war-horn'},a.cookie);assert.equal(denied.r.status,400);
 }finally{f.db.sqlite.close();}
});
test('XP API: result receipts are server-derived, owned, idempotent and durable across result acknowledgement',async()=>{
 const f=fixture();try{const a=await f.account(),b=await f.account('xp-other@example.test','Other'),run=(await f.call('/api/player/runs',{factionId:'forge'},a.cookie)).value.run;
 const forged=await f.call(`/api/player/runs/${run.id}/results`,{kind:'end',xpTotal:999999},a.cookie);assert.equal(forged.r.status,409);
 f.db.sqlite.prepare("UPDATE fr010_runs SET outcome='lost',highest_wave=37,progress_json=? WHERE id=?").run(JSON.stringify({bosses:['host_10','host_20','host_30']}),run.id);
 const result=await f.call(`/api/player/runs/${run.id}/results`,{kind:'end',xpTotal:999999,bosses:['host_50']},a.cookie);assert.equal(result.r.status,200);assert.equal(result.value.receipt.amount,12);assert.equal(result.value.profile.xpTotal,12);assert.equal(result.value.profile.balance,0);
 assert.equal((await f.call(`/api/player/runs/${run.id}/results`,{kind:'end'},a.cookie)).value.profile.xpTotal,12);assert.equal((await f.call(`/api/player/runs/${run.id}/results`,null,b.cookie)).r.status,404);
 assert.equal((await f.call(`/api/player/runs/${run.id}/results`,null,a.cookie)).value.receipts.length,1);
 await f.call('/api/player/delete-account',{confirmation:'DELETE'},a.cookie);for(const table of ['account_xp_receipts','account_xp_ledger','account_run_progression','account_progression'])assert.equal(f.db.sqlite.prepare(`SELECT COUNT(*) n FROM ${table} WHERE user_id=?`).get(a.user.id).n,0);
 assert.ok((await f.call('/api/player/profile',null,b.cookie)).r.ok);
 }finally{f.db.sqlite.close();}
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


test('TOP claims canonically pay 3 medals even for old eligible rows; retry and historical payouts remain exact',async()=>{
 const f=fixture();try{const a=await f.account(),data=currentFactionData('crown'),tops=Object.keys(data.towers).filter(id=>data.towers[id].classification?.toLowerCase()==='top'),ids=tops.slice(0,2).map(id=>'champion:crown:'+id);
 f.db.sqlite.prepare('INSERT INTO fr010_grants(user_id,achievement_id,reward,created_at) VALUES(?,?,1,1)').run(a.user.id,ids[0]);
 f.db.sqlite.prepare("INSERT INTO fr010_eligible VALUES(?,?,'crown',1,1,NULL)").run(a.user.id,ids[1]);
 const p=(await f.call('/api/player/profile',null,a.cookie)).value;assert.equal(p.grants.find(g=>g.id===ids[0]).reward,1);assert.equal(p.eligible.find(g=>g.id===ids[1]).reward,3);
 const request={requestId:crypto.randomUUID(),revision:p.revision,achievementId:ids[1]},paid=await f.call('/api/player/achievements/claim',request,a.cookie);assert.equal(paid.r.status,200,JSON.stringify(paid.value));assert.equal(paid.value.balance,3);assert.equal(paid.value.grants.find(g=>g.id===ids[1]).reward,3);assert.equal(paid.value.grants.find(g=>g.id===ids[0]).reward,1);
 const retry=await f.call('/api/player/achievements/claim',request,a.cookie);assert.equal(retry.value.balance,3);assert.equal(retry.value.xpTotal,paid.value.xpTotal);assert.equal(f.db.sqlite.prepare("SELECT COUNT(*) n FROM fr010_ledger WHERE kind='achievement'").get().n,1);
 }finally{f.db.sqlite.close();}
});

test('Faction achievements: every current champion including Basic and Secret is required for each full collection, paid manually once',async()=>{
 const f=fixture();try{const a=await f.account(),user=a.user.id;let balance=0,xp=0;
  for(const faction of ['crown','forge','grove']){const data=currentFactionData(faction),rows=factionCollectionAchievements(data),all=rows.find(r=>r.id===`collection:${faction}:all`),theme=rows.find(r=>r.kind==='faction-collection');assert.equal(all.requiredChampions.length,38);assert.ok(all.requiredChampions.some(id=>data.towers[id].classification.toLowerCase()==='basic'));const secret=all.requiredChampions.find(id=>data.towers[id].classification.toLowerCase()==='secret'),ordinary=all.requiredChampions.filter(id=>id!==secret);
   storedEvidence(f,user,{faction,champions:ordinary.slice(0,19)});storedEvidence(f,user,{faction,champions:ordinary.slice(19),summary:false});let p=(await f.call('/api/player/profile',null,a.cookie)).value;assert.ok(!p.eligible.some(r=>r.id===all.id));assert.equal(p.balance,balance);assert.equal(p.xpTotal,xp);
   storedEvidence(f,user,{faction,champions:[secret],summary:false});p=(await f.call('/api/player/profile',null,a.cookie)).value;assert.deepEqual(p.eligible.filter(r=>r.id===all.id).map(r=>[r.factionId,r.reward,r.xp]),[[faction,12,20]]);assert.ok(p.eligible.some(r=>r.id===theme.id));
   for(const [row,medals,experience]of [[all,12,20],[theme,4,6]]){const request={requestId:crypto.randomUUID(),revision:p.revision,achievementId:row.id},paid=await f.call('/api/player/achievements/claim',request,a.cookie);assert.equal(paid.r.status,200,JSON.stringify(paid.value));balance+=medals;xp+=experience;assert.equal(paid.value.balance,balance);assert.equal(paid.value.xpTotal,xp);const retry=await f.call('/api/player/achievements/claim',request,a.cookie);assert.deepEqual(retry.value.claimReceipt,paid.value.claimReceipt);assert.equal(retry.value.balance,balance);assert.equal(retry.value.xpTotal,xp);p=paid.value;}
   assert.equal((await f.call('/api/player/achievements/claim',{requestId:crypto.randomUUID(),revision:p.revision,achievementId:all.id},a.cookie)).value.balance,balance);
  }
  assert.equal(balance,48);assert.equal(xp,78);assert.equal(f.db.sqlite.prepare("SELECT COUNT(*) n FROM fr010_ledger WHERE user_id=? AND kind='achievement'").get(user).n,6);
 }finally{f.db.sqlite.close();}
});

test('Faction achievements: foreign, duplicate, excluded and client-invented craft evidence cannot complete a faction collection',async()=>{
 const f=fixture();try{const a=await f.account(),user=a.user.id,data=currentFactionData('forge'),all=factionCollectionAchievements(data).find(r=>r.kind==='collection'),secret=all.requiredChampions.find(id=>data.towers[id].classification.toLowerCase()==='secret');
  storedEvidence(f,user,{faction:'forge',champions:all.requiredChampions.filter(id=>id!==secret)});storedEvidence(f,user,{faction:'crown',champions:[secret]});
  for(const options of [{developer:true},{epoch:'initial'},{startedAt:1},{outcome:'reset'}])storedEvidence(f,user,{faction:'forge',champions:[secret],highestWave:50,...options});const wrongRules=storedEvidence(f,user,{faction:'forge',champions:[secret],highestWave:50});f.db.sqlite.prepare("UPDATE fr010_runs SET ruleset='unverified-ruleset' WHERE id=?").run(wrongRules.runId);
  const created=(await f.call('/api/player/runs',{factionId:'forge',commanderRulesVersion:2},a.cookie)).value.run,forged=await f.call(`/api/player/runs/${created.id}/commands`,{batchId:crypto.randomUUID(),sequence:0,commands:[],champions:all.requiredChampions,progress:{champions:all.requiredChampions,campaign:true},highestWave:50,grants:[{id:all.id,reward:999}]},a.cookie);assert.equal(forged.r.status,200,JSON.stringify(forged.value));
  let p=(await f.call('/api/player/profile',null,a.cookie)).value;assert.ok(!p.eligible.some(r=>r.id===all.id||r.id==='campaign:forge'));assert.equal(p.balance,0);assert.equal(p.xpTotal,0);assert.equal((await f.call('/api/player/achievements/claim',{requestId:crypto.randomUUID(),revision:p.revision,achievementId:all.id,champions:all.requiredChampions},a.cookie)).r.status,409);
  storedEvidence(f,user,{faction:'forge',champions:[secret,secret]});p=(await f.call('/api/player/profile',null,a.cookie)).value;assert.equal(p.eligible.filter(r=>r.id===all.id).length,1);assert.equal(p.balance,0);assert.equal(p.xpTotal,0);
 }finally{f.db.sqlite.close();}
});

test('Faction achievements: each thematic trio combines only matching-faction verified crafts and concurrent claims pay once',async()=>{
 const f=fixture();try{const a=await f.account(),user=a.user.id;let balance=0,xp=0;
  for(const faction of ['crown','forge','grove']){const row=factionCollectionAchievements(currentFactionData(faction)).find(r=>r.kind==='faction-collection'),foreign=faction==='crown'?'grove':'crown';assert.equal(row.requiredChampions.length,3);storedEvidence(f,user,{faction,champions:row.requiredChampions.slice(0,2)});storedEvidence(f,user,{faction:foreign,champions:[row.requiredChampions[2]]});let p=(await f.call('/api/player/profile',null,a.cookie)).value;assert.ok(!p.eligible.some(r=>r.id===row.id));
   storedEvidence(f,user,{faction,champions:[row.requiredChampions[2]],summary:false});p=(await f.call('/api/player/profile',null,a.cookie)).value;const candidate=p.eligible.find(r=>r.id===row.id);assert.equal(candidate.factionId,faction);assert.equal(candidate.reward,4);assert.equal(candidate.xp,6);
   const requests=[0,1].map(()=>({requestId:crypto.randomUUID(),revision:p.revision,achievementId:row.id})),responses=await Promise.all(requests.map(b=>f.call('/api/player/achievements/claim',b,a.cookie)));assert.ok(responses.some(r=>r.r.status===200));balance+=4;xp+=6;p=(await f.call('/api/player/profile',null,a.cookie)).value;assert.equal(p.balance,balance);assert.equal(p.xpTotal,xp);assert.equal(p.grants.filter(r=>r.id===row.id).length,1);for(let i=0;i<responses.length;i++)if(responses[i].r.status===200)assert.equal((await f.call('/api/player/achievements/claim',requests[i],a.cookie)).value.xpTotal,xp);
  }
  assert.equal(f.db.sqlite.prepare("SELECT COUNT(*) n FROM fr010_ledger WHERE user_id=? AND kind='achievement'").get(user).n,3);
 }finally{f.db.sqlite.close();}
});

test('Faction achievements: historical verified wave 50 and campaign flags backfill the existing campaign IDs without paying old victories twice',async()=>{
 const f=fixture();try{const a=await f.account(),user=a.user.id;storedEvidence(f,user,{highestWave:49,bosses:['host_50']});storedEvidence(f,user,{faction:'forge',highestWave:50,developer:true});storedEvidence(f,user,{faction:'grove',highestWave:50,epoch:'initial'});storedEvidence(f,user,{highestWave:50,outcome:'reset'});let p=(await f.call('/api/player/profile',null,a.cookie)).value;assert.ok(!p.eligible.some(r=>r.id.startsWith('campaign:')));assert.equal((await f.call('/api/player/achievements/claim',{requestId:crypto.randomUUID(),revision:p.revision,achievementId:'campaign:crown',highestWave:50,campaign:true},a.cookie)).r.status,409);
  const requestId=crypto.randomUUID(),oldReceipt={receiptId:'achievement:campaign:crown',status:'confirmed',xpBefore:83,xpAfter:91,amount:8,levelBefore:4,levelAfter:4,newSkills:[]};f.db.sqlite.prepare("INSERT INTO fr010_grants VALUES(?,'campaign:crown','crown',5,123)").run(user);f.db.sqlite.prepare("INSERT INTO fr010_ledger VALUES(?,?,0,'claim','campaign:crown',123)").run(user,'request:'+requestId);f.db.sqlite.prepare("INSERT INTO fr010_ledger VALUES(?,'xp-claim:campaign:crown',0,'xp-claim',?,123)").run(user,JSON.stringify(oldReceipt));f.db.sqlite.prepare('UPDATE fr010_profiles SET balance=31 WHERE user_id=?').run(user);f.db.sqlite.prepare('UPDATE account_progression SET xp_total=91 WHERE user_id=?').run(user);
  storedEvidence(f,user,{highestWave:50});storedEvidence(f,user,{faction:'forge',highestWave:49,campaign:true});storedEvidence(f,user,{faction:'grove',highestWave:49,campaign:true,summary:false});p=(await f.call('/api/player/profile',null,a.cookie)).value;assert.deepEqual(p.eligible.filter(r=>r.id.startsWith('campaign:')).map(r=>[r.id,r.factionId,r.reward,r.xp]).sort(),[['campaign:forge','forge',5,8],['campaign:grove','grove',5,8]]);assert.equal(p.balance,31);assert.equal(p.xpTotal,91);
  const retry=await f.call('/api/player/achievements/claim',{requestId,revision:0,achievementId:'campaign:crown'},a.cookie);assert.deepEqual(retry.value.claimReceipt,oldReceipt);assert.equal(retry.value.balance,31);assert.equal(retry.value.xpTotal,91);assert.equal((await f.call('/api/player/achievements/claim',{requestId:crypto.randomUUID(),revision:p.revision,achievementId:'campaign:crown'},a.cookie)).value.balance,31);
  for(const faction of ['forge','grove']){const request={requestId:crypto.randomUUID(),revision:p.revision,achievementId:'campaign:'+faction},paid=await f.call('/api/player/achievements/claim',request,a.cookie);assert.equal(paid.r.status,200,JSON.stringify(paid.value));assert.equal((await f.call('/api/player/achievements/claim',request,a.cookie)).value.xpTotal,paid.value.xpTotal);p=paid.value;}assert.equal(p.balance,41);assert.equal(p.xpTotal,107);assert.equal(f.db.sqlite.prepare("SELECT COUNT(*) n FROM fr010_grants WHERE user_id=? AND achievement_id LIKE 'campaign:%'").get(user).n,3);
 }finally{f.db.sqlite.close();}
});

test('Faction achievements: an actual authoritative craft immediately completes both collection thresholds using earlier verified runs',async()=>{
 const f=fixture();try{const a=await f.account(),user=a.user.id;
  for(const faction of ['crown','forge','grove']){const data=currentFactionData(faction),rows=factionCollectionAchievements(data),all=rows.find(r=>r.kind==='collection'),theme=rows.find(r=>r.kind==='faction-collection'),family=theme.requiredChampions[0],recipe=data.recipes.find(r=>recipeFamily(r)===family);assert.ok(recipe&&!recipe.currentRoundOnly);
   storedEvidence(f,user,{faction,champions:all.requiredChampions.filter(id=>id!==family)});const before=(await f.call('/api/player/profile',null,a.cookie)).value;assert.ok(!before.eligible.some(r=>r.id===all.id||r.id===theme.id));
   const created=await f.call('/api/player/runs',{factionId:faction,replace:true,commanderRulesVersion:2},a.cookie);assert.equal(created.r.status,201,JSON.stringify(created.value));const run=created.value.run,g=restoreRun(data,run.snapshot);g.phase='ready';g.economy.xp=data.balance.xpPerLevel*100;const pieces=recipe.ingredients.map((piece,i)=>({id:g.nextId++,family:piece.family,tier:piece.tier,state:'active',x:10+i,z:10,kills:0,mvpLevel:0}));g.towers.push(...pieces);for(const tower of pieces)assert.equal(g.grid.occupy(tower.x,tower.z,tower.id).ok,true);g.journal=[];
   // Trusted saved-state fixture supplies legal ingredients. Only select/craft
   // primitives go through the Worker; this is not a full acquisition campaign.
   f.db.sqlite.prepare('UPDATE fr010_runs SET snapshot_json=? WHERE id=?').run(JSON.stringify(serializeRun(g)),run.id);const result=await f.call(`/api/player/runs/${run.id}/commands`,{batchId:crypto.randomUUID(),sequence:0,commands:[{action:'select',args:[pieces[0].id]},{action:'craft',args:[recipe.id]}]},a.cookie);assert.equal(result.r.status,200,JSON.stringify(result.value));
   for(const row of [all,theme]){const earned=result.value.profile.eligible.find(r=>r.id===row.id);assert.ok(earned,row.id);assert.equal(earned.runId,run.id);assert.equal(earned.factionId,faction);}assert.ok(result.value.profile.eligible.some(r=>r.id===`champion:${faction}:${family}`));assert.equal(result.value.profile.balance,0);assert.equal(result.value.profile.xpTotal,0);
   const saved=(await f.call('/api/player/active',null,a.cookie)).value.run,restored=restoreRun(data,saved.snapshot);assert.equal(restored.towers.find(t=>t.id===pieces[0].id).family,family);assert.ok(restored.progress.champions.has(family));
  }
 }finally{f.db.sqlite.close();}
});
