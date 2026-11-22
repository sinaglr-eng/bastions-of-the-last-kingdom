import {warArt,factionTabs} from './war-table-view.js';
import {FACTIONS} from '../game/core/factions.js';
import {siteUrl} from '../game/site-url.js';
import {formatRunDuration} from './run-clock.js';
import {ornateIcon as icon} from './icons.js';
import {GENERAL_SKILLS} from '../game/core/general.js';
import {rankLabel} from '../game/core/recipes.js';
import {loadBlueprintLibrary} from '../game/core/blueprints.js';
import {artifactBonuses,artifactModifierText} from '../game/core/artifacts.js';
import {homelandArt,woodSignUrl} from './homeland-art.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function factionPickerMarkup(id='crown'){
 const selected=FACTIONS.find(f=>f.id===id)||FACTIONS[0];
 const scenes=FACTIONS.map(f=>`<img class="war-faction-scene" data-faction-scene="${f.id}" src="${homelandArt(f.id==='crown'?f.id:f.id+'-banner')}" alt="" decoding="async" loading="${f.id===selected.id?'eager':'lazy'}" fetchpriority="${f.id===selected.id?'high':'low'}" ${f.id===selected.id?'':'hidden'}>`).join('');
 return `<section class="war-faction-panel" data-faction-picker aria-label="Faction for your new game"><div class="homeland-panorama">${scenes}<div class="war-faction-caption"><h2>${allianceTitles[selected.id]}</h2><p>${esc(selected.description)}</p></div></div><div class="war-faction-selection">${factionTabs(selected.id,{attribute:'new-faction'})}</div></section>`;
}
const allianceTitles={crown:'Human Alliance',forge:'Dwarven Alliance',grove:'Elven Alliance'};
export function selectHomeFaction(panel,faction){
 for(const image of panel.querySelectorAll('[data-faction-scene]'))image.hidden=image.dataset.factionScene!==faction.id;
 for(const button of panel.querySelectorAll('[data-new-faction]')){
  const selected=button.dataset.newFaction===faction.id;
  button.setAttribute('aria-pressed',String(selected));
  const sign=button.querySelector('.wood-sign');
  if(sign)sign.src=woodSignUrl(button.dataset.newFaction,selected);
 }
 panel.querySelector('.war-faction-caption p').textContent=faction.description;
 panel.querySelector('.war-faction-caption h2').textContent=allianceTitles[faction.id];
 const start=panel.closest('.war-home')?.querySelector('[data-start-faction]');
 if(start)start.textContent='New Game · '+faction.name;
}

