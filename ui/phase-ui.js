import {icon} from './icons.js';

export const endedPhase=phase=>phase==='won'||phase==='lost';
export class PhaseUiState {
  constructor(){this.phase=null;this.round=null;this.selection=null;this.inspectorOpen=false;this.view='unit';this.historyExpanded=false;}
  sync(game){
    const selection=game.enemySelection?`enemy:${game.enemySelection.id}`:game.selection?`tower:${game.selection.id}:${game.selection.state}`:null;
    const changed=game.phase!==this.phase||game.round!==this.round;
    if(changed){
      this.historyExpanded=['build','select'].includes(game.phase);
      if(game.phase==='combat'){this.inspectorOpen=true;this.view='wave';}
      else if(endedPhase(game.phase)||game.phase==='build'&&this.phase==='combat'){this.inspectorOpen=false;this.view='unit';}
      this.selection=selection;
    }else if(selection&&selection!==this.selection){this.inspectorOpen=true;this.view='unit';}
    if(!changed&&selection===null&&this.selection!==null&&this.view==='unit')this.inspectorOpen=false;
    this.phase=game.phase;this.round=game.round;this.selection=selection;
    return this;
  }
  open(view='unit'){this.inspectorOpen=true;this.view=view;}
  close(){this.inspectorOpen=false;}
  toggleHistory(){this.historyExpanded=!this.historyExpanded;}
  apply(app,game){app.dataset.phase=game.phase;app.dataset.paused=String(game.phase==='combat'&&game.paused);app.dataset.inspectorOpen=String(this.inspectorOpen);app.dataset.inspectorView=this.view;app.dataset.draftExpanded=String(this.historyExpanded);}
}

export function phaseStripMarkup(game,state){
  if(['build','select'].includes(game.phase))return '';
  const ended=endedPhase(game.phase),active=game.towers.filter(t=>t.state==='active'),keeper=game.draft.draws.map(draw=>game.towers.find(t=>t.id===draw.towerId&&t.state==='active')).find(Boolean)||active.at(-1);
  const label=ended?'Run ended · Read-only battlefield':game.phase==='combat'?(game.paused?'Paused · Global combat pause':'Combat underway'):'Ready · Keeper chosen';
  return `<strong class="phase-strip-label">${label}</strong><div id="combat-counts" class="combat-counts"></div><nav aria-label="Phase actions">${ended?'<button class="primary-button" data-action="restart">Play again</button><button class="text-button" data-action="result-return">Results</button>':''}${game.phase==='combat'?`<button class="text-button" data-action="inspect-wave" aria-expanded="${state.inspectorOpen&&state.view==='wave'}">${icon('swords')} Current wave</button>`:''}${keeper?`<button class="text-button" data-action="inspect-keeper" data-id="${keeper.id}" aria-expanded="${state.inspectorOpen&&state.view==='unit'&&game.selected===keeper.id}">${icon('target')} Inspect keeper</button>`:''}${!ended?`<button class="text-button" data-action="draft-history" aria-expanded="${state.historyExpanded}" aria-controls="draft-history">${icon('book')}<span>Draft history &amp; odds</span></button>`:''}</nav>`;
}

export function combatStatusModel(game){
  if(game.phase!=='combat')return null;
  const living=game.combat.enemies.filter(enemy=>!enemy.dead),queued=game.combat.spawnQueue.length;
  let hp=0,maxHp=0,visible=0,concealed=0,approaching=0;const names=[];
  for(const enemy of living){if(!enemy.boss)continue;if(!game.combat.isRevealed(enemy)){concealed++;continue;}visible++;hp+=Math.max(0,Math.min(enemy.maxHp,enemy.hp));maxHp+=Math.max(0,enemy.maxHp);if(!names.includes(enemy.name||game.data.enemies[enemy.type]?.name))names.push(enemy.name||game.data.enemies[enemy.type]?.name);}
  for(const item of game.combat.spawnQueue)if(({...game.data.enemies[item.type],...item.modifiers?.variant}).boss)approaching++;
  return {wave:game.round,paused:!!game.paused,onField:living.length,queued,boss:game.wave?.boss||visible||concealed||approaching?{hp,maxHp,visible,concealed,approaching,names}:null};
}
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(value);
export function combatBossMarkup(model){
  const boss=model?.boss;if(!boss)return '';
  const waiting=[boss.concealed?`${boss.concealed} concealed`:'',boss.approaching?`${boss.approaching} approaching`:''].filter(Boolean).join(' · ');
  if(!boss.visible||!boss.maxHp)return `<strong>${boss.concealed?'Boss concealed':boss.approaching?'Boss approaching':'Boss defeated'}</strong>${waiting?`<small>${waiting}</small>`:''}`;
  return `<div class="persistent-boss-label"><strong>${escape(boss.names.filter(Boolean).join(' + ')||'Boss health')}</strong><span>${number(boss.hp)} / ${number(boss.maxHp)} HP</span></div><div class="persistent-boss-track" role="progressbar" aria-label="Revealed boss health" aria-valuemin="0" aria-valuemax="${boss.maxHp}" aria-valuenow="${boss.hp}"><span style="width:${Math.max(0,Math.min(100,boss.hp/boss.maxHp*100))}%"></span></div>${waiting?`<small>${waiting}</small>`:''}`;
}
export function updateCombatStatus(counts,banner,game){const model=combatStatusModel(game);if(counts)counts.textContent=model?`${model.onField} on field · ${model.queued} queued`:'';banner.hidden=!model?.boss;const html=combatBossMarkup(model);if(banner.innerHTML!==html)banner.innerHTML=html;}

export function pinnedGoalMarkup(plan,images={}){
  if(!plan)return '';
  return `<button class="pinned-goal-open" data-action="inspector-plan" aria-label="Open pinned ${escape(plan.name)}"><img src="${escape(images[plan.family]||'')}" alt=""><span><strong>${escape(plan.name)}</strong><small>✓ ${plan.counts.built} built · ◆ ${plan.counts.draft} this round · ○ ${plan.counts.missing} missing</small><small class="pinned-missing-basics">Missing basics: ${escape(plan.missingBasics?.summary||'None')}</small></span></button><button class="text-button" data-action="pin" data-id="${escape(plan.recipe.id)}" aria-label="Unpin ${escape(plan.name)}">Unpin</button>`;
}
