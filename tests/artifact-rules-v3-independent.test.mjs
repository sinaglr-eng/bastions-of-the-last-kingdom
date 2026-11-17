import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../game/core/game.js';
import {currentFactionData} from '../game/core/current-data.js';
import {ARTIFACT_CATALOG,artifactBonuses,equipArtifactSet} from '../game/core/artifacts.js';
import {towerStats,combatTowerStats} from '../game/core/math.js';
import {fr002Impact,updateFr002Tower} from '../game/core/fr002-combat.js';
import {serializeRun,restoreRun} from '../game/core/run-state.js';
import {artifactPrimaryContact} from '../game/core/artifact-combat.js';
import {defenderEffectiveStats,defenderEffectiveStatsMarkup} from '../ui/defender-effective-stats.js';
import {artifactDefenderNotes} from '../ui/artifact-defender-notes.js';
import fs from 'node:fs';
import worker from '../backend/worker.js';
import {sqliteDatabase} from '../backend/sqlite-adapter.js';
import {migrateFr010} from '../backend/migrate-fr010.js';

const near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const gear=id=>equipArtifactSet({},id);
function arena(faction,family,equipment=gear('celestial'),{buffs=true}={}){
 const data=currentFactionData(faction),g=new Game(data,{seed:99441,artifactVersion:'fr011-v3',artifactEquipment:equipment,loadout:buffs?{'blood-wrath':1,'morale-boost':2}:{}});
 g.place(18,18);const t=g.towers[0];Object.assign(t,{family,tier:1,state:'active',attackPaused:false,mvpLevel:0,cooldown:0});
 g.phase='combat';g.combat.spawnQueue=[{time:1e9,type:'host_01',modifiers:{}}];
 if(buffs)g.general.active={'blood-wrath':100,'morale-boost':100};
 const e=g.combat.spawn('host_01');Object.assign(e,{x:t.x+1,z:t.z,hp:1e9,maxHp:1e9,speed:0,armor:0,physicalImmune:false,magicImmune:false,untouchable:0});
 return {g,t,e,data,c:g.combat};
}

test('every subset of each set gains monotonically when another distinct set piece is added',()=>{
 for(const set of ARTIFACT_CATALOG.sets){
  const entries=Object.entries(gear(set.id)),cache=new Map();
  const effects=mask=>{if(!cache.has(mask))cache.set(mask,artifactBonuses(Object.fromEntries(entries.filter((_,i)=>mask&(1<<i)))).effects);return cache.get(mask);};
  for(let mask=0;mask<(1<<entries.length);mask++)for(let i=0;i<entries.length;i++)if(!(mask&(1<<i))){
   const before=effects(mask),after=effects(mask|(1<<i));
   for(const[key,value]of Object.entries(before))assert.ok((after[key]||0)+1e-9>=value,`${set.id}: adding ${entries[i][1]} reduced ${key}`);
  }
 }
});

test('neutral-target Damage/hit inspection equals actual primary HP loss for all three factions',()=>{
 for(const[faction,family]of [['crown','archer'],['forge','dw_musketeer'],['grove','el_grove_archer']])for(const equipment of [gear('celestial'),{weapon:'N-13',neck:'N-16',offhand:'N-18',gloves:'N-04'}]){
  const {g,t,e,c}=arena(faction,family,equipment),before=serializeRun(g),inspection=defenderEffectiveStats(g,t),stats=combatTowerStats(t,g.towers,g.data).stats;
  assert.deepEqual(serializeRun(g),before,'Opening the inspection must not mutate the run or RNG.');
  assert.ok(!stats.abilities.some(a=>a.familyId==='critical-strike'));
  let actual;g.on((kind,row)=>{if(kind==='damage-trace'&&row.source===t&&row.directHit&&actual===undefined)actual=row.effectiveDamage;});
  fr002Impact(c,{source:t,target:e,stats,firstPrimary:true,releaseCount:1,directTargets:[e]});
  near(inspection.damage,actual);near(inspection.base.damage+inspection.damageParts.reduce((n,p)=>n+p.value,0),inspection.damage);
  near(inspection.base.range+inspection.rangeParts.reduce((n,p)=>n+p.value,0),inspection.range);
 }
});

