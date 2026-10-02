import {towerStats} from '../game/core/math.js';
import {rankColor} from '../game/render/ranks.js';
import {rankLabel,recipeFamily,recipeTier,recipeLabel,recipeProgress,expandedRecipeProgress,recipeTreeProgress} from '../game/core/recipes.js';
import {defenderCode} from '../game/core/unit-label.js';
import {championClassification} from '../game/render/champion-classification.js';
import {builtTowerCount} from '../game/core/warband-info.js';
import {icon} from './icons.js';
export const ROMAN=['I','II','III','IV','V','VI'];
export const BASE_DPS_NOTE='Base DPS is damage per hit ÷ attack interval for one target, before armor or resistance. It excludes critical hits, poison, auras, extra targets and ally bonuses.';
export const baseAttackDps=s=>s.interval>0&&Number.isFinite(s.damage)&&Number.isFinite(s.interval)?s.damage/s.interval:0;
export const formatTowerNumber=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n);
export const damageTypeName=type=>({physical:'Physical',piercing:'Physical (piercing)',pure:'Pure',arcane:'Arcane magic',holy:'Holy magic',frost:'Frost magic',fire:'Fire magic',poison:'Poison magic'}[type]||type);
export const basicIngredientLabel=(p,data)=>`${p.count}×${defenderCode(data.towers[p.family],p.tier)}`;
export function abilityLines(s){
  const parts=[];
  if(s.melee)parts.push('Ground targets only');
  if(s.poisonDps)parts.push(`${formatTowerNumber(s.poisonDps)} poison damage/s for ${s.dotDuration||3}s; strongest poison applies`);
  if(s.shred)parts.push(`−${s.shred} enemy armor · 4s`);
  if(s.spreadEffect)parts.push(`Unmarked targets first; then selected priority`);
  if(s.armorShredAura)parts.push(`−${s.armorShredAura} enemy armor aura · ${s.effectRange??s.range} tiles`);
  if(s.magicShredAura)parts.push(`−${Math.round(s.magicShredAura*100)}% enemy magic resistance aura · ${s.effectRange??s.range} tiles${s.auraPiercesImmunity?' · affects magic-immune enemies':''}`);
  if(s.antiAirShred)parts.push(`Flying targets: −${s.antiAirShred} armor · ${Math.round(s.antiAirSlow*100)}% slow`);
  else if(s.antiAirSlow)parts.push(`Flying targets: ${Math.round(s.antiAirSlow*100)}% slow`);
  if(s.antiAirMagicShred)parts.push(`Flying targets: −${Math.round(s.antiAirMagicShred*100)}% magic resistance`);
  if(s.freeze)parts.push(`${Math.round(s.freeze*100)}% stun chance · ${s.freezeDuration||.8}s (half duration on warlords)${s.stunRecovery?` · ${s.stunRecovery}s recovery`:''}`);
  if(s.trueStrike)parts.push('Ignores evasion');
  if(s.slow)parts.push(`${Math.round(s.slow*100)}% movement slow for ${s.slowDuration||2}s${s.effectsRadius?` · also within ${s.effectsRadius} tiles of the target`:''}`);
  if(s.cleave)parts.push(`${Math.round(s.cleave*100)}% ${s.cleaveType||s.type} splash · ${formatTowerNumber(s.damage*s.cleave)} damage to other enemies within ${s.cleaveRadius} tiles`);
  if(s.multishot)parts.push(`${s.multishot} simultaneous targets; ${formatTowerNumber(s.damage)} damage per target`);
  const auraRange=s.aura?.range;
  if(s.aura?.haste)parts.push(`+${Math.round(s.aura.haste*100)}% ally attack speed within ${auraRange} tiles; strongest matching blessing applies`);
  const chants=Object.values(s.aura?.hasteGroups||{});
  if(chants.length)parts.push(`Attack-speed chants: ${chants.map(n=>`+${Math.round(n*100)}%`).join(' and ')} for allies within ${auraRange} tiles; combine to +${Math.round(chants.reduce((a,b)=>a+b,0)*100)}%; matching chants do not stack`);
  if(s.aura?.damageBonus)parts.push(`+${Math.round(s.aura.damageBonus*100)}% ally damage within ${auraRange} tiles; strongest bonus applies`);
  if(s.aura?.rangeBonus)parts.push(`+${formatTowerNumber(s.aura.rangeBonus)} ally range within ${auraRange} tiles; strongest bonus applies`);
  if(s.aura?.trueStrike)parts.push(`Allies ignore evasion within ${auraRange} tiles`);
  if(s.aura?.controlResistance)parts.push(`${Math.round(s.aura.controlResistance*100)}% protection from disarm and dread for allies within ${auraRange} tiles`);
  if(s.burnAura)parts.push(`${s.burnAura} fire damage/s within ${s.range} tiles`);
  if(s.slowAura)parts.push(`${Math.round(s.slowAura*100)}% movement slow aura within ${s.range} tiles`);
  if(s.critChance)parts.push(`${Math.round(s.critChance*100)}% chance of ×${s.critMultiplier} damage`);
  if(s.chain)parts.push(`${Math.round((s.chainChance||1)*100)}% chance of lightning hitting ${s.chain} other enemies within ${s.chainRange||4} tiles${s.chainSequential?' per jump':''}; ${formatTowerNumber(s.chainDamage||s.damage*.55)} damage each`);
  if(s.forkedTargets)parts.push(`${Math.round((s.forkedChance||1)*100)}% forked lightning · ${s.forkedTargets} targets within ${s.forkedRange||10} tiles · ${formatTowerNumber(s.forkedDamage)} magic damage each`);
  if(s.melancholyChance)parts.push(`${Math.round(s.melancholyChance*100)}% Melancholy at attack start: cancels the attack and stops this champion attacking for ${s.melancholyDuration||5}s`);
  if(s.bouncingFrost)parts.push(`${Math.round((s.bouncingFrostChance||1)*100)}% chance of ${s.bouncingFrost} frost bounces · ${formatTowerNumber(s.bouncingFrostDamage||s.damage)} damage each · up to ${s.bouncingFrostRange||10} tiles per bounce${s.bouncingFrostTrigger==='nearby-ally-magic-hit'?` · triggered by allied magic hits within ${s.bouncingFrostTriggerRange||6} tiles; own attacks do not trigger`:''}`);
  if(s.recoverChance)parts.push(`${Math.round(s.recoverChance*100)}% chance to restore ${s.recoverLives} keep health`);
  if(s.goldChance)parts.push(`${Math.round(s.goldChance*100)}% chance to recover ${s.goldMin}–${s.goldMax} gold`);
  if(s.stoneGazeChance)parts.push(`${Math.round(s.stoneGazeChance*100)}% Stone Gaze lasting ${s.stoneGazeDuration||6}s within ${s.stoneGazeRange||10} tiles · ${Math.round((s.stoneGazeSlow||.8)*100)}% slow; face the golem ${s.stoneGazeFacingTime||2}s to petrify for ${s.petrifyDuration||3}s · +${Math.round((s.petrifyPhysicalBonus??1)*100)}% physical damage taken`);
  if(s.healingBlockDuration)parts.push(`Prevents healing for ${s.healingBlockDuration}s`);
  if(s.burnedChance)parts.push(`${Math.round(s.burnedChance*100)}% chance of ×${s.burnedMultiplier} fire splash · ${formatTowerNumber(s.damage*s.burnedMultiplier)} magic damage within ${s.burnedRadius} tiles`);
  if(s.detectionRange)parts.push(`Reveals hidden enemies within ${s.detectionRange} tiles`);
  return parts.length?parts:['Single-target attack'];
}
export const abilityText=s=>abilityLines(s).join(' · ');
export function ingredientName(p,data){const stats=data.towers[p.family];return stats.advanced?`${rankLabel(p.tier)} · ${stats.name}`:`${defenderCode(stats,p.tier)} · ${stats.name}`;}
export const recipeProgressLegend=()=>`<div class="recipe-progress-heading"><span class="owned-progress">Built</span><span class="draft-progress">This round</span></div>`;
export function basicRecipeBreakdown(recipe,data,towerList){
  return `<ul class="pinned-basics">${expandedRecipeProgress(recipe,towerList,data).map(p=>`<li class="${p.ownedCount===p.count?'owned':p.draftCount?'draft-available':''}" data-family="${p.family}" data-tier="${p.tier}"><span><b>${basicIngredientLabel(p,data)}</b><small>${data.towers[p.family].name}</small></span><span class="pinned-progress"><b class="${p.ownedCount?'owned-progress':''}">${p.ownedCount}/${p.count}</b>${p.draftCount?`<small class="draft-progress">+${p.draftCount} this round</small>`:''}</span></li>`).join('')}</ul>`;
}
export function recipeIngredientTree(recipe,data,towerList){
  const label=p=>data.towers[p.family].advanced?`${p.count}×${data.towers[p.family].name} · ${rankLabel(p.tier)}`:basicIngredientLabel(p,data);
  const progress=p=>p.coveredBy?`<span class="recipe-tree-covered ${p.coveredBy.state==='active'?'owned-progress':'draft-progress'}">${p.coveredBy.state==='active'?'✓':'◆'} Included in ${p.coveredBy.state==='active'?'built':'this round’s'} ${data.towers[p.coveredBy.family].name}</span>`:`<span class="pinned-progress"><b class="${p.ownedCount?'owned-progress':''}">${p.ownedCount}/${p.count} built</b>${p.draftCount?`<small class="draft-progress">+${p.draftCount} this round</small>`:''}</span>`;
  const node=(p,root=false)=>`<li class="recipe-tree-node ${p.ownedCount?'owned':p.draftCount?'draft-available':p.coveredBy?'covered':''}" data-family="${p.family}" data-tier="${p.tier}"><div class="recipe-tree-row"><span class="recipe-tree-label"><b>${label(p)}</b>${!data.towers[p.family].advanced?`<small>${data.towers[p.family].name}</small>`:''}</span>${progress(p)}</div>${p.children.length?`${root?'<div class="recipe-tree-branch-heading">How to build this champion</div>':''}<ul class="recipe-tree-children">${p.children.map(child=>node(child)).join('')}</ul>`:''}</li>`;
  return `<div class="recipe-tree-heading">Combine these ${recipe.ingredients.length} ingredients</div>${recipe.currentRoundOnly?'<p class="recipe-round-rule">All three must be among this round’s five newly placed defenders. Select one of those ingredients; the other two candidates become walls.</p>':''}<ul class="recipe-tree">${recipeTreeProgress(recipe,towerList,data).map(p=>node(p,true)).join('')}</ul>`;
}
export function championRecipeCard(recipe,data,images,{towerList=[],pinned=false,discovered=false,level=1,craftable=false}={}){
  const family=recipeFamily(recipe),stats=towerStats({family,tier:recipeTier(recipe)},data);
  const progress=recipeProgress(recipe,towerList),ready=progress.every(p=>p.available)&&level>=recipe.level&&(!recipe.currentRoundOnly||craftable);
  const abilities=abilityLines(stats);
  return `<article class="recipe-card ${ready?'available':''}" data-family="${family}" data-recipe-id="${recipe.id}">
    <img src="${images[`${family}:${recipeTier(recipe)}`]||images[family]}" alt="${recipeLabel(recipe,data)}">
    <div class="recipe-summary"><div class="eyebrow">${championClassification(family).toUpperCase()} · ${ready?'COMBINATION AVAILABLE':discovered?'DISCOVERED':'UNFORGED'}</div><h3>${recipeLabel(recipe,data)}</h3><p>${stats.description}</p></div>
    <p class="recipe-built"><strong>${builtTowerCount(towerList,family)}</strong> built</p>
    <dl class="recipe-stat-grid"><div><dt>Damage / hit</dt><dd>${formatTowerNumber(stats.damage)}</dd></div><div><dt>Base DPS</dt><dd>${formatTowerNumber(baseAttackDps(stats))}</dd></div><div><dt>Interval</dt><dd>${formatTowerNumber(stats.interval)}s</dd></div><div><dt>Range</dt><dd>${formatTowerNumber(stats.range)}</dd></div></dl>
    <div class="recipe-ability-heading">${damageTypeName(stats.type)} · Effects</div><ul class="recipe-effects">${abilities.map(line=>`<li>${line}</li>`).join('')}</ul>
    <div class="recipe-ability-heading">Combine these ${recipe.ingredients.length} defenders</div>${recipe.currentRoundOnly?'<p class="recipe-round-rule">Secret recipe: all three ingredients must be in the same current round’s five defenders. Previously kept units cannot be used.</p>':''}<ul class="recipe-ingredients">${progress.map(p=>`<li class="${p.owned?'owned':p.draft?'draft-available':''}"><span>${p.owned?'✓':p.draft?'◆':'○'}</span>${ingredientName(p,data)}${p.draft?' <small class="draft-progress">this round</small>':''}</li>`).join('')}</ul>
    ${pinned?`<details class="recipe-basic-breakdown" open><summary>Full crafting chain</summary>${recipeProgressLegend()}${recipeIngredientTree(recipe,data,towerList)}<details class="recipe-basic-totals"><summary>Basic recruit totals</summary>${basicRecipeBreakdown(recipe,data,towerList)}</details></details>`:''}
    <button class="text-button ${pinned?'recipe-pin':''}" data-action="pin" data-id="${recipe.id}">${icon('pin')}${pinned?'Pinned':'Pin recipe'}</button>${ready&&craftable?` <button class="text-button gold" data-action="craft" data-id="${recipe.id}">Recruit champion</button>`:''}
  </article>`;
}
export function defenderGuide(data,images){
  return `<section class="defender-guide"><h3>Eight defenders. Six ranks.</h3><p>Open a defender to compare every rank. Merge two matching current-round recruits to advance one rank. Two Royal V units create a Mythic VI; Mythic units are earned through merging.</p><div class="defender-roster">${Object.entries(data.towers).filter(([,s])=>!s.advanced).map(([family,s])=>`<details class="defender-entry"><summary><img src="${images[family]}" alt="${s.name}"><span><strong>${s.name}</strong><small>${defenderCode(s)}</small><em>${s.role}</em></span></summary><p>${s.description}</p><div class="rank-scroll"><table><thead><tr><th>Rank</th><th>Damage</th><th>Base DPS</th><th>Interval</th><th>Range</th><th>Ability</th></tr></thead><tbody>${s.levels.map((_,i)=>{const t=towerStats({family,tier:i+1},data);return `<tr><td style="color:${rankColor(i+1)}"><img class="rank-mini" src="${images[`${family}:${i+1}`]}" alt="${s.name}, rank ${ROMAN[i]}">${defenderCode(s,i+1)}</td><td>${formatTowerNumber(t.damage)}</td><td>${formatTowerNumber(baseAttackDps(t))}</td><td>${formatTowerNumber(t.interval)}s</td><td>${t.range}</td><td>${abilityText(t)}</td></tr>`;}).join('')}</tbody></table></div></details>`).join('')}</div></section><h3 class="recipe-title">Champion recipes</h3><p>${Object.values(data.towers).filter(s=>s.advanced&&!s.hidden).length} champions. Each recipe consumes exactly three defenders of the stated ranks. Secret champions require all three ingredients among the current round’s five new defenders; ordinary recipes can use previously retained units.</p><p class="dps-explanation">${BASE_DPS_NOTE}</p>`;
}
