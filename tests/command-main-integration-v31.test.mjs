import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {CommandPointerInput} from '../ui/command-pointer-input.js';
import {PhaseUiState,endedPhase} from '../ui/phase-ui.js';
import {defenderPanelMarkup} from '../ui/defender-panel.js';
import {DefenderRankPreview} from '../ui/defender-rank-preview.js';
import {icon} from '../ui/icons.js';
import {PreparationRecipeNavigation} from '../ui/preparation-recipe-navigation.js';

const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8'),noop=()=>{};
const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
const between=(start,end)=>{const first=main.indexOf(start);assert.ok(first>=0,start);const last=main.indexOf(end,first);assert.ok(last>first,end);return main.slice(first,last);};
function declaration(name){const first=main.indexOf(`function ${name}(`);assert.ok(first>=0,name);const rest=main.slice(first),next=/\nfunction /.exec(rest);return rest.slice(0,next?.index??rest.length);}
class Surface{
  constructor(parent=null){this.parent=parent;this.listeners=new Map();}
  addEventListener(type,callback,options=false){const capture=options===true||!!options.capture;const list=this.listeners.get(type)||[];list.push({callback,capture,options});this.listeners.set(type,list);}
}
class Element extends Surface{
  constructor(tag,document,parent=null){super(parent);this.ownerDocument=document;this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.className='';this.hidden=false;this.disabled=false;this.scrollTop=0;this._html='';this.isContentEditable=false;}
  get isConnected(){return !!this.parent?.isConnected;}
  append(child){child.parent=this;this.children.push(child);}
  closest(selector){
    const matches=selector==='button[data-action]'?this.tagName==='BUTTON'&&this.dataset.action:selector==='[data-action]'?this.dataset.action:
      selector==='.recipe-map-badge'?this.className.split(/\s+/).includes('recipe-map-badge'):
      selector==='[hidden],[inert],[aria-hidden="true"]'?this.hidden||this.inert||this.ariaHidden:false;
    return matches?this:this.parent?.closest?.(selector)||null;
  }
  getClientRects(){return this.hidden?[]:[{width:44,height:44}];}
  matches(selector){return selector===':disabled'&&this.disabled;}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  set innerHTML(html){
    this._html=html;for(const child of this.children)child.parent=null;this.children=[];
    for(const match of html.matchAll(/<button\b([^>]*)>[\s\S]*?<\/button>/g)){
      const child=new Element('button',this.ownerDocument);for(const attribute of match[1].matchAll(/([\w-]+)="([^"]*)"/g)){
        if(attribute[1].startsWith('data-'))child.dataset[attribute[1].slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=attribute[2];
        if(attribute[1]==='class')child.className=attribute[2];
      }child.disabled=/\bdisabled\b/.test(match[1]);this.append(child);
    }
  }
  get innerHTML(){return this._html;}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(selector==='[data-action]'&&child.dataset.action?[child]:[]),...child.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll('[data-action]').find(child=>selector.includes(`data-action="${child.dataset.action}"`))||null;}
  addEventListener(...args){super.addEventListener(...args);}
  focus(){this.ownerDocument.activeElement=this;}
}
function dispatch(target,type,fields={}){
  const event={target,type,detail:1,clientX:100,clientY:100,defaultPrevented:false,propagationStopped:false,immediateStopped:false,
    preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.propagationStopped=true;},stopImmediatePropagation(){this.immediateStopped=true;this.propagationStopped=true;},...fields};
  const path=[];for(let node=target;node;node=node.parent)path.push(node);
  for(const node of [...path].reverse()){
    for(const listener of node.listeners.get(type)||[]){if(!listener.capture)continue;listener.callback(event);if(event.immediateStopped)break;}
    if(event.propagationStopped)return event;
  }
  for(const node of path){for(const listener of node.listeners.get(type)||[]){if(listener.capture)continue;listener.callback(event);if(event.immediateStopped)break;}if(event.propagationStopped)break;}
  return event;
}
const physical=(pointerId=1,pointerType='touch',extra={})=>({pointerId,pointerType,isPrimary:true,button:0,clientX:100,clientY:100,...extra});
function ready(){const game=new Game(data,{seed:883});for(let index=0;index<5;index++){game.draft.roundForced={family:['cleric','druid','soldier','mage','archer'][index],tier:1};assert.equal(game.place(3+index,3),true);}game.draft.roundForced=null;game.select(game.towers[0].id);assert.equal(game.keep(),true);return game;}
function fixture(){
  const game=ready(),window=new Surface(),document=new Surface(window);document.isConnected=true;document.hidden=false;document.querySelector=()=>null;document.defaultView={getComputedStyle:()=>({display:'block',visibility:'visible'})};
  const app=new Element('div',document,document),canvas=new Element('canvas',document,app),nodes=new Map();let hit=null,renders=0,canvasClicks=0,functions;
  document.elementFromPoint=()=>hit;document.activeElement=app;document.getElementById=id=>nodes.get(id)||null;
  for(const id of ['side-top','side-body','map-start'])nodes.set(id,new Element('div',document,app));
  const start=new Element('button',document,nodes.get('map-start'));start.dataset.action='start';nodes.set('start-wave',start);nodes.get('map-start').append(start);
  const phaseUi=new PhaseUiState(),world={maze:{editing:false},doubleTap:{clear:noop},keys:new Set(),resize:noop};
  const profile={bestScore:0,bestWave:0,wins:0,discoveries:[]},waves=[],audio={unlock:noop,play:noop,resetRun:noop,syncGameState:noop};
  nodes.set('dialog',{open:false});nodes.set('header-combat-controls',new Element('div',document,app));
  const render=()=>{renders++;phaseUi.sync(game);functions.renderSidebar();functions.renderMapAction();};
  const bindings={game,app,window,document,world,phaseUi,CommandPointerInput,audio,updateHeaderCombatControls:(host,game)=>{host.dataset.paused=String(game.paused);host.dataset.speed=String(game.speed);},data,images:{ruin:'approved-wall.png'},icon,endedPhase,
    rankPreview:new DefenderRankPreview(),preparationNavigation:new PreparationRecipeNavigation(),folioRecipeId:null,folioRecipeSelection:null,folioLayout:{restoreParts:noop},syncFolio:noop,defenderPanelMarkup,dpsMeasurement:{view:()=>({rows:[]}),startWave:round=>waves.push(round),completeWave:noop},dpsTracker:{reset:noop,recordHit:noop},
    draftCardActivation:{clear:noop},draftPointerInput:{click:noop},debug:false,codex:noop,warbands:noop,help:noop,closeDialog:noop,cancelRecipePreview:noop,debugPanel:noop,render,
    $:id=>nodes.get(id)||null,panelDetails:new Map(),stampCraftButtons:noop,combatPanel:()=>'<p>Actual combat panel boundary</p>',tutorial:()=>'<p>Construction boundary</p>',
    resultFacts:{event:noop},guidance:{event:noop},profile,statistics:{tracker:{id:'listener-fixture',version:'0.3.31'}},saveProfile:noop,recordRunResult:noop,showResult:noop,notice:noop,towers:data.towers,balance:data.balance};
  bindings.tour={refresh:noop};
  const subscriber=main.split('\n').find(line=>line.trimStart().startsWith('game.on((type,payload)=>{'));assert.ok(subscriber,'Actual main subscriber exists');
  const keyboard=main.split('\n').find(line=>line.startsWith("window.addEventListener('keydown',e=>{if(e.key==='Escape'"));assert.ok(keyboard,'Actual keyboard listener exists');
  const commands=between('function handleCommand(','function commandPointerIdentity(');
  const wiring=between('function commandPointerIdentity(',"function toggleWorld(");
  const startup=between('function startGame(','\ntry{');
  const compiled=[declaration('sendWave'),declaration('combatTransport'),declaration('mainAction'),declaration('towerPanel'),declaration('renderSidebar'),declaration('renderMapAction'),commands,wiring,keyboard,startup,
    `let dpsWave=null;${subscriber}\nreturn {handleCommand,renderSidebar,renderMapAction,startGame,commandPointerInput,replaceGame(next){game=next;}};`].join('\n');
  functions=Function(...Object.keys(bindings),compiled)(...Object.values(bindings));render();
  // A target-side trap deliberately mutates real construction state if a
  // retargeted ghost click escapes the production capture listener.
  canvas.addEventListener('click',()=>{canvasClicks++;game.place(20,20);});
  return {game,window,document,app,canvas,start,nodes,functions,audio,waves,get renders(){return renders;},get canvasClicks(){return canvasClicks;},
    hit(target){hit=target;},refresh:render,button(action){const element=new Element('button',document,app);element.dataset.action=action;return element;},
    down(target,id=1,type='touch',extra={}){hit=target;return dispatch(target,'pointerdown',physical(id,type,extra));},
    up(target,id=1,type='touch',extra={}){return dispatch(target,'pointerup',physical(id,type,extra));},
    click(target,extra={}){return dispatch(target,'click',{detail:1,...extra});}};
}

