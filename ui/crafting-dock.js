import {recipeFamily,recipeTier,recipeLabel,rankLabel,recipeTreeProgress} from '../game/core/recipes.js';
import {championClassification} from '../game/render/champion-classification.js';
import {eligibleDrawKeeper,drawKeeperKey,mergeTowerKey} from './draft-input.js';
import {icon} from './icons.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gameIds=new WeakMap();let nextGameId=1;
const construction=game=>['build','select','ready','reward'].includes(game.phase);
const findRecipe=(game,id)=>typeof id==='object'&&id?game.recipes.find(recipe=>recipe.id===id.id):game.recipes.find(recipe=>recipe.id===id);
const unitLabel=(tower,data)=>`${data.towers[tower.family].name} ${rankLabel(tower.tier)}`;
const walk=nodes=>nodes.flatMap(node=>[node,...walk(node.children)]);

// Planning can show a revealed candidate before commitment becomes legal. Its
// identity must still belong to a real, placed draw from this exact round.
export function recipePlanningInventory(game,recipe){
  if(!recipe||!construction(game))return [];
  const candidates=new Set();
  if(!game.draft.resolved&&['build','select'].includes(game.phase))for(const draw of game.draft.draws){
    if(!draw.placed||draw.reservedForNextDraft)continue;
    const tower=game.towers.find(t=>t.id===draw.towerId&&t.state==='draft'&&t.round===game.round&&t.placed!==false);
    if(tower)candidates.add(tower);
  }
  return game.towers.filter(t=>t.placed!==false&&(t.state==='active'&&!recipe.currentRoundOnly||candidates.has(t)));
}

function recipePlan(game,recipe){
  if(!recipe)return null;
  const inventory=recipePlanningInventory(game,recipe),tree=recipeTreeProgress(recipe,inventory,game.data);
  const rows=tree.map(node=>({...node,name:unitLabel(node,game.data),state:node.ownedCount?'built':node.draftCount?'draft':'missing'}));
  const counts={built:rows.filter(row=>row.state==='built').length,draft:rows.filter(row=>row.state==='draft').length,missing:rows.filter(row=>row.state==='missing').length};
  const highlightIds=new Set(game.commandMove.active?[]:walk(tree).filter(node=>node.draftCount&&node.towerId!==null&&!node.coveredBy).map(node=>node.towerId));
  return {recipe,name:recipeLabel(recipe,game.data),family:recipeFamily(recipe),tier:recipeTier(recipe),tree,rows,counts,inventory,highlightIds};
}

// Use the existing recursive allocator, including champion-subtree coverage and
// duplicate requirements. A merely matching surplus recruit is not highlighted.
export function pinnedRecipeHighlightIds(game,recipe=game.pinned){
  return recipePlan(game,findRecipe(game,recipe))?.highlightIds||new Set();
}

// A button is bound to its selected foundation, recipe, phase and full physical
// inventory. No selection, draw, resource or random state is changed by a key.
export function craftRecipeKey(game,recipeId,anchorId=game.selected){
  if(anchorId!==game.selected)return null;
  const anchor=game.towers.find(t=>t.id===anchorId),recipe=game.availableRecipes(anchor).find(r=>r.id===recipeId);
  if(!anchor||!game.canCombine(anchor)||!recipe)return null;
  const pieces=game.recipePieces(recipe,anchor);if(!pieces)return null;
  if(!gameIds.has(game))gameIds.set(game,nextGameId++);
  return encodeURIComponent(JSON.stringify([gameIds.get(game),game.round,game.phase,game.selected,game.previewRecipeId??null,
    recipe.id,recipe.ingredients,recipe.level,!!recipe.currentRoundOnly,game.economy.level,!!game.commandMove.active,
    pieces.map(t=>t.id),game.draft.resolved,game.draft.rerollsUsed||0,game.draft.reserveSelection?.index??null,
    game.towers.map(t=>[t.id,t.family,t.tier,t.state,t.round,t.x,t.z,t.mvpLevel||0,t.kills||0,t.placed!==false]),
    game.draft.draws.map(draw=>[draw.towerId??null,!!draw.placed,!!draw.reservedForNextDraft,!!draw.fixedPosition,draw.origin,!!draw.protectedFromReroll])]));
}

export function craftRecipeFromDock(game,recipeId,anchorId,expectedKey){
  if(!expectedKey||game.selected!==anchorId||craftRecipeKey(game,recipeId,anchorId)!==expectedKey)return false;
  return game.craft(recipeId);
}

