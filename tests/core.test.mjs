import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {GridManager,cellKey} from '../game/core/grid.js';
import {seededRandom,weightedIndex,damageAfterDefense} from '../game/core/math.js';
import {matchingIngredients,recipeProgress,mergePartner} from '../game/core/recipes.js';
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
const makeGame=()=>new Game(data,{seed:42,waveLimit:10});
function placeFive(g){let placed=0;for(let z=3;z<30&&placed<5;z++)for(let x=3;x<28&&placed<5;x++)if(g.grid.canPlace(x,z).ok){g.place(x,z);placed++;}}

test('seeded quality distributions match every probability table (100,000 draws each)',()=>{
  for(const row of data.balance.mastery){const rng=seededRandom(99),counts=data.balance.tiers.map(()=>0);for(let i=0;i<100000;i++)counts[weightedIndex(row.weights,rng)]++;row.weights.forEach((w,i)=>assert.ok(Math.abs(counts[i]/1000-w)<0.65,`${i}: ${counts[i]/1000} vs ${w}`));}
  assert.throws(()=>weightedIndex([0,0]));assert.throws(()=>weightedIndex([-1,2]));
});
test('fixed map has an ordered route through all checkpoints',()=>{
  const grid=new GridManager();assert.ok(grid.route.length>70);let index=0;
  for(const p of grid.checkpoints){index=grid.route.findIndex((q,i)=>i>=index&&q.x===p.x&&q.z===p.z);assert.ok(index>=0);}
});
test('blocking any checkpoint connection is rejected atomically',()=>{
  const grid=new GridManager(5,[{x:0,z:2},{x:4,z:2}],false);
  for(let z=0;z<4;z++)assert.equal(grid.occupy(2,z,z).ok,true);
  const before=grid.route;assert.equal(grid.occupy(2,4,5).ok,false);assert.equal(grid.occupied.has(cellKey(2,4)),false);assert.equal(grid.route,before);
  grid.remove(2,1);assert.equal(grid.occupy(2,4,5).ok,true);
});
test('each round draws five; keep activates exactly one and leaves four blocking ruins',()=>{
  const g=makeGame();assert.equal(g.draft.draws.length,5);assert.ok(g.draft.draws.every(d=>!('tier' in d)&&!('family' in d)));placeFive(g);assert.equal(g.phase,'select');assert.equal(g.keep(),true);assert.equal(g.towers.filter(t=>t.state==='active').length,1);assert.equal(g.towers.filter(t=>t.state==='ruin').length,4);assert.equal(g.grid.occupied.size,5);assert.equal(g.phase,'ready');assert.equal(g.keep(),false);
});
test('same-family, same-tier merge resolves selection at chosen position',()=>{
  const g=makeGame();placeFive(g);g.towers.forEach(t=>{t.family='archer';t.tier=1;});const t=g.selection;const pos=[t.x,t.z];assert.ok(mergePartner(t,g.towers,data));assert.equal(g.merge(),true);assert.equal(t.tier,2);assert.deepEqual([t.x,t.z],pos);assert.equal(g.towers.filter(t=>t.state==='active').length,1);assert.equal(g.towers.filter(t=>t.state==='ruin').length,4);
  t.tier=6;assert.equal(mergePartner(t,g.towers,data),null);
});
test('recipes consume distinct ingredients including duplicates',()=>{
  const recipe={ingredients:[{family:'archer',tier:1},{family:'archer',tier:1}]};
  const a={id:1,family:'archer',tier:1,state:'active'};assert.equal(matchingIngredients(recipe,[a]),null);assert.equal(recipeProgress(recipe,[a]).filter(r=>r.owned).length,1);
  const b={...a,id:2};assert.equal(matchingIngredients(recipe,[a,b],b).length,2);b.state='ruin';assert.equal(matchingIngredients(recipe,[a,b]),null);
});
test('craft creates a new class and preserves all occupied cells',()=>{
  const g=makeGame(),r=data.recipes[0];placeFive(g);r.ingredients.forEach((p,i)=>Object.assign(g.towers[i],p));g.select(g.towers[0].id);assert.equal(g.craft(r.id),true);assert.equal(g.selection.family,r.id);assert.equal(g.phase,'ready');assert.equal(g.grid.occupied.size,5);assert.equal(g.towers.filter(t=>t.state==='active').length,1);assert.ok(g.discoveries.has(r.id));
});
test('armor, penetration and type resistance calculations',()=>{
  assert.equal(damageAfterDefense(100,'physical',{armor:30},{},data.balance),50);
  assert.equal(damageAfterDefense(100,'piercing',{armor:30},{penetration:1},data.balance),100);
  assert.equal(damageAfterDefense(100,'fire',{armor:100,resists:{magic:0.2,fire:0.3}},{},data.balance),50);
  assert.ok(Math.abs(damageAfterDefense(100,'holy',{resists:{magic:2}},{},data.balance)-15)<1e-6);
});
test('mastery follows XP, demolition is free, and rerolls and health purchases are unavailable',()=>{
  const g=makeGame();assert.equal(g.mastery(),false);assert.equal(g.economy.gold,90);assert.equal(g.reroll(),false);assert.equal(g.economy.gold,90);g.economy.reward(0,180);assert.equal(g.economy.mastery,2);assert.equal(g.reroll(),false);assert.equal(g.economy.gold,90);placeFive(g);assert.equal(g.reroll(),false);g.keep();g.select(g.towers.find(t=>t.state==='ruin').id);assert.equal(g.remove(),true);assert.equal(g.economy.gold,90);g.lives=28;assert.equal(g.repair(),false);assert.equal(g.lives,28);assert.equal(g.economy.gold,90);
});
test('combat waits for every spawn and enemy; reward granted once',()=>{
  const g=makeGame();placeFive(g);g.keep();g.startCombat();const gold=g.economy.gold,reward=g.wave.reward;g.tick(0.1);assert.equal(g.phase,'combat');g.combat.spawnQueue=[];g.combat.enemies=[];g.tick(0.1);assert.equal(g.phase,'build');assert.equal(g.economy.gold,gold+reward);g.completeWave();assert.equal(g.economy.gold,gold+reward);assert.equal(g.round,2);assert.equal(g.phase,'build');assert.equal(g.draft.draws.length,5);
});
test('projectile travel deals damage only on impact and awards kill XP and completion gold once',()=>{
  const g=makeGame();placeFive(g);g.keep();const t=g.selection;t.family='archer';t.tier=5;g.startCombat();g.combat.spawnQueue=[];const e=g.combat.spawn('grunt');e.x=t.x+1;e.z=t.z;e.speed=0;const hp=e.hp,gold=g.economy.gold,reward=g.wave.reward;g.tick(0.01);assert.equal(e.hp,hp);assert.ok(g.combat.projectiles.length);g.tick(0.1);assert.equal(e.dead,true);assert.equal(g.kills,1);assert.equal(g.economy.gold,gold+reward);
});
test('lives reaching zero loses; last completed wave wins',()=>{
  const g=makeGame();placeFive(g);g.keep();g.startCombat();g.lives=1;g.combat.spawnQueue=[];const e=g.combat.spawn('grunt');e.pathIndex=e.route.length;g.tick(0.02);assert.equal(g.phase,'lost');
  const w=makeGame();placeFive(w);w.keep();w.round=10;w.startCombat();w.combat.spawnQueue=[];w.tick(0.02);assert.equal(w.phase,'won');
});
