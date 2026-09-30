import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {towerStats,supportBonuses} from '../game/core/math.js';
import {mergePartner} from '../game/core/recipes.js';
import {abilityText} from '../ui/grimoire.js';
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
const unit=(family,id=1,tier=1)=>({id,family,tier,state:'active',x:10,z:10,kills:0,cooldown:0});
function arena(){const g=new Game(data,{seed:42});g.phase='combat';g.combat.spawnQueue=[{time:9999,type:'grunt'}];return g;}
function foe(g,x=11,z=10){const e=g.combat.spawn('grunt');Object.assign(e,{x,z,hp:1e6,maxHp:1e6,speed:0});return e;}

for(const [family,effect] of [['druid','poison'],['runebreaker','shred']])test(`${family} spreads effects, reserves shots and falls back to selected priority`,()=>{
 const g=arena(),t=unit(family),s=towerStats(t,data),a=foe(g),b=foe(g,12),c=foe(g,13);
 a.hp=300;b.hp=200;c.hp=100;t.priority='strongest';
 g.combat.applyEffects(a,s,t);assert.equal(g.combat.targetList(t,s)[0],b);
 const shot={source:t,target:b,stats:s,progress:0};g.combat.projectiles.push(shot);assert.equal(g.combat.targetList(t,s)[0],c);
 g.combat.applyEffects(c,s,t);assert.deepEqual(g.combat.targetList(t,s),[]);
 g.combat.applyEffects(b,s,t);shot.progress=1;assert.equal(g.combat.targetList(t,s)[0],a);
 delete b.statuses[effect];assert.equal(g.combat.targetList(t,s)[0],b);
 b.x=50;assert.equal(g.combat.targetList(t,s)[0],a);
});

test('failed shielded shots release their effect reservation and immune targets do not steal poison spreading',()=>{
 const g=arena(),t=unit('druid'),s=towerStats(t,data),a=foe(g),b=foe(g,12);a.magicImmune=true;
 assert.equal(g.combat.targetList(t,s)[0],b);b.shields=1;
 const shot={source:t,target:b,stats:s,progress:0};g.combat.projectiles.push(shot);
 g.combat.impact(shot);shot.progress=1;assert.equal(b.statuses.poison,undefined);assert.equal(g.combat.targetList(t,s)[0],b);
});

test('successive in-flight shots spread across distinct unmarked enemies',()=>{
 const g=arena(),t=unit('runebreaker');g.towers=[t];for(let i=0;i<3;i++)foe(g,14,10+i*.1);
 t.cooldown=-1.3;g.tick(.01);assert.equal(new Set(g.combat.projectiles.map(s=>s.target.id)).size,3);
});

test('marshal armor aura uses its own radius, strongest reduction, and disappears when consumed',()=>{
 const g=arena(),t=unit('royalmarshal'),near=foe(g),far=foe(g,15);g.towers=[t];t.cooldown=999;
 g.tick(.01);assert.equal(near.armorShred,15);assert.equal(far.armorShred,0);
 g.combat.applyEffects(near,{shred:40},t);g.tick(.01);assert.equal(near.armorShred,40);
 delete near.statuses.shred;t.state='ruin';g.tick(.01);assert.equal(near.armorShred,0);
});

test('wyvern hunter applies anti-air effects only to flying targets',()=>{
 const g=arena(),t=unit('wyvernhunter'),s=towerStats(t,data),ground=foe(g),air=foe(g);air.flying=true;
 g.combat.impact({source:t,target:ground,stats:s});assert.equal(ground.statuses.shred,undefined);assert.equal(ground.statuses.slow,undefined);
 g.combat.impact({source:t,target:air,stats:s});assert.equal(air.statuses.shred.amount,10);assert.equal(air.statuses.slow.amount,.3);
});

