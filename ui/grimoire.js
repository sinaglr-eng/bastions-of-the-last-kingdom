import {towerStats} from '../game/core/math.js';
import {rankColor} from '../game/render/ranks.js';
import {rankLabel} from '../game/core/recipes.js';
import {defenderCode} from '../game/core/unit-label.js';
export const ROMAN=['I','II','III','IV','V','VI'];
export function abilityText(s){
  const parts=[];
  if(s.melee)parts.push('Ground targets only');
  if(s.poisonDps)parts.push(`${s.poisonDps} poison damage/s · ${s.dotDuration}s`);
  if(s.shred)parts.push(`−${s.shred} enemy armor · 4s`);
  if(s.spreadEffect)parts.push(`Unmarked targets first; then selected priority`);
  if(s.armorShredAura)parts.push(`−${s.armorShredAura} enemy armor aura · ${s.effectRange??s.range} tiles`);
  if(s.magicShredAura)parts.push(`−${Math.round(s.magicShredAura*100)}% enemy magic resistance aura${s.auraPiercesImmunity?' · affects magic-immune enemies':''}`);
  if(s.antiAirShred)parts.push(`Flying targets: −${s.antiAirShred} armor · ${Math.round(s.antiAirSlow*100)}% slow`);
  else if(s.antiAirSlow)parts.push(`Flying targets: ${Math.round(s.antiAirSlow*100)}% slow`);
  if(s.antiAirMagicShred)parts.push(`Flying targets: −${Math.round(s.antiAirMagicShred*100)}% magic resistance`);
  if(s.freeze)parts.push(`${Math.round(s.freeze*100)}% stun chance · ${s.freezeDuration||.8}s · ${s.stunRecovery||0}s recovery`);
  if(s.trueStrike)parts.push('Ignores evasion');
  if(s.slow)parts.push(`${Math.round(s.slow*100)}% slow${s.effectsRadius?' · nearby targets':''}`);
  if(s.cleave)parts.push(`${Math.round(s.cleave*100)}% pure splash · ${s.cleaveRadius} tiles`);
  if(s.multishot)parts.push(`${s.multishot} simultaneous targets`);
  if(s.aura?.haste)parts.push(`+${Math.round(s.aura.haste*100)}% ally attack speed`);
  for(const haste of Object.values(s.aura?.hasteGroups||{}))parts.push(`+${Math.round(haste*100)}% ally attack speed`);
  if(s.aura?.damageBonus)parts.push(`+${Math.round(s.aura.damageBonus*100)}% ally damage`);
  if(s.aura?.rangeBonus)parts.push(`+${s.aura.rangeBonus} ally range`);
  if(s.aura?.trueStrike)parts.push('Allies ignore evasion');
  if(s.aura?.controlResistance)parts.push(`${Math.round(s.aura.controlResistance*100)}% protection from disarm and dread`);
  if(s.burnAura)parts.push(`${s.burnAura} fire damage/s within ${s.range} tiles`);
  if(s.slowAura)parts.push(`${Math.round(s.slowAura*100)}% slow aura`);
  if(s.critChance)parts.push(`${Math.round(s.critChance*100)}% chance of ×${s.critMultiplier} damage`);
  if(s.chain)parts.push(`${Math.round((s.chainChance||1)*100)}% chance of ${s.chain} lightning jumps`);
  if(s.forkedTargets)parts.push(`${Math.round(s.forkedChance*100)}% forked lightning · ${s.forkedTargets} targets · ${s.forkedDamage} magic damage`);
  if(s.bouncingFrost)parts.push(`${Math.round(s.bouncingFrostChance*100)}% bouncing frost · ${s.bouncingFrost} bounces${s.bouncingFrostTrigger==='nearby-ally-magic-hit'?` · allied magic hits within ${s.bouncingFrostTriggerRange} tiles`:''}`);
  if(s.recoverChance)parts.push(`${Math.round(s.recoverChance*100)}% chance to restore ${s.recoverLives} keep health`);
  if(s.goldChance)parts.push(`${Math.round(s.goldChance*100)}% chance to recover ${s.goldMin}–${s.goldMax} gold`);
  if(s.stoneGazeChance)parts.push(`${Math.round(s.stoneGazeChance*100)}% Stone Gaze · face the golem ${s.stoneGazeFacingTime}s to petrify for ${s.petrifyDuration}s · +${Math.round(s.petrifyPhysicalBonus*100)}% physical damage taken`);
  if(s.healingBlockDuration)parts.push(`Prevents healing for ${s.healingBlockDuration}s`);
  if(s.burnedChance)parts.push(`${Math.round(s.burnedChance*100)}% chance of ×${s.burnedMultiplier} magic splash · ${s.burnedRadius} tiles`);
  if(s.detectionRange)parts.push(`Reveals hidden enemies within ${s.detectionRange} tiles`);
  return parts.join(' · ')||'Single-target attack';
}
export function ingredientName(p,data){const stats=data.towers[p.family];return stats.advanced?`${rankLabel(p.tier)} · ${stats.name}`:`${defenderCode(stats,p.tier)} · ${stats.name}`;}
export function defenderGuide(data,images){
  return `<section class="defender-guide"><h3>Eight defenders. Six ranks.</h3><p>Open a defender to compare every rank. Merge two matching current-round recruits to advance one rank. Two Royal V units create a Mythic VI; Mythic units are earned through merging.</p><div class="defender-roster">${Object.entries(data.towers).filter(([,s])=>!s.advanced).map(([family,s])=>`<details class="defender-entry"><summary><img src="${images[family]}" alt="${s.name}"><span><strong>${s.name}</strong><small>${defenderCode(s)}</small><em>${s.role}</em></span></summary><p>${s.description}</p><div class="rank-scroll"><table><thead><tr><th>Rank</th><th>Hit</th><th>Interval</th><th>Range</th><th>Ability</th></tr></thead><tbody>${s.levels.map((_,i)=>{const t=towerStats({family,tier:i+1},data);return `<tr><td style="color:${rankColor(i+1)}"><img class="rank-mini" src="${images[`${family}:${i+1}`]}" alt="${s.name}, rank ${ROMAN[i]}">${defenderCode(s,i+1)}</td><td>${t.damage}</td><td>${t.interval}s</td><td>${t.range}</td><td>${abilityText(t)}</td></tr>`;}).join('')}</tbody></table></div></details>`).join('')}</div></section><h3 class="recipe-title">Champion lineages and ascensions</h3><p>${Object.values(data.towers).filter(s=>s.advanced).length} champions. All recipes consume exactly three defenders of the stated ranks. Three identical champions ascend with ${data.balance.championRankMultiplier}× offensive strength; support improves gradually with caps. Paid upgrades last until that defender is consumed.</p>`;
}
