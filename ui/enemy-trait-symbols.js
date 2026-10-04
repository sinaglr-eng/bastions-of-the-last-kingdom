import {ENEMY_DEFENSE_SYMBOLS,enemyDefenseDescriptions} from '../game/render/enemy-defense-symbols.js';

const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function enemyDefenseGlyph(kind){
  const symbol=ENEMY_DEFENSE_SYMBOLS[kind];
  if(!symbol)return '';
  return `<svg class="enemy-defense-glyph" data-defense="${kind}" style="color:${symbol.color}" viewBox="${symbol.viewBox}" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${symbol.svgPaths.map(path=>`<path d="${path}"/>`).join('')}</svg>`;
}
export function enemyTraitsMarkup(traits){
  if(!traits?.length)return '<ul class="enemy-trait-list"><li>No special resistances or abilities</li></ul>';
  return `<ul class="enemy-trait-list">${traits.map(trait=>`<li>${enemyDefenseGlyph(trait.kind)}<span>${escape(trait.text)}</span></li>`).join('')}</ul>`;
}
export function waveDefenseLegendMarkup(definition,options){
  const descriptions=enemyDefenseDescriptions(definition,options);
  if(!descriptions.length)return '';
  return `<ul class="wave-defense-legend" aria-label="Enemy defense symbols">${descriptions.map(description=>`<li title="${escape(description.detail)}">${enemyDefenseGlyph(description.kind)}<span>${escape(description.label)}</span></li>`).join('')}</ul>`;
}
