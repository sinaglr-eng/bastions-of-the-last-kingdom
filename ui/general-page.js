import {GENERAL_SKILLS,SKILL_COSTS} from '../game/core/general.js';
import {rankLabel} from '../game/core/recipes.js';
import {progressionArtwork,medalAmount,escapeProgression as esc} from './progression-art.js';
import {accountRank,skillGate} from '../game/core/account-progression.js';

export function skillEffect(id,level){
 const n=GENERAL_SKILLS[id]?.values[level-1];
 if(id==='field-promotion')return `${n} CP · ${level===3?'Promotes V to VI':'Cap rank V'}`;
 if(id==='extended-range')return `+${n} ${n===1?'tile':'tiles'} · current wave · 200 gold`;
 if(id==='decisive-strike')return `${Math.round(n*100)}% max HP · bosses ${Math.round(GENERAL_SKILLS[id].bossValues[level-1]*100)}%`;
 if(id==='fortified-keep')return `+${n} keep health · ${30+n}/${30+n} start`;
 if(id==='deep-refit')return `${n} gold`;
 if(id==='recruitment-focus')return `+${Math.round(n*100)}% draft chance`;
 if(id==='field-logistics')return `+${n} CP`;
 if(id==='quartermaster')return `+${n.toLocaleString('en-US')} gold`;
 return `${id==='war-horn'?'−':'+'}${Math.round(n*100)}%`;
}
export function skillSummary(id,level=1){
 const value=GENERAL_SKILLS[id]?.values[Math.max(1,level)-1];
 return ({'field-promotion':`Promote one selected basic recruit after all five placements and before choosing a keeper. Once per round · ${value} CP · ${level===3?'can promote V to VI':'cap rank V'}.`,
 'extended-range':`All defenders gain +${value} ${value===1?'tile':'tiles'} of attack range until this combat wave ends. Once per wave · 200 gold · 0 CP. Support aura radii stay unchanged.`,
 'decisive-strike':`Strike every live enemy, including hidden and flying targets, for ${Math.round(value*100)}% max HP; bosses take ${Math.round((GENERAL_SKILLS[id]?.bossValues?.[level-1]||0)*100)}%. One use per run · 0 CP.`,
 'fortified-keep':`Start a new defense with ${30+value}/${30+value} keep health (+${value}). This passive stays fixed for that run.`,
 'deep-refit':`Lower a new recruit by 2 ranks and keep it · ${value} gold.`,
 'recruitment-focus':`Choose a class to recruit more often in the next draft and its reroll. Add ${Math.round(value*100)}% to its chance: for example, 20% becomes ${20+Math.round(value*100)}%. Costs 1 CP.`,
 'field-logistics':`Start your next defense with ${value} extra CP.`,quartermaster:`Start your next defense with ${Number(value).toLocaleString('en-US')} extra gold.`,
 'morale-boost':`All defenders gain ${Math.round(value*100)}% attack speed for 20s · 3 CP.`,
 'war-horn':`Slow all enemies by ${Math.round(value*100)}% for 20s · 3 CP.`,
 'blood-wrath':`All defenders gain ${Math.round(value*100)}% damage for 20s · 3 CP.`})[id]||'';
}
export function skillKindLabel(id){
 const s=GENERAL_SKILLS[id];return s.kind==='combat'?'Active · 20 combat seconds · 3 CP':s.kind==='wave-range'?'Combat command · 200 gold · Until wave ends':s.kind==='focus'?'Draft command · 1 CP':s.kind==='draft'?'Draft command · Gold cost':s.kind==='promotion'?'Draft command · Once per round':s.kind==='strike'?'Prepare and confirm · 0 CP · Once per run':'Passive · New games';
}
export function skillPurchaseState(profile,id,enabled=true){
 const p=profile||{},level=p.skills?.[id]||0,current=accountRank(p.xpTotal),next=level<3?level+1:null,cost=next?SKILL_COSTS[level]:0,gate=skillGate(id,next||3,p),balance=Number(p.balance||0),shortfall=Math.max(0,cost-balance);
 const state=!next?'max':!gate.allowed?'rank-locked':!enabled?'sign-in':shortfall>0?'medal-shortfall':'available';
 const reason=state==='max'?'All three ranks owned':state==='rank-locked'?`Requires ${gate.rank.name} · Level ${gate.required}`:state==='sign-in'?'Sign in and connect to purchase':state==='medal-shortfall'?`${shortfall} more medals needed`:'Available to buy';
 return {level,current,next,cost,gate,balance,shortfall,state,reason,canBuy:state==='available',label:!next?'Fully upgraded':`${level?'Upgrade to '+rankLabel(next):'Unlock rank I'} · ${cost} medals`};
}
export function skillEquipLabel(state,equipped=false){return equipped?'Equipped':state.level?'Equip':state.state==='rank-locked'?'Rank locked':'Buy to equip';}
export function skillPurchaseBadge(state){return state.state==='max'?'Max rank owned':state.state==='rank-locked'?(state.level?'Next rank locked':'Rank locked'):state.state==='medal-shortfall'?'Need medals':state.state==='sign-in'?'Connect to buy':state.level?'Upgrade available':'Available to buy';}
export function skillRankMarkup(id,profile,className='general-rank-track',{compact=false,enabled=true}={}){
 const p=profile||{},level=p.skills?.[id]||0,current=accountRank(p.xpTotal);
 return `<div class="${className}" aria-label="${esc(GENERAL_SKILLS[id].name)} ranks and military requirements">${[1,2,3].map(rank=>{
  const gate=skillGate(id,rank,p),owned=rank<=level,cost=SKILL_COSTS[rank-1],shortfall=Math.max(0,cost-Number(p.balance||0));
  const state=owned?(rank===level?'Current · Owned':'Owned'):!gate.allowed?`Unlock at Level ${gate.required}`:rank>level+1?'Unlock previous rank first':!enabled?'Connect to buy':shortfall>0?'More medals needed':'Available to buy';
  if(compact){
   const status=owned?'owned':!gate.allowed||rank>level+1?'locked':enabled&&shortfall===0?'available':'unavailable';
   return `<div class="war-rank-card${rank===level+1?' is-next-rank':''}" data-skill-rank="${rank}" data-rank-status="${status}"${rank===level?' aria-current="true"':''}>
    <b class="war-rank-emblem" aria-label="Rank ${rankLabel(rank)}">${rankLabel(rank)}</b>
    <span class="war-rank-state">${!owned&&!gate.allowed?state+' · '+gate.rank.name:state}</span>
    <strong class="war-rank-effect">${esc(skillEffect(id,rank))}</strong>
    ${owned||!gate.allowed?'':'<small class="war-rank-gate">Requires '+gate.rank.name+' · Level '+gate.required+'</small>'}
    <small class="war-rank-cost">${owned?'Permanently owned':medalAmount(cost)}</small>
   </div>`;
  }
  return `<div class="${owned?'is-owned rank-owned':''} ${rank===level?'rank-current':''} ${rank===level+1?'is-next rank-next':''}" data-skill-rank="${rank}"><b>${rankLabel(rank)}${owned?' ✓':''}</b><strong>${esc(skillEffect(id,rank))}</strong><span class="commander-rank-state">${state}</span><small>Requires ${gate.rank.name} · Level ${gate.required}</small><small>Your account: ${current.name} · Level ${current.level}</small><small>${owned?'Permanently owned':`${cost} medals`}</small></div>`;
 }).join('')}</div>`;
}
export function generalLoadoutMarkup(skills,equipped){
 return Array.from({length:3},(_,index)=>{const id=equipped[index],s=GENERAL_SKILLS[id];return s?`<div class="general-loadout-slot is-filled"><img src="${progressionArtwork(id)}" alt="" width="60" height="60"><span><strong>${s.name}</strong><small>Rank ${rankLabel(skills[id])} · ${skillEffect(id,skills[id])}</small></span></div>`:`<div class="general-loadout-slot"><span class="loadout-slot-number">0${index+1}</span><span><strong>Open slot</strong><small>Equip an unlocked skill</small></span></div>`;}).join('');
}
export function generalPageMarkup(profile,enabled=true){
 const p=profile||{skills:{},equipped:[],balance:0},skills=p.skills||{},equipped=p.equipped||[];
 return `<section class="progression-banner general-banner"><img class="general-banner-crest" src="${progressionArtwork('field-logistics')}" width="112" height="112" alt="Commander crest"><div class="progression-banner-copy"><span class="progression-eyebrow">Your command, your advantage</span><h2>Build the general you want to be.</h2><p>Unlock three ranks of each skill. Equip up to three for your next defense.</p></div><div class="progression-wallet"><span>Medals available to invest</span>${medalAmount(p.balance)}<small>Each upgrade costs 5 / 10 / 20 medals.</small></div></section><form data-form="equipment" class="general-equipment-form"><section class="general-loadout"><div class="general-loadout-heading"><h2>Your next loadout</h2><span data-loadout-count>${equipped.length} / 3 equipped</span></div><div class="general-loadout-slots" data-loadout-preview>${generalLoadoutMarkup(skills,equipped)}</div><p>Equipment changes apply to new games. A saved run keeps the skills it started with.</p></section><div class="general-upgrade-grid">${Object.entries(GENERAL_SKILLS).map(([id,s])=>{
  const purchase=skillPurchaseState(p,id,enabled),level=purchase.level,isEquipped=equipped.includes(id);
  return `<article class="general-skill-card ${level?'is-unlocked':'is-locked'} ${isEquipped?'is-equipped':''}" data-skill-card="${id}" data-purchase-state="${purchase.state}"><header><img src="${progressionArtwork(id)}" width="112" height="112" alt="${esc(s.name)} skill illustration"><div><span class="general-skill-kind">${skillKindLabel(id)}</span><h2>${s.name}</h2><span class="commander-purchase-badge" data-state="${purchase.state}">${skillPurchaseBadge(purchase)}</span><span class="general-owned-level">${level?`Rank ${rankLabel(level)} unlocked`:'Not yet unlocked'}${isEquipped?' · Equipped':''}</span></div></header><p class="general-skill-description">${esc(s.description)}</p>${skillRankMarkup(id,p)}<div class="general-card-actions"><label class="general-equip-toggle"><input type="checkbox" name="equipped" aria-label="Equip ${esc(s.name)}" value="${id}" ${isEquipped?'checked':''} ${!enabled||!level?'disabled':''}><span>${skillEquipLabel(purchase,isEquipped)}</span></label><button type="button" class="general-purchase" aria-label="${esc(s.name+' · '+purchase.label+' · '+purchase.reason)}" data-buy="${id}" ${purchase.canBuy?'':'disabled'}>${purchase.label}</button><small class="general-shortfall" role="status">${purchase.reason}${purchase.state==='rank-locked'&&purchase.shortfall===0?' · Medal requirement met':''}</small></div></article>`;
 }).join('')}</div><div class="general-save-bar"><p><strong>Ready for your next defense</strong><span data-loadout-note>${equipped.length} / 3 skill slots selected</span></p><button class="menu-primary" type="submit" ${enabled?'':'disabled'}>Save Equipment</button></div></form>`;
}
export function refreshGeneralLoadout(root,profile,changed){
 const form=root.querySelector('[data-form="equipment"]');if(!form)return false;
 let selected=[...form.querySelectorAll('[name="equipped"]:checked')].map(input=>input.value);
 if(selected.length>3){if(changed)changed.checked=false;selected=[...form.querySelectorAll('[name="equipped"]:checked')].map(input=>input.value);return false;}
 form.querySelector('[data-loadout-preview]').innerHTML=generalLoadoutMarkup(profile.skills,selected);
 form.querySelector('[data-loadout-count]').textContent=`${selected.length} / 3 equipped`;
 form.querySelector('[data-loadout-note]').textContent=`${selected.length} / 3 skill slots selected · Save to apply`;
 for(const input of form.querySelectorAll('[name="equipped"]')){input.closest('[data-skill-card]').classList.toggle('is-equipped',input.checked);input.nextElementSibling.textContent=skillEquipLabel(skillPurchaseState(profile,input.value),input.checked);}
 return true;
}
