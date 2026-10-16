import {recipesUsing,recipeFamily,recipeTier,recipeLabel,recipeTreeProgress,rankLabel} from '../game/core/recipes.js';
import {abilityLines,damageTypeName,formatTowerNumber} from './grimoire.js';
import {effectDamageType} from '../game/core/combat-rules.js';
import {recipeDisplayInventory} from './recipe-navigation.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const portrait=(family,tier,data,images)=>images[`${family}:${tier}`]||(data.towers[family]?.advanced?images[family]:null);

export function preparationEffects(stats){
  const aura=stats.burnAura?`${formatTowerNumber(stats.burnAura)} ${damageTypeName(effectDamageType(stats,'burn'))} fire damage/s within ${stats.range} tiles`:null;
  const lines=abilityLines(stats).map((line,index)=>stats.type==='holy'&&index===0?'Holy damage ignores immunities':line===aura?`${formatTowerNumber(stats.burnAura)} ${damageTypeName(effectDamageType(stats,'burn'))} aura damage/s per enemy within ${stats.range} tiles`:line.replace(/\b(physical|magical|holy)\b/g,type=>damageTypeName(type)));
  if(lines.length===1&&lines[0]==='Single-target attack')return ['Targets 1 · No additional status effect.'];
  if(lines.length===1&&lines[0]==='Ground targets only')return ['Targets 1 · Ground only · No additional status effect.'];
  return lines;
}

// Comparison changes a displayed profile, never the actual recipe ingredient.
// The existing allocator is the authority for each retained/revealed identity.
export function preparationRecipeModel(game,tower,{selectedRecipeId=null}={}){
  const available=new Set(game.selected===tower.id?game.availableRecipes(tower).map(recipe=>recipe.id):[]);
  const options=recipesUsing(tower,game.recipes).map(recipe=>{
    const tree=recipeTreeProgress(recipe,recipeDisplayInventory(game,recipe),game.data);
    const rows=tree.map(node=>({...node,name:game.data.towers[node.family].name,state:node.ownedCount?'built':node.draftCount?'draft':'missing'}));
    const counts={built:rows.filter(row=>row.state==='built').length,draft:rows.filter(row=>row.state==='draft').length,missing:rows.filter(row=>row.state==='missing').length};
    const canPreview=available.has(recipe.id);
    const status=canPreview?'Ready to preview':counts.missing?'Missing ingredients':game.commandMove.active?'Finish or cancel Move':game.phase==='build'?'Place all five recruits':'Not currently available';
    return {recipe,rows,counts,canPreview,status};
  });
  return {options,selected:options.find(option=>option.recipe.id===selectedRecipeId)||options[0]||null};
}

export function preparationRecipesMarkup(game,tower,images={},options={}){
  const model=preparationRecipeModel(game,tower,options),selected=model.selected;
  const detailId=`folio-recipe-detail-${tower.id}`;
  const rows=model.options.map(option=>{
    const recipe=option.recipe,family=recipeFamily(recipe),src=portrait(family,recipeTier(recipe),game.data,images),active=recipe.id===selected?.recipe.id;
    return `<button type="button" id="folio-option-${tower.id}-${escape(recipe.id)}" class="folio-recipe-row ${active?'active':''}" data-action="folio-recipe" data-id="${escape(recipe.id)}" aria-expanded="${active}" aria-controls="${detailId}">${src?`<img src="${escape(src)}" alt="" draggable="false">`:''}<span><strong>${escape(recipeLabel(recipe,game.data))}</strong><small>${escape(option.status)}</small></span><span class="folio-recipe-chevron" aria-hidden="true">${active?'⌃':'⌄'}</span></button>`;
  }).join('');
  const ingredients=selected?.rows.map(row=>{
    const src=portrait(row.family,row.tier,game.data,images),state=row.state==='built'?'Built':row.state==='draft'?'This round':'Missing';
    return `<li class="folio-ingredient ${row.state}">${src?`<img src="${escape(src)}" alt="" draggable="false">`:''}<span><strong>${escape(row.name)} · ${rankLabel(row.tier)}</strong><small>${state}</small></span></li>`;
  }).join('');
  const detail=selected?`<section class="folio-recipe-detail" id="${detailId}" data-recipe-id="${escape(selected.recipe.id)}" aria-label="${escape(recipeLabel(selected.recipe,game.data))} ingredients"><h4>${escape(recipeLabel(selected.recipe,game.data))}</h4>${selected.recipe.currentRoundOnly?'<p class="folio-recipe-rule">Secret recipe · Exact ingredients from this round only.</p>':''}<ul class="folio-ingredients">${ingredients}</ul><button type="button" id="folio-preview-${tower.id}-${escape(selected.recipe.id)}" class="text-button folio-preview-combination" data-action="craft-preview" data-id="${escape(selected.recipe.id)}" ${selected.canPreview?'':'disabled'}>Preview combination</button>${selected.canPreview?'':`<p class="folio-recipe-reason">${escape(selected.status)}</p>`}</section>`:'';
  return `<section class="folio-recipes potential-combinations" aria-label="Potential combinations"><h3>Potential combinations (${model.options.length})</h3><p class="folio-recipe-rank">${game.data.towers[tower.family].advanced?'Fixed champion recipes':`Actual rank ${rankLabel(tower.tier)} recipes`}</p><div class="folio-recipe-list">${rows||'<p>No recipe uses this actual rank.</p>'}</div>${detail}</section>`;
}
