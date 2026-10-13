import {enemyNumber,enemyRulesFor} from '../game/core/enemy-rules.js';
import {warbandVariantInfo,configuredWarbandInfo} from '../game/core/warband-info.js';
import {ENEMY_AURA_STAGES,enemyAuraStage} from '../game/render/enemy-aura.js';
import {enemyTraitsMarkup} from './enemy-trait-symbols.js';

const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stats=info=>`${enemyNumber(info.maxHp)} HP · ${enemyNumber(info.armor)} armor · ${enemyNumber(info.speed)} tiles/s · ${info.flying?'Air':'Ground'}`;
const randomVariants=(wave,group,definition)=>definition.variants?.length>1&&!Object.hasOwn({...wave,...group},'variant');

export function warbandVariantComparison(wave,group,definition,{balance}={}){
  const modifiers={...wave,...group},choices=Object.hasOwn(modifiers,'variant')?[modifiers.variant]:definition.variants?.length?definition.variants:[undefined];
  const variants=choices.map(variant=>configuredWarbandInfo({...definition,type:group.type},{...modifiers,variant},enemyRulesFor({balance})));
  const fields=['maxHp','armor','speed','flying'],commonStats=Object.fromEntries(fields.filter(key=>variants.every(info=>info[key]===variants[0][key])).map(key=>[key,variants[0][key]]));
  const key=trait=>JSON.stringify([trait.kind||null,trait.text]),commonTraits=variants[0].traitDetails.filter(trait=>variants.every(info=>info.traitDetails.some(other=>key(other)===key(trait))));
  const shared=new Set(commonTraits.map(key));
  return {variants,commonStats,commonTraits,differences:variants.map(info=>({info,stats:Object.fromEntries(fields.filter(field=>!Object.hasOwn(commonStats,field)).map(field=>[field,info[field]])),traits:info.traitDetails.filter(trait=>!shared.has(key(trait)))})),identical:variants.length>1&&fields.every(field=>Object.hasOwn(commonStats,field))&&variants.every(info=>info.traitDetails.length===commonTraits.length)};
}

function comparisonMarkup(wave,group,definition,options){
  const model=warbandVariantComparison(wave,group,definition,options),allShared=Object.keys(model.commonStats).length===4;
  const labels={maxHp:'HP',armor:'Armor',speed:'Speed (tiles/s)',flying:'Movement'},value=(key,n)=>key==='flying'?n?'Flying':'Ground':enemyNumber(n);
  const partial=values=>Object.entries(values).map(([key,n])=>`<span><b>${labels[key]}:</b> ${value(key,n)}</span>`).join(' · ');
  const shared=allShared?stats(model.variants[0]):partial(model.commonStats);
  return `<section class="warband-comparison" aria-label="Actual configured variant comparison"><p class="warband-shared-stats">${model.variants.length>1?'<b>Shared statistics</b> · ':''}${shared}</p>${model.commonTraits.length?`<div class="warband-common-abilities"><strong>${model.variants.length>1?'Shared abilities':'Abilities'}</strong>${enemyTraitsMarkup(model.commonTraits)}</div>`:''}${model.identical?'<p class="warband-identical">These forms have identical gameplay statistics and abilities.</p>':''}<div class="warband-variant-columns">${model.differences.map(({info,stats:delta,traits},index)=>`<section class="warband-variant" data-variant-index="${index}">${model.variants.length>1?`<strong>Form ${index+1} · ${escape(info.name)}</strong>`:''}${Object.keys(delta).length?`<p class="warband-stats">${partial(delta)}</p>`:''}${traits.length?enemyTraitsMarkup(traits):model.variants.length>1?'<p class="minor-note">No additional defenses or abilities.</p>':''}</section>`).join('')}</div></section>`;
}

