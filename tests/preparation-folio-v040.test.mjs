import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {towerStats,combatTowerStats} from '../game/core/math.js';
import {recipeTreeProgress,recipesUsing} from '../game/core/recipes.js';
import {defenderPanelMarkup} from '../ui/defender-panel.js';
import {DefenderRankPreview} from '../ui/defender-rank-preview.js';
import {draftCardsMarkup} from '../ui/draft-cards.js';
import {preparationEffects,preparationRecipeModel,preparationRecipesMarkup} from '../ui/preparation-folio.js';
import {recipeDisplayInventory} from '../ui/recipe-navigation.js';
import {craftRecipeKey,craftRecipeFromDock} from '../ui/crafting-dock.js';
import {drawKeeperKey,keepDrawKeeper,mergeTowerKey,mergeTowerFromBadge} from '../ui/draft-input.js';

const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
const snapshot=game=>JSON.stringify({towers:game.towers,draws:game.draft.draws,selection:game.selected,phase:game.phase,round:game.round,gold:game.economy.gold,cp:game.commandPoints.value,pinned:game.pinned,preview:game.previewRecipeId,occupied:[...game.grid.occupied],discoveries:[...game.discoveries]});
function place(game,pieces){for(const [i,piece]of pieces.entries()){game.draft.roundForced=piece;assert.equal(game.place(3+i,2+game.round),true);}game.select(game.roundCandidates[0].tower.id);return game;}
function candidates(family='archer',tier=2){return place(new Game(data,{seed:402}),Array.from({length:5},()=>({family,tier})));}
const metric=(html,label)=>html.match(new RegExp(`<span>${label}</span><strong>([^<]+)</strong>`))?.[1];
const optionIds=html=>[...html.matchAll(/data-action="folio-recipe" data-id="([^"]+)"/g)].map(match=>match[1]);
const button=(html,action)=>html.match(new RegExp(`<button[^>]*data-action="${action}"[^>]*>`))?.[0];

