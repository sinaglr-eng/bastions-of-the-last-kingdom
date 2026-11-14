import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../game/core/game.js';
import {currentFactionData} from '../game/core/current-data.js';
import {serializeRun,restoreRun} from '../game/core/run-state.js';
import {replayCommands} from '../game/core/run-journal.js';
import {endlessWave} from '../game/core/endless.js';
import {GENERAL_SKILLS} from '../game/core/general.js';
import {recruitSlot} from '../game/core/recruit-slots.js';
import {combatTowerStats} from '../game/core/math.js';
import {updateFr002Tower} from '../game/core/fr002-combat.js';
import {loadCurrentDatasets} from '../tools/current-datasets.mjs';

const data=currentFactionData('crown'),same=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));
function placed(g){for(const [x,z]of [[18,18],[17,18],[19,18],[18,17],[18,19]])assert.equal(g.place(x,z),true);}
function combat(loadout={}){const g=new Game(data,{seed:4,loadout});placed(g);g.keep();g.startCombat();return g;}

test('FR010 all 24 families have exactly A–H; approved combat profiles stay exact',()=>{
 const legacy=loadCurrentDatasets();for(const faction of ['crown','forge','grove']){const d=currentFactionData(faction),basics=Object.entries(d.towers).filter(([,u])=>!u.advanced);assert.equal(basics.length,8);assert.equal(new Set(basics.map(([id,u])=>{assert.equal(u.unitCode,recruitSlot(id));return u.unitCode;})).size,8);for(const [id,u]of Object.entries(d.towers)){const{unitCode,...a}=u,{unitCode:old,...b}=legacy[faction].towers[id];same(a,b);}}
});
test('FR010 loadout, starting resources and RNG survive save without repeated income',()=>{
 const g=new Game(data,{seed:42,loadout:{'field-logistics':3,quartermaster:3,'deep-refit':3}});assert.equal(g.commandPoints.value,13);assert.equal(g.economy.gold,1090);g.place(18,18);const h=restoreRun(data,JSON.parse(JSON.stringify(serializeRun(g))));same(serializeRun(g),serializeRun(h));for(let i=0;i<50;i++)assert.equal(g.rng(),h.rng());assert.equal(h.economy.gold,1090);assert.equal(h.commandPoints.value,13);
 assert.throws(()=>new Game(data,{loadout:Object.fromEntries(Object.keys(GENERAL_SKILLS).map(k=>[k,1]))}));
});
test('FR010 complete in-flight/status/pulse object graph resumes with exact next physics',()=>{
 const g=combat();g.advanceTicks(600);const first=g.combat.enemies.find(e=>!e.dead);if(first){g.combat.applyEffects(first,{poisonDps:3,type:'magical'},g.towers.find(t=>t.state==='active'));}
 const h=restoreRun(data,JSON.parse(JSON.stringify(serializeRun(g))));g.recordCommands=false;h.recordCommands=false;for(let i=0;i<120;i++){g.advanceTicks(1);h.advanceTicks(1);}same(serializeRun(g),serializeRun(h));
});
test('FR010 recorded legal commands reproduce a played wave without trusting a client score',()=>{
 const g=new Game(data,{seed:42}),initial=serializeRun(g);placed(g);g.keep();g.startCombat();g.advanceTicks(600,{record:true});const h=restoreRun(data,initial);replayCommands(h,g.journal,{maxTicks:600});same(serializeRun(g),serializeRun(h));
});
test('FR010 Deep Refit preserves ordinary downgrade and charges only a valid two-rank keep',()=>{
 for(const [level,cost]of [[1,600],[2,500],[3,400]]){const g=new Game(data,{loadout:{'deep-refit':level}});g.draft.forced={family:'archer',tier:3};g.draft.roll(0);placed(g);g.economy.gold=cost-1;assert.equal(g.downgrade(2),false);assert.equal(g.selection.tier,3);g.economy.gold=cost;assert.equal(g.downgrade(2),true);assert.equal(g.selection.tier,1);assert.equal(g.economy.gold,0);assert.equal(g.phase,'ready');}
});
test('FR010 Recruitment Focus is paid once, waits for next draft and is spent by that draft',()=>{
 const g=new Game(data,{loadout:{'recruitment-focus':3}});assert.equal(g.activateGeneral('recruitment-focus','B'),true);assert.equal(g.commandPoints.value,2);assert.equal(g.draft.focus,undefined);assert.equal(g.activateGeneral('recruitment-focus','C'),false);g.phase='reward';g.nextRound();assert.equal(g.draft.focus.slot,'B');assert.equal(g.general.pendingFocus,null);placed(g);g.keep();assert.equal(g.general.draftFocus,null);g.phase='reward';g.nextRound();assert.equal(g.draft.focus,null);
});
test('FR010 Focus probabilities add percentage points without changing rank odds',()=>{
 const g=new Game(data,{seed:42,loadout:{'recruitment-focus':3}});g.activateGeneral('recruitment-focus','B');g.phase='reward';g.nextRound();const count={};let rankTwo=0;for(let i=0;i<50000;i++){const d=g.draft.generate({});count[d.family]=(count[d.family]||0)+1;if(d.tier>1)rankTwo++;}assert.ok(Math.abs(count.archer/50000-.245)<.008);assert.equal(rankTwo,0);
});
test('FR010 all combat skills cost 3 CP, reject repeat and last exactly 20 combat seconds',()=>{
 const g=combat({'morale-boost':3,'war-horn':3,'blood-wrath':3});g.commandPoints.value=9;for(const id of ['morale-boost','war-horn','blood-wrath'])assert.equal(g.activateGeneral(id),true);assert.equal(g.commandPoints.value,0);assert.equal(g.activateGeneral('war-horn'),false);g.paused=true;g.tick(10);assert.equal(g.general.remaining('war-horn'),20);g.combat.elapsed=20;assert.equal(g.general.slow,0);assert.equal(g.general.multiplier('blood-wrath'),1);
});
test('FR010 War Horn ignores flying/hidden/physical/magical immunity and boss reduction',()=>{
 for(const boss of [false,true]){const g=combat({'war-horn':3});g.activateGeneral('war-horn');const e=Object.assign(g.combat.spawn('host_01'),{boss,flying:true,physicalImmune:true,magicImmune:true,cloaked:true,x:8,z:8,speed:1,route:[{x:100,z:8}],pathIndex:0,hp:1e9,maxHp:1e9});for(const t of g.towers)t.attackPaused=true;g.combat.update(.001);assert.ok(Math.abs(e.currentSpeed-.2)<1e-8);}
});
test('FR010 Blood Wrath multiplies damage once after source calculation, preserves immunity',()=>{
 const g=combat({'blood-wrath':3}),t=g.towers.find(t=>t.state==='active'),e=Object.assign(g.combat.spawn('host_01'),{hp:1e9,maxHp:1e9,armor:0,physicalImmune:false,magicImmune:false});g.activateGeneral('blood-wrath');assert.equal(g.combat.resolveDamage(e,100,'physical',{},t).effectiveDamage,200);e.physicalImmune=true;assert.equal(g.combat.resolveDamage(e,100,'physical',{},t).effectiveDamage,0);
});
test('FR010 Morale Boost uses its own multiplier without mutating support aura definitions',()=>{
 const g=combat({'morale-boost':3}),t=g.towers.find(t=>t.state==='active'),before=combatTowerStats(t,g.towers,data);g.activateGeneral('morale-boost');const after=combatTowerStats(t,g.towers,data);assert.equal(after.bonuses.haste,before.bonuses.haste*2);assert.equal(after.stats.damage,before.stats.damage);
});
test('FR010 flawless series resets on real loss, ignores later healing and does not count damaged wave',()=>{
 const g=new Game(data);for(let i=1;i<=20;i++){g.emit('wave',{});g.emit('wave-complete',{round:i});}assert.equal(g.progress.streak,20);assert.deepEqual(g.progress.grants().filter(x=>x.id.startsWith('streak:')).map(x=>x.reward),[1,2]);g.emit('wave',{});g.emit('leak',{healthLost:1});g.emit('recover',{amount:1});g.emit('wave-complete',{round:21});assert.equal(g.progress.streak,0);g.emit('wave',{});g.emit('wave-complete',{round:22});assert.equal(g.progress.streak,1);assert.equal(g.progress.streakBest,20);
});
test('FR010 wave 50 gives one milestone and advances to 51 without resetting the army',()=>{
 const g=new Game(data);g.round=50;g.phase='combat';let milestones=0;g.on(t=>{if(t==='campaign-cleared')milestones++;});g.completeWave();assert.equal(g.round,51);assert.equal(g.phase,'build');assert.equal(milestones,1);assert.equal(g.progress.campaign,true);assert.equal(g.wave.groups.reduce((s,x)=>s+x.count,0),28);
});
test('FR010 Endless generator is seeded, finite at extreme waves and preserves source abilities',()=>{
 for(const f of ['crown','forge','grove'])for(const n of [51,60,75,100,1000,10000]){const d=currentFactionData(f),a=endlessWave(d,42,n);same(a,endlessWave(d,42,n));assert.equal(a.groups.reduce((s,g)=>s+g.count,0),28);assert.equal(a.boss,n%10===0);assert.equal(a.groups.filter(g=>d.enemies[g.type].boss).length,n%10===0?1:0);for(const group of a.groups){assert.ok(Number.isFinite(group.hp)&&group.hp>0);assert.ok(Number.isFinite(group.armor));}assert.equal(a.scaling.armor,.5*(n-50));}
});
test('FR010 no-space draft closes with 0–4 candidates without consuming skipped RNG',()=>{
 for(let count=0;count<5;count++){const g=new Game(data);for(let i=0;i<count;i++)g.place(10+i,10);Object.defineProperty(g,'hasLegalRecruitSpace',{value:false});const state=g.rng.getState();assert.equal(g.finishRecruitment(),true);assert.equal(g.rng.getState(),state);if(count){assert.equal(g.phase,'select');assert.equal(g.keep(),true);}assert.equal(g.phase,'ready');assert.equal(g.startCombat(),true);}
 const open=new Game(data);assert.equal(open.finishRecruitment(),false);
});
test('FR010 exact score remains an integer beyond Number.MAX_SAFE_INTEGER',()=>{
 const g=new Game(data);g.awardScore('9007199254740991');g.awardScore('10');assert.equal(g.scoreExact,'9007199254741001');same(serializeRun(g),serializeRun(restoreRun(data,serializeRun(g))));
});

