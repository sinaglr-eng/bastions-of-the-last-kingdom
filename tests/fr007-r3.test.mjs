import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {loadCurrentDatasets} from '../tools/current-datasets.mjs';import {applyFr006Fr007Registry} from '../game/core/fr006-fr007-registry.js';import {Game} from '../game/core/game.js';import {expandRecipeToBasics,matchingIngredients} from '../game/core/recipes.js';
const read=f=>JSON.parse(fs.readFileSync(new URL('../'+f,import.meta.url))),handoff=read('output/design/fr007-rank1-current/implementation-handoff.json'),plans=['dwarf','elf'].map(n=>read('output/design/fr007-rank1-current/'+n+'-plan.json')),data=loadCurrentDatasets({revision:'fr007r3'}),before=loadCurrentDatasets({revision:'fr006r2'});
test('FR-007 revision 3 implements all 16 exact latest deltas and 51 material totals, preserving every combat profile, model and Human/Secret recipe',()=>{
 assert.equal(handoff.revision,3);assert.equal(handoff.recipeChanges.length,16);assert.equal(handoff.materialChanges.length,51);
 let changed=0,materials=0,profiles=0;
 for(const [f,d]of Object.entries(data)){
  assert.equal(d.rulesetRevision,'fr006-fr007-r3-20261106');assert.deepEqual(d.towers,before[f].towers);assert.deepEqual(d.defenderAssets,before[f].defenderAssets);assert.deepEqual(d.enemies,before[f].enemies);assert.deepEqual(d.balance,before[f].balance);profiles+=Object.values(d.towers).reduce((n,t)=>n+(t.advanced?1:6),0);
  for(const r of d.recipes){const old=before[f].recipes.find(p=>p.id===r.id),delta=handoff.recipeChanges.find(c=>c.factionId===f&&c.unitId===r.id);if(delta){changed++;assert.deepEqual(old.ingredients,delta.before.map(i=>({family:i.id,tier:i.rank})));assert.deepEqual(r.ingredients,delta.after.map(i=>({family:i.id,tier:i.rank})));}else assert.deepEqual(r,old);
   if(f==='crown'||r.id==='ladyclaire')assert.deepEqual(r,old);
   const cost=(recipe,ds)=>expandRecipeToBasics(recipe,ds).reduce((n,i)=>n+i.count*2**(i.tier-1),0),a=cost(old,before[f]),b=cost(r,d),record=handoff.materialChanges.find(c=>c.factionId===f&&c.unitId===r.id);if(record){materials++;assert.equal(a,record.before);assert.equal(b,record.after);}else assert.equal(a,b);
  }
 }assert.deepEqual([profiles,changed,materials],[258,16,51]);
 assert.throws(()=>applyFr006Fr007Registry({revision:'fr006-fr007-r2-20261106',fr005:true,fr007:true}),/exactly once/);
});
test('current recipes satisfy all branch, rank, successor and TOP constraints in the latest gallery handoff',()=>{
 let ordinary=0,terminal=0,tops=0;
 for(const plan of plans){const d=data[plan.factionId],units=new Map(d.recipes.map(r=>[r.id,r])),branches=new Map(plan.branches.map(b=>[b.id,b])),signatures=new Set();
  const topReach=(id,seen=new Set())=>{assert.ok(!seen.has(id),'Cycle at '+id);return d.recipes.filter(r=>r.ingredients.some(i=>i.family===id)).some(r=>r.stage==='TOP'||topReach(r.id,new Set(seen).add(id)));};
  for(const r of d.recipes.filter(r=>r.id!=='ladyclaire')){ordinary++;const row=plan.recipes.find(p=>p.unitId===r.id),branch=branches.get(row.branchId),pool=new Set(branch.normalPool||[branch.mainId,...branch.supportIds]),direct=r.ingredients.filter(i=>!d.towers[i.family].advanced),leaves=expandRecipeToBasics(r,d);
   assert.deepEqual(r.ingredients,row.after.map(i=>({family:i.id,tier:i.rank})));assert.equal(r.ingredients.length,3);const signature=r.ingredients.map(i=>i.family+'/'+i.tier).sort().join('|');assert.ok(!signatures.has(signature));signatures.add(signature);
   assert.deepEqual(r.ingredients.filter(i=>d.towers[i.family].advanced),before[plan.factionId].recipes.find(p=>p.id===r.id).ingredients.filter(i=>d.towers[i.family].advanced));
   if(row.classification==='BASIC'){assert.ok(direct.some(i=>i.family===branch.mainId&&i.tier===1));assert.ok(leaves.every(i=>i.tier<=2));}else assert.ok(direct.every(i=>i.tier>=2));
   if(row.classification==='INTERMEDIATE')assert.ok(leaves.every(i=>i.tier<=4));
   if(row.classification==='ADVANCED')assert.ok(direct.every(i=>i.tier<=5));
   if(row.classification==='TOP'){tops++;assert.deepEqual(direct.map(i=>i.tier),[6,6]);assert.equal(units.get(r.ingredients.find(i=>d.towers[i.family].advanced).family).stage,'ADVANCED');}
   const end=row.classification==='ADVANCED'&&!topReach(r.id);assert.equal(end,row.terminal);if(end){terminal++;if(r.id==='dw_grapeshotcart')assert.deepEqual(r.ingredients,[{family:'dw_thunderlock',tier:1},{family:'dw_musketeer',tier:4},{family:'dw_grenadier',tier:4}]);else assert.ok(direct.some(i=>!pool.has(i.family)));}else assert.ok(leaves.every(i=>pool.has(i.family)));
  }
 }
 assert.deepEqual([ordinary,terminal,tops],[74,10,16]);
 for(const [f,d]of Object.entries(data)){let one=0,two=0;for(const [id,t]of Object.entries(d.towers))for(let tier=1;tier<=(t.advanced?1:6);tier++){const outputs=d.recipes.filter(r=>r.ingredients.some(i=>i.family===id&&i.tier===tier)),expected=handoff.successorRows.find(r=>r.factionId===f&&r.unitId===id&&r.rank===tier);assert.ok(outputs.length<=3);assert.deepEqual(outputs.map(r=>r.id).sort(),expected.outputs.map(r=>r.id).sort());if(!t.advanced){assert.ok(outputs.length>=1);if(f!=='crown'&&tier===1){assert.ok(outputs.length<=2);if(outputs.length===1)one++;else two++;}}}if(f!=='crown')assert.deepEqual([one,two],[7,1]);}
});
test('all 74 current Dwarf and Elf recipes craft with three distinct physical ingredients through the real game',()=>{
 for(const f of ['forge','grove'])for(const recipe of data[f].recipes.filter(r=>r.id!=='ladyclaire')){
  const g=new Game(data[f],{seed:71});g.phase='ready';g.towers=recipe.ingredients.map((i,k)=>({id:k+1,family:i.family,tier:i.tier,state:'active',x:5+k,z:5,kills:0,mvpLevel:0}));g.selected=1;
  assert.equal(matchingIngredients(recipe,g.towers,g.selection).length,3);assert.equal(g.craft(recipe.id),true,recipe.id);assert.equal(g.towers[0].family,recipe.id);assert.equal(g.towers.filter(t=>t.state==='active').length,1);
 }
});
