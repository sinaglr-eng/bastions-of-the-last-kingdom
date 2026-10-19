import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CommandPointerInput} from '../ui/command-pointer-input.js';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';

const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8'),noop=()=>{};
const source=name=>{
  const start=main.indexOf(`function ${name}(`);assert.ok(start>=0,`Actual main ${name} exists`);
  const rest=main.slice(start),next=/\nfunction /.exec(rest);return rest.slice(0,next?.index??rest.length);
};
function actualCommands(game){
  const bindings={cancelRecipePreview:()=>{},game,world:{maze:{editing:false},doubleTap:{clear:noop}},audio:{unlock:noop,syncGameState:noop},debug:false,
    draftCardActivation:{clear:noop},draftPointerInput:{click:noop},codex:noop,warbands:noop,help:noop,closeDialog:noop,debugPanel:noop,
    $:()=>({open:false}),phaseUi:{apply:noop},updateHeaderCombatControls:noop,app:{addEventListener:noop},window:{addEventListener:noop},document:{querySelector:()=>null}};
  return Function(...Object.keys(bindings),source('sendWave')+'\n'+source('combatTransport')+'\n'+source('handleCommand')+'\nreturn handleCommand;')(...Object.values(bindings));
}
function ready(seed=731){
  const game=new Game(data,{seed});
  for(let index=0;index<5;index++){game.draft.roundForced={family:['cleric','druid','soldier','mage','archer'][index],tier:1};assert.equal(game.place(3+index,3),true);}
  game.draft.roundForced=null;game.select(game.towers[0].id);assert.equal(game.keep(),true);return game;
}
const gameIdentity=game=>JSON.stringify([game.round,game.phase,game.selected,game.selection&&
  [game.selection.id,game.selection.state,game.selection.family,game.selection.tier,game.selection.x,game.selection.z],
  game.selectedEnemy??null,game.commandMove.active,game.commandMove.fromId??null]);
function button(action,extra={}){
  return {tagName:'BUTTON',dataset:{action,...extra},disabled:false,hidden:false,isConnected:true,ancestorHidden:false,inert:false,ariaHidden:false,disabledByFieldset:false,cssHidden:false,
    style:{display:'block',visibility:'visible'},ownerDocument:{defaultView:{getComputedStyle:element=>element.style}},
    getClientRects(){return this.cssHidden?[]:[{width:44,height:44}];},matches(selector){return selector===':disabled'&&this.disabledByFieldset;},
    closest(selector){if(selector==='button[data-action]'||selector==='[data-action]')return this;
      if(selector==='.recipe-map-badge')return this.mapBadge?this:null;
      if(selector==='[hidden],[inert],[aria-hidden="true"]')return this.ancestorHidden||this.inert||this.ariaHidden?{}:null;return null;}};
}
const outside={closest:()=>null};
const descendant=parent=>({closest:selector=>parent.closest(selector)});
const pointer=(target,id=1,type='touch',x=100,y=100,extra={})=>({target,pointerId:id,pointerType:type,isPrimary:true,button:0,clientX:x,clientY:y,...extra});
const nativeClick=(target,extra={})=>({target,detail:1,clientX:100,clientY:100,...extra});
function fixture({game=ready(),execute=true}={}){
  let currentGame=game,hit=null,time=1000;const accepted=[],commands=actualCommands(game);let canvasClicks=0,consumed=0;
  const input=new CommandPointerInput({now:()=>time,hitTest:()=>hit,
    captureIdentity:()=>({game:currentGame,fingerprint:gameIdentity(currentGame)}),
    validateIdentity:identity=>identity.game===currentGame&&identity.fingerprint===gameIdentity(currentGame),
    activate:(target,event)=>{accepted.push(target.dataset.action);if(execute)commands({...event,target});}});
  return {game,input,accepted,commands,advance(ms){time+=ms;},hit(target){hit=target;},replaceGame(next){currentGame=next;},
    get canvasClicks(){return canvasClicks;},get consumed(){return consumed;},
    down(target,id=1,type='touch',extra={}){hit=target;return input.start(pointer(target,id,type,100,100,extra));},
    up(target,id=1,type='touch',extra={}){return input.end(pointer(target,id,type,100,100,extra));},
    click(event){if(input.suppressClick(event)){consumed++;return false;}if(event.target.closest?.('[data-action]'))commands(event);else canvasClicks++;return true;},
    tap(target,id=1,type='touch'){this.down(target,id,type);return this.up(outside,id,type);}};
}

