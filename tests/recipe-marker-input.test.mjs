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
test('recipe portraits preview on the first click and craft once on an unchanged mouse, pen or touch pair',()=>{
 for(const type of ['mouse','pen','touch']){
  const {game,recipe,anchor}=ready();let now=1000,combined=0;game.on(type=>{if(type==='combine')combined++;});
  const input=new RecipeMarkerActivation(()=>now),cells=game.grid.occupied.size,location=[anchor.x,anchor.z];
  assert.equal(input.activate(game,anchor.id,recipe.id,pointer(type)),false);assert.equal(game.phase,'select');
  assert.equal(game.recipePreview.anchor,anchor);assert.equal(game.recipePreview.recipe.id,recipe.id);
  now+=200;assert.equal(input.activate(game,anchor.id,recipe.id,pointer(type,103,102)),true);
  assert.equal(anchor.family,recipe.resultFamily||recipe.id);assert.equal(anchor.state,'active');assert.deepEqual([anchor.x,anchor.z],location);
  assert.equal(game.phase,'ready');assert.equal(game.grid.occupied.size,cells);assert.equal(combined,1);
  now+=100;assert.equal(input.activate(game,anchor.id,recipe.id,pointer(type)),false);assert.equal(combined,1);
 }
});
test('stale recipe IDs, combat, changed ingredients, changed rounds and a changed result site never confirm a stale pair',()=>{
 for(const mutate of [g=>g.phase='combat',g=>g.towers[1].state='ruin',g=>g.towers[1].tier++,g=>g.round++,g=>g.towers[0].x++]){
  const {game,recipe,anchor}=ready();let now=1000;const input=new RecipeMarkerActivation(()=>now);input.activate(game,anchor.id,recipe.id,pointer());
  mutate(game);now+=100;assert.equal(input.activate(game,anchor.id,recipe.id,pointer()),false);assert.notEqual(anchor.family,recipe.resultFamily||recipe.id);
 }
 const {game,recipe,anchor}=ready(),input=new RecipeMarkerActivation();assert.equal(input.activate(game,anchor.id,'missing',pointer()),false);
 assert.equal(input.activate(game,anchor.id+999,recipe.id,pointer()),false);
});
test('keyboard preview, mixed pointers, a different portrait, drag distance, lateness and cancellation need a fresh pair',()=>{
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