test('production window capture bindings start the actual wave with one touch/pen release and no click',()=>{
  for(const type of ['touch','pen']){const view=fixture();for(const event of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])assert.ok(view.window.listeners.get(event).some(listener=>listener.capture),event);
    const down=view.down(view.start,1,type);assert.equal(down.defaultPrevented,false);view.up(view.start,1,type);
    assert.equal(view.game.phase,'combat');assert.deepEqual(view.waves,[1]);assert.equal(view.nodes.get('map-start').hidden,true);assert.ok(view.renders>=2);
    const ghost=view.click(view.canvas,{pointerType:type});assert.equal(ghost.defaultPrevented,true);assert.equal(ghost.immediateStopped,true);assert.equal(view.canvasClicks,0);assert.deepEqual(view.waves,[1]);}
});

test('actual sidebar rerender replaces the wall button during a press and the unchanged release demolishes once',()=>{
  const view=fixture(),wall=view.game.towers.find(t=>t.state==='ruin');view.game.select(wall.id);const original=view.nodes.get('side-body').querySelectorAll('[data-action]').find(button=>button.dataset.action==='remove');assert.ok(original);
  view.down(original);view.refresh();const replacement=view.nodes.get('side-body').querySelectorAll('[data-action]').find(button=>button.dataset.action==='remove');assert.notEqual(replacement,original);assert.equal(original.isConnected,false);
  view.hit(replacement);view.up(view.canvas);assert.equal(view.game.towers.includes(wall),false);assert.equal(view.game.selected,null);
  assert.equal(view.click(view.canvas).immediateStopped,true);assert.equal(view.canvasClicks,0);
});

