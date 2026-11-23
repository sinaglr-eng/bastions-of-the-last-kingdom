import {GENERAL_SKILLS} from '../game/core/general.js';

const skills=['deep-refit','field-promotion'];
const preparedSkills=new WeakMap();

export function draftSkillState(game,id){
 if(id==='field-promotion'){
  const state=game.general.promotionState(null,false,true);
  return {...state,targets:state.preview.filter(row=>row.eligible).map(row=>row.towerId),price:`${state.cost} CP`};
 }
 const cost=game.general.value('deep-refit');
 const targets=game.roundCandidates.filter(({tower})=>tower.state==='draft'&&tower.tier>=3&&
  game.validFactionUnit(tower)&&!game.data.towers[tower.family].advanced).map(({tower})=>tower.id);
 let reason='';
 if(!cost||game.developerMode)reason='Deep Refit is unavailable.';
 else if(game.phase!=='select'||game.draft.resolved)reason='Available when choosing a keeper.';
 else if(game.commandMove.active)reason='Finish or cancel Move first.';
 else if(game.economy.gold<cost)reason=`Need ${cost} gold.`;
 else if(!targets.length)reason='No basic recruit at rank III or higher.';
 return {available:!reason,reason,targets,price:`${cost} gold`};
}

export function preparedDraftSkill(game){
 const entry=preparedSkills.get(game);
 if(!entry)return null;
 if(entry.round===game.round&&draftSkillState(game,entry.id).available)return entry.id;
 preparedSkills.delete(game);
 return null;
}

export function toggleDraftSkill(game,id){
 if(!skills.includes(id))return false;
 if(preparedDraftSkill(game)===id)return cancelDraftSkill(game);
 if(!draftSkillState(game,id).available)return false;
 preparedSkills.set(game,{id,round:game.round});
 return true;
}

export const cancelDraftSkill=game=>preparedSkills.delete(game);

// An armed skill consumes the click even on an invalid tile, so a tap can
// never fall through to a normal keeper selection or a double-tap keep.
export function applyPreparedDraftSkill(game,towerId){
 const id=preparedDraftSkill(game);
 if(!id)return false;
 if(!draftSkillState(game,id).targets.includes(towerId)){
  game.message('Choose a highlighted basic recruit or cancel the command.');
  return true;
 }
 cancelDraftSkill(game);
 game.select(towerId);
 if(id==='field-promotion')game.activateGeneral(id,towerId);
 else game.downgrade(2);
 return true;
}

export function draftSkillActionsMarkup(game){
 if(!game.data.fr010||game.developerMode||game.phase!=='select')return '';
 const prepared=preparedDraftSkill(game);
 return skills.filter(id=>game.general.level(id)).map(id=>{
  const state=draftSkillState(game,id),pressed=prepared===id,name=GENERAL_SKILLS[id].name;
  return `<button type="button" class="secondary-button draft-skill-action" data-action="prepare-draft-skill" data-skill="${id}" aria-pressed="${pressed}" ${state.available?'':'disabled'} title="${state.reason||name}" aria-label="${pressed?`Cancel ${name}`:`${name} · ${state.price}`}"><span>${pressed?`Cancel ${name}`:name}</span>${pressed?'':`<small class="decision-price">${state.price}</small>`}</button>`;
 }).join('');
}
