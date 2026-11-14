import {GENERAL_SKILLS,SKILL_COSTS} from '../game/core/general.js';
import {rankLabel} from '../game/core/recipes.js';
import {progressionArtwork,medalAmount,escapeProgression as esc} from './progression-art.js';

export function skillEffect(id,level){
 const n=GENERAL_SKILLS[id]?.values[level-1];
 if(id==='deep-refit')return `${n} gold`;
 if(id==='recruitment-focus')return `+${Math.round(n*100)} pp`;
 if(id==='field-logistics')return `+${n} CP`;
 if(id==='quartermaster')return `+${n.toLocaleString('en-US')} gold`;
 return `${id==='war-horn'?'−':'+'}${Math.round(n*100)}%`;
}
export function generalLoadoutMarkup(skills,equipped){
 return Array.from({length:3},(_,index)=>{const id=equipped[index],s=GENERAL_SKILLS[id];return s?`<div class="general-loadout-slot is-filled"><img src="${progressionArtwork(id)}" alt="" width="60" height="60"><span><strong>${s.name}</strong><small>Rank ${rankLabel(skills[id])} · ${skillEffect(id,skills[id])}</small></span></div>`:`<div class="general-loadout-slot"><span class="loadout-slot-number">0${index+1}</span><span><strong>Open slot</strong><small>Equip an unlocked skill</small></span></div>`;}).join('');
}
export function generalPageMarkup(profile,enabled=true){
 const p=profile||{skills:{},equipped:[],balance:0},skills=p.skills||{},equipped=p.equipped||[];
 return `<section class="progression-banner general-banner"><img class="general-banner-crest" src="${progressionArtwork('field-logistics')}" width="112" height="112" alt="General command crest"><div class="progression-banner-copy"><span class="progression-eyebrow">Your command, your advantage</span><h2>Build the general you want to be.</h2><p>Unlock three ranks of each skill. Equip up to three for your next defense.</p></div><div class="progression-wallet"><span>Medals available to invest</span>${medalAmount(p.balance)}<small>Each upgrade costs 5 / 10 / 20 medals.</small></div></section><form data-form="equipment" class="general-equipment-form"><section class="general-loadout"><div class="general-loadout-heading"><h2>Your next loadout</h2><span data-loadout-count>${equipped.length} / 3 equipped</span></div><div class="general-loadout-slots" data-loadout-preview>${generalLoadoutMarkup(skills,equipped)}</div><p>Equipment changes apply to new games. A saved run keeps the skills it started with.</p></section><div class="general-upgrade-grid">${Object.entries(GENERAL_SKILLS).map(([id,s])=>{
  const level=skills[id]||0,isEquipped=equipped.includes(id),cost=SKILL_COSTS[level],canBuy=enabled&&level<3&&p.balance>=cost;
  return `<article class="general-skill-card ${level?'is-unlocked':'is-locked'} ${isEquipped?'is-equipped':''}" data-skill-card="${id}"><header><img src="${progressionArtwork(id)}" width="112" height="112" alt="${s.name} skill illustration"><div><span class="general-skill-kind">${s.kind==='combat'?'Active · 3 CP · 20s':s.kind==='focus'?'Draft command · 1 CP':s.kind==='draft'?'Draft command':'Passive advantage'}</span><h2>${s.name}</h2><span class="general-owned-level">${level?`Rank ${rankLabel(level)} unlocked`:'Not yet unlocked'}</span></div></header><p class="general-skill-description">${s.description}</p><div class="general-rank-track" aria-label="${s.name} unlocked rank ${level} of 3">${[1,2,3].map(rank=>`<div class="${rank<=level?'rank-owned':''} ${rank===level?'rank-current':''} ${rank===level+1?'rank-next':''}"><span>${rankLabel(rank)}${rank<=level?'<i aria-hidden="true">✓</i>':''}</span><strong>${skillEffect(id,rank)}</strong><small>${rank===level?'Current':rank<level?'Unlocked':`${SKILL_COSTS[rank-1]} medals`}</small></div>`).join('')}</div><div class="general-card-actions"><label class="general-equip-toggle"><input type="checkbox" name="equipped" aria-label="Equip ${s.name}" value="${id}" ${isEquipped?'checked':''} ${!enabled||!level?'disabled':''}><span>${isEquipped?'Equipped':'Equip skill'}</span></label><button type="button" class="general-purchase" aria-label="${level===3?`${s.name} fully upgraded`:`${level?'Upgrade':'Unlock'} ${s.name} rank ${rankLabel(level+1)} for ${cost} medals`}" data-buy="${id}" ${canBuy?'':'disabled'}>${level===3?'Fully upgraded':`${level?`Upgrade to ${rankLabel(level+1)}`:'Unlock rank I'} ${medalAmount(cost,'')}`}</button>${!canBuy&&level<3?`<small class="general-shortfall">${enabled?`${Math.max(0,cost-p.balance)} more medals needed`:'Sign in to unlock'}</small>`:''}</div></article>`;
 }).join('')}</div><div class="general-save-bar"><p><strong>Ready for your next defense</strong><span data-loadout-note>${equipped.length} / 3 skill slots selected</span></p><button class="menu-primary" type="submit" ${enabled?'':'disabled'}>Save Equipment</button></div></form><details class="menu-reset general-refund"><summary>Reset your general & refund medals</summary><p>Refund the medals actually spent and clear your equipment. Saved runs keep their original skills.</p><button data-menu="reset-general" ${enabled?'':'disabled'}>Reset & Refund</button></details>`;
}
export function refreshGeneralLoadout(root,profile,changed){
 const form=root.querySelector('[data-form="equipment"]');if(!form)return false;
 let selected=[...form.querySelectorAll('[name="equipped"]:checked')].map(input=>input.value);
 if(selected.length>3){if(changed)changed.checked=false;selected=[...form.querySelectorAll('[name="equipped"]:checked')].map(input=>input.value);return false;}
 form.querySelector('[data-loadout-preview]').innerHTML=generalLoadoutMarkup(profile.skills,selected);
 form.querySelector('[data-loadout-count]').textContent=`${selected.length} / 3 equipped`;
 form.querySelector('[data-loadout-note]').textContent=`${selected.length} / 3 skill slots selected · Save to apply`;
 for(const input of form.querySelectorAll('[name="equipped"]')){input.closest('[data-skill-card]').classList.toggle('is-equipped',input.checked);input.nextElementSibling.textContent=input.checked?'Equipped':'Equip skill';}
 return true;
}