test('production capture suppression prevents ghost canvas placement even after the actual next draft opens',()=>{
  const view=fixture();view.down(view.start);view.up(view.start);view.game.completeWave();assert.equal(view.game.phase,'build');assert.equal(view.game.round,2);const count=view.game.towers.length,placements=view.game.draft.draws.filter(draw=>draw.placed).length;
  const ghost=view.click(view.canvas);assert.equal(ghost.defaultPrevented,true);assert.equal(ghost.immediateStopped,true);assert.equal(view.canvasClicks,0);
  assert.equal(view.game.towers.length,count);assert.equal(view.game.draft.draws.filter(draw=>draw.placed).length,placements);
  view.down(view.canvas,2,'mouse');view.click(view.canvas,{pointerType:'mouse'});assert.equal(view.canvasClicks,1);assert.equal(view.game.towers.length,count+1,'The trap really can place through the actual core when a genuine mouse click reaches it');
});

test('actual root identity rejects changed selected walls and a replaced Game with reused IDs',()=>{
  const view=fixture(),walls=view.game.towers.filter(t=>t.state==='ruin');view.game.select(walls[0].id);const original=view.nodes.get('side-body').querySelectorAll('[data-action]').find(button=>button.dataset.action==='remove');view.down(original);
  view.game.select(walls[1].id);const replacement=view.nodes.get('side-body').querySelectorAll('[data-action]').find(button=>button.dataset.action==='remove');view.hit(replacement);view.up(view.canvas);
  assert.equal(view.game.selection,walls[1]);assert.ok(walls.every(wall=>view.game.towers.includes(wall)));assert.equal(view.click(replacement).immediateStopped,true);
  const second=fixture();second.down(second.start);const next=ready();second.functions.replaceGame(next);second.up(second.start);assert.equal(next.phase,'ready');assert.equal(second.game.phase,'ready');assert.equal(second.click(second.start).immediateStopped,true);
});

test('actual keydown guard leaves focused-button Space to one native keyboard/AT click',()=>{
  const view=fixture();view.down(view.start);view.up(view.start);const pause=view.button('pause');view.document.activeElement=pause;
  const before=view.renders;const key=dispatch(pause,'keydown',{key:' ',ctrlKey:false,metaKey:false,altKey:false,repeat:false});assert.equal(key.defaultPrevented,false);assert.equal(view.game.paused,false);
  const activation=view.click(pause,{detail:0});assert.equal(activation.defaultPrevented,false);assert.equal(activation.immediateStopped,false);assert.equal(view.game.paused,true);assert.equal(view.renders,before,'Transport commands update the mounted controls without rebuilding the folio');
  view.down(pause,2,'mouse');view.up(pause,2,'mouse');view.click(pause,{pointerType:'mouse'});assert.equal(view.game.paused,false,'Actual native mouse remains executable once');
});

