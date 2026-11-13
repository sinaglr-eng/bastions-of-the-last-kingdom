import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {Game} from '../game/core/game.js';
import {loadCurrentDatasets} from '../tools/current-datasets.mjs';
import {towerStats} from '../game/core/math.js';
import {attackTargetAllowed} from '../game/core/combat-rules.js';

const current=loadCurrentDatasets(),prior=loadCurrentDatasets({revision:'fr007r3'}),family='el_baby_fire_dragon',dragonFamilies=[family,'el_fire_dragon','el_mother_fire_dragon','el_ancient_patriarch'],proof=[];
let sparkProof;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function arena(id=family,faction='grove'){
 const data=current[faction],game=new Game(data,{seed:42}),source={id:1,family:id,tier:1,state:'active',x:10,z:10,kills:0,cooldown:0,mvpLevel:0};
 game.phase='combat';game.towers=[source];game.rng=()=>.999999;game.combat.spawnQueue=[{time:1e9,type:'grunt'}];
 const traces=[],channels=[],sparks=[];game.on((type,payload)=>{if(type==='damage-trace')traces.push({...payload});if(type==='aura-attack')channels.push({source:payload.source,target:payload.target});if(type==='chain'&&payload.abilityId==='spark')sparks.push({...payload});});
 const spawn=(x,z,props={})=>Object.assign(game.combat.spawn('grunt'),{x,z,hp:1e7,maxHp:1e7,armor:0,speed:0,physicalImmune:false,magicImmune:false,krakenShell:0,evasion:0,shields:0,resists:{},regen:0,route:[{x:100,z}],pathIndex:0,traveled:0,statuses:{},flying:false,...props});
 return {game,source,stats:towerStats(source,data),spawn,traces,channels,sparks,tick:dt=>game.tick(dt)};
}

test('only four Elf dragons gain air targeting; all 258 profiles retain primary numbers and existing secondary records',()=>{
 const fields=['damage','listedDamage','interval','range','type','melee','groundOnly','projectileSpeed','weaponCycle','continuousAttack'];let profiles=0;
 for(const [faction,data]of Object.entries(current))for(const [id,unit]of Object.entries(data.towers))for(let tier=1;tier<=(unit.advanced?1:6);tier++){
  const value=towerStats({family:id,tier},data),old=towerStats({family:id,tier},prior[faction]);profiles++;
  if(faction==='grove'&&dragonFamilies.includes(id)){
   assert.equal(value.groundOnly,false);assert.equal(value.continuousAttack.targeting,'ground-and-air');
   assert.deepEqual({...value.continuousAttack,targeting:old.continuousAttack.targeting},old.continuousAttack);
   const cone=value.abilities.find(a=>a.familyId==='flame-cone'),oldCone=old.abilities.find(a=>a.familyId==='flame-cone');assert.equal(cone.targeting,'ground-and-air');assert.match(cone.text,/ground and flying enemies/);
   assert.deepEqual({...cone,text:oldCone.text,targeting:oldCone.targeting},oldCone,'only cone targeting and its English description change');
   assert.deepEqual(value.abilities.filter(a=>a.familyId!=='flame-cone'),old.abilities.filter(a=>a.familyId!=='flame-cone'),'Burn, Fire Aura and Spark records remain exact');
   for(const field of fields.filter(k=>!['groundOnly','continuousAttack'].includes(k)))assert.deepEqual(value[field],old[field],id+'/'+field);
  }else for(const field of fields)assert.deepEqual(value[field],old[field],faction+'/'+id+'/'+tier+'/'+field);
 }
 assert.equal(profiles,258);
});