test('actual Start command succeeds once on accepted touch/pen release with no compatibility click',()=>{
  for(const type of ['touch','pen']){
    const view=fixture(),control=ready(),start=button('start');let waves=0;view.game.on(event=>{if(event==='wave')waves++;});
    assert.equal(view.tap(descendant(start),1,type),true);assert.equal(view.game.phase,'combat');assert.equal(waves,1);
    assert.equal(view.click(nativeClick(start,{pointerType:type})),false);assert.equal(waves,1);
    assert.equal(control.startCombat(),true);assert.equal(view.game.rng(),control.rng(),'The same actual core command preserves the random stream');
  }
});

test('actual selected-wall demolition survives logical replacement and consumes retargeted canvas/ancestor clicks',()=>{
  const view=fixture(),wall=view.game.towers.find(t=>t.state==='ruin');view.game.select(wall.id);
  const original=button('remove',{towerId:String(wall.id)}),gold=view.game.economy.gold,cp=view.game.commandPoints.value,remaining=view.game.towers.length;
  assert.equal(view.game.grid.occupied.has(`${wall.x},${wall.z}`),true);
  view.down(descendant(original));original.isConnected=false;const replacement=button('remove',{towerId:String(wall.id)});view.hit(descendant(replacement));
  assert.equal(view.up(original),true);assert.deepEqual(view.accepted,['remove']);assert.equal(view.game.towers.some(t=>t.id===wall.id),false);
  assert.equal(view.game.towers.length,remaining-1);assert.equal(view.game.grid.occupied.has(`${wall.x},${wall.z}`),false);
  assert.equal(view.game.economy.gold,gold);assert.equal(view.game.commandPoints.value,cp);
  for(const target of [outside,button('start'),replacement])assert.equal(view.click(nativeClick(target)),false,'Legacy retargeted click cannot execute another command or hit the canvas');
  assert.equal(view.canvasClicks,0);assert.equal(view.game.phase,'ready');assert.equal(view.game.towers.length,remaining-1);
});

test('native click arriving before pointerup cannot make the actual Start command execute twice',()=>{
  const view=fixture(),target=button('start');let waves=0;view.game.on(event=>{if(event==='wave')waves++;});view.down(target);
  assert.equal(view.click(nativeClick(target,{pointerType:'touch'})),true);assert.equal(view.game.phase,'combat');
  assert.equal(view.up(target),false);assert.equal(view.click(nativeClick(outside)),false);assert.equal(waves,1);
});

test('changing selected walls during the press cannot demolish either the old or new selected wall',()=>{
  const view=fixture(),walls=view.game.towers.filter(t=>t.state==='ruin'),target=button('remove');view.game.select(walls[0].id);view.down(target);
  view.game.select(walls[1].id);assert.equal(view.up(target),false);assert.equal(view.click(nativeClick(target)),false);
  assert.equal(view.game.selection,walls[1]);assert.equal(view.game.towers.includes(walls[0]),true);assert.equal(view.game.towers.includes(walls[1]),true);
});

test('action and every dataset field must still match; dataset insertion order does not matter',()=>{
  for(const mutate of [b=>b.dataset.action='remove',b=>b.dataset.id='other',b=>b.dataset.craftKey='changed',b=>delete b.dataset.id,b=>b.dataset.extra='added']){
    const view=fixture({execute:false}),original=button('craft-dock',{id:'recipe',craftKey:'full-key'});view.down(original);
    const replacement=button('craft-dock',{id:'recipe',craftKey:'full-key'});mutate(replacement);original.isConnected=false;view.hit(replacement);
    assert.equal(view.up(original),false);assert.equal(view.accepted.length,0);assert.equal(view.input.suppressClick(nativeClick(replacement)),true);
  }
  const view=fixture({execute:false}),original=button('craft-dock',{id:'recipe',craftKey:'full-key'});view.down(original);
  const replacement=button('craft-dock');replacement.dataset={craftKey:'full-key',id:'recipe',action:'craft-dock'};view.hit(replacement);
  assert.equal(view.up(original),true);assert.equal(view.accepted.length,1);
});

