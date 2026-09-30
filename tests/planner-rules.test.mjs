import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Box3,Vector3} from 'three';
import {Game} from '../game/core/game.js';
import {GridManager} from '../game/core/grid.js';
import {mergePartner} from '../game/core/recipes.js';
import {COMMANDER_CORE,commanderWalls} from '../game/core/commander-maze.js';
import {BLUEPRINT_KEY,BlueprintEditor,validateBlueprint,preparedBlueprints,blueprintProgress,loadBlueprintLibrary,saveBlueprintLibrary} from '../game/core/blueprints.js';
import {edgePan,compassBearing} from '../game/render/navigation.js';
import {wallConnections,castleWallModel} from '../game/render/walls.js';
import {enemyModel} from '../game/render/models.js';
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
const five=(g,z=10)=>{for(let x=10;x<15;x++)assert.ok(g.place(x,z));};
const storage=()=>{const entries=new Map();return {getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v)};};

test('rank merges cannot consume retained or previous-round defenders; current five can merge',()=>{
 const g=new Game(data,{seed:42});g.draft.forced={family:'archer',tier:1};g.draft.roll(0);five(g);g.keep();const retained=g.selection;
 assert.equal(g.remove(),false);assert.equal(g.merge(),false);g.startCombat();g.completeWave();
 g.draft.forced={family:'archer',tier:1};g.draft.roll(0);five(g,12);g.select(retained.id);assert.equal(g.merge(),false);
 const fresh=g.roundCandidates[0].tower;assert.equal(mergePartner(fresh,[retained],data),null);
 g.select(fresh.id);assert.ok(g.merge());assert.equal(fresh.tier,2);assert.equal(retained.state,'active');assert.equal(retained.tier,1);
});

test('advanced recipe preview names exact consumed pieces and old anchor survives as the new defender',()=>{
 const g=new Game(data,{seed:42}),recipe=data.recipes[0];
 const old={id:99,...recipe.ingredients[0],x:20,z:20,state:'active',round:0,kills:0};g.towers.push(old);g.grid.occupy(20,20,99);five(g);
 recipe.ingredients.slice(1).forEach((piece,i)=>Object.assign(g.towers[i+1],piece));g.select(old.id);
 assert.ok(g.previewRecipe(recipe.id));const preview=g.recipePreview;
 assert.equal(preview.anchor.id,old.id);assert.equal(new Set(preview.pieces.map(t=>t.id)).size,recipe.ingredients.length);
 const hints=g.combinationHints;assert.equal(hints.find(h=>h.tower.id===old.id).role,'result');
 for(const t of preview.pieces.filter(t=>t!==old))assert.equal(hints.find(h=>h.tower.id===t.id).role,'consumed');
 for(const t of preview.discarded)assert.equal(hints.find(h=>h.tower.id===t.id).role,'discarded');
 assert.equal(g.remove(),false);assert.ok(g.craft(recipe.id));assert.equal(old.family,recipe.id);assert.equal(old.state,'active');
 for(const t of preview.pieces.filter(t=>t!==old)){assert.equal(t.state,'ruin');g.select(t.id);assert.ok(g.remove());}
});

test('wave completion immediately grants fresh hidden draws and never repeats rewards; finale wins',()=>{
 const g=new Game(data,{seed:4,waveLimit:2});five(g);g.keep();g.startCombat();const reward=g.wave.reward,gold=g.economy.gold;let events=0;
 g.on(type=>{if(type==='reward')events++;});g.completeWave();assert.equal(g.phase,'build');assert.equal(g.round,2);assert.equal(g.economy.gold,gold+reward);
 assert.equal(g.draft.draws.length,5);assert.ok(g.draft.draws.every(d=>!d.placed&&!d.family));g.completeWave();assert.equal(events,1);
 five(g,12);g.keep();g.startCombat();g.completeWave();assert.equal(g.phase,'won');assert.equal(g.round,2);
});

