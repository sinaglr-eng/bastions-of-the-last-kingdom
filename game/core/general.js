export const SKILL_COSTS=Object.freeze([5,10,20]);
export const GENERAL_SKILLS=Object.freeze({
 'deep-refit':{name:'Deep Refit',kind:'draft',values:[600,500,400],description:'Keep a current basic recruit after lowering it by exactly two ranks. Gold cost: 600 / 500 / 400.'},
 'recruitment-focus':{name:'Recruitment Focus',kind:'focus',cost:1,values:[.04,.08,.12],description:'Pay 1 CP to favour one class by 4 / 8 / 12 percentage points in the next draft, including its reroll.'},
 'field-logistics':{name:'Field Logistics',kind:'passive',values:[6,8,10],description:'Begin a new run with 6 / 8 / 10 additional Command Points.'},
 quartermaster:{name:'Quartermaster',kind:'passive',values:[400,600,1000],description:'Begin a new run with 400 / 600 / 1,000 additional gold.'},
 'morale-boost':{name:'Morale Boost',kind:'combat',cost:3,duration:20,values:[.4,.6,1],description:'All active defenders attack 40 / 60 / 100% faster for 20 combat seconds. Costs 3 CP.'},
 'war-horn':{name:'War Horn',kind:'combat',cost:3,duration:20,values:[.4,.6,.8],description:'Slow every enemy by 40 / 60 / 80% for 20 combat seconds, including immune enemies and bosses. Costs 3 CP.'},
 'blood-wrath':{name:'Blood Wrath',kind:'combat',cost:3,duration:20,values:[.4,.6,1],description:'All active defenders deal 40 / 60 / 100% more own damage for 20 combat seconds. Costs 3 CP.'},
 'field-promotion':{name:'Field Promotion',kind:'promotion',cost:3,values:[1,2,2],caps:[5,5,6],description:'Raise eligible recruits in the completed five-defender draft by one rank. Costs 3 CP per draft; 1 / 2 / 2 uses per run. Only rank III can promote V to VI.'},
 'decisive-strike':{name:'Decisive Strike',kind:'strike',cost:0,values:[.3,.4,.5],bossValues:[.05,.07,.1],uses:[1,1,1],description:'Once per run, deal true damage equal to 30 / 40 / 50% of every current enemy’s maximum health; bosses take 5 / 7 / 10%. Costs no CP.'},
 'fortified-keep':{name:'Fortified Keep',kind:'passive',values:[5,10,15],description:'Begin with 5 / 10 / 15 additional keep health and the same increase to maximum health.'},
});
export function generalLoadout(skills={},equipped=[]){
 if(!Array.isArray(equipped)||equipped.length>3||new Set(equipped).size!==equipped.length)throw Error('Equip up to three different skills.');
 const result={};for(const id of equipped){if(!Object.hasOwn(GENERAL_SKILLS,id)||!Number.isInteger(skills[id])||skills[id]<1||skills[id]>3)throw Error('Skill is not unlocked.');result[id]=skills[id];}
 return Object.freeze(result);
}
export function validateLoadout(loadout={}){return generalLoadout(loadout,Object.keys(loadout));}
export class General{
 constructor(game,loadout={}){
  this.game=game;this.loadout=validateLoadout(loadout);this.active={};this.pendingFocus=null;this.draftFocus=null;
  this.uses={'field-promotion':0,'decisive-strike':0};this.promotedDraft=null;
  // Confirmation belongs to the mounted UI, never to authoritative saves/replay.
  Object.defineProperty(this,'strikePrepared',{value:false,writable:true,enumerable:false});
 }
 level(id){return this.loadout[id]||0;}
 value(id){return GENERAL_SKILLS[id]?.values[this.level(id)-1]||0;}
 remaining(id){return Math.max(0,(this.active[id]||0)-this.game.combat.elapsed);}
 multiplier(id){return this.remaining(id)>1e-9?1+this.value(id):1;}
 get slow(){return this.remaining('war-horn')>1e-9?this.value('war-horn'):0;}
 maxUses(id){return id==='field-promotion'?this.value(id):id==='decisive-strike'&&this.level(id)?1:0;}
 remainingUses(id){return Math.max(0,this.maxUses(id)-(this.uses[id]||0));}
 promotionState(){
  const g=this.game,rank=this.level('field-promotion'),cap=GENERAL_SKILLS['field-promotion'].caps[rank-1]||5,draws=g.draft.draws;
  const preview=draws.map(draw=>{
   const tower=g.towers.find(t=>t.id===draw.towerId),unit=tower&&g.data.towers[tower.family];
   let reason='';
   if(!draw.placed||!tower||tower.round!==g.round||!['draft','reserved'].includes(tower.state))reason='Not a current placed recruit.';
   else if(!unit||unit.advanced)reason='Only basic recruits can be promoted.';
   else if(tower.fieldPromoted)reason='Already promoted in this run.';
   else if(tower.tier>=cap)reason=cap===5?'Rank V is the limit for this skill rank.':'Already at rank VI.';
   const eligible=!reason,from=tower?.tier??draw.tier??null;
   return{towerId:tower?.id??draw.towerId??null,family:tower?.family??draw.family??null,name:unit?.name||'',from,to:eligible?from+1:from,eligible,reason,origin:draw.origin,reserved:!!draw.reservedForNextDraft||draw.origin==='reserve'};
  });
  let reason='';
  if(!rank)reason='Field Promotion is not equipped.';
  else if(g.developerMode)reason='Commander skills are unavailable in Developer Mode.';
  else if(g.phase!=='select'||g.draft.resolved)reason='Available after all five placements and before choosing a keeper.';
  else if(g.commandMove.active)reason='Finish or cancel Move first.';
  else if(g.draft.closedEarly||draws.length!==5||draws.some(d=>!d.placed)||new Set(draws.map(d=>d.towerId)).size!==5||preview.some(p=>p.from===null||p.reason==='Not a current placed recruit.'))reason='Place all five recruits first.';
  else if(this.promotedDraft?.round===g.round)reason='This draft has already been promoted.';
  else if(!this.remainingUses('field-promotion'))reason='No Field Promotion uses remain in this run.';
  else if(g.commandPoints.value<3)reason='Need 3 CP.';
  else if(!preview.some(p=>p.eligible))reason='No eligible recruits can gain a rank.';
  return{available:!reason,reason,preview,remainingUses:this.remainingUses('field-promotion'),maxUses:this.maxUses('field-promotion'),cost:3,cap};
 }
 applyDraftPromotion(draw,tower){
  const cap=this.game.draft.promotionRankCap,unit=tower&&this.game.data.towers[tower.family];
  if(!cap||!tower||!unit||tower.fieldPromoted||unit.advanced||tower.tier>=cap)return null;
  const from=tower.tier;draw.rolledTier??=draw.tier;
  tower.tier=from+1;tower.fieldPromoted=true;draw.tier=tower.tier;draw.promotionApplied=true;
  const copies=[draw.identity,this.game.draft.reserveSelection?.defender,this.game.draft.reservedDefender,this.game.draft.carriedReserve];
  for(const copy of copies)if(copy?.id===tower.id){copy.tier=tower.tier;copy.fieldPromoted=true;}
  return{tower,towerId:tower.id,x:tower.x,z:tower.z,from,to:tower.tier};
 }
 promoteDraft(){
  const state=this.promotionState();if(!state.available)return false;
  const g=this.game;g.commandPoints.value-=3;this.uses['field-promotion']++;
  this.promotedDraft={round:g.round,cap:state.cap};g.draft.promotionRankCap=state.cap;
  const upgrades=[];
  for(const draw of g.draft.draws){const change=this.applyDraftPromotion(draw,g.towers.find(t=>t.id===draw.towerId));if(change)upgrades.push(change);}
  g.previewRecipeId=null;g.selectionVoiceKey=null;
  g.emit('general-promoted',{id:'field-promotion',round:g.round,upgrades,cost:3,remainingUses:this.remainingUses('field-promotion')});
  return true;
 }
 strikeState(){
  const g=this.game,count=g.combat.enemies.filter(e=>!e.dead&&e.hp>0).length;
  let reason='';
  if(!this.level('decisive-strike'))reason='Decisive Strike is not equipped.';
  else if(g.developerMode)reason='Commander skills are unavailable in Developer Mode.';
  else if(g.phase!=='combat')reason='Available during combat only.';
  else if(!this.remainingUses('decisive-strike'))reason='Decisive Strike has already been used in this run.';
  else if(!count)reason='No enemies are currently on the battlefield.';
  return{available:!reason,reason,count,remainingUses:this.remainingUses('decisive-strike'),maxUses:this.maxUses('decisive-strike'),cost:0,prepared:this.strikePrepared};
 }
 prepareStrike(){if(!this.strikeState().available)return false;this.strikePrepared=true;this.game.emit('change');return true;}
 cancelStrike(){if(!this.strikePrepared)return false;this.strikePrepared=false;this.game.emit('change');return true;}
 strike(){
  if(!this.strikeState().available){const prepared=this.strikePrepared;this.strikePrepared=false;if(prepared)this.game.emit('change');return false;}
  const g=this.game,level=this.level('decisive-strike'),skill=GENERAL_SKILLS['decisive-strike'];
  const snapshot=g.combat.enemies.filter(e=>!e.dead&&e.hp>0).map(enemy=>({enemy,id:enemy.id,x:enemy.x,z:enemy.z,flying:!!enemy.flying,airborne:!!enemy.flying,boss:!!enemy.boss,visible:g.combat.isRevealed(enemy),amount:enemy.maxHp*(enemy.boss?skill.bossValues[level-1]:skill.values[level-1])}));
  this.uses['decisive-strike']++;this.strikePrepared=false;
  const targets=snapshot.map(row=>{const hit=g.combat.resolveCommanderDamage(row.enemy,row.amount,'decisive-strike');const{enemy,...target}=row;return{...target,effectiveDamage:hit.effectiveDamage};});
  g.emit('general-strike',{id:'decisive-strike',commanderSkill:'decisive-strike',source:{kind:'commander',skill:'decisive-strike'},targets,cost:0});
  return true;
 }
 normalizeAfterRestore(){
  const prior=this.uses||{};this.uses={};
  for(const id of ['field-promotion','decisive-strike']){const value=prior[id]??0;if(!Number.isInteger(value)||value<0||value>this.maxUses(id))throw Error('Invalid saved Commander usage.');this.uses[id]=value;}
  this.strikePrepared=false;
  if(this.promotedDraft){
   const expected=GENERAL_SKILLS['field-promotion'].caps[this.level('field-promotion')-1];
   if(!Number.isInteger(this.promotedDraft.round)||this.promotedDraft.round<1||this.promotedDraft.cap!==expected||!this.uses['field-promotion'])throw Error('Invalid saved Field Promotion draft.');
   if(this.promotedDraft.round===this.game.round&&this.game.phase==='select')this.game.draft.promotionRankCap=this.promotedDraft.cap;
  }
 }
 activate(id,slot=null){
  const skill=GENERAL_SKILLS[id],g=this.game;
  if(!Object.hasOwn(GENERAL_SKILLS,id)||!this.level(id)||g.developerMode||['won','lost'].includes(g.phase))return false;
  if(skill.kind==='promotion'){if(!this.promoteDraft())return false;}
  else if(skill.kind==='strike'){if(!this.strike())return false;}
  else if(skill.kind==='focus'){
   if(this.pendingFocus||!['A','B','C','D','E','F','G','H'].includes(slot)||g.commandPoints.value<1)return false;
   g.commandPoints.value--;this.pendingFocus={slot,bonus:this.value(id),round:g.round+1};
  }else if(skill.kind==='combat'){
   if(g.phase!=='combat'||this.remaining(id)>1e-9||g.commandPoints.value<3)return false;
   g.commandPoints.value-=3;this.active[id]=g.combat.elapsed+20;
  }else return false;
  g.emit('general-activated',{id,slot,cost:skill.cost});g.emit('change');return true;
 }
 beginDraft(){this.draftFocus=this.pendingFocus;this.pendingFocus=null;this.active={};this.promotedDraft=null;this.strikePrepared=false;}
 finishDraft(){this.draftFocus=null;this.promotedDraft=null;}
}
