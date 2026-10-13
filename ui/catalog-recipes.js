import {towerStats} from '../game/core/math.js';
import {recipeFamily,recipeTier,recipeLabel,recipeTreeProgress} from '../game/core/recipes.js';
import {builtTowerCount} from '../game/core/warband-info.js';
import {championClassification} from '../game/render/champion-classification.js';
import {championRecipeCard,championPerformanceSummary,defenderGuide} from './grimoire.js';
import {recipeMatches,recipeFilterControlsMarkup,connectRecipeFilters} from './recipe-filters.js';
import {icon} from './icons.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const walk=nodes=>nodes.flatMap(node=>[node,...walk(node.children)]);
export const championCatalogDefaults=()=>({view:'champions',query:'',damage:'',ability:'',counter:'',status:'all',recipeId:null});

// Ownership remains truthful during combat and after a run. Provisional stock
// comes only from actual revealed current draws, never latent or reserved IDs.
export function catalogRecipeInventory(game,recipe){
  const candidates=new Set();
  if(!game.draft.resolved&&['build','select'].includes(game.phase))for(const draw of game.draft.draws){
    if(!draw.placed||draw.reservedForNextDraft)continue;
    const tower=game.towers.find(t=>t.id===draw.towerId&&t.state==='draft'&&t.round===game.round&&t.placed!==false);
    if(tower)candidates.add(tower);
  }
  return game.towers.filter(t=>t.placed!==false&&(candidates.has(t)||t.state==='active'&&!recipe.currentRoundOnly));
}

export function championCatalogModel(game,data=game.data,state={}){
  const filters={...championCatalogDefaults(),...state},query=String(filters.query||'').trim().toLocaleLowerCase('en-US');
  const legal=new Set();
  for(const tower of game.towers)if(game.canCombine(tower))for(const recipe of game.availableRecipes(tower))legal.add(recipe.id);
  const selectedLegal=new Set(game.availableRecipes().map(recipe=>recipe.id));
  const rows=game.recipes.map(recipe=>{
    const family=recipeFamily(recipe),stats=towerStats({family,tier:recipeTier(recipe)},data),inventory=catalogRecipeInventory(game,recipe),tree=recipeTreeProgress(recipe,inventory,data);
    const counts={built:tree.filter(p=>p.ownedCount).length,draft:tree.filter(p=>p.draftCount).length,missing:tree.filter(p=>!p.ownedCount&&!p.draftCount).length};
    const progress=walk(tree).some(node=>node.towerId!==null),available=legal.has(recipe.id);
    const matches=recipeLabel(recipe,data).toLocaleLowerCase('en-US').includes(query)&&recipeMatches(stats,filters,{family})&&(filters.status==='all'||filters.status==='available'&&available||filters.status==='progress'&&progress);
    const craftable=selectedLegal.has(recipe.id),reason=craftable?'':available?'Select an eligible ingredient on the battlefield to choose the result foundation.':game.commandMove.active?'Finish or cancel Move before combining.':['won','lost'].includes(game.phase)?'Run ended · Read-only recipe catalog.':game.phase==='combat'?'Recruit champions between waves.':counts.draft&&game.phase==='build'?'Place all five recruits before combining current candidates.':counts.missing?`${counts.missing} exact ${counts.missing===1?'ingredient is':'ingredients are'} missing.`:'Select a matching ingredient and satisfy the recipe’s current-round rules.';
    return {recipe,family,name:recipeLabel(recipe,data),stats,inventory,tree,counts,progress,available,craftable,reason,builtCount:builtTowerCount(game.towers,family),matches};
  });
  return {state:filters,rows,matches:rows.filter(row=>row.matches),selected:rows.find(row=>row.recipe.id===filters.recipeId&&row.matches)||null};
}

