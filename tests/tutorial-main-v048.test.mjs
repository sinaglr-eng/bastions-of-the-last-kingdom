import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {icon} from '../ui/icons.js';
import {TutorialInvitation,tutorialInvitationMarkup,tutorialFocusTarget} from '../ui/tutorial.js';
import {ContextGuidance,guidanceSeen} from '../ui/context-guidance.js';
import {PhaseUiState} from '../ui/phase-ui.js';
import {RunResultFacts} from '../ui/run-results.js';
import {TowerDpsTracker} from '../game/core/tower-dps.js';
import {DpsMeasurement} from '../ui/dps-measurement.js';

const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const noop=()=>{};
function between(start,end){const first=main.indexOf(start),last=main.indexOf(end,first);assert.ok(first>=0&&last>first);return main.slice(first,last);}
function declaration(name){const rest=main.slice(main.indexOf(`function ${name}(`)),end=/\nfunction /.exec(rest);assert.ok(rest.startsWith(`function ${name}(`));return rest.slice(0,end?.index??rest.length);}
function fixture(tutorialDecision='complete'){
  const profile={tutorialDecision,discoveries:[],guidanceSeen:[],bestScore:0,bestWave:0,wins:0},saved=[],dialogListeners=new Map(),app={dataset:{}},worlds=[];
  let renders=0,focused=0,records=0;
  const startButton={focus(){focused++;}},content={innerHTML:'',querySelector:()=>startButton},dialog={open:false,shows:0,addEventListener:(type,callback)=>dialogListeners.set(type,callback),showModal(){this.open=true;this.shows++;},close(){this.open=false;dialogListeners.get('close')?.();}};
  const battlefield={replaceChildren:noop},$=id=>id==='dialog'?dialog:id==='dialog-content'?content:battlefield;
  const document={querySelector:()=>({classList:{toggle:noop},setAttribute:noop})};
  class Battlefield{constructor(_container,game,place){this.game=game;this.place=place;this.keys=new Set();this.doubleTap={clear:noop};this.maze={panel:{addEventListener:noop}};this.disposed=false;worlds.push(this);}loadAssets(){}dispose(){this.disposed=true;}clearPointer(){this.pointerCleared=true;}}
  class StatisticsClient{constructor(){this.tracker={id:'local-test-only',version:'0.4.8'};}checkpoint(){}dispose(){}}
  class GuidedTutorial{constructor(options){this.options=options;this.active=false;this.starts=[];this.finishes=[];}start(game){this.active=true;this.starts.push(game);return true;}finish(value={reason:'skipped'}){this.finishes.push(value);if(this.active){this.active=false;this.options.onFinish({...value,completed:value.reason==='complete'});}}refresh(){}}
  const bindings={sendWave:noop,codex:noop,warbands:noop,help:noop,debugPanel:noop,icon,data,waves:data.waves,towers:data.towers,profile,app,$,document,TutorialInvitation,tutorialInvitationMarkup,tutorialFocusTarget,GuidedTutorial,Game,PhaseUiState,ContextGuidance,guidanceSeen,RunResultFacts,TowerDpsTracker,DpsMeasurement,Battlefield,StatisticsClient,
    WaveThreatAnalyzer:class{},ArmyReadiness:class{},Date:{now:()=>48},debug:false,params:new URLSearchParams(),audio:{unlock:noop,resetRun:noop,cancelSelectionVoice:noop,play:noop},commandPointerInput:{clear:noop},rankPreview:{clear:noop},preparationNavigation:{clear:noop},draftPointerInput:{clear:noop},draftCardActivation:{clear:noop},
    recipeNavigation:{history:[],index:-1},panelDetails:new Map(),saveProfile:value=>saved.push(structuredClone(value)),recordRunResult(){records++;},stampCraftButtons:noop,render(){renders++;},cellKey:(x,z)=>`${x},${z}`,notice:noop,showResult:noop};
  const prefix='let game=null,world=null,statistics=null,gameProfileBaseline=null,phaseUi,threatAnalyzer,armyReadiness,intelligenceKey,previous,dpsTracker,dpsMeasurement,dpsWave,resultFacts,guidance,developerConnection=null,developerSession=null,recipeFilterConnection=null,recipeFocus,folioRecipeId,folioRecipeSelection,previewPrevious,modalPaused=false;';
  const tutorialBlock=between('const tutorialInvitation=','function quality('),startup=between('function startGame(','\ntry{');
  const functions=Function(...Object.keys(bindings),`${prefix}\n${tutorialBlock}\n${declaration('openDialog')}\n${declaration('closeDialog')}\n${declaration('dialogHeader')}\n${declaration('handleCommand')}\n${startup}\nreturn {startGame,startTutorial,skipTutorial,offerTutorial,tour,handleCommand,get game(){return game;},get world(){return world;},get invitation(){return tutorialInvitation;}};`)(...Object.values(bindings));
  return {functions,profile,saved,dialog,dialogListeners,content,worlds,get renders(){return renders;},get focused(){return focused;},get records(){return records;},click(action){functions.handleCommand({target:{closest:()=>({disabled:false,dataset:{action}})},detail:1});}};
}
const gameState=game=>JSON.stringify({draws:game.draft.draws,towers:game.towers,phase:game.phase,round:game.round,speed:game.speed,cp:game.commandPoints.value,gold:game.economy.gold,clock:game.elapsedSeconds});

