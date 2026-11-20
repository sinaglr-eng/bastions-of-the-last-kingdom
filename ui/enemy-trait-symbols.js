import {siteUrl} from '../game/site-url.js';
import {ENEMY_DEFENSE_SYMBOLS} from '../game/render/enemy-defense-symbols.js';
import {warbandTraitDetails} from '../game/core/warband-info.js';

const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function enemyDefenseGlyph(kind){
  const symbol=ENEMY_DEFENSE_SYMBOLS[kind];
  if(!symbol)return '';
  return `<img class="enemy-defense-glyph" data-defense="${kind}" src="${siteUrl(symbol.art)}" width="24" height="24" alt="">`;
}
export function enemyTraitsMarkup(traits){
  if(!traits?.length)return '<ul class="enemy-trait-list"><li>No special resistances or abilities</li></ul>';
  return `<ul class="enemy-trait-list">${traits.map(trait=>`<li>${enemyDefenseGlyph(trait.kind)}<span>${escape(trait.text)}</span></li>`).join('')}</ul>`;
}
export function waveDefenseLegendMarkup(definition){
  const traits=warbandTraitDetails(definition);
  if(!traits.length)return '';
  return `<ul class="wave-defense-legend" aria-label="Enemy abilities and defenses">${traits.map(trait=>`<li>${enemyDefenseGlyph(trait.kind)}<span>${ENEMY_DEFENSE_SYMBOLS[trait.kind]?escape(ENEMY_DEFENSE_SYMBOLS[trait.kind].label)+' · ':''}${escape(trait.text)}</span></li>`).join('')}</ul>`;
}