test('fixed blueprint keeps every cell through placements, insufficient budget and a conflicting defense',()=>{
 const grid=new GridManager(),plan=preparedBlueprints([])[0],original=JSON.stringify(plan);
 const first=plan.walls[0];grid.occupy(first.x,first.z,1);let progress=blueprintProgress(plan,grid,250);assert.equal(progress.built,1);
 assert.equal(blueprintProgress(plan,grid,0).overBudget,true);
 const routeCell=plan.route.find(p=>grid.canPlace(p.x,p.z).ok);grid.occupy(routeCell.x,routeCell.z,2);progress=blueprintProgress(plan,grid,250);
 assert.equal(progress.offPlan,1);assert.equal(JSON.stringify(plan),original);assert.deepEqual(progress.walls,plan.walls);
 const union=new GridManager();for(const p of plan.walls)union.occupied.set(`${p.x},${p.z}`,1);
 const choke=plan.route.find(p=>grid.canPlace(p.x,p.z).ok&&!union.findRoute(`${p.x},${p.z}`));
 assert.ok(choke);grid.occupy(choke.x,choke.z,3);assert.equal(blueprintProgress(plan,grid,250).conflict,true);assert.equal(JSON.stringify(plan),original);
});

test('commander centre is nine contiguous occupied cells and all six legs remain legal',()=>{
 const g=new GridManager(),walls=commanderWalls(g.checkpoints),keys=new Set(walls.map(p=>`${p.x},${p.z}`));
 for(let x=17;x<=19;x++)for(let z=17;z<=19;z++)assert.ok(keys.has(`${x},${z}`));assert.equal(COMMANDER_CORE.length,9);
 const plan=preparedBlueprints([])[0];assert.deepEqual(plan.core,COMMANDER_CORE);assert.equal(plan.plannedLength,590);
 assert.deepEqual(plan.segments,[88,98,124,96,66,118]);
 for(const [i,p] of walls.entries())assert.ok(g.occupy(p.x,p.z,i+1).ok);assert.deepEqual(g.route,plan.route);
});

test('every shipped fixed layout matches the gameplay route and its counted six segments',()=>{
 const presets=JSON.parse(readFileSync(new URL('../data/maze-blueprints.json',import.meta.url)));
 const plans=preparedBlueprints(presets);assert.equal(plans.length,8);
 for(const plan of plans){
  const grid=new GridManager();for(const p of plan.walls)grid.occupied.set(`${p.x},${p.z}`,1);
  assert.deepEqual(grid.findRoute(),plan.route,plan.name);assert.equal(plan.route.length-1,plan.plannedLength);
  assert.equal(plan.segments.reduce((a,b)=>a+b,0),plan.plannedLength);assert.ok(plan.walls.length<=250);
 }
});

test('both reference mazes preserve their firing batteries and can be constructed through all checkpoints',()=>{
 const presets=JSON.parse(readFileSync(new URL('../data/maze-blueprints.json',import.meta.url))),plans=preparedBlueprints(presets);
 for(const [id,cells,coreSize,steps,segments] of [
  ['diamond-spiral',128,19,718,[130,142,118,88,98,142]],
  ['chevron-bastion',153,21,504,[66,144,116,16,38,124]],
 ]){
  const source=presets.find(p=>p.id===id),plan=plans.find(p=>p.id===id),grid=new GridManager();
  assert.equal(plan.walls.length,cells);assert.equal(plan.core.length,coreSize);assert.deepEqual(plan.core,source.core);
  assert.equal(plan.plannedLength,steps);assert.deepEqual(plan.segments,segments);
  const keys=new Set(plan.walls.map(p=>`${p.x},${p.z}`));assert.equal(keys.size,cells);
  for(const p of plan.core)assert.ok(keys.has(`${p.x},${p.z}`),'Every gold firing position counts toward the wall budget');
  for(const [i,p] of plan.walls.entries())assert.ok(grid.occupy(p.x,p.z,i+1).ok,`${id}: ${p.x},${p.z}`);
  assert.deepEqual(grid.route,plan.route);
  assert.equal(plan.coverage,grid.route.slice(1).filter(p=>plan.core.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<=6)).length);
  const store=storage();assert.ok(saveBlueprintLibrary(store,[],id));assert.equal(loadBlueprintLibrary(store).selected,id);
 }
 const chevron=plans.find(p=>p.id==='chevron-bastion');
 assert.ok(!chevron.walls.some(p=>p.x===19&&p.z===4),'The gate east of checkpoint 4 stays open');
});

