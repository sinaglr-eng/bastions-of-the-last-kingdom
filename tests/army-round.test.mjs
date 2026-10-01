import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {GridManager} from '../game/core/grid.js';
import {commanderWalls} from '../game/core/commander-maze.js';
import {describeMaze,mazeSnapshot} from '../game/core/maze-search.js';
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
const make=()=>new Game(data,{seed:42});
const placeFive=g=>{for(let x=13;x<18;x++)assert.equal(g.place(x,18),true);};

test('round markers identify only this round and disappear after keep, merge and recipe decisions',()=>{
 for(const decision of ['keep','merge','craft']){
  const g=make();assert.deepEqual(g.roundCandidates,[]);assert.ok(g.place(12,18));assert.deepEqual(g.roundCandidates.map(c=>c.number),[1]);
  for(let x=13;x<17;x++)g.place(x,18);
  assert.deepEqual(g.roundCandidates.map(c=>c.number),[1,2,3,4,5]);
  if(decision==='merge'){g.towers.forEach(t=>{t.family='archer';t.tier=1;});assert.ok(g.merge());}
  else if(decision==='craft'){const recipe=data.recipes[0];recipe.ingredients.forEach((p,i)=>Object.assign(g.towers[i],p));g.select(g.towers[0].id);assert.ok(g.craft(recipe.id));}
  else assert.ok(g.keep());
  assert.deepEqual(g.roundCandidates,[]);g.startCombat();g.completeWave();g.nextRound();assert.deepEqual(g.roundCandidates,[]);
  g.place(20,20);assert.equal(g.roundCandidates.length,1);assert.equal(g.roundCandidates[0].tower.round,2);assert.equal(g.roundCandidates[0].number,1);
 }
});

test('free demolition refreshes navigation and never reopens a spent draft',()=>{
 const g=make();placeFive(g);g.keep();
 for(const state of ['ruin']){
  const tower=g.towers.find(t=>t.state===state),beforeGold=g.economy.gold,beforeRevision=g.grid.revision;
  g.select(tower.id);assert.equal(g.remove(),true);assert.equal(g.economy.gold,beforeGold-data.balance.removalCost);
  assert.equal(g.grid.type(tower.x,tower.z),'buildable');assert.equal(g.grid.revision,beforeRevision+1);assert.deepEqual(g.grid.route,g.grid.findRoute());
  assert.ok(g.draft.draws.every(d=>d.placed));assert.equal(g.selection,null);assert.equal(g.place(tower.x,tower.z),false);
  assert.equal(g.remove(),false);assert.equal(g.economy.gold,beforeGold-data.balance.removalCost);
 }
});

test('drafts, combat and end states reject demolition; empty wallets can remove castle walls',()=>{
 const g=make();g.place(18,18);const gold=g.economy.gold;assert.equal(g.remove(),false);assert.equal(g.economy.gold,gold);
 for(let x=13;x<17;x++)g.place(x,18);assert.equal(g.remove(),false);g.keep();
 const original=JSON.stringify({towers:g.towers,occupied:[...g.grid.occupied],gold:g.economy.gold});
 for(const phase of ['combat','won','lost']){g.phase=phase;assert.equal(g.remove(),false);assert.equal(JSON.stringify({towers:g.towers,occupied:[...g.grid.occupied],gold:g.economy.gold}),original);}
 g.phase='ready';g.select(g.towers.find(t=>t.state==='ruin').id);g.economy.gold=0;assert.equal(g.remove(),true);assert.equal(g.economy.gold,0);assert.equal(g.towers.length,4);
});

test('red-line spiral is constructible at every prefix, preserves checkpoint hooks and its measured route',()=>{
 const grid=new GridManager(),walls=commanderWalls(grid.checkpoints),plan=describeMaze(mazeSnapshot(grid),250,walls);
 assert.equal(walls.length,136);assert.deepEqual(plan.segments,[88,98,124,96,66,118]);assert.equal(plan.plannedLength,590);
 assert.equal(describeMaze(mazeSnapshot(grid),135,walls),null);
 for(const [i,p] of walls.entries())assert.equal(grid.occupy(p.x,p.z,i+1).ok,true);
 assert.deepEqual(grid.route,plan.route);assert.equal(grid.route.length-1,590);
 for(const p of grid.checkpoints)assert.ok(grid.walkable(p.x,p.z));
 for(const p of [{x:4,z:17},{x:32,z:3},{x:32,z:19},{x:19,z:32},{x:18,z:0},{x:18,z:36}])assert.equal(grid.type(p.x,p.z),'occupied');
 assert.ok(plan.core.every(p=>Math.hypot(p.x-18,p.z-18)<=6));assert.ok(plan.coverage>300);
});

test('all Blender defender variants have matching rendered portraits and native editable family sources',()=>{
 for(const [family,stats] of Object.entries(data.towers)){
  assert.ok(existsSync(new URL(`../blender/scenes/${family}_design_v1.blend`,import.meta.url)));
  for(let rank=1;rank<=(stats.advanced?1:6);rank++){
   const image=readFileSync(new URL(`../public/assets/${family==='archer'?'archer':'army'}/${family}-t${rank}.png`,import.meta.url));
   assert.equal(image.readUInt32BE(0),0x89504e47);assert.ok(image.readUInt32BE(16)>=300);assert.ok(image.readUInt32BE(20)>=300);
  }
 }
});
