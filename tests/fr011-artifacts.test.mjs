import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ARTIFACT_CATALOG as C,ARTIFACTS,artifactBonuses,equipArtifactSet,validateArtifactEquipment,chestTier,rollArtifactChest} from '../game/core/artifacts.js';
import {Game} from '../game/core/game.js';
import {currentFactionData} from '../game/core/current-data.js';
import {serializeRun,restoreRun} from '../game/core/run-state.js';
import {artifactPrimaryContact,updateArtifactDots,artifactDamageMultiplier} from '../game/core/artifact-combat.js';
import {combatTowerStats} from '../game/core/math.js';
import {sqliteDatabase} from '../backend/sqlite-adapter.js';
import {migrateFr010} from '../backend/migrate-fr010.js';
import {artifactMutation,artifactProfile,artifactRewardStatements} from '../backend/artifact-store.js';
const all=C.artifacts.map(a=>a.id),gear=id=>equipArtifactSet({},id),data=currentFactionData('crown');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('FR011 catalog has 106 unique illustrated artifacts, legal variable-size sets and exact approved full bonuses',()=>{
 assert.equal(all.length,106);assert.equal(new Set(all).size,106);assert.equal(C.sets.length,17);
 for(const a of C.artifacts){assert.ok(fs.existsSync('public/'+a.art));assert.ok(a.description);}
 for(const s of C.sets){assert.equal(C.artifacts.filter(a=>a.setId===s.id).length,s.pieceCount);assert.equal(Object.keys(gear(s.id)).length,s.pieceCount);}
 const expected={'iron-legion':{damage:.4,bossDamage:.15},'stormwing-vanguard':{speed:.31,rangeTiles:1.5,immunityReduction:.08},'winter-court':{rangeTiles:3,slow:.12,freezeChance:.10,freezeDuration:.8},'venom-covenant':{poisonFraction:.2,healingReduction:.4},'ashen-dragon':{burnFraction:.2,emberTransfer:1},'royal-architect':{gold:600,cp:6,keepHealth:8,immunityReduction:.10,reinforceKeep:6}};
 for(const[id,values]of Object.entries(expected))for(const[k,v]of Object.entries(values))close(artifactBonuses(gear(id)).effects[k],v);
 assert.throws(()=>validateArtifactEquipment({head:'N-03'}));assert.throws(()=>validateArtifactEquipment({ring1:'N-03',ring2:'N-03'}));assert.throws(()=>validateArtifactEquipment({weapon:'N-01'},[]));assert.throws(()=>validateArtifactEquipment({head:'constructor'}));
});
test('FR011 set equip preserves an already equipped right ring and replaces only conflicting slots',()=>{const ring=C.artifacts.find(a=>a.setId==='winter-court'&&a.slot==='ring'),before={ring2:ring.id,weapon:'N-01'},after=equipArtifactSet(before,'winter-court',all);assert.equal(after.ring2,ring.id);assert.equal(new Set(Object.values(after)).size,Object.keys(after).length);assert.equal(artifactBonuses(after).sets['winter-court'],6);});
test('FR011 chest tiers and guarantees work through repeated Endless bosses',()=>{
 for(let tier=1;tier<=5;tier++){const c=C.chests[tier-1];assert.equal(chestTier(c.bossId,tier*10),tier);assert.equal(chestTier(c.bossId,60),Math.max(4,tier));assert.equal(chestTier(c.bossId,100),5);}
 assert.equal(chestTier('unknown',100),null);
 for(let tier=1;tier<=5;tier++){let account={owned:all,dust:0,pity:{}},miss=0;const chest=C.chests[tier-1],ranks=C.rarities.map(r=>r.id);for(let seed=0;seed<500;seed++){const r=rollArtifactChest(account,tier,seed);assert.ok(r.items.length===0||r.items.length===chest.draws);assert.equal(new Set(r.items.map(i=>i.id)).size,r.items.length);const good=r.items.some(i=>ranks.indexOf(ARTIFACTS[i.id].rarity)>=ranks.indexOf(chest.pityRarity));miss=good?0:miss+1;assert.ok(miss<chest.pityEvery);assert.ok(r.dustGained>=chest.baseDust);account=r;}}
 assert.deepEqual(rollArtifactChest({},5,42),rollArtifactChest({},5,42));
});
test('FR011 starting bonuses, primary attack speed/range and frozen save restore work for all alliances',()=>{
 for(const faction of ['crown','forge','grove']){const d=currentFactionData(faction),g=new Game(d,{seed:42,artifactEquipment:gear('royal-architect')});assert.equal(g.maxLives,38);assert.equal(g.economy.gold,690);assert.equal(g.commandPoints.value,9);g.place(18,18);const h=restoreRun(d,JSON.parse(JSON.stringify(serializeRun(g))));assert.deepEqual(serializeRun(g),serializeRun(h));assert.equal(h.economy.gold,690);}
 const g=new Game(data,{artifactEquipment:gear('stormwing-vanguard')});for(const[x,z]of [[18,18],[17,18],[19,18],[18,17],[18,19]])g.place(x,z);g.keep();const t=g.towers.find(t=>t.state==='active'),stats=combatTowerStats(t,g.towers,g.data);assert.ok(stats.bonuses.haste>=1.31);
});
test('FR011 artifact poison distributes the exact primary-hit budget, survives save and never uses enemy max HP',()=>{
 const g=new Game(data,{seed:5,artifactEquipment:gear('venom-covenant')});g.place(18,18);const t=g.towers[0];t.state='active';g.phase='combat';const e=g.combat.spawn('host_01');e.hp=10000;e.maxHp=1e9;g.combat.spawnQueue=[];artifactPrimaryContact(g.combat,{enemy:e,effectiveDamage:100},{},t);assert.ok(e.artifactDots.poison.size);const h=restoreRun(data,JSON.parse(JSON.stringify(serializeRun(g))));assert.deepEqual(serializeRun(g),serializeRun(h));let total=0;const c={game:g,elapsed:0,resolveDamage:(enemy,amount)=>total+=amount};for(let i=1;i<=180;i++){c.elapsed=i/60;updateArtifactDots(c,e);}close(total,20);assert.equal(e.artifactDots.poison.size,0);
 g.artifactState.effects={damage:.45,bossDamage:.25,conditionalPoison:.2,conditionalBurn:.2};e.boss=true;e.statuses={poison:{time:1},burn:{time:1}};close(artifactDamageMultiplier(g,e),1.9);
});
test('FR011 actual primary hits apply artifact poison in every alliance, including legacy Human champion attacks',()=>{
 for(const faction of ['crown','forge','grove']){
  const d=currentFactionData(faction),g=new Game(d,{seed:42,artifactEquipment:gear('venom-covenant')});for(const[x,z]of [[18,18],[17,18],[19,18],[18,17],[18,19]])g.place(x,z);g.keep();g.startCombat();const t=g.towers.find(t=>t.state==='active');t.family=Object.keys(d.towers).find(id=>d.towers[id].advanced);t.tier=1;g.combat.spawnQueue=[];const e=g.combat.spawn('host_01');Object.assign(e,{x:t.x+1,z:t.z,hp:1e9,maxHp:1e9,speed:0,physicalImmune:false,magicImmune:false,armor:0});g.advanceTicks(180);assert.ok(e.artifactDots?.poison?.size,faction+' primary attack creates artifact poison');const copy=restoreRun(d,JSON.parse(JSON.stringify(serializeRun(g))));g.advanceTicks(180);copy.advanceTicks(180);assert.deepEqual(serializeRun(g),serializeRun(copy));
 }
});
test('FR011 armor reduction includes reactive armor and never creates negative effective armor',()=>{
 const g=new Game(data,{artifactEquipment:{gloves:'N-09'}});g.place(18,18);const t=g.towers[0];t.state='active';g.phase='combat';const e=g.combat.spawn('host_01');Object.assign(e,{hp:1000,armor:0,reactiveStacks:3,reactiveArmor:2});artifactPrimaryContact(g.combat,{enemy:e,effectiveDamage:10},{},t);assert.equal(g.combat.resolveDamage(e,1,'physical',{},t).effectiveArmor,4);e.reactiveStacks=0;assert.equal(g.combat.resolveDamage(e,1,'physical',{},t).effectiveArmor,0);e.statuses.shred={amount:8,time:2};e.armor=10;assert.equal(g.combat.resolveDamage(e,1,'physical',{},t).effectiveArmor,2);
});
function fixture(){const db=sqliteDatabase();db.sqlite.exec(fs.readFileSync('backend/migrations/0000_statistics.sql','utf8'));migrateFr010(db);db.sqlite.prepare('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,?,?,?)').run('fr011','Commander','fr011@example.test',1,0,0);const g=new Game(data,{seed:5,accountId:'fr011',runId:crypto.randomUUID()});db.sqlite.prepare("INSERT INTO fr010_runs(id,user_id,faction_id,ruleset,seed,snapshot_json,loadout_json,started_at,updated_at) VALUES(?,?,?,?,?,?,?,0,0)").run(g.runId,'fr011','crown',g.data.rulesetRevision,5,JSON.stringify(serializeRun(g)),'{}');return {db,g};}

