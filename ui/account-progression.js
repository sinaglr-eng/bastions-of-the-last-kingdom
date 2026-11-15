import {accountRank,MILITARY_RANKS,SKILL_LEVEL_GATES} from '../game/core/account-progression.js';
import {GENERAL_SKILLS} from '../game/core/general.js';
import {accountRankArtwork} from './account-progression-art.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>(n||0).toLocaleString('en-US');
export function rankProgressMarkup(total=0){const r=accountRank(total);return `<div class="account-xp-bar" role="progressbar" aria-label="${r.name}, Level ${r.level}${r.next?`. ${r.progress} of ${r.span} XP toward ${r.next.name}`:'. Maximum rank'}" aria-valuemin="0" aria-valuemax="${r.span||100}" aria-valuenow="${r.next?r.progress:100}"><i style="--xp-fill:${r.percent}%"></i></div><small class="account-xp-caption">${r.next?`${num(r.progress)} / ${num(r.span)} XP to ${r.next.name}`:'MAX RANK'} <span>${num(r.total)} total XP</span></small>`;}
export function accountBadgeMarkup(profile={},large=false){const r=accountRank(profile.xpTotal);return `<section class="account-rank ${large?'is-large':''}" aria-label="Account rank"><img src="${accountRankArtwork(r.level)}" alt="${r.name} rank badge" width="${large?112:48}" height="${large?112:48}"><div><strong>${r.name} <span>Level ${r.level}</span></strong>${rankProgressMarkup(r.total)}</div></section>`;}
export function rankOverviewMarkup(profile={}){
 const r=accountRank(profile.xpTotal),future=Object.entries(SKILL_LEVEL_GATES).flatMap(([id,levels])=>levels.map((level,i)=>({id,level,rank:i+1}))).filter(g=>g.level>r.level).sort((a,b)=>a.level-b.level),nextLevel=future[0]?.level;
 return `<section class="commander-progression">${accountBadgeMarkup(profile,true)}<div class="commander-next"><small>YOUR NEXT MILESTONE</small>${future.length?`<strong>${MILITARY_RANKS[nextLevel-1].name} · Level ${nextLevel}</strong><p>${future.filter(g=>g.level===nextLevel).map(g=>`${GENERAL_SKILLS[g.id].name} ${['I','II','III'][g.rank-1]}`).join(' · ')}</p><span>Available to buy with medals after promotion.</span>`:'<strong>Every rank is within reach</strong><p>You have reached the highest account rank. Continue building your legacy.</p>'}</div><details class="commander-rank-roadmap"><summary>View all 15 military ranks</summary><ol>${MILITARY_RANKS.map(rank=>`<li class="${rank.level===r.level?'is-current':rank.level<r.level?'is-earned':'is-future'}"><img src="${accountRankArtwork(rank.level)}" alt="" width="48" height="48"><span><b>${rank.name}</b><small>Level ${rank.level} · ${num(rank.xp)} XP</small></span><em>${rank.level===r.level?'Current':rank.level<r.level?'✓':'Locked'}</em></li>`).join('')}</ol></details></section>`;
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
 const root=document.createElement('aside');root.className='account-promotion-notice result-rank-card';root.setAttribute('role','status');root.innerHTML=`<button aria-label="Dismiss promotion">×</button><small>CONGRATULATIONS, COMMANDER!</small><h2>Promoted to ${esc(accountRank(receipt.xpAfter).name)}</h2>${accountBadgeMarkup({xpTotal:receipt.xpAfter},true)}`;(document.querySelector('#dialog[open]')||document.body).append(root);animatePromotion(root,{receipt,owner});root.querySelector('button').onclick=()=>root.remove();setTimeout(()=>root.remove(),9000);
}
