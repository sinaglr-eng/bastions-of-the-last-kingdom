import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Game} from '../game/core/game.js';
import {towerStats} from '../game/core/math.js';
import {loadCurrentDatasets} from '../tools/current-datasets.mjs';
import {immunityAuraCoverage} from '../game/core/immunity-auras.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),output=path.join(root,'output/implementation/fr008-current/wave38'),data=loadCurrentDatasets();fs.mkdirSync(output,{recursive:true});
const runtimeVersion=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version;
const waveIndex=37,step=.01,duration=8;
const fingerprints=Object.fromEntries(['package.json','data/enemies.json','data/fr006-fr007-approved.json','game/core/combat.js','game/core/combat-rules.js','game/core/immunity-auras.js'].map(p=>[p,createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')]));
const profiles=Object.entries(data).flatMap(([faction,d])=>Object.entries(d.towers).flatMap(([family,u])=>Array.from({length:u.advanced?1:6},(_,index)=>({faction,family,tier:index+1,name:u.name}))));
assert.equal(profiles.length,258);

function scenario(profile,{variantIndex=1,aura=null,seconds=duration,healing=true}={}){
 const d=data[profile.faction],g=new Game(d,{seed:43877}),c=g.combat;
 g.round=38;g.phase='combat';g.rng=()=>.999999;
 c.start(d.waves[waveIndex]);c.spawnQueue=[{time:1e9,type:'host_01',modifiers:{}}];
 const tower={id:1,family:profile.family,tier:profile.tier,state:'active',x:10,z:10,kills:0,cooldown:0,mvpLevel:0};
 g.towers=[tower];
 if(aura)g.towers.push({id:2,family:aura.family,tier:aura.tier,state:'active',x:aura.outside?50:10,z:12,kills:0,cooldown:0,mvpLevel:0,attackPaused:true});
 const wave=d.waves[waveIndex],group=wave.groups[0],e=c.spawn(group.type,{...wave,...group,variant:d.enemies[group.type].variants[variantIndex]});
 // This is an isolated coverage/weapon probe. Freeze only the path position,
 // while preserving authored HP, armor, defenses, variant and regeneration.
 Object.assign(e,{x:11,z:10,speed:0,route:[{x:1000,z:10}],pathIndex:0,traveled:0});
 if(!healing)e.regen=0;
 const s=towerStats(tower,d),trace=[],hits=[],heals=[],shots=[];
 g.on((kind,payload)=>{
  if(kind==='damage-trace'&&payload.enemy===e&&payload.source===tower)trace.push({time:c.elapsed,type:payload.type,requested:payload.requestedDamage,applied:payload.appliedDamage,effective:payload.effectiveDamage,reason:payload.blockReason,direct:payload.directHit,immunityMultiplier:payload.immunityMultiplier});
  if(kind==='hit'&&payload.enemy===e&&payload.source===tower)hits.push(payload.effectiveDamage);
  if(kind==='enemy-heal'&&payload.enemy===e)heals.push({time:c.elapsed,amount:payload.amount,cause:payload.cause});
  if(kind==='shot'&&payload.source===tower)shots.push(c.elapsed);
 });
 let minHp=e.hp;
 for(let elapsed=0;elapsed<seconds-1e-9&&!e.dead;elapsed+=step){c.update(step);minHp=Math.min(minHp,e.hp);}
 const positive=trace.filter(r=>r.effective>0),blocked=trace.filter(r=>r.reason),coverage=immunityAuraCoverage(e,g.towers,d);
 return {...profile,variantIndex,variant:e.name,condition:aura?`${aura.family}/${aura.tier}/${aura.outside?'outside':'inside'}`:'no-support',healing,seconds:c.elapsed,stats:{damage:s.damage,type:s.type,interval:s.interval,range:s.range,groundOnly:!!s.groundOnly,weapon:s.weapon?.kind??s.weaponCycle?.kind??null,antiRegeneration:s.abilities?.find(a=>a.familyId==='anti-regeneration')??null},enemy:{maxHp:e.maxHp,armor:e.armor,regen:e.regen,stealth:e.stealth,physicalImmune:!!e.physicalImmune,magicImmune:!!e.magicImmune,disarm:!!e.disarm},shots:shots.length,damageEvents:positive.length,appliedDamage:positive.reduce((n,r)=>n+r.applied,0),effectiveDamage:positive.reduce((n,r)=>n+r.effective,0),healed:heals.reduce((n,r)=>n+r.amount,0),finalHp:e.hp,minHp,killed:!!e.dead,firstDamage:positive[0]??null,blockedReasons:Object.fromEntries([...new Set(blocked.map(r=>r.reason))].map(reason=>[reason,blocked.filter(r=>r.reason===reason).length])),coverage};
}

const allProfiles=profiles.map(p=>scenario(p));
assert.ok(allProfiles.every(row=>row.effectiveDamage>0),'Every scheduled profile must apply actual HP damage to Blood-Leech Trolls.');
const dwarfWithRuneMage=profiles.filter(p=>p.faction==='forge').map(p=>scenario(p,{aura:{family:'dw_tunnelsapper',tier:1}}));
assert.equal(dwarfWithRuneMage.length,86);assert.ok(dwarfWithRuneMage.every(row=>row.effectiveDamage>0));
const mage=data.forge.towers.dw_tunnelsapper;assert.ok(mage,'Rune Mage exact family exists');
const runeRows=Object.entries(data.forge.towers).flatMap(([family,u])=>Array.from({length:u.advanced?1:6},(_,index)=>({family,tier:index+1,profile:towerStats({family,tier:index+1},data.forge)}))).filter(r=>r.profile.abilities?.some(a=>a.familyId==='cancel-physical-immunity-aura'));
const auraSamples=[];
for(const caster of runeRows){for(const outside of [false,true])auraSamples.push(scenario({faction:'forge',family:'dw_musketeer',tier:1,name:data.forge.towers.dw_musketeer.name},{aura:{family:caster.family,tier:caster.tier,outside},seconds:2}));}
assert.ok(auraSamples.every(row=>row.firstDamage.applied===allProfiles.find(r=>r.faction==='forge'&&r.family==='dw_musketeer'&&r.tier===1).firstDamage.applied),'A non-immune Blood-Leech takes the same first Physical damage with any immunity aura inside or outside.');
const healingSamples=['dw_musketeer','dw_ironstorm','dw_bombardking'].flatMap(family=>[true,false].map(healing=>scenario({faction:'forge',family,tier:1,name:data.forge.towers[family].name},{seconds:30,healing})));
// Confirm that the variant merge itself correctly distinguishes concealment.
const knifemanSamples=profiles.map(p=>scenario(p,{variantIndex:0,seconds:8}));
assert.ok(knifemanSamples.every(row=>row.effectiveDamage>0),'Every scheduled profile also applies HP damage to the close-range revealed Knifeman variant after its temporary disarm.');

const summarize=rows=>Object.entries(data).map(([faction])=>{const items=rows.filter(row=>row.faction===faction);return {faction,profiles:items.length,positiveDamage:items.filter(r=>r.effectiveDamage>0).length,noDamage:items.filter(r=>r.effectiveDamage<=0).length,killedInEightSeconds:items.filter(r=>r.killed).length,aliveAfterEightSeconds:items.filter(r=>!r.killed).length,regenerationRestoredAtLeast99PercentOfDamage:items.filter(r=>!r.killed&&r.healed>=r.effectiveDamage*.99).length,minEffectiveDamage:Math.min(...items.map(r=>r.effectiveDamage)),maxEffectiveDamage:Math.max(...items.map(r=>r.effectiveDamage))};});
const summary={status:'passed',requirementId:'FR-008',checkedAt:new Date().toISOString(),runtimeVersion,rulesetRevision:data.forge.rulesetRevision,scenario:'Actual 0.6.12 scheduled weapons against the exact two wave-38 variants at authored HP/armor/regeneration. One active attacker, no neighboring friendly offensive support; stationary victim inside attack range. Fixed high RNG avoids random critical/control/evasion procs. Knifemen are revealed by the authored close-defender reveal radius and retain their temporary disarm. No legal campaign win or player-save state is implied.',profiles:258,actualDamageChecks:allProfiles.length+dwarfWithRuneMage.length+auraSamples.length+healingSamples.length+knifemanSamples.length,variant:{...data.forge.enemies.host_38,...data.forge.enemies.host_38.variants[1]},regenerationPerSecond:data.forge.enemies.host_38.hp*.25,allProfiles:summarize(allProfiles),knifemanProfiles:summarize(knifemanSamples),dwarfWithRuneMage:{profiles:dwarfWithRuneMage.length,positiveDamage:dwarfWithRuneMage.filter(r=>r.effectiveDamage>0).length},runeAuraSources:runeRows.map(r=>({family:r.family,tier:r.tier,name:r.profile.name,aura:r.profile.abilities.find(a=>a.familyId==='cancel-physical-immunity-aura')})),notes:['The Blood-Leech variant has no Physical or Magical immunity and explicitly disables inherited stealth and disarm.','It regenerates 25% of MAXIMUM health each simulation second: 7,842.25 HP/s at wave-38 HP 31,369. This exceeds many individual sustained attack profiles.','A Cancel Physical Immunity Aura has no damage multiplier effect on this non-immune enemy. It is not required to make Physical hits deal damage.','Positive damage is measured from actual owned HP-loss damage traces, even when regeneration subsequently restores all visible health.','This isolates the damage gate. A specific saved player army, placement, attack pause, route, concealment mix and retargeting state was not supplied.'],protectedFingerprints:fingerprints};
for(const [p,before]of Object.entries(fingerprints))assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex'),before,'Read-only audit source '+p);
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({summary,allProfiles,dwarfWithRuneMage,auraSamples,healingSamples,knifemanSamples},null,2)+'\n');
fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({status:'passed',runtimeVersion,profiles:258,summary:summary.allProfiles,dwarfWithRuneMage:summary.dwarfWithRuneMage,regenerationPerSecond:summary.regenerationPerSecond,healingSamples:healingSamples.map(({effectiveDamage,healed,finalHp,killed,healing})=>({effectiveDamage,healed,finalHp,killed,healing}))}));
