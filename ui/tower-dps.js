import {towerStats} from '../game/core/math.js';
import {rankLabel} from '../game/core/recipes.js';
import {mvpLevel} from '../game/core/mvp.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>value.toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1});

export function towerDpsContents(rows,data,images,options={}){
  return battlefieldDisclosureMarkup(dpsParts(rows,data,images,options));
}

function dpsParts(rows,data,images,{phase='build',paused=false,wave=null,measured=wave!==null||rows.length>0,completed=phase!=='combat'&&wave!==null}={}){
  const highest=rows[0]?.dps||0;
  const total=rows.reduce((sum,row)=>sum+(Number.isFinite(row.dps)&&row.dps>0?row.dps:0),0);
  const score=measured?number(total):'—',context=wave?`${completed?'Last wave':'Wave'} ${wave}`:'Not measured';
  const summary=`<span class="tower-dps-heading"><span>Σ Peak DPS</span><strong class="tower-dps-summary-score" title="Sum of individual defender peak DPS this wave">${score}</strong><span class="tower-dps-summary-context" title="${context}${phase==='combat'&&paused?' · Paused':''}">${wave?`· W${wave}`:''}</span></span>`;
  const body=`<h2 title="Sum of individual defender peak DPS this wave">Sum peak DPS</h2>${rows.length?`<ol class="tower-dps-list" aria-label="Defenders ordered by peak actual DPS this wave">${rows.map((row,index)=>{
    const stats=towerStats(row,data),name=stats.name,rank=rankLabel(row.tier),portrait=images[`${row.family}:${row.tier}`]||(stats.advanced?images[row.family]:null);
    return `<li><button type="button" data-action="tower-dps-select" data-id="${row.id}" data-overlay-focus="${row.id}"${row.selectable===false?' disabled':''} aria-label="${row.archived?'Measured':'Select'} ${escape(name)}, rank ${rank}, defender ${row.id}, MVP ${mvpLevel(row)}, ${number(row.dps)} peak DPS${row.archived?'; combined or removed after this wave':' this wave'}"><span class="tower-dps-position" aria-hidden="true">${index+1}</span>${portrait?`<img src="${escape(portrait)}" alt="">`:'<span class="tower-dps-portrait-unavailable" aria-hidden="true"></span>'}<span class="tower-dps-name"><strong>${escape(name)}</strong><small>#${row.id} · ${stats.advanced?'Champion':`Rank ${rank}`} · MVP ${mvpLevel(row)}${row.archived?' · Combined / removed':''}</small></span><strong class="tower-dps-value">${number(row.dps)}</strong><span class="tower-dps-bar" aria-hidden="true" style="width:${highest?row.dps/highest*100:0}%"></span></button></li>`;
  }).join('')}</ol>`:`<p class="tower-dps-empty">${measured?'No defender damage recorded.':'Not measured yet'}</p>`}`;
  return {summary,body,kind:'tower-dps',summaryLabel:`Peak DPS ${score}; ${context}; sum of individual defender peaks`,bodyLabel:'Peak DPS list',scrollSelector:'.tower-dps-list',open:true};
}

const disclosureLabel=(parts,open)=>`${open?'Collapse':'Expand'} ${parts.summaryLabel||parts.kind.replaceAll('-',' ')}`;
const bodyLabel=parts=>parts.bodyLabel||(parts.kind==='tower-dps'?'Peak DPS list':'Next wave resistances and abilities');
export function battlefieldDisclosureMarkup(parts){
  const {summary,body,kind,open=true}=parts;
  return `<details class="battlefield-overlay-disclosure ${kind}-disclosure"${open?' open':''}><summary class="battlefield-overlay-summary" aria-label="${escape(disclosureLabel(parts,open))}">${summary}</summary><div class="battlefield-overlay-content ${kind}-body" tabindex="0" aria-label="${escape(bodyLabel(parts))}">${body}</div></details>`;
}

const rendered=new WeakMap(),bound=new WeakSet();
// The native disclosure and summary stay mounted across damage and wave
// refreshes. Only changed copy/rows are replaced; the user's open state wins.
export function updateBattlefieldDisclosure(panel,parts){
  let state=rendered.get(panel);
  if(!state||!panel.contains(state.details)){
    panel.innerHTML=battlefieldDisclosureMarkup(parts);
    const details=panel.querySelector('.battlefield-overlay-disclosure'),summary=details.querySelector('summary'),body=details.querySelector('.battlefield-overlay-content');
    state={details,summary,body,parts,summaryMarkup:parts.summary,bodyMarkup:parts.body,scroll:0};rendered.set(panel,state);
    const scrollBox=()=>body.matches(state.parts.scrollSelector)?body:body.querySelector(state.parts.scrollSelector);
    body.addEventListener('scroll',event=>{if(details.open&&event.target===scrollBox())state.scroll=event.target.scrollTop;},{capture:true});
    details.addEventListener('toggle',()=>{summary.setAttribute('aria-label',disclosureLabel(state.parts,details.open));if(details.open){const scroll=scrollBox();if(scroll)scroll.scrollTop=state.scroll;}});
    if(!bound.has(panel)){
      const contain=event=>event.stopPropagation();panel.addEventListener('wheel',contain,{passive:true});panel.addEventListener('touchmove',contain,{passive:true});bound.add(panel);
    }
    return true;
  }
  if(state.summaryMarkup===parts.summary&&state.bodyMarkup===parts.body&&state.parts.kind===parts.kind&&state.parts.summaryLabel===parts.summaryLabel&&state.parts.bodyLabel===parts.bodyLabel&&state.parts.scrollSelector===parts.scrollSelector)return false;
  const {details,summary,body}=state,scrollBox=()=>body.matches(state.parts.scrollSelector)?body:body.querySelector(state.parts.scrollSelector);
  const previousScroll=scrollBox();if(details.open&&previousScroll)state.scroll=previousScroll.scrollTop;
  const active=panel.ownerDocument.activeElement,focused=body.contains(active)?active.closest('[data-overlay-focus]')?.dataset.overlayFocus:null;
  if(state.parts.kind!==parts.kind){state.scroll=0;details.setAttribute('class',`battlefield-overlay-disclosure ${parts.kind}-disclosure`);body.setAttribute('class',`battlefield-overlay-content ${parts.kind}-body`);}
  state.parts=parts;summary.setAttribute('aria-label',disclosureLabel(parts,details.open));body.setAttribute('aria-label',bodyLabel(parts));
  if(state.summaryMarkup!==parts.summary){summary.innerHTML=parts.summary;state.summaryMarkup=parts.summary;}
  if(state.bodyMarkup!==parts.body){body.innerHTML=parts.body;state.bodyMarkup=parts.body;}
  if(focused!==null&&focused!==undefined){
    const replacement=[...body.querySelectorAll('[data-overlay-focus]')].find(element=>element.dataset.overlayFocus===focused&&!element.disabled);
    (replacement||summary).focus({preventScroll:true});
  }
  const scroll=scrollBox();if(details.open&&scroll)scroll.scrollTop=state.scroll;
  return true;
}

export function updateTowerDpsPanel(panel,rows,data,images,options={}){
  return updateBattlefieldDisclosure(panel,dpsParts(rows,data,images,options));
}
