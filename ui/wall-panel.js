const escape=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

export function wallPanelMarkup({phase,image}={}){
  const removable=['build','select','ready','reward'].includes(phase);
  return `<section class="selected-wall"><div class="eyebrow">The walls remember</div><h2>Castle wall</h2><div class="actions wall-primary-actions"><button class="secondary-button" data-action="remove" ${removable?'':'disabled'}>Demolish wall · Del</button></div><p class="minor-note">Clear foundations between waves to reshape the route.</p><div class="tower-portrait"><img src="${escape(image)}" alt="Castle stone wall"></div><p class="intro-text">A crenellated stone wall. It cannot attack, but forces enemies to find a way around it.</p><div class="stat-grid"><div><span>Footprint</span><strong>1 tile</strong></div><div><span>Attack</span><strong>None</strong></div><div><span>Role</span><strong>Maze</strong></div></div></section>`;
}