for(const id of dragonFamilies)for(const mode of ['air','ground','mixed'])for(const defense of ['ordinary','physical-immune','magic-immune','both-immune'])test(`scheduled ${id} cone: ${mode}, ${defense}`,()=>{
 const h=arena(id),props={physicalImmune:In(defense,['physical-immune','both-immune']),magicImmune:In(defense,['magic-immune','both-immune'])},aura=h.stats.abilities.find(a=>a.familyId==='fire-aura'),distance=aura?(h.stats.range+aura.radius)/2:2,burn=h.stats.abilities.find(a=>a.familyId==='burn'),expected=h.stats.continuousAttack.dps*.5;
 const targets=[];if(mode!=='ground')targets.push(h.spawn(10+distance,10,{...props,flying:true,traveled:100}));if(mode!=='air')targets.push(h.spawn(10+distance,10.15,{...props,flying:false,traveled:90}));
 const side=h.spawn(10,10+distance,{flying:true,traveled:1}),far=h.spawn(10+h.stats.range+.001,10,{flying:true,traveled:200});
 for(const enemy of targets)assert.equal(attackTargetAllowed(h.stats,enemy),true);
 for(let i=0;i<10;i++)h.tick(.05);
 const cone=h.traces.filter(row=>row.source===h.source&&row.effect==='magical'),blocked=props.magicImmune;
 assert.equal(h.channels.length,10,'real scheduled continuous events fire every simulation step');if(mode!=='ground')assert.equal(h.channels[0].target,targets[0],'the dragon acquires an airborne primary without a grounded fallback');assert.equal(h.sparks.length,0,'primary proof ends before the unchanged Spark cooldown');
 for(const enemy of targets){const rows=cone.filter(row=>row.enemy===enemy);assert.equal(rows.length,10);near(rows.reduce((s,r)=>s+r.requestedDamage,0),expected);near(rows.reduce((s,r)=>s+r.effectiveDamage,0),blocked?0:expected);
  if(blocked){assert.equal(enemy.hp,enemy.maxHp);assert.ok(rows.every(row=>row.blockReason==='magic-immunity'));assert.equal(enemy.statuses.burn,undefined);}else{assert.ok(enemy.hp<enemy.maxHp);assert.equal(enemy.statuses.burn.dps,burn.dps);assert.equal(enemy.statuses.burn.time,burn.duration);}
 }
 assert.equal(side.hp,side.maxHp,'a flying bystander outside the unchanged cone is not hit');assert.equal(far.hp,far.maxHp,'air permission does not extend range');
 proof.push({family:id,mode,defense,simulation:'actual Game.tick -> Combat.update -> scheduled continuous cone',seconds:.5,step:.05,channels:h.channels.length,coneDps:h.stats.continuousAttack.dps,auraExcludedByDistance:!aura||distance>aura.radius,sparkEvents:h.sparks.length,targets:targets.map(enemy=>({flying:enemy.flying,effectiveConeDamage:cone.filter(r=>r.enemy===enemy).reduce((s,r)=>s+r.effectiveDamage,0),totalHpLoss:enemy.maxHp-enemy.hp,burnDps:enemy.statuses.burn?.dps||0})),sideHpLoss:side.maxHp-side.hp,farHpLoss:far.maxHp-far.hp});
});
function In(value,values){return values.includes(value);}

for(const id of dragonFamilies)test(`${id} keeps its inclusive range, own cone angle, visibility and pause semantics`,()=>{
 const h=arena(id),aura=h.stats.abilities.find(a=>a.familyId==='fire-aura'),distance=aura?(h.stats.range+aura.radius)/2:2,half=h.stats.continuousAttack.angleDegrees/2,point=angle=>({x:10+Math.cos(angle*Math.PI/180)*distance,z:10+Math.sin(angle*Math.PI/180)*distance}),a=point(half-1),b=point(half+1),atEdge=h.spawn(10+h.stats.range,10,{flying:true,traveled:100}),inside=h.spawn(a.x,a.z,{flying:true,traveled:90}),outside=h.spawn(b.x,b.z,{flying:true,traveled:80}),expected=h.stats.continuousAttack.dps*.05;
 h.game.paused=true;h.tick(.05);assert.equal(h.channels.length,0);assert.equal(atEdge.hp,atEdge.maxHp);h.game.paused=false;h.tick(.05);near(atEdge.maxHp-atEdge.hp,expected);near(inside.maxHp-inside.hp,expected);assert.equal(outside.hp,outside.maxHp);
 const hidden=arena(id),cloaked=hidden.spawn(10+Math.max(distance,3.3),10,{flying:true,stealth:true,cloaked:true});hidden.game.grid.checkpoints=[];for(let i=0;i<10;i++)hidden.tick(.05);assert.equal(cloaked.hp,cloaked.maxHp);assert.equal(hidden.channels.length,0,'air targeting does not grant detection beyond the existing close reveal');
});