test('production cancellation listeners clear pending commands for scroll, wheel, blur, hidden documents and restart',()=>{
  for(const type of ['scroll','wheel','blur','visibilitychange','restart']){const view=fixture();view.down(view.start);
    if(type==='visibilitychange'){view.document.hidden=true;dispatch(view.document,type);}
    else if(type==='restart'){const sentinel=new Error('Stop before unrelated asset/session setup');view.audio.resetRun=()=>{throw sentinel;};assert.throws(()=>view.functions.startGame(),error=>error===sentinel);}
    else dispatch(view.window,type);
    view.up(view.start);assert.equal(view.game.phase,'ready',type);assert.deepEqual(view.waves,[],type);assert.equal(view.click(view.start).immediateStopped,true,type);
  }
});

test('window capture observes a stopped external canvas touch before another primary pen presses Start',()=>{
  const view=fixture();view.canvas.addEventListener('pointerdown',event=>event.stopImmediatePropagation());
  view.down(view.canvas,1,'touch');view.down(view.start,2,'pen');view.hit(view.start);view.up(view.start,2,'pen');view.up(view.canvas,1,'touch');
  assert.equal(view.game.phase,'ready');assert.deepEqual(view.waves,[]);assert.equal(view.click(view.start).immediateStopped,true);
});

test('a held Pause or Speed command cannot reverse a newer keyboard action before release',()=>{
  for(const action of ['pause','speed']){const view=fixture();view.down(view.start);view.up(view.start);const target=view.button(action);view.down(target,2);
    view.click(target,{detail:0});const expected={paused:view.game.paused,speed:view.game.speed};view.hit(target);view.up(target,2);
    assert.deepEqual({paused:view.game.paused,speed:view.game.speed},expected,'Changed command transport state must invalidate the old press');
  }
});

test('a held unit Pause cannot reverse an actual unit pause changed after the press',()=>{
  const view=fixture();view.down(view.start);view.up(view.start);const keeper=view.game.towers.find(t=>t.state==='active');view.game.select(keeper.id);
  const original=view.nodes.get('side-body').querySelectorAll('[data-action]').find(button=>button.dataset.action==='tower-pause');assert.ok(original);view.down(original,2);
  assert.equal(view.game.setTowerAttackPaused(keeper.id,true),true);const replacement=view.nodes.get('side-body').querySelectorAll('[data-action]').find(button=>button.dataset.action==='tower-pause');view.hit(replacement);view.up(view.canvas,2);
  assert.equal(keeper.attackPaused,true,'The old press cannot resume a newer actual pause');assert.equal(view.click(replacement).immediateStopped,true);
});

test('rapid touch/pen transport releases consume WebKit mouse-labelled compatibility clicks and follow the full fixed speed cycle',()=>{
  const view=fixture();view.down(view.start);view.up(view.start);const speed=view.button('speed'),pause=view.button('pause'),control=ready();control.startCombat();
  const before=view.renders;let pointerId=2;
  for(let index=0;index<40;index++){
    const type=index%2?'pen':'touch',expected=[2,3,5,1][index%4];
    view.down(speed,pointerId,type);view.up(speed,pointerId++,type);
    assert.equal(view.game.speed,expected);assert.equal(view.nodes.get('header-combat-controls').dataset.speed,String(expected));
    assert.equal(view.click(speed,{pointerType:'mouse'}).immediateStopped,true);assert.equal(view.game.speed,expected,'The delayed mouse label cannot execute a second speed change');
    view.down(pause,pointerId,type);view.up(pause,pointerId++,type);const paused=view.game.paused;
    assert.equal(view.click(pause,{pointerType:'mouse'}).immediateStopped,true);assert.equal(view.game.paused,paused);
  }
  assert.equal(view.renders,before,'Eighty accepted transport commands do not rebuild or resize the battlefield');
  assert.equal(view.game.rng(),control.rng(),'Transport and compatibility suppression do not consume gameplay randomness');
});

test('combat transport survives unrelated selection refreshes but revalidates its own value and current round',()=>{
  const view=fixture();view.down(view.start);view.up(view.start);const speed=view.button('speed'),keeper=view.game.towers.find(t=>t.state==='active');
  view.game.select(keeper.id);view.down(speed,2);view.game.select(null);const renders=view.renders;view.hit(speed);view.up(speed,2);
  assert.equal(view.game.speed,2,'A selection refresh cannot discard an otherwise valid speed tap');assert.equal(view.renders,renders);
  view.down(speed,3);const pause=view.button('pause');view.click(pause,{detail:0});view.hit(speed);view.up(speed,3);
  assert.equal(view.game.speed,3,'Pause is independent of an unchanged held speed value');assert.equal(view.game.paused,true);
  view.down(speed,4);view.game.completeWave();view.hit(speed);view.up(speed,4);assert.equal(view.game.speed,3,'A completed wave invalidates an old transport press');
});
