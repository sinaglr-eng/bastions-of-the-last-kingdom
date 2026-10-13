import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {recipeFamily,recipeTier,expandRecipeToBasics,expandedRecipeProgress} from '../game/core/recipes.js';
import {defenderCode} from '../game/core/unit-label.js';
import {recipeNavigationVisit,recipeNavigationStep,recipeNavigationModel,recipeIngredientPresentation,downstreamRecipes,pinnedMissingBasicSummary} from '../ui/recipe-navigation.js';
import {craftingDockModel,craftingDockMarkup,craftRecipeKey,craftRecipeFromDock} from '../ui/crafting-dock.js';
import {championCatalogMarkup,connectChampionCatalog} from '../ui/catalog-recipes.js';
import {championRecipeCard} from '../ui/grimoire.js';

const raw=Object.fromEntries(['balance','towers','recipes','enemies','waves'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
const fresh=(local=data)=>new Game(local,{seed:731}),recipe=id=>data.recipes.find(row=>row.id===id);
const images=Object.fromEntries(Object.keys(data.towers).map(family=>[family,`/approved/${family}.png`]));
const snapshot=game=>JSON.stringify({towers:game.towers,draws:game.draft.draws,round:game.round,phase:game.phase,selected:game.selected,preview:game.previewRecipeId,pinned:game.pinned,activeDraw:game.activeDraw,cp:game.commandPoints.value,gold:game.economy.gold,grid:[...game.grid.occupied],resolved:game.draft.resolved});
function retained(game,piece){const index=game.towers.length,tower={id:game.nextId++,...piece,state:'active',round:0,x:10+index%12,z:12+Math.floor(index/12),kills:0,cooldown:0,mvpLevel:0};assert.equal(game.grid.occupy(tower.x,tower.z,tower.id).ok,true);game.towers.push(tower);return tower;}
function placed(game,pieces){for(const piece of pieces){const index=game.activeDraw;game.draft.roundForced=piece;assert.equal(game.place(3+index,3),true);}return game.roundCandidates.map(row=>row.tower);}
const missingMap=result=>Object.fromEntries(result.items.map(item=>[`${item.family}:${item.tier}`,item.count]));

test('ingredient presentation uses runtime names, exact Roman ranks and basic defender codes for all 38 recipes',()=>{
  for(const target of data.recipes){
    const html=championRecipeCard(target,data,images,{compact:true});
    assert.equal((html.match(/class="recipe-ingredient-portrait"/g)||[]).length,3);
    for(const piece of target.ingredients){
      const item=recipeIngredientPresentation(piece,data);assert.equal(item.name,data.towers[piece.family].name);
      assert.ok(html.includes(`/approved/${piece.family}.png`));assert.ok(html.includes(item.name));
      if(data.towers[piece.family].advanced){assert.equal(item.recipeId,data.recipes.find(row=>recipeFamily(row)===piece.family&&recipeTier(row)===piece.tier).id);assert.ok(html.includes(`data-catalog-ingredient="${item.recipeId}"`));assert.match(item.code,/^[A-Z]+ [IVX]+$/);assert.ok(html.includes(`(${item.code})`));}
      else{assert.equal(item.code,defenderCode(data.towers[piece.family],piece.tier));assert.ok(html.includes(`(${item.code})`));}
    }
  }
});

test('champion ingredient abbreviations use English name initials and exact ranks in dock and catalog',()=>{
  for(const [family,code]of [['greenheart','MD I'],['frostblade','FK I'],['embercrown','BFD I']]){
    assert.equal(recipeIngredientPresentation({family,tier:1},data).code,code);
    const target=data.recipes.find(row=>row.ingredients.some(piece=>piece.family===family));assert.ok(target);
    assert.ok(championRecipeCard(target,data,images,{compact:true}).includes(`(${code})`));
    assert.ok(craftingDockMarkup(fresh(),images,{recipeId:target.id}).includes(`(${code})`));
  }
});

test('single-word champion abbreviations use three letters while every basic code remains canonical',()=>{
  for(const [family,code]of [['wyvernhunter','RAN I'],['stonewarden','CAT I'],['crownofages','KIN I'],['emeraldgolem','GOL I']])assert.equal(recipeIngredientPresentation({family,tier:1},data).code,code);
  for(const [family,stats]of Object.entries(data.towers))if(!stats.advanced)for(let tier=1;tier<=6;tier++)assert.equal(recipeIngredientPresentation({family,tier},data).code,defenderCode(stats,tier));
});

test('catalog shows visible description and abilities above portrait ingredient rows without Back to list',()=>{
  const target=recipe('frostblade'),html=championCatalogMarkup(fresh(),data,images,{state:{recipeId:target.id}});
  assert.ok(html.indexOf('aria-label="Abilities and description"')<html.indexOf('Exact ingredients'));
  assert.ok(html.indexOf('recipe-effects')<html.indexOf('Exact ingredients'));
  assert.doesNotMatch(html,/Back to list|data-catalog-detail-close/);assert.match(html,/data-catalog-history="back"/);
  const css=readFileSync(new URL('../ui/catalog-recipes.css',import.meta.url),'utf8');
  assert.doesNotMatch(css,/has-detail\s+\.catalog-recipe-list\{display:none/);
  assert.doesNotMatch(css,/recipe-ingredients\{[^}]*grid-template-columns:repeat\(3/);
  assert.match(css,/recipe-ingredient-name[^}]*width:auto/);
});

test('UI navigation supports previous/forward and branches from a previous recipe without duplicate current visits',()=>{
  const state={};assert.equal(recipeNavigationModel(state).recipeId,null);
  recipeNavigationVisit(state,'highking');recipeNavigationVisit(state,'frostblade');recipeNavigationVisit(state,'rimewatch');
  assert.equal(recipeNavigationVisit(state,'rimewatch'),'rimewatch');assert.equal(state.history.length,3);
  assert.equal(recipeNavigationStep(state,-1),'frostblade');assert.equal(recipeNavigationStep(state,1),'rimewatch');
  recipeNavigationStep(state,-1);recipeNavigationVisit(state,'thornwarden');assert.deepEqual(state.history,['highking','frostblade','thornwarden']);assert.equal(recipeNavigationStep(state,1),null);
  const before=JSON.stringify(state);recipeNavigationModel(state);assert.equal(JSON.stringify(state),before);
});

test('selected Frostsword exposes downstream Frost Knight requirements without committing or drawing',()=>{
  const game=fresh(),control=fresh(),piece={family:'rimewatch',tier:1};game.select(retained(game,piece).id);control.select(retained(control,piece).id);
  const before=snapshot(game),model=craftingDockModel(game),navigation={};recipeNavigationVisit(navigation,'rimewatch');
  assert.equal(model.plan.recipe.id,'rimewatch');assert.ok(model.downstream.some(row=>row.id==='frostblade'));
  assert.deepEqual(downstreamRecipes(recipe('rimewatch'),data).map(row=>row.id),model.downstream.map(row=>row.id));
  const html=craftingDockMarkup(game,images,{navigation});assert.match(html,/Combine Frostsword Watchmen further/);assert.match(html,/data-action="recipe-explore" data-id="frostblade"/);
  recipeNavigationVisit(navigation,'frostblade');const detail=craftingDockModel(game,{recipeId:'frostblade'});assert.deepEqual(detail.plan.rows.map(({family,tier})=>({family,tier})),recipe('frostblade').ingredients);
  const target=craftingDockMarkup(game,images,{recipeId:'frostblade',navigation});assert.match(target,/data-action="recipe-explore" data-id="rimewatch"/);assert.match(target,/data-action="recipe-history-back"[^>]*>/);
  assert.equal(snapshot(game),before);assert.equal(game.rng(),control.rng());
});

test('missing basic frontier subtracts a built component subtree once while preserving repeated remaining leaves',()=>{
  const game=fresh();game.pinned='highking';
  assert.deepEqual(missingMap(pinnedMissingBasicSummary(game)),{'soldier:5':1,'soldier:3':1,'stormcaller:3':1,'frostwarden:1':2,'soldier:1':2,'stormcaller:1':2,'archer:2':1,'mage:3':1});
  retained(game,{family:'frostblade',tier:1});
  assert.deepEqual(missingMap(pinnedMissingBasicSummary(game)),{'soldier:5':1,'soldier:3':1,'stormcaller:3':1,'frostwarden:1':1,'soldier:1':1,'stormcaller:1':1});
  retained(game,{family:'soldier',tier:1});placed(game,[{family:'stormcaller',tier:1}]);
  assert.deepEqual(missingMap(pinnedMissingBasicSummary(game)),{'soldier:5':1,'soldier:3':1,'stormcaller:3':1,'frostwarden:1':1});
  assert.equal(craftingDockModel(game).pinned.missingBasics.summary,pinnedMissingBasicSummary(game).summary);
});

test('duplicate missing basics use compact multiplicity codes and each eligible identity only once',()=>{
  const local=structuredClone(data),target=local.recipes.find(row=>row.id==='thornwarden');target.ingredients=[{family:'soldier',tier:2},{family:'soldier',tier:2},{family:'druid',tier:1}];
  const game=fresh(local);game.pinned=target.id;assert.equal(pinnedMissingBasicSummary(game).summary,'2×SII, DI');
  retained(game,{family:'soldier',tier:2});assert.equal(pinnedMissingBasicSummary(game).summary,'SII, DI');
  placed(game,[{family:'soldier',tier:2},{family:'soldier',tier:2}]);assert.equal(pinnedMissingBasicSummary(game).summary,'DI');
});

test('hidden, reserved, stale, unplaced, stray and wall resources do not reduce the missing frontier',()=>{
  for(const invalidate of [
    (game,tower)=>{game.draft.draws[0].placed=false;},
    (game,tower)=>{game.draft.draws[0].reservedForNextDraft=true;},
    (game,tower)=>{tower.round--;},(game,tower)=>{tower.placed=false;},(game,tower)=>{tower.state='ruin';},
    (game,tower)=>{game.draft.draws[0].towerId=999;},
  ]){
    const game=fresh();game.pinned='thornwarden';const [tower]=placed(game,[recipe('thornwarden').ingredients[0]]);invalidate(game,tower);
    Object.assign(game.draft.draws[1],recipe('thornwarden').ingredients[1]);
    assert.equal(pinnedMissingBasicSummary(game).total,3);
  }
  const game=fresh();game.pinned='thornwarden';retained(game,recipe('thornwarden').ingredients[0]);game.towers[0].state='reserved';assert.equal(pinnedMissingBasicSummary(game).total,3);
});

test('secret frontier excludes retained resources and follows actual reserve eligibility',()=>{
  const target=data.recipes.find(row=>row.currentRoundOnly),game=fresh();game.pinned=target.id;target.ingredients.forEach(piece=>retained(game,piece));
  assert.equal(pinnedMissingBasicSummary(game).total,expandRecipeToBasics(target,data).reduce((sum,row)=>sum+row.count,0));
  const candidates=placed(game,[...target.ingredients,{family:'soldier',tier:2},{family:'soldier',tier:2}]);game.select(candidates[0].id);assert.equal(game.reserve(),true);
  const expected=expandedRecipeProgress(target,game.towers.filter(t=>t.state==='draft'&&t.round===game.round),data).reduce((sum,row)=>sum+row.count-row.ownedCount-row.draftCount,0);
  assert.equal(pinnedMissingBasicSummary(game).total,expected);assert.equal(game.towers.find(t=>t.id===candidates[0].id).state,'reserved');
});

test('actual crafting replaces consumed basic resources with exactly one component allocation',()=>{
  const game=fresh();game.pinned='highking';const pieces=recipe('rimewatch').ingredients.map(piece=>retained(game,piece));game.select(pieces[0].id);
  const before=pinnedMissingBasicSummary(game),key=craftRecipeKey(game,'rimewatch');assert.ok(key);assert.equal(craftRecipeFromDock(game,'rimewatch',game.selected,key),true);
  assert.equal(game.towers.filter(t=>t.state==='ruin').length,2);assert.equal(game.selection.family,'rimewatch');assert.deepEqual(pinnedMissingBasicSummary(game),before);
  const extra=retained(game,{family:'rimewatch',tier:1});assert.equal(pinnedMissingBasicSummary(game).total,before.total-3);extra.state='ruin';assert.equal(pinnedMissingBasicSummary(game).total,before.total);
});

test('all recipe summaries agree with core recursive coverage and repeated inspection preserves gameplay and RNG',()=>{
  const game=fresh(),control=fresh();for(const piece of [{family:'frostblade',tier:1},{family:'soldier',tier:1},{family:'mage',tier:3}]){retained(game,piece);retained(control,piece);}
  placed(game,[{family:'druid',tier:1},{family:'soldier',tier:2}]);placed(control,[{family:'druid',tier:1},{family:'soldier',tier:2}]);const before=snapshot(game);
  for(const target of data.recipes){
    const allowed=game.towers.filter(t=>t.state==='draft'||t.state==='active'&&!target.currentRoundOnly),expected=expandedRecipeProgress(target,allowed,data).filter(row=>row.count>row.ownedCount+row.draftCount);
    const summary=pinnedMissingBasicSummary(game,target);
    assert.deepEqual(missingMap(summary),Object.fromEntries(expected.map(row=>[`${row.family}:${row.tier}`,row.count-row.ownedCount-row.draftCount])));
    assert.ok(!/undefined|NaN/.test(summary.summary));craftingDockMarkup(game,images,{recipeId:target.id});championCatalogMarkup(game,data,images,{state:{recipeId:target.id}});
  }
  assert.equal(snapshot(game),before);assert.equal(game.rng(),control.rng());
});

function fixture(markup){
  const document={activeElement:null};
  class Element{
    constructor(tag='div',attributes={}){this.tagName=tag.toUpperCase();this.attributes={...attributes};this.dataset=Object.fromEntries(Object.entries(attributes).filter(([key])=>key.startsWith('data-')).map(([key,value])=>[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),value]));this.ownerDocument=document;this.parentNode=null;this.children=[];this.listeners=new Map();this._html='';this.open=Object.hasOwn(attributes,'open');this.hidden=Object.hasOwn(attributes,'hidden');this.disabled=Object.hasOwn(attributes,'disabled');this.scrollTop=0;this.value=attributes.value||'';this.textContent='';this.classList={toggle:(cls,active)=>{const values=new Set((this.attributes.class||'').split(/\s+/).filter(Boolean));if(active)values.add(cls);else values.delete(cls);this.attributes.class=[...values].join(' ');}};}
    matches(selector){const match=selector.match(/^([a-z][\w-]*)?((?:\.[\w-]+)*)(?:\[([\w-]+)(?:="([^"]*)")?\])?$/i);if(!match)return false;const [,tag,classes,attr,value]=match;return(!tag||this.tagName.toLowerCase()===tag)&&(!classes||classes.split('.').filter(Boolean).every(cls=>(this.attributes.class||'').split(/\s+/).includes(cls)))&&(!attr||Object.hasOwn(this.attributes,attr)&&(value===undefined||this.attributes[attr]===value));}
    closest(selector){for(let node=this;node;node=node.parentNode)if(node.matches(selector))return node;return null;}
    contains(node){for(let current=node;current;current=current.parentNode)if(current===this)return true;return false;}
    querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    setAttribute(key,value){this.attributes[key]=String(value);}
    addEventListener(type,callback){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(callback);}
    removeEventListener(type,callback){this.listeners.get(type)?.delete(callback);}
    dispatch(type,target=this){const event={type,target};for(let node=target;node;node=node.parentNode)for(const callback of node.listeners.get(type)||[])callback(event);}
    focus(){document.activeElement=this;}
    get innerHTML(){return this._html;}
    set innerHTML(html){this._html=html;this.children.forEach(child=>child.parentNode=null);this.children=[];const stack=[this];for(const token of html.match(/<[^>]+>/g)||[]){if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}const tag=token.match(/^<([a-z][\w-]*)/i)?.[1];if(!tag)continue;const attributes={};for(const match of token.slice(tag.length+1,-1).matchAll(/([\w-]+)(?:="([^"]*)")?/g))attributes[match[1]]=match[2]??'';const element=new Element(tag,attributes),parent=stack.at(-1);element.parentNode=parent;parent.children.push(element);if(!['img','input','br','hr'].includes(tag)&&!token.endsWith('/>'))stack.push(element);}}
  }
  const host=new Element();host.innerHTML=markup;return host;
}

test('catalog component navigation keeps filtered rows, context history, disclosures, focus and actual gameplay intact',()=>{
  const game=fresh(),control=fresh(),state={recipeId:'highking',query:'Kingslayer'},before=snapshot(game),host=fixture(championCatalogMarkup(game,data,images,{state}));let callbacks=0;
  let connection=connectChampionCatalog(host,game,data,images,{state,onDetail:()=>callbacks++}),catalog=host.querySelector('.champion-catalog');
  catalog.querySelector('[data-catalog-disclosure="chain:highking"]').open=true;
  catalog.dispatch('click',catalog.querySelector('[data-catalog-ingredient="frostblade"]'));assert.equal(state.recipeId,'frostblade');assert.equal(state.query,'Kingslayer');assert.equal(catalog.querySelector('.catalog-recipe-detail').hidden,false);
  assert.equal(catalog.querySelectorAll('[data-catalog-recipe]').filter(row=>!row.hidden).length,1);assert.ok(host.ownerDocument.activeElement.matches('[data-catalog-detail-heading]'));
  catalog.dispatch('click',catalog.querySelector('[data-catalog-ingredient="rimewatch"]'));assert.equal(state.recipeId,'rimewatch');
  catalog.dispatch('click',catalog.querySelector('[data-catalog-history="back"]'));assert.equal(state.recipeId,'frostblade');
  catalog.dispatch('click',catalog.querySelector('[data-catalog-history="back"]'));assert.equal(state.recipeId,'highking');assert.equal(catalog.querySelector('[data-catalog-disclosure="chain:highking"]').open,true);
  catalog.dispatch('click',catalog.querySelector('[data-catalog-history="forward"]'));assert.equal(state.recipeId,'frostblade');
  connection.dispose();host.innerHTML=championCatalogMarkup(game,data,images,{state});connection=connectChampionCatalog(host,game,data,images,{state});catalog=host.querySelector('.champion-catalog');
  catalog.dispatch('click',catalog.querySelector('[data-catalog-history="forward"]'));assert.equal(state.recipeId,'rimewatch');assert.equal(state.query,'Kingslayer');assert.ok(callbacks>=5);
  assert.equal(snapshot(game),before);assert.equal(game.rng(),control.rng());connection.dispose();
});