const progressText=counts=>`✓ ${counts.built} Built · ◆ ${counts.draft} This round · ○ ${counts.missing} Missing`;
function rowMarkup(row,images){
  const src=images[`${row.family}:${recipeTier(row.recipe)}`]||images[row.family];
  return `<button type="button" class="recipe-catalog-row ${row.available?'available':''}" data-family="${escape(row.family)}" data-catalog-recipe="${escape(row.recipe.id)}" aria-label="Open ${escape(row.name)} recipe" aria-pressed="false" ${row.matches?'':'hidden'}>${src?`<img src="${escape(src)}" alt="" draggable="false">`:''}<span><strong>${escape(row.name)}</strong><small>${escape(championPerformanceSummary(row.stats))}</small><em>${progressText(row.counts)}</em></span><b aria-hidden="true">›</b></button>`;
}
function detailMarkup(row,game,data,images){
  if(!row)return '';
  return `<button type="button" class="text-button catalog-detail-back" data-catalog-detail-close aria-label="Close recipe detail">${icon('close')} Back to list</button>${championRecipeCard(row.recipe,data,images,{compact:true,towerList:row.inventory,pinned:game.pinned===row.recipe.id,discovered:game.discoveries.has(row.family)||game.discoveries.has(row.recipe.id),level:game.economy.level,craftable:row.craftable,combinationAvailable:row.available,builtCount:row.builtCount})}${row.reason?`<p class="catalog-anchor-note">${escape(row.reason)}</p>`:''}`;
}

export function championCatalogMarkup(game,data=game.data,images={}, {state={}}={}){
  const model=championCatalogModel(game,data,state);
  return `<section class="champion-catalog" aria-label="Defender recipe catalog"><div class="catalog-view-tabs" role="group" aria-label="Defender catalog"><button type="button" class="text-button" data-catalog-view="champions" aria-pressed="${model.state.view!=='basics'}">${icon('crown')} Champions</button><button type="button" class="text-button" data-catalog-view="basics" aria-pressed="${model.state.view==='basics'}">${icon('shield')} Basic defenders</button></div><label class="catalog-search">${icon('book')}<span class="visually-hidden">Search defender names</span><input type="search" data-catalog-search value="${escape(model.state.query)}" placeholder="Search champion names" aria-label="Search defender names" autocomplete="off"></label>${recipeFilterControlsMarkup({compact:true})}<div class="catalog-status-filters" role="group" aria-label="Recipe progress filter"><button type="button" class="text-button" data-catalog-status="all">All</button><button type="button" class="text-button" data-catalog-status="available">Available</button><button type="button" class="text-button" data-catalog-status="progress">In progress</button></div><div class="catalog-champions-view"><div class="catalog-recipe-layout ${model.selected?'has-detail':''}"><div class="catalog-recipe-list" aria-label="Champion recipes">${model.rows.map(row=>rowMarkup(row,images)).join('')}</div><section class="catalog-recipe-detail" aria-label="Selected champion recipe" ${model.selected?'':'hidden'}>${detailMarkup(model.selected,game,data,images)}</section></div><details class="catalog-recipe-explanation" data-catalog-disclosure="recipe-explanation"><summary>How recipes work</summary><p>Each champion uses three distinct defenders at the exact stated ranks. Ordinary recipes can use retained defenders. Current recruits remain provisional until a legal Keep, Merge or Recruit champion action. Secret recipes use this round’s exact draw identities.</p><p>✓ Built is retained ownership. ◆ This round is a revealed candidate. ○ Missing is a requirement, not a prediction of an upcoming draw. A ready component champion covers its ingredient subtree; each actual defender is allocated once.</p><p>Pin a goal for construction planning. Pinning and inspection spend no Command Points, draw rolls or ingredients.</p></details></div><div class="catalog-basics-view" hidden>${defenderGuide(data,images,{championsIntro:false,compact:true})}</div></section>`;
}

