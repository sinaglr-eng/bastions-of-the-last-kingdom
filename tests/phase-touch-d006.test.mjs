import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {PhaseUiState,phaseStripMarkup,combatStatusModel,combatBossMarkup} from '../ui/phase-ui.js';
import {DraftCardActivation,DraftCardPointerInput,drawKeeperKey,keepDrawKeeper,mergeTowerFromBadge} from '../ui/draft-input.js';
import {draftCardsMarkup} from '../ui/draft-cards.js';
import {CommandPointerInput} from '../ui/command-pointer-input.js';

const raw=Object.fromEntries(['balance','towers','recipes','enemies','waves'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
const section=(start,end)=>{const from=main.indexOf(start),to=main.indexOf(end,from);assert.ok(from>=0&&to>from);return main.slice(from,to);};
const activateSource=section('function activateDraw(',"app.addEventListener('pointerdown'");
const bindingSource=section("app.addEventListener('pointerdown'",'function handleCommand(');
const handlerSource=section('function handleCommand(','function toggleWorld(');
// Keep the exact production accepted-selection subscriber. The remaining
// render branch below is the same phase-controller update used by main render.
const hookStart=main.indexOf('game.on((type,payload)=>{'),hookEnd=main.indexOf('resultFacts.event(',hookStart);
assert.ok(hookStart>=0&&hookEnd>hookStart);
const acceptedSelectionHook=main.slice(hookStart,hookEnd)+"if(type==='change')render();});";
const noop=()=>{},outside={closest:()=>null};
const snapshot=game=>JSON.stringify({towers:game.towers,draws:game.draft.draws,selected:game.selected,phase:game.phase,cp:game.commandPoints.value,gold:game.economy.gold,grid:[...game.grid.occupied]});
class Surface{
  constructor(){this.listeners=new Map();this.dataset={};}
  addEventListener(type,callback,options){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push({callback,capture:options===true||!!options?.capture});}
  emit(type,event){let stopped=false;const accepted={...event,type,preventDefault:noop,stopImmediatePropagation:()=>{stopped=true;}};for(const {callback}of [...(this.listeners.get(type)||[])].sort((a,b)=>Number(b.capture)-Number(a.capture))){if(stopped)break;callback(accepted);}}
}
const finger=(target,id=1)=>({target,pointerId:id,pointerType:'touch',button:0,isPrimary:true,clientX:100,clientY:100});
function interfaceFixture({complete=true}={}){
  const game=new Game(data,{seed:731}),phaseUi=new PhaseUiState(),app=new Surface(),window=new Surface(),world={maze:{editing:false},sync:noop,doubleTap:{clear:noop}},audio={unlock:noop};
  const render=()=>{phaseUi.sync(game);phaseUi.apply(app,game);};render();
  const cards=game.draft.draws.map((_,index)=>{const target={disabled:false,isConnected:true,dataset:{action:'draw',index:String(index)}};target.closest=()=>target;return target;});
  let now=1000,hit=outside;const activation=new DraftCardActivation(()=>now);
  const activate=runInNewContext(activateSource+'\nactivateDraw',{game,phaseUi,world,audio,draftCardActivation:activation,render});
  const input=new DraftCardPointerInput({now:()=>now,hitTest:()=>hit,activate,clearActivation:()=>activation.clear()});
  runInNewContext(acceptedSelectionHook,{game,phaseUi,render});
  runInNewContext(bindingSource,{app,window,game,draftPointerInput:input});
  const commands=app;runInNewContext(handlerSource,{game,phaseUi,app:commands,window,document:{addEventListener:noop,elementFromPoint:()=>hit},CommandPointerInput,world,audio,draftCardActivation:activation,draftPointerInput:input,keepDrawKeeper,mergeTowerFromBadge,render,debug:false,codex:noop,warbands:noop,help:noop,sendWave:()=>game.startCombat(),closeDialog:noop,debugPanel:noop});
  if(complete)for(let index=0;index<5;index++){game.draft.roundForced={family:['mage','archer','cleric','druid','soldier'][index],tier:1};assert.equal(game.place(3+index,3),true);}
  return {game,phaseUi,app,cards,render,input,activation,advance(ms){now+=ms;},tap(index,id=1){hit=cards[index];window.emit('pointerdown',finger(cards[index],id));app.emit('pointerdown',finger(cards[index],id));window.emit('pointerup',finger(outside,id));},press(index,id=1){hit=cards[index];window.emit('pointerdown',finger(cards[index],id));app.emit('pointerdown',finger(cards[index],id));},release(index,id=1){hit=cards[index];window.emit('pointerup',finger(outside,id));},click(button){commands.emit('click',{target:{closest:()=>button},detail:1});}};
}

test('accepted touch on the already-selected fifth card reopens the inspector without keeping or drawing',()=>{
  const view=interfaceFixture(),control=interfaceFixture(),fifth=view.game.towers[4];assert.equal(view.game.selected,fifth.id);view.phaseUi.close();view.render();assert.equal(view.phaseUi.inspectorOpen,false);
  const before=snapshot(view.game);view.tap(4);assert.equal(view.game.selected,fifth.id);assert.equal(view.phaseUi.inspectorOpen,true);assert.equal(view.phaseUi.view,'unit');assert.equal(snapshot(view.game),before);assert.equal(view.game.rng(),control.game.rng());
  const markup=draftCardsMarkup(view.game,data,{});assert.equal((markup.match(/class="draw-slot/g)||[]).length,5);assert.match(markup,/data-action="keep-draw" data-index="4"/);
});

test('explicit fifth-slot Keep uses its exact current token and commits only on the action',()=>{
  const view=interfaceFixture();view.phaseUi.close();view.tap(4);const tower=view.game.selection;
  assert.equal(view.game.phase,'select');const button={disabled:false,dataset:{action:'keep-draw',index:'4',towerId:String(tower.id),keeperKey:drawKeeperKey(view.game,4)}};view.click(button);
  assert.equal(view.game.phase,'ready');assert.equal(view.phaseUi.historyExpanded,false);assert.equal(tower.state,'active');assert.equal(view.game.towers.filter(t=>t.state==='active').length,1);assert.equal(view.game.towers.filter(t=>t.state==='ruin').length,4);
  const after=snapshot(view.game);view.click(button);assert.equal(snapshot(view.game),after);
});

test('stale touch release after reserve cannot select or reopen an inactive fifth candidate',()=>{
  const view=interfaceFixture(),fifth=view.game.selection;view.phaseUi.close();view.press(4);assert.equal(view.game.reserve(),true);view.phaseUi.close();view.render();const before=snapshot(view.game);
  view.release(4);assert.equal(snapshot(view.game),before);assert.equal(fifth.state,'reserved');assert.equal(view.phaseUi.inspectorOpen,false);assert.equal(view.game.selected,null);
});

test('mystery fifth-slot selection changes only the pending slot and does not reveal family, rank or RNG',()=>{
  const view=interfaceFixture({complete:false}),control=interfaceFixture({complete:false});view.phaseUi.close();view.tap(4);
  assert.equal(view.game.activeDraw,4);assert.equal(view.game.selected,null);assert.equal(view.game.towers.length,0);assert.equal(view.game.phase,'build');assert.ok(view.game.draft.draws.every(draw=>!draw.placed));assert.equal(view.game.rng(),control.game.rng());assert.equal(view.phaseUi.historyExpanded,true);
});

test('same retained selection reopens after close, while ordinary paused refresh leaves the optional inspector closed',()=>{
  const view=interfaceFixture();view.game.keep();view.game.startCombat();const keeper=view.game.towers.find(t=>t.state==='active');view.game.select(keeper.id);assert.equal(view.phaseUi.inspectorOpen,true);view.phaseUi.close();view.game.paused=true;view.render();assert.equal(view.phaseUi.inspectorOpen,false);
  const before=snapshot(view.game);view.game.select(keeper.id);assert.equal(view.phaseUi.inspectorOpen,true);assert.equal(snapshot(view.game),before);assert.equal(view.game.paused,true);assert.equal(view.app.dataset.paused,'true');assert.equal(combatStatusModel(view.game).paused,true);assert.equal(phaseStripMarkup(view.game,view.phaseUi),'');
});

test('two combat rounds restore the full five-slot draft without changing optional disclosure choice or committing a candidate',()=>{
  const view=interfaceFixture();view.game.keep();view.game.startCombat();assert.equal(view.phaseUi.historyExpanded,false);view.phaseUi.toggleHistory();view.phaseUi.close();view.game.paused=true;view.render();assert.equal(view.phaseUi.historyExpanded,true);view.game.paused=false;view.game.completeWave();
  assert.equal(view.game.round,2);assert.equal(view.game.phase,'build');assert.equal(view.phaseUi.historyExpanded,true);assert.equal(view.phaseUi.inspectorOpen,false);assert.equal(view.game.draft.draws.length,5);assert.ok(view.game.draft.draws.every(draw=>!draw.placed));
  for(let index=0;index<5;index++)assert.equal(view.game.place(3+index,5),true);view.game.keep();view.game.startCombat();assert.equal(view.phaseUi.historyExpanded,false);view.game.completeWave();assert.equal(view.game.round,3);assert.equal(view.game.draft.draws.length,5);assert.ok(view.game.draft.draws.every(draw=>!draw.placed));
});

test('actual shield blocks preserve boss HP and paused counts; actual concealment suppresses private identity and HP',()=>{
  const view=interfaceFixture();view.game.keep();view.game.startCombat();view.game.combat.enemies=[];view.game.combat.spawnQueue=[];
  const boss=view.game.combat.spawn('host_10',{variant:{refraction:3}}),hp=boss.hp;view.game.combat.spawnQueue.push({type:'host_10',modifiers:{}});view.game.paused=true;
  assert.equal(view.game.combat.resolveDamage(boss,100,'physical',{directHit:true},view.game.selection).appliedDamage,0);assert.equal(boss.hp,hp);assert.equal(boss.shields,2);
  const shown=combatStatusModel(view.game);assert.equal(shown.onField,1);assert.equal(shown.queued,1);assert.equal(shown.boss.hp,hp);assert.equal(shown.paused,true);
  const name=boss.name,maxHp=boss.maxHp;boss.x=25;boss.z=25;boss.cloaked=true;
  Object.defineProperty(boss,'hp',{configurable:true,get(){throw Error('Concealed HP must not be read');}});Object.defineProperty(boss,'maxHp',{configurable:true,get(){throw Error('Concealed max HP must not be read');}});Object.defineProperty(boss,'name',{configurable:true,get(){throw Error('Concealed name must not be read');}});
  assert.equal(view.game.combat.isRevealed(boss),false);const hidden=combatStatusModel(view.game);assert.equal(hidden.boss.concealed,1);assert.match(combatBossMarkup(hidden),/Boss concealed/);assert.doesNotMatch(combatBossMarkup(hidden),/progressbar|aria-valuenow/);
  Object.defineProperty(boss,'hp',{configurable:true,writable:true,value:hp});Object.defineProperty(boss,'maxHp',{configurable:true,writable:true,value:maxHp});Object.defineProperty(boss,'name',{configurable:true,writable:true,value:name});boss.cloaked=false;
  assert.match(combatBossMarkup(combatStatusModel(view.game)),/role="progressbar"/);
});
