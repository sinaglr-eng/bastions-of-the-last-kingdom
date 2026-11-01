import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {loadFr003Datasets} from '../tools/fr003-validation/datasets.mjs';import {towerStats} from '../game/core/math.js';import {baseAttackDps} from '../ui/grimoire.js';import {recipeCapabilities} from '../ui/recipe-filters.js';
const approved=JSON.parse(fs.readFileSync(new URL('../data/fr003-approved.json',import.meta.url))),before=loadFr003Datasets({baseline:true}),after=loadFr003Datasets({revision:'fr003'});
test('FR-003 applies exactly 37 approved profile deltas over actual FR-002 and preserves all recipes, Claire, other Human profiles and native bindings',()=>{
 assert.equal(approved.changes.length,37);assert.equal(approved.changes.filter(c=>c.factionId==='crown').length,1);const changed=new Set(approved.changes.map(c=>c.key));let count=0;
 for(const id of Object.keys(after)){assert.equal(after[id].rulesetRevision,'fr003-r2-20261101');assert.deepEqual(after[id].recipes,before[id].recipes);assert.deepEqual(after[id].defenderAssets,before[id].defenderAssets);
  for(const [family,u]of Object.entries(after[id].towers))for(let tier=1;tier<=(u.advanced?1:6);tier++){const key=`${id}/${family}/${tier}`,s=towerStats({family,tier},after[id]),old=towerStats({family,tier},before[id]);count++;
   if(!changed.has(key))assert.deepEqual(s,old,key+' must remain exact');
   const delta=approved.changes.find(c=>c.key===key);if(!delta)continue;
   for(const d of delta.stats){const get=o=>d.field.split('.').reduce((a,k)=>a[k],o);assert.equal(get(old),d.before,key+'/'+d.field+'/before');assert.equal(get(s),d.after,key+'/'+d.field+'/after');}
   const expected=structuredClone(old.abilities);for(const d of delta.abilities){const index=expected.findIndex(a=>a.familyId===d.oldFamilyId);assert.deepEqual(expected[index],d.before);expected[index]=d.after;}assert.deepEqual(s.abilities,expected,key+'/abilities');
  }
 }assert.equal(count,258);
});
test('all 21 old immunity sources migrate exactly once to the six-level aura ladders; filters identify the new ally support',()=>{
 const seen={physical:[],magical:[]};for(const [id,d]of Object.entries(after))for(const [family,u]of Object.entries(d.towers))for(let tier=1;tier<=(u.advanced?1:6);tier++){
  const s=towerStats({family,tier},d);assert.equal(s.abilities.some(a=>['cancel-physical-immunity','cancel-magic-immunity'].includes(a.familyId)),false);
  for(const a of s.abilities.filter(a=>a.familyId.endsWith('immunity-aura'))){seen[a.immunity].push(a);assert.equal(a.damageMultiplier,[.25,.35,.5,.65,.8,1][a.level-1]);assert.equal(a.radius,[2.5,3,3.5,4,4.5,5][a.level-1]);for(const k of ['cooldown','duration','targets','range'])assert.equal(Object.hasOwn(a,k),false);assert.equal(a.mode,'aura');assert.equal(a.stacking,'strongest-per-damage-type');assert.ok(recipeCapabilities(s).abilities.has('support'));assert.ok(recipeCapabilities(s).counters.has(a.immunity==='physical'?'physical-immunity':'magic-immunity'));}
 }assert.equal(seen.physical.length,10);assert.equal(seen.magical.length,11);for(const rows of Object.values(seen))assert.deepEqual([...new Set(rows.map(a=>a.level))].sort(),[1,2,3,4,5,6]);
});
test('Rifleman sustained DPS uses the 1-second actual cadence and unchanged 3-shot/4.05-second reload; changed sniper cycles and ground-only Mortar retain their contracts',()=>{
 const d=after.forge,s=towerStats({family:'dw_longrifle',tier:1},d);assert.equal(s.interval,1);assert.equal(s.weaponCycle.fixedInterval,1);assert.equal(s.weaponCycle.magazine,3);assert.equal(s.weaponCycle.reload,4.05);assert.ok(Math.abs(baseAttackDps(s)-840/7.05)<1e-10);
 for(const id of ['dw_thunderlock','dw_steamrail','dw_ironstorm','dw_grapeshotcart']){const old=towerStats({family:id,tier:1},before.forge),next=towerStats({family:id,tier:1},d);assert.deepEqual(next.weaponCycle,old.weaponCycle);const w=next.weaponCycle;assert.ok(Math.abs(baseAttackDps(next)-next.damage*w.magazine/((w.spinUpSeconds||0)+w.magazine*w.fixedInterval+w.reload))<1e-10);}
 assert.ok(towerStats({family:'dw_grapeshotcart',tier:1},d).groundOnly);assert.equal(baseAttackDps(towerStats({family:'roseguard',tier:1},after.crown)),700);assert.ok(Math.abs(after.crown.towers.roseguard.expectedMetrics.primaryDps-980)<1e-10);
});
