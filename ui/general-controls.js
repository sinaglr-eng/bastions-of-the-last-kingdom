import {fieldArtifactMarkup} from './commander-vault.js';
import {siteUrl} from '../game/site-url.js';
import {GENERAL_SKILLS} from '../game/core/general.js';
import {rankLabel} from '../game/core/recipes.js';
import {progressionArtwork,escapeProgression as esc} from './progression-art.js';
import {skillEffect,skillSummary} from './general-page.js';

const uses=state=>`${state.remainingUses} / ${state.maxUses} uses remaining`;
export function generalCommandState(game,slot='A'){
 if(!game?.general||game.developerMode)return [];
 return Object.entries(game.general.loadout).map(([id,level])=>{
  const skill=GENERAL_SKILLS[id],ended=['lost','won'].includes(game.phase),remaining=game.general.remaining(id),cp=game.commandPoints.value;
  if(skill.kind==='promotion'){
   const state=game.general.promotionState();
   const usage=state.perRound?(state.remainingUses?'Available this round':'Used this round'):uses(state);
   return {id,level,action:'general-promotion',towerId:state.selectedTowerId??'',disabled:!state.available,remaining:0,label:state.available?`Promote selected · ${state.cost} CP`:state.reason,detail:`${usage} · Cap rank ${rankLabel(state.cap)}`,preview:state.preview||[],showPreview:['build','select'].includes(game.phase)&&!game.draft?.resolved,reason:state.reason,usage};
  }
  if(skill.kind==='wave-range'){
   const state=game.general.rangeState();
   return {id,level,action:'general-range',disabled:!state.available,remaining:0,label:state.active?`Active for wave ${state.round} · +${state.bonus} ${state.bonus===1?'tile':'tiles'}`:state.available?'Extend all ranges · 200 gold':state.reason,detail:`All defenders · Current wave only · 200 gold · 0 CP`,waveActive:!!state.active,reason:state.reason};
  }
  if(skill.kind==='strike'){
   const state=game.general.strikeState(),prepared=!!state.prepared;
   return {id,level,action:prepared?'general-strike-execute':'general-strike-prepare',disabled:!state.available,remaining:0,label:state.available?(prepared?`Confirm strike · ${state.count} ${state.count===1?'enemy':'enemies'} · 0 CP`:'Prepare strike · 0 CP'):state.reason,detail:`${uses(state)} · ${state.count} live ${state.count===1?'enemy':'enemies'}`,prepared,reason:state.reason,usage:uses(state)};
  }
  if(skill.kind==='combat')return {id,level,action:'general-skill',disabled:ended||game.phase!=='combat'||remaining>1e-9||cp<skill.cost,remaining,label:remaining>1e-9?`Active · ${remaining.toFixed(1)}s`:game.phase!=='combat'?'Available during combat':cp<skill.cost?'Need 3 CP':'Activate · 3 CP',detail:`${skillEffect(id,level)} · ${skill.duration}s`,progress:remaining/skill.duration};
  if(skill.kind==='focus'){const pending=game.general.pendingFocus,active=game.general.draftFocus;return {id,level,action:'general-focus',disabled:ended||!!pending||cp<1,remaining:0,label:pending?`Queued for draft ${pending.round}`:cp<1?'Need 1 CP':'Prepare next draft · 1 CP',detail:pending?`Class ${pending.slot} · ${skillEffect(id,level)}`:active?`Class ${active.slot} favoured in this draft`:`Class ${slot} · ${skillEffect(id,level)} next draft`};}
  if(skill.kind==='draft'){
   const t=game.selection,eligible=!ended&&!game.commandMove.active&&game.phase==='select'&&!!t&&game.roundCandidates.some(c=>c.tower===t)&&!game.data.towers[t.family].advanced&&t.tier>2;
   return {id,level,action:'deep-refit',towerId:t?.id??'',disabled:!eligible||game.economy.gold<game.general.value(id),remaining:0,label:eligible?`Downgrade & keep · ${game.general.value(id)} gold`:'Select a rank III–VI recruit',detail:'Lower exactly two ranks and keep this recruit'};
  }
  return {id,level,action:null,disabled:false,remaining:0,label:id==='fortified-keep'?`Applied at start · ${game.maxLives} maximum keep health`:'Applied at game start',detail:skillEffect(id,level)};
 });
}
export const recruitmentClassOptions=game=>'ABCDEFGH'.split('').map(code=>{const unit=Object.values(game.data?.towers||{}).find(u=>!u.advanced&&u.unitCode===code);return {code,label:unit?`${code} — ${unit.name}`:code};});
export function updateQuickCommanderControls(host,game,slot){
 const rows=generalCommandState(game,slot).filter(row=>row.action);
 const key=`${game?.factionId}:${rows.map(row=>row.id+row.level).join(',')}`;
 host.hidden=!rows.length;
 if(host.dataset.loadout!==key){
  host.dataset.loadout=key;
  host.innerHTML=rows.map(row=>{
   const {id}=row;
   const choices=id==='recruitment-focus'?`<select data-recruitment-class aria-label="Recruitment Focus class">${recruitmentClassOptions(game).map(({code,label})=>`<option value="${code}">${esc(label)}</option>`).join('')}</select>`:'';
   const cancel=id==='decisive-strike'?'<button type="button" data-quick-cancel data-action="general-strike-cancel" hidden aria-label="Cancel Decisive Strike" title="Cancel Decisive Strike">×</button>':'';
   return `<div class="field-command-shortcut" data-quick-skill="${id}">${choices}
    <button type="button" data-quick-action><img src="${progressionArtwork(id)}" width="30" height="30" alt=""><span data-quick-label hidden></span></button>${cancel}
   </div>`;
  }).join('');
 }
 for(const row of rows){
  const card=host.querySelector(`[data-quick-skill="${row.id}"]`);
  const button=card.querySelector('[data-quick-action]');
  const name=GENERAL_SKILLS[row.id].name;
  const tooltip=`${name} ${rankLabel(row.level)} · ${row.label}`;
  button.disabled=row.disabled;
  button.dataset.action=row.action;
  button.dataset.skill=row.id;
  if(row.towerId!==undefined)button.dataset.towerId=String(row.towerId);
  button.setAttribute('aria-label',tooltip);
  button.title=tooltip;
  const label=button.querySelector('[data-quick-label]');
  label.hidden=!row.prepared;
  label.textContent=row.prepared?'Confirm':'';
  card.classList.toggle('is-active',row.waveActive||row.remaining>1e-9);
  const select=card.querySelector('select');
  if(select){select.disabled=!!game.general.pendingFocus;select.value=slot;select.title=select.selectedOptions[0]?.textContent||'Recruitment Focus class';}
  const cancel=card.querySelector('[data-quick-cancel]');
  if(cancel)cancel.hidden=!row.prepared;
 }
}
export function promotionPreviewMarkup(preview=[],selectedTowerId=null){
 const row=preview.find(candidate=>candidate.towerId!=null&&candidate.towerId===selectedTowerId);
 if(!row||row.from==null)return `<li class="is-pending"><span>Select a current recruit</span><small>Place all five, then select the recruit you want to promote.</small></li>`;
 return `<li class="${row.eligible?'is-eligible':'is-capped'}" data-promotion-tower="${row.towerId}"><span><small>Selected recruit${row.reserved?' · Returning reserve':''}</small><strong>${esc(row.name||row.family||'Defender')}</strong></span><b>${rankLabel(row.from)} → ${rankLabel(row.to)}</b><small>${esc(row.eligible?'Only this recruit gains one rank.':row.reason||'Cannot promote')}</small></li>`;
}
export function generalControlsMarkup(game,slot='A'){
 const rows=generalCommandState(game,slot);
 if(!rows.length)return `<div class="general-command-empty"><img src="${siteUrl('assets/ui/ornate/commander-portrait.webp')}" alt="Commander crest" width="80" height="80"><h2>${game?.developerMode?'Developer Mode':'No skills equipped'}</h2><p>${game?.developerMode?'Commander account abilities are unavailable in Developer Mode.':'Unlock and equip skills in Home → Commander before starting a new game.'}</p><small>Your saved run keeps its original loadout.</small></div>`;
 return `<header class="general-panel-heading"><div><span>Field command</span><h2>Your commander</h2></div><div class="general-command-resources"><strong><span data-general-cp>${game.commandPoints.value}</span> CP</strong><strong><span data-general-gold>${Number(game.economy.gold).toLocaleString('en-US')}</span> gold</strong></div></header><div class="general-command-skills">${rows.map(row=>{
  const skill=GENERAL_SKILLS[row.id];
  return `<article class="general-command-skill${row.waveActive||row.remaining>1e-9?' is-active':''}" data-command-skill="${row.id}"><div class="general-command-skill-heading"><img src="${progressionArtwork(row.id)}" width="54" height="54" alt=""><div><h3>${skill.name} <span>${rankLabel(row.level)}</span></h3><p data-command-detail>${esc(row.detail)}</p></div></div><p class="general-skill-summary">${esc(skillSummary(row.id,row.level))}</p>${skill.kind==='focus'?`<label class="general-focus-label">Recruitment class<select id="general-focus" aria-label="Recruitment Focus class">${recruitmentClassOptions(game).map(({code,label})=>`<option value="${code}" ${code===slot?'selected':''}>${esc(label)}</option>`).join('')}</select></label>`:''}${skill.kind==='promotion'?`<ol class="general-promotion-preview" data-promotion-preview aria-label="Selected recruit promotion preview" ${row.showPreview?'':'hidden'}>${promotionPreviewMarkup(row.preview,row.towerId)}</ol>`:''}${skill.kind==='strike'?`<p class="general-strike-confirmation" data-command-preparation ${row.prepared?'':'hidden'}>Ready to strike every live enemy, including hidden and flying enemies. Confirm below or cancel.</p>`:''}${row.action?`<button type="button" data-action="${row.action}" ${row.action==='general-skill'?`data-skill="${row.id}"`:''} ${['deep-refit','general-promotion'].includes(row.action)?`data-tower-id="${row.towerId}"`:''} ${row.disabled?'disabled':''}><span data-command-label>${esc(row.label)}</span></button>`:`<p class="general-passive-label" data-command-label>${esc(row.label)}</p>`}${skill.kind==='strike'?`<button type="button" class="general-strike-cancel" data-command-cancel data-action="general-strike-cancel" ${row.prepared?'':'hidden'}>Cancel strike · keep use</button>`:''}<div class="general-active-timer" ${row.remaining>0?'':'hidden'}><i style="width:${Math.min(100,(row.progress||0)*100)}%"></i></div></article>`;
 }).join('')}</div><p class="general-panel-note">Limited uses stay spent for this entire defense. Pausing freezes timed combat effects. Closing Commander cancels a prepared strike without spending its use.</p>`;
}
// Keep primary buttons and focus intact while the authoritative command state changes.
export function updateGeneralControls(host,game,slot='A'){
 const key=JSON.stringify([game?.developerMode,game?.general?.loadout||{},game?.artifactEquipment||{}]);
 if(host.dataset.loadout!==key){host.innerHTML=generalControlsMarkup(game,slot)+fieldArtifactMarkup(game);host.dataset.loadout=key;}
 const cp=host.querySelector('[data-general-cp]');if(cp)cp.textContent=String(game.commandPoints.value);
 const gold=host.querySelector('[data-general-gold]');if(gold)gold.textContent=Number(game.economy.gold).toLocaleString('en-US');
 const rows=generalCommandState(game,slot);
 for(const row of rows){
  const card=host.querySelector(`[data-command-skill="${row.id}"]`);if(!card)continue;
  const button=card.querySelector('button'),label=card.querySelector('[data-command-label]'),detail=card.querySelector('[data-command-detail]'),timer=card.querySelector('.general-active-timer');
  if(button){button.disabled=row.disabled;button.dataset.action=row.action;button.setAttribute('aria-label',`${GENERAL_SKILLS[row.id].name} rank ${rankLabel(row.level)} · ${row.label}`);if(['deep-refit','general-promotion'].includes(row.action))button.dataset.towerId=String(row.towerId);}
  if(label&&label.textContent!==row.label)label.textContent=row.label;if(detail&&detail.textContent!==row.detail)detail.textContent=row.detail;card.classList.toggle('is-active',row.remaining>1e-9||!!row.waveActive);if(timer){timer.hidden=row.remaining<=1e-9;timer.querySelector('i').style.width=`${Math.min(100,(row.progress||0)*100)}%`;}
  const preview=card.querySelector('[data-promotion-preview]');if(preview){preview.hidden=!row.showPreview;const signature=JSON.stringify([row.preview,row.towerId]);if(preview.dataset.preview!==signature){preview.innerHTML=promotionPreviewMarkup(row.preview,row.towerId);preview.dataset.preview=signature;}}
  const preparation=card.querySelector('[data-command-preparation]');if(preparation)preparation.hidden=!row.prepared;
  const cancel=card.querySelector('[data-command-cancel]');if(cancel)cancel.hidden=!row.prepared;
  const select=card.querySelector('select');if(select){select.disabled=!!game.general.pendingFocus;if(select.value!==slot)select.value=slot;}
 }
 return rows.length;
}
