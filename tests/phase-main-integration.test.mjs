import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {RunStatistics} from '../game/core/run-statistics.js';
import {DeveloperConsoleSession} from '../game/core/developer-console.js';
import {loadProfile,saveProfile,recordRunResult,excludeRunResult} from '../game/core/save.js';
import {PhaseUiState,phaseStripMarkup,endedPhase} from '../ui/phase-ui.js';
import {RunResultFacts,runResultModel,runResultMarkup,endedRunReviewMarkup} from '../ui/run-results.js';
import {ContextGuidance} from '../ui/context-guidance.js';
import {draftCardsMarkup} from '../ui/draft-cards.js';
import {commandPointsMarkup} from '../ui/command-points.js';
import {DpsMeasurement} from '../ui/dps-measurement.js';
import {TowerDpsTracker} from '../game/core/tower-dps.js';
import {DefenderRankPreview} from '../ui/defender-rank-preview.js';
import {defenderPanelMarkup} from '../ui/defender-panel.js';
import {selectedEnemyMarkup} from '../ui/selected-enemy.js';
import {icon} from '../ui/icons.js';

const source=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const noop=()=>{};
function declaration(name){
  const match=new RegExp(`(?:async )?function ${name}\\(`).exec(source);assert.ok(match,`Actual main ${name} is available`);
  const rest=source.slice(match.index),next=/\n(?:async )?function /.exec(rest);return rest.slice(0,next?.index??rest.length);
}
function compile(names,bindings,prefix='',suffix=''){
  return Function(...Object.keys(bindings),prefix+'\n'+names.map(declaration).join('\n')+`\nreturn {${names.join(',')}${suffix}};`)(...Object.values(bindings));
}
function node(){return {dataset:{},innerHTML:'',textContent:'',hidden:false,scrollTop:0,contains:()=>false,querySelector:()=>null,querySelectorAll:()=>[],addEventListener:noop,replaceChildren(){this.innerHTML='';}};}
const inventory=game=>JSON.stringify({towers:game.towers,draws:game.draft.draws,lives:game.lives,score:game.score,cp:game.commandPoints.value,gold:game.economy.gold,occupied:[...game.grid.occupied]});
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};};
function kept(game){for(const x of [3,5,7,9,11])assert.equal(game.place(x,3),true);assert.equal(game.keep(),true);}
function commandBindings(game,phaseUi,app,world,extra={}){return {game,phaseUi,app,world,document:{querySelector:()=>null},audio:{unlock:noop},draftCardActivation:{clear:noop},draftPointerInput:{click:noop},debug:false,codex:noop,warbands:noop,help:noop,closeDialog:noop,debugPanel:noop,render:noop,sendWave:()=>game.startCombat(),syncInspector:()=>phaseUi.apply(app,game),...extra};}
function press(command,action,dataset={}){const button={disabled:false,dataset:{action,...dataset},closest(){return this;}};command({target:button,detail:1});}
function selectionIntent(game,phaseUi){
  const statement=source.match(/if\(type==='selection'&&payload\.id!==null\)phaseUi\.open\('unit'\);/)?.[0];assert.ok(statement,'Actual main explicitly opens map selections');
  const apply=Function('type','payload','phaseUi',statement);return game.on((type,payload)=>apply(type,payload,phaseUi));
}

