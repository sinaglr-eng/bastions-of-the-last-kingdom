import {MVP_RULES} from '../game/core/mvp.js';

const ids=['placement','cp','mvp'];
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const guidanceSeen=value=>Array.isArray(value)?[...new Set(value.filter(id=>ids.includes(id)))]:[];
const cpConfig=game=>game.commandPoints?.config||game.data?.balance?.commandPoints;

export function guidanceTopicMarkup(id,game){
  if(id==='placement')return '<section class="guidance-topic"><h2>Build, then choose</h2><p>Place all five recruits. Each successful placement reveals a random defender; invalid placement spends nothing. Then choose a legal Keep, Merge or Recruit champion action. Exact recipe ingredients determine champion availability; Kingdom XP does not unlock recipes.</p></section>';
  if(id==='cp'){
    const config=cpConfig(game),costs=config?.costs;
    const cost=action=>Number.isFinite(costs?.[action])?` · ${costs[action].toLocaleString('en-US')} CP`:'';
    return `<section class="guidance-topic"><h2>Command Points</h2><p>CP pays for tactical actions. Each action’s control shows its current cost and availability.</p><ul><li>Reroll${cost('reroll')}: replace eligible recruits once per draft. A returning reserved recruit is protected.</li><li>Reserve${cost('reserve')}: carry one recruit, inactive on its fixed tile, into the next draft. It still blocks the path.</li><li>Move${cost('move')}: exchange a retained defender and a castle wall between waves.</li></ul>${Number.isFinite(config?.bossReward)?`<p>Each defeated boss adds ${config.bossReward.toLocaleString('en-US')} CP.</p>`:''}<p>Inspecting, pinning and previewing do not spend CP.</p></section>`;
  }
  if(id==='mvp')return `<section class="guidance-topic"><h2>Wave MVP</h2><p>After a completed wave, the eligible active defender with the most actual HP damage gains one MVP level. Defenders already at level ${MVP_RULES.maxLevel} are excluded from this award.</p><p>Each level adds ${MVP_RULES.damagePerLevel*100}% own damage and nearby enemy armor reduction. Level ${MVP_RULES.maxLevel} also grants nearby allies +${MVP_RULES.maxAuraDamageBonus*100}% damage. Inspect a defender for its current MVP level and effects.</p><p>Measured damage is recorded during combat; catalog Base DPS is a separate value.</p></section>`;
  return '';
}

// Preference storage belongs to the caller. Only acknowledging/dismissing a
// tip marks it seen; rendering and normal refreshes never mutate the profile.
export class ContextGuidance{
  constructor({seen=[],onSeen=()=>{}}={}){this.seen=new Set(guidanceSeen(seen));this.pending=new Set();this.onSeen=onSeen;this.mvpName=null;this.ended=false;}
  offer(id){if(ids.includes(id)&&!this.seen.has(id))this.pending.add(id);}
  event(type,payload={},game){
    if(!game||this.ended)return;
    if(type==='won'||type==='lost'){this.ended=true;this.pending.clear();return;}
    if(game.phase!=='build'||game.round!==1)this.pending.delete('placement');
    if(game.phase==='build'&&game.round===1&&!game.draft.draws.some(draw=>draw.placed))this.offer('placement');
    if(['build','select','ready'].includes(game.phase)&&['reroll','reserve','move'].some(action=>game.commandActions?.[action]?.available))this.offer('cp');
    if(type==='mvp-awarded'&&payload.tower&&Number.isFinite(payload.level)&&payload.level>0){this.mvpName=game.data?.towers?.[payload.tower.family]?.name||'A defender';this.offer('mvp');}
  }
  dismiss(id){
    if(!ids.includes(id)||this.seen.has(id))return false;
    this.pending.delete(id);this.seen.add(id);this.onSeen(guidanceSeen([...this.seen]));return true;
  }
  model(game){
    if(this.ended||!['build','select','ready','reward'].includes(game.phase))return null;
    const placement=game.phase==='build'&&game.round===1&&!game.draft.draws.some(draw=>draw.placed);
    const id=['mvp','cp','placement'].find(id=>!this.seen.has(id)&&(id==='placement'?placement:this.pending.has(id)));if(!id)return null;
    const copy={placement:['Place five, then choose','Each placement reveals a recruit. After all five, choose a legal keeper, merge or champion.'],cp:['Command Points','CP pays for Reroll, Reserve and Move. Boss kills earn more; each control shows its cost.'],mvp:['Your first wave MVP',`${this.mvpName||'A defender'} earned an MVP level for actual damage. Inspect the defender for its new bonus.`]};
    return {id,title:copy[id][0],summary:copy[id][1],detail:guidanceTopicMarkup(id,game)};
  }
}

export function contextGuidanceMarkup(model){
  if(!model)return '';
  return `<aside class="context-guidance-card" aria-label="Optional ${escape(model.title)} guidance"><div class="context-guidance-copy"><strong>${escape(model.title)}</strong><p>${escape(model.summary)}</p><button type="button" class="context-guidance-more" data-action="guidance-help" data-guidance-id="${escape(model.id)}">Read more</button></div><button type="button" class="text-button context-guidance-dismiss" data-action="guidance-dismiss" data-guidance-id="${escape(model.id)}">Got it</button></aside>`;
}
