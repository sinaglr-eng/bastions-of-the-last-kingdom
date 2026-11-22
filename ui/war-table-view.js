import {commanderSkillArt} from './commander-art.js';
import {homelandArt} from './homeland-art.js';
import {siteUrl} from '../game/site-url.js';
import {currentFactionData} from '../game/core/current-data.js';
import {FACTIONS} from '../game/core/factions.js';
import {achievementCatalog,streakAchievement,BOSS_TYPES,canonicalAchievementId,isSharedAchievement} from '../game/core/achievements.js';
import {canonicalAchievementRows} from '../game/achievement-client-state.js';
import {GENERAL_SKILLS} from '../game/core/general.js';
import {rankLabel} from '../game/core/recipes.js';
import {achievementPicture,medalAmount,escapeProgression as esc} from './progression-art.js';
import {achievementXP,eligibleChampion} from '../game/core/account-progression.js';
import {rankOverviewMarkup,xpAmount} from './account-progression.js';

export const warArt=name=>GENERAL_SKILLS[name]?commanderSkillArt(name):siteUrl(`assets/ui/war-table/${name}.webp`);
export const factionMark=id=>`<span class="faction-mark faction-${id}" aria-hidden="true">${['crown','forge','grove'].includes(id)?`<img src="${siteUrl(`assets/ui/ornate/faction-${({crown:'human',forge:'dwarves',grove:'elves'})[id]}.webp`)}" alt="">`:`<img src="${siteUrl('assets/ui/commander-feedback/champions.webp')}" alt="">`}</span>`;
export const exactNumber=n=>{try{return BigInt(n||0).toLocaleString('en-US');}catch{return '0';}};
export function achievementData(player,faction='crown'){
 const factionIds=faction==='all'?FACTIONS.map(row=>row.id):[FACTIONS.some(row=>row.id===faction)?faction:'crown'],dataByFaction=Object.fromEntries(factionIds.map(id=>[id,currentFactionData(id)])),data=dataByFaction[factionIds[0]],profile=player.profile||{};
 const dataFor=row=>dataByFaction[row.factionId]||data,owned=new Map(canonicalAchievementRows(profile.grants).map(g=>[g.id,g])),eligible=new Map(canonicalAchievementRows(profile.eligible).map(g=>[g.id,g]));
 const game=player.game,run=game?.accountId&&!game.developerMode?game.progress:null;
 // Shared milestones appear once. Each faction discovery remains attached to its own roster.
 const pending=new Set(canonicalAchievementRows(run?.grants()||[]).filter(g=>isSharedAchievement(g.id)||g.id.startsWith('endless:')||factionIds.includes(g.factionId)||factionIds.some(id=>g.id.split(':')[1]===id)).map(g=>g.id)),verified=new Set([...owned.keys(),...eligible.keys()]);
 const best=Math.max(0,...Object.values(profile.progress||{}).map(p=>p?.streakBest||0),run?.streakBest||0),catalog=canonicalAchievementRows(factionIds.flatMap(id=>achievementCatalog(dataByFaction[id],{streakBest:best})));
 for(const id of verified){if(id.startsWith('streak:global:')&&!catalog.some(a=>a.id===id))catalog.push(streakAchievement('global',Number(id.split(':').at(-1))/10));}
 const ids=new Set([...verified,...pending]);
 const progress=a=>{
  const id=canonicalAchievementId(a.id);if(verified.has(id)||pending.has(id))return a.target;
  const roster=dataFor(a),owner=a.factionId;
  if(a.requiredChampions)return Math.min(a.target,a.requiredChampions.filter(family=>ids.has(`champion:${owner}:${family}`)).length);
  if(a.kind==='skill-mastery')return Math.min(a.target,profile.skills?.[a.skillId]||0);
  if(a.kind==='collection')return Math.min(a.target,[...ids].filter(id=>id.startsWith(`champion:${owner}:`)&&eligibleChampion(roster.towers[id.split(':').at(-1)])).length);
  if(id==='boss-collection:global')return Math.min(a.target,BOSS_TYPES.filter(type=>ids.has(`boss:global:${type}`)).length);
  if(a.kind==='streak')return Math.min(a.target,best);
  if(a.kind==='endless')return Math.min(a.target,Math.max(0,...Object.values(profile.progress||{}).map(p=>p?.highestWave||0),run?.highestWave||0));
  return 0;
 };
 const state=a=>{const id=canonicalAchievementId(a.id);return owned.has(id)?'claimed':eligible.has(id)?'ready':pending.has(id)||progress(a)>=a.target?'pending':'progress';};
 return {data,dataFor,catalog,owned,eligible,pending,progress,state};
}
export function achievementById(id){
 id=canonicalAchievementId(id);const faction=id.split(':')[1],data=currentFactionData(['crown','forge','grove'].includes(faction)?faction:'crown');
 let row=achievementCatalog(data).find(a=>a.id===id);
 if(!row&&id.startsWith('streak:global:'))row=streakAchievement('global',Number(id.split(':').at(-1))/10);
 return {data,row};
}
export function factionTabs(current,{all=false,attribute='filter-faction'}={}){
 return `<div class="war-faction-tabs" role="group" aria-label="Faction">${[...(all?[{id:'all',name:'All factions'}]:[]),...FACTIONS].map(f=>`<button type="button" data-${attribute}="${f.id}" aria-pressed="${current===f.id}">${factionMark(f.id)}${esc(f.name)}</button>`).join('')}</div>`;
}
export function goalMarkup(player,faction='crown'){
 if(!player.user)return `<section class="war-goal"><img src="${warArt('collection')}" alt=""><div><h2>Your legacy starts here</h2><p>Sign in to collect achievements and strengthen your commander.</p><button data-nav="sign-in">Sign In</button></div></section>`;
 const ready=player.readyAchievements||[],total=ready.reduce((s,g)=>s+g.reward,0);
 if(ready.length)return `<section class="war-goal is-ready"><img src="${warArt('collection')}" alt=""><div><h2>Rewards ready <span class="war-count">${ready.length}</span></h2><p>Claim each achievement to add its medals to your treasury.</p><button data-ready-rewards>View rewards</button></div>${medalAmount(total)}</section>`;
 const a=achievementData(player,faction),goals=a.catalog.filter(g=>!['claimed','ready','pending'].includes(a.state(g))&&!g.secret);
 goals.sort((x,y)=>a.progress(y)/y.target-a.progress(x)/x.target);
 const g=goals[0];if(!g)return `<section class="war-goal"><div><h2>A legacy worth forging</h2><p>Your collection is complete. Push further into Endless.</p></div></section>`;
 const value=a.progress(g);return `<section class="war-goal"><div><h2>Your next medal</h2><p>${esc(g.name)}</p><div class="war-progress" role="progressbar" aria-label="${esc(g.name)}" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="${g.target}"><i style="width:${value/g.target*100}%"></i><span>${value} / ${g.target}</span></div></div>${medalAmount(g.reward)}</section>`;
}
const factionFeat=row=>row.kind==='campaign'||row.kind==='faction-collection'||row.id===`collection:${row.factionId}:all`;
const achievementOrder=row=>row.kind==='campaign'?0:row.id===`collection:${row.factionId}:all`?1:row.kind==='faction-collection'?2:3;
export function achievementsView(player,{faction='crown',kind='all',status='all',offset=0,focusId=null}={}){
 const a=achievementData(player,faction),milestones=new Set(['collection','mastery','campaign','faction-collection','streak','endless']);
 const rows=[...a.catalog].sort((x,y)=>achievementOrder(x)-achievementOrder(y)).filter(g=>(kind==='all'||kind==='faction'&&factionFeat(g)||kind==='milestone'&&milestones.has(g.kind)||g.kind===kind)&&(status==='all'||status===a.state(g)||status==='progress'&&['progress','pending'].includes(a.state(g))));
 if(focusId){const i=rows.findIndex(g=>g.id===focusId);if(i>=0)offset=Math.floor(i/8)*8;}
 const claimed=a.catalog.filter(g=>a.state(g)==='claimed').length,ready=(player.readyAchievements||[]).length;
 return `<div class="war-collection-heading"><img class="homeland-gift" src="${homelandArt('gift')}" alt=""><div><h2>Ready to claim · ${ready}</h2><strong>${claimed} / ${a.catalog.length} claimed</strong>${ready?`<small class="homeland-claim-value">${(player.readyAchievements||[]).reduce((n,g)=>n+(g.reward||0),0)} medals · ${(player.readyAchievements||[]).reduce((n,g)=>n+(g.xp??achievementXP(currentFactionData(FACTIONS.some(f=>f.id===g.id.split(':')[1])?g.id.split(':')[1]:'crown'),g.id)),0)} XP</small>`:''}</div><button type="button" class="war-claim-all" data-claim-all ${ready&&player.online?'':'disabled'} aria-label="Claim all ${ready} available achievements"><span>${ready} ready to claim</span><small>Claim all rewards</small></button></div><div class="war-album"><aside class="war-categories" aria-label="Achievement categories">${[['all','All','medal'],['faction','Faction feats','faction-flag'],['champion','Champions','champions'],['boss','Bosses','enemy-waves'],['skill-mastery','Skills','commander'],['milestone','Milestones','wave']].map(([id,name,img])=>`<button data-category="${id}" aria-pressed="${kind===id}">${id==='skill-mastery'?`<img src="${commanderSkillArt('field-promotion')}" alt="">`:id==='faction'?`<img src="${siteUrl('assets/ui/hud-generated/wave.webp')}" alt="">`:`<img src="${siteUrl(`assets/ui/ornate/${img}.webp`)}" alt="">`}${name}</button>`).join('')}</aside><div class="war-album-content"><div class="war-filter-row">${factionTabs(faction,{all:true})}<label class="war-status-filter war-select-control"><span class="sr-only">Achievement status</span><select name="achievement-state">${[['all','All achievements'],['ready','Ready to claim'],['progress','In progress'],['claimed','Claimed']].map(([id,label])=>`<option value="${id}" ${status===id?'selected':''}>${label}</option>`).join('')}</select></label></div><div class="war-achievement-grid">${rows.slice(offset,offset+8).map(g=>{
  const roster=a.dataFor(g),state=a.state(g),reveal=!g.secret||a.eligible.has(g.id)||a.owned.has(g.id),name=g.secret&&reveal?roster.towers[g.id.split(':').at(-1)]?.name||g.name:g.name,value=a.progress(g),grant=a.owned.get(g.id),factionName=FACTIONS.find(row=>row.id===g.factionId)?.name;
  const members=g.kind==='faction-collection'?(g.requiredChampions||[]):[];
  const memberState=family=>{const id=`champion:${g.factionId}:${family}`;return a.owned.has(g.id)||a.eligible.has(g.id)||a.owned.has(id)||a.eligible.has(id)?'discovered':a.pending.has(id)?'pending':'missing';};
  const art=achievementPicture(g,roster,reveal,{label:name});
  return `<article class="war-achievement is-${state} ${factionFeat(g)?'is-faction-feat':''} ${focusId===g.id?'is-target':''}" data-achievement="${esc(g.id)}"${g.factionId?` data-achievement-faction="${g.factionId}"`:''}><div class="war-achievement-art">${art}</div><div class="war-achievement-copy"><div class="achievement-description" tabindex="0" aria-label="Achievement conditions"><h2>${esc(name)}</h2>${factionName?`<span class="war-achievement-scope is-faction">${factionMark(g.factionId)}${esc(factionName)} · Faction achievement</span>`:isSharedAchievement(g.id)?'<span class="war-achievement-scope">Shared across factions</span>':''}<p title="${esc(g.description||g.name)}">${esc(g.description||g.name)}</p>${members.length?`<ul class="war-achievement-requirements" aria-label="Required ${esc(factionName)} champions">${members.map(family=>{const current=memberState(family);return `<li data-required-champion="${family}" data-discovery="${current}"><span aria-hidden="true">${current==='discovered'?'✓':current==='pending'?'◷':'○'}</span><span>${esc(roster.towers[family]?.name||'Champion')}<small>${current==='discovered'?'Discovered':current==='pending'?'Verification pending':'Not discovered'}</small></span></li>`;}).join('')}</ul>`:''}</div><div class="war-achievement-bottom"><span class="war-achievement-state">${state==='claimed'?'✓ Claimed':state==='ready'?'Ready to claim':state==='pending'?'Verification pending':'In progress'}</span>${medalAmount(grant?grant.reward:g.reward,'')}${g.xp?xpAmount(g.xp):''}</div>${state==='progress'||state==='pending'||factionFeat(g)?`<div class="war-progress" role="progressbar" aria-label="${esc(name)} progress" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="${g.target}"><i style="width:${value/g.target*100}%"></i><span>${value.toLocaleString('en-US')} / ${g.target.toLocaleString('en-US')}</span></div>`:''}${state==='ready'?`<button class="war-claim" data-claim="${esc(g.id)}" ${player.online?'':'disabled'}>Claim · ${g.reward} ${g.reward===1?'medal':'medals'}${g.xp?' + '+g.xp+' XP':''}</button>${!player.online?'<small>Connect to claim your reward.</small>':''}`:state==='claimed'?`<time datetime="${new Date(grant.createdAt).toISOString()}">${new Date(grant.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</time>`:''}</div></article>`;
 }).join('')||'<div class="war-empty"><h2>No achievements match these filters</h2><p>Try another category or show all achievements.</p><button data-clear-filters>Show all achievements</button></div>'}</div><nav class="menu-pagination"><button data-page="${Math.max(0,offset-8)}" ${offset?'':'disabled'}>Previous</button><span>${rows.length?offset+1:0}–${Math.min(offset+8,rows.length)} / ${rows.length}</span><button data-page="${offset+8}" ${offset+8<rows.length?'':'disabled'}>Next</button></nav><p class="war-helper">Claim rewards individually or use Claim all, once per achievement per account. Faction feats use that faction's own verified champions and victories; the full roster includes all 38 champions, from Basic through Secret. Boss victories and flawless milestones are shared across factions. Flawless waves must be consecutive in one run; any keep health loss resets the current streak.</p></div></div>`;
}
export {generalView} from './commander-skills.js';
export function hallView(result,{guest=false,view='top'}={}){
 const rows=result.top||[],own=result.own;
 const row=r=>`<tr class="${own?.id===r.id?'is-own':''}"><td>${[1,2,3].includes(r.rank)?`<img class="homeland-medal" src="${homelandArt('medal'+r.rank)}" alt="Place ${r.rank}">`:r.rank}</td><td>${factionMark(r.factionId)}<span>${esc(r.name)}</span></td><td>${exactNumber(r.score)}</td><td>${r.highestWave}</td></tr>`;
 return `<div class="war-hall-controls">${factionTabs(result.factionId,{all:true})}<label class="war-select-control"><span class="sr-only">Leaderboard view</span><select name="hall-view"><option value="top" ${view==='top'?'selected':''}>Top records</option><option value="own" ${view==='own'?'selected':''} ${own?'':'disabled'}>My ranking</option></select></label><button data-nav="legacy">Legacy records</button></div>${rows.length?`<div class="menu-table-wrap"><table class="war-leaderboard"><thead><tr><th>Rank</th><th>Commander</th><th>Score</th><th>Wave</th></tr></thead><tbody>${rows.map(row).join('')}${own&&!rows.some(r=>r.id===own.id)?row(own):''}</tbody></table></div><nav class="menu-pagination"><button data-page="${Math.max(0,result.offset-25)}" ${result.offset?'':'disabled'}>Previous</button><span>${result.offset+1}–${result.offset+rows.length} / ${result.total}</span><button data-page="${result.offset+25}" ${result.offset+rows.length<result.total?'':'disabled'}>Next</button></nav>`:'<section class="war-empty"><h2>Set the first record</h2><p>Complete an account run and claim your place in the hall.</p><button data-nav="home">Play</button></section>'}<section class="war-personal-best"><h2>Your personal best</h2>${own?`<strong>${exactNumber(own.score)} <small>score</small></strong><strong>Wave ${own.highestWave}</strong><span>${result.next?(result.gap==='0'?'Score tied — wave and finish order decide the next rank.':`${exactNumber(result.gap)} points to rank ${result.next.rank}`):'You lead this competition.'}</span>`:`<p>${guest?'Sign in to set your own record.':'Complete an account run to set your first record.'}</p>`}<button class="war-primary" data-nav="home">Play Again</button></section>`;
}