test('custom drawing supports strokes, erase, undo/redo, clear and protects all route markers',()=>{
 const editor=new BlueprintEditor();editor.begin();editor.paint(10,10);editor.paint(11,10);editor.end();assert.equal(editor.walls.length,2);
 editor.undo();assert.equal(editor.walls.length,0);editor.redo();assert.equal(editor.walls.length,2);
 editor.paint(10,10,true);editor.end();assert.equal(editor.walls.length,1);editor.undo();assert.equal(editor.walls.length,2);
 for(const p of new GridManager().checkpoints)assert.equal(editor.paint(p.x,p.z),false);
 editor.clear();assert.equal(editor.walls.length,0);editor.undo();assert.equal(editor.walls.length,2);
 const sealed=[{x:3,z:18},{x:5,z:18},{x:4,z:17},{x:4,z:19}];assert.ok(validateBlueprint(sealed).error);
 assert.ok(validateBlueprint([{x:37,z:0}]).error);assert.ok(validateBlueprint([{x:0,z:4}]).error);assert.ok(editor.validate('My maze').plan);
});

test('saved custom blueprints and selected layout survive a new library load; invalid storage is rejected',()=>{
 const store=storage(),plan={...validateBlueprint([{x:10,z:10},{x:11,z:10}],'My maze').plan,id:'custom-test'};
 assert.ok(saveBlueprintLibrary(store,[plan],plan.id));const loaded=loadBlueprintLibrary(store);assert.equal(loaded.selected,plan.id);assert.equal(loaded.plans[0].name,'My maze');assert.deepEqual(loaded.plans[0].walls,plan.walls);
 store.setItem(BLUEPRINT_KEY,JSON.stringify({plans:[{id:'custom-bad',name:'sealed',walls:[{x:0,z:4}]}]}));assert.equal(loadBlueprintLibrary(store).plans.length,0);
 store.setItem(BLUEPRINT_KEY,'not json');assert.deepEqual(loadBlueprintLibrary(store),{plans:[],selected:null});
 assert.equal(saveBlueprintLibrary({setItem(){throw Error('quota');}},[plan],plan.id),false);
});

test('diagonal masonry links match both neighbors; cross junctions retain four cardinal arms',()=>{
 const a={x:10,z:10,state:'ruin'},b={x:11,z:9,state:'ruin'},walls=[a,b];assert.equal(wallConnections(a,walls),16);assert.equal(wallConnections(b,walls),64);
 const plus=[a,...[[0,-1],[1,0],[0,1],[-1,0]].map(([x,z])=>({x:a.x+x,z:a.z+z,state:'ruin'}))];assert.equal(wallConnections(a,plus),15);
 const base=new Box3().setFromObject(castleWallModel()),diagonal=new Box3().setFromObject(castleWallModel(16));assert.ok(diagonal.max.x>base.max.x);assert.ok(diagonal.min.z<base.min.z);
 const grid=new GridManager();walls.forEach((t,i)=>grid.occupy(t.x,t.z,i+1));assert.equal(grid.type(11,10),'buildable');assert.ok(grid.findRoute());
});

test('edge panning respects field bounds and compass follows camera azimuth',()=>{
 assert.deepEqual(edgePan(null,1000,600),{x:0,y:0});assert.deepEqual(edgePan({x:500,y:300},1000,600),{x:0,y:-0});
 assert.equal(edgePan({x:0,y:300},1000,600).x,-1);assert.equal(edgePan({x:999,y:300},1000,600).x>0,true);
 assert.equal(edgePan({x:500,y:0},1000,600).y,1);assert.deepEqual(edgePan({x:1001,y:300},1000,600),{x:0,y:0});
 assert.equal(compassBearing({x:0,z:10},{x:0,z:0}),0);assert.equal(compassBearing({x:10,z:0},{x:0,z:0}),Math.PI/2);assert.equal(compassBearing({x:-10,z:0},{x:0,z:0}),-Math.PI/2);
});

test('all normal warbands have readable scale and every boss is larger',()=>{
 for(const [id,stats] of Object.entries(data.enemies).filter(([id])=>id.startsWith('host_'))){const m=enemyModel(id,stats),h=new Box3().setFromObject(m).getSize(new Vector3()).y;assert.ok(stats.boss?h>=3.29&&h<=3.31:h>=1.81&&h<=1.99);m.traverse(o=>o.geometry?.dispose());}
});
