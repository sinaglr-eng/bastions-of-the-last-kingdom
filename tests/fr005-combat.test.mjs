import test from 'node:test';import assert from 'node:assert/strict';
import {Game} from '../game/core/game.js';import {towerStats} from '../game/core/math.js';import {loadCurrentDatasets} from '../tools/current-datasets.mjs';import {skyHuntAura,skyHuntCoverage,skyHuntSlow} from '../game/core/sky-hunt.js';import {fr002Impact,updateFr002Tower} from '../game/core/fr002-combat.js';import {SupportEffects,supportSourceAreas,enemyStatusState} from '../game/render/support-effects.js';import {RunStatistics} from '../game/core/run-statistics.js';import {Scene} from 'three';
const data=loadCurrentDatasets(),baseline=loadCurrentDatasets({revision:'fr004'}),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function scene(faction='forge',family='dw_griffinhandler',tier=1,d=data[faction]){
 const g=new Game(d,{seed:19}),c=g.combat,t={id:1,family,tier,state:'active',x:10,z:10,kills:0,cooldown:0,mvpLevel:0};g.phase='combat';g.towers=[t];g.rng=()=>.999999;
 const enemy=(x=12,z=10,props={})=>Object.assign(c.spawn('grunt'),{x,z,hp:1e8,maxHp:1e8,armor:0,speed:1,physicalImmune:false,magicImmune:false,krakenShell:0,route:[{x:100,z}],pathIndex:0,traveled:0,statuses:{},...props});
 return{g,c,t,s:towerStats(t,d),enemy};
}
const impact=(h,e,more={})=>fr002Impact(h.c,{source:h.t,target:e,stats:h.s,firstPrimary:true,directTargets:[e],releaseCount:1,release:{},...more});
test('all sixteen Sky Hunt owners expose exact air-only 25/50/75% aura levels and independent radii',()=>{
 let count=0;for(const [f,d]of Object.entries(data))for(const [id,u]of Object.entries(d.towers))for(let tier=1;tier<=(u.advanced?1:6);tier++){
  const h=scene(f,id,tier),a=skyHuntAura(h.s);if(!a)continue;count++;assert.equal(a.slowPercent,[25,50,75][a.level-1]);assert.equal(a.slowAuraRadius,[3,4,5][a.level-1]);assert.equal(a.slowDuration,undefined);
  const e=h.enemy(10+a.slowAuraRadius,10,{flying:true});near(skyHuntSlow(h.s,h.t,e),a.slowPercent/100);e.x+=1e-7;assert.equal(skyHuntSlow(h.s,h.t,e),0);e.x-=1;assert.equal(skyHuntSlow({...h.s,range:100},h.t,e),a.slowPercent/100);
  h.t.attackPaused=true;h.t.disarmed=true;assert.equal(skyHuntSlow(h.s,h.t,e),a.slowPercent/100,'No attack required');assert.ok(supportSourceAreas(h.t,d).some(x=>x.radius===a.slowAuraRadius&&/flying only/.test(x.label)));
 }assert.equal(count,16);
});
test('Sky Hunt changes real movement immediately on entry and exit, even hidden/evading targets, with no contact, detection, status timer or ground slow',()=>{
 const h=scene(),e=h.enemy(12.8,10,{flying:true,stealth:true,evasion:1});h.t.attackPaused=true;const shots=[];h.g.on((k,p)=>{if(k==='shot')shots.push(p);});
 assert.equal(h.c.isRevealed(e),true,'Cloak is updated during the first tick');h.c.update(.1);assert.equal(h.c.canSee(e,h.t),false);near(e.currentSpeed,.75);assert.equal(shots.length,0);assert.equal(e.statuses.slow,undefined);
 assert.equal(enemyStatusState(e,[h.t],h.g.data).find(s=>s.key==='slow').value,.25);
 e.x=13.01;h.c.update(.1);near(e.currentSpeed,1);assert.equal(enemyStatusState(e,[h.t],h.g.data).find(s=>s.key==='slow'),undefined);
 e.x=12;h.c.update(.1);near(e.currentSpeed,.75);e.flying=false;h.c.update(.1);near(e.currentSpeed,1);
 for(const state of ['draft','reserve','ruin']){h.t.state=state;e.flying=true;h.c.update(.1);near(e.currentSpeed,1);}h.t.state='active';h.c.update(.1);near(e.currentSpeed,.75);
});
test('Sky Hunt coverage ignores damage defenses but preserves existing Slow immunity; boss reduction and strongest-only overlap match markers',()=>{
 const h=scene('forge','dw_griffinhandler',5),e=h.enemy(12,10,{flying:true,physicalImmune:true});h.t.attackPaused=true;
 assert.ok(skyHuntCoverage(h.s,h.t,e));assert.equal(skyHuntSlow(h.s,h.t,e),0,'Physical immunity includes existing Slow immunity');h.c.update(.1);near(e.currentSpeed,1);
 e.statuses.breachPhysical={time:5,multiplier:.25};h.c.update(.1);near(e.currentSpeed,.25);
 e.physicalImmune=false;e.boss=true;e.statuses.slow={amount:.8,time:3,source:h.t};h.c.update(.1);near(e.currentSpeed,1-.8*.5);near(enemyStatusState(e,[h.t],h.g.data).find(s=>s.key==='slow').value,.4);
 const d=structuredClone(h.g.data);d.towers.testSlow={advanced:true,damage:0,interval:1,range:10,type:'magical',slowAura:.9,slowAuraRange:10};h.g.data=d;h.g.towers.push({id:2,family:'testSlow',tier:1,state:'active',x:10,z:10,attackPaused:false});h.c.update(.1);near(e.currentSpeed,1-.9*.5);near(enemyStatusState(e,h.g.towers,d).find(s=>s.key==='slow').value,.45);
});
test('Sky Hunt statistics attribute strongest aura control without counting attacks or revealing its victim',()=>{
 const h=scene(),tracker=new RunStatistics(h.g,{version:'0.6.8'});tracker.event('wave',{});const e=h.enemy(12.8,10,{flying:true,stealth:true});h.t.attackPaused=true;h.c.update(.01);tracker.sample(.25);
 assert.equal(tracker.current.towers[0].shots,0);assert.equal(tracker.current.towers[0].controlSeconds,.25);assert.equal(tracker.current.effects.slowAura,.25);assert.equal(h.c.canSee(e,h.t),false);tracker.dispose();
});

