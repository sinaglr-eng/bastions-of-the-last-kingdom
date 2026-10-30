import {offensiveAuraRange} from '../game/core/math.js';
import {recipesUsing,recipeFamily,recipeTier,recipeLabel,recipeTreeProgress,rankLabel} from '../game/core/recipes.js';
import {abilityLines,damageTypeName,formatTowerNumber} from './grimoire.js';
import {effectDamageType} from '../game/core/combat-rules.js';
import {recipeDisplayInventory,downstreamRecipes,recipeIngredientPresentation} from './recipe-navigation.js';
import {craftRecipeKey} from './crafting-dock.js';
import {icon} from './icons.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const portrait=(family,tier,data,images)=>images[`${family}:${tier}`]||(data.towers[family]?.advanced?images[family]:null);

export function preparationEffects(stats){
  const aura=stats.burnAura?`${formatTowerNumber(stats.burnAura)} ${damageTypeName(effectDamageType(stats,'burn'))} fire damage/s within ${offensiveAuraRange(stats,'burn')} tiles`:null;
  const lines=abilityLines(stats).map((line,index)=>!stats.factionProfile&&stats.type==='holy'&&index===0?'Holy damage ignores immunities':line===aura?`${formatTowerNumber(stats.burnAura)} ${damageTypeName(effectDamageType(stats,'burn'))} aura damage/s per enemy within ${offensiveAuraRange(stats,'burn')} tiles`:line.replace(/\b(physical|magical|holy)\b/g,type=>damageTypeName(type)));
  if(lines.length===1&&lines[0]==='Single-target attack')return ['Targets 1 · No additional status effect.'];
  if(lines.length===1&&lines[0]==='Ground targets only')return ['Targets 1 · Ground only · No additional status effect.'];
  return lines;
}

// The viewed profile chooses suggestions. Only the original physical defender
// and the existing allocator can authorize a real combination.
export function preparationRecipeModel(game,tower,{selectedRecipeId=null,displayedTower=tower,contextRecipeId=null,planningNavigation=null}={}){
  const navigation=planningNavigation?.sync(tower,displayedTower),inspectedRecipe=game.recipes.find(recipe=>recipe.id===navigation?.inspectedRecipeId)||null;
  if(navigation){selectedRecipeId=navigation.selectedRecipeId;contextRecipeId=navigation.contextRecipeId;}
  const contextRecipe=game.recipes.find(recipe=>recipe.id===contextRecipeId)||null;
  const subject=contextRecipe||inspectedRecipe?{family:recipeFamily(contextRecipe||inspectedRecipe),tier:recipeTier(contextRecipe||inspectedRecipe),state:'draft'}:{...displayedTower,state:tower.state};
  const hypothetical=subject.family!==tower.family||subject.tier!==tower.tier;
  const available=new Set(!hypothetical&&game.selected===tower.id?game.availableRecipes(tower).map(recipe=>recipe.id):[]);
  const options=(inspectedRecipe?[inspectedRecipe]:recipesUsing(subject,game.recipes)).map(recipe=>{
    const tree=recipeTreeProgress(recipe,recipeDisplayInventory(game,recipe),game.data);
    const rows=tree.map(node=>({...node,name:game.data.towers[node.family].name,state:node.ownedCount?'built':node.draftCount?'draft':'missing'}));
    const counts={built:rows.filter(row=>row.state==='built').length,draft:rows.filter(row=>row.state==='draft').length,missing:rows.filter(row=>row.state==='missing').length};
    const canPreview=available.has(recipe.id);
    const status=hypothetical?'Planning only':canPreview?'Ready to create':counts.missing?'Missing ingredients':game.commandMove.active?'Finish or cancel Move':game.phase==='build'?'Place all five recruits':'Not currently available';
    return {recipe,rows,counts,canPreview,status,downstream:downstreamRecipes(recipe,game.data)};
  });
  return {options,selected:options.find(option=>option.recipe.id===selectedRecipeId)||null,subject,contextRecipe,inspectedRecipe,hypothetical,canBack:!!navigation?.canBack};
}

