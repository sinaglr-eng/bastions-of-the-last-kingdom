import {towerStats} from '../game/core/math.js';
import {rankColor} from '../game/render/ranks.js';
import {rankLabel} from '../game/core/recipes.js';
export const ROMAN=['I','II','III','IV','V','VI'];
export function abilityText(s){
  const parts=[];
  if(s.melee)parts.push('Ground targets only');
  if(s.poisonDps)parts.push(`${s.poisonDps} poison damage/s · ${s.dotDuration}s`);
  if(s.shred)parts.push(`−${s.shred} enemy armor · 4s`);
  if(s.slow)parts.push(`${Math.round(s.slow*100)}% slow${s.effectsRadius?' · nearby targets':''}`);
  if(s.cleave)parts.push(`${Math.round(s.cleave*100)}% pure splash · ${s.cleaveRadius} tiles`);
  if(s.multishot)parts.push(`${s.multishot} simultaneous targets`);
  if(s.aura?.haste)parts.push(`+${Math.round(s.aura.haste*100)}% ally attack speed`);
  if(s.aura?.damageBonus)parts.push(`+${Math.round(s.aura.damageBonus*100)}% ally damage`);
  if(s.aura?.rangeBonus)parts.push(`+${s.aura.rangeBonus} ally range`);
  if(s.burnAura)parts.push(`${s.burnAura} fire damage/s within ${s.range} tiles`);
  if(s.slowAura)parts.push(`${Math.round(s.slowAura*100)}% slow aura`);
  if(s.critChance)parts.push(`${Math.round(s.critChance*100)}% chance of ×${s.critMultiplier} damage`);
  if(s.chain)parts.push(`${Math.round((s.chainChance||1)*100)}% chance of ${s.chain} lightning jumps`);
  return parts.join(' · ')||'Single-target attack';
}
export function ingredientName(p,data){return `${rankLabel(p.tier)} · ${data.towers[p.family].name}`;}
export function defenderGuide(data,images){
  return `<section class="defender-guide"><h3>Eight defenders. Six ranks.</h3><p>Open a defender to compare every rank. Merge two matching units to advance one rank. Two Royal V units create a Mythic VI; Mythic units are earned through merging.</p><div class="defender-roster">${Object.entries(data.towers).filter(([,s])=>!s.advanced).map(([family,s])=>`<details class="defender-entry"><summary><img src="${images[family]}" alt="${s.name}"><span><strong>${s.name}</strong><small>UNIT ${s.unitCode||family.slice(0,2).toUpperCase()}</small><em>${s.role}</em></span></summary><p>${s.description}</p><div class="rank-scroll"><table><thead><tr><th>Rank</th><th>Hit</th><th>Interval</th><th>Range</th><th>Ability</th></tr></thead><tbody>${s.levels.map((_,i)=>{const t=towerStats({family,tier:i+1},data);return `<tr><td style="color:${rankColor(i+1)}"><img class="rank-mini" src="${images[`${family}:${i+1}`]}" alt="${s.name}, rank ${ROMAN[i]}">${ROMAN[i]}</td><td>${t.damage}</td><td>${t.interval}s</td><td>${t.range}</td><td>${abilityText(t)}</td></tr>`;}).join('')}</tbody></table></div></details>`).join('')}</div></section><h3 class="recipe-title">Champion lineages and ascensions</h3><p>Every family and rank has a path forward. All recipes consume exactly three defenders of the stated ranks. Three identical champions ascend to the next rank with no final rank limit; paid upgrades last until that defender is consumed.</p>`;
}
