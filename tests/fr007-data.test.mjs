import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {applyFr002Registry} from '../game/core/fr002-registry.js';import {applyFr003Registry} from '../game/core/fr003-registry.js';import {applyFr004Registry} from '../game/core/fr004-registry.js';import {applyFr005Registry} from '../game/core/fr005-registry.js';import {applyFr006Fr007Registry} from '../game/core/fr006-fr007-registry.js';import {loadCurrentDatasets} from '../tools/current-datasets.mjs';import {expandRecipeToBasics,matchingIngredients} from '../game/core/recipes.js';import {Game} from '../game/core/game.js';
const read=f=>JSON.parse(fs.readFileSync(new URL('../'+f,import.meta.url))),handoff=read('output/design/fr007-current/implementation-handoff.json'),plans=['dwarf','elf'].map(n=>read('output/design/fr007-current/'+n+'-plan.json'));
const baseline=applyFr005Registry(applyFr004Registry(applyFr003Registry(applyFr002Registry(read('data/factions-v060.json'))))),registry=applyFr006Fr007Registry(baseline,{recipeRevision:2}),data=loadCurrentDatasets({revision:'fr006r2'}),old=loadCurrentDatasets({revision:'fr005'});
test('FR-007 revision 2 applies exactly 47 reviewed recipe arrays and preserves all 258 profiles, approved assets, Human and Secret recipes',()=>{
 const expected=structuredClone(baseline);expected.revision=registry.revision;expected.fr006=expected.fr007=true;
 assert.equal(handoff.revision,2);assert.equal(handoff.recipeChanges.length,47);
 for(const c of handoff.recipeChanges)expected.factions.find(f=>f.id===c.factionId).units.find(u=>u.id===c.unitId).recipe=structuredClone(c.after);
 assert.deepEqual(registry,expected);assert.throws(()=>applyFr006Fr007Registry(registry),/exactly once/);const bad=structuredClone(baseline);bad.factions[1].units.find(u=>u.id==='dw_ironwarden').recipe[0].rank=6;assert.throws(()=>applyFr006Fr007Registry(bad),/baseline drift/);
 let profiles=0,changed=0,materials=0;for(const [f,d]of Object.entries(data)){
  assert.deepEqual(d.towers,old[f].towers);assert.deepEqual(d.defenderAssets,old[f].defenderAssets);profiles+=Object.values(d.towers).reduce((n,t)=>n+(t.advanced?1:6),0);
  for(const r of d.recipes){const prev=old[f].recipes.find(p=>p.id===r.id);if(JSON.stringify(r)!==JSON.stringify(prev))changed++;
   if(f==='crown'||r.id==='ladyclaire')assert.deepEqual(r,prev);
   const cost=v=>expandRecipeToBasics(v,d).reduce((n,i)=>n+i.count*2**(i.tier-1),0),before=expandRecipeToBasics(prev,old[f]).reduce((n,i)=>n+i.count*2**(i.tier-1),0),after=cost(r);
   const recorded=handoff.materialChanges.find(c=>c.factionId===f&&c.unitId===r.id);
   if(recorded){materials++;assert.equal(before,recorded.before);assert.equal(after,recorded.after);}else assert.equal(after,before);
  }
 }assert.deepEqual([profiles,changed,materials],[258,47,53]);
});
test('all 74 revised Dwarf/Elf lineages satisfy branch pools, unique recipes, rank ceilings, preserved predecessors and terminal exceptions',()=>{
 let terminal=0,exceptions=0,tops=0;
 for(const plan of plans){const f=registry.factions.find(f=>f.id===plan.factionId),units=new Map(f.units.map(u=>[u.id,u])),branches=new Map(plan.branches.map(b=>[b.id,b])),signatures=new Set();
  const successors=id=>f.units.filter(u=>u.recipe?.some(i=>i.id===id));
  const topReach=(id,seen=new Set())=>{assert.ok(!seen.has(id));return successors(id).some(u=>u.classification==='TOP'||topReach(u.id,new Set(seen).add(id)));};
  for(const u of f.units.filter(u=>u.kind==='champion')){
   const planned=plan.recipes.find(r=>r.unitId===u.id),branch=branches.get(planned.branchId),pool=new Set(branch.normalPool||[branch.mainId,...branch.supportIds]),r=data[f.id].recipes.find(r=>r.id===u.id),leaves=expandRecipeToBasics(r,data[f.id]),direct=u.recipe.filter(i=>units.get(i.id).kind==='basic');
   assert.deepEqual(u.recipe,planned.after,u.id);assert.equal(u.recipe.length,3);assert.equal(pool.size,3);assert.deepEqual(u.recipe.filter(i=>units.get(i.id).kind!=='basic'),baseline.factions.find(v=>v.id===f.id).units.find(v=>v.id===u.id).recipe.filter(i=>units.get(i.id).kind!=='basic'));
   const signature=u.recipe.map(i=>i.id+'/'+i.rank).sort().join('|');assert.ok(!signatures.has(signature),u.id);signatures.add(signature);
   if(u.classification==='BASIC'){assert.ok(direct.some(i=>i.id===branch.mainId&&i.rank===1));assert.ok(leaves.every(i=>i.tier<=2));}
   if(u.classification==='INTERMEDIATE')assert.ok(leaves.every(i=>i.tier<=4));
   if(u.classification==='TOP'){tops++;assert.equal(units.get(u.recipe.find(i=>units.get(i.id).kind!=='basic').id).classification,'ADVANCED');assert.deepEqual(direct.map(i=>i.rank),[6,6]);}
   const isTerminal=u.classification==='ADVANCED'&&!topReach(u.id);assert.equal(isTerminal,planned.terminal);
   if(isTerminal){terminal++;if(u.id==='dw_grapeshotcart'){exceptions++;assert.deepEqual(u.recipe,[{id:'dw_thunderlock',rank:1},{id:'dw_musketeer',rank:4},{id:'dw_grenadier',rank:4}]);}else assert.ok(direct.some(i=>!pool.has(i.id)));}
   else assert.ok(leaves.every(i=>pool.has(i.family)),u.id+' recursive branch pool');
  }
 }
 assert.deepEqual([tops,terminal,exceptions],[16,10,1]);
});
test('all exact basic/rank profiles have 1–3 successors; 29/48 Dwarf and Elf profiles have exactly two, including shared Secret choices',()=>{
 for(const f of registry.factions){const counts=[0,0,0,0];for(const u of f.units)for(let rank=1;rank<=(u.kind==='basic'?6:1);rank++){
  const owners=f.units.filter(c=>c.recipe?.some(i=>i.id===u.id&&i.rank===rank));assert.ok(owners.length<=3);if(u.kind==='basic'){assert.ok(owners.length>=1);counts[owners.length]++;}
  const expected=handoff.successorRows.find(r=>r.factionId===f.id&&r.unitId===u.id&&r.rank===rank);assert.ok(expected);assert.deepEqual(owners.map(c=>c.id).sort(),expected.outputs.map(c=>c.id).sort());
 }assert.deepEqual(counts,f.id==='crown'?[0,16,31,1]:[0,15,29,4]);}
});
test('all 74 ordinary recipes craft through the real game with three distinct physical ingredient IDs; duplicate references cannot satisfy repeats',()=>{
 for(const f of ['forge','grove'])for(const recipe of data[f].recipes.filter(r=>r.id!=='ladyclaire')){
  const g=new Game(data[f],{seed:19});g.phase='ready';g.towers=recipe.ingredients.map((i,k)=>({id:k+1,family:i.family,tier:i.tier,state:'active',x:5+k,z:5,kills:0,mvpLevel:0}));g.selected=1;
  assert.equal(matchingIngredients(recipe,g.towers,g.selection).length,3);assert.equal(g.craft(recipe.id),true,recipe.id);assert.equal(g.towers[0].family,recipe.id);assert.equal(g.towers.filter(t=>t.state==='active').length,1);
  if(recipe.ingredients.some((i,k)=>recipe.ingredients.some((j,l)=>k!==l&&i.family===j.family&&i.tier===j.tier))){const pieces=recipe.ingredients.map((i,k)=>({id:i.family+':'+i.tier,family:i.family,tier:i.tier,state:'active'}));assert.equal(matchingIngredients(recipe,pieces),null);}
 }
});

test('FR-007 TOP support families can obtain VI through the unchanged fresh-V draft merge and retain it for later crafting',()=>{
 for(const f of ['forge','grove']){
  const d=data[f],families=[...new Set(d.recipes.filter(r=>r.stage==='TOP').flatMap(r=>r.ingredients.filter(i=>i.tier===6).map(i=>i.family)))];assert.ok(families.length);
  for(const family of families){const g=new Game(d,{seed:42}),other=Object.keys(d.towers).find(id=>!d.towers[id].advanced&&id!==family);let pair=[];
   for(let i=0;i<5;i++){g.draft.roundForced={family:i<2?family:other,tier:i<2?5:1};assert.equal(g.place(3+i,4),true);if(i<2)pair.push(g.selection);}
   assert.equal(g.phase,'select');g.select(pair[0].id);assert.equal(g.merge(),true,f+'/'+family);assert.equal(pair[0].tier,6);assert.equal(pair[0].state,'active');assert.equal(pair[1].state,'ruin');assert.equal(g.draft.resolved,true);
   assert.ok(d.recipes.some(r=>r.stage==='TOP'&&r.ingredients.some(i=>i.family===family&&i.tier===6)));
  }
 }
});
