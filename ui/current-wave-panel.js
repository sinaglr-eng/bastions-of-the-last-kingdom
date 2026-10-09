import {currentWarbandInfo} from '../game/core/warband-info.js';
import {enemyNumber} from '../game/core/enemy-rules.js';
import {enemyTraitsMarkup} from './enemy-trait-symbols.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const count=value=>Number.isFinite(value)?Math.max(0,Math.floor(value)):0;
const number=value=>enemyNumber(Number.isFinite(value)?value:0);

// Only aggregate profiles enter this panel. Individual HP, positions and IDs
// belong to the revealed-enemy inspection and are never read here.
export function currentWavePanelMarkup(game,{images={},rows}={}){
  if(game?.phase!=='combat')return '';
  const profiles=rows??currentWarbandInfo(game),remaining=profiles.reduce((sum,row)=>sum+count(row.count),0),live=profiles.reduce((sum,row)=>sum+count(row.liveCount),0),queued=profiles.reduce((sum,row)=>sum+count(row.queuedCount),0);
  const title=game.wave?.name||`Wave ${game.round}`;
  return `<section class="current-wave-panel" aria-label="Current enemy wave" data-current-wave="${count(game.round)}">
    <div class="eyebrow">${game.wave?.boss?'WARLORD ASSAULT':'CURRENT ASSAULT'} · WAVE ${count(game.round)}</div><h2>${escape(title)}</h2>
    <div class="current-wave-remaining" role="status" aria-live="off"><strong>${remaining}</strong><span>invaders remaining</span></div>
    <p class="current-wave-counts">${live} on the field · ${queued} approaching</p>
    <div class="current-wave-profiles">${profiles.map(row=>{
      const portrait=images['enemy:'+row.type];
      return `<article class="current-wave-profile"><div class="current-wave-profile-heading">${portrait?`<img src="${escape(portrait)}" alt="" draggable="false">`:''}<div><span class="current-wave-profile-movement">${row.flying?'AIRBORNE':'GROUND'}</span><h3>${escape(row.name||'Invaders')}</h3><p>${count(row.count)} remaining · ${count(row.liveCount)} on field · ${count(row.queuedCount)} approaching</p></div></div>
        <dl class="current-wave-profile-stats"><div><dt>Maximum health</dt><dd>${number(row.maxHp)} HP</dd></div><div><dt>Armor</dt><dd>${number(row.armor)}</dd></div><div><dt>Base speed</dt><dd>${number(row.speed)} tiles/s</dd></div></dl>
        ${enemyTraitsMarkup(row.traitDetails)}
      </article>`;
    }).join('')||'<p class="current-wave-empty">No invaders remain.</p>'}</div>
    <p class="current-wave-inspection-note">Select a revealed invader to inspect its remaining health and current effects.</p>
  </section>`;
}

const renderedContents=new WeakMap();
export function updateCurrentWavePanel(panel,game,options){
  const markup=currentWavePanelMarkup(game,options);if(renderedContents.get(panel)===markup)return false;
  const body=panel.closest?.('.side-body, #side-body')||panel,scrollTop=body.scrollTop,scrollLeft=body.scrollLeft;
  panel.innerHTML=markup;renderedContents.set(panel,markup);
  if(Number.isFinite(scrollTop))body.scrollTop=scrollTop;if(Number.isFinite(scrollLeft))body.scrollLeft=scrollLeft;
  return true;
}