function unavailableReason(game,plan){
  if(!plan)return '';
  if(game.commandMove.active)return 'Finish or cancel Move first.';
  if(!construction(game))return 'Recruit champions between waves.';
  if(game.economy.level<plan.recipe.level)return `Kingdom level ${plan.recipe.level} required.`;
  const missing=plan.rows.filter(row=>row.state==='missing').map(row=>row.name);
  const reasons=[];
  if(missing.length)reasons.push(`Missing ${missing.join(', ')}.`);
  if((plan.counts.draft||plan.recipe.currentRoundOnly)&&game.phase==='build')reasons.push('Place all five recruits first.');
  if(!missing.length&&!reasons.length)reasons.push('Select an eligible ingredient as the result foundation.');
  return reasons.join(' ');
}

export function craftingDockModel(game,{recipeId=null,anchorId=game.selected}={}){
  const available=anchorId===game.selected?game.availableRecipes(game.selection):[];
  const recipe=recipeId?available.find(r=>r.id===recipeId):available.find(r=>r.id===game.previewRecipeId)||available.find(r=>r.id===game.pinned)||available[0];
  let context=null;
  if(recipe){
    const anchor=game.selection,pieces=game.recipePieces(recipe,anchor),key=craftRecipeKey(game,recipe.id,anchor.id);
    if(pieces&&key){
      const draftUsed=pieces.some(t=>t.state==='draft');
      const discarded=draftUsed?game.roundCandidates.map(candidate=>candidate.tower).filter(t=>!pieces.includes(t)):[];
      const rows=pieces.map(t=>({family:t.family,tier:t.tier,count:1,name:unitLabel(t,game.data),state:t.state==='active'?'built':'draft',ownedCount:t.state==='active'?1:0,draftCount:t.state==='draft'?1:0,towerId:t.id}));
      const counts={built:rows.filter(row=>row.state==='built').length,draft:rows.filter(row=>row.state==='draft').length,missing:0};
      context={...recipePlan(game,recipe),tree:recipeTreeProgress(recipe,pieces,game.data),rows,counts,anchor,pieces,consumed:pieces.filter(t=>t.id!==anchor.id),discarded,draftUsed,key,alternatives:available};
    }
  }
  const pinned=recipePlan(game,findRecipe(game,game.pinned));
  const inspected=recipePlan(game,findRecipe(game,recipeId));
  const plan=context||inspected||pinned;
  const placed=game.draft.draws.slice(0,5).filter(draw=>draw.placed).length;
  const phaseText=game.phase==='build'?`Place recruits · ${placed}/5`:game.phase==='select'?'Choose your keeper · 5/5':game.phase==='ready'?'Ready':game.phase==='reward'?'Ready':game.phase==='combat'?'The siege is underway':game.phase==='won'?'Victory':'The keep has fallen';
  return {visible:construction(game)&&!!plan,phaseText,context,pinned,plan,reason:context?'':unavailableReason(game,plan),highlightIds:pinned?.highlightIds||new Set()};
}