test('actual startGame offers a focused Start/Skip dialog at every fresh run and never reads tutorialDecision to suppress it',()=>{
  for(const old of ['accepted','skipped','complete']){const h=fixture(old);h.functions.startGame();const first=h.functions.game,control=new Game(data,{seed:48});
    assert.equal(h.dialog.open,true);assert.equal(h.dialog.shows,1);assert.match(h.content.innerHTML,/Start tutorial/);assert.match(h.content.innerHTML,/Skip tutorial/);assert.equal(h.focused,1);assert.equal(h.functions.invitation.pending,true);assert.equal(h.profile.tutorialDecision,old,'merely offering the choice changes no saved preference');
    assert.equal(gameState(first),gameState(control));assert.equal(first.rng(),control.rng(),'offering onboarding consumes no random draw');
    h.click('tutorial-skip');assert.equal(h.dialog.open,false);assert.equal(first.paused,false);assert.equal(h.profile.tutorialDecision,'skipped');assert.equal(h.functions.tour.starts.length,0);
    h.functions.startGame();assert.notEqual(h.functions.game,first);assert.equal(h.worlds[0].disposed,true);assert.equal(h.dialog.open,true);assert.equal(h.dialog.shows,2);assert.equal(h.focused,2);assert.equal(h.functions.invitation.pending,true);assert.equal(h.records,1);
    h.functions.offerTutorial();assert.equal(h.dialog.shows,2,'ordinary refreshes cannot open a second invitation for the same Game');
  }
});

test('actual Start and Escape/Skip choices close the modal, restore pause and keep a replay or reset separate from completion',()=>{
  const h=fixture('skipped');h.functions.startGame();const game=h.functions.game,before=gameState(game);h.functions.world.keys.add('w');
  h.click('tutorial-start');assert.equal(h.dialog.open,false);assert.equal(game.paused,false);assert.equal(h.functions.world.keys.size,0);assert.equal(h.functions.world.pointerCleared,true);assert.deepEqual(h.functions.tour.starts,[game]);assert.equal(h.profile.tutorialDecision,'accepted');assert.equal(gameState(game),before);
  h.functions.startGame();assert.equal(h.functions.tour.active,false);assert.equal(h.profile.tutorialDecision,'accepted','reset cannot mark the previous guide completed');assert.equal(h.functions.tour.finishes.at(-1).reason,'reset');assert.equal(h.dialog.open,true);
  let prevented=0;h.dialogListeners.get('cancel')({preventDefault(){prevented++;}});assert.equal(prevented,1);assert.equal(h.dialog.open,false);assert.equal(h.functions.game.paused,false);assert.equal(h.functions.invitation.pending,false);assert.equal(h.profile.tutorialDecision,'skipped');
  h.dialogListeners.get('cancel')({preventDefault(){prevented++;}});assert.equal(prevented,1,'unrelated book Escape follows its native close behavior');
  h.functions.startTutorial();assert.equal(h.functions.tour.starts.length,2,'Help replay can begin after the invitation was skipped');
  h.functions.tour.finish({reason:'complete'});assert.equal(h.profile.tutorialDecision,'complete');
});

test('actual main tutorial hooks open the existing maze picker and read the current world after a new run',()=>{
  const h=fixture();h.functions.startGame();h.click('tutorial-start');const first=h.functions.world.maze,options=h.functions.tour.options;
  assert.strictEqual(options.getMaze(),first);assert.equal(typeof options.openMaze,'function');
  let opened=0;const calls=[];first.editing=false;first.panelOpen=false;first.togglePanel=()=>{first.panelOpen=!first.panelOpen;opened++;};
  const phaseUi={open:value=>calls.push(value),close:()=>calls.push('close')};
  const invoke=Function('game','world','phaseUi','syncInspector',`${declaration('toggleMazePanel')};return ${options.openMaze.toString()};`)(h.functions.game,h.functions.world,phaseUi,noop);
  const before=gameState(h.functions.game);invoke();assert.equal(opened,1);assert.equal(first.panelOpen,true);assert.deepEqual(calls,['maze']);assert.equal(gameState(h.functions.game),before);invoke();assert.equal(opened,1,'opening an already visible panel does not close it');
  first.panelOpen=false;first.editing=true;invoke();assert.equal(opened,1,'the guide leaves blueprint editing intact');
  h.functions.startGame();assert.notStrictEqual(options.getMaze(),first);assert.strictEqual(options.getMaze(),h.functions.world.maze,'the callback never retains a disposed world');
});