test('catapult stun can refresh and shortened boss duration',()=>{
 const g=arena(),t=unit('stonewarden'),e=foe(g),s={...towerStats(t,data),freeze:1};g.combat.applyEffects(e,s,t);
 assert.equal(e.statuses.freeze.time,2);delete e.statuses.freeze;g.combat.applyEffects(e,s,t);assert.equal(e.statuses.freeze.time,2);
 g.combat.elapsed=3;e.boss=true;g.combat.applyEffects(e,s,t);assert.equal(e.statuses.freeze.time,1);
});

test('arsenal and ranger blessing bypass evasion, but still respect shields and physical immunity',()=>{
 const g=arena(),t=unit('archer'),e=foe(g);e.evasion=1;
 assert.equal(g.combat.damage(e,100,'physical',{directHit:true},t),0);
 const mentor=unit('rangermentor',2),bonuses=supportBonuses(t,[mentor],data);assert.equal(bonuses.trueStrike,true);
 const s={...towerStats(unit('royalarsenal'),data),directHit:true};assert.ok(g.combat.damage(e,100,'physical',s,t)>0);
 e.shields=1;assert.equal(g.combat.damage(e,100,'physical',s,t),0);e.physicalImmune=true;assert.equal(g.combat.damage(e,100,'physical',s,t),0);
 mentor.state='ruin';assert.equal(supportBonuses(t,[mentor],data).trueStrike,undefined);
});

test('protector shortens disarm windows and reduces dread without stacking duplicate auras',()=>{
 const g=arena(),t=unit('archer'),p=unit('kingdomprotector',2),duplicate=unit('kingdomprotector',3),e=foe(g);g.towers=[t,p,duplicate];
 e.disarm=true;e.untouchable=.4;g.combat.elapsed=.23;g.tick(.01);assert.equal(t.disarmed,false);
 assert.equal(supportBonuses(t,g.towers,data).controlResistance,1);
 p.state='ruin';duplicate.state='ruin';g.combat.elapsed=.23;g.tick(.01);assert.equal(t.disarmed,true);
});

test('support and damage improve with champion rank while support remains capped and source data immutable',()=>{
 const before=JSON.stringify(data.towers),a=towerStats(unit('sunward',1,1),data),b=towerStats(unit('sunward',1,2),data),late=towerStats(unit('sunward',1,100),data);
 assert.ok(Math.abs(b.damage/a.damage-2.7)<1e-9);assert.ok(b.aura.haste>a.aura.haste);assert.equal(late.aura.haste,a.aura.haste*1.5);
 assert.equal(towerStats(unit('winterhold',1,100),data).slowAura,.75);assert.equal(JSON.stringify(data.towers),before);
 assert.equal(mergePartner(unit('archer',1,5),[unit('archer',2,5)],data),null);
});

test('new abilities are visible in the grimoire',()=>{
 for(const [family,text] of [['royalmarshal','armor aura'],['stonewarden','stun chance'],['wyvernhunter','Flying targets'],['royalarsenal','Ignores evasion'],['rangermentor','Allies ignore evasion'],['kingdomprotector','protection from disarm']])assert.ok(abilityText(towerStats(unit(family),data)).includes(text),family);
});

test('bosses retain half the slowing strength of regular invaders',()=>{
 const g=arena(),winter=unit('winterhold'),spawn=g.grid.checkpoints[0];Object.assign(winter,spawn,{cooldown:999});g.towers=[winter];
 const e=foe(g,spawn.x,spawn.z);e.boss=true;e.speed=1;g.tick(1);assert.ok(Math.abs(e.x-.625)<1e-9);
});

test('protector reduces dread in the actual attack clock',()=>{
 const g=arena(),t=unit('archer'),p=unit('kingdomprotector',2),e=foe(g);e.untouchable=.4;g.towers=[t,p];g.combat.elapsed=4;t.cooldown=10;p.cooldown=999;
 g.tick(.1);assert.ok(Math.abs(t.cooldown-9.9)<1e-9);
 p.state='ruin';t.cooldown=10;g.tick(.1);assert.ok(Math.abs(t.cooldown-9.94)<1e-9);
});
