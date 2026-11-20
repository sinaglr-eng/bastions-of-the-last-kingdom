import {SUPPORT_EFFECT_STYLES,ENEMY_EFFECT_STYLES,supportLegend,supportSourceAreas} from '../game/render/support-effects.js';

import {supportArtwork} from '../game/render/status-art.js';

const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const SUPPORT_EFFECT_DESCRIPTIONS=Object.freeze({
  haste:'Attacks happen more often. Only the strongest standard attack-speed bonus applies. Otomad adds a separate +500% bonus; duplicate Otomad sources do not stack.',
  damage:'Increases damage dealt by this defender. The strongest nearby damage bonus applies.',
  range:'Extends this defender’s attack range by the listed number of tiles.',
  controlResistance:'Reduces on-hit Dread attack slowing and shortens nearby disarm effects.',
  trueStrike:'Direct Physical, Magical and Holy attacks ignore an enemy’s chance to evade.',
  dread:'Dealing actual HP damage to a Dread invader slows this defender’s attacks for 3 game seconds, at any range. Owned DOT, auras and secondary hits refresh the duration; it does not stack. Control protection reduces the slowing.',
  disarm:'This defender cannot attack during the short disarm window of a nearby enemy within 3 tiles. Control protection shortens the window.',
  weakened:'Each disrupted barricade within 2 tiles slows this defender’s attacks by 15% while that barricade remains scorched. Multiple penalties multiply.',
  melancholy:'This defender cannot attack while melancholy lasts. It resumes attacking when the remaining time expires.',
  support:'Grants the listed support bonuses to active defenders within this source’s reach, including itself.',
  burn:'Burns enemies within this defender’s aura, dealing fire damage over time.',
  slow:'Reduces enemies’ movement speed within this defender’s aura.',
  armor:'Lowers enemy armor so Physical, Magical and Holy attacks deal more damage. Applied by attacks such as Engineer hits, or by an armor-reducing aura.',
  detection:'Reveals cloaked enemies within this defender’s detection radius so allies can target them.',
  reaction:'Reacts to nearby allied magic hits with the defender’s frost response.',
});
const tooltipAttributes=(key,label,extraClass='')=>`class="has-effect-tooltip${extraClass?' '+extraClass:''}" tabindex="0" aria-label="${escape(label+'. '+(SUPPORT_EFFECT_DESCRIPTIONS[key]||label))}"`;
const tooltip=key=>`<span class="support-effect-tooltip" role="tooltip">${escape(SUPPORT_EFFECT_DESCRIPTIONS[key]||'')}</span>`;
export const supportGlyph=(glyph,color,key)=>`<img class="support-glyph" data-glyph="${glyph}" src="${supportArtwork(glyph,key)}" width="24" height="24" alt="">`;
export function supportEffectsMarkup(tower,towers,data,options){
  const effects=supportLegend(tower,towers,data,options);
  if(!effects.length)return `<p class="support-empty">${tower.state==='active'?'No active bonuses or penalties.':'Retain this defender to receive support effects.'}</p>`;
  const providers=effect=>[...new Map(effect.sources.map(source=>[source.id,source])).values()];
  const providerLabel=(effect,source)=>{
    if(['dread','disarm'].includes(effect.key)){
      if(source.visible===false)return 'Unrevealed invader';
      const combat=options?.combat,enemy=combat?.enemies?.find(enemy=>enemy.id===source.id);
      if(enemy&&typeof combat.isRevealed==='function'&&!combat.isRevealed(enemy))return 'Unrevealed invader';
    }
    return `${source.name} #${source.id}`;
  };
  const labels=effect=>[...new Set(providers(effect).map(source=>providerLabel(effect,source)))].map(escape).join(', ');
  return `<ul class="support-effects-list">${effects.map(effect=>`<li ${tooltipAttributes(effect.key,effect.label,['dread','disarm','weakened','melancholy'].includes(effect.key)?'negative':'friendly')} data-effect="${effect.key}">${supportGlyph(effect.glyph,effect.color,effect.key)}<span><b>${escape(effect.label)}</b><small>From ${labels(effect)}</small></span>${tooltip(effect.key)}</li>`).join('')}</ul>`;
}
export function supportMapLegendMarkup(){
  const armor=ENEMY_EFFECT_STYLES.armor,armorLabel='Enemy armor reduced';
  return `<details class="support-map-legend"><summary>Map effect symbols</summary><p>The wall color follows the first listed effect; separate symbols show every active effect. The selected provider’s dashed circle shows its reach.</p><ul aria-label="Defender effect symbols">${Object.entries(SUPPORT_EFFECT_STYLES).map(([key,style])=>`<li ${tooltipAttributes(key,style.label)} data-effect="${key}">${supportGlyph(style.glyph,style.color,key)}<span>${style.label}</span>${tooltip(key)}</li>`).join('')}</ul><p>On enemies</p><ul aria-label="Enemy effect symbols"><li ${tooltipAttributes('armor',armorLabel)} data-effect="armor">${supportGlyph(armor.glyph,armor.color)}<span>${armorLabel}</span>${tooltip('armor')}</li></ul></details>`;
}
export function selectedSupportMarkup(tower,towers,data,options){
  const areas=supportSourceAreas(tower,data,{towers});
  return `<section class="selected-support" aria-label="Current support effects"><div class="section-label">ACTIVE BONUSES &amp; PENALTIES</div><div id="selected-support-effects">${supportEffectsMarkup(tower,towers,data,options)}</div>${areas.length?`<div class="support-source-heading">Projected by this defender</div><ul class="support-source-list">${areas.map(area=>`<li ${tooltipAttributes(area.key,area.label)}>${supportGlyph(area.glyph,area.color,area.key)}<span>${escape(area.label)}</span>${tooltip(area.key)}</li>`).join('')}</ul>`:''}</section>`;
}