test('actual main render and event wiring follow repeated draft, keeper, combat and pause transitions with five slots restored',()=>{
  const game=new Game(data,{seed:402,waveLimit:10}),phaseUi=new PhaseUiState(),app=node(),nodes=new Map(['phase-strip','draft','compact-draft-actions','folio-command-actions','map-start','start-wave'].map(id=>[id,node()])),world={maze:{panelOpen:false},resize:noop};
  const $=id=>nodes.get(id)||null,profile={bestScore:0,bestWave:0,wins:0},tracker=new RunStatistics(game,{id:'phase-transitions',clock:()=>100}),resultFacts=new RunResultFacts(),guidance=new ContextGuidance(),dpsTracker=new TowerDpsTracker(),dpsMeasurement=new DpsMeasurement();
  const bindings={game,phaseUi,app,$,document:{activeElement:null},world,phaseStripMarkup,draftCardsMarkup,commandPointsMarkup,icon,data,images:{},tour:{refresh:noop},stampCraftButtons:noop,renderIntelligence:noop,renderSidebar:noop,renderRecipeBrowser:noop,renderEconomy:noop,hud:()=>phaseUi.apply(app,game),syncFolio:noop,draftCardActivation:{clear:noop}};
  const functions=compile(['render','renderDraft','renderMapAction','sendWave'],bindings,'let mode=10,intelligenceKey=null;');
  // Execute the saved subscriber itself so selection intent, guidance and phase
  // updates have the same ordering as the running application.
  const eventLine=source.split('\n').find(line=>line.trimStart().startsWith('game.on((type,payload)=>{'));assert.ok(eventLine);
  Function(...Object.keys({...bindings,...functions,resultFacts,guidance,dpsTracker,dpsMeasurement,profile,statistics:{tracker},audio:{play:noop},notice:noop,towers:data.towers,balance:data.balance,saveProfile:noop,recordRunResult:noop,showResult:noop}),`let dpsWave=null;${eventLine}`)(...Object.values({...bindings,...functions,resultFacts,guidance,dpsTracker,dpsMeasurement,profile,statistics:{tracker},audio:{play:noop},notice:noop,towers:data.towers,balance:data.balance,saveProfile:noop,recordRunResult:noop,showResult:noop}));
  functions.render();assert.equal(app.dataset.phase,'build');assert.equal(app.dataset.draftExpanded,'true');assert.equal((nodes.get('draft').innerHTML.match(/class="draw-slot/g)||[]).length,5);
  for(let round=1;round<=3;round++){
    for(const x of [3,5,7,9,11])assert.equal(game.place(x,3+round*2),true);assert.equal(app.dataset.phase,'select');const tower=game.selection;
    game.select(tower.id);assert.equal(app.dataset.inspectorOpen,'true');phaseUi.close();functions.render();assert.equal(app.dataset.inspectorOpen,'false');game.select(tower.id);assert.equal(app.dataset.inspectorOpen,'true','Explicit same-ID activation reopens a dismissed inspector');
    assert.equal(game.keep(),true);assert.equal(app.dataset.phase,'ready');assert.equal(app.dataset.draftExpanded,'false');assert.equal(nodes.get('map-start').hidden,false);assert.match(nodes.get('start-wave').innerHTML,new RegExp('Start wave '+round));assert.doesNotMatch(nodes.get('phase-strip').innerHTML,/data-action="start"/);
    assert.equal(functions.sendWave(),true);assert.equal(game.selection,null);assert.equal(app.dataset.phase,'combat');assert.equal(app.dataset.inspectorOpen,'false');assert.equal(app.dataset.inspectorView,'unit');assert.equal(nodes.get('phase-strip').innerHTML,'');assert.equal(nodes.get('map-start').hidden,true);assert.equal(app.dataset.draftExpanded,'false');assert.equal(nodes.get('compact-draft-actions').hidden,true);assert.equal(nodes.get('folio-command-actions').innerHTML,'');
    const elapsed=game.combat.elapsed;game.paused=true;functions.render();game.tick(.5);assert.equal(game.combat.elapsed,elapsed);assert.equal(app.dataset.paused,'true');assert.equal(nodes.get('phase-strip').innerHTML,'');assert.equal(app.dataset.inspectorOpen,'false');
    game.paused=false;game.completeWave();assert.equal(game.round,round+1);assert.equal(app.dataset.phase,'build');assert.equal(app.dataset.draftExpanded,'true');assert.equal((nodes.get('draft').innerHTML.match(/Unrevealed defender\. Build/g)||[]).length,5);assert.equal(app.dataset.inspectorOpen,'false');
  }
  assert.equal(tracker.draws.length,15);assert.equal(tracker.decisions.filter(row=>row.action==='keep').length,3);tracker.dispose();
});

test('actual advanced-menu warning and Cancel preserve run eligibility; confirmation alone activates exclusion',async()=>{
  const previous=globalThis.localStorage;globalThis.localStorage=memory();const game=new Game(data,{seed:531,waveLimit:10}),phaseUi=new PhaseUiState(),app=node(),world={maze:{editing:false},doubleTap:{clear:noop}},profile=loadProfile(),baseline=structuredClone(profile);let disabled=0,dialog='',closed=0;
  const tracker=new RunStatistics(game,{id:'warning-current',clock:()=>100});game.score=345;recordRunResult(profile,game,{id:tracker.id});saveProfile(profile);const before=JSON.stringify(profile),menu={open:true},content={querySelector:()=>({insertAdjacentHTML:noop})};
  try{
    const bindings=commandBindings(game,phaseUi,app,world,{DeveloperConsoleSession,profile,gameProfileBaseline:baseline,statistics:{tracker,disableForDeveloper(){disabled++;game.developerMode=true;}},excludeRunResult,document:{querySelector:()=>menu},$:()=>content,dialogHeader:(label,title)=>`<h2>${title}</h2>`,openDialog:html=>dialog=html,closeDialog:()=>closed++,developerConsoleMarkup:()=>'<p>Console boundary</p>',connectDeveloperConsole:()=>({dispose:noop}),startGame:()=>{throw new Error('Activation must not reset the run');}});
    const functions=compile(['requestDeveloperConsole','openDeveloperConsole','handleCommand'],bindings,'let developerSession=null,developerConnection=null;',',get session(){return developerSession;}');
    const resources=inventory(game);press(functions.handleCommand,'developer');assert.equal(menu.open,false);assert.match(dialog,/permanently excludes this entire current run|earlier checkpoints/);assert.equal(game.developerMode,undefined);assert.equal(disabled,0);assert.equal(JSON.stringify(profile),before);assert.equal(inventory(game),resources);
    press(functions.handleCommand,'close');assert.equal(closed,1);assert.equal(disabled,0);assert.equal(JSON.stringify(loadProfile()),before);assert.equal(inventory(game),resources);
    press(functions.handleCommand,'developer');press(functions.handleCommand,'developer-confirm');await functions.session.activation;await new Promise(resolve=>setImmediate(resolve));assert.equal(disabled,1);assert.equal(game.developerMode,true);assert.ok(loadProfile().excludedRuns.includes(tracker.id));assert.equal(loadProfile().runHistory.some(row=>row.id===tracker.id),false);assert.equal(inventory(game),resources);assert.match(dialog,/Developer Console/);
    press(functions.handleCommand,'close');assert.equal(game.developerMode,true);assert.ok(loadProfile().excludedRuns.includes(tracker.id));functions.session.dispose();
  }finally{tracker.dispose();globalThis.localStorage=previous;}
});

test('actual Current-wave detail toggles independently of map-selected unit inspection and preserves combat resources',()=>{
  const game=new Game(data,{seed:733}),control=new Game(data,{seed:733});for(const run of [game,control]){kept(run);run.startCombat();}
  const phaseUi=new PhaseUiState(),app=node(),mapStart=node(),world={maze:{editing:false},doubleTap:{clear:noop},resize:noop};phaseUi.sync(game);phaseUi.apply(app,game);const keeper=game.towers.find(t=>t.state==='active'),before=inventory(game),stop=selectionIntent(game,phaseUi);
  app.querySelectorAll=selector=>{assert.equal(selector,'.phase-strip [data-action]');return [];};let sidebarView=null,recipeView=null;
  const bindings=commandBindings(game,phaseUi,app,world,{$:id=>id==='map-start'?mapStart:null,renderSidebar:()=>sidebarView=phaseUi.view,renderRecipeBrowser:()=>recipeView=phaseUi.view});delete bindings.syncInspector;
  const {handleCommand,syncInspector}=compile(['handleCommand','syncInspector'],bindings);assert.equal(app.dataset.inspectorView,'unit');assert.equal(app.dataset.inspectorOpen,'false');assert.equal(phaseStripMarkup(game,phaseUi),'');
  press(handleCommand,'inspect-wave');assert.equal(app.dataset.inspectorOpen,'true');assert.equal(app.dataset.inspectorView,'wave');press(handleCommand,'inspect-wave');assert.equal(app.dataset.inspectorOpen,'false');
  game.select(keeper.id);syncInspector();assert.equal(game.selection,keeper);assert.equal(app.dataset.inspectorView,'unit');assert.equal(app.dataset.inspectorOpen,'true');press(handleCommand,'inspector-close');assert.equal(app.dataset.inspectorOpen,'false');assert.equal(game.selection,keeper);
  game.select(keeper.id);syncInspector();assert.equal(app.dataset.inspectorOpen,'true','Explicit same-ID map selection reopens the inspector');press(handleCommand,'inspector-wave');assert.equal(app.dataset.inspectorView,'wave');assert.equal(game.selection,keeper);
  assert.equal(sidebarView,'wave');assert.equal(recipeView,'wave');press(handleCommand,'inspector-unit');assert.equal(sidebarView,'unit');assert.equal(app.dataset.inspectorOpen,'true');press(handleCommand,'inspector-close');assert.equal(app.dataset.inspectorOpen,'false');
  assert.equal(game.phase,'combat');assert.equal(game.paused,false);assert.equal(inventory(game),before);assert.equal(game.rng(),control.rng());stop();
});

test('actual result-review route presents ended facts and inspectors without construction guidance or executable unit controls',()=>{
  for(const outcome of ['won','lost']){
    const game=new Game(data,{seed:667,waveLimit:10});kept(game);const tower=game.selection;game.startCombat();const enemy=game.combat.spawn('host_01');game.end(outcome==='won');
    const phaseUi=new PhaseUiState(),app=node(),body=node(),top=node(),nodes=new Map([['side-body',body],['side-top',top]]),world={maze:{editing:false,sync:noop},doubleTap:{clear:noop},resize:noop},facts=new RunResultFacts();let resultCalls=0,closed=0;
    const bindings=commandBindings(game,phaseUi,app,world,{$:id=>nodes.get(id)||null,document:{activeElement:null,querySelector:()=>null},data,images:{},icon,endedPhase,endedRunReviewMarkup,runResultModel,resultFacts:facts,statistics:null,panelDetails:new Map(),rankPreview:new DefenderRankPreview(),dpsMeasurement:new DpsMeasurement(),dpsTracker:new TowerDpsTracker(),defenderPanelMarkup,selectedEnemyMarkup,stampCraftButtons:noop,folioLayout:{restoreParts:noop},syncFolio:noop,tutorial:()=>{throw new Error('Ended review cannot show the construction tutorial');},closeDialog:()=>closed++,showResult:()=>resultCalls++});
    const functions=compile(['handleCommand','renderSidebar','towerPanel','enemyInspectionOptions'],bindings,'let folioRecipeId=null,folioRecipeSelection=null;');const stop=selectionIntent(game,phaseUi);phaseUi.sync(game);phaseUi.open();press(functions.handleCommand,'result-review');functions.renderSidebar();assert.equal(closed,1);assert.equal(app.dataset.inspectorOpen,'false');assert.match(body.innerHTML,/Read-only|Run review/);assert.doesNotMatch(body.innerHTML,/Place recruits|data-action="(?:keep|craft|remove|reroll|reserve|move|start)"/);
    const before=inventory(game);game.select(tower.id);assert.equal(game.selection,tower);bindings.syncInspector();functions.renderSidebar();assert.equal(app.dataset.inspectorOpen,'true');assert.match(body.innerHTML,/Read-only defender inspection/);assert.doesNotMatch(body.innerHTML,/id="targeting"|data-action="(?:keep-draw|merge|downgrade|tower-pause)"/);
    for(const preview of body.innerHTML.match(/<button\b[^>]*data-action="craft-preview"[^>]*>/g)||[])assert.match(preview,/\bdisabled\b/,'Ended recipe planning cannot execute a combination');
    for(const action of ['keep','downgrade','remove','reroll','reserve','move','start','tower-pause'])press(functions.handleCommand,action,{towerId:String(tower.id)});
    assert.equal(inventory(game),before,'Stale construction and attack commands cannot alter the ended run');assert.equal(game.selectEnemy(enemy.id),true);functions.renderSidebar();assert.match(body.innerHTML,/Read-only invader snapshot/);press(functions.handleCommand,'enemy-inspect-close');functions.renderSidebar();assert.match(body.innerHTML,/Read-only|Run review/);press(functions.handleCommand,'result-return');assert.equal(resultCalls,1);
    const result=runResultMarkup(runResultModel(game),{leaderboardMarkup:'<p>Offline scores boundary</p>'});assert.ok(result.indexOf('data-action="restart"')<result.indexOf('run-result-online'));assert.ok(result.indexOf('data-action="result-review"')<result.indexOf('run-result-online'));stop();
  }
});
