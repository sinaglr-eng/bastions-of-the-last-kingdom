import {Game} from './game.js';
import {GridManager} from './grid.js';
import {seededRandom} from './math.js';

export const DEVELOPER_SETUP_VERSION=1;
export const DEVELOPER_STATISTICS_NOTICE='Developer Mode — statistics disabled';
const clone=value=>structuredClone(value);
const number=(value,min,max,label,integer=false)=>{
  const n=typeof value==='number'||(typeof value==='string'&&value.trim())?Number(value):NaN;if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isSafeInteger(n)))throw new RangeError(`${label} must be ${integer?'an integer ':''}from ${min} to ${max}.`);return n;
};
const enemyFields={armor:[0,100000],krakenShell:[0,1e7],regen:[0,1],recharge:[0,1],untouchable:[0,1],evasion:[0,1],reactiveArmor:[0,1000],blink:[0,100],rush:[1,100]};
const ruleFields={refraction:{period:[.1,120]},recharge:{period:[.1,120]},blink:{period:[.1,120]},reactive:{maxStacks:[0,100],decayPerSecond:[0,100]},disarm:{duration:[0,120],period:[.1,120],radius:[0,37]},dread:{radius:[0,37]},support:{radius:[0,37],hasteDuration:[0,120],hastePeriod:[.1,120]},rush:{duration:[0,120],period:[.1,120]}};
const safeFields=(values,allowed)=>{
  if(!values||typeof values!=='object'||Array.isArray(values))throw new TypeError('Rules must be an object.');
  const result={};for(const [key,value] of Object.entries(values)){if(!Object.hasOwn(allowed,key))throw new Error(`Unsupported rule: ${key}.`);const bounds=allowed[key];result[key]=number(value,...bounds,key);}return result;
};