test('FR010 Morale doubles continuous primary fire without doubling passive fire auras',()=>{
 const d=currentFactionData('forge'),g=new Game(d,{loadout:{'morale-boost':3}}),t={id:1,family:'dw_steamharpooner',tier:1,state:'active',x:18,z:18,cooldown:0};g.towers.push(t);g.phase='combat';
 const e={id:1,hp:1e8,maxHp:1e8,x:19,z:18,dead:false,statuses:{},armor:0};g.combat.enemies=[e];g.combat.targetList=()=>[e];
 const {stats,bonuses}=combatTowerStats(t,g.towers,d);let dealt=0;g.combat.resolveDamage=(_e,amount)=>{dealt+=amount;return {effectiveDamage:amount};};
 updateFr002Tower(g.combat,t,stats,1/60,bonuses.haste);const ordinary=dealt;dealt=0;g.activateGeneral('morale-boost');updateFr002Tower(g.combat,t,stats,1/60,bonuses.haste*2);assert.ok(ordinary>0);assert.ok(Math.abs(dealt-ordinary*2)<1e-8);
});

test('FR010 Morale accelerates magazine reload and stops accelerating immediately on expiry',()=>{
 const d=currentFactionData('forge'),g=new Game(d,{loadout:{'morale-boost':3}}),t={id:1,family:'dw_musketeer',tier:6,state:'active',x:18,z:18,cooldown:0};g.towers.push(t);g.phase='combat';
 const e={id:1,hp:1e8,maxHp:1e8,x:19,z:18,dead:false,statuses:{}};g.combat.targetList=()=>[e];g.activateGeneral('morale-boost');
 for(let i=0;i<100&&!t.weaponCycleState?.waitRemaining;i++){g.combat.elapsed+=1/60;const {stats,bonuses}=combatTowerStats(t,g.towers,d);updateFr002Tower(g.combat,t,stats,1/60,bonuses.haste);}
 const wait=t.weaponCycleState.waitRemaining;assert.ok(wait>0);let s=combatTowerStats(t,g.towers,d);g.combat.elapsed+=.1;updateFr002Tower(g.combat,t,s.stats,.1,s.bonuses.haste);assert.ok(Math.abs(t.weaponCycleState.waitRemaining-(wait-.2))<1e-8);
 g.combat.elapsed=20;s=combatTowerStats(t,g.towers,d);const before=t.weaponCycleState.waitRemaining;updateFr002Tower(g.combat,t,s.stats,.1,s.bonuses.haste);assert.ok(Math.abs(t.weaponCycleState.waitRemaining-(before-.1))<1e-8);
});

test('FR010 a partial draft cannot reserve its only keeper or consume CP for it',()=>{
 const g=new Game(data);g.place(18,18);Object.defineProperty(g,'hasLegalRecruitSpace',{value:false});g.finishRecruitment();const cp=g.commandPoints.value;assert.equal(g.reserve(),false);assert.equal(g.commandPoints.value,cp);assert.equal(g.keep(),true);assert.equal(g.startCombat(),true);
});

test('FR010 extreme Endless actual combat, status regeneration and restored state remain finite',()=>{
 const g=new Game(data);g.round=10000;g.phase='ready';g.startCombat();g.advanceTicks(600);const saved=serializeRun(g),h=restoreRun(data,JSON.parse(JSON.stringify(saved)));g.advanceTicks(120);h.advanceTicks(120);same(serializeRun(g),serializeRun(h));for(const e of h.combat.enemies){assert.ok(Number.isFinite(e.hp));assert.ok(Number.isFinite(e.maxHp));assert.ok(e.healthScaleLog>0);}assert.ok(h.combat.enemies.length>0);
});
