import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {towerStats,supportBonuses} from '../game/core/math.js';
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
const unit=(family,id=1,x=10)=>({id,family,tier:1,state:'active',x,z:10,kills:0,cooldown:999});
function arena(){const g=new Game(data,{seed:42});g.phase='combat';g.combat.spawnQueue=[{time:9999,type:'grunt'}];return g;}
function foe(g,x=11){const e=g.combat.spawn('grunt');Object.assign(e,{x,z:10,hp:1e9,maxHp:1e9,armor:0,speed:0,resists:{}});return e;}
const strike=(g,t,e,s=towerStats(t,data))=>g.combat.impact({source:t,target:e,stats:s});

test('Archangel reacts to a nearby allied magical hit at the 25 percent boundary, with ten bounces',()=>{
 for(const [roll,expected]of [[.249,10],[.25,0]]){
  const g=arena(),angel=unit('archangel'),mage=unit('mage',2);g.towers=[angel,mage];const a=foe(g),b=foe(g,12);let jumps=0;g.on(type=>{if(type==='chain')jumps++;});g.rng=()=>roll;
  strike(g,mage,a,{...towerStats(mage,data),cleave:0});assert.equal(jumps,expected);assert.equal(b.statuses.slow?.amount,expected?.3:undefined);
 }
});
test('Archangel ignores own attacks, physical hits, blocked hits, immunity, inactive allies and distant casters',()=>{
 for(const condition of ['own','physical','shield','immune','inactive','distance']){
  const g=arena(),angel=unit('archangel'),mage=unit('mage',2);g.towers=[angel,mage];const a=foe(g);foe(g,12);let jumps=0;g.on(type=>{if(type==='chain')jumps++;});g.rng=()=>0;
  if(condition==='shield')a.shields=1;if(condition==='immune')a.magicImmune=true;if(condition==='inactive')angel.state='ruin';if(condition==='distance')mage.x=17;
  const caster=condition==='own'?angel:mage,s={...towerStats(caster,data),cleave:0};if(condition==='physical')s.type='physical';strike(g,caster,a,s);assert.equal(jumps,0,condition);
 }
});
test('Royal Ranger recovery caps keep health; armor-breaking champion attacks award no gold',()=>{
 const g=arena(),ranger=unit('royalranger'),e=foe(g);g.rng=()=>0;g.lives=29;strike(g,ranger,e);assert.equal(g.lives,30);strike(g,ranger,e);assert.equal(g.lives,30);g.lives=29;e.shields=1;strike(g,ranger,e);assert.equal(g.lives,29);
 const ballista=unit('fireballista');g.rng=()=>0;const before=g.economy.gold;strike(g,ballista,e);assert.equal(g.economy.gold,before);assert.equal(e.statuses.shred.amount,data.towers.fireballista.shred);assert.equal(data.towers.fireballista.goldChance,undefined);
});
test('Monk combines two different blessing ranks and never doubles identical Priest or Cleric auras',()=>{
 const archer=unit('archer'),monk=unit('monk',2),priest=unit('sunward',3),cleric={...unit('cleric',4),tier:4};const bonus=supportBonuses(archer,[monk,monk,priest,cleric],data);
 assert.equal(bonus.haste,2.1);assert.equal(bonus.damage,1.5);assert.equal(bonus.controlResistance,1);
 monk.state='ruin';assert.equal(supportBonuses(archer,[monk],data).haste,1);
});
test('Mechanical Golem suppresses healing and exposes magic immune enemies to its armor aura',()=>{
 const g=arena(),t=unit('mechanicalgolem'),e=foe(g),immune=foe(g,12);immune.magicImmune=true;e.regen=100;e.hp-=1000;g.towers=[t];g.rng=()=>.9;strike(g,t,e);assert.equal(e.statuses.healBlock.time,3);const before=e.hp;g.tick(.1);assert.ok(e.hp<before);assert.equal(immune.armorShred,30);assert.equal(immune.statuses.poison,undefined);
 delete e.statuses.poison;delete e.statuses.healBlock;const after=e.hp;g.tick(.1);assert.ok(e.hp>after);t.state='ruin';g.tick(.1);assert.equal(immune.armorShred,0);
});
test('Stone Gaze requires facing the golem for two seconds, petrifies for three and doubles physical damage',()=>{
 const g=arena(),t=unit('emeraldgolem'),e=foe(g),back=foe(g,12),immune=foe(g,13);t.x=15;g.towers=[t];g.rng=()=>0;g.combat.landedProcs(towerStats(t,data),t);
 e.route=[{x:11,z:10},{x:20,z:10}];e.pathIndex=1;back.route=[{x:12,z:10},{x:0,z:10}];back.pathIndex=1;immune.magicImmune=true;
 g.combat.updateStoneGazes(1);assert.equal(e.statuses.petrify,undefined);g.combat.updateStoneGazes(1);assert.equal(e.statuses.petrify.time,3);assert.equal(back.statuses.petrify,undefined);assert.equal(immune.statuses.gazeSlow,undefined);
 assert.equal(g.combat.damage(e,100,'physical',{},t),200);assert.equal(g.combat.damage(e,100,'arcane',{},t),100);g.combat.updateStoneGazes(4);assert.equal(t.stoneGaze,undefined);
});
test('Dragonrider forked lightning strikes exactly five independent targets and obeys magic immunity',()=>{
 const g=arena(),t=unit('thunderheart');const enemies=Array.from({length:6},(_,i)=>foe(g,11+i*.1));g.rng=()=>0;enemies[1].magicImmune=true;let forks=0;g.on(type=>{if(type==='chain')forks++;});strike(g,t,enemies[0]);assert.equal(forks,5);assert.equal(enemies[1].hp,1e9);assert.equal(enemies[2].hp,1e9-30000);assert.equal(enemies[5].hp,1e9);
});