test('dismantling credits the rarity value once and preserves equipped gear and saved runs',async()=>{
 const {db,g}=fixture();
 try{
  const user='fr011';
  await artifactProfile(db,user);
  const samples=C.rarities.map(rarity=>C.artifacts.find(item=>item.rarity===rarity.id));
  const equipped=C.artifacts.find(item=>item.slot==='weapon'&&!samples.includes(item));
  const levelSlot=samples[0].slot==='ring'?'ring1':samples[0].slot;
  db.sqlite.prepare('UPDATE artifact_accounts SET owned_json=?,equipment_json=?,presets_json=? WHERE user_id=?').run(
   JSON.stringify([...samples.map(item=>item.id),equipped.id]),
   JSON.stringify({weapon:equipped.id}),
   JSON.stringify([null,{name:'Saved',equipment:{[levelSlot]:samples[0].id}}]),
   user,
  );
  const query=db.sqlite.prepare('SELECT snapshot_json FROM fr010_runs WHERE id=?');
  const snapshot=query.get(g.runId).snapshot_json;
  await assert.rejects(artifactMutation(db,user,'salvage',{requestId:crypto.randomUUID(),revision:0,artifactId:equipped.id}),/Unequip/);
  let balance=0;
  for(const [revision,item] of samples.entries()){
   const request={requestId:crypto.randomUUID(),revision,artifactId:item.id,dustGained:100000};
   const expected=[5,10,20,40,80][revision];
   const first=await artifactMutation(db,user,'salvage',request);
   assert.equal(first.receipt.dustGained,expected);
   assert.equal(first.artifacts.dust,balance+=expected);
   assert.equal(first.artifacts.owned.includes(item.id),false);
   const replay=await artifactMutation(db,user,'salvage',request);
   assert.deepEqual(replay.receipt,first.receipt);
   assert.equal(replay.artifacts.dust,balance);
   await assert.rejects(artifactMutation(db,user,'salvage',{...request,requestId:crypto.randomUUID(),revision:revision+1}),/do not own/);
  }
  const after=await artifactProfile(db,user);
  assert.deepEqual(after.owned,[equipped.id]);
  assert.deepEqual(after.equipment,{weapon:equipped.id});
  assert.deepEqual(after.presets,[null,{name:'Saved',equipment:{}}]);
  assert.equal(after.lastOpening,null);
  assert.equal(query.get(g.runId).snapshot_json,snapshot);
 }finally{db.sqlite.close();}
});

