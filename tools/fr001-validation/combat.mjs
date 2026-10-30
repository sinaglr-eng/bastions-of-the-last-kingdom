import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {Game} from '../../game/core/game.js';
import {towerStats} from '../../game/core/math.js';
import {loadDatasets,defaultPatchFiles,root,read,sha} from './datasets.mjs';
const manifestPath=process.argv.find(x=>x.startsWith('--patch-set='))?.split('=')[1];
const patchFiles=manifestPath?read(manifestPath).files:defaultPatchFiles;
const baseline=loadDatasets(),candidate=loadDatasets({patchFiles});
assert.deepEqual(candidate.crown,baseline.crown,'Human unchanged');
const tag=process.argv.find(x=>x.startsWith('--tag='))?.split('=')[1]||'final';
if(!/^[a-z0-9-]+$/.test(tag))throw Error('Invalid tag');
const out=resolve(root,'output/releases/v0.6.2/fr001/combat',tag);mkdirSync(out,{recursive:true});
const datasets=[{id:'crown-baseline',data:baseline.crown},{id:'forge-baseline',data:baseline.forge},{id:'forge-candidate',data:candidate.forge},{id:'grove-baseline',data:baseline.grove},{id:'grove-candidate',data:candidate.grove}];
const scenarios=[{id:'early-air',wave:5,variant:0},{id:'evasion',wave:9},{id:'early-boss',wave:10},{id:'magical-immunity',wave:16},{id:'regeneration',wave:21},{id:'heavy-armor',wave:22},{id:'physical-immunity-refraction',wave:23},{id:'late-air-magical-immunity',wave:42},{id:'missing-health-recharge',wave:49},{id:'final-flying-boss',wave:50,variant:0},{id:'final-magic-immune-flying-boss',wave:50,variant:1},{id:'final-physical-immune-flying-boss',wave:50,variant:2}];
const rounded=n=>Math.round(n*1e6)/1e6;
function arena(data,army,scenario,{duration=60,seed=91731,targets=3}={}){
 const g=new Game(data,{seed});g.phase='combat';g.round=scenario.wave;
 const wave=data.waves[scenario.wave-1],group=wave.groups[0],base=data.enemies[group.type];
 const modifiers={...wave,...group,...(base.variants?.length?{variant:structuredClone(base.variants[scenario.variant||0])}:{})};
 const offsets=targets===1?[{x:0,z:0}]:[{x:0,z:0},{x:.4,z:0},{x:-.4,z:0}];
 const bySource={},result={factionId:data.factionId,scenario:scenario.id,wave:scenario.wave,seed,duration,targets,army:army.map(({family,tier})=>({family,tier,name:data.towers[family].name})),effectiveDamage:0,healing:0,kills:0,shots:0,firstKillAt:null,blocked:{},weaponCycles:[],statusApplications:{}};
 g.towers=army.map((t,i)=>({id:i+1,state:'active',round:scenario.wave,kills:0,cooldown:0,mvpLevel:0,x:18,z:18,...t}));
 assert.ok(g.towers.every(t=>Number.isInteger(t.x)&&Number.isInteger(t.z)),'Controlled sources use integer tiles');
 assert.equal(new Set(g.towers.map(t=>`${t.x},${t.z}`)).size,g.towers.length,'Controlled defenders never overlap');
 result.army=g.towers.map(t=>({family:t.family,tier:t.tier,name:data.towers[t.family].name,x:t.x,z:t.z}));
 result.formation={uniqueTileCount:g.towers.length,overlap:false,cardinal:g.towers.map(t=>{
  const neighbors=g.towers.filter(other=>other!==t&&Math.abs(other.x-t.x)+Math.abs(other.z-t.z)===1),s=towerStats(t,data),lone=s.abilities?.find(a=>a.familyId==='lone-vigil'),bond=s.abilities?.find(a=>a.familyId==='bonded-formation');
  return {family:t.family,x:t.x,z:t.z,neighbors:neighbors.map(n=>n.family),loneVigilEligible:lone?neighbors.length===0:null,bondedFormationEligible:bond?neighbors.some(n=>bond.partnerIds?.includes(n.family)):null};
 })};
 g.combat.spawnQueue=[{time:1e9,type:group.type,modifiers}];
 const fill=()=>{while(g.combat.enemies.filter(e=>!e.dead).length<targets){const slot=g.combat.enemies.filter(e=>!e.dead).length,e=g.combat.spawn(group.type,modifiers);Object.assign(e,{speed:0,x:18+offsets[slot].x,z:19.5+offsets[slot].z});}};
 g.on((type,event)=>{
  if(type==='hit'){result.effectiveDamage+=event.effectiveDamage;bySource[event.source?.family]=(bySource[event.source?.family]||0)+event.effectiveDamage;}
  if(type==='enemy-heal')result.healing+=event.amount;
  if(type==='death'){result.kills++;result.firstKillAt??=g.combat.elapsed;}
  if(type==='shot')result.shots++;
  if(type==='damage-trace'&&event.blockReason)result.blocked[event.blockReason]=(result.blocked[event.blockReason]||0)+1;
 });
 for(let step=0;step<duration*10;step++){
  fill();g.combat.update(.1);
  for(const e of g.combat.enemies){assert.ok(Number.isFinite(e.hp)&&Number.isFinite(e.maxHp)&&Number.isFinite(e.armor)&&Number.isFinite(e.x)&&Number.isFinite(e.z),`${scenario.id}: non-finite enemy`);for(const key of Object.keys(e.statuses))result.statusApplications[key]=(result.statusApplications[key]||0)+1;}
  for(const t of g.towers){
   assert.ok(Number.isFinite(t.cooldown),`${t.family}: non-finite cooldown`);
   if(t.weaponCycleState){for(const value of Object.values(t.weaponCycleState))assert.ok(Number.isFinite(value),`${t.family}: non-finite weapon state`);assert.ok(t.weaponCycleState.remaining>=0);}
  }
  assert.equal(g.phase,'combat');assert.equal(g.lives,data.balance.startingLives,'Stationary benchmark cannot leak');
 }
 result.effectiveDamage=rounded(result.effectiveDamage);result.healing=rounded(result.healing);result.dps=rounded(result.effectiveDamage/duration);result.firstKillAt=result.firstKillAt===null?null:rounded(result.firstKillAt);result.damageBySource=Object.fromEntries(Object.entries(bySource).map(([id,n])=>[id,rounded(n)]));
 result.weaponCycles=g.towers.filter(t=>t.weaponCycleState).map(t=>({family:t.family,state:t.weaponCycleState,releaseCount:t.factionReleases}));
 return result;
}
const profiles=[],armies=[];
const positions=[{x:17,z:18},{x:18,z:18},{x:19,z:18},{x:17,z:19},{x:19,z:19},{x:17,z:20},{x:18,z:20},{x:19,z:20}];
for(const dataset of datasets){
 for(const [family,t]of Object.entries(dataset.data.towers))for(let tier=1;tier<=(t.advanced?1:6);tier++)for(const scenario of scenarios){
  profiles.push({dataset:dataset.id,name:t.name,family,tier,...arena(dataset.data,[{family,tier}],scenario)});
 }
 for(const tier of [1,3,5,6]){const army=Object.entries(dataset.data.towers).filter(([,s])=>!s.advanced).map(([family],i)=>({family,tier,...positions[i]}));
  for(const scenario of scenarios)armies.push({dataset:dataset.id,tier,...arena(dataset.data,army,scenario)});
 }
 console.log(JSON.stringify({completed:dataset.id,profiles:profiles.length,armies:armies.length}));
}
const patchHashes=Object.fromEntries(patchFiles.map(p=>[p,sha(p)]));
const report={date:'2026-10-30',requirementId:'FR-001',status:'completed',patchHashes,method:'Actual combat engine, stationary real wave kits, three respawning actual-HP targets, fixed seed91731,0.1secondsteps,60seconds. Unique eight-tile army geometry. Effective HP damage, not uncapped raw DPS or acquired campaign state.',profileCases:profiles.length,armyCases:armies.length,armies:armies.map(r=>({dataset:r.dataset,tier:r.tier,scenario:r.scenario,dps:r.dps,kills:r.kills,healing:r.healing,formation:r.formation})),profiles:profiles.map(r=>({dataset:r.dataset,family:r.family,name:r.name,tier:r.tier,scenario:r.scenario,dps:r.dps,kills:r.kills}))};
writeFileSync(resolve(out,'results.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({profileCases:profiles.length,armyCases:armies.length}));
