import {towerStats} from '../game/core/math.js';
import {rankLabel} from '../game/core/recipes.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>value.toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1});
const explanation='Highest actual DPS over a 5-game-second window in this wave';

export function towerDpsContents(rows,data,images,{phase='build',paused=false,wave=null}={}){
  return battlefieldDisclosureMarkup(dpsParts(rows,data,images,{phase,paused,wave}));
}

function dpsParts(rows,data,images,{phase='build',paused=false,wave=null}={}){
  const highest=rows[0]?.dps||0;
  const note=wave?`Wave ${wave}${phase==='combat'&&paused?' · Paused':''}`:phase==='combat'?`This wave${paused?' · Paused':''}`:'Measured during combat';
  const summary=`<span class="tower-dps-heading"><h2 title="${explanation}">Peak DPS this wave</h2><span>${rows.length} ${rows.length===1?'defender':'defenders'}</span></span>`;
  const body=`<p class="tower-dps-note">${note}</p>${rows.length?`<ol class="tower-dps-list" aria-label="Defenders ordered by peak actual DPS this wave">${rows.map((row,index)=>{
    const stats=towerStats(row,data),name=stats.name,rank=rankLabel(row.tier),portrait=images[`${row.family}:${row.tier}`]||images[row.family]||'';
    return `<li><button type="button" data-action="tower-dps-select" data-id="${row.id}" data-overlay-focus="${row.id}" aria-label="Select ${escape(name)}, rank ${rank}, defender ${row.id}, ${number(row.dps)} peak DPS this wave"><span class="tower-dps-position" aria-hidden="true">${index+1}</span><img src="${escape(portrait)}" alt=""><span class="tower-dps-name"><strong>${escape(name)}</strong><small>#${row.id} · ${stats.advanced?'Champion':`Rank ${rank}`}</small></span><strong class="tower-dps-value">${number(row.dps)}</strong><span class="tower-dps-bar" aria-hidden="true" style="width:${highest?row.dps/highest*100:0}%"></span></button></li>`;
  }).join('')}</ol>`:'<p class="tower-dps-empty">Build a defender to track its damage.</p>'}`;
  return {summary,body,kind:'tower-dps',scrollSelector:'.tower-dps-list'};
}

export function battlefieldDisclosureMarkup({summary,body,kind,open=true}){
  return `<details class="battlefield-overlay-disclosure ${kind}-disclosure"${open?' open':''}><summary class="battlefield-overlay-summary">${summary}</summary><div class="battlefield-overlay-content ${kind}-body" tabindex="0" aria-label="${kind==='tower-dps'?'Peak DPS list':'Next wave resistances and abilities'}">${body}</div></details>`;
}

const rendered=new WeakMap(),bound=new WeakSet();
// The native disclosure and summary stay mounted across damage and wave
// refreshes. Only changed copy/rows are replaced; the user's open state wins.
export function updateBattlefieldDisclosure(panel,parts){
  let state=rendered.get(panel);
  if(!state||!panel.contains(state.details)){
    panel.innerHTML=battlefieldDisclosureMarkup(parts);
    const details=panel.querySelector('.battlefield-overlay-disclosure'),summary=details.querySelector('summary'),body=details.querySelector('.battlefield-overlay-content');
    state={details,summary,body,summaryMarkup:parts.summary,bodyMarkup:parts.body,scroll:0};rendered.set(panel,state);
    const scrollBox=()=>body.matches(parts.scrollSelector)?body:body.querySelector(parts.scrollSelector);
    body.addEventListener('scroll',event=>{if(details.open&&event.target===scrollBox())state.scroll=event.target.scrollTop;},{capture:true});
    details.addEventListener('toggle',()=>{if(details.open){const scroll=scrollBox();if(scroll)scroll.scrollTop=state.scroll;}});
    if(!bound.has(panel)){
      const contain=event=>event.stopPropagation();panel.addEventListener('wheel',contain,{passive:true});panel.addEventListener('touchmove',contain,{passive:true});bound.add(panel);
    }
    return true;
  }
  if(state.summaryMarkup===parts.summary&&state.bodyMarkup===parts.body)return false;
  const {details,summary,body}=state,scrollBox=()=>body.matches(parts.scrollSelector)?body:body.querySelector(parts.scrollSelector);
  const previousScroll=scrollBox();if(details.open&&previousScroll)state.scroll=previousScroll.scrollTop;
  const active=panel.ownerDocument.activeElement,focused=body.contains(active)?active.closest('[data-overlay-focus]')?.dataset.overlayFocus:null;
  if(state.summaryMarkup!==parts.summary){summary.innerHTML=parts.summary;state.summaryMarkup=parts.summary;}
  if(state.bodyMarkup!==parts.body){body.innerHTML=parts.body;state.bodyMarkup=parts.body;}
  if(focused!==null&&focused!==undefined){
    const replacement=[...body.querySelectorAll('[data-overlay-focus]')].find(element=>element.dataset.overlayFocus===focused);
    (replacement||summary).focus({preventScroll:true});
  }
  const scroll=scrollBox();if(details.open&&scroll)scroll.scrollTop=state.scroll;
  return true;
}

export function updateTowerDpsPanel(panel,rows,data,images,options={}){
  return updateBattlefieldDisclosure(panel,dpsParts(rows,data,images,options));
}
