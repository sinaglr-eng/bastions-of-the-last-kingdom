import {mvpLevel} from '../game/core/mvp.js';
export function mvpDetailsMarkup(tower){
  if(tower.state!=='active')return '';
  const level=mvpLevel(tower);
  return `<section class="mvp-details" aria-label="Defender MVP bonuses"><strong>MVP Level: ${level} / 10${level===10?' · MAX MVP':''}</strong><p>Own damage +${level*10}% · Enemy armor −${level}% within 2 tiles</p>${level===10?'<p>Nearby allies gain +75% damage within 2 tiles. Strongest MVP aura applies.</p>':''}<button type="button" class="text-button" data-action="tower-pause" aria-pressed="${!!tower.attackPaused}">${tower.attackPaused?'Resume this defender':'Pause this defender'}</button></section>`;
}
