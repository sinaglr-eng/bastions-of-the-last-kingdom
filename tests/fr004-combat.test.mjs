import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {Game} from '../game/core/game.js';import {loadCurrentDatasets} from '../tools/current-datasets.mjs';import {towerStats,combatTowerStats} from '../game/core/math.js';import {fr002Impact,updateFr002Tower} from '../game/core/fr002-combat.js';import {immunityAuraCoverage} from '../game/core/immunity-auras.js';import {supportSourceAreas} from '../game/render/support-effects.js';
const after=loadCurrentDatasets(),before=loadCurrentDatasets({revision:'fr003'}),spec=JSON.parse(fs.readFileSync(new URL('../data/fr004.json',import.meta.url)));
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-6,`${label}: ${a} != ${b}`);
function setup(data,family='dw_shieldguard',tier=1){const g=new Game(data,{seed:71}),c=g.combat,t={id:1,family,tier,state:'active',x:5,z:5,kills:0,cooldown:0,mvpLevel:0};g.towers=[t];g.phase='combat';g.rng=()=>.999999;const enemy=(x=6,z=5)=>Object.assign(c.spawn('grunt'),{x,z,hp:1e8,maxHp:1e8,armor:0,speed:0,physicalImmune:false,magicImmune:false,krakenShell:0});return{g,c,t,enemy,s:towerStats(t,data)};}
const impact=(h,e,s=h.s)=>fr002Impact(h.c,{source:h.t,target:e,stats:s,firstPrimary:true,directTargets:[e],releaseCount:1});
test('all 81 real direct handlers use the target native base, without a second permanent multiplier',()=>{
 let count=0;for(const change of spec.profileChanges.filter(c=>c.field==='damage')){const h=setup(after.forge,change.unitId,change.rank),e=h.enemy(),traces=[];h.g.on((k,p)=>{if(k==='damage-trace')traces.push(p);});impact(h,e);close(traces[0].requestedDamage,change.after,change.key);close(traces[0].effectiveDamage,change.after,change.key);assert.equal(h.s.listedDamage,change.after);count++;}assert.equal(count,81);
});
test('four actual continuous weapons deliver effective DPS once at two timesteps; fixed Heat and shared Flame Cone stay separate',()=>{
 for(const [family,dps]of [['dw_steamharpooner',2250],['dw_flamewarden',2700],['dw_emberanvil',3105],['dw_bombardking',13500]])for(const dt of [.1,.05]){
  const h=setup(after.forge,family),e=h.enemy();let own=0;h.g.on((k,p)=>{if(k==='damage-trace')own+=p.effectiveDamage;});for(let i=0;i<Math.round(1/dt);i++){h.c.elapsed+=dt;updateFr002Tower(h.c,h.t,h.s,dt,1);}close(own,dps,family+'/'+dt);
 }
 const run=data=>{const h=setup(data,'dw_steamharpooner'),e=h.enemy(),packets=[];h.g.on((k,p)=>{if(k==='damage-trace')packets.push(p.requestedDamage);});h.c.elapsed=4;updateFr002Tower(h.c,h.t,h.s,.1,1);return packets;};const old=run(before.forge),next=run(after.forge);assert.equal(old[0],200);assert.equal(next[0],200);assert.equal(old[1],150);assert.equal(next[1],225);
});
test('real critical, primary-derived Splash, Ricochet and fixed Spark keep their packet basis and existing modifiers',()=>{
 const original=setup(before.forge,'dw_shieldguard').s.damage,current=setup(after.forge,'dw_shieldguard').s.damage;
 for(const [data,base]of [[before.forge,original],[after.forge,current]]){
  const h=setup(data),e=h.enemy(),side=h.enemy(6.2),s={...h.s,abilities:[{familyId:'critical-strike',chancePercent:100,multiplier:3},{familyId:'splash',damagePercent:40,radius:1,damageType:'profile'}]};h.g.rng=()=>0;impact(h,e,s);close(e.maxHp-e.hp,base*3,'critical');close(side.maxHp-side.hp,base*.4,'splash');
  const bounce=setup(data),primary=bounce.enemy(),far=bounce.enemy(8),bs={...bounce.s,abilities:[{familyId:'ricochet',chancePercent:100,maxBounces:1,damageReductionPercent:50,unlimitedBounceDistance:true,canCrit:false,canApplyOnHit:false}]};bounce.g.rng=()=>0;impact(bounce,primary,bs);close(far.maxHp-far.hp,base*.5,'primary ricochet');
  const fixed=setup(data),target=fixed.enemy(),secondary=fixed.enemy(8),spark={...fixed.s,damage:0,abilities:[...bs.abilities,{familyId:'spark',damage:80,damageType:'magical',cooldown:1,targets:1}]};fixed.g.rng=()=>0;fixed.c.elapsed=1;updateFr002Tower(fixed.c,fixed.t,spark,0,1);close(target.maxHp-target.hp,80,'fixed spark');close(secondary.maxHp-secondary.hp,40,'fixed secondary ricochet');
 }
 const h=setup(structuredClone(after.forge));h.t.mvpLevel=4;h.g.data.towers.support={advanced:true,damage:0,range:1,interval:1,type:'magical',aura:{range:10,damageBonus:.3}};h.g.towers.push({id:2,family:'support',tier:1,state:'active',x:5,z:6});const s=combatTowerStats(h.t,h.g.towers,h.g.data).stats;close(s.damage,current*1.2*1.3,'MVP and support apply once');
});
test('all ten real aura owners include new boundaries, lose coverage immediately, preserve fractions before armor/shell, and expose matching map radii',()=>{
 for(const change of spec.auraChanges)for(const flags of [{},{flying:true},{boss:true},{cloaked:true}]){
  const h=setup(after.forge,change.unitId,change.rank),e=Object.assign(h.enemy(5+change.afterRadius),{physicalImmune:true,...flags});h.t.attackPaused=true;h.t.disarmed=true;
  close(h.c.damage(e,100,'physical'),100*change.damageMultiplier,change.key);e.x+=1e-7;assert.equal(h.c.damage(e,100,'physical'),0);h.t.x+=.1;close(h.c.damage(e,100,'physical'),100*change.damageMultiplier,'moving emitter');
  e.armor=30;e.krakenShell=2;close(h.c.damage(e,100,'physical',{directHit:true}),Math.max(0,50*change.damageMultiplier-2),'defense ordering');
  for(const state of ['draft','reserve','ruin']){h.t.state=state;assert.equal(h.c.damage(e,100,'physical'),0);}h.t.state='active';assert.equal(e.statuses.breachPhysical,undefined);
  assert.ok(supportSourceAreas(h.t,h.g.data).some(a=>a.radius===change.afterRadius),change.key+' visible radius');
 }
});
test('aura cache is isolated from baseline; strongest Physical and Magical coverage coexist, Range Aura does not extend immunity reach',()=>{
 const old=setup(before.forge,'dw_worldanvil'),oe=Object.assign(old.enemy(11.5),{physicalImmune:true});assert.equal(old.c.damage(oe,100,'physical'),0);
 const h=setup(structuredClone(after.forge),'dw_worldanvil'),e=Object.assign(h.enemy(11.5),{physicalImmune:true,magicImmune:true});assert.equal(h.c.damage(e,100,'physical'),100);
 h.g.data.towers.other={advanced:true,range:20,damage:0,interval:1,type:'magical',abilities:[{familyId:'cancel-physical-immunity-aura',radius:20,damageMultiplier:.25},{familyId:'cancel-magic-immunity-aura',radius:20,damageMultiplier:.5}],aura:{range:20,rangeBonus:10}};h.g.towers.push({id:2,family:'other',tier:1,state:'active',x:5,z:5});assert.equal(immunityAuraCoverage(e,h.g.towers,h.g.data).physical.multiplier,1);assert.equal(h.c.damage(e,100,'magical'),50);assert.equal(h.c.damage(e,100,'holy'),100);e.x+=1e-6;assert.equal(h.c.damage(e,100,'physical'),25,'Source attack range bonus does not extend its 6.5 aura');e.physicalImmune=false;assert.equal(h.c.damage(e,100,'physical'),100);
});
