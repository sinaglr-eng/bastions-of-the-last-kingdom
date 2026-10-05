import {icon} from './icons.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const descriptions={reroll:['Reroll','reset','Generate new defenders once per draft'],reserve:['Reserve','pin','Keep the selected defender inactive at its fixed tile until the next draft; it still blocks the path'],move:['Move','path','Move a retained defender to a castle wall']};

function commandButton(game,action){
  const state=game.commandActions[action],info=descriptions[action];
  const label=`${info[0]} — ${state.cost} CP`,description=state.available?info[2]:state.reason;
  return `<div class="command-action"><button type="button" class="text-button command-button" data-action="${action}" ${state.available?'':'disabled'} aria-label="${escape(`${label}. ${description}`)}" title="${escape(description)}">${icon(info[1])}<span>${info[0]}</span><b>${state.cost} CP</b></button>${!state.available&&state.reason?`<small class="command-disabled-reason">${escape(state.reason)}</small>`:''}</div>`;
}

export function commandPointsMarkup(game,{context='draft'}={}){
  if(['won','lost'].includes(game.phase))return '';
  if(context==='draft'){
    if(!['build','select'].includes(game.phase))return '';
    return `<section class="draft-command-actions" aria-label="Command Point draft actions">${commandButton(game,'reroll')}${commandButton(game,'reserve')}</section>`;
  }
  if(context!=='sidebar')return '';
  const moving=game.moveSelection;
  if(moving){
    const instruction=moving.towerId===null?'Choose a highlighted retained defender.':'Choose a highlighted castle wall to exchange positions.';
    const state=game.commandActions.cancelMove;
    return `<section class="command-move-panel is-moving" aria-label="Command Point movement"><div class="command-move-heading">${icon('path')}<strong>Move · ${game.commandActions.move.cost} CP</strong></div><p>${instruction} Points are spent only after a valid move.</p><button type="button" class="text-button command-cancel" data-action="cancel-move" ${state.available?'':'disabled'}>${icon('close')} Cancel Move</button></section>`;
  }
  return `<section class="command-move-panel" aria-label="Command Point movement">${commandButton(game,'move')}</section>`;
}
