import {rankLabel} from '../game/core/recipes.js';

export function masteryPanelMarkup(economy,balance){
  const weights=balance.mastery[economy.mastery].weights;
  return `<div class="mastery-odds" aria-label="Future draw quality distribution"><div class="mastery-odds-label">Future draw odds</div><div class="probability">${weights.map((weight,index)=>`<span style="width:${weight}%;background:var(--tier${index+1})"></span>`).join('')}</div><div class="prob-labels">${weights.map((weight,index)=>`<span style="color:var(--tier${index+1})"><b>${rankLabel(index+1)}</b><em>${index===5?'Merge':`${weight}%`}</em></span>`).join('')}</div></div>
    `;
}
