import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {Game} from '../game/core/game.js';
import {loadCurrentDatasets} from '../tools/current-datasets.mjs';
import {towerStats} from '../game/core/math.js';
import {attackTargetAllowed} from '../game/core/combat-rules.js';

const current=loadCurrentDatasets(),prior=loadCurrentDatasets({revision:'fr007r3'}),family='el_baby_fire_dragon',proof=[];
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function arena(id=family,faction='grove'){
 const data=current[faction],game=new Game(data,{seed:42}),source={id:1,family:id,tier:1,state:'active',x:10,z:10,kills:0,cooldown:0,mvpLevel:0};
 game.phase='combat';game.towers=[source];game.rng=()=>.999999;game.combat.spawnQueue=[{time:1e9,type:'grunt'}];
 const traces=[],channels=[];game.on((type,payload)=>{if(type==='damage-trace')traces.push({...payload});if(type==='aura-attack')channels.push({source:payload.source,target:payload.target});});
 const spawn=(x,z,props={})=>Object.assign(game.combat.spawn('grunt'),{x,z,hp:1e7,maxHp:1e7,armor:0,speed:0,physicalImmune:false,magicImmune:false,krakenShell:0,evasion:0,shields:0,resists:{},regen:0,route:[{x:100,z}],pathIndex:0,traveled:0,statuses:{},flying:false,...props});
 return {game,source,stats:towerStats(source,data),spawn,traces,channels,tick:dt=>game.tick(dt)};
}

test('only Baby Fire Dragon gains air targeting; all 258 profiles retain primary numbers and other cone contracts',()=>{
 const fields=['damage','listedDamage','interval','range','type','melee','groundOnly','projectileSpeed','weaponCycle','continuousAttack'];let profiles=0;
 for(const [faction,data]of Object.entries(current))for(const [id,unit]of Object.entries(data.towers))for(let tier=1;tier<=(unit.advanced?1:6);tier++){
  const value=towerStats({family:id,tier},data),old=towerStats({family:id,tier},prior[faction]);profiles++;
  if(faction==='grove'&&id===family){
   assert.equal(value.groundOnly,false);assert.equal(value.continuousAttack.targeting,'ground-and-air');
   assert.deepEqual({...value.continuousAttack,targeting:old.continuousAttack.targeting},old.continuousAttack);
   const cone=value.abilities.find(a=>a.familyId==='flame-cone'),oldCone=old.abilities.find(a=>a.familyId==='flame-cone');assert.equal(cone.targeting,'ground-and-air');assert.match(cone.text,/ground and flying enemies/);
   assert.deepEqual({...cone,text:oldCone.text,targeting:oldCone.targeting},oldCone,'only cone targeting and its English description change');
   assert.deepEqual(value.abilities.filter(a=>a.familyId!=='flame-cone'),old.abilities.filter(a=>a.familyId!=='flame-cone'),'Burn remains exact');
   for(const field of fields.filter(k=>!['groundOnly','continuousAttack'].includes(k)))assert.deepEqual(value[field],old[field],id+'/'+field);
  }else for(const field of fields)assert.deepEqual(value[field],old[field],faction+'/'+id+'/'+tier+'/'+field);
 }
 assert.equal(profiles,258);
});