test('actual tutorial replay refuses blueprint editing with a visible explanation and preserves the unsaved plan',()=>{
  const h=fixture('skipped');h.functions.startGame();h.click('tutorial-skip');const game=h.functions.game,maze=h.functions.world.maze;
  maze.editing=true;maze.cells=[{x:6,z:4},{x:7,z:4}];maze.history=[['add',6,4],['add',7,4]];
  const plan=JSON.stringify(maze),before=gameState(game),focused=h.focused;
  assert.equal(h.functions.startTutorial(),false);assert.equal(h.dialog.open,true);assert.match(h.content.innerHTML,/Finish blueprint editing first/);assert.match(h.content.innerHTML,/Your unsaved blueprint is unchanged/);assert.match(h.content.innerHTML,/data-action="close">Return to blueprint/);
  assert.equal(h.functions.tour.starts.length,0);assert.equal(h.profile.tutorialDecision,'skipped');assert.equal(JSON.stringify(maze),plan);assert.equal(gameState(game),before);assert.equal(h.focused,focused+1,'the return control receives modal focus');
  h.click('close');assert.equal(h.dialog.open,false);assert.equal(game.paused,false);assert.equal(maze.editing,true);assert.equal(JSON.stringify(maze),plan);
});

test('actual replay cancels an uncommitted Move without spending CP or moving a defender before the guide starts',()=>{
  const h=fixture('skipped');h.functions.startGame();h.click('tutorial-skip');const game=h.functions.game,control=new Game(data,{seed:48});
  for(const run of [game,control]){for(let slot=0;slot<5;slot++)assert.equal(run.place(3+slot,3),true);assert.equal(run.keep(),true);assert.equal(run.beginMove(),true);}
  const before=gameState(game),points=game.commandPoints.value;assert.equal(game.commandMove.active,true);
  assert.equal(h.functions.startTutorial(),true);assert.equal(game.commandMove.active,false);assert.equal(game.commandPoints.value,points);assert.equal(gameState(game),before);assert.equal(h.functions.tour.starts.at(-1),game);assert.equal(control.cancelMove(),true);assert.equal(game.rng(),control.rng());
});

test('actual developer setup replacement preserves its transport and avoids a normal-run welcome prompt',()=>{
  const h=fixture(),replacement=new Game(data,{seed:991});replacement.developerMode=true;replacement.paused=true;replacement.speed=5;
  const before=gameState(replacement);h.functions.startGame({replacement,preserveDeveloperSession:true});assert.equal(h.functions.game,replacement);assert.equal(h.dialog.open,false);assert.equal(h.dialog.shows,0);assert.equal(replacement.paused,true);assert.equal(gameState(replacement),before);
});

test('actual gameplay keyboard guard leaves Space and movement keys on tutorial card and native tutorial buttons',()=>{
  const line=main.split('\n').find(value=>value.startsWith("window.addEventListener('keydown',e=>{if(e.key==='Escape'"));assert.ok(line);
  const listeners=new Map(),world={keys:new Set(),maze:{editing:false}},game=new Game(data);game.phase='combat';let commands=0,unlocks=0,prevented=0;
  const document={activeElement:{tagName:'SECTION',isContentEditable:false,closest:selector=>selector==='.tutorial-card'?{}:null}},window={addEventListener:(type,callback)=>listeners.set(type,callback)};
  Function('window','document','world','game','phaseUi','$','audio','mainAction',line)(window,document,world,game,{inspectorOpen:false},()=>({open:false}),{unlock(){unlocks++;}},()=>commands++);
  for(const tagName of ['SECTION','BUTTON'])for(const key of [' ','ArrowDown','w','q','1']){document.activeElement.tagName=tagName;listeners.get('keydown')({key,preventDefault(){prevented++;}});}
  assert.equal(commands,0);assert.equal(unlocks,0);assert.equal(prevented,0);assert.equal(world.keys.size,0);
  document.activeElement={tagName:'BODY',isContentEditable:false,closest:()=>null};listeners.get('keydown')({key:' ',preventDefault(){prevented++;}});assert.equal(commands,1);assert.equal(unlocks,1);assert.equal(prevented,1);
});

test('tutorial exit focus skips hidden Ready controls and disabled combat buttons before returning to a visible recruit',()=>{
  const button=(visible,disabled=false,hidden=false)=>({disabled,getClientRects:()=>visible?[{}]:[],closest:()=>hidden?{}:null}),invisible=button(false),disabled=button(true,true),inert=button(true,false,true),recruit=button(true);
  assert.equal(tutorialFocusTarget({querySelectorAll:()=>[invisible,disabled,inert,recruit]}),recruit);assert.equal(tutorialFocusTarget({querySelectorAll:()=>[invisible,disabled,inert]}),null);
});