test('continuous-fire inspection matches a real cone packet including artifact speed and Commander buffs',()=>{
 for(const[faction,family]of [['forge','dw_steamharpooner'],['grove','el_baby_fire_dragon']]){
  const {g,t,e,c}=arena(faction,family),before=serializeRun(g),inspection=defenderEffectiveStats(g,t),{stats,bonuses}=combatTowerStats(t,g.towers,g.data);
  assert.deepEqual(serializeRun(g),before);assert.ok(stats.continuousAttack);
  let packet;g.on((kind,row)=>{if(kind==='damage-trace'&&row.source===t&&packet===undefined)packet=row;});
  updateFr002Tower(c,t,stats,.1,bonuses.haste);
  assert.ok(packet);near(packet.effectiveDamage/.1,inspection.dps);
  near(inspection.base.range+inspection.rangeParts.reduce((n,p)=>n+p.value,0),inspection.range);
 }
});

test('Dwarf magazine inspection follows real release-to-release cycles and accelerated reload',()=>{
 const {g,t}=arena('forge','dw_musketeer'),inspection=defenderEffectiveStats(g,t),shotTimes=[];
 g.on((kind,row)=>{if(kind==='shot'&&row.source===t)shotTimes.push(g.combat.elapsed);});
 for(let i=0;i<600;i++)g.tick(1/60);
 const w=inspection.stats.weaponCycle,expected=w.magazine*inspection.damage/inspection.dps;
 assert.ok(shotTimes.length>w.magazine*4);
 for(let i=0;i<4;i++)near(shotTimes[(i+1)*w.magazine]-shotTimes[i*w.magazine],expected,2/60+1e-8);
 const without=new Game(currentFactionData('forge'),{seed:1,artifactEquipment:{}});without.place(18,18);Object.assign(without.towers[0],{family:'dw_musketeer',tier:1,state:'active'});
 assert.ok(inspection.dps>defenderEffectiveStats(without,without.towers[0]).dps*3,'The displayed cycle must include the real artifact/Commander reload acceleration.');
});

test('aura-only attack notes reject hit procs and range but own damage scales actual aura HP loss',()=>{
 const {g,t,e,c}=arena('crown','worldfire',{weapon:'VC-06',gloves:'VC-04',neck:'N-16',cloak:'N-02'},{buffs:false}),inspection=defenderEffectiveStats(g,t),{stats,bonuses}=combatTowerStats(t,g.towers,g.data),notes=artifactDefenderNotes(g,t,stats).join(' ');
 assert.match(notes,/Artifact Poison is inactive/);assert.match(notes,/aura footprint stays unchanged/);assert.match(notes,/native damage over time and damaging auras/);
 assert.equal(inspection.dps,0,'This is a primary-DPS field; an aura is listed separately.');
 let packet;g.on((kind,row)=>{if(kind==='damage-trace'&&row.source===t&&packet===undefined)packet=row;});
 updateFr002Tower(c,t,stats,.1,bonuses.haste);
 const aura=stats.abilities.find(a=>a.familyId==='fire-aura');assert.ok(aura&&packet);near(packet.effectiveDamage,aura.dps*.1*1.18);assert.equal(e.artifactDots,undefined);
});

test('Developer Mode inspection uses the same disabled artifact effects as real combat',()=>{
 const {g,t,e,c}=arena('crown','archer',gear('celestial'),{buffs:false});g.developerMode=true;
 const before=serializeRun(g),inspection=defenderEffectiveStats(g,t),stats=combatTowerStats(t,g.towers,g.data).stats;
 assert.deepEqual(serializeRun(g),before);assert.deepEqual(artifactDefenderNotes(g,t,stats),[]);near(inspection.damage,stats.damage);near(inspection.range,towerStats(t,g.data).range);
 let packet;g.on((kind,row)=>{if(kind==='damage-trace'&&row.source===t&&row.directHit)packet=row;});fr002Impact(c,{source:t,target:e,stats,firstPrimary:true,releaseCount:1,directTargets:[e]});near(packet.effectiveDamage,inspection.damage);
 assert.doesNotMatch(defenderEffectiveStatsMarkup(g,t),/Artifacts on this defender|Artifacts · own damage/);
});

test('native armor-reduction overlap notes use actual current profile fields in every faction',()=>{
 for(const[faction,family]of [['crown','crownofages'],['forge','dw_breachorgan'],['grove','el_tempest_bowmage']]){
  const {g,t}=arena(faction,family,{gloves:'N-09'},{buffs:false}),stats=combatTowerStats(t,g.towers,g.data).stats;
  const native=stats.abilities.find(a=>a.familyId==='armor-reduction').armorReduction;assert.ok(native>2);
  assert.ok(artifactDefenderNotes(g,t,stats).some(row=>row.includes(`stronger native reduction (${native})`)));
 }
});