const portrait=(plan,images,cls='')=>{
  const src=images[`${plan.family}:${plan.tier}`]||images[plan.family];
  return src?`<img class="${cls}" src="${escape(src)}" alt="${escape(plan.name)}" draggable="false">`:'';
};
const progressSummary=counts=>`✓ ${counts.built} built · ◆ ${counts.draft} this round · ○ ${counts.missing} missing`;
const statusGlyph=state=>state==='built'?'✓':state==='draft'?'◆':'○';
const statusText=state=>state==='built'?'Built':state==='draft'?'This round':'Missing';
function progressRows(plan,images){
  return `<ul class="crafting-ingredients" aria-label="Exact recipe ingredients">${plan.rows.map(row=>{
    const src=images[`${row.family}:${row.tier}`]||images[row.family];
    return `<li class="crafting-ingredient ${row.state}">${src?`<img src="${escape(src)}" alt="" draggable="false">`:''}<span class="crafting-ingredient-name">${escape(row.name)}</span><span class="crafting-ingredient-state"><b aria-hidden="true">${statusGlyph(row.state)}</b><span>${statusText(row.state)}<small>${row.ownedCount}/1 Built${row.draftCount?' +1 This round':''}</small></span></span></li>`;
  }).join('')}</ul>`;
}
function treeMarkup(plan,data){
  const node=p=>{
    const state=p.ownedCount?'built':p.draftCount?'draft':'missing',covered=p.coveredBy;
    const label=covered?`${covered.state==='active'?'✓':'◆'} Included in ${covered.state==='active'?'built':'this round’s'} ${data.towers[covered.family].name}`:`${statusGlyph(state)} ${statusText(state)}`;
    return `<li class="crafting-chain-node ${covered?'covered':state}"><div><span>${escape(unitLabel(p,data))}</span><small>${escape(label)}</small></div>${p.children.length?`<ul>${p.children.map(node).join('')}</ul>`:''}</li>`;
  };
  return `<details class="crafting-chain" data-crafting-disclosure="chain:${escape(plan.recipe.id)}"><summary data-crafting-focus="chain:${escape(plan.recipe.id)}">${icon('book')} Full ingredient chain</summary><p>A ready component champion covers its entire branch. Each defender is allocated once.</p><ul>${plan.tree.map(node).join('')}</ul></details>`;
}
const foundationLabel=t=>`(${t.x+1}, ${t.z+1})`;
function consequenceMarkup(context,data){
  const defender=t=>`${unitLabel(t,data)} · ${foundationLabel(t)}`;
  return `<section class="crafting-outcome" aria-label="Exact combination outcome"><p class="crafting-result">${icon('target')} <strong>Result here</strong> ${escape(defender(context.anchor))}</p><p><span aria-hidden="true">−</span> Consumed → wall: ${escape(context.consumed.map(defender).join('; '))}</p>${context.draftUsed?`<p><span aria-hidden="true">▧</span> Unchosen current recruits → walls: ${context.discarded.length?escape(context.discarded.map(defender).join('; ')):'None'}</p>`:'<p>This combination preserves the current draft.</p>'}</section>`;
}
function dockParts(game,images={},options={}){
  const model=craftingDockModel(game,options);if(!model.visible)return null;
  const {plan,context,pinned}=model,counts=plan.counts;
  const heading=context?'Combination available':pinned?.recipe.id===plan.recipe.id?'Pinned recipe':'Recipe preview';
  const summary=`${portrait(plan,images,'crafting-summary-portrait')}<span><strong>${heading} · ${escape(plan.name)}</strong><small>${progressSummary(counts)}</small></span><span class="crafting-disclosure-chevron" aria-hidden="true">⌄</span>`;
  const alternatives=context&&context.alternatives.length>1?`<div class="crafting-alternatives" role="group" aria-label="Available champion alternatives">${context.alternatives.map(r=>`<button type="button" class="text-button ${r.id===plan.recipe.id?'active':''}" data-action="craft-preview" data-id="${escape(r.id)}" data-crafting-focus="preview:${escape(r.id)}" aria-pressed="${r.id===plan.recipe.id}">${escape(recipeLabel(r,game.data))}</button>`).join('')}</div>`:'';
  const otherPinned=pinned&&pinned.recipe.id!==plan.recipe.id?`<div class="crafting-other-pinned">${portrait(pinned,images)}<span>Pinned · ${escape(pinned.name)}<small>${progressSummary(pinned.counts)}</small></span><button type="button" class="text-button" data-action="pin" data-id="${escape(pinned.recipe.id)}" data-crafting-focus="unpin:${escape(pinned.recipe.id)}">Unpin</button></div>`:'';
  const body=`<div class="crafting-champion">${portrait(plan,images,'crafting-champion-portrait')}<div><span class="eyebrow">${escape(championClassification(plan.family))} champion</span><h3>${escape(plan.name)}</h3><p>${escape(game.data.towers[plan.family].description)}</p></div></div>${alternatives}<p class="crafting-phase">${model.phaseText}</p>${plan.recipe.currentRoundOnly?'<p class="crafting-round-rule">Secret recipe · Exact ingredients from this round only.</p>':''}${progressRows(plan,images)}<p class="crafting-progress-total">${progressSummary(counts)}</p>${context?consequenceMarkup(context,game.data):''}${treeMarkup(plan,game.data)}`;
  const selected=game.selection,index=game.draft.draws.findIndex(draw=>draw.towerId===selected?.id),keeper=context&&eligibleDrawKeeper(game,index,selected?.id),mergeKey=context&&selected?mergeTowerKey(game,selected.id):null;
  const primary=context?`<button type="button" class="primary-button crafting-recruit" data-action="craft-dock" data-id="${escape(plan.recipe.id)}" data-tower-id="${context.anchor.id}" data-craft-key="${context.key}" data-crafting-focus="recruit:${escape(plan.recipe.id)}" aria-label="Recruit ${escape(plan.name)} at foundation ${foundationLabel(context.anchor)}">${icon('swords')} Recruit champion</button>`:`<button type="button" class="primary-button crafting-recruit" disabled>${icon('crown')} Recruit champion</button><p class="crafting-unavailable">${escape(model.reason)}</p>`;
  const actions=`${primary}<div class="crafting-secondary-actions">${keeper?`<button type="button" class="text-button" data-action="keep-draw" data-index="${index}" data-tower-id="${selected.id}" data-keeper-key="${drawKeeperKey(game,index)}" data-crafting-focus="keep:${selected.id}">${icon('shield')} Keep ${escape(game.data.towers[selected.family].name)}</button>`:''}${mergeKey?`<button type="button" class="text-button" data-action="merge-tower" data-tower-id="${selected.id}" data-merge-key="${mergeKey}" data-crafting-focus="merge:${selected.id}">${icon('spark')} Merge rank ${rankLabel(selected.tier+1)}</button>`:''}<button type="button" class="text-button" data-action="pin" data-id="${escape(plan.recipe.id)}" data-crafting-focus="pin:${escape(plan.recipe.id)}">${icon('pin')}${pinned?.recipe.id===plan.recipe.id?'Unpin':'Pin recipe'}</button></div>`;
  return {summary,body,actions,pinnedGoal:otherPinned,open:options.open!==false,model};
}

