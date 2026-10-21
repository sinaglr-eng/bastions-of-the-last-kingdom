import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {recipesUsing,recipeFamily,recipeTier} from '../game/core/recipes.js';
import {preparationRecipeModel,preparationRecipesMarkup,actualAvailableRecipeActionsMarkup} from '../ui/preparation-folio.js';
import {PreparationRecipeNavigation} from '../ui/preparation-recipe-navigation.js';
import {craftRecipeFromDock} from '../ui/crafting-dock.js';

const raw=Object.fromEntries(['balance','towers','recipes','enemies','waves'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
const snapshot=game=>JSON.stringify({towers:game.towers,draws:game.draft.draws,selected:game.selected,phase:game.phase,round:game.round,gold:game.economy.gold,cp:game.commandPoints.value,pinned:game.pinned,preview:game.previewRecipeId,occupied:[...game.grid.occupied],discoveries:[...game.discoveries]});
function recruit(pieces){const game=new Game(data,{seed:4202});game.economy.xp=100000;for(let index=0;index<5;index++){game.draft.roundForced=pieces[index]||{family:'soldier',tier:2};assert.equal(game.place(3+index,3),true);}game.select(game.roundCandidates[0].tower.id);return game;}

test('every chosen basic rank filters suggestions by that displayed rank while all physical identities and RNG stay unchanged',()=>{
  for(const family of Object.keys(data.towers).filter(family=>!data.towers[family].advanced)){
    const game=recruit([{family,tier:1}]),control=recruit([{family,tier:1}]),tower=game.selection,before=snapshot(game);
    for(let tier=1;tier<=6;tier++){
      const displayedTower={...tower,tier},model=preparationRecipeModel(game,tower,{displayedTower});
      assert.deepEqual(model.options.map(option=>option.recipe.id),recipesUsing(displayedTower,game.recipes).map(recipe=>recipe.id),`${family} ${tier}`);
      if(tier!==tower.tier){assert.ok(model.options.every(option=>!option.canPreview));assert.equal(actualAvailableRecipeActionsMarkup(game,{displayedTower}),'');}
      assert.equal(snapshot(game),before);
    }
    assert.equal(game.rng(),control.rng());
  }
});

test('Potential combinations starts open while each recipe opens, closes and reopens independently',()=>{
  const game=recruit([{family:'archer',tier:2}]),tower=game.selection,planningNavigation=new PreparationRecipeNavigation();
  const options={planningNavigation},initial=preparationRecipeModel(game,tower,options),first=initial.options[0].recipe.id;
  assert.equal(initial.selected,null);
  let html=preparationRecipesMarkup(game,tower,{},options);
  assert.match(html,/<details class="folio-combinations-disclosure" data-detail-key="potential-combinations" open>/);
  assert.doesNotMatch(html,/aria-expanded="true"|class="folio-recipe-detail"/);
  planningNavigation.toggle(first,first);
  assert.match(preparationRecipesMarkup(game,tower,{},options),/aria-expanded="true"/);
  planningNavigation.toggle(first,first);
  assert.equal(preparationRecipeModel(game,tower,options).selected,null);
  assert.doesNotMatch(preparationRecipesMarkup(game,tower,{},options),/aria-expanded="true"|class="folio-recipe-detail"/);
  planningNavigation.toggle(first,first);
  assert.equal(preparationRecipeModel(game,tower,options).selected.recipe.id,first);
});

test('following a suggested champion lists recipes using that champion and Back restores the prior rank list',()=>{
  const game=recruit([{family:'archer',tier:2}]),tower=game.selection,planningNavigation=new PreparationRecipeNavigation(),options={planningNavigation};
  const initial=preparationRecipeModel(game,tower,options),parent=initial.options.find(option=>option.downstream.length);assert.ok(parent);
  planningNavigation.toggle(parent.recipe.id,initial.options[0].recipe.id);
  // Expand it if it was the already selected default and the first click collapsed it.
  if(planningNavigation.selectedRecipeId===false)planningNavigation.toggle(parent.recipe.id,initial.options[0].recipe.id);
  const before=snapshot(game),target=parent.downstream.at(-1);
  planningNavigation.enter(parent.recipe.id,target.id);
  const followed=preparationRecipeModel(game,tower,options);
  assert.equal(followed.subject.family,recipeFamily(parent.recipe));assert.equal(followed.subject.tier,recipeTier(parent.recipe));
  assert.deepEqual(followed.options.map(option=>option.recipe.id),recipesUsing({...followed.subject,state:'draft'},game.recipes).map(recipe=>recipe.id));
  assert.equal(followed.selected.recipe.id,target.id);assert.ok(followed.options.every(option=>!option.canPreview));
  assert.match(preparationRecipesMarkup(game,tower,{},options),/data-action="folio-plan-back"/);
  assert.equal(planningNavigation.back(),true);assert.equal(preparationRecipeModel(game,tower,options).selected.recipe.id,parent.recipe.id);
  assert.equal(snapshot(game),before);
  planningNavigation.enter(parent.recipe.id);preparationRecipeModel(game,tower,{...options,displayedTower:{...tower,tier:4}});
  assert.equal(planningNavigation.contextRecipeId,null);assert.equal(planningNavigation.history.length,0,'A new viewed rank starts its own suggestion context.');
});

test('Create action commits the selected physical foundation once and a hypothetical rank never supplies a token',()=>{
  const recipe=data.recipes.find(recipe=>recipe.id==='rimewatch'),game=recruit(recipe.ingredients),tower=game.selection,before=snapshot(game);
  const html=actualAvailableRecipeActionsMarkup(game),tag=html.match(new RegExp(`<button[^>]*data-id="${recipe.id}"[^>]*>`))?.[0];assert.ok(tag);
  assert.match(html,/Create Frostsword Watchmen/);assert.doesNotMatch(html,/Preview combination/);assert.equal(snapshot(game),before);
  assert.equal(actualAvailableRecipeActionsMarkup(game,{displayedTower:{...tower,tier:tower.tier+1}}),'');
  const key=tag.match(/data-craft-key="([^"]+)"/)[1];assert.equal(craftRecipeFromDock(game,recipe.id,tower.id,key),true);
  assert.equal(tower.family,recipeFamily(recipe));assert.equal(craftRecipeFromDock(game,recipe.id,tower.id,key),false);
});

test('Potential combinations exposes the selected recipe Pin or Unpin without changing actual planning inventory',()=>{
  const game=recruit([{family:'archer',tier:2}]),tower=game.selection,model=preparationRecipeModel(game,tower),recipe=model.options[0].recipe,options={selectedRecipeId:recipe.id};
  let before=snapshot(game),html=preparationRecipesMarkup(game,tower,{},options);
  assert.match(html,new RegExp(`class="text-button folio-recipe-pin " data-action="pin" data-id="${recipe.id}" aria-pressed="false"`));assert.match(html,/> Pin recipe<\/button>/);assert.equal(snapshot(game),before);
  game.pinned=recipe.id;before=snapshot(game);html=preparationRecipesMarkup(game,tower,{},options);
  assert.match(html,new RegExp(`class="text-button folio-recipe-pin is-pinned" data-action="pin" data-id="${recipe.id}" aria-pressed="true"`));assert.match(html,/> Unpin<\/button>/);assert.equal(snapshot(game),before);
});

test('champion ingredient links inspect exact requirements and nested Back restores the prior downstream recipe without inventing ownership',()=>{
  const game=recruit([{family:'soldier',tier:1}]),control=recruit([{family:'soldier',tier:1}]),tower=game.selection,planningNavigation=new PreparationRecipeNavigation(),options={planningNavigation};
  preparationRecipeModel(game,tower,options);planningNavigation.enter('rimewatch','highking');
  const before=snapshot(game),html=preparationRecipesMarkup(game,tower,{},options);
  assert.match(html,/data-action="folio-ingredient-recipe" data-id="frostblade"/);assert.match(html,/aria-label="Explore Frost Knight recipe"/);
  planningNavigation.inspect('frostblade');let model=preparationRecipeModel(game,tower,options);
  assert.deepEqual(model.options.map(option=>option.recipe.id),['frostblade']);assert.deepEqual(model.selected.rows.map(({family,tier})=>({family,tier})),game.recipes.find(recipe=>recipe.id==='frostblade').ingredients);assert.equal(model.selected.canPreview,false);
  const detail=preparationRecipesMarkup(game,tower,{},options);assert.match(detail,/Champion recipe requirements/);assert.match(detail,/data-action="folio-ingredient-recipe" data-id="rimewatch"/);assert.match(detail,/data-action="folio-plan-back"/);assert.match(detail,/data-action="pin" data-id="frostblade"/);
  planningNavigation.inspect('rimewatch');model=preparationRecipeModel(game,tower,options);assert.equal(model.selected.recipe.id,'rimewatch');assert.equal(planningNavigation.inspect('rimewatch'),false,'The current component cannot add a duplicate history entry.');
  assert.equal(planningNavigation.back(),true);assert.equal(preparationRecipeModel(game,tower,options).selected.recipe.id,'frostblade');
  assert.equal(planningNavigation.back(),true);model=preparationRecipeModel(game,tower,options);assert.equal(model.contextRecipe.id,'rimewatch');assert.equal(model.selected.recipe.id,'highking');assert.equal(model.inspectedRecipe,null);
  assert.equal(snapshot(game),before);assert.equal(game.rng(),control.rng());
});