test('combined v3 DOT, native poison and independent status rows replay identically after a mid-effect save',()=>{
 for(const faction of ['crown','forge','grove']){
  const {g,t,e,c,data}=arena(faction,Object.keys(currentFactionData(faction).towers)[0],{weapon:'VC-06',gloves:'N-09',ring1:'WC-02'},{buffs:false});t.attackPaused=true;e.untouchable=.75;
  c.applyEffects(e,{poisonDps:11,slow:.7,slowDuration:.5,shred:25,shredDuration:.5},t);
  const result=c.resolveDamage(e,100,'physical',{directHit:true},t);artifactPrimaryContact(c,result,{},t);
  for(let i=0;i<12;i++)g.tick(1/60);const saved=serializeRun(g),restored=restoreRun(data,JSON.parse(JSON.stringify(saved)));assert.deepEqual(serializeRun(restored),saved);
  for(let i=0;i<240;i++){g.tick(1/60);restored.tick(1/60);}
  assert.deepEqual(serializeRun(restored),serializeRun(g),'DOT budgets, source identities, expiry rows and both RNG states must survive the saved graph.');
 }
});

test('cached clients cannot start new-only equipment and rejection leaves active run and ownership intact',async()=>{
 const db=sqliteDatabase();db.sqlite.exec(fs.readFileSync('backend/migrations/0000_statistics.sql','utf8'));migrateFr010(db);
 const base='http://127.0.0.1:4197',mail=[],env={DB:db,AUTH_SECRET:'isolated-v3-independent-secret-at-least-32-characters',AUTH_BASE_URL:base,GAME_ORIGINS:base,AUTH_MAIL_MODE:'local',AUTH_LOCAL_MAIL:async row=>mail.push(row)};
 let cookie='';const call=async(route,body)=>{const r=await worker.fetch(new Request(base+route,{method:body?'POST':'GET',headers:{Origin:base,'CF-Connecting-IP':'192.0.2.219',Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:r.status,value:await r.json()};};
 try{
  await call('/api/auth/sign-up/email',{name:'Versioned equipment test',email:'artifact-v3-independent@example.test',password:'independent-local-fixture-password',callbackURL:base+'/'});
  const verified=await worker.fetch(new Request(mail.at(-1).url,{headers:{Origin:base,'CF-Connecting-IP':'192.0.2.219'}}),env);cookie=verified.headers.getSetCookie().map(row=>row.split(';')[0]).join('; ');
  const user=(await call('/api/player/session')).value.user.id;
  db.sqlite.prepare("UPDATE artifact_accounts SET owned_json='[\"N-01\",\"WV-01\"]',equipment_json='{\"weapon\":\"N-01\"}',dust=123 WHERE user_id=?").run(user);
  const first=await call('/api/player/runs',{factionId:'forge',artifactVersion:3,commanderRulesVersion:2});assert.equal(first.status,201,JSON.stringify(first.value));
  const prior=first.value.run.id;db.sqlite.prepare("UPDATE artifact_accounts SET equipment_json='{\"head\":\"WV-01\"}' WHERE user_id=?").run(user);
  const before=db.sqlite.prepare('SELECT owned_json,dust,revision,pity_json FROM artifact_accounts WHERE user_id=?').get(user);
  for(const artifactVersion of [1,2]){
   const rejected=await call('/api/player/runs',{factionId:'forge',artifactVersion,commanderRulesVersion:2,replace:true});assert.equal(rejected.status,400,JSON.stringify(rejected.value));assert.match(rejected.value.error,/Reload/);
   assert.equal(db.sqlite.prepare('SELECT run_id FROM fr010_active WHERE user_id=?').get(user).run_id,prior);
   assert.equal(db.sqlite.prepare('SELECT outcome FROM fr010_runs WHERE id=?').get(prior).outcome,'playing');
  }
  assert.deepEqual(db.sqlite.prepare('SELECT owned_json,dust,revision,pity_json FROM artifact_accounts WHERE user_id=?').get(user),before);
  const modern=await call('/api/player/runs',{factionId:'forge',artifactVersion:3,commanderRulesVersion:2,replace:true});assert.equal(modern.status,201,JSON.stringify(modern.value));assert.equal(modern.value.run.snapshot.artifactVersion,'fr011-v3');assert.deepEqual(modern.value.run.snapshot.artifactEquipment,{head:'WV-01'});
 }finally{db.sqlite.close();}
});
