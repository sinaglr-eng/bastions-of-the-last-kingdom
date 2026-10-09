import {currentWarbandInfo} from '../game/core/warband-info.js';
import {enemyNumber} from '../game/core/enemy-rules.js';
import {enemyTraitsMarkup} from './enemy-trait-symbols.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const count=value=>Number.isFinite(value)?Math.max(0,Math.floor(value)):0;
const number=value=>enemyNumber(Number.isFinite(value)?value:0);
const health=value=>Number.isFinite(value)?Math.max(0,value):0;
const addHealth=(sum,value)=>Math.min(Number.MAX_VALUE,sum+value);

// Boss health is the combined health of revealed, living bosses only. Queued
// boss profiles remain known composition, not current health on the field.
// Check visibility before reading HP; concealed HP must not enter even ARIA.
function bossHealthMarkup(game){
  let hp=0,maxHp=0,visible=0,concealed=0,approaching=0;
  for(const enemy of game.combat.enemies){
    if(!enemy.boss||enemy.dead)continue;
    if(!game.combat.isRevealed(enemy)){concealed++;continue;}
    visible++;const maximum=health(enemy.maxHp);
    maxHp=addHealth(maxHp,maximum);hp=addHealth(hp,Math.min(maximum,health(enemy.hp)));
  }
  for(const queued of game.combat.spawnQueue){
    const definition={...game.data.enemies[queued.type],...queued.modifiers?.variant};
    if(definition.boss)approaching++;
  }
  const waiting=[approaching?`${approaching} ${approaching===1?'boss':'bosses'} approaching`:'',concealed?`${concealed} concealed ${concealed===1?'boss':'bosses'}`:''].filter(Boolean).join(' · ');
  if(visible&&maxHp>0){
    hp=Math.min(hp,maxHp);
    const label=concealed?'Revealed boss health':visible>1?'Combined boss health':'Boss health',value=`${number(hp)} / ${number(maxHp)} HP`,percent=Number((hp/maxHp*100).toFixed(3));
    return `<div class="current-wave-boss-health"><div class="current-wave-boss-heading"><span>${label}</span><strong>${value}</strong></div><div class="current-wave-boss-track" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="${maxHp}" aria-valuenow="${hp}" aria-valuetext="${escape(value)}"><span class="current-wave-boss-fill" style="width:${percent}%"></span></div>${waiting?`<p class="current-wave-boss-status">${waiting}</p>`:''}</div>`;
  }
  const state=visible?'Boss health unavailable':concealed?'Boss concealed':approaching?(approaching===1?'Boss approaching':'Bosses approaching'):'Boss defeated';
  const note=concealed?'Reveal the boss to see its current health.':approaching?'Health appears when the boss enters the field.':'';
  return `<div class="current-wave-boss-health"><div class="current-wave-boss-heading"><strong>${state}</strong></div>${note?`<p class="current-wave-boss-status">${note}</p>`:''}${concealed&&approaching?`<p class="current-wave-boss-status">${approaching} ${approaching===1?'boss':'bosses'} approaching</p>`:''}</div>`;
}

// Other invaders contribute only aggregate profiles. Individual positions,
// IDs, active effects and concealed health remain outside this panel.
export function currentWavePanelMarkup(game,{images={},rows}={}){
  if(game?.phase!=='combat')return '';
  const profiles=rows??currentWarbandInfo(game),remaining=profiles.reduce((sum,row)=>sum+count(row.count),0),live=profiles.reduce((sum,row)=>sum+count(row.liveCount),0),queued=profiles.reduce((sum,row)=>sum+count(row.queuedCount),0);
  const title=game.wave?.name||`Wave ${game.round}`;
  return `<section class="current-wave-panel" aria-label="Current enemy wave" data-current-wave="${count(game.round)}">
    <div class="eyebrow">${game.wave?.boss?'WARLORD ASSAULT':'CURRENT ASSAULT'} · WAVE ${count(game.round)}</div><h2>${escape(title)}</h2>
    ${game.wave?.boss?bossHealthMarkup(game):`<div class="current-wave-remaining" role="status" aria-live="off"><strong>${remaining}</strong><span>invaders remaining</span></div>`}
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
