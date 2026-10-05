import {towerStats} from '../game/core/math.js';
import {rankLabel} from '../game/core/recipes.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>value.toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1});
const explanation='Highest actual DPS over a 5-game-second window in this wave';

export function towerDpsContents(rows,data,images,{phase='build',paused=false,wave=null}={}){
  const highest=rows[0]?.dps||0;
  const note=wave?`Wave ${wave}${phase==='combat'&&paused?' · Paused':''}`:phase==='combat'?`This wave${paused?' · Paused':''}`:'Measured during combat';
  return `<div class="tower-dps-heading"><h2 title="${explanation}">Peak DPS this wave</h2><span>${rows.length} ${rows.length===1?'defender':'defenders'}</span></div><p class="tower-dps-note">${note}</p>${rows.length?`<ol class="tower-dps-list" aria-label="Defenders ordered by peak actual DPS this wave">${rows.map((row,index)=>{
    const stats=towerStats(row,data),name=stats.name,rank=rankLabel(row.tier),portrait=images[`${row.family}:${row.tier}`]||images[row.family]||'';
    return `<li><button type="button" data-action="tower-dps-select" data-id="${row.id}" aria-label="Select ${escape(name)}, rank ${rank}, defender ${row.id}, ${number(row.dps)} peak DPS this wave"><span class="tower-dps-position" aria-hidden="true">${index+1}</span><img src="${escape(portrait)}" alt=""><span class="tower-dps-name"><strong>${escape(name)}</strong><small>#${row.id} · ${stats.advanced?'Champion':`Rank ${rank}`}</small></span><strong class="tower-dps-value">${number(row.dps)}</strong><span class="tower-dps-bar" aria-hidden="true" style="width:${highest?row.dps/highest*100:0}%"></span></button></li>`;
  }).join('')}</ol>`:'<p class="tower-dps-empty">Build a defender to track its damage.</p>'}`;
}

const rendered=new WeakMap();
export function updateTowerDpsPanel(panel,rows,data,images,options){
  const contents=towerDpsContents(rows,data,images,options);
  if(rendered.get(panel)===contents)return;
  const focused=panel.contains(panel.ownerDocument.activeElement)?panel.ownerDocument.activeElement.closest('[data-action="tower-dps-select"]')?.dataset.id:null;
  const scroll=panel.querySelector('.tower-dps-list')?.scrollTop||0;
  panel.innerHTML=contents;rendered.set(panel,contents);
  const list=panel.querySelector('.tower-dps-list');if(list)list.scrollTop=scroll;
  if(focused&&/^\d+$/.test(focused))panel.querySelector(`[data-id="${focused}"]`)?.focus({preventScroll:true});
}
