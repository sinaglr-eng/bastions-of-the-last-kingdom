import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {RecipeMarkerActivation} from '../ui/recipe-marker-input.js';
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
const pointer=(type='mouse',x=100,y=100)=>({pointerType:type,button:0,clientX:x,clientY:y});
function ready(){
 const game=new Game(data,{seed:42}),recipe=data.recipes[0];
 for(let x=10;x<15;x++)assert.ok(game.place(x,10));
 recipe.ingredients.forEach((piece,i)=>Object.assign(game.towers[i],piece));
 game.selected=null;
 return {game,recipe,anchor:game.towers[0]};
}
test('recipe portraits inspect without a preview step on first activation and create once on an unchanged mouse, pen or touch pair',()=>{
 for(const type of ['mouse','pen','touch']){
  const {game,recipe,anchor}=ready();let now=1000,combined=0;const inspections=[];game.on((type,payload)=>{if(type==='combine')combined++;if(type==='recipe-inspect')inspections.push(payload);});game.previewRecipe=()=>{throw Error('The retired preview step cannot be called.');};
  const input=new RecipeMarkerActivation(()=>now),cells=game.grid.occupied.size,location=[anchor.x,anchor.z];
  assert.equal(input.activate(game,anchor.id,recipe.id,pointer(type)),false);assert.equal(game.phase,'select');
  assert.equal(game.selected,anchor.id);assert.equal(game.previewRecipeId,null);assert.deepEqual(inspections,[{recipeId:recipe.id,anchorId:anchor.id}]);
  now+=200;assert.equal(input.activate(game,anchor.id,recipe.id,pointer(type,103,102)),true);
  assert.equal(anchor.family,recipe.resultFamily||recipe.id);assert.equal(anchor.state,'active');assert.deepEqual([anchor.x,anchor.z],location);
  assert.equal(game.phase,'ready');assert.equal(game.grid.occupied.size,cells);assert.equal(combined,1);assert.equal(game.previewRecipeId,null);assert.equal(inspections.length,1);
  now+=100;assert.equal(input.activate(game,anchor.id,recipe.id,pointer(type)),false);assert.equal(combined,1);
 }
});
test('stale recipe IDs, combat, changed ingredients, changed rounds and a changed result site never confirm a stale pair',()=>{
 for(const mutate of [g=>g.phase='combat',g=>g.towers[1].state='ruin',g=>g.towers[1].tier++,g=>g.round++,g=>g.towers[0].x++,g=>g.towers[4].tier++,g=>g.draft.rerollsUsed++,g=>g.draft.draws[4].reservedForNextDraft=true,g=>g.select(g.towers[1].id)]){
  const {game,recipe,anchor}=ready();let now=1000;const input=new RecipeMarkerActivation(()=>now);input.activate(game,anchor.id,recipe.id,pointer());
  mutate(game);now+=100;assert.equal(input.activate(game,anchor.id,recipe.id,pointer()),false);assert.notEqual(anchor.family,recipe.resultFamily||recipe.id);
 }
 const {game,recipe,anchor}=ready(),input=new RecipeMarkerActivation();assert.equal(input.activate(game,anchor.id,'missing',pointer()),false);
 assert.equal(input.activate(game,anchor.id+999,recipe.id,pointer()),false);
});
test('keyboard inspection, mixed pointers, a different portrait, drag distance, lateness and cancellation need a fresh pair',()=>{
 const {game,recipe,anchor}=ready();let now=1000;const input=new RecipeMarkerActivation(()=>now);
 input.activate(game,anchor.id,recipe.id,pointer());now+=100;assert.equal(input.activate(game,anchor.id,recipe.id),false);
 now+=100;assert.equal(input.activate(game,anchor.id,recipe.id,pointer('touch')),false);
 now+=100;assert.equal(input.activate(game,anchor.id,recipe.id,pointer()),false);
 now+=100;assert.equal(input.activate(game,game.towers[1].id,recipe.id,pointer()),false);
 now+=100;assert.equal(input.activate(game,anchor.id,recipe.id,pointer()),false);
 now+=501;assert.equal(input.activate(game,anchor.id,recipe.id,pointer()),false);
 now+=100;assert.equal(input.activate(game,anchor.id,recipe.id,pointer('mouse',130)),false);
 input.clear();now+=100;assert.equal(input.activate(game,anchor.id,recipe.id,pointer('mouse',130)),false);
 now+=100;assert.equal(input.activate(game,anchor.id,recipe.id,pointer('mouse',130)),true);
});

test('a map pair cannot transfer to another Game with the same foundation IDs, recipe and seed',()=>{
 const first=ready(),next=ready();let now=1000;const input=new RecipeMarkerActivation(()=>now);
 input.activate(first.game,first.anchor.id,first.recipe.id,pointer('touch'));now+=100;next.game.select(next.anchor.id);
 assert.equal(input.activate(next.game,next.anchor.id,next.recipe.id,pointer('touch')),false);assert.equal(next.anchor.state,'draft');assert.equal(first.anchor.state,'draft');assert.equal(next.game.previewRecipeId,null);
 now+=100;assert.equal(input.activate(next.game,next.anchor.id,next.recipe.id,pointer('touch')),true);assert.equal(next.anchor.state,'active');assert.equal(first.anchor.state,'draft');
});

test('retained-only marker creation preserves all five hidden draws and never opens a combination preview or consumes RNG',()=>{
 const make=()=>{const game=new Game(data,{seed:8403}),recipe=data.recipes[0];for(const [index,piece]of recipe.ingredients.entries()){const tower={id:game.nextId++,...piece,state:'active',round:0,x:10+index,z:10,mvpLevel:0,kills:0,cooldown:0};assert.equal(game.grid.occupy(tower.x,tower.z,tower.id).ok,true);game.towers.push(tower);}return {game,recipe,anchor:game.towers[0]};};
 const {game,recipe,anchor}=make(),control=make();for(const draw of game.draft.draws)for(const key of ['family','tier'])Object.defineProperty(draw,key,{get(){throw Error('Unrevealed identity read.');},configurable:true});
 game.previewRecipe=()=>{throw Error('The retired preview step cannot be called.');};let now=1000;const input=new RecipeMarkerActivation(()=>now),position=[anchor.x,anchor.z];
 assert.equal(input.activate(game,anchor.id,recipe.id,pointer('touch')),false);assert.equal(game.previewRecipeId,null);now+=100;assert.equal(input.activate(game,anchor.id,recipe.id,pointer('touch')),true);
 assert.equal(anchor.state,'active');assert.deepEqual([anchor.x,anchor.z],position);assert.equal(game.phase,'build');assert.equal(game.draft.resolved,false);assert.equal(game.draft.draws.length,5);assert.ok(game.draft.draws.every(draw=>!draw.placed));assert.equal(game.rng(),control.game.rng());
});
