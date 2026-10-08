import {enemyNumber} from '../game/core/enemy-rules.js';
import {warbandVariantInfo,configuredWarbandInfo} from '../game/core/warband-info.js';
import {ENEMY_AURA_STAGES,enemyAuraStage} from '../game/render/enemy-aura.js';
import {enemyTraitsMarkup} from './enemy-trait-symbols.js';

const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stats=info=>`${enemyNumber(info.maxHp)} HP · ${enemyNumber(info.armor)} armor · ${enemyNumber(info.speed)} tiles/s · ${info.flying?'Air':'Ground'}`;
const randomVariants=(wave,group,definition)=>definition.variants?.length>1&&!Object.hasOwn({...wave,...group},'variant');

function variantsMarkup(wave,group,definition){
  const modifiers={...wave,...group},variants=Object.hasOwn(modifiers,'variant')?[configuredWarbandInfo({...definition,type:group.type},modifiers)]:warbandVariantInfo({...definition,type:group.type},modifiers);
  return variants.map((info,index)=>`<section class="warband-variant" data-variant-index="${index}">${variants.length>1?`<strong>Variant ${index+1} · ${escape(info.name)}</strong>`:''}<p class="warband-stats">${stats(info)}</p>${enemyTraitsMarkup(info.traitDetails)}</section>`).join('');
}

function currentCompositionMarkup(rows){
  const valid=rows.filter(row=>row&&typeof row==='object'),count=valid.reduce((sum,row)=>sum+row.count,0),live=valid.reduce((sum,row)=>sum+row.liveCount,0),queued=valid.reduce((sum,row)=>sum+row.queuedCount,0);
  return `<section class="warband-live" aria-label="Actual remaining invaders"><h4>On the battlefield</h4><p class="warband-live-total">${enemyNumber(count)} remaining · ${enemyNumber(live)} on the field · ${enemyNumber(queued)} approaching</p>${valid.map(row=>`<article class="warband-live-profile" data-enemy="${escape(row.type)}"><strong>${enemyNumber(row.count)} × ${escape(row.name)}</strong><p>${enemyNumber(row.liveCount)} on the field · ${enemyNumber(row.queuedCount)} approaching</p><p class="warband-stats">${stats(row)}</p>${enemyTraitsMarkup(row.traitDetails)}</article>`).join('')}${valid.length?'':'<p class="minor-note">No invaders remain in this wave.</p>'}</section>`;
}

function bossHealthMarkup(health){
  if(!health||![health.hp,health.maxHp].every(value=>Number.isFinite(value)&&value>=0))return '';
  return `<section class="warband-boss-health" aria-label="Current boss health"><strong>Boss health</strong><p>${enemyNumber(health.hp)} / ${enemyNumber(health.maxHp)} HP${health.approaching?' · Approaching':''}</p><progress value="${Math.min(health.hp,health.maxHp)}" max="${Math.max(1,health.maxHp)}" aria-label="Current boss health"></progress></section>`;
}

// These are configured possibilities. Once combat starts, currentWarbandInfo
// supplies the actual per-variant live and queued counts to the command panel.
export function upcomingWarbandMarkup(wave,enemies,{balance}={}){
  if(!wave)return '';
  return wave.groups.map(group=>{
    const definition=enemies[group.type];
    return `<div class="upcoming-warband" data-enemy="${escape(group.type)}"><p><b>${enemyNumber(group.count)} ×</b> ${escape(definition.name)}</p><p class="threat">${escape(definition.threat)}</p>${randomVariants(wave,group,definition)?'<p class="minor-note">Each enemy independently chooses a random variant; the wave may contain a mix.</p>':''}${variantsMarkup(wave,group,definition)}<p class="wave-counter">${escape(definition.counter||'Build a longer route and focus fire at crossings.')}</p></div>`;
  }).join('');
}

export function warbandCardsMarkup(waves,enemies,images,{balance,startWave=1,currentWave=null,phase=null,liveWarband,liveBossHealth}={}){
  return waves.map((wave,index)=>{
    const first=enemies[wave.groups[0].type],number=startWave+index,current=number===currentWave;
    const groups=wave.groups.map(group=>{
      const definition=enemies[group.type],aura=ENEMY_AURA_STAGES[enemyAuraStage({...definition,type:group.type})].name;
      return `<div class="warband-group" data-enemy="${escape(group.type)}"><img src="${escape(images['enemy:'+group.type]||'')}" alt="${escape(definition.name)}"><h3>${escape(definition.name)}</h3><p class="warband-appearance">${escape(definition.appearance)}</p><small>${escape(aura)}</small><p>${enemyNumber(group.count)} ${wave.boss?'warlord':'invaders'}</p><strong class="warband-traits">${escape(definition.threat)}</strong>${randomVariants(wave,group,definition)?'<p class="minor-note">Each enemy independently chooses a random variant; the wave may contain a mix.</p>':''}${variantsMarkup(wave,group,definition)}<p class="wave-counter">${escape(definition.counter||'Focus your damage along the route.')}</p></div>`;
    }).join('');
    return `<article class="warband-card ${wave.boss?'boss':''}${current?' current':''}" data-wave="${number}"${current?' data-current-wave="true"':''}><div class="eyebrow">WAVE ${String(number).padStart(2,'0')} · ${wave.boss?'WARLORD · ':''}${first.flying?'AIR':'GROUND'}</div>${current?`<p class="warband-wave-status">${phase==='combat'?'In combat':phase==='lost'?'Run ended · wave not completed':'Next assault'}</p>`:''}${wave.name?`<h2 class="warband-wave-name">${escape(wave.name)}</h2>`:''}${current&&phase==='combat'&&wave.boss?bossHealthMarkup(liveBossHealth):''}${current&&phase==='combat'&&Array.isArray(liveWarband)?currentCompositionMarkup(liveWarband):''}${groups}</article>`;
  }).join('');
}
