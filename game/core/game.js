import {GridManager} from './grid.js';
import {seededRandom} from './math.js';
import {DraftManager} from './draft.js';
import {EconomyManager} from './progression.js';
import {CombatManager} from './combat.js';
import {matchingIngredients,mergePartner,allRecipes,recipeFamily} from './recipes.js';

export class Game {
  constructor(data,{seed=Date.now(),waveLimit=data.waves.length,discoveries=[]}={}) {
    this.data=data;this.seed=seed;this.rng=seededRandom(seed);this.waveLimit=waveLimit;
    this.grid=new GridManager();this.economy=new EconomyManager(data.balance);this.draft=new DraftManager(data,this.rng);this.combat=new CombatManager(this);
    this.towers=[];this.nextId=1;this.round=1;this.lives=data.balance.startingLives;this.kills=0;this.leaks=0;this.phase='build';this.selected=null;this.activeDraw=0;this.speed=1;this.paused=false;this.listeners=new Set();this.discoveries=new Set(discoveries);this.pinned=null;this.lastReward=0;
    this.selectedEnemy=null;this.score=0;this.draft.roll(0);
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
  select(id){this.selectedEnemy=null;this.selected=id;this.previewRecipeId=null;this.emit('change');}
  get selection(){return this.towers.find(t=>t.id===this.selected)||null;}
  selectEnemy(id){
    const enemy=this.phase==='combat'&&Number.isSafeInteger(id)&&this.combat.enemies.find(e=>e.id===id&&!e.dead&&e.hp>0&&this.combat.isRevealed(e));
    if(!enemy)return false;
    this.selected=null;this.previewRecipeId=null;this.selectedEnemy=id;this.emit('change');return true;
  }
  get enemySelection(){
    return this.phase==='combat'?this.combat.enemies.find(e=>e.id===this.selectedEnemy&&!e.dead&&e.hp>0&&this.combat.isRevealed(e))||null:null;
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
  get wave(){return this.data.waves[this.round-1];}
  get recipes(){return allRecipes(this.data);}
  awardScore(points){this.score+=Math.max(0,Math.floor(points));}
  get constructionBudget(){
    const perRound=this.data.balance.drawsPerRound,limit=this.waveLimit*perRound;
    const spent=(this.round-1)*perRound+this.draft.draws.filter(d=>d.placed).length;
    return {limit,spent,remaining:Math.max(0,limit-spent),occupied:this.grid.occupied.size};
  }
  place(x,z) {
    if(this.phase!=='build')return this.message('Construction is closed. Select a defense to inspect it.');
    const draw=this.draft.draws[this.activeDraw];
    if(!draw || draw.placed)return false;
    const result=this.grid.occupy(x,z,this.nextId);
    if(!result.ok)return this.message(result.reason);
    // The successful placement commits the location BEFORE consuming any random draw.
    this.draft.reveal(this.activeDraw);
    const tower={id:this.nextId++,family:draw.family,tier:draw.tier,x,z,state:'draft',round:this.round,kills:0,priority:'first',cooldown:0};
    this.towers.push(tower);draw.placed=true;draw.towerId=tower.id;this.selected=tower.id;
    this.activeDraw=this.draft.draws.findIndex(d=>!d.placed);
    if(this.activeDraw<0){this.phase='select';this.message('Choose one defense to keep, merge, or combine. The others become barricades.');}
    this.emit('place',{tower});this.emit('change');return true;
  }
  finishSelection(keep) {
    for(const t of this.towers)if(t.state==='draft')t.state=t.id===keep.id?'active':'ruin';
    keep.state='active';this.phase='ready';this.selected=keep.id;this.emit('change');
  }
  keep() {
    const t=this.selection;
    if(this.phase!=='select'||t?.state!=='draft')return this.message('Select one of this round’s five defenses.');
    this.finishSelection(t);this.emit('keep',{tower:t});return true;
  }
  downgrade() {
    const t=this.selection;
    if(this.phase!=='select'||!this.roundCandidates.some(c=>c.tower===t))return this.message('Select one of this round’s five candidates.');
    if(this.data.towers[t.family].advanced||t.tier<=1)return this.message('Only a basic candidate above Tier I can be downgraded.');
    if(!this.economy.spend(this.data.balance.downgradeCost))return this.message('Downgrading and keeping a defender costs 200 gold.');
    t.tier--;this.finishSelection(t);this.emit('keep',{tower:t});
    this.message('Defender downgraded by one rank and kept · 200 gold');return true;
  }
  canCombine(t) {return t&&t.state!=='ruin'&&['build','select','ready','reward'].includes(this.phase)&&(t.state!=='draft'||this.phase==='select');}
  recipePieces(recipe,anchor=this.selection){
    if(!recipe.currentRoundOnly)return matchingIngredients(recipe,this.towers.filter(t=>this.canCombine(t)),anchor);
    // The five actual, placed draw IDs are the authority. A stray or stale draft
    // tower must never satisfy a secret recipe or serve as its result anchor.
    const candidates=this.roundCandidates.map(c=>c.tower);
    if(this.phase!=='select'||this.draft.draws.length!==5||this.draft.draws.some(d=>!d.placed)||candidates.length!==5)return null;
    return matchingIngredients(recipe,candidates,anchor,{phase:this.phase,round:this.round});
  }
  mergePartner(t=this.selection){return this.phase==='select'?mergePartner(t,this.roundCandidates.map(c=>c.tower),this.data):null;}
  merge() {
    const t=this.selection;
    const partner=this.mergePartner(t);
    if(!partner)return this.message('Rank merging needs two identical defenders among this round’s five candidates.');
    const draftUsed=t.state==='draft'||partner.state==='draft';
    if(this.phase==='select'&&t.state!=='draft'&&draftUsed)return this.message('Select the new tower to choose its result location.');
    partner.state='ruin';t.tier++;t.kills+=partner.kills;t.state='active';
    if(draftUsed)this.finishSelection(t);
    this.emit('combine',{tower:t});this.emit('change');return true;
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
    const kills=pieces.reduce((sum,p)=>sum+(p.kills||0),0),family=recipeFamily(recipe);
    pieces.forEach(p=>p.state='ruin');t.family=family;t.tier=1;t.state='active';t.upgrades=0;t.kills=kills;
    this.discoveries.add(family);
    if(draftUsed)this.finishSelection(t);
    this.emit('combine',{tower:t});this.emit('discover',{id:family});this.emit('change');return true;
  }
  remove() {
    const t=this.selection;
    if(!t)return this.message('Select a castle wall to demolish.');
    if(!['build','select','ready','reward'].includes(this.phase))return this.message('Demolition is available between waves.');
    if(t.state==='draft')return this.message('Choose your keeper first. This round’s five candidates cannot be demolished yet.');
    if(t.state!=='ruin')return this.message('Retained defenders are permanent. Transform them through an advanced recipe; only castle walls can be demolished.');
    this.grid.remove(t.x,t.z);this.towers=this.towers.filter(o=>o.id!==t.id);this.selected=null;
    this.emit('change');this.message('Castle wall demolished · tile cleared');return true;
  }
  reroll() {
    return this.message('Defenders are rolled only after placement. Kingdom experience improves future draws automatically.');
  }
  mastery() {return this.message('Construction mastery advances automatically with Kingdom level.');}
  repair() {
    return this.message('Lost keep health is permanent.');
  }
  upgradeSpecial() {
    return this.message('Gold is reserved for downgrading a current candidate. Champions improve through recipes.');
  }
  startCombat() {if(this.phase!=='ready')return false;this.selectedEnemy=null;this.phase='combat';this.paused=false;this.combat.start(this.wave);this.emit('wave');this.emit('change');return true;}
  completeWave() {
    if(this.phase!=='combat')return;
    this.selectedEnemy=null;this.emit('wave-complete',{round:this.round});
    this.awardScore(this.round*100+(this.wave.boss?this.round*200:0));
    this.lastReward=this.wave.boss?200:50;this.economy.reward(this.lastReward,15);this.combat.projectiles=[];
    if(this.round>=this.waveLimit){this.end(true);return;}
    const round=this.round;this.phase='reward';this.emit('reward',{round,gold:this.lastReward});this.nextRound();
    this.message(`Wave ${round} survived · +${this.lastReward} gold · build five new defenders`);
  }
  nextRound() {if(this.phase!=='reward')return false;this.round++;this.phase='build';this.draft.roll(this.economy.mastery);this.activeDraw=0;this.selected=null;this.emit('change');return true;}
  end(won){this.selectedEnemy=null;this.phase=won?'won':'lost';this.emit(this.phase);this.emit('change');}
  tick(dt){if(this.phase==='combat'&&!this.paused)this.combat.update(dt*this.speed);this.pruneEnemySelection();}
}