function savedLoadout(snapshot){
 if(!snapshot)return '';
 const skills=Object.entries(snapshot.loadout||{}).filter(([id])=>GENERAL_SKILLS[id]);
 const bonuses=artifactModifierText(artifactBonuses(snapshot.artifactEquipment,snapshot.artifactVersion).effects);
 return `<div class="homeland-snapshot"><strong>Skills in this defense</strong><div>${skills.map(([id,r])=>`<span><img src="${warArt(id)}" alt="">${esc(GENERAL_SKILLS[id].name)} ${rankLabel(r)}</span>`).join('')||'None equipped'}</div><small>Artifact totals · ${bonuses.length?bonuses.map(esc).join(' · '):'No bonuses'}</small></div>`;
}
export function commanderLoadoutMarkup(player){
 const profile=player.profile||{},equipped=(profile.equipped||[]).filter(id=>GENERAL_SKILLS[id]).slice(0,3);
 return `<section class="home-commander-loadout"><header><h2>Skills for your next defense</h2><span>${equipped.length} / 3 equipped</span></header><div class="home-loadout-slots">${Array.from({length:3},(_,i)=>{const id=equipped[i],level=profile.skills?.[id]||0;return id?`<button data-nav="general" class="home-skill-slot"><img src="${warArt(id)}" alt=""><strong>${GENERAL_SKILLS[id].name}</strong><span>Rank ${rankLabel(level)}</span></button>`:`<button data-nav="${player.user?'general':'sign-in'}" class="home-skill-slot is-empty" aria-label="${player.user?'Equip commander skill':'Sign in to equip skills'}, slot ${i+1}"><span class="home-slot-seal">${icon('commander')}</span><strong>Open slot ${i+1}</strong><span>${player.user?'Choose a skill':'Sign in to equip'}</span></button>`;}).join('')}</div></section>`;
}
export function homeMenuMarkup({player,saved,selectedFaction='crown',cloudUnavailable=false}){
 const active=saved&&!['lost','won','abandoned','reset'].includes(saved.meta.phase),f=FACTIONS.find(f=>f.id===saved?.meta.factionId),locked=!player.user;
 let plan=null;try{const library=loadBlueprintLibrary(globalThis.localStorage);plan=library.plans.find(p=>p.id===library.selected)||library.plans[0];}catch{}
 return `<div class="menu-home war-home">${factionPickerMarkup(selectedFaction)}<div class="war-command-deck"><section class="war-saved-card ${active?'':'is-empty'}"><div class="war-saved-copy"><h2>${active?'Your saved defense':'No saved game'}</h2>${active?`<h3>${f?.name||'Alliance'}</h3><strong>Wave ${saved.meta.round}</strong><time datetime="${new Date(saved.savedAt||Date.now()).toISOString()}">Saved ${esc(new Date(saved.savedAt||Date.now()).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))}</time>`:'<h3>Prepare your defense</h3><p>Choose an alliance above to begin.</p>'}</div>${active?savedLoadout(saved.snapshot):''}<div class="homeland-start-actions">${active||cloudUnavailable?`<button class="war-primary" data-menu="continue">${active?'Continue Defense':'Retry Cloud Save'}</button>`:''}<button data-menu="new" class="${active?'':'war-primary'}"><span data-start-faction>New Game · ${esc((FACTIONS.find(f=>f.id===selectedFaction)||FACTIONS[0]).name)}</span></button></div></section>${commanderLoadoutMarkup(player)}<button class="home-maze-entry" data-nav="maze"><span class="home-maze-emblem">${icon('maze')}</span><span><strong>Maze Builder</strong><small>${plan?esc(plan.name)+' · '+plan.walls.length+' planned cells':'Design your route. Save your blueprint.'}</small><em>${plan?'Open your blueprint':'Create your own maze'}</em></span></button>${!locked?`<button class="home-maze-entry" data-menu="rank-chests"><img width="44" height="44" src="${siteUrl('assets/ui/commander-generated/chests.webp')}" alt=""><span><strong>Commander chests</strong><small>${(player.profile?.artifacts?.counts||[]).filter(c=>c.status==='ready').reduce((n,c)=>n+c.count,0)} ready to open</small></span></button>`:''}${locked?'<p class="war-helper">Play freely as a guest. Sign in to collect medals and save progress across devices.</p>':''}</div></div>`;
}
export function replaceRunMarkup(saved,factionId){
 const previous=FACTIONS.find(f=>f.id===saved.meta.factionId),next=FACTIONS.find(f=>f.id===factionId)||FACTIONS[0];
 return `<section class="menu-replace-panel"><span class="menu-replace-emblem">${icon('wave')}</span><p class="menu-eyebrow">A new campaign</p><h2 id="replace-title" tabindex="-1">Replace your current defense?</h2><p>Your saved run will be replaced when the new game starts.</p><div class="menu-saved-seal">${icon('shield')}<div><span>Current defense</span><strong>${previous?.name||'Alliance'} · Wave ${saved.meta.round}</strong><small>${formatRunDuration(saved.meta.elapsedSeconds)} played</small></div></div><p class="menu-replace-next">Your next alliance <strong>${next.name}</strong></p><div class="menu-replace-actions"><button type="button" data-menu="cancel-replace">Keep Current Game</button><button type="button" class="menu-primary" data-menu="confirm-new">Replace & Start New Game</button></div><p class="menu-replace-status" data-menu-status role="status" aria-live="polite" aria-atomic="true"></p></section>`;
}