test('FR012 partial set equip verifies ownership and remains idempotent',async()=>{
 const {db}=fixture();try{await artifactProfile(db,'fr011');const owned=['CE-01','CE-09','CE-10','N-01'];db.sqlite.prepare('UPDATE artifact_accounts SET owned_json=?,equipment_json=? WHERE user_id=?').run(JSON.stringify(owned),JSON.stringify({weapon:'N-01',ring2:'CE-09'}),'fr011');const request={requestId:crypto.randomUUID(),revision:0,artifactId:'celestial',ownedOnly:true};const result=await artifactMutation(db,'fr011','equip-set',request);assert.equal(result.artifacts.equipment.weapon,'N-01');assert.equal(result.artifacts.equipment.head,'CE-01');assert.equal(result.artifacts.equipment.ring2,'CE-09');assert.equal(result.artifacts.equipment.ring1,'CE-10');assert.equal(Object.keys(result.artifacts.equipment).length,4);assert.deepEqual((await artifactMutation(db,'fr011','equip-set',request)).receipt,result.receipt);await assert.rejects(artifactMutation(db,'fr011','equip-set',{...request,ownedOnly:false}),/identity/);await assert.rejects(artifactMutation(db,'fr011','equip-set',{...request,requestId:crypto.randomUUID(),revision:1,ownedOnly:false}),/Collect all/);await assert.rejects(artifactMutation(db,'fr011','equip-set',{...request,requestId:crypto.randomUUID(),revision:1,artifactId:'necromancer'}),/own any/);assert.equal((await artifactProfile(db,'fr011')).revision,1);}finally{db.sqlite.close();}
});
test('FR011 chest grants are unique, locked until wave completion and released on defeat',async()=>{
 const {db,g}=fixture();try{const kills=[{spawnId:77,bossId:'host_10',wave:10}];await db.batch(artifactRewardStatements(db,'fr011',g.runId,g,kills,'1=1',[]));await db.batch(artifactRewardStatements(db,'fr011',g.runId,g,kills,'1=1',[]));let p=await artifactProfile(db,'fr011');assert.equal(p.chests.length,1);assert.equal(p.chests[0].status,'locked');g.phase='lost';await db.batch(artifactRewardStatements(db,'fr011',g.runId,g,[],'1=1',[]));p=await artifactProfile(db,'fr011');assert.equal(p.chests[0].status,'ready');assert.ok(!('seed' in p.chests[0]));}finally{db.sqlite.close();}
});
test('FR011 opening retries, stale devices, crafting and presets cannot double-spend or equip unowned artifacts',async()=>{
 const {db,g}=fixture();try{g.phase='lost';await db.batch(artifactRewardStatements(db,'fr011',g.runId,g,[{spawnId:1,bossId:'host_50',wave:50}],'1=1',[]));const req={requestId:crypto.randomUUID(),revision:0,tier:5,count:1},first=await artifactMutation(db,'fr011','open',req),retry=await artifactMutation(db,'fr011','open',req);assert.deepEqual(first.receipt,retry.receipt);assert.equal(first.artifacts.dust,retry.artifacts.dust);assert.ok([0,2].includes(first.receipt.items.length));assert.ok(first.receipt.baseDust>0);await assert.rejects(artifactMutation(db,'fr011','open',{...req,requestId:crypto.randomUUID()}),/changed/);await assert.rejects(artifactMutation(db,'fr011','equipment',{requestId:crypto.randomUUID(),revision:1,equipment:Object.fromEntries([[C.artifacts.find(a=>!first.artifacts.owned.includes(a.id)).slot==='ring'?'ring1':C.artifacts.find(a=>!first.artifacts.owned.includes(a.id)).slot,C.artifacts.find(a=>!first.artifacts.owned.includes(a.id)).id]])}),/own/);
 db.sqlite.prepare("UPDATE artifact_accounts SET dust=1000,highest_tier=3,owned_json='[]' WHERE user_id=?").run('fr011');const craft={requestId:crypto.randomUUID(),revision:1,artifactId:'N-11'},made=await artifactMutation(db,'fr011','craft',craft);assert.equal(made.artifacts.dust,680);assert.equal((await artifactMutation(db,'fr011','craft',craft)).artifacts.dust,680);const saved=await artifactMutation(db,'fr011','save-preset',{requestId:crypto.randomUUID(),revision:2,index:2,preset:{name:'Boss hunt',equipment:{head:'N-11'}}});assert.equal(saved.artifacts.presets[2].name,'Boss hunt');assert.deepEqual(saved.artifacts.equipment,{});
 }finally{db.sqlite.close();}
});