const traitLabel=trait=>({magicImmune:'Magical immunity',physicalImmune:'Physical immunity',regen:'Regeneration',evasion:'Evasion',refraction:'Hit shields',krakenShell:'Shell',reactive:'Reactive armor',recharge:'Recharge',untouchable:'Dread'}[trait.kind]||(/Cloaked/.test(trait.text)?'Cloaking':/Disarms/.test(trait.text)?'Disarm':/Blinks/.test(trait.text)?'Blink':/Blood rush/.test(trait.text)?'Rush':/movement speed/.test(trait.text)?'Movement support':/Steals/.test(trait.text)?'Gold theft':null));
function compactSummary(wave,enemies,images,number,options){
  const profiles=wave.groups.flatMap(group=>warbandVariantComparison(wave,group,enemies[group.type],options).variants),moves=[...new Set(profiles.map(info=>info.flying?'Flying':'Ground'))],labels=[...new Set(profiles.flatMap(info=>info.traitDetails.map(traitLabel).filter(Boolean)))];
  const threats=labels.slice(0,3).map(label=>`${profiles.every(info=>info.traitDetails.some(trait=>traitLabel(trait)===label))?'':'Possible '}${label}`),count=wave.groups.reduce((sum,group)=>sum+group.count,0),first=enemies[wave.groups[0].type],image=images['enemy:'+wave.groups[0].type];
  return `<span class="warband-row-number">${String(number).padStart(2,'0')}</span>${image?`<img class="warband-row-portrait" src="${escape(image)}" alt="">`:''}<span class="warband-row-copy"><strong>${escape(wave.name||first.name)}</strong><small>${moves.join(' / ')} · ${enemyNumber(count)} ${wave.boss?'boss':'invaders'}${wave.boss?' · Boss wave':''}</small><span class="warband-row-threats">${threats.length?escape(threats.join(' · ')):'No special defenses'}</span></span>`;
}

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

export function warbandCardsMarkup(waves,enemies,images,{balance,startWave=1,currentWave=null,phase=null,liveWarband,liveBossHealth,compact=false}={}){
  return waves.map((wave,index)=>{
    const first=enemies[wave.groups[0].type],number=startWave+index,current=number===currentWave;
    const groups=wave.groups.map(group=>{
      const definition=enemies[group.type],aura=ENEMY_AURA_STAGES[enemyAuraStage({...definition,type:group.type})].name;
      if(compact)return `<div class="warband-group" data-enemy="${escape(group.type)}"><div class="warband-detail-heading"><img src="${escape(images['enemy:'+group.type]||'')}" alt="${escape(definition.name)}"><h3>${escape(definition.name)}</h3></div><p>${enemyNumber(group.count)} ${wave.boss?'warlord':'invaders'}</p>${comparisonMarkup(wave,group,definition,{balance})}${randomVariants(wave,group,definition)?'<p class="minor-note">Each enemy independently chooses a random variant; the wave may contain a mix.</p>':''}<details class="warband-lore" data-warband-disclosure="lore:${number}:${escape(group.type)}"><summary>Lore and guidance</summary><p class="warband-appearance">${escape(definition.appearance)}</p><small>${escape(aura)}</small><strong class="warband-traits">${escape(definition.threat)}</strong><p class="wave-counter">${escape(definition.counter||'Focus your damage along the route.')}</p></details></div>`;
      return `<div class="warband-group" data-enemy="${escape(group.type)}"><img src="${escape(images['enemy:'+group.type]||'')}" alt="${escape(definition.name)}"><h3>${escape(definition.name)}</h3><p class="warband-appearance">${escape(definition.appearance)}</p><small>${escape(aura)}</small><p>${enemyNumber(group.count)} ${wave.boss?'warlord':'invaders'}</p><strong class="warband-traits">${escape(definition.threat)}</strong>${randomVariants(wave,group,definition)?'<p class="minor-note">Each enemy independently chooses a random variant; the wave may contain a mix.</p>':''}${variantsMarkup(wave,group,definition)}<p class="wave-counter">${escape(definition.counter||'Focus your damage along the route.')}</p></div>`;
    }).join('');
    const body=`<div class="eyebrow">WAVE ${String(number).padStart(2,'0')} · ${wave.boss?'WARLORD · ':''}${first.flying?'AIR':'GROUND'}</div>${current?`<p class="warband-wave-status">${phase==='combat'?'In combat':phase==='lost'?'Run ended · wave not completed':'Next assault'}</p>`:''}${wave.name?`<h2 class="warband-wave-name">${escape(wave.name)}</h2>`:''}${current&&phase==='combat'&&wave.boss?bossHealthMarkup(liveBossHealth):''}${current&&phase==='combat'&&Array.isArray(liveWarband)?currentCompositionMarkup(liveWarband):''}${groups}`;
    return `<article class="warband-card ${wave.boss?'boss':''}${current?' current':''}${compact?' compact':''}" data-wave="${number}"${current?' data-current-wave="true"':''}>${compact?`<details class="warband-wave-details" data-warband-disclosure="wave:${number}"><summary class="warband-wave-row" data-warband-focus="wave:${number}">${compactSummary(wave,enemies,images,number,{balance})}</summary><div class="warband-wave-body">${body}</div></details>`:body}</article>`;
  }).join('');
}