export function preparationRecipesMarkup(game,tower,images={},options={}){
  const model=preparationRecipeModel(game,tower,options),selected=model.selected;
  const detailId=`folio-recipe-detail-${tower.id}`;
  const ingredients=selected?.rows.map(row=>{
    const src=portrait(row.family,row.tier,game.data,images),state=row.state==='built'?'Built':row.state==='draft'?'This round':'Missing',presentation=recipeIngredientPresentation(row,game.data);
    const label=presentation.recipeId?`<button type="button" class="folio-ingredient-link" data-action="folio-ingredient-recipe" data-id="${escape(presentation.recipeId)}" aria-label="Explore ${escape(row.name)} recipe">${escape(row.name)}<span aria-hidden="true">›</span></button>`:`<strong>${escape(row.name)} · ${rankLabel(row.tier)}</strong>`;
    return `<li class="folio-ingredient ${row.state}">${src?`<img src="${escape(src)}" alt="" draggable="false">`:''}<span>${label}<small>${state}</small></span></li>`;
  }).join('');
  const downstream=selected?`<section class="folio-downstream" aria-label="Combinations using ${escape(recipeLabel(selected.recipe,game.data))}"><h5>Combine ${escape(recipeLabel(selected.recipe,game.data))} further</h5>${selected.downstream.length?`<div>${selected.downstream.map(recipe=>`<button type="button" class="text-button" data-action="folio-champion-context" data-id="${escape(selected.recipe.id)}" data-recipe-id="${escape(recipe.id)}">${escape(recipeLabel(recipe,game.data))}<span aria-hidden="true">›</span></button>`).join('')}</div>`:'<p>No further combinations.</p>'}</section>`:'';
  const pinned=selected?.recipe.id===game.pinned;
  const detail=selected?`<section class="folio-recipe-detail" id="${detailId}" data-recipe-id="${escape(selected.recipe.id)}" aria-label="${escape(recipeLabel(selected.recipe,game.data))} ingredients"><header class="folio-recipe-detail-heading"><h4>${escape(recipeLabel(selected.recipe,game.data))}</h4><button type="button" class="text-button folio-recipe-pin ${pinned?'is-pinned':''}" data-action="pin" data-id="${escape(selected.recipe.id)}" aria-pressed="${pinned}">${icon('pin')} ${pinned?'Unpin':'Pin recipe'}</button></header>${selected.recipe.currentRoundOnly?'<p class="folio-recipe-rule">Secret recipe · Exact ingredients from this round only.</p>':''}<ul class="folio-ingredients">${ingredients}</ul>${model.hypothetical?'<p class="folio-recipe-reason">Planning view · Actual defender unchanged.</p>':''}${downstream}</section>`:'';
  const rows=model.options.map(option=>{
    const recipe=option.recipe,family=recipeFamily(recipe),src=portrait(family,recipeTier(recipe),game.data,images),active=recipe.id===selected?.recipe.id;
    return `<button type="button" id="folio-option-${tower.id}-${escape(recipe.id)}" class="folio-recipe-row ${active?'active':''}" data-action="folio-recipe" data-id="${escape(recipe.id)}" data-default-recipe-id="${escape(model.options[0]?.recipe.id||'')}" aria-expanded="${active}" aria-controls="${detailId}">${src?`<img src="${escape(src)}" alt="" draggable="false">`:''}<span><strong>${escape(recipeLabel(recipe,game.data))}</strong><small>${escape(option.status)}</small></span><span class="folio-recipe-chevron" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false"><path d="m4 6 4 4 4-4"/></svg></span></button>${active?detail:''}`;
  }).join('');
  const caption=model.inspectedRecipe?'Exact recipe requirements':model.contextRecipe?`Using ${recipeLabel(model.contextRecipe,game.data)}`:game.data.towers[model.subject.family].advanced?'Fixed champion recipes':`${model.hypothetical?'Viewed':'Actual'} rank ${rankLabel(model.subject.tier)} recipes`;
  return `<section class="folio-recipes potential-combinations" aria-label="${model.inspectedRecipe?'Champion recipe requirements':'Potential combinations'}" data-planning-rank="${model.subject.tier}" data-planning-family="${escape(model.subject.family)}"><h3 class="folio-combinations-heading">${model.inspectedRecipe?'Recipe requirements':`Potential combinations (${model.options.length})`}</h3>${model.canBack?'<button type="button" class="text-button folio-plan-back" data-action="folio-plan-back">‹ Back to previous recipe</button>':''}<p class="folio-recipe-rank">${escape(caption)}</p><div class="folio-recipe-list">${rows||'<p>No combination uses this defender at the viewed rank.</p>'}</div></section>`;
}

// These bottom-row actions are derived from the actual, selected foundation.
// Their identity key is rejected if the selection or physical inventory changes.
export function actualAvailableRecipeActionsMarkup(game,{displayedTower=game.selection}={}){
  const tower=game.selection;
  if(!tower||!displayedTower||tower.family!==displayedTower.family||tower.tier!==displayedTower.tier)return '';
  const buttons=game.availableRecipes(tower).map(recipe=>{
    const key=craftRecipeKey(game,recipe.id,tower.id);if(!key)return '';
    return `<button type="button" class="primary-button folio-create-champion" data-action="craft-dock" data-id="${escape(recipe.id)}" data-tower-id="${tower.id}" data-craft-key="${key}">${icon('crown')} Create ${escape(recipeLabel(recipe,game.data))}</button>`;
  }).join('');
  return buttons?`<div class="folio-create-actions" aria-label="Available champion combinations">${buttons}</div>`:'';
}
