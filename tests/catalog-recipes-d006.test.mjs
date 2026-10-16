import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {towerStats} from '../game/core/math.js';
import {championCatalogModel,championCatalogMarkup,connectChampionCatalog,catalogRecipeInventory} from '../ui/catalog-recipes.js';
import {championPerformanceSummary,runtimeDefenderDescription,championRecipeCard,defenderGuide} from '../ui/grimoire.js';
import {recipeMatches} from '../ui/recipe-filters.js';

const raw=Object.fromEntries(['balance','towers','recipes','enemies','waves'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
const fresh=()=>new Game(data,{seed:731}),ranger=data.recipes.find(r=>r.id==='thornwarden');
const snapshot=game=>JSON.stringify({towers:game.towers,draws:game.draft.draws,round:game.round,phase:game.phase,selected:game.selected,cp:game.commandPoints.value,gold:game.economy.gold,grid:[...game.grid.occupied],pinned:game.pinned});
const walk=nodes=>nodes.flatMap(node=>[node,...walk(node.children)]);
function retained(game,piece){const tower={id:game.nextId++,...piece,state:'active',round:0,x:10+game.towers.length,z:12,kills:0,cooldown:0};assert.equal(game.grid.occupy(tower.x,tower.z,tower.id).ok,true);game.towers.push(tower);return tower;}
function placed(game,pieces){for(const piece of pieces){const index=game.activeDraw;game.draft.roundForced=piece;assert.equal(game.place(3+index,3),true);}return game.roundCandidates.map(c=>c.tower);}

test('name search is English, case-insensitive and intersects every existing runtime filter',()=>{
  const game=fresh(),state={query:'  baby fire DRAGON ',damage:'magical',ability:'burn',counter:'evasion'},model=championCatalogModel(game,data,state);
  assert.equal(model.rows.length,38);assert.equal(model.matches.length,1);assert.equal(model.matches[0].name,'Baby Fire Dragon');
  for(const {family,stats}of model.matches)assert.equal(recipeMatches(stats,state,{family}),true);
  assert.equal(championCatalogModel(game,data,{...state,counter:'magic-immunity'}).matches.length,0);
  assert.equal(championCatalogModel(game,data,{query:'<unknown>'}).matches.length,0);
  assert.equal(state.query,'  baby fire DRAGON ','read-only model preserves UI input');
});

test('initial catalog puts compact recipe entries before optional explanation and keeps basic guide in its own view',()=>{
  const html=championCatalogMarkup(fresh(),data,{});
  assert.equal((html.match(/class="recipe-catalog-row/g)||[]).length,38);assert.ok(html.indexOf('recipe-catalog-row')<html.indexOf('How recipes work'));
  assert.match(html,/data-catalog-view="champions"/);assert.match(html,/data-catalog-view="basics"/);assert.match(html,/data-catalog-search/);
  assert.match(html,/<details class="catalog-filter-tools" data-catalog-disclosure="filters"><summary>Filter options/);assert.doesNotMatch(html,/<details class="catalog-filter-tools" data-catalog-disclosure="filters" open/);
  assert.match(html,/<div class="catalog-basics-view" hidden>/);assert.equal((html.match(/compact-recipe-detail/g)||[]).length,0,'nothing forces a detail open initially');
});

test('catalog progress uses real revealed identities and preserves ownership in combat',()=>{
  const game=fresh(),built=retained(game,ranger.ingredients[0]);placed(game,[ranger.ingredients[1],{family:'soldier',tier:2},{family:'mage',tier:1}]);
  Object.assign(game.draft.draws[3],ranger.ingredients[2]);const stray={...game.towers[1],id:game.nextId++};game.towers.push(stray);
  const row=championCatalogModel(game,data).rows.find(r=>r.recipe.id===ranger.id);
  assert.deepEqual(row.counts,{built:1,draft:1,missing:1});assert.ok(!row.inventory.includes(stray));assert.equal(row.available,false);assert.equal(row.progress,true);
  game.phase='combat';const combat=championCatalogModel(game,data).rows.find(r=>r.recipe.id===ranger.id);assert.deepEqual(combat.counts,{built:1,draft:0,missing:2});assert.ok(combat.inventory.includes(built));
});

test('Available status follows Game legality and In progress follows allocated ownership without spending or drawing',()=>{
  const game=fresh(),control=fresh();ranger.ingredients.forEach(piece=>retained(game,piece));ranger.ingredients.forEach(piece=>retained(control,piece));game.select(game.towers[0].id);control.select(control.towers[0].id);
  const before=snapshot(game),model=championCatalogModel(game,data,{status:'available'});assert.ok(model.matches.some(row=>row.recipe.id===ranger.id));assert.equal(model.rows.find(row=>row.recipe.id===ranger.id).craftable,true);
  const partial=fresh();placed(partial,ranger.ingredients);assert.equal(championCatalogModel(partial,data,{status:'available'}).matches.length,0);assert.ok(championCatalogModel(partial,data,{status:'progress'}).matches.some(row=>row.recipe.id===ranger.id));
  for(let index=0;index<8;index++){championCatalogModel(game,data,{query:'ranger'});championCatalogMarkup(game,data,{}, {state:{recipeId:ranger.id}});}assert.equal(snapshot(game),before);assert.equal(game.rng(),control.rng());
});

test('reserved and stale candidates cannot count for ordinary or secret recipe progress',()=>{
  const recipe=data.recipes.find(r=>r.currentRoundOnly),game=fresh();placed(game,[...recipe.ingredients,{family:'soldier',tier:2},{family:'soldier',tier:2}]);game.select(game.towers[0].id);assert.equal(game.reserve(),true);
  retained(game,recipe.ingredients[0]);game.towers[1].round--;
  const row=championCatalogModel(game,data).rows.find(row=>row.recipe.id===recipe.id);assert.deepEqual(row.counts,{built:0,draft:1,missing:2});assert.equal(row.available,false);
  assert.ok(catalogRecipeInventory(game,recipe).every(t=>t.state==='draft'&&t.round===game.round));
});

test('nested component coverage and duplicate requirements allocate each actual defender once',()=>{
  const game=fresh(),recipe=data.recipes.find(r=>r.id==='highking'),component=retained(game,recipe.ingredients[1]);
  placed(game,[{family:'soldier',tier:5},{family:'frostwarden',tier:1}]);
  const row=championCatalogModel(game,data).rows.find(row=>row.recipe.id===recipe.id),actual=walk(row.tree).filter(node=>node.towerId!==null),branch=row.tree[1];
  assert.equal(branch.towerId,component.id);assert.ok(walk(branch.children).every(node=>node.towerId===null&&node.coveredBy?.family===component.family));assert.equal(new Set(actual.map(node=>node.towerId)).size,actual.length);
  const html=championRecipeCard(recipe,data,{}, {compact:true,towerList:row.inventory});assert.match(html,/Full ingredient chain/);assert.match(html,/Included in built Frost Knight/);assert.match(html,/Missing/);
});

test('Built basics rows reproduce the approved 2/11 Kingslayer and 2/13 King inventory using built ownership only',()=>{
  const game=fresh(),control=fresh();for(const current of [game,control]){for(const piece of [{family:'cleric',tier:1},{family:'soldier',tier:1},{family:'stormcaller',tier:1}])retained(current,piece);placed(current,[{family:'mage',tier:1},{family:'druid',tier:1},{family:'runebreaker',tier:1}]);}
  const before=snapshot(game),model=championCatalogModel(game,data),kingslayer=model.rows.find(row=>row.recipe.id==='highking'),king=model.rows.find(row=>row.recipe.id==='crownofages');
  assert.deepEqual(kingslayer.builtBasics,{ownedCount:2,count:11});assert.deepEqual(king.builtBasics,{ownedCount:2,count:13});
  const markup=championCatalogMarkup(game,data,{});for(const [id,total]of [['highking',11],['crownofages',13]]){const row=markup.split('data-catalog-recipe="'+id+'"')[1].split('</button>')[0];assert.ok(row.includes('Built basics 2/'+total));}
  assert.equal(snapshot(game),before);assert.equal(game.rng(),control.rng());
});

test('a built Frost Knight covers exactly five Kingslayer basics, and refresh never double counts covered or duplicate identities',()=>{
  const game=fresh(),knight=retained(game,{family:'frostblade',tier:1}),state={recipeId:'highking'},host=fixture(championCatalogMarkup(game,data,{}, {state})),connection=connectChampionCatalog(host,game,data,{}, {state});
  const row=host.querySelector('[data-catalog-recipe="highking"]'),button=row;connection.refresh();assert.equal(row.querySelector('[data-catalog-built-basics]').textContent,'Built basics 5/11');
  game.towers.push({...knight});retained(game,{family:'archer',tier:2});retained(game,{family:'mage',tier:3});connection.refresh();assert.equal(host.querySelector('[data-catalog-recipe="highking"]'),button);assert.equal(row.querySelector('[data-catalog-built-basics]').textContent,'Built basics 5/11');
  assert.deepEqual(championCatalogModel(game,data).rows.find(row=>row.recipe.id==='highking').builtBasics,{ownedCount:5,count:11});connection.dispose();
});

test('exact higher basic rank is one required leaf and provisional, hidden, stale and reserved candidates add no built basics',()=>{
  const game=fresh(),retainedHigh=retained(game,{family:'soldier',tier:5});placed(game,[{family:'frostwarden',tier:1},{family:'soldier',tier:1},{family:'stormcaller',tier:1},{family:'archer',tier:2},{family:'mage',tier:3}]);
  game.towers.push({id:10002,family:'frostwarden',tier:1,state:'active',placed:false},{id:10003,family:'rimewatch',tier:1,state:'ruin',placed:true});
  let row=championCatalogModel(game,data).rows.find(row=>row.recipe.id==='highking');assert.deepEqual(row.builtBasics,{ownedCount:1,count:11});assert.equal(row.inventory.includes(retainedHigh),true);assert.equal(game.reserve(game.selection.id),true);
  row=championCatalogModel(game,data).rows.find(row=>row.recipe.id==='highking');assert.deepEqual(row.builtBasics,{ownedCount:1,count:11});assert.ok(row.inventory.every(t=>t.placed!==false&&t.state!=='ruin'));assert.match(championCatalogMarkup(game,data,{}),/Built basics 1\/11/);
});

test('Mage descriptions use current Magical cleave and aura-only champions prominently display actual output',()=>{
  const mage=towerStats({family:'mage',tier:1},data),dragon=towerStats({family:'embercrown',tier:1},data),dragonRecipe=data.recipes.find(r=>r.id==='embercrown');
  const description=runtimeDefenderDescription(mage,{family:'mage'});assert.match(description,/Magical cleave/);assert.doesNotMatch(description,/pure/i);assert.ok(description.includes(`${Math.round(mage.cleave*100)}%`));
  const guide=defenderGuide(data,{}, {compact:true,championsIntro:false});assert.match(guide,/Magical cleave/);assert.doesNotMatch(guide,/pure splash|pure-splash/i);
  assert.equal(dragon.damage,0);const html=championRecipeCard(dragonRecipe,data,{}, {compact:true});assert.match(html,/Aura DPS/);assert.ok(html.includes(`${dragon.burnAura.toLocaleString('en-US')}/s`));assert.doesNotMatch(html,/<dt>Base DPS<\/dt><dd>0/);assert.match(html,/No direct attack/);
  const druid=championPerformanceSummary(towerStats({family:'greenheart',tier:1},data));assert.match(druid,/Direct DPS/);assert.match(druid,/Poison/);assert.doesNotMatch(druid,/Effective DPS|Total DPS/);
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
    focus(options){document.activeElement=this;this.focusOptions=options;}
    get innerHTML(){return this._html;}
    set innerHTML(html){this._html=html;this.children.forEach(child=>child.parentNode=null);this.children=[];const stack=[this];for(const token of html.match(/<[^>]+>/g)||[]){if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}const tag=token.match(/^<([a-z][\w-]*)/i)?.[1];if(!tag)continue;const attributes={};for(const match of token.slice(tag.length+1,-1).matchAll(/([\w-]+)(?:="([^"]*)")?/g))attributes[match[1]]=match[2]??'';const element=new Element(tag,attributes),parent=stack.at(-1);element.parentNode=parent;parent.children.push(element);if(!['img','input','br','hr'].includes(tag)&&!token.endsWith('/>'))stack.push(element);}}
  }
  const host=new Element();host.innerHTML=markup;return host;
}

test('catalog connector searches, combines filters, opens exact detail and invokes integration stamping without gameplay mutation',()=>{
  const game=fresh(),host=fixture(championCatalogMarkup(game,data,{})),state={},before=snapshot(game);let details=0;const connection=connectChampionCatalog(host,game,data,{}, {state,onDetail:()=>details++}),catalog=host.querySelector('.champion-catalog');
  const input=catalog.querySelector('[data-catalog-search]');input.value='baby fire dragon';catalog.dispatch('input',input);
  const rows=catalog.querySelectorAll('[data-catalog-recipe]');assert.equal(rows.filter(row=>!row.hidden).length,1);
  const ability=catalog.querySelector('[data-recipe-filter="ability"]');ability.value='burn';catalog.dispatch('change',ability);assert.equal(rows.filter(row=>!row.hidden).length,1);
  const row=rows.find(row=>row.dataset.catalogRecipe==='embercrown');catalog.dispatch('click',row);assert.equal(state.recipeId,'embercrown');assert.equal(catalog.querySelector('.catalog-recipe-detail').hidden,false);assert.match(catalog.querySelector('.catalog-recipe-detail').innerHTML,/Aura DPS/);assert.ok(details>0);
  assert.ok(catalog.querySelector('[data-catalog-close]'));assert.equal(state.recipeId,'embercrown');assert.equal(catalog.querySelector('.catalog-recipe-detail').hidden,false);assert.equal(snapshot(game),before);connection.dispose();
});

test('Back to list clears only the detail and restores its existing row focus, filters, list scroll, history and pin',()=>{
  const game=fresh(),control=fresh();game.pinned=control.pinned='highking';const state={query:'baby fire dragon',damage:'magical',ability:'burn',counter:'evasion'},before=snapshot(game),host=fixture(championCatalogMarkup(game,data,{}, {state})),connection=connectChampionCatalog(host,game,data,{}, {state}),catalog=host.querySelector('.champion-catalog'),list=catalog.querySelector('.catalog-recipe-list'),row=catalog.querySelector('[data-catalog-recipe="embercrown"]');
  list.scrollTop=57;catalog.dispatch('click',row);const history=JSON.stringify(state.navigation),pane=catalog.querySelector('.catalog-recipe-detail'),layout=catalog.querySelector('.catalog-recipe-layout');catalog.querySelector('[data-catalog-disclosure="chain:embercrown"]').open=true;
  const close=catalog.querySelector('[data-catalog-close]');assert.ok(close);close.focus();catalog.dispatch('click',close);
  assert.equal(state.recipeId,null);assert.equal(pane.hidden,true);assert.equal(layout.matches('.has-detail'),false);assert.equal(JSON.stringify(state.navigation),history);assert.equal(game.pinned,'highking');assert.equal(state.query,'baby fire dragon');assert.equal(state.damage,'magical');assert.equal(state.ability,'burn');assert.equal(state.counter,'evasion');assert.equal(list.scrollTop,57);assert.equal(host.ownerDocument.activeElement,row);assert.deepEqual(row.focusOptions,{preventScroll:true});assert.equal(row.attributes['aria-pressed'],'false');
  connection.refresh();assert.equal(state.recipeId,null);assert.equal(pane.hidden,true);catalog.dispatch('click',row);assert.equal(state.recipeId,'embercrown');assert.equal(catalog.querySelector('[data-catalog-disclosure="chain:embercrown"]').open,true);assert.equal(JSON.stringify(state.navigation),history,'Reopening the current exploration entry does not invent a second visit');assert.equal(snapshot(game),before);assert.equal(game.rng(),control.rng());connection.dispose();
});

test('returning from an out-of-filter component focuses the visible originating recipe without changing exploration history',()=>{
  const game=fresh(),state={query:'Kingslayer'},host=fixture(championCatalogMarkup(game,data,{}, {state})),connection=connectChampionCatalog(host,game,data,{}, {state}),catalog=host.querySelector('.champion-catalog'),origin=catalog.querySelector('[data-catalog-recipe="highking"]');
  catalog.dispatch('click',origin);catalog.dispatch('click',catalog.querySelector('[data-catalog-ingredient="frostblade"]'));assert.equal(state.recipeId,'frostblade');assert.equal(catalog.querySelector('[data-catalog-recipe="frostblade"]').hidden,true);const history=JSON.stringify(state.navigation);
  catalog.dispatch('click',catalog.querySelector('[data-catalog-close]'));assert.equal(state.recipeId,null);assert.equal(catalog.querySelector('.catalog-recipe-detail').hidden,true);assert.equal(host.ownerDocument.activeElement,origin);assert.equal(JSON.stringify(state.navigation),history);assert.equal(state.query,'Kingslayer');assert.equal(catalog.querySelectorAll('[data-catalog-recipe]').filter(row=>!row.hidden).length,1);connection.dispose();
});

test('list return with no matching rows preserves the empty filter and restores keyboard focus to search',()=>{
  const game=fresh(),state={recipeId:'highking'},host=fixture(championCatalogMarkup(game,data,{}, {state})),connection=connectChampionCatalog(host,game,data,{}, {state}),catalog=host.querySelector('.champion-catalog'),input=catalog.querySelector('[data-catalog-search]');
  input.value='No matching champion';catalog.dispatch('input',input);assert.equal(catalog.querySelectorAll('[data-catalog-recipe]').filter(row=>!row.hidden).length,0);const history=JSON.stringify(state.navigation);
  catalog.dispatch('click',catalog.querySelector('[data-catalog-close]'));assert.equal(state.recipeId,null);assert.equal(state.query,'No matching champion');assert.equal(input.value,'No matching champion');assert.equal(host.ownerDocument.activeElement,input);assert.deepEqual(input.focusOptions,{preventScroll:true});assert.equal(JSON.stringify(state.navigation),history);assert.equal(catalog.querySelector('.catalog-recipe-detail').hidden,true);connection.dispose();
});

test('the pinned bookmark opens its champion page from Basic defenders without changing filters, pin or campaign state',()=>{
  const game=fresh(),control=fresh();game.pinned=control.pinned='highking';
  const state={view:'basics',query:'Archer',damage:'physical'},before=snapshot(game),host=fixture(championCatalogMarkup(game,data,{}, {state})),connection=connectChampionCatalog(host,game,data,{}, {state}),catalog=host.querySelector('.champion-catalog');
  assert.equal(catalog.querySelector('.catalog-basics-view').hidden,false);
  assert.equal(catalog.querySelector('.recipe-filter-count').textContent,'6 of 48 basic rank profiles match');
  const bookmark=catalog.querySelector('.catalog-bookmark').querySelector('[data-catalog-ingredient]');catalog.dispatch('click',bookmark);
  assert.equal(state.view,'champions');assert.equal(state.recipeId,'highking');assert.equal(catalog.querySelector('.catalog-champions-view').hidden,false);assert.equal(catalog.querySelector('.catalog-basics-view').hidden,true);assert.equal(catalog.querySelector('.catalog-recipe-detail').hidden,false);
  assert.equal(state.query,'Archer');assert.equal(state.damage,'physical');assert.match(catalog.querySelector('.catalog-recipe-detail').innerHTML,/Outside current filters/);
  assert.equal(catalog.querySelector('.recipe-filter-count').textContent,'0 of 38 champions match');
  assert.equal(snapshot(game),before);assert.equal(game.rng(),control.rng());connection.dispose();
});

test('basic guide has independent view, existing rank filters and corrected Mage information',()=>{
  const game=fresh(),host=fixture(championCatalogMarkup(game,data,{})),state={},connection=connectChampionCatalog(host,game,data,{}, {state}),catalog=host.querySelector('.champion-catalog');
  const basic=catalog.querySelector('[data-catalog-view="basics"]');catalog.dispatch('click',basic);assert.equal(state.view,'basics');assert.equal(catalog.querySelector('.catalog-basics-view').hidden,false);assert.equal(catalog.querySelector('.catalog-champions-view').hidden,true);
  const input=catalog.querySelector('[data-catalog-search]');input.value='mage';catalog.dispatch('input',input);
  assert.equal(catalog.querySelectorAll('[data-filter-family]').filter(entry=>!entry.hidden).length,1);assert.match(catalog.querySelector('.recipe-filter-count').textContent,/6 of 48 basic rank profiles/);connection.dispose();
});

test('pin rerenders preserve selected recipe, search and independent explanation/filter/tree disclosure choices',()=>{
  const game=fresh(),state={recipeId:ranger.id},host=fixture(championCatalogMarkup(game,data,{}, {state})),connection=connectChampionCatalog(host,game,data,{}, {state}),catalog=host.querySelector('.champion-catalog');
  catalog.querySelector('[data-catalog-disclosure="filters"]').open=true;catalog.querySelector(`[data-catalog-disclosure="chain:${ranger.id}"]`).open=true;connection.dispose();game.pinned=ranger.id;
  host.innerHTML=championCatalogMarkup(game,data,{}, {state});const next=connectChampionCatalog(host,game,data,{}, {state}),restored=host.querySelector('.champion-catalog');
  assert.equal(state.recipeId,ranger.id);assert.equal(restored.querySelector('[data-catalog-disclosure="filters"]').open,true);assert.equal(restored.querySelector(`[data-catalog-disclosure="chain:${ranger.id}"]`).open,true);assert.match(restored.querySelector('.catalog-recipe-detail').innerHTML,/Unpin recipe/);next.dispose();
});

test('catalog refresh updates allocated row progress and detail after a real reserve while keeping disclosure choices',()=>{
  const game=fresh();placed(game,[...ranger.ingredients,{family:'soldier',tier:2},{family:'soldier',tier:2}]);game.select(game.towers[0].id);
  const state={recipeId:ranger.id},host=fixture(championCatalogMarkup(game,data,{}, {state})),connection=connectChampionCatalog(host,game,data,{}, {state}),catalog=host.querySelector('.champion-catalog');
  catalog.querySelector(`[data-catalog-disclosure="chain:${ranger.id}"]`).open=true;assert.equal(game.reserve(),true);connection.refresh();
  const row=catalog.querySelector(`[data-catalog-recipe="${ranger.id}"]`);assert.match(row.querySelector('em').textContent,/○ 1 Missing/);assert.match(catalog.querySelector('.catalog-recipe-detail').innerHTML,/Missing/);assert.doesNotMatch(catalog.querySelector('.catalog-recipe-detail').innerHTML,/data-action="craft"/);assert.equal(catalog.querySelector(`[data-catalog-disclosure="chain:${ranger.id}"]`).open,true);connection.dispose();
});
