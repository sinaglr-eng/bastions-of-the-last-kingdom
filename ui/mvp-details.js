import {mvpLevel,mvpDamageBonus} from '../game/core/mvp.js';
export function mvpDetailsMarkup(tower,{controls=true}={}){
  if(tower.state!=='active')return '';
  const level=mvpLevel(tower);
  return `<section class="mvp-details" aria-label="Defender MVP bonuses"><strong>MVP Level: ${level} / 10${level===10?' · MAX MVP':''}</strong><p>Own damage +${Math.round(mvpDamageBonus(tower)*100)}%</p>${controls?`<button type="button" class="text-button" data-action="tower-pause" aria-pressed="${!!tower.attackPaused}">${tower.attackPaused?'Resume this defender':'Pause this defender'}</button>`:''}</section>`;
}
