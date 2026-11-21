import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ARTIFACT_CATALOG as C,ARTIFACTS,ARTIFACT_VERSION,artifactBonuses,artifactModifierText,equipArtifactSet,usesArtifactRulesV3} from '../game/core/artifacts.js';
import {artifactEffects,artifactWaveComplete,artifactPrimaryContact,artifactDamageMultiplier} from '../game/core/artifact-combat.js';
import {Game} from '../game/core/game.js';
import {currentFactionData} from '../game/core/current-data.js';
import {serializeRun,restoreRun} from '../game/core/run-state.js';
import {restoreVerifiedRun} from '../backend/verified-run-state.js';
import worker from '../backend/worker.js';
import {sqliteDatabase} from '../backend/sqlite-adapter.js';
import {migrateFr010} from '../backend/migrate-fr010.js';

const gear=id=>equipArtifactSet({},id),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const effects=(id,version=ARTIFACT_VERSION)=>artifactBonuses(gear(id),version).effects;

test('v4 has seventeen legal sets and five useful new lower-rarity sets',()=>{
 assert.equal(ARTIFACT_VERSION,'fr011-v4');assert.equal(C.catalogRevision,6);
 assert.equal(C.artifacts.length,106);assert.equal(C.sets.length,17);
 assert.equal(new Set(C.artifacts.map(a=>a.id)).size,106);
 for(const [rarity,count]of [['common',5],['uncommon',4],['rare',3],['epic',3],['legendary',2]])assert.equal(C.sets.filter(s=>s.rarity===rarity).length,count);
 for(const set of C.sets){const size={common:2,uncommon:4,rare:6,epic:8,legendary:10}[set.rarity];assert.equal(set.pieceCount,size);assert.equal(Object.keys(gear(set.id)).length,size);assert.equal(C.artifacts.filter(a=>a.setId===set.id).length,size);}
 const expected={'quicksilver-drill':{speed:.08},farwatch:{rangeTiles:1},hearthwarden:{gold:100,keepHealth:2},'battle-cadence':{speed:.15},'crimson-covenant':{damage:.03,keepHealth:4,waveHeal:1}};
 for(const[id,values]of Object.entries(expected)){const full=effects(id);for(const[k,v]of Object.entries(values))near(full[k],v);for(const item of C.artifacts.filter(a=>a.setId===id)){const single=artifactBonuses({[item.slot==='ring'?'ring1':item.slot]:item.id}).effects;for(const[k,v]of Object.entries(item.modifiers))assert.ok(full[k]>v,`${id} ${k} must exceed one item`);}}
});

test('requested v4 totals and immunity replacements are real while v3 retains its exact totals',()=>{
 const expected={'iron-legion':{damage:.40,bossDamage:.15},celestial:{damage:.5,speed:.35},necromancer:{shred:20,slow:.25,immunityReduction:.3},'stewards-kit':{gold:400,cp:4,keepHealth:2},'stormwing-vanguard':{immunityReduction:.08},'royal-architect':{immunityReduction:.1},'watchmans-vigil':{immunityReduction:.05}};
 for(const[id,values]of Object.entries(expected))for(const[k,v]of Object.entries(values))near(effects(id)[k],v);
 for(const a of C.artifacts){assert.ok(!Object.hasOwn(a.modifiers,'controlResistance'));assert.doesNotMatch(a.description,/Disarm|Dread/);}
 for(const s of C.sets){for(const b of Object.values(s.bonuses))assert.ok(!Object.hasOwn(b,'controlResistance'));assert.doesNotMatch(s.description,/Disarm|Dread/);}
 near(effects('celestial','fr011-v3').damage,.4);near(effects('iron-legion','fr011-v3').damage,.37);near(effects('iron-legion','fr011-v3').bossDamage,.12);near(effects('necromancer','fr011-v3').shred,8);near(effects('stewards-kit','fr011-v3').gold,100);near(effects('stewards-kit','fr011-v3').cp,2);near(effects('stormwing-vanguard','fr011-v3').controlResistance,.15);
 near(artifactBonuses({cloak:'N-10'}).effects.immunityReduction,.08);near(artifactBonuses({cloak:'N-10'}).effects.controlResistance,0);near(artifactBonuses({cloak:'N-10'},'fr011-v3').effects.controlResistance,.2);
 for(const version of ['fr011-v1','fr011-v2','fr011-v3']){assert.throws(()=>artifactBonuses({gloves:'QD-01'},version),/not available/);assert.ok(!Object.hasOwn(artifactBonuses({},version).effects,'waveHeal'));}
 assert.equal(Object.keys(C.compatibilityEffects['fr011-v3'].itemModifiers).length,92);assert.equal(Object.keys(C.compatibilityEffects['fr011-v3'].setBonuses).length,12);
 assert.equal(usesArtifactRulesV3('fr011-v4'),true);
});