// Test-only mutations stay in one flagged Game, with isolated approved data.
// No command evaluates code or writes ordinary run statistics/profile records.
export class DeveloperConsoleSession{
  constructor(game,{onActivate=()=>{},onReset=null,clock=()=>Date.now()}={}){
    this.baseData=clone(game.data);this.campaignWaveLimit=game.waveLimit;this.onActivate=onActivate;this.onReset=onReset;this.clock=clock;this.mode='sandbox';this.ready=false;this.disposed=false;this.log=[];this.results=[];this.traces=[];this.variant='random';this._attach(game);
  }
  get waveLimit(){return this.mode==='sandbox'?this.baseData.waves.length:this.campaignWaveLimit;}
  _attach(game){this.unsubscribe?.();this.game=game;this.unsubscribe=game.on((type,payload)=>this._event(type,payload));}
  _setData(data){this.game.data=data;this.game.draft.data=data;this.game.economy.balance=data.balance;}
  async activate(){
    if(this.disposed)throw new Error('This console session has ended.');if(this.ready)return this;if(this.activation)return this.activation;
    this.game.developerMode=true;
    this.activation=Promise.resolve().then(()=>this.onActivate(this.game)).then(()=>{
      if(this.disposed)throw new Error('This console session has ended.');
      this._setData(clone(this.game.data));this.game.waveLimit=this.waveLimit;this.ready=true;this._record('activate',{mode:this.mode});return this;
    }).catch(error=>{this.activation=null;throw error;});return this.activation;
  }
  _ready(){if(this.disposed||!this.ready||!this.game.developerMode)throw new Error('Activate Developer Console and disable statistics first.');}
  _sandbox(){this._ready();if(this.mode!=='sandbox')throw new Error('This command requires Sandbox. Reset as Sandbox to change the test rules or lineup.');}
  _between(){if(this.game.phase==='combat')throw new Error('Finish or restart the wave before changing the lineup.');}
  _record(action,detail={}){this.log.push({action,time:this.clock(),...clone(detail)});if(this.log.length>200)this.log.shift();}
  _change(action,detail){this._record(action,detail);this.game.emit('change');}
  async resetTest({mode='campaign',seed=this.game.seed>>>0}={}){
    this._ready();if(!['campaign','sandbox'].includes(mode))throw new Error('Choose Campaign Test or Sandbox.');
    const nextSeed=number(seed,0,0xffffffff,'Seed',true),data=clone(mode==='campaign'?this.baseData:this.game.data);
    const replacement=new Game(data,{seed:nextSeed,waveLimit:mode==='sandbox'?this.baseData.waves.length:this.campaignWaveLimit,discoveries:[]});replacement.developerMode=true;
    if(typeof this.onReset!=='function')throw new Error('Reset is not connected to this battlefield.');
    const installed=await this.onReset(replacement);if(installed&&installed!==replacement)throw new Error('Reset must install the supplied test Game.');
    if(this.disposed)throw new Error('This console session has ended.');
    this._attach(replacement);this.mode=mode;this.ready=false;this.activation=null;this.variant='random';this.results=[];this.traces=[];this.log=[];this.current=null;this.lastWaveSetup=null;
    await this.activate();this._record('reset',{mode,seed:nextSeed});return replacement;
  }
  setSeed(seed){this._sandbox();this._between();const value=number(seed,0,0xffffffff,'Seed',true);this.game.seed=value;this.game.rng=seededRandom(value);this.game.draft.rng=this.game.rng;this._change('seed',{seed:value});}
  variantsForWave(round){
    const wave=this.game.data.waves[round-1];if(!wave)return [];
    return wave.groups.map(group=>({type:group.type,name:this.game.data.enemies[group.type]?.name||group.type,variants:(this.game.data.enemies[group.type]?.variants||[]).map((variant,index)=>({index,name:variant.name||`Variant ${index+1}`}))}));
  }
  setVariant(value){this._sandbox();if(value!=='random')number(value,0,50,'Variant index',true);this.variant=value==='random'?'random':Number(value);this._change('variant',{variant:this.variant});}
  runWave(round=this.game.round,{restart=false}={}){
    this._ready();const value=number(round,1,this.waveLimit,'Wave',true);
    if(this.mode==='campaign'){
      if(restart||value!==this.game.round||this.game.phase!=='ready')throw new Error('Campaign Test uses the normal draft, recipes and wave progression.');
      if(!this.game.startCombat())throw new Error('The wave is not ready.');return true;
    }
    const wave=this.game.data.waves[value-1];
    const variants=wave.groups.map(group=>{if(this.variant!=='random'){
      const variants=this.game.data.enemies[group.type]?.variants||[];
      if(variants.length)return clone(variants[number(this.variant,0,variants.length-1,`${group.type} variant`,true)]);
    }return undefined;});
    this.game.commandMove.cancel();this.game.draft.discardReserve();this.game.draft.draws=[];
    for(const tower of this.game.towers){if(tower.state==='draft')tower.state='active';else if(tower.state==='reserved')tower.state='ruin';}
    wave.groups.forEach((group,index)=>{delete group.variant;if(variants[index])group.variant=variants[index];});
    this.game.round=value;this.game.phase='ready';this.game.selected=null;this.game.selectedEnemy=null;this.game.previewRecipeId=null;
    this.game.seed=this.game.seed>>>0;this.game.waveLimit=this.waveLimit;this.game.combat.serial=0;this.game.combat.shotSerial=0;this.game.rng=seededRandom(this.game.seed);this.game.draft.rng=this.game.rng;this.game.economy.constructionRound=value;this.game.economy.setConstructionRound(value);
    this.lastWaveSetup=this.exportSetup();this._record(restart?'restart-wave':'run-wave',{wave:value,variant:this.variant,seed:this.game.seed});
    if(!this.game.startCombat())throw new Error('The wave could not be started.');return true;
  }
  restartWave(){this._sandbox();if(!this.lastWaveSetup)throw new Error('Run a Sandbox wave before restarting it.');this.game.phase='ready';this.importSetup(clone(this.lastWaveSetup));return this.runWave(this.game.round,{restart:true});}
  setResources({gold=this.game.economy.gold,lives=this.game.lives,cp=this.game.commandPoints.value}={}){
    this._sandbox();const values={gold:number(gold,0,1e9,'Gold',true),lives:number(lives,1,1000000,'Keep health',true),cp:number(cp,0,1000000,'CP',true)};
    this.game.economy.gold=values.gold;this.game.lives=values.lives;this.game.commandPoints.value=values.cp;this._change('resources',values);
  }
  addDefender({family,tier=1,x,z,mvpLevel=0}={}){
    this._sandbox();this._between();const stats=Object.hasOwn(this.game.data.towers,family)&&this.game.data.towers[family];if(!stats)throw new Error('Choose an authored defender.');
    const rank=number(tier,1,stats.advanced?1:6,'Rank',true),level=number(mvpLevel,0,10,'MVP level',true),size=this.game.grid.size;
    const tile={x:number(x,0,size-1,'X',true),z:number(z,0,size-1,'Z',true)};
    if(this.game.towers.length>=250)throw new Error('The test lineup is limited to 250 structures.');
    const id=this.game.nextId,check=this.game.grid.occupy(tile.x,tile.z,id);if(!check.ok)throw new Error(check.reason);
    const tower={id,family,tier:rank,...tile,state:'active',round:0,kills:0,priority:'first',cooldown:0,mvpLevel:level,attackPaused:false};
    this.game.nextId++;this.game.towers.push(tower);this.game.selected=id;
    if(this.game.mvp?.setLevel)this.game.mvp.setLevel(tower,level);this._change('add-defender',{id,family,tier:rank,...tile,mvpLevel:level});return tower;
  }
  removeDefender(id){
    this._sandbox();this._between();const tower=this.game.towers.find(t=>t.id===Number(id));if(!tower)throw new Error('Select an existing defender.');
    this.game.grid.remove(tower.x,tower.z);this.game.towers=this.game.towers.filter(t=>t!==tower);if(this.game.selected===tower.id)this.game.selected=null;this.game.draft.discardReserve();this._change('remove-defender',{id:tower.id});
  }
  setMvp(id,level){
    this._sandbox();const tower=this.game.towers.find(t=>t.id===Number(id)&&t.state==='active');if(!tower)throw new Error('Select an active defender.');
    const value=number(level,0,10,'MVP level',true);if(this.game.mvp?.setLevel)this.game.mvp.setLevel(tower,value);else tower.mvpLevel=value;this._change('mvp',{id:tower.id,level:value});
  }
  setAttackPaused(id,paused){
    this._ready();const tower=this.game.towers.find(t=>t.id===Number(id)&&t.state==='active');if(!tower)throw new Error('Select an active defender.');
    if(this.game.setTowerAttackPaused)this.game.setTowerAttackPaused(tower.id,!!paused);else tower.attackPaused=!!paused;this._change('defender-pause',{id:tower.id,paused:!!paused});
  }
  setPaused(paused){this._ready();this.game.paused=!!paused;this._change('pause',{paused:!!paused});}
  setSpeed(speed){this._ready();this.game.speed=number(speed,1,3,'Speed',true);this._change('speed',{speed:this.game.speed});}
  setEnemyRules(type,values){
    this._sandbox();const profile=Object.hasOwn(this.game.data.enemies,type)&&this.game.data.enemies[type];if(!profile)throw new Error('Choose an authored enemy.');const patch=safeFields(values,enemyFields);
    Object.assign(profile,patch);for(const variant of profile.variants||[])Object.assign(variant,patch);this._change('enemy-rules',{type,values:patch});
  }
  setTimingRules(group,values){
    this._sandbox();if(!Object.hasOwn(ruleFields,group))throw new Error('Choose a supported timing group.');const patch=safeFields(values,ruleFields[group]);
    this.game.data.balance.enemyRules??={};this.game.data.balance.enemyRules[group]={...this.game.data.balance.enemyRules[group],...patch};this._change('timing-rules',{group,values:patch});
  }
  restoreRules(){this._sandbox();this._between();this._setData(clone(this.baseData));this.variant='random';this._change('restore-rules');}
  spawnEnemy(type,variant='random'){
    this._sandbox();if(this.game.phase!=='combat')throw new Error('Start a wave before spawning an invader.');const profile=Object.hasOwn(this.game.data.enemies,type)&&this.game.data.enemies[type];if(!profile)throw new Error('Choose an authored enemy.');
    const choices=profile.variants||[];if(variant!=='random'&&!choices.length)throw new Error('This enemy has no alternate variants.');
    const selected=variant==='random'?(choices.length?choices[Math.floor(this.game.rng()*choices.length)]:undefined):choices[number(variant,0,choices.length-1,'Variant index',true)];
    const enemy=this.game.combat.spawn(type,selected?{variant:clone(selected)}:{});this.game.combat.total++;this._change('spawn-enemy',{type,variant});return enemy;
  }
  exportSetup(){
    this._ready();return {schemaVersion:DEVELOPER_SETUP_VERSION,mode:'sandbox',seed:this.game.seed>>>0,waveLimit:this.waveLimit,wave:this.game.round,variant:this.variant,
      resources:{gold:this.game.economy.gold,lives:this.game.lives,cp:this.game.commandPoints.value},
      enemyRules:clone(this.game.data.balance.enemyRules||{}),enemies:Object.fromEntries(Object.entries(this.game.data.enemies).map(([type,profile])=>[type,Object.fromEntries(Object.keys(enemyFields).filter(key=>Number.isFinite(profile[key])&&profile[key]!==this.baseData.enemies[type]?.[key]).map(key=>[key,profile[key]]))]).filter(([,values])=>Object.keys(values).length)),
      towers:this.game.towers.map(t=>({family:t.family,tier:t.tier,x:t.x,z:t.z,mvpLevel:t.mvpLevel||0,attackPaused:!!t.attackPaused,state:['ruin','reserved'].includes(t.state)?'ruin':'active'}))};
  }
  importSetup(value){
    this._sandbox();this._between();if(typeof value==='string'&&value.length>1e6)throw new Error('Test setup JSON is too large.');const setup=typeof value==='string'?JSON.parse(value):value;
    if(!setup||setup.schemaVersion!==DEVELOPER_SETUP_VERSION||!Array.isArray(setup.towers)||setup.towers.length>250)throw new Error('Unsupported or oversized test setup.');
    const seed=number(setup.seed,0,0xffffffff,'Seed',true),wave=number(setup.wave,1,this.waveLimit,'Wave',true),data=clone(this.baseData),grid=new GridManager(),towers=[];
    for(const [group,values] of Object.entries(setup.enemyRules||{})){if(!Object.hasOwn(ruleFields,group))throw new Error('Unsupported timing rules.');data.balance.enemyRules??={};data.balance.enemyRules[group]=safeFields(values,ruleFields[group]);}
    for(const [type,values] of Object.entries(setup.enemies||{})){if(!Object.hasOwn(data.enemies,type))throw new Error('Unknown enemy in setup.');const patch=safeFields(values,enemyFields);Object.assign(data.enemies[type],patch);for(const variant of data.enemies[type].variants||[])Object.assign(variant,patch);}
    for(const row of setup.towers){const stats=Object.hasOwn(data.towers,row.family)&&data.towers[row.family];if(!stats)throw new Error('Unknown defender in setup.');
      const tower={id:towers.length+1,family:row.family,tier:number(row.tier,1,stats.advanced?1:6,'Rank',true),x:number(row.x,0,grid.size-1,'X',true),z:number(row.z,0,grid.size-1,'Z',true),mvpLevel:number(row.mvpLevel??0,0,10,'MVP level',true),attackPaused:row.attackPaused===true,state:row.state==='ruin'?'ruin':'active',round:0,kills:0,cooldown:0,priority:'first'};
      const check=grid.occupy(tower.x,tower.z,tower.id);if(!check.ok)throw new Error(check.reason);towers.push(tower);
    }
    const resources={gold:number(setup.resources?.gold??0,0,1e9,'Gold',true),lives:number(setup.resources?.lives??30,1,1000000,'Keep health',true),cp:number(setup.resources?.cp??0,0,1000000,'CP',true)};
    const variant=setup.variant==='random'||setup.variant===undefined?'random':number(setup.variant,0,50,'Variant index',true);
    if(variant!=='random')for(const group of data.waves[wave-1].groups){const variants=data.enemies[group.type].variants||[];if(variants.length)number(variant,0,variants.length-1,`${group.type} variant`,true);}
    // Commit only after the entire import has passed validation and routing.
    this._setData(data);this.game.grid=grid;this.game.towers=towers;this.game.nextId=towers.length+1;this.game.round=wave;this.game.waveLimit=this.waveLimit;this.game.phase='ready';this.game.commandMove.cancel();this.game.draft.discardReserve();this.game.draft.draws=[];this.game.selected=null;this.game.selectedEnemy=null;this.game.previewRecipeId=null;
    Object.assign(this.game.combat,{enemies:[],projectiles:[],spawnQueue:[],elapsed:0,spawned:0,total:0,serial:0,shotSerial:0});this.game.mvp?.startWave();this.current=null;this.traces=[];
    this.game.seed=seed;this.game.rng=seededRandom(seed);this.game.draft.rng=this.game.rng;this.game.economy.gold=resources.gold;this.game.economy.constructionRound=wave;this.game.lives=resources.lives;this.game.commandPoints.value=resources.cp;this.variant=variant;this._change('import-setup',{towers:towers.length,wave,seed});return true;
  }
  _event(type,p){
    if(!this.ready)return;
    if(type==='wave'){this.traces=[];this.current={wave:this.game.round,seed:this.game.seed,mode:this.mode,variant:this.variant,completed:false,damage:new Map(),leaks:0,setup:this.exportSetup()};}
    if(type==='hit'&&this.current&&p.source){const damage=Number.isFinite(p.effectiveDamage)?p.effectiveDamage:Math.min(p.damage,Math.max(0,p.enemy.hp+p.damage));this.current.damage.set(p.source.id,(this.current.damage.get(p.source.id)||0)+damage);}
    if(type==='leak'&&this.current)this.current.leaks++;
    if(type==='damage-trace'){
      const keys=['type','requestedDamage','beforeDefense','effectiveArmor','armorMultiplier','afterArmor','shellBlock','afterShell','appliedDamage','effectiveDamage','blockReason','directHit','critical','visible'];
      this.traces.push({sourceId:p.source?.id??null,enemyType:p.enemy?.type??null,...Object.fromEntries(keys.map(key=>[key,p[key]]))});if(this.traces.length>40)this.traces.shift();
    }
    if(['reward','won','lost'].includes(type)&&this.current){const current=this.current;this.current=null;this.results.push({...current,completed:type!=='lost',health:this.game.lives,elapsed:this.game.combat.elapsed,damage:[...current.damage].map(([id,damage])=>({id,damage,family:this.game.towers.find(t=>t.id===id)?.family||'Unknown',mvpLevel:this.game.towers.find(t=>t.id===id)?.mvpLevel||0})),rules:clone(this.game.data.balance.enemyRules||{}),interventions:clone(this.log)});if(this.results.length>50)this.results.shift();}
  }
  snapshot(){return {mode:this.mode,ready:this.ready,notice:DEVELOPER_STATISTICS_NOTICE,wave:this.game.round,seed:this.game.seed>>>0,health:this.game.lives,gold:this.game.economy.gold,cp:this.game.commandPoints.value,phase:this.game.phase,paused:this.game.paused,speed:this.game.speed,variant:this.variant,results:clone(this.results),traces:clone(this.traces),log:clone(this.log)};}
  dispose(){this.disposed=true;this.ready=false;this.unsubscribe?.();}
}
