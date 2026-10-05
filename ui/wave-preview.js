import {icon} from './icons.js';
import {enemyDefenseGlyph} from './enemy-trait-symbols.js';
import {ENEMY_DEFENSE_SYMBOLS} from '../game/render/enemy-defense-symbols.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
const finite=value=>Number.isFinite(value)&&value>=0;
const profile=value=>String(value||'Standard').replace(/[_-]/g,' ');
const waveLabel=wave=>`Wave ${Number.isSafeInteger(wave?.number)&&wave.number>0?wave.number:'?'}`;
const readinessLevels={weak:'Weak',fair:'Fair',good:'Good',strong:'Strong'};
const threatIcons=new Set(['shield','coin','crown','book','bow','bolt','spark','snow','fire','flask','sun','hammer','play','pause','path','grid','reset','sound','mute','help','close','check','pin','target','swords','maze']);
const uniqueThreats=threats=>{
  const seen=new Set();return (Array.isArray(threats)?threats:[]).filter(threat=>{
    if(!threat||!threat.id||!threat.label||seen.has(threat.id))return false;
    seen.add(threat.id);return true;
  });
};

function threatTags(threats,{fallback=true}={}){
  const tags=uniqueThreats(threats);
  if(!tags.length)return fallback?'<span class="wave-threat-tag standard">Standard wave</span>':'';
  return tags.map(threat=>{
    const description=[threat.possible?'Possible in a random variant.':'',threat.description||''].filter(Boolean).join(' ');
    return `<span class="wave-threat-tag ${threat.possible?'possible':''}" data-threat="${escape(threat.id)}" title="${escape(description)}">${icon(threatIcons.has(threat.icon)?threat.icon:'shield')}<span>${escape(threat.label)}${threat.possible?'<small>Possible</small>':''}</span></span>`;
  }).join('');
}

function portrait(enemy,images){
  const source=images?.['enemy:'+enemy.type];
  return source?`<img src="${escape(source)}" alt="" draggable="false">`:`<span class="wave-enemy-placeholder" aria-hidden="true">${icon(enemy.boss?'crown':'shield')}</span>`;
}

function variantDetails(variants){
  const profiles=(Array.isArray(variants)?variants:[]).filter(variant=>variant&&typeof variant==='object');
  if(!profiles.length)return '<p class="wave-preview-note">Detailed enemy information is unavailable.</p>';
  return profiles.map((variant,index)=>{
    const stats=[finite(variant.maxHp)?`${number(variant.maxHp)} HP`:null,finite(variant.armor)?`${number(variant.armor)} armor`:null,finite(variant.speed)?`${number(variant.speed)} tiles/s`:null,variant.flying?'Air':'Ground'].filter(Boolean);
    const traits=Array.isArray(variant.traitDetails)?variant.traitDetails:[];
    return `<section class="wave-enemy-variant"><strong>${profiles.length>1?`Variant ${index+1} · `:''}${escape(variant.name||'Enemy')}</strong><p>${escape(stats.join(' · '))}</p>${traits.length?`<ul>${traits.filter(trait=>trait&&trait.text).map(trait=>`<li>${Object.hasOwn(ENEMY_DEFENSE_SYMBOLS,trait.kind)?enemyDefenseGlyph(trait.kind):''}<span>${escape(trait.text)}</span></li>`).join('')}</ul>`:'<p class="wave-preview-note">No special resistances or abilities</p>'}</section>`;
  }).join('');
}

function enemyRow(enemy,images){
  const quantity=finite(enemy.count)?`${number(enemy.count)} × `:'',name=enemy.name||'Unknown enemy';
  const heading=`${portrait(enemy,images)}<span class="wave-enemy-name"><strong>${escape(quantity+name)}</strong><small>${enemy.unknown?'Enemy information unavailable':enemy.flying?'Airborne':enemy.boss?'Warlord':'Ground'}</small></span>`;
  return `<details class="wave-enemy-details"><summary>${heading}<span class="wave-enemy-open">Details</span></summary><div class="wave-enemy-detail-body">${Array.isArray(enemy.variants)&&enemy.variants.length>1?'<p class="wave-preview-note">Each enemy independently chooses a variant; the wave may contain a mix.</p>':''}${variantDetails(enemy.variants)}</div></details>`;
}

function composition(next,images){
  const enemies=(Array.isArray(next?.enemies)?next.enemies:[]).filter(enemy=>enemy&&typeof enemy==='object');
  if(!enemies.length)return '<p class="wave-preview-note">No enemy composition is available.</p>';
  const first=enemies.slice(0,3).map(enemy=>enemyRow(enemy,images)).join('');
  if(enemies.length<=3)return first;
  return `${first}<details class="wave-more-enemies"><summary>${enemies.length-3} more enemy types</summary>${enemies.slice(3).map(enemy=>enemyRow(enemy,images)).join('')}</details>`;
}

