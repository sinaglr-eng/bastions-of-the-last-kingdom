import {ROMAN} from './grimoire.js';

const isBasic=(tower,data)=>tower&&tower.state!=='ruin'&&data.towers[tower.family]&&!data.towers[tower.family].advanced;

// Rank comparisons belong to the panel. The selected battlefield unit remains
// the authority for keeping, merging, downgrading, targeting and support.
export class DefenderRankPreview {
  clear(){this.identity=null;this.tier=null;}
  view(tower,data){
    if(!isBasic(tower,data)){this.clear();return tower;}
    const identity=`${tower.id}:${tower.family}:${tower.tier}`;
    if(this.identity!==identity){this.identity=identity;this.tier=tower.tier;}
    return {...tower,tier:this.tier};
  }
  select(tower,tier,data){
    if(!isBasic(tower,data)||!Number.isInteger(tier)||tier<1||tier>6)return false;
    this.view(tower,data);this.tier=tier;return true;
  }
}

export function defenderRankPreviewMarkup(tower,view,data){
  if(!isBasic(tower,data))return '';
  return `<section class="rank-preview" aria-label="Compare defender ranks"><div class="rank-preview-heading"><span>COMPARE RANKS</span><span>On field: ${ROMAN[tower.tier-1]}</span></div><div class="rank-preview-buttons">${ROMAN.map((rank,index)=>`<button type="button" data-action="preview-rank" data-tier="${index+1}" aria-label="Preview Tier ${rank}" aria-pressed="${view.tier===index+1}"${tower.tier===index+1?' data-current="true" title="Current rank on the battlefield"':''}>${rank}</button>`).join('')}</div><p class="rank-preview-caption">${view.tier===tower.tier?'Current defender':`Viewing Tier ${ROMAN[view.tier-1]} · compare stats and abilities below`}</p></section>`;
}
