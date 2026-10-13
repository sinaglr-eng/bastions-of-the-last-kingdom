import {warbandCardsMarkup} from './warband-cards.js';
import {wavePreviewMarkup} from './wave-preview.js';

function jumpMarkup(waves,remaining,selectedWave,developerMode=false){
  if(!remaining.total)return '';
  const selected=Number.isSafeInteger(selectedWave)&&selectedWave>0&&selectedWave<=remaining.total?selectedWave:Math.min(remaining.firstWave,remaining.total);
  const option=(wave,index)=>`<option value="${index+1}"${selected===index+1?' selected':''}>Wave ${index+1}${wave.boss?' · Boss':''}${index+1<remaining.firstWave?` · ${developerMode?'Prior wave':'Completed'}`:''}</option>`;
  const bosses=waves.slice(0,remaining.total).flatMap((wave,index)=>wave.boss?[{wave,index}]:[]);
  return `<nav class="warband-quick-jump" aria-label="Enemy wave navigation"><label for="warband-jump">Jump to wave or boss</label><select id="warband-jump" data-warband-jump-select data-warband-focus="jump">${waves.slice(0,remaining.total).map(option).join('')}</select><button type="button" class="text-button" data-warband-jump data-warband-focus="go">Go</button>${bosses.length?`<details class="warband-boss-jumps" data-warband-disclosure="boss-jumps"><summary>Boss waves</summary><div>${bosses.map(({index})=>`<button type="button" class="text-button" data-warband-jump="${index+1}" data-warband-focus="boss:${index+1}">Boss ${index+1}</button>`).join('')}</div></details>`:''}</nav>`;
}

// Round identifies the assault currently being prepared or fought. Only the
// reward phase has completed that round before nextRound increments it.
export function remainingWarbands(waves,{round=1,phase='build',waveLimit=waves.length}={}){
  const limit=Math.min(waves.length,Number.isSafeInteger(waveLimit)&&waveLimit>=0?waveLimit:waves.length),current=Number.isSafeInteger(round)&&round>0?round:1;
  const completed=Math.min(limit,Math.max(0,phase==='won'?limit:current-1+(phase==='reward'?1:0)));
  return {completed,total:limit,firstWave:completed+1,waves:waves.slice(completed,limit)};
}

export function warbandsOverviewMarkup(waves,enemies,images,{balance,round=1,phase='build',waveLimit=waves.length,intelligence=null,data={},liveWarband,liveBossHealth,selectedWave=null,developerMode=false}={}){
  const remaining=remainingWarbands(waves,{round,phase,waveLimit}),count=remaining.waves.length;
  // Do not retain a stale completed/out-of-campaign intelligence header.
  const previewNumber=intelligence?.next?.number,showIntelligence=count>0&&Number.isSafeInteger(previewNumber)&&previewNumber>=remaining.firstWave&&previewNumber<=remaining.total&&!['won','lost'].includes(phase);
  const currentNumber=Math.min(remaining.total,Math.max(1,Number.isSafeInteger(round)?round:1));
  const progress=developerMode?`<p class="warbands-progress">${remaining.total?`Wave ${currentNumber} · ${count?(phase==='reward'?'upcoming waves':'current and upcoming waves'):'end of wave guide'}`:'No waves in this guide'}</p><p class="warbands-guide-note">Developer Mode / Sandbox guide · earlier waves may have been skipped.</p>`:`<p class="warbands-progress">${remaining.completed} ${remaining.completed===1?'wave':'waves'} completed · ${count} ${count===1?'wave':'waves'} remaining</p>`;
  const header=showIntelligence?`<div class="warbands-overview-intelligence" data-intelligence-wave="${previewNumber}"><details class="warbands-intelligence-details"><summary>Next wave and army response</summary>${wavePreviewMarkup(intelligence,data,images,{compact:false,headingId:'warbands-intelligence-title'})}</details></div>`:'';
  const history=Number.isSafeInteger(selectedWave)&&selectedWave>0&&selectedWave<remaining.firstWave&&selectedWave<=remaining.total?`<section class="warbands-history" aria-label="Selected ${developerMode?'prior':'completed'} wave"><h3>${developerMode?'Prior':'Completed'} wave ${selectedWave}</h3>${warbandCardsMarkup([waves[selectedWave-1]],enemies,images,{balance,startWave:selectedWave,compact:true})}</section>`:'';
  const cards=count?`<section class="warbands-remaining" aria-labelledby="warbands-remaining-title"><h3 id="warbands-remaining-title">${developerMode||phase==='combat'?'Current and upcoming waves':'Remaining waves'}</h3><p class="warbands-guide-note">Open a row for effective stats and possible variants. Variant choices are independent for each invader.</p><div class="warband-grid">${warbandCardsMarkup(remaining.waves,enemies,images,{balance,startWave:remaining.firstWave,currentWave:round,phase,liveWarband,liveBossHealth,compact:true})}</div></section>`:`<p class="warbands-empty">${developerMode?'No later waves in this guide.':phase==='won'?'All waves completed. The kingdom stands.':'No remaining waves in this campaign.'}</p>`;
  return `<section class="warbands-overview" aria-label="Remaining warbands" data-first-wave="${remaining.firstWave}" data-wave-limit="${remaining.total}">${progress}${jumpMarkup(waves,remaining,selectedWave,developerMode)}${header}${history}${cards}</section>`;
}