test('larger dragon Fire Aura records retain their independent actual damage and do not replace the newly air-capable cone',()=>{
 for(const id of ['el_fire_dragon','el_mother_fire_dragon','el_ancient_patriarch']){
  const h=arena(id),aura=h.stats.abilities.find(a=>a.familyId==='fire-aura'),air=h.spawn(10+aura.radius*.75,10,{flying:true});h.tick(.05);
  assert.deepEqual(h.traces.filter(r=>r.enemy===air).map(r=>r.requestedDamage).sort((a,b)=>a-b),[aura.dps*.05,h.stats.continuousAttack.dps*.05].sort((a,b)=>a-b));assert.equal(h.channels[0].target,air);assert.equal(h.sparks.length,0);
 }
});

test('Ancient Dragon Spark retains 4,000 damage / 5 seconds / 1 target and naturally shares the newly airborne target list',()=>{
 const h=arena('el_ancient_patriarch'),spark=h.stats.abilities.find(a=>a.familyId==='spark'),aura=h.stats.abilities.find(a=>a.familyId==='fire-aura'),distance=(h.stats.range+aura.radius)/2,air=h.spawn(10+distance,10,{flying:true});assert.deepEqual([spark.damage,spark.cooldown,spark.targets],[4000,5,1]);
 for(let i=0;i<102;i++)h.tick(.05);
 assert.equal(h.sparks.length,1);assert.equal(h.sparks[0].to,air);assert.equal(h.sparks[0].source,h.source);
 const sparkHits=h.traces.filter(r=>r.requestedDamage===spark.damage);assert.equal(sparkHits.length,1);near(sparkHits[0].effectiveDamage,4000);assert.equal(sparkHits[0].type,'magical');assert.ok(h.traces.every(r=>r.effect==='fire'||r.requestedDamage===spark.damage||Math.abs(r.requestedDamage-h.stats.continuousAttack.dps*.05)<1e-8),'outside the Fire Aura, packets are exactly cone, Burn and the one real Spark');
 sparkProof={family:h.source.family,seconds:h.game.combat.elapsed,distance,auraRadius:aura.radius,airborne:true,sparkEvents:h.sparks.length,sparkDamage:sparkHits[0].effectiveDamage,record:{damage:spark.damage,cooldown:spark.cooldown,targets:spark.targets},note:'Air eligibility naturally follows the expanded shared target list; no new secondary filter was introduced.'};
});

test('existing Dwarf cones still acquire air after the Elf dragon amendment',()=>{
 for(const id of ['dw_steamharpooner','dw_flamewarden','dw_emberanvil','dw_bombardking']){const h=arena(id,'forge'),air=h.spawn(12,10,{flying:true});h.tick(.05);assert.equal(h.stats.continuousAttack.targeting,'ground-and-air');assert.ok(air.hp<air.maxHp);assert.equal(h.channels[0].target,air);}
});

if(process.env.BASTIONS_ELF_DRAGON_AIR_PROOF)process.on('beforeExit',()=>{const file=path.resolve(process.env.BASTIONS_ELF_DRAGON_AIR_PROOF);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify({status:'passed',scope:'All four current Elf dragons target ground and air. Numeric primary and secondary records remain exact. Ancient Spark naturally shares the broader target list. Approved historical datasets/model/audio files preserved.',profilesChecked:258,dragons:dragonFamilies.map(id=>{const s=towerStats({family:id,tier:1},current.grove);return {family:id,groundOnly:s.groundOnly,cone:s.continuousAttack,burn:s.abilities.find(a=>a.familyId==='burn')};}),cases:proof,sparkAirEvent:sparkProof},null,2)+'\n');});
