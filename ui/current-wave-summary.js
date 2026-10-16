import {currentWarbandInfo} from '../game/core/warband-info.js';
import {enemyNumber} from '../game/core/enemy-rules.js';
import {enemyTraitsMarkup} from './enemy-trait-symbols.js';
import {battlefieldDisclosureMarkup,updateBattlefieldDisclosure} from './tower-dps.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const count=value=>Number.isFinite(value)?Math.max(0,Math.floor(value)):0;
const number=value=>Number.isFinite(value)?enemyNumber(value):'Unavailable';

function summaryParts(game,data,images,options){
  if(game?.phase!=='combat')return null;
  // Individual HP, effects and positions are outside this composition note.
  // currentWarbandInfo supplies only effective remaining stat profiles.
  const profiles=currentWarbandInfo(game),live=game.combat.enemies.filter(enemy=>!enemy.dead).length,queued=game.combat.spawnQueue.length,remaining=live+queued,wave=count(game.round);
  const summary=`<span class="current-wave-heading"><strong>Current wave ${wave}</strong><small>${remaining} remaining · ${live} on field · ${queued} queued</small></span>`;
  const body=`<h2 class="current-wave-name">${escape(game.wave?.name||`Wave ${wave}`)}</h2>${profiles.map(row=>{
    const portrait=images['enemy:'+row.type];
    return `<article class="current-wave-summary-group"><header>${portrait?`<img src="${escape(portrait)}" alt="" draggable="false">`:''}<h3>${count(row.count)} × ${escape(row.name||'Invaders')}</h3></header><p>${count(row.liveCount)} on field · ${count(row.queuedCount)} queued</p><p>${number(row.maxHp)} maximum HP each · ${number(row.armor)} armor · ${row.flying?'Airborne':'Ground'}</p>${enemyTraitsMarkup(row.traitDetails)}</article>`;
  }).join('')||'<p class="current-wave-empty">No invaders remain.</p>'}<button type="button" class="text-button current-wave-inspect" data-action="inspect-wave" data-overlay-focus="inspect-wave">Inspect current wave</button>`;
  return {summary,body,kind:'current-wave-summary',summaryLabel:`Current wave ${wave}; ${remaining} remaining; ${live} on field; ${queued} queued`,bodyLabel:'Current wave resistances and abilities',scrollSelector:'.current-wave-summary-body',open:options.open!==false};
}

export function currentWaveSummaryMarkup(game,data=game?.data,images={},options={}){
  const parts=summaryParts(game,data,images,options);return parts?battlefieldDisclosureMarkup(parts):'';
}

// Next and Current intentionally use the same disclosure host. The shared
// updater preserves the user's open choice and mounted keyboard target.
export function updateCurrentWaveSummaryPanel(host,game,data=game?.data,images={},options={}){
  const parts=summaryParts(game,data,images,options);host.hidden=!parts;
  return parts?updateBattlefieldDisclosure(host,parts):false;
}