export function connectChampionCatalog(host,game,data=game.data,images={}, {state={},onDetail=()=>{}}={}){
  const catalog=host.querySelector('.champion-catalog')||host,defaults=championCatalogDefaults();
  for(const [key,value]of Object.entries(defaults))if(state[key]===undefined)state[key]=value;
  let model=championCatalogModel(game,data,state),disposed=false,detailKey=null;
  const savedDisclosures=new Map(Object.entries(state.disclosures||{}));
  const saveDetails=()=>{for(const details of catalog.querySelectorAll('[data-catalog-disclosure]'))savedDisclosures.set(details.dataset.catalogDisclosure,details.open);state.disclosures=Object.fromEntries(savedDisclosures);};
  const restoreDetails=()=>{for(const details of catalog.querySelectorAll('[data-catalog-disclosure]'))if(savedDisclosures.has(details.dataset.catalogDisclosure))details.open=savedDisclosures.get(details.dataset.catalogDisclosure);};
  const view=()=>{
    const basics=state.view==='basics';catalog.querySelector('.catalog-champions-view').hidden=basics;catalog.querySelector('.catalog-basics-view').hidden=!basics;catalog.querySelector('.catalog-status-filters').hidden=basics;
    for(const button of catalog.querySelectorAll('[data-catalog-view]'))button.setAttribute('aria-pressed',String(button.dataset.catalogView===state.view));
    for(const button of catalog.querySelectorAll('[data-catalog-status]'))button.setAttribute('aria-pressed',String(button.dataset.catalogStatus===state.status));
    catalog.querySelector('[data-catalog-search]').placeholder=basics?'Search basic defender names':'Search champion names';
  };
  const renderDetail=({focus=false}={})=>{
    const row=model.rows.find(row=>row.recipe.id===state.recipeId&&row.matches);
    if(!row)state.recipeId=null;
    const pane=catalog.querySelector('.catalog-recipe-detail'),layout=catalog.querySelector('.catalog-recipe-layout'),scroll=pane.scrollTop,focused=host.ownerDocument?.activeElement;
    const focusAction=pane.contains?.(focused)?focused.closest?.('[data-action]')?.dataset.action:null;
    saveDetails();pane.hidden=!row;layout.classList.toggle('has-detail',!!row);
    const next=row?detailMarkup(row,game,data,images):'';
    if(pane.innerHTML!==next)pane.innerHTML=next;
    restoreDetails();pane.scrollTop=detailKey===row?.recipe.id?scroll:0;detailKey=row?.recipe.id||null;
    for(const button of catalog.querySelectorAll('[data-catalog-recipe]'))button.setAttribute('aria-pressed',String(button.dataset.catalogRecipe===state.recipeId));
    onDetail?.(pane);
    if(focus)pane.querySelector('[data-catalog-detail-close]')?.focus({preventScroll:true});
    else if(focusAction)pane.querySelector(`[data-action="${focusAction}"]`)?.focus({preventScroll:true});
  };
  let filters;
  const updateModel=()=>{model=championCatalogModel(game,data,state);};
  const afterApply=()=>{view();renderDetail();};
  restoreDetails();
  filters=connectRecipeFilters(catalog,data,{state,profileScope:()=>state.view==='basics'?'basics':'champions',matchCard:card=>model.rows.find(row=>row.recipe.id===card.dataset.catalogRecipe)?.matches!==false,onApply:afterApply});
  const input=event=>{if(event.target?.matches?.('[data-catalog-search]')){state.query=event.target.value;updateModel();filters.apply();}};
  const change=event=>{if(event.target?.dataset.recipeFilter){updateModel();filters.apply();}};
  const click=event=>{
    const recipeButton=event.target.closest?.('[data-catalog-recipe]'),viewButton=event.target.closest?.('[data-catalog-view]'),statusButton=event.target.closest?.('[data-catalog-status]'),close=event.target.closest?.('[data-catalog-detail-close]');
    if(recipeButton&&!recipeButton.hidden){state.recipeId=recipeButton.dataset.catalogRecipe;updateModel();renderDetail({focus:true});}
    else if(viewButton){state.view=viewButton.dataset.catalogView;view();updateModel();filters.apply();}
    else if(statusButton){state.status=statusButton.dataset.catalogStatus;updateModel();filters.apply();}
    else if(close){const id=state.recipeId;state.recipeId=null;renderDetail();[...catalog.querySelectorAll('[data-catalog-recipe]')].find(button=>button.dataset.catalogRecipe===id)?.focus({preventScroll:true});}
    else if(event.target.closest?.('[data-recipe-filter-reset]')){updateModel();filters.apply();}
  };
  catalog.addEventListener('input',input);catalog.addEventListener('change',change);catalog.addEventListener('click',click);
  view();renderDetail();
  return {state,refresh(){if(disposed)return false;saveDetails();updateModel();for(const button of catalog.querySelectorAll('[data-catalog-recipe]')){const row=model.rows.find(row=>row.recipe.id===button.dataset.catalogRecipe);if(!row)continue;button.classList.toggle('available',row.available);const progress=button.querySelector('em');if(progress)progress.textContent=progressText(row.counts);const performance=button.querySelector('small');if(performance)performance.textContent=championPerformanceSummary(row.stats);}filters.apply();return true;},dispose(){saveDetails();disposed=true;filters.dispose();catalog.removeEventListener('input',input);catalog.removeEventListener('change',change);catalog.removeEventListener('click',click);}};
}
