import {icon} from './icons.js';
import {rankLabel} from '../game/core/recipes.js';

export function masteryPanelMarkup(economy,balance){
  const next=economy.nextMastery(),weights=balance.mastery[economy.mastery].weights;
  const blocked=next&&economy.level<next.level;
  const help=!next?'Every mastery upgrade is complete.':blocked?`Kingdom ${next.level} required · yours: ${economy.level}`:'Applies to the next round';
  return `<div class="mastery-heading"><strong>Construction mastery</strong><span>${economy.mastery} / ${balance.mastery.length-1}</span></div>
    <div class="mastery-odds" aria-label="Future draw quality distribution"><div class="mastery-odds-label">Future draw odds</div><div class="probability">${weights.map((weight,index)=>`<span style="width:${weight}%;background:var(--tier${index+1})"></span>`).join('')}</div><div class="prob-labels">${weights.map((weight,index)=>`<span style="color:var(--tier${index+1})"><b>${rankLabel(index+1)}</b><em>${index===5?'Merge':`${weight}%`}</em></span>`).join('')}</div></div>
    <button class="mastery-button" data-action="mastery" title="${help}" ${!next||economy.gold<next.cost||blocked?'disabled':''}><span>${next?'Improve draws':'Mastery complete'}</span>${next?`<span>${icon('coin')} ${next.cost}</span>`:''}</button><p class="mastery-help">${help}</p>`;
}