test('captured Game, phase, round, selection, actual tower, enemy and move identities revalidate before command',()=>{
  const mutations=[v=>v.game.phase='combat',v=>v.game.round++,v=>v.game.selected=null,v=>v.game.selection.id++,v=>v.game.selection.family='mage',
    v=>v.game.selection.tier++,v=>v.game.selection.state='ruin',v=>v.game.selection.x++,v=>v.game.selection.z++,v=>v.game.selectedEnemy=99,
    v=>v.game.commandMove.active=true,v=>v.game.commandMove.fromId=99,v=>v.replaceGame(ready())];
  for(const mutate of mutations){const view=fixture({execute:false}),target=button('start');view.down(target);mutate(view);
    assert.equal(view.up(target),false);assert.equal(view.accepted.length,0);assert.equal(view.input.suppressClick(nativeClick(target)),true);}
});

test('disabled, hidden, inert, CSS-hidden and disconnected current commands cannot activate',()=>{
  for(const mutate of [b=>b.disabled=true,b=>b.hidden=true,b=>b.ancestorHidden=true,b=>b.inert=true,b=>b.ariaHidden=true,b=>b.disabledByFieldset=true,
    b=>b.cssHidden=true,b=>b.style.display='none',b=>b.style.visibility='hidden',b=>b.style.visibility='collapse',b=>b.isConnected=false]){
    const view=fixture({execute:false}),target=button('start');view.down(target);mutate(target);
    assert.equal(view.up(target),false);assert.equal(view.accepted.length,0);assert.equal(view.input.suppressClick(nativeClick(target)),true);
  }
});

test('touch and pen drag-return gestures reject both release and delayed compatibility click',()=>{
  for(const type of ['touch','pen']){const view=fixture({execute:false}),target=button('start');view.down(target,1,type);
    view.input.move(pointer(target,1,type,140));view.input.move(pointer(target,1,type));assert.equal(view.up(target,1,type),false);
    assert.equal(view.input.suppressClick(nativeClick(target,{pointerType:type})),true);assert.equal(view.accepted.length,0);}
});

test('release on a different command or outside target cannot activate the pressed command',()=>{
  for(const target of [outside,button('remove'),button('start',{id:'different'})]){const view=fixture({execute:false}),original=button('start');view.down(original);view.hit(target);
    assert.equal(view.up(original),false);assert.equal(view.input.suppressClick(nativeClick(original)),true);assert.equal(view.accepted.length,0);}
});

test('cancel, unexpected capture loss and scroll/blur clearing reject subsequent release and ghost click',()=>{
  for(const interruption of ['cancel','capture','clear']){const view=fixture({execute:false}),target=button('start');view.down(target);
    if(interruption==='cancel')view.input.cancel(pointer(target));else if(interruption==='capture')view.input.lostCapture(pointer(target));else view.input.clear();
    view.input.move(pointer(target,1,'touch',150));view.hit(target);assert.equal(view.up(target,1,'touch',{clientX:150}),false);
    assert.equal(view.input.suppressClick(nativeClick(target,{clientX:150})),true);assert.equal(view.accepted.length,0);}
});

test('normal implicit capture loss and a render-triggered scroll preserve completed-release suppression',()=>{
  const view=fixture({execute:false}),target=button('start');assert.equal(view.tap(target),true);
  view.input.lostCapture(pointer(target));view.input.clear();assert.equal(view.input.suppressClick(nativeClick(outside)),true);
  assert.equal(view.up(target),false);assert.equal(view.accepted.length,1);
});

test('secondary buttons and nonprimary touch/pen releases cannot execute commands',()=>{
  for(const type of ['touch','pen'])for(const extra of [{isPrimary:false},{button:2}]){const view=fixture({execute:false}),target=button('start');view.down(target,1,type,extra);
    assert.equal(view.up(target,1,type,extra),false);assert.equal(view.accepted.length,0);assert.equal(view.input.suppressClick(nativeClick(target)),true);}
});

