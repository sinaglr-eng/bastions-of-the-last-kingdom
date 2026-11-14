import {GENERAL_SKILLS} from '../game/core/general.js';
import {rankLabel} from '../game/core/recipes.js';
import {progressionArtwork,escapeProgression as esc} from './progression-art.js';
import {skillEffect} from './general-page.js';

export function generalCommandState(game,slot='A'){
 if(!game?.general||game.developerMode)return [];
 return Object.entries(game.general.loadout).map(([id,level])=>{
  const skill=GENERAL_SKILLS[id],ended=['lost','won'].includes(game.phase),remaining=game.general.remaining(id),cp=game.commandPoints.value;
  if(skill.kind==='combat')return {id,level,action:'general-skill',disabled:ended||game.phase!=='combat'||remaining>1e-9||cp<skill.cost,remaining,label:remaining>1e-9?`Active · ${remaining.toFixed(1)}s`:game.phase!=='combat'?'Available during combat':cp<skill.cost?'Need 3 CP':'Activate · 3 CP',detail:`${skillEffect(id,level)} · ${skill.duration}s`,progress:remaining/skill.duration};
  if(skill.kind==='focus'){const pending=game.general.pendingFocus,active=game.general.draftFocus;return {id,level,action:'general-focus',disabled:ended||!!pending||cp<1,remaining:0,label:pending?`Queued for draft ${pending.round}`:cp<1?'Need 1 CP':'Prepare next draft · 1 CP',detail:pending?`Class ${pending.slot} · ${skillEffect(id,level)}`:active?`Class ${active.slot} favoured in this draft`:`Class ${slot} · ${skillEffect(id,level)} next draft`};}
  if(skill.kind==='draft'){
   const t=game.selection,eligible=!ended&&!game.commandMove.active&&game.phase==='select'&&!!t&&game.roundCandidates.some(c=>c.tower===t)&&!game.data.towers[t.family].advanced&&t.tier>2;
   return {id,level,action:'deep-refit',towerId:t?.id??'',disabled:!eligible||game.economy.gold<game.general.value(id),remaining:0,label:eligible?`Downgrade & keep · ${game.general.value(id)} gold`:'Select a rank III–VI recruit',detail:'Lower exactly two ranks and keep this recruit'};
  }
  return {id,level,action:null,disabled:false,remaining:0,label:'Applied at game start',detail:skillEffect(id,level)};
 });
}
export function generalControlsMarkup(game,slot='A'){
 const rows=generalCommandState(game,slot);
 if(!rows.length)return `<div class="general-command-empty"><img src="${progressionArtwork('field-logistics')}" alt="General command crest" width="80" height="80"><h2>${game?.developerMode?'Developer Mode':'No skills equipped'}</h2><p>${game?.developerMode?'General account abilities are unavailable in Developer Mode.':'Unlock and equip skills in Main Menu → General before starting a new game.'}</p><small>Your saved run keeps its original loadout.</small></div>`;
 return `<header class="general-panel-heading"><div><span>Field command</span><h2>Your general</h2></div><strong><span data-general-cp>${game.commandPoints.value}</span> CP</strong></header><div class="general-command-skills">${rows.map(row=>{
  const skill=GENERAL_SKILLS[row.id];
  return `<article class="general-command-skill" data-command-skill="${row.id}"><div class="general-command-skill-heading"><img src="${progressionArtwork(row.id)}" width="54" height="54" alt=""><div><h3>${skill.name} <span>${rankLabel(row.level)}</span></h3><p data-command-detail>${esc(row.detail)}</p></div></div>${skill.kind==='focus'?`<label class="general-focus-label">Recruitment class<select id="general-focus" aria-label="Recruitment Focus class">${'ABCDEFGH'.split('').map(code=>`<option ${code===slot?'selected':''}>${code}</option>`).join('')}</select></label>`:''}${row.action?`<button type="button" data-action="${row.action}" ${row.action==='general-skill'?`data-skill="${row.id}"`:''} ${row.action==='deep-refit'?`data-tower-id="${row.towerId}"`:''} ${row.disabled?'disabled':''}><span data-command-label>${esc(row.label)}</span></button>`:`<p class="general-passive-label" data-command-label>${row.label}</p>`}<div class="general-active-timer" ${row.remaining>0?'':'hidden'}><i style="width:${Math.min(100,(row.progress||0)*100)}%"></i></div></article>`;
 }).join('')}</div><p class="general-panel-note">Active effects use combat time. Pausing freezes their remaining duration.</p>`;
}
// Keep the mounted buttons/select intact as combat time, CP and selection change.
export function updateGeneralControls(host,game,slot='A'){
 const key=JSON.stringify([game?.developerMode,game?.general?.loadout||{}]);
 if(host.dataset.loadout!==key){host.innerHTML=generalControlsMarkup(game,slot);host.dataset.loadout=key;}
 const cp=host.querySelector('[data-general-cp]');if(cp)cp.textContent=String(game.commandPoints.value);
 const rows=generalCommandState(game,slot);
 for(const row of rows){
  const card=host.querySelector(`[data-command-skill="${row.id}"]`);if(!card)continue;
  const button=card.querySelector('button'),label=card.querySelector('[data-command-label]'),detail=card.querySelector('[data-command-detail]'),timer=card.querySelector('.general-active-timer');
  if(button){button.disabled=row.disabled;button.setAttribute('aria-label',`${GENERAL_SKILLS[row.id].name} rank ${rankLabel(row.level)} · ${row.label}`);if(row.action==='deep-refit')button.dataset.towerId=String(row.towerId);}
  if(label.textContent!==row.label)label.textContent=row.label;if(detail.textContent!==row.detail)detail.textContent=row.detail;card.classList.toggle('is-active',row.remaining>1e-9);timer.hidden=row.remaining<=1e-9;timer.querySelector('i').style.width=`${Math.min(100,(row.progress||0)*100)}%`;
  const select=card.querySelector('select');if(select){select.disabled=!!game.general.pendingFocus;if(select.value!==slot)select.value=slot;}
 }
 return rows.length;
}
