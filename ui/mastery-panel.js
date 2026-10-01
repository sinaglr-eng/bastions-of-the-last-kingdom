import {rankLabel} from '../game/core/recipes.js';

export function masteryPanelMarkup(economy,balance){
  const next=economy.nextMastery(),weights=balance.mastery[economy.mastery].weights;
  const help=!next?'Maximum mastery reached.':`Next odds at Kingdom ${economy.level+1} · ${economy.xp%balance.xpPerLevel} / ${balance.xpPerLevel} XP`;
  return `<div class="mastery-heading"><strong>Construction mastery</strong><span>${economy.mastery} / ${balance.mastery.length-1}</span></div>
    <div class="mastery-odds" aria-label="Future draw quality distribution"><div class="mastery-odds-label">Future draw odds</div><div class="probability">${weights.map((weight,index)=>`<span style="width:${weight}%;background:var(--tier${index+1})"></span>`).join('')}</div><div class="prob-labels">${weights.map((weight,index)=>`<span style="color:var(--tier${index+1})"><b>${rankLabel(index+1)}</b><em>${index===5?'Merge':`${weight}%`}</em></span>`).join('')}</div></div>
    <div class="mastery-auto"><span>Automatic · Kingdom ${economy.level}</span><small>New odds apply next round</small></div><p class="mastery-help">${help}</p>`;
}
