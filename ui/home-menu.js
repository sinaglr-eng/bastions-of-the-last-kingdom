import {warArt,factionTabs} from './war-table-view.js';
import {FACTIONS} from '../game/core/factions.js';
import {siteUrl} from '../game/site-url.js';
import {formatRunDuration} from './run-clock.js';
import {ornateIcon as icon} from './icons.js';
import {GENERAL_SKILLS} from '../game/core/general.js';
import {rankLabel} from '../game/core/recipes.js';
import {loadBlueprintLibrary} from '../game/core/blueprints.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const lockMark='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></svg>';
export function factionPickerMarkup(id='crown'){
 const selected=FACTIONS.find(f=>f.id===id)||FACTIONS[0];
 return `<section class="war-faction-panel" data-faction-picker aria-label="Faction for your new game"><img class="war-faction-scene" src="${siteUrl(selected.scene)}" width="${selected.sceneWidth}" height="${selected.sceneHeight}" alt="${selected.name} champions marching into battle"><div class="war-faction-selection">${factionTabs(selected.id,{attribute:'new-faction'})}<div class="war-faction-caption"><p>${esc(selected.description)}</p><button data-menu="new"><span data-start-faction>New Game · ${selected.name}</span></button></div></div></section>`;
}
export function commanderLoadoutMarkup(player){
 const profile=player.profile||{},equipped=(profile.equipped||[]).filter(id=>GENERAL_SKILLS[id]).slice(0,3);
 return `<section class="home-commander-loadout"><header><h2>Commander loadout</h2><span>${equipped.length} / 3 equipped</span></header><div class="home-loadout-slots">${Array.from({length:3},(_,i)=>{const id=equipped[i],level=profile.skills?.[id]||0;return id?`<button data-nav="general" class="home-skill-slot"><img src="${warArt(id)}" alt=""><strong>${GENERAL_SKILLS[id].name}</strong><span>Rank ${rankLabel(level)}</span></button>`:`<button data-nav="${player.user?'general':'sign-in'}" class="home-skill-slot is-empty" aria-label="${player.user?'Equip commander skill':'Sign in to equip skills'}, slot ${i+1}"><span class="home-slot-seal">${icon('commander')}</span><strong>Open slot ${i+1}</strong><span>${player.user?'Choose a skill':'Sign in to equip'}</span></button>`;}).join('')}</div></section>`;
}
export function homeMenuMarkup({player,saved,selectedFaction='crown',cloudUnavailable=false}){
 const active=saved&&!['lost','won','reset'].includes(saved.meta.phase),f=FACTIONS.find(f=>f.id===saved?.meta.factionId),locked=!player.user;
 let plan=null;try{const library=loadBlueprintLibrary(globalThis.localStorage);plan=library.plans.find(p=>p.id===library.selected)||library.plans[0];}catch{}
 return `<div class="menu-home war-home">${factionPickerMarkup(selectedFaction)}<div class="war-command-deck"><section class="war-saved-card ${active?'':'is-empty'}"><div class="war-saved-copy"><h2>Your saved defense</h2>${active?`<h3>${f?.name||'Alliance'}</h3><strong>Wave ${saved.meta.round}</strong><time datetime="${new Date(saved.savedAt||Date.now()).toISOString()}">Saved ${esc(new Date(saved.savedAt||Date.now()).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))}</time>`:'<h3>No saved game</h3><p>No defense is currently saved. Choose your faction to start a new game.</p>'}</div>${active||cloudUnavailable?`<button class="war-primary" data-menu="continue">${active?'Continue Defense':'Retry Cloud Save'}</button>`:''}</section>${commanderLoadoutMarkup(player)}<button class="home-maze-entry" data-nav="maze"><span class="home-maze-emblem">${icon('maze')}</span><span><strong>Maze Builder</strong><small>${plan?esc(plan.name)+' · '+plan.walls.length+' planned cells':'Design your route. Save your blueprint.'}</small><em>${plan?'Open your blueprint':'Create your own maze'}</em></span></button>${locked?'<p class="war-helper">Play freely as a guest. Sign in to collect medals and save progress across devices.</p>':''}</div></div>`;
}
export function replaceRunMarkup(saved,factionId){
 const previous=FACTIONS.find(f=>f.id===saved.meta.factionId),next=FACTIONS.find(f=>f.id===factionId)||FACTIONS[0];
 return `<section class="menu-replace-panel"><span class="menu-replace-emblem">${icon('wave')}</span><p class="menu-eyebrow">A new campaign</p><h2 id="replace-title" tabindex="-1">Replace your current defense?</h2><p>Your saved run will be replaced when the new game starts.</p><div class="menu-saved-seal">${icon('shield')}<div><span>Current defense</span><strong>${previous?.name||'Alliance'} · Wave ${saved.meta.round}</strong><small>${formatRunDuration(saved.meta.elapsedSeconds)} played</small></div></div><p class="menu-replace-next">Your next alliance <strong>${next.name}</strong></p><div class="menu-replace-actions"><button type="button" data-menu="cancel-replace">Keep Current Game</button><button type="button" class="menu-primary" data-menu="confirm-new">Replace & Start New Game</button></div><p class="menu-replace-status" data-menu-status role="status" aria-live="polite" aria-atomic="true"></p></section>`;
}