test('batched enemy markers retain passive Sky Hunt from a paused defender and follow coverage immediately',()=>{
 const h=scene(),e=h.enemy(12,10,{flying:true}),fx=new SupportEffects(new Scene());h.t.attackPaused=true;
 const sync=()=>fx.sync(h.g.towers,h.g.data,{phase:'combat',combat:h.c});
 try{sync();assert.equal(fx.enemyStates.get(e.id)?.find(s=>s.key==='slow').value,.25);assert.equal(fx.batches.has('enemy:slow'),false,'Sky Hunt Slow remains data-only without allocating an automatic glyph');
  e.x=14;sync();assert.equal(fx.enemyStates.has(e.id),false);assert.equal(fx.batches.has('enemy:slow'),false);
  e.x=12;e.flying=false;sync();assert.equal(fx.enemyStates.has(e.id),false);
  e.flying=true;e.cloaked=true;sync();assert.equal(fx.enemyStates.has(e.id),false,'Markers never expose hidden enemies');
 }finally{fx.dispose();}
});
const machines=[['dw_repeatercrew',2,1],['dw_ironclad',3,1],['dw_breachorgan',5,2],['dw_deepdelve',5,2],['dw_salvomarshal',10,2]];
test('five machine Multishot contracts use distinct targets while full magazine, spin-up and reload schedules stay identical',()=>{
 for(const [id,targets,ricochet]of machines){const now=scene('forge',id),old=scene('forge',id,1,baseline.forge);assert.equal(now.s.multishot,targets);assert.equal(now.s.abilities.filter(a=>a.familyId==='multishot').length,1);assert.equal(now.s.abilities.find(a=>a.familyId==='ricochet').level,ricochet);
  for(const h of [now,old]){for(let i=0;i<12;i++)h.enemy(11+i*.03,10,{speed:0});h.schedule=[];h.g.on((k,p)=>{if(k==='shot')h.schedule.push({at:h.c.elapsed,stamp:p.volleyStamp,target:p.target.id});});for(let n=0;n<1200;n++){h.c.elapsed=n*.01;updateFr002Tower(h.c,h.t,h.s,.01,1);}}
  const releases=h=>[...new Set(h.schedule.map(x=>x.stamp))].map(stamp=>{const rows=h.schedule.filter(r=>r.stamp===stamp);assert.equal(new Set(rows.map(r=>r.target)).size,rows.length);assert.equal(rows.length,h===now?targets:old.s.multishot||1);return rows[0].at;});assert.deepEqual(releases(now),releases(old),id+'/same cycle');assert.deepEqual(now.t.weaponCycleState,old.t.weaponCycleState);assert.equal(now.s.damage,old.s.damage);
 }
});
test('all five new machine Ricochets retain canonical distance, critical and on-hit rules without re-entering their own lineage',()=>{
 for(const [id,,level]of machines){const h=scene('forge',id),origin=h.enemy(11,10,{speed:0}),far=h.enemy(80,10,{speed:0}),next=h.enemy(90,10,{speed:0});h.g.rng=()=>0;const traces=[],procs=[];h.g.on((k,p)=>{if(k==='damage-trace')traces.push(p);if(k==='ability-proc')procs.push(p);});impact(h,origin);
  const a=h.s.abilities.find(a=>a.familyId==='ricochet');assert.equal(a.level,level);assert.equal(a.unlimitedBounceDistance,true);assert.equal(a.canCrit,true);assert.equal(a.canApplyOnHit,true);assert.ok(far.hp<far.maxHp);assert.equal(next.hp<next.maxHp,level===2);assert.equal(procs.filter(p=>p.abilityId==='ricochet').length,1);assert.ok(traces.length<20);for(const p of procs)assert.equal(new Set(p.lineage).size,p.lineage.length);
  if(h.s.abilities.some(a=>a.familyId==='armor-reduction'))assert.ok(far.statuses.shred);
 }
 assert.equal(data.forge.towers.dw_grapeshotcart.abilities.some(a=>a.familyId==='ricochet'),false);
});
test('machine Ricochet cannot proc from immune or evaded zero damage; Splash excludes every direct Multishot target',()=>{
 for(const props of [{physicalImmune:true},{evasion:1}]){const h=scene('forge','dw_repeatercrew'),e=h.enemy(11,10,props),far=h.enemy(80);h.g.rng=()=>0;impact(h,e);assert.equal(far.hp,far.maxHp);}
 const h=scene('forge','dw_breachorgan'),e=h.enemy(11),direct=h.enemy(11.2),side=h.enemy(11.4);h.g.rng=()=>.999999;impact(h,e,{directTargets:[e,direct]});assert.equal(direct.hp,direct.maxHp);near(side.maxHp-side.hp,h.s.damage*.6);
});
test('Heavy Sniper shares exact Master Sniper Execution I; one timed shot executes a normal target or uses x10 on a boss',()=>{
 const s=data.forge.towers.dw_steamrail,master=data.forge.towers.dw_ironstorm;assert.deepEqual(s.abilities.find(a=>a.familyId==='execution'),master.abilities.find(a=>a.familyId==='execution'));
 for(const boss of [false,true]){const h=scene('forge','dw_steamrail'),e=h.enemy(11,10,{boss,speed:0});h.c.elapsed=15;updateFr002Tower(h.c,h.t,h.s,.01,1);const shot=h.c.projectiles.find(p=>p.execution);assert.ok(shot);assert.equal(shot.execution.cooldown,15);assert.equal(h.t.executionReadyAt,30);fr002Impact(h.c,shot);if(boss)near(e.maxHp-e.hp,h.s.damage*10);else assert.equal(e.dead,true);}
});
test('Siege Cannon Freeze and Human Golem Stun reuse ordinary contact, immunity, boss duration and shared recovery gates',()=>{
 for(const [f,id,kind]of [['forge','dw_cinderhowitzer','freeze'],['crown','emeraldgolem','stun']])for(const boss of [false,true]){
  const h=scene(f,id),e=h.enemy(11,10,{boss,speed:0});let rolls=0;h.g.rng=()=>f==='crown'&&rolls++===0?.9:0;
  const strike=()=>f==='crown'?h.c.impact({source:h.t,target:e,stats:h.s}):impact(h,e);strike();assert.equal(e.statuses[kind].time,boss?1:2);assert.equal(e.factionControlRecovery,(boss?1:2)+2);assert.equal(e.statuses.petrify,undefined);assert.equal(h.t.stoneGaze,undefined);
  delete e.statuses[kind];strike();assert.equal(e.statuses[kind],undefined);h.c.elapsed=5;e.physicalImmune=true;strike();assert.equal(e.statuses[kind],undefined);e.physicalImmune=false;e.evasion=1;strike();assert.equal(e.statuses[kind],undefined);
 }
 const h=scene('crown','emeraldgolem'),e=h.enemy();h.g.rng=()=>0;h.c.impact({source:h.t,target:e,stats:h.s});assert.equal(e.statuses.freeze.time,2,'Existing Freeze I remains');assert.equal(e.statuses.stun,undefined,'One shared control recovery gate');
});
