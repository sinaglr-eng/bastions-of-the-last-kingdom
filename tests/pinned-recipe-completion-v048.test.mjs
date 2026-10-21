import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {recipeFamily} from '../game/core/recipes.js';
import {craftRecipeKey,craftRecipeFromDock,craftingDockModel} from '../ui/crafting-dock.js';
import {preparationRecipesMarkup} from '../ui/preparation-folio.js';

const raw=Object.fromEntries(['balance','towers','recipes','enemies','waves'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
const ordinary=data.recipes.find(recipe=>recipe.id==='rimewatch');
function available(recipe){
  const game=new Game(data,{seed:4808});game.economy.xp=100000;
  for(let index=0;index<5;index++){game.draft.roundForced=recipe.ingredients[index]||{family:'soldier',tier:2};assert.equal(game.place(3+index,3),true);}
  game.select(game.roundCandidates[0].tower.id);return game;
}
const physicalState=game=>JSON.stringify({towers:game.towers,draws:game.draft.draws,phase:game.phase,round:game.round,selected:game.selected,occupied:[...game.grid.occupied],gold:game.economy.gold,cp:game.commandPoints.value,discoveries:[...game.discoveries]});

test('all 38 successful recipe crafts clear only their matching pin before result observers render',()=>{
  assert.equal(data.recipes.length,38);
  for(const recipe of data.recipes){
    const game=available(recipe),control=available(recipe),observations=[];game.pinned=recipe.id;
    game.on(type=>{if(['combine','defender-committed','discover','change'].includes(type))observations.push({type,pinned:game.pinned});});
    assert.equal(game.craft(recipe.id),true,recipe.id);assert.equal(control.craft(recipe.id),true,recipe.id);
    assert.equal(game.pinned,null,recipe.id);assert.equal(game.selection.family,recipeFamily(recipe));
    assert.deepEqual(observations.slice(-4).map(event=>event.type),['combine','defender-committed','discover','change']);assert.ok(observations.every(event=>event.pinned===null),recipe.id);
    assert.equal(physicalState(game),physicalState(control),'Pin removal changes no crafting outcome or inventory.');assert.equal(game.rng(),control.rng());
  }
});

test('crafting a component preserves the pinned later champion and clears a matching pin through the guarded dock route',()=>{
  const game=available(ordinary);game.pinned='highking';let key=craftRecipeKey(game,ordinary.id);
  assert.ok(key);assert.equal(craftRecipeFromDock(game,ordinary.id,game.selected,key),true);assert.equal(game.pinned,'highking');
  const matching=available(ordinary);matching.pinned=ordinary.id;key=craftRecipeKey(matching,ordinary.id);
  assert.equal(craftRecipeFromDock(matching,ordinary.id,matching.selected,key),true);assert.equal(matching.pinned,null);
});

test('a retained-only completion clears its pin while all five new recruits remain hidden and uncommitted',()=>{
  const game=new Game(data,{seed:4808});game.economy.xp=100000;
  for(const [index,piece]of ordinary.ingredients.entries()){
    const tower={id:game.nextId++,...piece,state:'active',round:0,x:3+index,z:3,kills:0,cooldown:0,priority:'first',mvpLevel:0};
    assert.equal(game.grid.occupy(tower.x,tower.z,tower.id).ok,true);game.towers.push(tower);
  }
  game.select(game.towers[0].id);game.pinned=ordinary.id;const draws=JSON.stringify(game.draft.draws),key=craftRecipeKey(game,ordinary.id);
  assert.ok(key);assert.equal(craftRecipeFromDock(game,ordinary.id,game.selected,key),true);assert.equal(game.pinned,null);
  assert.equal(game.phase,'build');assert.equal(game.draft.resolved,false);assert.equal(JSON.stringify(game.draft.draws),draws);assert.ok(game.draft.draws.every(draw=>!draw.placed));
});

test('invalid, incomplete and stale-identity crafts retain the pin and every physical field',()=>{
  const game=available(ordinary);game.pinned=ordinary.id;const before=physicalState(game);
  assert.equal(game.craft('missing-recipe'),false);assert.equal(game.pinned,ordinary.id);assert.equal(physicalState(game),before);
  const key=craftRecipeKey(game,ordinary.id),anchor=game.selected;game.select(game.roundCandidates.at(-1).tower.id);const stale=physicalState(game);
  assert.equal(craftRecipeFromDock(game,ordinary.id,anchor,key),false);assert.equal(game.pinned,ordinary.id);assert.equal(physicalState(game),stale);
  game.select(anchor);game.towers.find(tower=>tower.id!==anchor&&tower.family===ordinary.ingredients[1].family).state='ruin';const incomplete=physicalState(game);
  assert.equal(game.craft(ordinary.id),false);assert.equal(game.pinned,ordinary.id);assert.equal(physicalState(game),incomplete);
});

test('pinning or inspecting an already built champion leaves the intentional pin until another successful craft',()=>{
  const game=available(ordinary);assert.equal(game.craft(ordinary.id),true);game.pinned=ordinary.id;
  const before=physicalState(game),tower=game.selection;
  for(let i=0;i<5;i++){craftingDockModel(game);preparationRecipesMarkup(game,tower);game.select(tower.id);}
  assert.equal(game.pinned,ordinary.id);assert.equal(physicalState(game),before);assert.equal(game.craft(ordinary.id),false);assert.equal(game.pinned,ordinary.id);
});

test('an observer may deliberately pin a new goal when a matching craft completes',()=>{
  const game=available(ordinary);game.pinned=ordinary.id;game.on(type=>{if(type==='combine'){assert.equal(game.pinned,null);game.pinned='highking';}});
  assert.equal(game.craft(ordinary.id),true);assert.equal(game.pinned,'highking');
});