test('aggregate poison and burn show power bonuses plus an understandable final-hit example',()=>{
 const poison=artifactModifierText(effects('venom-covenant')).join(' '),burn=artifactModifierText(effects('ashen-dragon')).join(' ');
 assert.match(poison,/\+100% artifact poison damage/);assert.match(poison,/primary hit removes 100 HP, add 20 total Magical poison damage over 3s/);assert.match(poison,/never the enemy’s maximum HP/);assert.match(poison,/includes the artifact poison damage bonus above/);
 assert.match(burn,/\+100% artifact burn damage/);assert.match(burn,/add 20 total Magical burn damage over 2s/);
 assert.match(artifactModifierText(effects('crimson-covenant')).join(' '),/successfully completed wave.*missing keep health/);
});

test('all alliances receive capped per-wave Vampire healing, never maximum health growth',()=>{
 for(const faction of ['crown','forge','grove']){
  const data=currentFactionData(faction),g=new Game(data,{seed:5299,artifactEquipment:gear('crimson-covenant')});assert.equal(g.maxLives,34);g.lives=29;g.phase='combat';g.combat.enemies=[];g.combat.spawnQueue=[];
  const snapshot=serializeRun(g),h=restoreRun(data,structuredClone(snapshot));g.completeWave();h.completeWave();assert.equal(g.lives,30);assert.equal(g.maxLives,34);assert.equal(g.completedWaves,1);assert.deepEqual(serializeRun(g),serializeRun(h));
  // Returning to the same combat wave cannot replay its healing charge.
  g.phase='combat';g.round=1;assert.equal(artifactWaveComplete(g),0);assert.equal(g.lives,30);g.round=2;g.lives=g.maxLives;assert.equal(artifactWaveComplete(g),0);g.lives--;assert.equal(artifactWaveComplete(g),0);assert.equal(g.lives,33);
  g.round=3;g.lives=33;assert.equal(artifactWaveComplete(g),1);assert.equal(g.lives,34);assert.equal(g.maxLives,34);
  const valid=serializeRun(g),verified=restoreVerifiedRun(data,{snapshot_json:JSON.stringify(valid),loadout_json:'{}',artifact_loadout_json:JSON.stringify(g.artifactEquipment),faction_id:faction,ruleset:data.rulesetRevision});assert.equal(verified.lives,34);assert.equal(verified.maxLives,34);
 }
});

test('Vampire does not revive a defeated keep, heal a failed wave or affect Developer Mode',()=>{
 const data=currentFactionData('forge');
 for(const [phase,lives,developerMode]of [['lost',0,false],['combat',0,false],['build',20,false],['combat',20,true]]){const g=new Game(data,{artifactEquipment:gear('crimson-covenant')});Object.assign(g,{phase,lives,developerMode});assert.equal(artifactWaveComplete(g),0);assert.equal(g.lives,lives);assert.equal(g.maxLives,34);}
 const g=new Game(data,{artifactEquipment:gear('crimson-covenant')});g.phase='combat';g.lives=0;g.combat.spawnQueue=[];g.combat.enemies=[];g.combat.update(1/60);assert.equal(g.phase,'lost');assert.equal(g.lives,0);assert.equal(g.completedWaves,0);
 // Missing health may be restored after a wave survived with nonfatal leaks.
 const survived=new Game(data,{artifactEquipment:gear('crimson-covenant')});survived.phase='combat';survived.lives=1;survived.leaks=33;survived.combat.spawnQueue=[];survived.combat.enemies=[];survived.combat.update(1/60);assert.equal(survived.completedWaves,1);assert.equal(survived.lives,2);
});

