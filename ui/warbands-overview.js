import {warbandCardsMarkup} from './warband-cards.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Round identifies the assault currently being prepared or fought. Only the
// reward phase has completed that round before nextRound increments it.
export function remainingWarbands(waves,{round=1,phase='build',waveLimit=waves.length}={}){
  const limit=Math.min(waves.length,Number.isSafeInteger(waveLimit)&&waveLimit>=0?waveLimit:waves.length),current=Number.isSafeInteger(round)&&round>0?round:1;
  const completed=Math.min(limit,Math.max(0,phase==='won'?limit:current-1+(phase==='reward'?1:0)));
  return {completed,total:limit,firstWave:completed+1,waves:waves.slice(completed,limit)};
}

export function warbandsOverviewMarkup(waves,enemies,images,{balance,round=1,phase='build',waveLimit=waves.length,liveWarband,liveBossHealth,developerMode=false,atlas=false,selectedWave=null}={}){
  const remaining=remainingWarbands(waves,{round,phase,waveLimit}),count=remaining.waves.length;
  const currentNumber=Math.min(remaining.total,Math.max(1,Number.isSafeInteger(round)?round:1));
  const progress=developerMode?`<p class="warbands-progress">${remaining.total?`Wave ${currentNumber} · ${count?(phase==='reward'?'upcoming waves':'current and upcoming waves'):'end of wave guide'}`:'No waves in this guide'}</p><p class="warbands-guide-note">Developer Mode / Sandbox guide · earlier waves may have been skipped.</p>`:`<p class="warbands-progress">${remaining.completed} ${remaining.completed===1?'wave':'waves'} completed · ${count} ${count===1?'wave':'waves'} remaining</p>`;
  if(atlas&&count){
    const selected=Number.isSafeInteger(selectedWave)&&selectedWave>=remaining.firstWave&&selectedWave<=remaining.total?selectedWave:remaining.firstWave;
    const index=remaining.waves.map((wave,index)=>{const number=remaining.firstWave+index;return `<button type="button" data-atlas-wave="${number}" data-atlas-current="${number===round}" data-atlas-boss="${!!wave.boss}" aria-pressed="${number===selected}" aria-label="Inspect wave ${number}: ${escape(wave.name||enemies[wave.groups[0].type].name)}${wave.boss?' · Boss wave':''}">${number}</button>`;}).join('');
    const page=warbandCardsMarkup([waves[selected-1]],enemies,images,{balance,startWave:selected,currentWave:round,phase,liveWarband,compact:true,expanded:true,atlas:true});
    return `<section class="warbands-overview warbands-atlas" aria-label="Enemy waves atlas" data-first-wave="${remaining.firstWave}" data-wave-limit="${remaining.total}" data-selected-wave="${selected}">${progress}<nav class="warbands-atlas-index" aria-label="Wave index"><h3>Wave index</h3><div class="warbands-atlas-pages">${index}</div><div class="warbands-atlas-legend"><span class="atlas-current-key">▢ Current campaign wave ${currentNumber}</span><span>Gold · selected page ${selected}</span><span class="atlas-boss-key">◆ Boss wave</span></div></nav><div class="warbands-atlas-report" aria-live="polite">${page}</div></section>`;
  }
  const cards=count?`<section class="warbands-remaining" aria-labelledby="warbands-remaining-title"><h3 id="warbands-remaining-title">${developerMode||phase==='combat'?'Current and upcoming waves':'Remaining waves'}</h3><p class="warbands-guide-note">Open a row for effective stats and possible variants. Variant choices are independent for each invader.</p><div class="warband-grid">${warbandCardsMarkup(remaining.waves,enemies,images,{balance,startWave:remaining.firstWave,currentWave:round,phase,liveWarband,liveBossHealth,compact:true})}</div></section>`:`<p class="warbands-empty">${developerMode?'No later waves in this guide.':phase==='won'?'All waves completed. The kingdom stands.':'No remaining waves in this campaign.'}</p>`;
  return `<section class="warbands-overview" aria-label="Remaining warbands" data-first-wave="${remaining.firstWave}" data-wave-limit="${remaining.total}">${progress}${cards}</section>`;
}

// Refresh only this overview host, preserving native disclosure choices and
// its scrolling container. A new wave owns a new set of disclosure keys.
const rendered=new WeakMap();
const atlasPanels=new WeakMap();
export function updateWarbandsOverview(host,markup,{scrollContainer=host.closest?.('.dialog-body')||host}={}){
  if(rendered.get(host)===markup||host.innerHTML===markup){rendered.set(host,markup);return false;}
  const key=details=>details.dataset?.warbandDisclosure||`${details.closest('[data-wave]')?.dataset.wave||''}:${[...host.querySelectorAll('details')].filter(node=>node.closest('[data-wave]')===details.closest('[data-wave]')).indexOf(details)}`;
  const disclosures=new Map([...host.querySelectorAll('details')].map(details=>[key(details),details.open])),scrollTop=scrollContainer.scrollTop,focused=(host.ownerDocument?.activeElement)?.closest?.('details'),focusKey=focused&&host.contains(focused)?key(focused):null;
  host.innerHTML=markup;
  for(const details of host.querySelectorAll('details')){const detailKey=key(details);if(disclosures.has(detailKey))details.open=disclosures.get(detailKey);if(detailKey===focusKey)details.querySelector('summary')?.focus({preventScroll:true});}
  scrollContainer.scrollTop=scrollTop;rendered.set(host,markup);return true;
}

export function updateWarbandsOverviewPanel(host,waves,enemies,images,options={}){
  if(options.atlas){
    let state=atlasPanels.get(host);
    if(!state){
      state={selectedWave:null,args:null};atlasPanels.set(host,state);
      host.addEventListener('click',event=>{
        const button=event.target.closest?.('[data-atlas-wave]');
        if(!button||button.disabled||!host.contains(button)||!state.args)return;
        const [currentWaves,currentEnemies,currentImages,currentOptions]=state.args,number=Number(button.dataset.atlasWave),remaining=remainingWarbands(currentWaves,currentOptions);
        if(!Number.isSafeInteger(number)||number<remaining.firstWave||number>remaining.total)return;
        state.selectedWave=number;
        updateWarbandsOverviewPanel(host,currentWaves,currentEnemies,currentImages,currentOptions);
        host.querySelector('.warbands-atlas-pages')?.querySelector(`[data-atlas-wave="${number}"]`)?.focus({preventScroll:true});
        host.querySelector('.warbands-atlas-report')?.scrollIntoView?.({block:'nearest'});
      });
    }
    state.args=[waves,enemies,images,options];
    const remaining=remainingWarbands(waves,options);
    if(!Number.isSafeInteger(state.selectedWave)||state.selectedWave<remaining.firstWave||state.selectedWave>remaining.total)state.selectedWave=remaining.firstWave;
    const focused=host.ownerDocument?.activeElement,focusedWave=focused&&host.contains(focused)?focused.dataset?.atlasWave:null;
    const changed=updateWarbandsOverview(host,warbandsOverviewMarkup(waves,enemies,images,{...options,selectedWave:state.selectedWave}),options);
    if(changed&&focusedWave)host.querySelector('.warbands-atlas-pages')?.querySelector(`[data-atlas-wave="${focusedWave}"]`)?.focus({preventScroll:true});
    return changed;
  }
  return updateWarbandsOverview(host,warbandsOverviewMarkup(waves,enemies,images,options),options);
}
