import {homelandArt} from './homeland-art.js';
import {CHESTS} from '../game/core/artifacts.js';
import {siteUrl} from '../game/site-url.js';
import {accountRank,MILITARY_RANKS,SKILL_LEVEL_GATES,promotionChestTier} from '../game/core/account-progression.js';
import {GENERAL_SKILLS} from '../game/core/general.js';
import {commanderSkillArt} from './commander-art.js';
import {accountRankArtwork} from './account-progression-art.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const rankSkillUnlocks=level=>Object.entries(SKILL_LEVEL_GATES).flatMap(([id,levels])=>levels.flatMap((at,i)=>at===level?[{id,name:GENERAL_SKILLS[id].name,rank:i+1}]:[]));
const num=n=>(n||0).toLocaleString('en-US');
export function rankProgressMarkup(total=0){const r=accountRank(total);return `<div class="account-xp-bar" role="progressbar" aria-label="${r.name}, Level ${r.level}${r.next?`. ${r.progress} of ${r.span} XP toward ${r.next.name}`:'. Maximum rank'}" aria-valuemin="0" aria-valuemax="${r.span||100}" aria-valuenow="${r.next?r.progress:100}"><i style="--xp-fill:${r.percent}%"></i></div><small class="account-xp-caption">${r.next?`${num(r.progress)} / ${num(r.span)} XP to ${r.next.name}`:'MAX RANK'} <span>${num(r.total)} total XP</span></small>`;}
export function accountBadgeMarkup(profile={},large=false){const r=accountRank(profile.xpTotal);return `<section class="account-rank ${large?'is-large':''}" aria-label="Account rank"><img src="${accountRankArtwork(r.level)}" alt="${r.name} rank badge" width="${large?112:48}" height="${large?112:48}"><div><strong>${r.name} <span>Level ${r.level}</span></strong>${rankProgressMarkup(r.total)}</div></section>`;}
function rankChestMarkup(level){
 const chest=CHESTS[promotionChestTier(level)];
 if(!chest)return '';
 return `<span class="rank-chest-reward"><img src="${siteUrl(chest.art)}" alt="" width="25" height="22"> <span>1 × ${esc(chest.name)}</span></span>`;
}
export function rankOverviewMarkup(profile={},{expanded=false}={}){
 const r=accountRank(profile.xpTotal),next=r.next;
 const ready=(profile.artifacts?.chests||[]).filter(chest=>chest.rankLevel&&chest.status==='ready').length;
 return `<section class="commander-progression"><aside class="rank-portrait-panel" aria-label="Current military rank">
  <img class="rank-hero-head" src="${homelandArt('rank'+r.level)}" width="152" height="152" alt="">
  <small>Current rank · Level ${r.level}</small><h2>${r.name}</h2><b>${num(r.total)} total XP</b>
  <div class="rank-next-progress"><strong>${next?'Next · '+next.name:'Maximum rank'}</strong>
  ${rankProgressMarkup(r.total)}
  ${next?`<p>${num(next.xp-r.total)} XP to promotion</p>`:''}</div>
  ${ready?`<p><button type="button" data-menu="rank-chests">View ${ready} promotion ${ready===1?'chest':'chests'}</button></p>`:''}
 </aside><details class="commander-rank-roadmap" ${expanded?'open':''}><summary>Promotion path</summary>
 <ol tabindex="0" aria-label="All 15 military ranks">${MILITARY_RANKS.map(rank=>`<li class="${rank.level===r.level?'is-current':rank.level<r.level?'is-earned':'is-future'}" ${rank.level===r.level?'aria-current="step"':''}>
  <img src="${homelandArt('rank'+rank.level)}" alt="" width="48" height="48"><span>
  <small>Level ${rank.level} · ${num(rank.xp)} XP</small><b>${rank.name}</b>
  <span class="rank-skill-unlocks"><small class="sr-only">Available to purchase</small>${rankSkillUnlocks(rank.level).map(skill=>`<span class="rank-unlock-skill"><img src="${commanderSkillArt(skill.id)}" alt="" width="19" height="19" loading="lazy"><span>${esc(skill.name)} <b>${['I','II','III'][skill.rank-1]}</b></span></span>`).join('')}</span>${rankChestMarkup(rank.level)}
  </span><em>${rank.level===r.level?'Current':rank.level===next?.level?'Next':rank.level<r.level?'Earned':''}</em></li>`).join('')}</ol></details></section>`;
}
export const xpAmount=xp=>`<span class="account-xp-reward" aria-label="${xp||0} experience points">+${num(xp)} XP</span>`;
function seenKey(owner,id){return 'account-xp-celebrated:'+owner+':'+id;}
export function animatePromotion(root,{receipt,owner='guest',storage=globalThis.localStorage}={}){
 if(!root||!receipt||receipt.status!=='confirmed')return;
 const key=seenKey(owner,receipt.receiptId);try{if(storage?.getItem(key))return;storage?.setItem(key,'1');}catch{}
 const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 if(reduced)return;
 root.classList.add('xp-receipt-arriving');
 const after=accountRank(receipt.xpAfter),before=accountRank(receipt.xpBefore),steps=after.level-before.level,duration=Math.min(850,3400/(steps+1));let cancelled=false;
 const alive=()=>!cancelled&&root.isConnected;
 const render=total=>{const badge=root.querySelector('.result-rank-card .account-rank')||root.querySelector('.account-rank');if(badge)badge.outerHTML=accountBadgeMarkup({xpTotal:total},true);};
 const fill=percent=>{const bar=root.querySelector('.account-rank .account-xp-bar i');if(bar){bar.style.transition=`width ${duration*.9}ms ease`;bar.style.setProperty('--xp-fill',percent+'%');}};
 render(receipt.xpBefore);
 for(let step=0;step<=steps;step++)setTimeout(()=>{if(!alive())return;if(step)render(MILITARY_RANKS[before.level+step-1].xp);requestAnimationFrame(()=>{if(alive())fill(step===steps?after.percent:100);});},350+step*duration);
 setTimeout(()=>{
  if(!alive())return;render(receipt.xpAfter);
  if(!steps)return;
  const box=document.createElement('div');box.className='account-confetti';box.setAttribute('aria-hidden','true');
  for(let i=0;i<32;i++){const piece=document.createElement('i');piece.style.cssText=`--n:${i};--x:${(i*37)%100}%;--drift:${((i*61)%140)-70}px;--delay:${(i%8)*55}ms`;box.append(piece);}root.append(box);setTimeout(()=>box.remove(),2600);
 },350+(steps+1)*duration);
 root.querySelector('[data-skip-xp]')?.addEventListener('click',()=>{cancelled=true;root.classList.remove('xp-receipt-arriving');root.querySelector('.account-confetti')?.remove();render(receipt.xpAfter);},{once:true});
}
export function showPromotionNotice(receipt,owner){
 if(receipt.levelAfter<=receipt.levelBefore)return;
 const key=seenKey(owner,receipt.receiptId);try{if(localStorage.getItem(key))return;}catch{}
 const root=document.createElement('aside');root.className='account-promotion-notice result-rank-card';root.setAttribute('role','status');root.innerHTML=`<button aria-label="Dismiss promotion">×</button><small>CONGRATULATIONS, COMMANDER!</small><h2>Promoted to ${esc(accountRank(receipt.xpAfter).name)}</h2>${accountBadgeMarkup({xpTotal:receipt.xpAfter},true)}${MILITARY_RANKS.filter(rank=>rank.level>receipt.levelBefore&&rank.level<=receipt.levelAfter).map(rank=>rankChestMarkup(rank.level)).join('')}`;(document.querySelector('#dialog[open]')||document.body).append(root);animatePromotion(root,{receipt,owner});root.querySelector('button').onclick=()=>root.remove();setTimeout(()=>root.remove(),9000);
}
