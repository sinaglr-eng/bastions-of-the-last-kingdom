import {siteUrl} from '../game/site-url.js';
export const castleWallPortrait=()=>siteUrl('assets/ui/ipad-polish/castle-wall.webp');
const escape=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

export function wallPanelMarkup({phase,image}={}){
  const removable=['build','select','ready','reward'].includes(phase);
  return `<section class="selected-wall"><div class="eyebrow">The walls remember</div><h2>Castle wall</h2><div class="actions wall-primary-actions"><button class="secondary-button" data-action="remove" ${removable?'':'disabled'}>Demolish wall · Del</button></div><p class="minor-note">Clear foundations between waves to reshape the route.</p><div class="tower-portrait"><img src="${escape(image||castleWallPortrait())}" alt="Castle stone wall"></div></section>`;
}