function armyReadiness(readiness){
  if(!readiness)return '<p class="wave-preview-note">Army readiness is unavailable.</p>';
  const count=Number.isSafeInteger(readiness.activeCount)&&readiness.activeCount>=0?readiness.activeCount:null;
  const heading=`<div class="wave-preview-section-heading"><strong>Your army</strong>${count!==null?`<small>${count} active ${count===1?'defender':'defenders'}</small>`:''}</div>`;
  if(readiness.empty||count===0)return `<section class="wave-readiness" aria-label="Active army readiness">${heading}<p class="wave-preview-note">No active defenders yet. Your first keeper begins the army.</p></section>`;
  const rows=(Array.isArray(readiness.rows)?readiness.rows:[]).filter(row=>row&&typeof row==='object');
  return `<section class="wave-readiness" aria-label="Active army readiness">${heading}${rows.length?`<ul>${rows.map(row=>{
    const known=Object.hasOwn(readinessLevels,row.level),level=known?row.level:'unknown',label=known?readinessLevels[level]:'Not assessed';
    return `<li><span><strong>${escape(row.label||row.threatId||'Response')}</strong>${row.response?`<small>${escape(row.response)}</small>`:''}</span><b class="readiness-level ${level}">${label}</b></li>`;
  }).join('')}</ul>`:'<p class="wave-preview-note">No specific response category for this wave.</p>'}${readiness.scope?`<p class="wave-readiness-scope">${escape(readiness.scope)}</p>`:''}</section>`;
}

function futureWave(after){
  if(!after)return '';
  // Deliberately project only the partial contract, even if a caller passes a
  // full analysis here. Counts, enemies and numeric stats cannot leak into +2.
  return `<section class="wave-after-preview" aria-label="Wave after next"><div class="wave-preview-section-heading"><strong>After · ${escape(waveLabel(after))}</strong><small>${escape(profile(after.profile))}</small></div><p>${escape(after.name||'Upcoming wave')}</p><div class="wave-threat-tags">${threatTags(after.primaryThreats)}</div></section>`;
}

function bossForecast(boss){
  if(!boss)return '';
  const distance=Number.isSafeInteger(boss.distance)&&boss.distance>=0?boss.distance:null;
  const timing=distance===0?'Boss wave now':distance===1?'Boss in 1 wave':distance!==null?`Boss in ${distance} waves`:'Boss ahead';
  const identified=['identity','traits','full'].includes(boss.visibility),revealed=['traits','full'].includes(boss.visibility),preview=boss.visibility==='full'?boss.preview:null;
  return `<section class="wave-boss-forecast" aria-label="Boss forecast" data-visibility="${escape(boss.visibility||'marker')}"><div class="wave-preview-section-heading">${icon('crown')}<strong>${timing}</strong><small>${escape(waveLabel(boss))}</small></div>${identified?`<p>${escape(boss.name||preview?.name||'Boss')}</p>${boss.profile||preview?.profile?`<small class="wave-preview-profile">${escape(profile(boss.profile||preview?.profile))}</small>`:''}`:''}${revealed?`<div class="wave-threat-tags">${threatTags(boss.primaryThreats||preview?.primaryThreats,{fallback:false})}</div>`:''}</section>`;
}

function intelligenceContents(model,images){
  const next=model.next;
  return `<div class="wave-preview-composition" aria-label="Next wave enemy composition">${composition(next,images)}</div><section class="wave-primary-threats" aria-label="Primary enemy threats"><div class="wave-preview-section-heading"><strong>Primary threats</strong></div><div class="wave-threat-tags">${threatTags(next.primaryThreats)}</div></section>${armyReadiness(model.readiness)}${futureWave(model.after)}${bossForecast(model.boss)}`;
}

export function wavePreviewMarkup(model,data={},images={}, {compact=true,headingId='wave-preview-title',open=false}={}){
  if(!model?.next)return '';
  const next=model.next,boss=next.special==='boss',count=finite(next.totalCount)?`${number(next.totalCount)} ${next.totalCount===1?'invader':'invaders'}`:'';
  const header=`${icon(boss?'crown':'swords')}<span><strong id="${escape(headingId)}">Next · ${escape(waveLabel(next))}</strong><small>${escape(profile(next.profile))}${count?` · ${count}`:''}</small></span>`;
  const contents=`<div class="wave-intelligence-body"><h3 class="wave-preview-name">${escape(next.name||'Upcoming wave')}</h3>${intelligenceContents(model,images)}</div>`;
  if(compact)return `<details class="wave-intelligence ${boss?'boss':''}" ${open?'open':''}><summary class="wave-intelligence-summary">${header}<span class="wave-intelligence-toggle">Threats & army</span></summary>${contents}</details>`;
  return `<section class="wave-intelligence expanded ${boss?'boss':''}" aria-labelledby="${escape(headingId)}"><div class="wave-intelligence-summary">${header}</div>${contents}</section>`;
}
