import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {applyFr002Registry} from '../game/core/fr002-registry.js';import {applyFr003Registry} from '../game/core/fr003-registry.js';import {applyFr004Registry} from '../game/core/fr004-registry.js';import {applyFr005Registry} from '../game/core/fr005-registry.js';import {loadCurrentDatasets} from '../tools/current-datasets.mjs';import {towerStats} from '../game/core/math.js';import {baseAttackDps,abilityLines} from '../ui/grimoire.js';
const read=f=>JSON.parse(fs.readFileSync(new URL('../'+f,import.meta.url))),spec=read('data/fr005-approved.json'),before=loadCurrentDatasets({revision:'fr004'}),after=loadCurrentDatasets({revision:'fr005'}),base=applyFr004Registry(applyFr003Registry(applyFr002Registry(read('data/factions-v060.json'))));
const registry=applyFr005Registry(base),stable=o=>Array.isArray(o)?o.map(stable):o&&typeof o==='object'?Object.fromEntries(Object.keys(o).sort().map(k=>[k,stable(o[k])])):o;
test('FR-005 r2 applies 44 assignment arrays, one recipe and the authorized 35-profile Dwarf air-targeting amendment; unlisted fields are preserved and drift is rejected',()=>{
 const expected=structuredClone(base);expected.revision=registry.revision;expected.fr005=true;
 const unit=(r,c)=>r.factions.find(f=>f.id===c.factionId).units.find(u=>u.id===c.unitId);
 for(const c of spec.recipeChanges)unit(expected,c).recipe=structuredClone(c.after);
 for(const c of spec.abilityProfileChanges)unit(expected,c).profiles[c.rank-1].abilities=structuredClone(c.after);
 for(const c of spec.unitMetadataChanges)unit(expected,c)[c.field]=structuredClone(c.after);
 for(const c of spec.targetingProfileChanges)Object.assign(unit(expected,c).profiles[c.rank-1],structuredClone(c.after));
 assert.deepEqual(registry,expected);assert.deepEqual(base,applyFr004Registry(applyFr003Registry(applyFr002Registry(read('data/factions-v060.json')))));
 assert.equal(spec.revision,2);assert.equal(spec.abilityProfileChanges.length,44);assert.equal(spec.recipeChanges.length,1);assert.equal(spec.targetingProfileChanges.length,35);assert.equal(registry.revision,'fr005-r2-dwarf-air-20261102');assert.throws(()=>applyFr005Registry(registry),/exactly once/);
 for(const mutate of [r=>r.factions[1].units.find(u=>u.id==='dw_boarlancer').recipe[1].rank++,r=>r.factions[1].units.find(u=>u.id==='dw_repeatercrew').profiles[0].abilities.pop(),r=>r.factions[1].units.find(u=>u.id==='dw_shieldguard').profiles[0].groundOnly=false,r=>r.factions[1].units.find(u=>u.id==='dw_steamharpooner').profiles[0].continuousAttack.targeting='ground-and-air']){const bad=structuredClone(base);mutate(bad);assert.throws(()=>applyFr005Registry(bad),/baseline drift/);}
});
test('all 258 runtime profiles match approved revision 2 and the authorized Dwarf targeting amendment; output, timing, cycles, media and 113 other recipes remain exact',()=>{
 const atlas=read('output/implementation/fr005-current/authority/atlas-preview.json');let profiles=0,occurrences=0,recipes=0;const families=new Set(),numbers=new Set(),variants=new Set();
 for(const f of atlas.factions){const d=after[f.id],b=before[f.id];assert.deepEqual(d.defenderAssets,b.defenderAssets);for(const u of f.units){
  if(u.kind!=='basic'){assert.deepEqual(d.recipes.find(r=>r.id===u.id).ingredients.map(i=>({id:i.family,rank:i.tier})),u.recipe);recipes++;}
  for(const [i,p]of u.profiles.entries()){const s=towerStats({family:u.id,tier:i+1},d),old=towerStats({family:u.id,tier:i+1},b),key=`${f.id}/${u.id}/${i+1}`;
   const targeting=spec.targetingProfileChanges.find(c=>c.key===key);
   for(const field of ['damage','interval','range','type','melee','groundOnly','weaponCycle','continuousAttack'])assert.deepEqual(s[field],targeting&&Object.hasOwn(targeting.after,field)?targeting.after[field]:old[field],key+'/'+field);
   assert.equal(baseAttackDps(s),baseAttackDps(old),key+'/single-target DPS');assert.deepEqual(stable(s.abilities.map(({text,...a})=>a)),stable(p.abilities.map(({text,...a})=>a)),key+'/approved mechanics');for(const a of s.abilities)if(a.familyId!=='flame-cone')assert.equal(a.text,p.abilities.find(v=>v.levelId===a.levelId).text);
   for(const a of s.abilities){families.add(a.familyId);numbers.add(a.familyId+'/'+a.level);variants.add(a.levelId);}profiles++;occurrences+=s.abilities.length;
  }
 }}assert.deepEqual([profiles,occurrences,recipes,families.size,numbers.size,variants.size],[258,559,114,41,159,167]);
 for(const f of Object.keys(after))for(const r of after[f].recipes)if(r.id!=='dw_boarlancer')assert.deepEqual(r,before[f].recipes.find(b=>b.id===r.id));
 assert.deepEqual(after.forge.recipes.find(r=>r.id==='dw_boarlancer').ingredients,[{family:'dw_boarrider',tier:3},{family:'dw_boarrider',tier:1},{family:'dw_shieldguard',tier:1}]);
 const golem=after.crown.towers.emeraldgolem;assert.ok(!golem.stoneGazeChance&&!golem.petrifyIgnoresImmunity);assert.match(abilityLines(golem).join(' '),/Stun I/);assert.doesNotMatch(abilityLines(golem).join(' '),/Stone Gaze/);
});
test('all 21 detection removals are exact; remaining support detection stays usable in each faction',()=>{
 let removed=0;for(const f of Object.keys(after)){let retained=0;for(const [family,def]of Object.entries(before[f].towers))for(let tier=1;tier<=(def.advanced?1:6);tier++){
  const b=towerStats({family,tier},before[f]),a=towerStats({family,tier},after[f]),old=b.abilities.find(a=>a.familyId==='visibility'),now=a.abilities.find(a=>a.familyId==='visibility');
  if(old&&!now){removed++;assert.ok(!a.detectionRange);assert.ok(f==='forge'?family==='dw_griffinhandler'||['dw_griffinscout','dw_skyhook','dw_talonlord','dw_highthane'].includes(family):f==='grove'&&['el_grove_archer','el_elven_archer','el_elven_bowmaster','el_tempest_bowmage','el_starfall_bowmaster','el_twilight_huntress'].includes(family),family);}
  else if(old){assert.deepEqual(now,old);retained++;}
 }assert.ok(retained>0,f+' still has extended detection');}assert.equal(removed,21);
});