for(const mode of ['air','ground','mixed'])for(const defense of ['ordinary','physical-immune','magic-immune','both-immune'])test(`scheduled Baby Dragon cone: ${mode}, ${defense}`,()=>{
 const h=arena(),props={physicalImmune:In(defense,['physical-immune','both-immune']),magicImmune:In(defense,['magic-immune','both-immune'])};
 const targets=[];if(mode!=='ground')targets.push(h.spawn(12,10,{...props,flying:true,traveled:100}));if(mode!=='air')targets.push(h.spawn(12,10.15,{...props,flying:false,traveled:90}));
 const side=h.spawn(10,12,{flying:true,traveled:1}),far=h.spawn(10+h.stats.range+.001,10,{flying:true,traveled:200});
 for(const enemy of targets)assert.equal(attackTargetAllowed(h.stats,enemy),true);
 for(let i=0;i<10;i++)h.tick(.05);
 const cone=h.traces.filter(row=>row.source===h.source&&row.effect==='magical'),blocked=props.magicImmune;
 assert.equal(h.channels.length,10,'real scheduled continuous events fire every simulation step');if(mode!=='ground')assert.equal(h.channels[0].target,targets[0],'Baby acquires an airborne primary without a grounded fallback');
 for(const enemy of targets){const rows=cone.filter(row=>row.enemy===enemy);assert.equal(rows.length,10);near(rows.reduce((s,r)=>s+r.requestedDamage,0),150);near(rows.reduce((s,r)=>s+r.effectiveDamage,0),blocked?0:150);
  if(blocked){assert.equal(enemy.hp,enemy.maxHp);assert.ok(rows.every(row=>row.blockReason==='magic-immunity'));assert.equal(enemy.statuses.burn,undefined);}else{assert.ok(enemy.hp<enemy.maxHp);assert.equal(enemy.statuses.burn.dps,32);assert.equal(enemy.statuses.burn.time,3);}
 }
 assert.equal(side.hp,side.maxHp,'a flying bystander outside the unchanged cone is not hit');assert.equal(far.hp,far.maxHp,'air permission does not extend range');
 proof.push({mode,defense,simulation:'actual Game.tick -> Combat.update -> scheduled continuous cone',seconds:.5,step:.05,channels:h.channels.length,targets:targets.map(enemy=>({flying:enemy.flying,effectiveConeDamage:cone.filter(r=>r.enemy===enemy).reduce((s,r)=>s+r.effectiveDamage,0),totalHpLoss:enemy.maxHp-enemy.hp,burnDps:enemy.statuses.burn?.dps||0})),sideHpLoss:side.maxHp-side.hp,farHpLoss:far.maxHp-far.hp});
});
function In(value,values){return values.includes(value);}

test('Baby cone keeps inclusive range, its 45-degree angle, visibility and pause semantics',()=>{
 const h=arena(),atEdge=h.spawn(13.5,10,{flying:true,traveled:100}),inside=h.spawn(12,10+2*Math.tan(22*Math.PI/180),{flying:true,traveled:90}),outside=h.spawn(12,10+2*Math.tan(23*Math.PI/180),{flying:true,traveled:80});
 h.game.paused=true;h.tick(.05);assert.equal(h.channels.length,0);assert.equal(atEdge.hp,atEdge.maxHp);h.game.paused=false;h.tick(.05);near(atEdge.maxHp-atEdge.hp,15);near(inside.maxHp-inside.hp,15);assert.equal(outside.hp,outside.maxHp);
 const hidden=arena(),cloaked=hidden.spawn(13.3,10,{flying:true,stealth:true,cloaked:true});hidden.game.grid.checkpoints=[];for(let i=0;i<10;i++)hidden.tick(.05);assert.equal(cloaked.hp,cloaked.maxHp);assert.equal(hidden.channels.length,0,'air targeting does not grant detection beyond the existing close reveal');
});

test('all three larger Elf dragons keep ground-only primary cones while existing Dwarf cones still acquire air',()=>{
 for(const id of ['el_fire_dragon','el_mother_fire_dragon','el_ancient_patriarch']){
  const h=arena(id),aura=h.stats.abilities.find(a=>a.familyId==='fire-aura'),distance=(h.stats.range+(aura?.radius||0))/2,air=h.spawn(10+distance,10,{flying:true,traveled:100});
  assert.equal(h.stats.groundOnly,true);assert.equal(h.stats.continuousAttack.targeting,'ground');for(let i=0;i<10;i++)h.tick(.05);assert.equal(h.channels.length,0,'an airborne-only wave cannot aim this larger dragon primary');assert.equal(air.hp,air.maxHp,'fixture is outside the independent aura and before Spark cooldown');
  const ground=h.spawn(10+distance,10.1,{traveled:90});h.tick(.05);assert.ok(ground.hp<ground.maxHp);assert.equal(h.channels.at(-1).target,ground);assert.equal(air.hp,air.maxHp,'mixed targets do not broaden the larger dragon cone');
 }
 for(const id of ['dw_steamharpooner','dw_flamewarden','dw_emberanvil','dw_bombardking']){const h=arena(id,'forge'),air=h.spawn(12,10,{flying:true});h.tick(.05);assert.equal(h.stats.continuousAttack.targeting,'ground-and-air');assert.ok(air.hp<air.maxHp);assert.equal(h.channels[0].target,air);}
});

if(process.env.BASTIONS_BABY_AIR_PROOF)process.on('beforeExit',()=>{const file=path.resolve(process.env.BASTIONS_BABY_AIR_PROOF);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify({status:'passed',scope:'Only current Baby Fire Dragon primary cone targeting changed. Approved historical datasets/model/audio files preserved.',profilesChecked:258,baby:{groundOnly:false,coneTargeting:'ground-and-air',damageType:'magical',dps:300,range:3.5,angleDegrees:45,burnDps:32,burnSeconds:3},cases:proof},null,2)+'\n');});