// Refresh only this overview host, preserving native disclosure choices and
// its scrolling container. A new wave owns a new set of disclosure keys.
const rendered=new WeakMap();
export function updateWarbandsOverview(host,markup,{scrollContainer=host.closest?.('.dialog-body')||host}={}){
  if(rendered.get(host)===markup||host.innerHTML===markup){rendered.set(host,markup);return false;}
  const key=details=>details.dataset?.warbandDisclosure||`${details.closest('[data-intelligence-wave]')?.dataset.intelligenceWave||details.closest('[data-wave]')?.dataset.wave||''}:${[...host.querySelectorAll('details')].filter(node=>node.closest('[data-intelligence-wave]')===details.closest('[data-intelligence-wave]')).indexOf(details)}`;
  const disclosures=new Map([...host.querySelectorAll('details')].map(details=>[key(details),details.open])),scrollTop=scrollContainer.scrollTop,focused=(host.ownerDocument?.activeElement)?.closest?.('details'),focusKey=focused&&host.contains(focused)?key(focused):null;
  const active=host.ownerDocument?.activeElement,control=active?.closest?.('[data-warband-focus]'),controlKey=control&&host.contains(control)?control.dataset?.warbandFocus:null;
  host.innerHTML=markup;
  for(const details of host.querySelectorAll('details')){const detailKey=key(details);if(disclosures.has(detailKey))details.open=disclosures.get(detailKey);if(detailKey===focusKey)details.querySelector('summary')?.focus({preventScroll:true});}
  if(controlKey){const replacement=[...host.querySelectorAll('[data-warband-focus]')].find(node=>node.dataset?.warbandFocus===controlKey&&!node.disabled);replacement?.focus({preventScroll:true});}
  scrollContainer.scrollTop=scrollTop;rendered.set(host,markup);return true;
}

const navigation=new WeakMap();
export function updateWarbandsOverviewPanel(host,waves,enemies,images,options={}){
  let state=navigation.get(host);
  if(!state){
    state={selectedWave:null};navigation.set(host,state);
    host.addEventListener?.('click',event=>{
      const button=event.target.closest?.('[data-warband-jump]');if(!button||button.disabled)return;
      const selected=Number(button.dataset.warbandJump||host.querySelector('[data-warband-jump-select]')?.value),limit=remainingWarbands(state.waves,state.options).total;
      if(!Number.isSafeInteger(selected)||selected<1||selected>limit)return;
      event.preventDefault();event.stopPropagation();state.selectedWave=selected;
      updateWarbandsOverview(host,warbandsOverviewMarkup(state.waves,state.enemies,state.images,{...state.options,selectedWave:selected}),state.options);
      const card=host.querySelector(`[data-wave="${selected}"]`),detail=card?.querySelector('.warband-wave-details');
      if(detail){detail.open=true;detail.querySelector('summary')?.focus({preventScroll:true});card.scrollIntoView?.({block:'start',behavior:'auto'});}
    });
  }
  state.waves=waves;state.enemies=enemies;state.images=images;state.options=options;
  return updateWarbandsOverview(host,warbandsOverviewMarkup(waves,enemies,images,{...options,selectedWave:options.selectedWave??state.selectedWave}),options);
}
