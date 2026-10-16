import {towerStats} from '../game/core/math.js';
import {rankColor} from '../game/render/ranks.js';
import {rankLabel,recipeFamily,recipeTier,recipeLabel,recipeProgress,expandedRecipeProgress,recipeTreeProgress} from '../game/core/recipes.js';
import {displayDefenderCode as defenderCode} from './recipe-navigation.js';
import {championClassification} from '../game/render/champion-classification.js';
import {builtTowerCount} from '../game/core/warband-info.js';
import {effectDamageType} from '../game/core/combat-rules.js';
import {ENEMY_RULES} from '../game/core/enemy-rules.js';
import {icon} from './icons.js';
import {recipeIngredientPresentation} from './recipe-navigation.js';
export const ROMAN=['I','II','III','IV','V','VI'];
export const BASE_DPS_NOTE='Base DPS is damage per hit ÷ attack interval for one target, before armor or damage immunity. It excludes critical hits, poison, auras, extra targets and ally bonuses.';
export const baseAttackDps=s=>s.interval>0&&Number.isFinite(s.damage)&&Number.isFinite(s.interval)?s.damage/s.interval:0;
export const formatTowerNumber=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n);
export const damageTypeName=type=>({physical:'Physical',magical:'Magical',holy:'Holy'}[type]||type);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Runtime channels remain separate: an aura is not a direct attack, poison is
// per successful hit, and multiple targets do not form a universal DPS score.
export function championPerformanceSummary(stats){
  const parts=[];
  if(stats.burnAura)parts.push(`Aura DPS ${formatTowerNumber(stats.burnAura)}/s · ${damageTypeName(effectDamageType(stats,'burn'))}`);
  if(stats.damage>0&&stats.interval>0)parts.push(`Direct DPS ${formatTowerNumber(baseAttackDps(stats))}${stats.multishot?` per target · ${stats.multishot} targets`:''}`);
  else if(stats.burnAura)parts.push('No direct attack');
  if(stats.poisonDps||stats.poison)parts.push(`Poison ${formatTowerNumber(stats.poisonDps||stats.damage*stats.poison)}/s per hit · 5s`);
  if(!parts.length)parts.push('Ally support · No direct attack');
  return parts.join(' · ');
}
export function runtimeDefenderDescription(stats,{family}={}){
  if(family==='mage'&&stats.cleave)return `${damageTypeName(stats.type)} attacks with ${Math.round(stats.cleave*100)}% ${damageTypeName(stats.cleaveType||stats.type)} cleave to other enemies within ${formatTowerNumber(stats.cleaveRadius)} tiles.`;
  return stats.description||'';
}
const performanceStatsMarkup=(stats,directLabel=false)=>stats.burnAura&&!(stats.damage>0)?`<dl class="recipe-stat-grid aura-performance"><div><dt>Aura DPS</dt><dd>${formatTowerNumber(stats.burnAura)}/s</dd></div><div><dt>Damage type</dt><dd>${damageTypeName(effectDamageType(stats,'burn'))}</dd></div><div><dt>Direct attack</dt><dd>None</dd></div><div><dt>Range</dt><dd>${formatTowerNumber(stats.range)}</dd></div></dl>`:`<dl class="recipe-stat-grid"><div><dt>Damage / hit</dt><dd>${formatTowerNumber(stats.damage)}</dd></div><div><dt>${directLabel?'Base direct DPS':'Base DPS'}</dt><dd>${formatTowerNumber(baseAttackDps(stats))}</dd></div><div><dt>Interval</dt><dd>${formatTowerNumber(stats.interval)}s</dd></div><div><dt>Range</dt><dd>${formatTowerNumber(stats.range)}</dd></div></dl>`;
export const basicIngredientLabel=(p,data)=>`${p.count}×${defenderCode(data.towers[p.family],p.tier)}`;
export function abilityLines(s){
  const parts=[];
  if(s.type==='holy')parts.push('Holy damage ignores damage immunities; companion slows/freezes respect Physical immunity and poison/burning/healing block respect Magical immunity; armor, evasion, shields and shells still apply');
  if(s.melee)parts.push('Ground targets only');
  if(s.poisonDps||s.poison)parts.push(`${formatTowerNumber(s.poisonDps||s.damage*s.poison)} ${damageTypeName(effectDamageType(s,'poison'))} poison damage/s per successful hit; each hit adds an independent 5s stack`);
  if(s.burnDps||s.burn)parts.push(`${formatTowerNumber(s.burnDps||s.damage*s.burn)} ${damageTypeName(effectDamageType(s,'burn'))} burning damage/s for ${s.dotDuration||3}s; strongest burn applies`);
  if(s.shred)parts.push(`−${s.shred} enemy armor · 4s`);
  if(s.spreadEffect)parts.push(`Unmarked targets first; then selected priority`);
  if(s.armorShredAura)parts.push(`−${s.armorShredAura} enemy armor aura · ${s.effectRange??s.range} tiles`);
  if(s.antiAirShred)parts.push(`Flying targets: −${s.antiAirShred} armor · ${Math.round(s.antiAirSlow*100)}% slow · ${s.slowDuration||3}s (armor reduction lasts 4s)`);
  else if(s.antiAirSlow)parts.push(`Flying targets: ${Math.round(s.antiAirSlow*100)}% slow`);
  if(s.freeze)parts.push(`${Math.round(s.freeze*100)}% stun chance · ${s.freezeDuration||.8}s (half duration on warlords)${s.stunRecovery?` · ${s.stunRecovery}s recovery`:''}`);
  if(s.trueStrike)parts.push('Ignores evasion');
  if(s.slow)parts.push(`${Math.round(s.slow*100)}% movement slow for ${s.slowDuration||2}s${s.effectsRadius?` · also within ${s.effectsRadius} tiles of the target`:''}`);
  if(s.cleave)parts.push(`${Math.round(s.cleave*100)}% ${s.cleaveType||s.type} splash · ${formatTowerNumber(s.damage*s.cleave)} damage to other enemies within ${s.cleaveRadius} tiles`);
  if(s.multishot)parts.push(`${s.multishot} simultaneous targets; ${formatTowerNumber(s.damage)} damage per target`);
  const auraRange=s.aura?.range;
  if(s.aura?.haste)parts.push(`+${Math.round(s.aura.haste*100)}% ally attack speed within ${auraRange} tiles; ${s.aura.stackKey==='otomad'?'separate Archbishop blessing adds to the strongest standard blessing; multiple Archbishops do not stack':'strongest standard blessing applies'}`);
  const chants=Object.values(s.aura?.hasteGroups||{});
  if(chants.length)parts.push(`Attack-speed chants: ${chants.map(n=>`+${Math.round(n*100)}%`).join(' and ')} for allies within ${auraRange} tiles; combine to +${Math.round(chants.reduce((a,b)=>a+b,0)*100)}%; matching chants do not stack`);
  if(s.aura?.damageBonus)parts.push(`+${Math.round(s.aura.damageBonus*100)}% ally damage within ${auraRange} tiles; strongest bonus applies`);
  if(s.aura?.rangeBonus)parts.push(`+${formatTowerNumber(s.aura.rangeBonus)} ally range within ${auraRange} tiles; strongest bonus applies`);
  if(s.aura?.trueStrike)parts.push(`Allies ignore evasion within ${auraRange} tiles`);
  if(s.aura?.controlResistance)parts.push(`${Math.round(s.aura.controlResistance*100)}% protection from disarm and dread for allies within ${auraRange} tiles`);
  if(s.burnAura)parts.push(`${formatTowerNumber(s.burnAura)} ${damageTypeName(effectDamageType(s,'burn'))} fire damage/s within ${s.range} tiles`);
  if(s.slowAura)parts.push(`${Math.round(s.slowAura*100)}% movement slow aura within ${s.range} tiles`);
  if(s.critChance)parts.push(`${Math.round(s.critChance*100)}% chance of ×${s.critMultiplier} damage`);
  if(s.chain)parts.push(`${Math.round((s.chainChance||1)*100)}% chance of lightning hitting ${s.chain} other enemies within ${s.chainRange||4} tiles${s.chainSequential?' per jump':''}; ${formatTowerNumber(s.chainDamage||s.damage*.55)} ${damageTypeName(s.type)} damage each`);
  if(s.forkedTargets)parts.push(`${Math.round((s.forkedChance||1)*100)}% forked lightning · ${s.forkedTargets} targets within ${s.forkedRange||10} tiles · ${formatTowerNumber(s.forkedDamage)} ${damageTypeName(effectDamageType(s,'lightning'))} damage each`);
  if(s.melancholyChance)parts.push(`${Math.round(s.melancholyChance*100)}% Melancholy at attack start: cancels the attack and stops this champion attacking for ${s.melancholyDuration||5}s`);
  if(s.bouncingFrost)parts.push(`${Math.round((s.bouncingFrostChance||1)*100)}% chance of ${s.bouncingFrost} frost bounces · ${formatTowerNumber(s.bouncingFrostDamage||s.damage)} ${damageTypeName(effectDamageType(s,'frost'))} damage each · up to ${s.bouncingFrostRange||10} tiles per bounce${s.bouncingFrostTrigger==='nearby-ally-magic-hit'?` · triggered by allied Magical or Holy hits within ${s.bouncingFrostTriggerRange||6} tiles; own attacks do not trigger`:''}`);
  if(s.recoverChance)parts.push(`${Math.round(s.recoverChance*100)}% chance to restore ${s.recoverLives} keep health`);
  if(s.goldChance)parts.push(`${Math.round(s.goldChance*100)}% chance to recover ${s.goldMin}–${s.goldMax} gold`);
  if(s.stoneGazeChance)parts.push(`${Math.round(s.stoneGazeChance*100)}% Stone Gaze lasting ${s.stoneGazeDuration||6}s within ${s.stoneGazeRange||10} tiles · ${Math.round((s.stoneGazeSlow||.8)*100)}% slow; face the golem ${s.stoneGazeFacingTime||2}s to petrify for ${s.petrifyDuration||3}s · +${Math.round((s.petrifyPhysicalBonus??1)*100)}% physical damage taken${s.petrifyIgnoresImmunity?' · petrification ignores damage immunities; its Physical damage is still blocked by Physical immunity':''}`);
  if(s.healingBlockDuration)parts.push(`Prevents healing for ${s.healingBlockDuration}s`);
  if(s.burnedChance)parts.push(`${Math.round(s.burnedChance*100)}% chance of ×${s.burnedMultiplier} fire splash · ${formatTowerNumber(s.damage*s.burnedMultiplier)} ${damageTypeName(effectDamageType(s,'burn'))} damage within ${s.burnedRadius} tiles`);
  const detectionRange=s.detectionRange||(!s.advanced&&s.unitCode==='C'?ENEMY_RULES.reveal.clericRadius:0);
  if(detectionRange)parts.push(`Reveals hidden enemies within ${detectionRange} tiles`);
  return parts.length?parts:['Single-target attack'];
}
export const abilityText=s=>abilityLines(s).join(' · ');
export function ingredientName(p,data){const stats=data.towers[p.family];return stats.advanced?`${rankLabel(p.tier)} · ${stats.name}`:`${defenderCode(stats,p.tier)} · ${stats.name}`;}
export function recipeIngredientLabel(piece,data,{interactive=false,scope='catalog'}={}){
  const {name,rank,code,recipeId}=recipeIngredientPresentation(piece,data);
  const label=`<span class="recipe-ingredient-name">${escape(name)}</span> <span class="recipe-ingredient-rank">${escape(rank)}</span>${code?` <span class="recipe-ingredient-code">(${escape(code)})</span>`:''}`;
  return interactive&&recipeId?`<button type="button" class="recipe-ingredient-link" ${scope==='catalog'?`data-catalog-ingredient="${escape(recipeId)}"`:`data-action="recipe-explore" data-id="${escape(recipeId)}" data-crafting-focus="ingredient:${escape(recipeId)}"`} aria-label="Explore ${escape(name)} recipe">${label}<span aria-hidden="true"> ›</span></button>`:`<span class="recipe-ingredient-label">${label}</span>`;
}
function exactIngredientRows(progress,data,images){
  return progress.map(piece=>{
    const src=images[`${piece.family}:${piece.tier}`]||images[piece.family],state=piece.owned?'Built':piece.draft?'This round':'Missing';
    return `<li class="recipe-ingredient-row ${piece.owned?'owned':piece.draft?'draft-available':'missing'}">${src?`<img class="recipe-ingredient-portrait" src="${escape(src)}" alt="" draggable="false">`:''}${recipeIngredientLabel(piece,data,{interactive:true})}<span class="recipe-ingredient-status ${piece.owned?'owned-progress':piece.draft?'draft-progress':'missing-progress'}"><span aria-hidden="true">${piece.owned?'✓':piece.draft?'◆':'○'}</span> ${state}</span></li>`;
  }).join('');
}
export const recipeProgressLegend=()=>`<div class="recipe-progress-heading"><span class="owned-progress">Built</span><span class="draft-progress">This round</span></div>`;
export function basicRecipeBreakdown(recipe,data,towerList){
  return `<ul class="pinned-basics">${expandedRecipeProgress(recipe,towerList,data).map(p=>`<li class="${p.ownedCount===p.count?'owned':p.draftCount?'draft-available':''}" data-family="${p.family}" data-tier="${p.tier}"><span><b>${basicIngredientLabel(p,data)}</b><small>${data.towers[p.family].name}</small></span><span class="pinned-progress"><b class="${p.ownedCount?'owned-progress':''}">${p.ownedCount}/${p.count}</b>${p.draftCount?`<small class="draft-progress">+${p.draftCount} this round</small>`:''}</span></li>`).join('')}</ul>`;
}
export function recipeIngredientTree(recipe,data,towerList,{interactive=false}={}){
  const label=p=>data.towers[p.family].advanced?`${p.count}×${data.towers[p.family].name} · ${rankLabel(p.tier)}`:basicIngredientLabel(p,data);
  const progress=p=>p.coveredBy?`<span class="recipe-tree-covered ${p.coveredBy.state==='active'?'owned-progress':'draft-progress'}">${p.coveredBy.state==='active'?'✓':'◆'} Included in ${p.coveredBy.state==='active'?'built':'this round’s'} ${data.towers[p.coveredBy.family].name}</span>`:`<span class="pinned-progress"><b class="${p.ownedCount?'owned-progress':''}">${p.ownedCount}/${p.count} built</b>${p.draftCount?`<small class="draft-progress">+${p.draftCount} this round</small>`:''}</span>`;
  const node=(p,root=false)=>`<li class="recipe-tree-node ${p.ownedCount?'owned':p.draftCount?'draft-available':p.coveredBy?'covered':''}" data-family="${p.family}" data-tier="${p.tier}"><div class="recipe-tree-row"><span class="recipe-tree-label">${interactive&&data.towers[p.family].advanced?recipeIngredientLabel(p,data,{interactive:true}):`<b>${label(p)}</b>${!data.towers[p.family].advanced?`<small>${data.towers[p.family].name}</small>`:''}`}</span>${progress(p)}</div>${p.children.length?`${root?'<div class="recipe-tree-branch-heading">How to build this champion</div>':''}<ul class="recipe-tree-children">${p.children.map(child=>node(child)).join('')}</ul>`:''}</li>`;
  return `<div class="recipe-tree-heading">Combine these ${recipe.ingredients.length} ingredients</div>${recipe.currentRoundOnly?'<p class="recipe-round-rule">All three must be among this round’s five newly placed defenders. Select one of those ingredients; the other two candidates become walls.</p>':''}<ul class="recipe-tree">${recipeTreeProgress(recipe,towerList,data).map(p=>node(p,true)).join('')}</ul>`;
}
export function championRecipeActions(recipe,{pinned=false,craftable=false}={}){
  return `<div class="catalog-recipe-actions"><button type="button" class="text-button ${pinned?'recipe-pin':''}" data-action="pin" data-id="${recipe.id}">${icon('pin')}${pinned?'Unpin recipe':'Pin recipe'}</button>${craftable?`<button type="button" class="primary-button" data-action="craft" data-id="${recipe.id}">Recruit champion</button>`:''}</div>`;
}
export function championRecipeCard(recipe,data,images,{towerList=[],pinned=false,discovered=false,level=1,craftable=false,compact=false,combinationAvailable=null,builtCount=null,showActions=true}={}){
  const family=recipeFamily(recipe),stats=towerStats({family,tier:recipeTier(recipe)},data);
  const progress=recipeProgress(recipe,towerList),ready=progress.every(p=>p.available)&&level>=recipe.level&&(combinationAvailable===null?(!recipe.currentRoundOnly||craftable):combinationAvailable),ownedResults=builtCount??builtTowerCount(towerList,family);
  const abilities=abilityLines(stats);
  if(compact){
    const portrait=images[`${family}:${recipeTier(recipe)}`]||images[family];
    return `<article class="recipe-card compact-recipe-detail ${ready?'available':''}" data-family="${family}" data-recipe-id="${recipe.id}"><div class="catalog-champion-profile"><header class="catalog-champion-heading">${portrait?`<img src="${escape(portrait)}" alt="${escape(recipeLabel(recipe,data))}" draggable="false">`:''}<div><div class="eyebrow">${championClassification(family)} · ${ready?'Combination available':discovered?'Discovered':'Unforged'} · ${ownedResults} built</div><h3 tabindex="-1" data-catalog-detail-heading>${escape(recipeLabel(recipe,data))}</h3><p>${escape(championPerformanceSummary(stats))}</p></div></header>${performanceStatsMarkup(stats,true)}<p class="recipe-built"><strong>${ownedResults}</strong> built</p></div><section class="catalog-effects" aria-label="Abilities and description"><p>${escape(runtimeDefenderDescription(stats,{family}))}</p><div class="recipe-ability-heading">${damageTypeName(stats.type)} · Effects</div><ul class="recipe-effects">${abilities.map(line=>`<li>${line}</li>`).join('')}</ul><details data-catalog-disclosure="dps:${recipe.id}"><summary>About Base direct DPS</summary><p class="dps-explanation">${BASE_DPS_NOTE}</p></details></section><div class="recipe-ability-heading">Exact ingredients</div>${recipe.currentRoundOnly?'<p class="recipe-round-rule">Secret recipe · Three exact ingredients from this round only. Retained defenders cannot be used.</p>':''}<ul class="recipe-ingredients">${exactIngredientRows(progress,data,images)}</ul>${showActions?championRecipeActions(recipe,{pinned,craftable:ready&&craftable}):''}<details class="recipe-basic-breakdown" data-catalog-disclosure="chain:${recipe.id}"><summary>Full ingredient chain</summary>${recipeProgressLegend()}${recipeIngredientTree(recipe,data,towerList,{interactive:true})}<details class="recipe-basic-totals" data-catalog-disclosure="totals:${recipe.id}"><summary>Basic recruit totals</summary>${basicRecipeBreakdown(recipe,data,towerList)}</details></details></article>`;
  }
  return `<article class="recipe-card ${ready?'available':''}" data-family="${family}" data-recipe-id="${recipe.id}">
    <img src="${images[`${family}:${recipeTier(recipe)}`]||images[family]}" alt="${recipeLabel(recipe,data)}">
    <div class="recipe-summary"><div class="eyebrow">${championClassification(family).toUpperCase()} · ${ready?'COMBINATION AVAILABLE':discovered?'DISCOVERED':'UNFORGED'}</div><h3>${recipeLabel(recipe,data)}</h3><p>${stats.description}</p></div>
    <p class="recipe-built"><strong>${ownedResults}</strong> built</p>
    ${performanceStatsMarkup(stats)}
    <div class="recipe-ability-heading">${damageTypeName(stats.type)} · Effects</div><ul class="recipe-effects">${abilities.map(line=>`<li>${line}</li>`).join('')}</ul>
    <div class="recipe-ability-heading">Combine these ${recipe.ingredients.length} defenders</div>${recipe.currentRoundOnly?'<p class="recipe-round-rule">Secret recipe: all three ingredients must be in the same current round’s five defenders. Previously kept units cannot be used.</p>':''}<ul class="recipe-ingredients">${progress.map(p=>`<li class="${p.owned?'owned':p.draft?'draft-available':''}"><span>${p.owned?'✓':p.draft?'◆':'○'}</span>${ingredientName(p,data)}${p.draft?' <small class="draft-progress">this round</small>':''}</li>`).join('')}</ul>
    ${pinned?`<details class="recipe-basic-breakdown" open><summary>Full crafting chain</summary>${recipeProgressLegend()}${recipeIngredientTree(recipe,data,towerList)}<details class="recipe-basic-totals"><summary>Basic recruit totals</summary>${basicRecipeBreakdown(recipe,data,towerList)}</details></details>`:''}
    <button class="text-button ${pinned?'recipe-pin':''}" data-action="pin" data-id="${recipe.id}">${icon('pin')}${pinned?'Pinned':'Pin recipe'}</button>${ready&&craftable?` <button class="text-button gold" data-action="craft" data-id="${recipe.id}">Recruit champion</button>`:''}
  </article>`;
}
export function defenderGuide(data,images,{championsIntro=true,compact=false}={}){
  const explanation='<p>Physical, Magical and Holy damage all face armor. Magical immunity blocks Magical damage, poison, burning and healing block; Physical immunity blocks Physical damage, slowing and freezing. Only Holy damage ignores these immunities; companion effects retain their normal immunity categories. Evasion, shields and direct-hit shells still apply to all three types. Poison stacks independently for 5s per successful hit.</p><p>Open a defender to compare every rank. Ranks I–IV merge only matching recruits among the current round’s five placed candidates. Two same-family Royal V defenders create a Mythic VI between waves, including retained pairs or a retained defender plus a current candidate. Using a current candidate requires all five placements and commits this round’s keeper; a retained-only pair preserves the pending draft. Mythic units are earned through merging.</p>';
  return `<section class="defender-guide ${compact?'compact-defender-guide':''}"><h3>Eight defenders. Six ranks.</h3>${compact?`<details class="catalog-guide-explanation" data-catalog-disclosure="basic-explanation"><summary>How ranks and damage work</summary>${explanation}</details>`:explanation}<div class="defender-roster">${Object.entries(data.towers).filter(([,s])=>!s.advanced).map(([family,s])=>`<details class="defender-entry" data-filter-family="${family}" data-catalog-disclosure="basic:${family}"><summary><img src="${images[family]||''}" alt="${s.name}"><span><strong>${s.name}</strong><small>${defenderCode(s)}</small><em>${family==='mage'?'Magical cleave':s.role}</em></span></summary><p>${runtimeDefenderDescription(towerStats({family,tier:1},data),{family})}</p><div class="rank-scroll"><table><thead><tr><th>Rank</th><th>Damage</th><th>Base DPS</th><th>Interval</th><th>Range</th><th>Ability</th></tr></thead><tbody>${s.levels.map((_,i)=>{const t=towerStats({family,tier:i+1},data);return `<tr data-filter-tier="${i+1}"><td style="color:${rankColor(i+1)}"><img class="rank-mini" src="${images[`${family}:${i+1}`]||''}" alt="${s.name}, rank ${ROMAN[i]}">${defenderCode(s,i+1)}</td><td>${formatTowerNumber(t.damage)}</td><td>${formatTowerNumber(baseAttackDps(t))}</td><td>${formatTowerNumber(t.interval)}s</td><td>${t.range}</td><td>${abilityText(t)}</td></tr>`;}).join('')}</tbody></table></div></details>`).join('')}</div></section>${championsIntro?`<h3 class="recipe-title">Champion recipes</h3><p>${Object.values(data.towers).filter(s=>s.advanced).length} champions. Each recipe consumes exactly three defenders of the stated ranks. Secret champions require all three ingredients among the current round’s five new defenders; ordinary recipes can use previously retained units.</p><p class="dps-explanation">${BASE_DPS_NOTE}</p>`:''}`;
}
