import {withTowerStatSnapshot} from './math.js';
import {GridManager} from './grid.js';
import {seededRandom} from './math.js';
import {DraftManager} from './draft.js';
import {EconomyManager} from './progression.js';
import {CombatManager} from './combat.js';
import {CommandPoints} from './command-points.js';
import {CommandMove} from './command-move.js';
import {matchingIngredients,mergePartner,allRecipes,recipeFamily} from './recipes.js';
import {MvpManager,inheritedMvpLevel,mvpLevel} from './mvp.js';
import {General} from './general.js';
import {RunProgress} from './achievements.js';
import {endlessWave} from './endless.js';
import {installJournal,recordAdvance,FIXED_STEP} from './run-journal.js';

export class Game {
  constructor(data,{seed=Date.now(),waveLimit=data.waves.length,discoveries=[],mode=data.fr010?'endless':'campaign',loadout={},runId=null,accountId=null}={}) {
    this.data=data;Object.defineProperty(this,'factionId',{value:data.factionId??null,enumerable:true});this.seed=seed;this.rng=seededRandom(seed);this.waveLimit=waveLimit;
    this.grid=new GridManager();this.economy=new EconomyManager(data.balance);this.commandPoints=new CommandPoints(data.balance);this.draft=new DraftManager(data,this.rng,this.commandPoints);this.combat=new CombatManager(this);this.commandMove=new CommandMove(this);
    this.towers=[];this.nextId=1;this.round=1;this.lives=data.balance.startingLives;this.kills=0;this.leaks=0;this.phase='build';this.selected=null;this.activeDraw=0;this.speed=1;this.paused=false;this.listeners=new Set();this.discoveries=new Set(discoveries);this.pinned=null;this.lastReward=0;
    this.earnedDiscoveries=new Set();
    this.selectedEnemy=null;this.selectionVoiceKey=null;this.score=0;this.elapsedSeconds=0;this.economy.setConstructionRound(this.round);this.draft.roll(this.economy.mastery);
    this.mvp=new MvpManager(this);
    this.mode=mode;this.runId=runId;this.accountId=accountId;this.actualPlacements=0;this.completedWaves=0;this.scoreExact='0';this.tickRemainder=0;this.recordCommands=true;
    this.general=new General(this,loadout);Object.defineProperty(this.towers,'general',{value:this.general,configurable:true});
    this.commandPoints.value+=this.general.value('field-logistics');this.economy.gold+=this.general.value('quartermaster');
    this.progress=new RunProgress(this);this.waveCache=new Map();
    if(data.fr010)installJournal(this);
  }
  on(callback){this.listeners.add(callback);return()=>this.listeners.delete(callback);}
  emit(type,payload={}){
    // A death/escape event must never expose a stale inspected enemy to a UI
    // listener. Keep the original combat event ordering, then refresh its panel.
    const cleared=this.selectedEnemy!==null&&!this.enemySelection;
    if(cleared)this.selectedEnemy=null;
    for(const fn of this.listeners)fn(type,payload);
    if(cleared&&type!=='change')this.emit('change');
  }
  message(text){this.emit('message',{text});return false;}
  select(id){
    if(this.commandMove.active){if(id===null)this.cancelMove();else this.selectMove(id);return;}
    const previous=this.selected;this.selectedEnemy=null;this.selected=id;this.previewRecipeId=null;
    const tower=this.selection,draft=tower?.state==='draft'&&tower.round===this.round&&this.draft.draws.some(draw=>draw.placed&&draw.towerId===tower.id&&!draw.reservedForNextDraft);
    const voiceTower=tower&&this.data.towers[tower.family]&&(tower.state==='active'||draft)?tower:null;
    const key=voiceTower?JSON.stringify([this.round,voiceTower.id,voiceTower.family,voiceTower.tier]):null;
    if(key!==this.selectionVoiceKey||(!voiceTower&&previous!==id)){this.selectionVoiceKey=key;this.emit('defender-select',{tower:voiceTower,round:this.round});}
    this.emit('selection',{kind:'tower',id:this.selection?.id??null});this.emit('change');
  }
  setTowerAttackPaused(id,paused){
    const tower=this.towers.find(t=>t.id===id&&t.state==='active');
    if(!tower||typeof paused!=='boolean')return false;
    tower.attackPaused=paused;this.emit('change');return true;
  }
  get selection(){return this.towers.find(t=>t.id===this.selected)||null;}
  selectEnemy(id){
    if(this.commandMove.active)return false;
    const enemy=['combat','won','lost'].includes(this.phase)&&Number.isSafeInteger(id)&&this.combat.enemies.find(e=>e.id===id&&!e.dead&&e.hp>0&&this.combat.isRevealed(e));
    if(!enemy)return false;
    const wasDefenderSelected=this.selected!==null||this.selectionVoiceKey!==null;
    this.selected=null;this.previewRecipeId=null;this.selectedEnemy=id;
    if(wasDefenderSelected){this.selectionVoiceKey=null;this.emit('defender-select',{tower:null,round:this.round});}
    this.emit('selection',{kind:'enemy',id});this.emit('change');return true;
  }
  get enemySelection(){
    return ['combat','won','lost'].includes(this.phase)?this.combat.enemies.find(e=>e.id===this.selectedEnemy&&!e.dead&&e.hp>0&&this.combat.isRevealed(e))||null:null;
  }
  pruneEnemySelection(){
    if(this.selectedEnemy!==null&&!this.enemySelection){this.selectedEnemy=null;this.emit('change');}
  }
  get roundCandidates(){
    if(!['build','select'].includes(this.phase))return [];
    return this.draft.draws.flatMap((draw,index)=>{
      const tower=this.towers.find(t=>t.id===draw.towerId&&t.state==='draft'&&t.round===this.round);
      return tower?[{tower,number:index+1}]:[];
    });
  }
  waveAt(number){
    if(number<=50)return this.data.waves[number-1];
    if(this.mode!=='endless')return undefined;
    if(!this.waveCache.has(number)){if(this.waveCache.size>4)this.waveCache.clear();this.waveCache.set(number,endlessWave(this.data,this.seed,number));}return this.waveCache.get(number);
  }
  get wave(){return this.waveAt(this.round);}
  get recipes(){return allRecipes(this.data);}
  get moveSelection(){return this.commandMove.active?{towerId:this.commandMove.defenderId}:null;}
  get reserveIndex(){return this.draft.draws.findIndex(draw=>draw.towerId===this.selected&&!draw.reservedForNextDraft);}
  get commandActions(){
    const cp=this.commandPoints,selecting=this.phase==='select'&&!this.commandMove.active;
    const rerollReason=this.phase!=='select'?'Place all five defenders first.':this.commandMove.active?'Cancel Move first.':this.draft.reserveSelection?'Reserve is already committed. Reroll before reserving.':this.draft.rerollsUsed>=cp.config.maxRerollsPerDraft?'Reroll already used this draft.':!cp.canSpend('reroll')?'Not enough Command Points.':'';
    const reserveReason=!selecting?(this.commandMove.active?'Cancel Move first.':'Reserve is available after all five placements.'):this.draft.reserveSelection?'One defender is already reserved for the next draft.':this.reserveIndex<0?'Select a defender from this draft.':!cp.canSpend('reserve')?'Not enough Command Points.':'';
    const moveReason=this.commandMove.active?'Move selection is already open.':!['build','select','ready','reward'].includes(this.phase)?'Move is available between waves.':!cp.canSpend('move')?'Not enough Command Points.':!this.commandMove.canBegin?'Keep a defender and a castle wall to move.':'';
    return {reroll:{cost:cp.cost('reroll'),available:selecting&&this.draft.canReroll(),reason:rerollReason},reserve:{cost:cp.cost('reserve'),available:selecting&&this.reserveIndex>=0&&this.draft.canReserve(this.reserveIndex),reason:reserveReason},move:{cost:cp.cost('move'),available:!moveReason,reason:moveReason},cancelMove:{available:this.commandMove.active,reason:''}};
  }
  beginMove(){
    if(!this.commandActions.move.available)return this.message(this.commandActions.move.reason);
    if(!this.commandMove.begin())return false;
    this.selected=null;this.selectedEnemy=null;this.previewRecipeId=null;this.selectionVoiceKey=null;this.emit('defender-select',{tower:null,round:this.round});this.emit('change');return true;
  }
  cancelMove(){if(!this.commandMove.cancel())return false;this.emit('change');return true;}
  selectMove(id){
    if(!this.commandMove.active)return false;
    if(this.commandMove.canTarget(id)){
      const tower=this.commandMove.defender;
      if(!this.commandMove.execute(id,()=>this.commandPoints.spend('move')))return false;
      this.selected=tower.id;this.selectionVoiceKey=null;this.emit('move',{tower,cost:this.commandPoints.cost('move')});this.emit('change');this.message(`Defender moved · −${this.commandPoints.cost('move')} CP`);return true;
    }
    if(!this.commandMove.select(id))return false;
    this.selected=id;this.selectionVoiceKey=null;this.emit('change');return true;
  }
  rewardBossCommandPoints(enemy){
    if(this.phase!=='combat')return 0;
    const gained=this.commandPoints.rewardBoss(enemy);if(!gained)return 0;
    this.emit('command-points',{amount:gained,reason:'boss',enemyId:enemy.id});this.emit('change');this.message(`BOSS DEFEATED · +${gained} COMMAND POINTS`);return gained;
  }
  awardScore(points){if(!this.data.fr010){this.score+=Math.max(0,Math.floor(points));return;}const n=BigInt(this.scoreExact)+BigInt(typeof points==='string'?points:Math.max(0,Math.floor(points)));this.scoreExact=n.toString();this.score=Number(n>BigInt(Number.MAX_SAFE_INTEGER)?BigInt(Number.MAX_SAFE_INTEGER):n);}
  awardWaveScore(base){this.awardScore(this.data.fr010?(BigInt(this.round)*BigInt(base)).toString():this.round*base);}
  activateGeneral(id,slot=null){const ok=this.general.activate(id,slot);return ok;}
  setPriority(id,priority){const t=this.towers.find(t=>t.id===id&&t.state==='active');if(!t||!['first','last','strongest','weakest','fastest','slowest'].includes(priority))return false;t.priority=priority;this.emit('change');return true;}
  setPinned(id){if(id!==null&&!this.recipes.some(r=>r.id===id))return false;this.pinned=id;this.emit('change');return true;}
  get hasLegalRecruitSpace(){
    if(this.spaceCheck?.revision===this.grid.revision)return this.spaceCheck.value;
    let value=false;for(let z=0;z<this.grid.size&&!value;z++)for(let x=0;x<this.grid.size&&!value;x++)if(this.grid.type(x,z)==='buildable'&&this.grid.canPlace(x,z).ok)value=true;
    this.spaceCheck={revision:this.grid.revision,value};return value;
  }
  finishRecruitment(){
    if(!this.data.fr010||this.phase!=='build'||this.hasLegalRecruitSpace)return false;
    this.draft.closedEarly=true;this.activeDraw=-1;
    if(this.roundCandidates.some(c=>c.tower.state==='draft'))this.phase='select';else{this.draft.resolved=true;this.general.finishDraft();this.phase='ready';}
    this.emit('change');return true;
  }
  get constructionBudget(){
    if(this.mode==='endless'&&this.round>50)return {limit:this.grid.size*this.grid.size,spent:this.actualPlacements,remaining:Math.max(0,this.grid.size*this.grid.size-this.grid.occupied.size),occupied:this.grid.occupied.size,endless:true};
    const perRound=this.data.balance.drawsPerRound,limit=this.waveLimit*perRound;
    const spent=(this.round-1)*perRound+this.draft.draws.filter(d=>d.placed).length;
    return {limit,spent,remaining:Math.max(0,limit-spent),occupied:this.grid.occupied.size};
  }
  place(x,z) {
    if(this.commandMove.active)return false;
    if(this.phase!=='build')return this.message('Construction is closed. Select a defense to inspect it.');
    const draw=this.draft.draws[this.activeDraw];
    if(!draw || draw.placed)return false;
    const identity=draw.identity||{},id=Number.isSafeInteger(identity.id)&&!this.towers.some(t=>t.id===identity.id)?identity.id:this.nextId;
    const result=this.grid.occupy(x,z,id);
    if(!result.ok)return this.message(result.reason);
    // The successful placement commits the location BEFORE consuming any random draw.
    this.draft.reveal(this.activeDraw);
    const tower={...identity,id,family:draw.family,tier:draw.tier,x,z,state:'draft',round:this.round,kills:identity.kills||0,priority:identity.priority||'first',cooldown:0,mvpLevel:mvpLevel(identity),attackPaused:!!identity.attackPaused};this.nextId=Math.max(this.nextId,id+1);
    this.towers.push(tower);this.actualPlacements++;draw.placed=true;draw.towerId=tower.id;this.selected=tower.id;this.selectionVoiceKey=null;
    this.activeDraw=this.draft.draws.findIndex(d=>!d.placed);
    if(this.activeDraw<0){this.phase='select';this.message('Choose one defense to keep, merge, or combine. The others become barricades.');}
    this.emit('place',{tower});this.emit('change');return true;
  }
  finishSelection(keep,fallbackIndex=null) {
    this.commandMove.cancel();const index=this.draft.draws.findIndex(draw=>draw.towerId===keep.id);this.draft.finalize(index>=0?index:fallbackIndex,keep);
    for(const t of this.towers)if(t.state==='draft')t.state=t.id===keep.id?'active':'ruin';
    keep.state='active';this.phase='ready';this.selected=keep.id;this.selectionVoiceKey=null;this.emit('change');
    this.general.finishDraft();
  }
  keep() {
    if(this.commandMove.active)return this.message('Finish or cancel Move first.');
    const t=this.selection;
    if(this.phase!=='select'||t?.state!=='draft'||!this.validFactionUnit(t))return this.message('Select one of this round’s five defenses.');
    this.finishSelection(t);this.emit('keep',{tower:t});this.emit('defender-committed',{tower:t,round:this.round,action:'keep'});return true;
  }
  downgrade(levels=1) {
    if(this.commandMove.active)return this.message('Finish or cancel Move first.');
    const t=this.selection;
    if(this.phase!=='select'||!this.roundCandidates.some(c=>c.tower===t))return this.message('Select one of this round’s five candidates.');
    if(![1,2].includes(levels)||levels===2&&!this.general.level('deep-refit'))return false;
    if(this.data.towers[t.family].advanced||t.tier<=levels)return this.message('Choose a basic candidate with enough ranks to downgrade.');
    const cost=levels===2?this.general.value('deep-refit'):this.data.balance.downgradeCost;
    if(!this.economy.spend(cost))return this.message(`Downgrading and keeping this defender costs ${cost} gold.`);
    t.tier-=levels;this.finishSelection(t);this.emit('keep',{tower:t});this.emit('defender-committed',{tower:t,round:this.round,action:'downgrade'});
    this.message(`Defender downgraded by ${levels} rank${levels===1?'':'s'} and kept · ${cost} gold`);return true;
  }
  validFactionUnit(t){const s=t&&Object.hasOwn(this.data.towers,t.family)&&this.data.towers[t.family];return !this.factionId||!!s&&Number.isInteger(t.tier)&&t.tier>=1&&t.tier<=(s.advanced?1:6);}
  canCombine(t) {return !this.commandMove.active&&t&&this.validFactionUnit(t)&&['active','draft'].includes(t.state)&&['build','select','ready','reward'].includes(this.phase)&&(t.state!=='draft'||this.phase==='select');}
  recipePieces(recipe,anchor=this.selection){
    if(!recipe.currentRoundOnly)return matchingIngredients(recipe,this.towers.filter(t=>this.canCombine(t)),anchor);
    // The five actual, placed draw IDs are the authority. A stray or stale draft
    // tower must never satisfy a secret recipe or serve as its result anchor.
    const candidates=this.roundCandidates.map(c=>c.tower);
    const reserved=this.draft.draws.find(draw=>draw.reservedForNextDraft),expected=this.draft.draws.filter(d=>d.placed).length-(reserved?1:0);
    if(this.phase!=='select'||this.draft.draws.length!==5||!this.draft.closedEarly&&this.draft.draws.some(d=>!d.placed)||candidates.length!==expected)return null;
    return matchingIngredients(recipe,candidates,anchor,{phase:this.phase,round:this.round,...(reserved?{reservedId:reserved.towerId,drawIds:this.draft.draws.map(draw=>draw.towerId)}:{})});
  }
  mergePartner(t=this.selection){
    if(!this.canCombine(t)||!this.towers.includes(t))return null;
    const candidates=this.roundCandidates.map(c=>c.tower);
    if(t.tier!==5)return this.phase==='select'?mergePartner(t,candidates,this.data):null;
    const draws=this.draft.draws;
    // Only fresh V rolls from this completed unresolved draft can create VI.
    // Returning reserves retain their origin and never become fresh rolls.
    const placed=draws.filter(d=>d.placed),completeDraft=this.phase==='select'&&!this.draft.resolved&&draws.length===this.data.balance.drawsPerRound&&(this.draft.closedEarly||draws.every(draw=>draw.placed))&&new Set(placed.map(draw=>draw.towerId)).size===placed.length&&candidates.length===placed.filter(draw=>!draw.reservedForNextDraft).length;
    if(!completeDraft)return null;
    const fresh=candidates.filter(tower=>draws.some(draw=>draw.placed&&draw.origin==='random'&&!draw.reservedForNextDraft&&draw.towerId===tower.id&&draw.family===tower.family&&draw.tier===tower.tier));
    return fresh.includes(t)?mergePartner(t,fresh,this.data):null;
  }
  merge() {
    const t=this.selection;
    const partner=this.mergePartner(t);
    if(!partner)return this.message('Merge two matching fresh candidates after all five placements. Rank VI requires two new Rank V rolls from this draft.');
    const draftUsed=t.state==='draft'||partner.state==='draft';
    const draftIndex=this.draft.draws.findIndex(draw=>[t,partner].some(tower=>tower.state==='draft'&&tower.id===draw.towerId));
    t.mvpLevel=inheritedMvpLevel([t,partner]);partner.state='ruin';t.tier++;t.kills=(t.kills||0)+(partner.kills||0);t.state='active';
    if(draftUsed)this.finishSelection(t,draftIndex);
    this.emit('combine',{tower:t});this.emit('defender-committed',{tower:t,round:this.round,action:'merge'});this.emit('change');return true;
  }
  availableRecipes(t=this.selection) {
    if(!this.canCombine(t))return [];
    return this.recipes.filter(r=>r.level<=this.economy.level&&this.recipePieces(r,t));
  }
  previewRecipe(id){if(!this.availableRecipes().some(r=>r.id===id))return false;this.previewRecipeId=id;this.emit('change');return true;}
  get recipePreview(){
    const pool=this.towers.filter(t=>this.canCombine(t));
    let anchor=this.selection,options=this.availableRecipes(anchor);
    if(!options.length){
      const recipe=this.recipes.find(r=>!r.currentRoundOnly&&r.level<=this.economy.level&&matchingIngredients(r,pool));
      if(!recipe)return null;
      const pieces=matchingIngredients(recipe,pool);anchor=pieces.find(t=>t.state==='draft')||pieces[0];options=[recipe];
    }
    const recipe=options.find(r=>r.id===this.previewRecipeId)||options[0];
    const pieces=this.recipePieces(recipe,anchor);
    if(!pieces)return null;
    const discarded=pieces.some(t=>t.state==='draft')?this.roundCandidates.map(c=>c.tower).filter(t=>!pieces.includes(t)):[];
    return {recipe,anchor,pieces,discarded};
  }
  get combinationHints(){
    const hints=new Map();
    const selectedSecrets=new Set(this.availableRecipes().filter(r=>r.currentRoundOnly).map(r=>r.id));
    for(const tower of this.towers){const recipe=this.availableRecipes(tower).find(r=>!r.currentRoundOnly||selectedSecrets.has(r.id));if(recipe)hints.set(tower.id,{tower,recipe,role:'available'});}
    const preview=this.recipePreview;
    if(preview){
      for(const tower of preview.pieces)hints.set(tower.id,{tower,recipe:preview.recipe,role:tower.id===preview.anchor.id?'result':'consumed'});
      for(const tower of preview.discarded)hints.set(tower.id,{tower,recipe:preview.recipe,role:'discarded'});
    }
    return [...hints.values()];
  }
  craft(id) {
    const t=this.selection,recipe=this.availableRecipes(t).find(r=>r.id===id);
    if(!recipe)return this.message('Select a matching ingredient and gather every recipe piece.');
    const pieces=this.recipePieces(recipe,t);
    if(!pieces)return this.message('All three secret ingredients must belong to this round’s five defenders.');
    const draftUsed=pieces.some(p=>p.state==='draft');
    const draftIndex=this.draft.draws.findIndex(draw=>pieces.some(piece=>piece.id===draw.towerId));
    const kills=pieces.reduce((sum,p)=>sum+(p.kills||0),0),family=recipeFamily(recipe),previousFamily=t.family,mvp=inheritedMvpLevel(pieces);
    pieces.forEach(p=>p.state='ruin');t.family=family;t.tier=1;t.state='active';t.upgrades=0;t.kills=kills;t.mvpLevel=mvp;
    this.discoveries.add(family);
    if(this.data.towers[family]?.advanced===true)this.earnedDiscoveries.add(family);
    if(this.pinned===recipe.id)this.pinned=null;
    if(draftUsed)this.finishSelection(t,draftIndex);
    this.emit('combine',{tower:t,previousFamily,crafted:this.data.towers[family]?.advanced===true&&family!==previousFamily});this.emit('defender-committed',{tower:t,round:this.round,action:'craft'});this.emit('discover',{id:family});this.emit('change');return true;
  }
  remove() {
    if(this.commandMove.active)return this.message('Finish or cancel Move before demolishing a wall.');
    const t=this.selection;
    if(!t)return this.message('Select a castle wall to demolish.');
    if(!['build','select','ready','reward'].includes(this.phase))return this.message('Demolition is available between waves.');
    if(t.state==='draft')return this.message('Choose your keeper first. This round’s five candidates cannot be demolished yet.');
    if(t.state==='reserved')return this.message('Reserved defenders keep their position for the next draft and cannot be demolished.');
    if(t.state!=='ruin')return this.message('Retained defenders are permanent. Transform them through an advanced recipe; only castle walls can be demolished.');
    this.grid.remove(t.x,t.z);this.towers=this.towers.filter(o=>o.id!==t.id);this.selected=null;
    this.emit('change');this.message('Castle wall demolished · tile cleared');return true;
  }
  reroll() {
    if(!this.commandActions.reroll.available)return this.message(this.commandActions.reroll.reason);
    if(!this.draft.reroll())return false;
    for(const draw of this.draft.draws){const tower=this.towers.find(t=>t.id===draw.towerId);if(tower&&tower.state==='draft'){tower.family=draw.family;tower.tier=draw.tier;}}
    this.previewRecipeId=null;this.selectionVoiceKey=null;this.emit('reroll',{cost:this.commandPoints.cost('reroll')});this.emit('change');this.message(`Draft rerolled · −${this.commandPoints.cost('reroll')} CP`);return true;
  }
  reserve(){
    if(!this.commandActions.reserve.available)return this.message(this.commandActions.reserve.reason);
    const tower=this.selection,index=this.reserveIndex;
    if(!tower||!this.validFactionUnit(tower)||tower.state!=='draft'||tower.round!==this.round||!this.draft.reserve(index,tower))return false;
    // Reservation changes combat eligibility, never the committed foundation or route.
    tower.state='reserved';this.selected=null;this.previewRecipeId=null;this.selectionVoiceKey=null;
    this.emit('reserve',{tower,cost:this.commandPoints.cost('reserve')});this.emit('change');this.message(`Defender reserved for the next draft · −${this.commandPoints.cost('reserve')} CP`);return true;
  }
  mastery() {return this.message('Construction mastery advances automatically with waves, reaching its maximum for wave 25.');}
  repair() {
    return this.message('Lost keep health is permanent.');
  }
  upgradeSpecial() {
    return this.message('Gold is reserved for downgrading a current candidate. Champions improve through recipes.');
  }
  startCombat() {if(this.phase!=='ready')return false;this.commandMove.cancel();this.economy.setConstructionRound(this.round);this.selectedEnemy=null;this.selectionVoiceKey=null;this.phase='combat';this.paused=false;this.combat.start(this.wave);this.emit('wave');this.emit('change');return true;}
  completeWave() {
    if(this.phase!=='combat')return;
    this.selectedEnemy=null;this.mvp.awardWave();this.emit('wave-complete',{round:this.round});
    this.completedWaves++;this.awardWaveScore(100+(this.wave.boss?200:0));this.general.active={};
    this.lastReward=this.wave.boss?200:50;this.economy.reward(this.lastReward,15);this.combat.projectiles=[];
    if(this.round===50&&this.mode==='endless')this.emit('campaign-cleared',{round:50});
    if(this.mode!=='endless'&&this.round>=this.waveLimit){this.end(true);return;}
    const round=this.round;this.phase='reward';this.emit('reward',{round,gold:this.lastReward});this.nextRound();
    this.message(`Wave ${round} survived · +${this.lastReward} gold · place ${this.draft.draws.filter(draw=>!draw.placed).length} new defenders`);
  }
  nextRound() {
    if(this.phase!=='reward')return false;
    this.commandMove.cancel();this.round++;this.phase='build';this.economy.setConstructionRound(this.round);this.general.beginDraft();this.draft.focus=this.general.draftFocus;this.draft.roll(this.economy.mastery);
    const carried=this.draft.draws.find(draw=>draw.origin==='reserve');
    if(carried){
      // The dormant blocker itself becomes the already placed candidate. There
      // is no new tile occupation, identity, random reveal, or placement event.
      const tower=this.towers.find(t=>t.id===carried.towerId);
      tower.state='draft';tower.round=this.round;tower.cooldown=0;
    }
    this.activeDraw=this.draft.draws.findIndex(draw=>!draw.placed);this.selected=null;this.emit('change');return true;
  }
  end(won){if(['won','lost'].includes(this.phase))return;this.commandMove.cancel();this.draft.discardReserve();this.selectedEnemy=null;this.phase=won?'won':'lost';this.emit(this.phase);this.emit('change');}
  tick(dt,elapsedDt=dt){
    // Total run time uses real seconds, independently of combat speed and its
    // frame-step cap. Construction and pauses count; ended runs stay frozen.
    if(!['won','lost'].includes(this.phase)&&Number.isFinite(elapsedDt)&&elapsedDt>0)this.elapsedSeconds+=elapsedDt;
    if(this.phase==='combat'&&!this.paused){if(this.data.fr010){this.tickRemainder+=dt*this.speed;let ticks=0;while(this.tickRemainder+1e-12>=FIXED_STEP&&this.phase==='combat'){this.tickRemainder-=FIXED_STEP;this.advanceTicks(1,{record:false});ticks++;}if(this.phase!=='combat')this.tickRemainder=0;recordAdvance(this,ticks);}else withTowerStatSnapshot(this.data,()=>this.combat.update(dt*this.speed));}this.pruneEnemySelection();
  }
  advanceTicks(count,{record=false}={}){let completed=0;for(;completed<count&&this.phase==='combat';completed++)withTowerStatSnapshot(this.data,()=>this.combat.update(FIXED_STEP));if(record)recordAdvance(this,completed);return completed;}
}
