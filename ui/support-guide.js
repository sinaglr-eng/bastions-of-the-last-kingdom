import {SUPPORT_EFFECT_STYLES,supportLegend,supportSourceAreas} from '../game/render/support-effects.js';

// Use the same distinguishable shapes as the world overlays, with text labels
// alongside them so color is never the sole source of meaning.
const paths={
  clock:'<circle cx="12" cy="12" r="8"/><path d="M12 6v6l5 3"/>',
  blade:'<path d="M7 17 19 5l-1 6-9 8M4 14l6 6M3 21l3-3"/>',
  arrows:'<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
  shield:'<path d="M4 4h16l-2 11-6 6-6-6Z"/>',
  target:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/><path d="M12 2v20M2 12h20"/>',
  spiral:'<path d="M12 12c-3-3 3-5 4-1 2 6-7 9-10 3C1 4 17 0 21 10c3 9-7 14-14 11"/>',
  cross:'<path d="m5 5 14 14M5 19 19 5"/>',
  crack:'<path d="m5 3 8 7-4 4 10 7M3 14v7h18v-7"/>',
  snowflake:'<path d="M12 2v20M3 7l18 10M3 17 21 7"/>',
  moon:'<path d="M19 16A9 9 0 0 1 8 3a9 9 0 1 0 11 13Z"/>',
  flame:'<path d="M5 20 4 11l8-9 1 10 6-6 2 14Z"/>',
  brokenStar:'<path d="M3 8h13l-4-6 9 14H8l4 6Z"/>'
};
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const supportGlyph=(glyph,color)=>`<svg class="support-glyph" data-glyph="${glyph}" style="color:${color}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[glyph]||paths.target}</svg>`;
export function supportEffectsMarkup(tower,towers,data,options){
  const effects=supportLegend(tower,towers,data,options);
  if(!effects.length)return `<p class="support-empty">${tower.state==='active'?'No active bonuses or penalties.':'Retain this defender to receive support effects.'}</p>`;
  const providers=effect=>[...new Map(effect.sources.map(source=>[source.id,source])).values()];
  const providerLabel=(effect,source)=>{
    if(['dread','disarm'].includes(effect.key)){
      const combat=options?.combat,enemy=combat?.enemies?.find(enemy=>enemy.id===source.id);
      if(enemy&&typeof combat.isRevealed==='function'&&!combat.isRevealed(enemy))return 'Unrevealed invader';
    }
    return `${source.name} #${source.id}`;
  };
  const labels=effect=>[...new Set(providers(effect).map(source=>providerLabel(effect,source)))].map(escape).join(', ');
  return `<ul class="support-effects-list">${effects.map(effect=>`<li class="${['dread','disarm','weakened','melancholy'].includes(effect.key)?'negative':'friendly'}" data-effect="${effect.key}">${supportGlyph(effect.glyph,effect.color)}<span><b>${escape(effect.label)}</b><small>From ${labels(effect)}</small></span></li>`).join('')}</ul>`;
}
export function supportMapLegendMarkup(){
  return `<details class="support-map-legend"><summary>Map effect symbols</summary><p>The wall color follows the first listed effect; separate symbols show every active effect. The selected provider’s dashed circle shows its reach.</p><ul>${Object.entries(SUPPORT_EFFECT_STYLES).map(([key,style])=>`<li data-effect="${key}">${supportGlyph(style.glyph,style.color)}<span>${style.label}</span></li>`).join('')}</ul></details>`;
}
export function selectedSupportMarkup(tower,towers,data,options){
  const areas=supportSourceAreas(tower,data,{towers});
  return `<section class="selected-support" aria-label="Current support effects"><div class="section-label">ACTIVE BONUSES &amp; PENALTIES</div><div id="selected-support-effects">${supportEffectsMarkup(tower,towers,data,options)}</div>${areas.length?`<div class="support-source-heading">Projected by this defender</div><ul class="support-source-list">${areas.map(area=>`<li>${supportGlyph(area.glyph,area.color)}<span>${escape(area.label)}</span></li>`).join('')}</ul>`:''}${supportMapLegendMarkup()}</section>`;
}