test('Archer II→IV changes one displayed portrait/effects/base grid while actual Keep, card and recipes stay II',()=>{
  const game=candidates(),control=candidates(),tower=game.selection,preview=new DefenderRankPreview(),images={'archer:2':'/archer-II.png','archer:4':'/archer-IV.png'};
  const key=drawKeeperKey(game,0),before=snapshot(game),render=()=>defenderPanelMarkup(game,tower,{images,rankPreview:preview});
  let html=render();assert.deepEqual(['Damage / hit','Base direct DPS','Range','Interval'].map(label=>metric(html,label)),['12','48','4','0.25s']);
  assert.match(html,/Targets 1 · No additional status effect/);assert.match(html,/aria-label="Keep Archer II">(?:<svg[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/svg>\s*)?Keep Archer II<\/button>/);
  assert.equal(preview.select(tower,4,data),true);html=render();
  assert.deepEqual(['Damage / hit','Base direct DPS','Range','Interval'].map(label=>metric(html,label)),['48','192','4','0.25s']);
  assert.match(html,/src="\/archer-IV.png"[^>]*data-portrait-rank="4"/);assert.doesNotMatch(html.slice(0,html.indexOf('</header>')),/src="\/archer-II.png"/);
  assert.match(html,/Actual rank II · Candidate/);assert.match(html,/Preview rank IV · Actual rank II unchanged/);assert.match(html,/aria-label="Keep Archer II">(?:<svg[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/svg>\s*)?Keep Archer II<\/button>/);
  assert.deepEqual(optionIds(html),recipesUsing(tower,game.recipes).map(recipe=>recipe.id));assert.equal(optionIds(html).length,2);
  const cards=draftCardsMarkup(game,data,images,{actions:false});assert.equal((cards.match(/src="\/archer-II.png"/g)||[]).length,5);assert.doesNotMatch(cards,/archer-IV.png|keep-draw|merge-tower|has-keep|mergeable/);
  assert.equal(button(html,'keep-draw').match(/data-keeper-key="([^"]+)"/)[1],key);assert.equal(snapshot(game),before);assert.equal(game.rng(),control.rng());
  assert.equal(keepDrawKeeper(game,0,tower.id,key),true);assert.equal(tower.tier,2);assert.equal(tower.state,'active');
});

test('one canonical profile supplies quantified Mage splash and Frost Warden V/VI effects before rankbar and four metrics',()=>{
  const mage=candidates('mage',1),mageHtml=defenderPanelMarkup(mage,mage.selection);assert.match(mageHtml,/30% Magical splash · 3.6 damage to other enemies within 3 tiles/);
  const game=candidates('frostwarden',5),tower=game.selection,preview=new DefenderRankPreview();
  let html=defenderPanelMarkup(game,tower,{rankPreview:preview});assert.match(html,/36% movement slow for 3s/);assert.equal(metric(html,'Damage / hit'),'30');assert.match(html,/<span class="damage-tag">Physical/);
  preview.select(tower,6,data);html=defenderPanelMarkup(game,tower,{rankPreview:preview});assert.match(html,/55% movement slow for 3s · also within 0.5 tiles/);
  const positions=['folio-identity','folio-effects','class="rank-preview"','folio-metrics'].map(key=>html.indexOf(key));assert.ok(positions.every((value,index)=>value>=0&&(!index||value>positions[index-1])));
  assert.equal((html.match(/class="tower-effects/g)||[]).length,1);assert.equal((html.match(/Damage \/ hit/g)||[]).length,1);assert.equal((html.match(/data-action="preview-rank"/g)||[]).length,6);
});

test('base direct DPS excludes effective support/MVP and aura-only profiles keep zero direct output with a quantified per-enemy effect',()=>{
  const game=candidates(),tower=game.selection;assert.equal(game.keep(),true);game.mvp.setLevel(tower,10);
  const source=Object.keys(data.towers).find(family=>data.towers[family].aura?.damageBonus);assert.ok(source);game.towers.push({id:999,family:source,tier:1,state:'active',x:tower.x,z:tower.z,mvpLevel:0});
  assert.ok(combatTowerStats(tower,game.towers,data).stats.damage>towerStats(tower,data).damage);
  const html=defenderPanelMarkup(game,tower,{peak:{dps:321}});assert.equal(metric(html,'Damage / hit'),'12');assert.equal(metric(html,'Base direct DPS'),'48');assert.match(html,/Measured peak · 321 DPS/);assert.match(html,/MVP Level: 10 \/ 10/);
  const family=Object.keys(data.towers).find(family=>data.towers[family].burnAura&&data.towers[family].damage===0),aura={...tower,family,tier:1};
  const auraHtml=defenderPanelMarkup(game,aura);assert.equal(metric(auraHtml,'Base direct DPS'),'0');assert.match(auraHtml,/Magical aura damage\/s per enemy within 6 tiles/);assert.equal((auraHtml.match(/aura damage\/s per enemy/g)||[]).length,1);assert.doesNotMatch(auraHtml,/data-action="preview-rank"/);assert.doesNotMatch(auraHtml.slice(0,auraHtml.indexOf('</header>')),/Actual rank I/);
});

test('Build/Select share five selection cards and detail without hidden identity reads, duplicate commands or changed RNG',()=>{
  const game=new Game(data,{seed:402}),control=new Game(data,{seed:402});for(const current of [game,control]){place(current,Array.from({length:3},()=>({family:'archer',tier:2})));}
  for(const draw of game.draft.draws.filter(draw=>!draw.placed))for(const key of ['family','tier'])Object.defineProperty(draw,key,{get(){throw Error('Hidden identity read');},configurable:true});
  const hidden=draftCardsMarkup(game,data,{'archer:2':'/archer-II.png'},{actions:false}),detail=defenderPanelMarkup(game,game.selection);
  assert.equal((hidden.match(/class="draw-slot/g)||[]).length,5);assert.equal((hidden.match(/Unrevealed defender\. Build/g)||[]).length,2);assert.equal((hidden.match(/<img/g)||[]).length,3);
  assert.doesNotMatch(hidden+detail,/data-action="(?:keep-draw|reroll|reserve|merge-tower)"|src="(?:undefined|null|)"/);assert.equal(game.phase,'build');assert.equal(game.rng(),control.rng());
  const complete=candidates(),plain=draftCardsMarkup(complete,data,{}, {actions:false}),legacy=draftCardsMarkup(complete,data,{}),panel=defenderPanelMarkup(complete,complete.selection);
  assert.equal((plain.match(/data-action="draw"/g)||[]).length,5);assert.equal((plain.match(/<button/g)||[]).length,5);assert.equal((legacy.match(/data-action="keep-draw"/g)||[]).length,1);assert.equal((panel.match(/data-action="keep-draw"/g)||[]).length,1);assert.doesNotMatch(plain,/keep-draw|merge-tower|has-keep|mergeable/);
});

test('multiple actual combinations remain visible while exactly one selected ingredient detail changes without pin/preview/selection mutation',()=>{
  for(const [family,tier,count]of [['archer',2,2],['frostwarden',5,3]]){
    const game=candidates(family,tier),control=candidates(family,tier),tower=game.selection,before=snapshot(game),model=preparationRecipeModel(game,tower);assert.equal(model.options.length,count);
    for(const selected of [...model.options,...model.options].reverse()){
      const html=preparationRecipesMarkup(game,tower,{}, {selectedRecipeId:selected.recipe.id});assert.deepEqual(optionIds(html),model.options.map(option=>option.recipe.id));assert.equal((html.match(/class="folio-recipe-detail"/g)||[]).length,1);assert.equal((html.match(/aria-expanded="true"/g)||[]).length,1);assert.match(html,new RegExp(`data-recipe-id="${selected.recipe.id}"`));assert.match(button(html,'craft-preview'),/disabled/);
    }
    assert.equal(snapshot(game),before);assert.equal(game.rng(),control.rng());
  }
});

test('all 38 current recipes expose actual ingredient allocations and preserve existing stale/final confirmation guards',()=>{
  assert.equal(gameRecipes().length,38);let secret=0;
  for(const recipe of gameRecipes()){
    const game=new Game(data,{seed:840}),pieces=[...recipe.ingredients,{family:'soldier',tier:6},{family:'mage',tier:6}];game.economy.xp=100000;place(game,pieces);const tower=game.selection,before=snapshot(game);
    const model=preparationRecipeModel(game,tower,{selectedRecipeId:recipe.id}),selected=model.selected;assert.equal(selected.recipe.id,recipe.id,recipe.id);assert.equal(selected.canPreview,true,recipe.id);assert.deepEqual(selected.rows.map(({family,tier})=>({family,tier})),recipe.ingredients);assert.ok(selected.rows.every(row=>row.state==='draft'));assert.equal(new Set(selected.rows.map(row=>row.towerId)).size,3);
    const html=preparationRecipesMarkup(game,tower,{}, {selectedRecipeId:recipe.id});assert.doesNotMatch(button(html,'craft-preview'),/disabled/);assert.equal(snapshot(game),before);
    if(recipe.currentRoundOnly){secret++;assert.match(html,/Secret recipe · Exact ingredients from this round only/);}
    const key=craftRecipeKey(game,recipe.id,tower.id);assert.ok(key);game.select(game.roundCandidates.at(-1).tower.id);assert.equal(craftRecipeFromDock(game,recipe.id,tower.id,key),false);game.select(tower.id);
    const fresh=craftRecipeKey(game,recipe.id,tower.id);assert.equal(craftRecipeFromDock(game,recipe.id,tower.id,fresh),true,recipe.id);assert.equal(tower.family,recipe.resultFamily||recipe.id);assert.equal(tower.state,'active');assert.equal(craftRecipeFromDock(game,recipe.id,tower.id,fresh),false);
  }
  assert.ok(secret>0);
});
function gameRecipes(){return new Game(data,{seed:1}).recipes;}

test('retained champions satisfy one subtree and reserved/stale/hidden copies cannot enter current draft recipe inventory',()=>{
  const game=candidates('frostwarden',5),tower=game.selection,recipe=game.recipes.find(recipe=>recipe.ingredients.some(piece=>data.towers[piece.family].advanced)&&recipe.ingredients.some(piece=>piece.family===tower.family&&piece.tier===tower.tier));assert.ok(recipe);
  const advanced=recipe.ingredients.find(piece=>data.towers[piece.family].advanced),retained={id:998,...advanced,state:'active',round:0,x:15,z:15};game.towers.push(retained);game.towers.push({...retained,id:997,state:'reserved'});game.towers.push({...retained,id:996,state:'draft',round:0});
  const selected=preparationRecipeModel(game,tower,{selectedRecipeId:recipe.id}).selected,actual=recipeTreeProgress(recipe,recipeDisplayInventory(game,recipe),data),node=selected.rows.find(row=>row.family===advanced.family);
  assert.equal(node.state,'built');assert.equal(node.towerId,retained.id);assert.deepEqual(node.children,actual.find(row=>row.family===advanced.family).children);assert.ok(node.children.every(child=>child.coveredBy?.state==='active'));assert.equal(selected.counts.built,1);
});

test('retained rank V merge, downgrade cost, Move and ended/reserved inspection remain bound to actual state',()=>{
  const game=candidates('archer',5);assert.equal(game.keep(),true);assert.equal(game.startCombat(),true);game.completeWave();place(game,Array.from({length:5},()=>({family:'archer',tier:5})));const tower=game.selection,key=mergeTowerKey(game,tower.id),preview=new DefenderRankPreview();preview.select(tower,1,data);
  let html=defenderPanelMarkup(game,tower,{rankPreview:preview});assert.match(html,/Merge to rank VI/);assert.match(html,/Downgrade to Tier IV &amp; keep/);assert.equal(mergeTowerFromBadge(game,tower.id,key),true);assert.equal(tower.tier,6);assert.equal(mergeTowerFromBadge(game,tower.id,key),false);
  html=defenderPanelMarkup(game,tower);assert.match(html,/data-action="move"/);assert.equal(game.beginMove(),true);html=defenderPanelMarkup(game,tower);assert.match(html,/data-action="cancel-move"/);assert.doesNotMatch(html,/data-action="merge"/);assert.equal(game.cancelMove(),true);
  const low=candidates('archer',2);low.economy.gold=199;assert.match(button(defenderPanelMarkup(low,low.selection),'downgrade'),/disabled/);assert.equal(low.downgrade(),false);low.economy.gold=200;assert.equal(low.downgrade(),true);assert.equal(low.selection.tier,1);
  game.phase='lost';html=defenderPanelMarkup(game,tower);assert.match(html,/Read-only defender inspection/);assert.doesNotMatch(html,/data-action="(?:keep-draw|merge|downgrade|move|tower-pause)"|id="targeting"/);
  const reserved=candidates('archer',2),actual=reserved.selection;assert.equal(reserved.reserve(),true);preview.select(actual,6,data);html=defenderPanelMarkup(reserved,actual,{rankPreview:preview});assert.match(html,/Actual rank II · Reserved · Inactive wall/);assert.doesNotMatch(html,/defender-core|rank-preview|folio-recipes|folio-actions/);
});

test('unavailable higher-rank pictures use a neutral empty slot instead of a family rank-I fallback or undefined URL',()=>{
  const game=candidates(),tower=game.selection,preview=new DefenderRankPreview(),images={archer:'/rank-I-only.png'};preview.select(tower,4,data);
  const html=defenderPanelMarkup(game,tower,{images,rankPreview:preview})+draftCardsMarkup(game,data,images,{actions:false});assert.doesNotMatch(html,/src="(?:undefined|null|)"|rank-I-only.png/);assert.match(html,/folio-portrait-empty/);assert.equal((html.match(/draw-portrait-empty/g)||[]).length,5);
});