export function craftingDockMarkup(game,images={},options={}){
  const parts=dockParts(game,images,options);
  return parts?`<div class="crafting-dock-pinned-goal">${parts.pinnedGoal}</div><details class="crafting-dock-disclosure" data-crafting-disclosure="dock" ${parts.open?'open':''}><summary class="crafting-dock-summary" data-crafting-focus="dock">${parts.summary}</summary><div class="crafting-dock-body">${parts.body}</div></details><div class="crafting-dock-actions">${parts.actions}</div>`:'';
}

const panelState=new WeakMap();
// Keep the native dock disclosure itself, remember nested choices and restore a
// replaced control by its semantic identity. Routine selection never reopens it.
export function updateCraftingDock(host,game,images={},options={}){
  let state=panelState.get(host);
  if(!state||state.game!==game){state={game,disclosures:new Map()};panelState.set(host,state);host.innerHTML='';}
  const oldDetails=[...(host.querySelectorAll?.('[data-crafting-disclosure]')||[])];
  oldDetails.forEach(details=>state.disclosures.set(details.dataset.craftingDisclosure,details.open));
  const focused=host.ownerDocument?.activeElement,focus=host.contains?.(focused)?focused?.dataset?.craftingFocus:null;
  const scroll=host.querySelector?.('.crafting-dock-body')?.scrollTop||0;
  const parts=dockParts(game,images,options);host.hidden=!parts;
  if(!parts)return false;
  let details=host.querySelector?.('.crafting-dock-disclosure'),changed=false;
  if(!details){host.innerHTML=craftingDockMarkup(game,images,options);details=host.querySelector?.('.crafting-dock-disclosure');changed=true;}
  const summary=host.querySelector?.('.crafting-dock-summary'),body=host.querySelector?.('.crafting-dock-body'),actions=host.querySelector?.('.crafting-dock-actions'),pinnedGoal=host.querySelector?.('.crafting-dock-pinned-goal');
  for(const [element,html]of [[summary,parts.summary],[body,parts.body],[actions,parts.actions],[pinnedGoal,parts.pinnedGoal]])if(element&&element.innerHTML!==html){element.innerHTML=html;changed=true;}
  for(const element of host.querySelectorAll?.('[data-crafting-disclosure]')||[])if(state.disclosures.has(element.dataset.craftingDisclosure))element.open=state.disclosures.get(element.dataset.craftingDisclosure);
  if(body)body.scrollTop=scroll;
  if(focus){const target=[...(host.querySelectorAll?.('[data-crafting-focus]')||[])].find(element=>element.dataset.craftingFocus===focus&&!element.disabled)||summary;if(target!==focused)target?.focus?.({preventScroll:true});}
  return changed;
}