test('twenty artifact armor reduction is applied by real primary contact and old v3 still applies eight',()=>{
 for(const [version,shred]of [['fr011-v3',8],['fr011-v4',20]]){const g=new Game(currentFactionData('crown'),{artifactEquipment:gear('necromancer'),artifactVersion:version});g.place(18,18);const t=g.towers[0];t.state='active';g.phase='combat';const e=g.combat.spawn('host_01');Object.assign(e,{hp:10000,maxHp:10000,armor:30,physicalImmune:false,magicImmune:false});artifactPrimaryContact(g.combat,{enemy:e,effectiveDamage:10},{},t);assert.equal(e.statuses.artifactShred.amount,shred);assert.equal(g.combat.resolveDamage(e,1,'physical',{},t).effectiveArmor,30-shred);}
 const g=new Game(currentFactionData('crown'),{artifactEquipment:gear('celestial')});near(artifactDamageMultiplier(g,{statuses:{}}),1.5);
});

test('capability v4 is frozen per run and a stale v3 request cannot abandon a run with new equipment',async()=>{
 const db=sqliteDatabase();db.sqlite.exec(fs.readFileSync('backend/migrations/0000_statistics.sql','utf8'));migrateFr010(db);
 const base='http://127.0.0.1:4199',mail=[],env={DB:db,AUTH_SECRET:'isolated-v4-regression-secret-at-least-32-characters',AUTH_BASE_URL:base,GAME_ORIGINS:base,AUTH_MAIL_MODE:'local',AUTH_LOCAL_MAIL:async row=>mail.push(row)};
 let cookie='';const call=async(route,body)=>{const r=await worker.fetch(new Request(base+route,{method:body?'POST':'GET',headers:{Origin:base,'CF-Connecting-IP':'192.0.2.222',Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:r.status,value:await r.json()};};
 try{
  await call('/api/auth/sign-up/email',{name:'V4 frozen equipment',email:'artifact-v4-local@example.test',password:'local-only-v4-fixture-password',callbackURL:base+'/'});
  const verified=await worker.fetch(new Request(mail.at(-1).url,{headers:{Origin:base,'CF-Connecting-IP':'192.0.2.222'}}),env);cookie=verified.headers.getSetCookie().map(row=>row.split(';')[0]).join('; ');
  const user=(await call('/api/player/session')).value.user.id;db.sqlite.prepare("UPDATE artifact_accounts SET owned_json='[\"QD-01\",\"N-01\"]',equipment_json='{\"weapon\":\"N-01\"}' WHERE user_id=?").run(user);
  const old=await call('/api/player/runs',{factionId:'forge',artifactVersion:3,commanderRulesVersion:2});assert.equal(old.status,201);assert.equal(old.value.run.snapshot.artifactVersion,'fr011-v3');
  db.sqlite.prepare("UPDATE artifact_accounts SET equipment_json='{\"gloves\":\"QD-01\"}' WHERE user_id=?").run(user);
  for(const artifactVersion of [1,2,3]){const rejected=await call('/api/player/runs',{factionId:'forge',artifactVersion,commanderRulesVersion:2,replace:true});assert.equal(rejected.status,400);assert.match(rejected.value.error,/Reload/);assert.equal(db.sqlite.prepare('SELECT outcome FROM fr010_runs WHERE id=?').get(old.value.run.id).outcome,'playing');assert.equal(db.sqlite.prepare('SELECT run_id FROM fr010_active WHERE user_id=?').get(user).run_id,old.value.run.id);}
  const fresh=await call('/api/player/runs',{factionId:'forge',artifactVersion:4,commanderRulesVersion:2,replace:true});assert.equal(fresh.status,201,JSON.stringify(fresh.value));assert.equal(fresh.value.run.snapshot.artifactVersion,'fr011-v4');assert.deepEqual(fresh.value.run.snapshot.artifactEquipment,{gloves:'QD-01'});
 }finally{db.sqlite.close();}
});
