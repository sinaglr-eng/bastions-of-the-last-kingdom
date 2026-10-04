import {enemyNumber} from '../game/core/enemy-rules.js';
import {warbandVariantInfo} from '../game/core/warband-info.js';
import {ENEMY_AURA_STAGES,enemyAuraStage} from '../game/render/enemy-aura.js';
import {enemyTraitsMarkup} from './enemy-trait-symbols.js';

const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stats=info=>`${enemyNumber(info.maxHp)} HP · ${enemyNumber(info.armor)} armor · ${enemyNumber(info.speed)} tiles/s · ${info.flying?'Air':'Ground'}`;

function variantsMarkup(wave,group,definition){
  const variants=warbandVariantInfo({...definition,type:group.type},{...wave,...group});
  return variants.map((info,index)=>`<section class="warband-variant" data-variant-index="${index}">${definition.variants?`<strong>Variant ${index+1} · ${escape(info.name)}</strong>`:''}<p class="warband-stats">${stats(info)}</p>${enemyTraitsMarkup(info.traitDetails)}</section>`).join('');
}

// These are configured possibilities. Once combat starts, currentWarbandInfo
// supplies the actual per-variant live and queued counts to the command panel.
export function upcomingWarbandMarkup(wave,enemies,{balance}={}){
  if(!wave)return '';
  return wave.groups.map(group=>{
    const definition=enemies[group.type];
    return `<div class="upcoming-warband" data-enemy="${escape(group.type)}"><p><b>${enemyNumber(group.count)} ×</b> ${escape(definition.name)}</p><p class="threat">${escape(definition.threat)}</p>${definition.variants?.length>1?'<p class="minor-note">Each enemy independently chooses a random variant; the wave may contain a mix.</p>':''}${variantsMarkup(wave,group,definition)}<p class="wave-counter">${escape(definition.counter||'Build a longer route and focus fire at crossings.')}</p></div>`;
  }).join('');
}

export function warbandCardsMarkup(waves,enemies,images,{balance}={}){
  return waves.map((wave,index)=>{
    const first=enemies[wave.groups[0].type];
    const groups=wave.groups.map(group=>{
      const definition=enemies[group.type],aura=ENEMY_AURA_STAGES[enemyAuraStage({...definition,type:group.type})].name;
      return `<div class="warband-group" data-enemy="${escape(group.type)}"><img src="${escape(images['enemy:'+group.type]||'')}" alt="${escape(definition.name)}"><h3>${escape(definition.name)}</h3><p class="warband-appearance">${escape(definition.appearance)}</p><small>${escape(aura)}</small><p>${enemyNumber(group.count)} ${wave.boss?'warlord':'invaders'}</p><strong class="warband-traits">${escape(definition.threat)}</strong>${definition.variants?.length>1?'<p class="minor-note">Each enemy independently chooses a random variant; the wave may contain a mix.</p>':''}${variantsMarkup(wave,group,definition)}<p class="wave-counter">${escape(definition.counter||'Focus your damage along the route.')}</p></div>`;
    }).join('');
    return `<article class="warband-card ${wave.boss?'boss':''}" data-wave="${index+1}"><div class="eyebrow">WAVE ${String(index+1).padStart(2,'0')} · ${wave.boss?'WARLORD · ':''}${first.flying?'AIR':'GROUND'}</div>${groups}</article>`;
  }).join('');
}