test('all downs participate in multi-touch cancellation in both map/button orders',()=>{
  for(const buttonFirst of [true,false]){const view=fixture({execute:false}),target=button('start'),first=buttonFirst?target:outside,second=buttonFirst?outside:target;
    view.down(first,1);view.down(second,2,'touch',{isPrimary:false});view.hit(target);
    assert.equal(view.up(first,1),false);assert.equal(view.up(second,2,'touch',{isPrimary:false}),false);
    assert.equal(view.accepted.length,0);assert.equal(view.input.suppressClick(nativeClick(target)),true);}
  const view=fixture({execute:false}),first=button('start'),second=button('remove');view.down(first,1);view.down(second,2);view.hit(second);
  assert.equal(view.up(second,2),false);view.hit(first);assert.equal(view.up(first,1),false);assert.equal(view.accepted.length,0);
});

test('repeated real taps remain executable without a debounce; each compatibility click is consumed',()=>{
  const view=fixture({execute:false}),target=button('pause');
  for(let index=0;index<40;index++){view.advance(50);assert.equal(view.tap(target,index+1,index%2?'pen':'touch'),true);
    assert.equal(view.input.suppressClick(nativeClick(target)),true);assert.equal(view.input.suppressClick(nativeClick(outside)),true);}
  assert.equal(view.accepted.length,40);assert.ok(view.input.releases.length<=32);
});

test('keyboard/AT and mouse clicks after an actual mouse press stay native; WebKit compatibility mouse labels do not bypass suppression',()=>{
  const view=fixture({execute:false}),target=button('start');assert.equal(view.tap(target),true);
  for(const event of [nativeClick(target,{detail:0}),nativeClick(target,{sourceCapabilities:{firesTouchEvents:false}})])assert.equal(view.input.suppressClick(event),false);
  assert.equal(view.input.suppressClick(nativeClick(target,{pointerType:'mouse'})),true,'A compatibility click may advertise mouse without a physical mouse press');
  assert.equal(view.down(target,2,'mouse'),false);assert.equal(view.up(target,2,'mouse'),false);assert.equal(view.input.suppressClick(nativeClick(target)),false);
  assert.equal(view.accepted.length,1);
});

test('suppression is bounded to the released position and time, and does not prevent press defaults',()=>{
  const view=fixture({execute:false}),target=button('start');let prevented=0;view.input.start({...pointer(target),preventDefault(){prevented++;}});view.hit(target);view.up(target);
  assert.equal(prevented,0);assert.equal(view.input.suppressClick(nativeClick(target,{clientX:130})),false);
  assert.equal(view.input.suppressClick(nativeClick(target,{clientX:NaN})),false);assert.equal(view.input.suppressClick(nativeClick(target,{clientX:undefined})),false);
  view.advance(800);assert.equal(view.input.suppressClick(nativeClick(target)),false);
});

test('draw cards and recipe map badges retain their own handlers but still block a second button finger',()=>{
  for(const excluded of [button('draw',{index:'0'}),Object.assign(button('keep'),{mapBadge:true})]){
    const view=fixture({execute:false});assert.equal(view.tap(excluded),false);assert.equal(view.input.suppressClick(nativeClick(excluded)),false);assert.equal(view.accepted.length,0);
    view.down(excluded,2);const ordinary=button('start');view.down(ordinary,3);view.hit(ordinary);assert.equal(view.up(ordinary,3),false);view.up(excluded,2);
    assert.equal(view.accepted.length,0);assert.equal(view.input.suppressClick(nativeClick(ordinary)),true);
  }
});

test('identity capture can deny activation; capture/validation callbacks do not roll or mutate the Game',()=>{
  const game=ready(),control=ready(),target=button('start');let captured=0,validated=0,activated=0;
  const input=new CommandPointerInput({hitTest:()=>target,captureIdentity(){captured++;return null;},validateIdentity(){validated++;return true;},activate(){activated++;}});
  input.start(pointer(target));assert.equal(input.end(pointer(target)),false);assert.equal(captured,1);assert.equal(validated,0);assert.equal(activated,0);
  assert.equal(game.rng(),control.rng());
});
