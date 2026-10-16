import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {prepareEnemyInspectionReview,prepareWavePreviewReview} from '../game/core/debug-review.js';
import {selectedEnemyMarkup,updateSelectedEnemyPanel} from '../ui/selected-enemy.js';
import {commandPointsMarkup} from '../ui/command-points.js';
import {wallPanelMarkup} from '../ui/wall-panel.js';
import {formatRunDuration} from '../ui/run-clock.js';
import {icon} from '../ui/icons.js';
import {TowerDpsTracker} from '../game/core/tower-dps.js';
import {DpsMeasurement} from '../ui/dps-measurement.js';
import {craftRecipeKey} from '../ui/crafting-dock.js';
import {WaveThreatAnalyzer} from '../game/core/wave-threats.js';
import {ArmyReadiness} from '../game/core/army-readiness.js';
import {nextWavePreviewIndex} from '../ui/wave-preview-flow.js';
import {updateHeaderCombatControls} from '../ui/header-combat-controls.js';
import {currentWavePanelMarkup,updateCurrentWavePanel} from '../ui/current-wave-panel.js';
import {PhaseUiState,endedPhase,updateCombatStatus,pinnedGoalMarkup} from '../ui/phase-ui.js';
import {craftingDockModel} from '../ui/crafting-dock.js';
import {defenderPanelMarkup} from '../ui/defender-panel.js';
import {DefenderRankPreview} from '../ui/defender-rank-preview.js';
import {RunResultFacts,runResultModel,endedRunReviewMarkup} from '../ui/run-results.js';
import {contextGuidanceMarkup} from '../ui/context-guidance.js';
import {updateCurrentWaveSummaryPanel} from '../ui/current-wave-summary.js';
import {updateNextWaveSummaryPanel} from '../ui/next-wave-summary.js';

const source=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL('../data/'+key+'.json',import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
function declaration(name){
  const start=source.indexOf(`function ${name}(`),next=source.indexOf('\nfunction ',start+1);
  // This single-line production helper precedes top-level event wiring,
  // rather than another declaration. Do not execute that browser setup here.
  if(name==='stampCraftButtons'){assert.ok(start>=0);return source.slice(start,source.indexOf('\n',start));}
  assert.ok(start>=0&&next>start,`actual main declaration ${name} is available`);return source.slice(start,next);
}
function compile(names,bindings,prefix=''){
  return new Function(...Object.keys(bindings),prefix+'\n'+names.map(declaration).join('\n')+`\nreturn {${names.join(',')}};`)(...Object.values(bindings));
}
const bodyNode=()=>({innerHTML:'',dataset:{},scrollTop:0,scrollLeft:0,
  replaceChildren(){this.innerHTML='';},querySelector(){return null;},
  contains(){return false;},querySelectorAll(selector){assert.ok(['[data-action="craft"]','details','[data-action]'].includes(selector));if(selector==='[data-action="craft"]')assert.doesNotMatch(this.innerHTML,/data-action="craft"/,'These combat/wall fixtures contain no crafting buttons');return [];},
  insertAdjacentHTML(where,markup){this.innerHTML=where==='afterbegin'?markup+this.innerHTML:this.innerHTML+markup;}});
function sidebarFixture(game){
  const phaseUi=new PhaseUiState(),body=bodyNode(),nodes=new Map([['side-top',bodyNode()],['side-body',body]]),images={ruin:'approved-wall.png'},inspection=bodyNode(),currentWave=bodyNode();
  inspection.closest=()=>body;inspection.ownerDocument={activeElement:null};inspection.querySelectorAll=()=>[];
  currentWave.closest=()=>body;
  const $=id=>id==='selected-enemy-panel'?(body.innerHTML.includes('id="selected-enemy-panel"')?inspection:null):id==='current-wave-panel'?(body.innerHTML.includes('id="current-wave-panel"')?currentWave:null):nodes.get(id)||null;
  const functions=compile(['stampCraftButtons','towerPanel','enemyInspectionOptions','combatPanel','renderSidebar'],{game,phaseUi,$,data,images,icon,rankPreview:new DefenderRankPreview(),selectedEnemyMarkup,currentWavePanelMarkup,commandPointsMarkup,wallPanelMarkup,craftRecipeKey,defenderPanelMarkup,dpsMeasurement:new DpsMeasurement(),dpsTracker:new TowerDpsTracker(),endedPhase,endedRunReviewMarkup,runResultModel,resultFacts:new RunResultFacts(),statistics:null,panelDetails:new Map(),document:{activeElement:null},tutorial:()=>'<h2>Construction</h2>',folioLayout:{restoreParts(){}},syncFolio(){}},'let folioRecipeId=null,folioRecipeSelection=null;');
  return {phaseUi,body,nodes,inspection,currentWave,$,images,...functions};
}
// Native disclosure boundary used by the real shared Next/Current updater.
// Descendant content is opaque here; its actual markup is checked separately.
function waveHost(){
  const document={activeElement:null},listeners=new Map();let details,summary,body;
  const element=()=>({attributes:new Map(),innerHTML:'',scrollTop:0,setAttribute(key,value){this.attributes.set(key,String(value));},getAttribute(key){return this.attributes.get(key);},matches(selector){return selector.startsWith('.')&&(this.attributes.get('class')||'').split(' ').includes(selector.slice(1));},querySelector(){return null;},querySelectorAll(){return [];},contains(){return false;},addEventListener(){},focus(){document.activeElement=this;}});
  const host={ownerDocument:document,hidden:false,writes:0,addEventListener(){},contains(node){return node===details||node===summary||node===body;},querySelector(selector){return selector==='details'||selector==='.battlefield-overlay-disclosure'?details:selector==='summary'?summary:selector==='.battlefield-overlay-content'?body:null;},set innerHTML(html){this.writes++;summary=element();body=element();summary.innerHTML=html.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)[1];body.innerHTML=html.slice(html.indexOf('<div class="battlefield-overlay-content'));body.setAttribute('class',html.match(/<div class="(battlefield-overlay-content [^"]+)"/)[1]);let open=/<details[^>]*\bopen\b/.test(html);details={querySelector:selector=>selector==='summary'?summary:body,setAttribute(){},addEventListener(type,callback){listeners.set(type,callback);},get open(){return open;},set open(value){open=!!value;listeners.get('toggle')?.();}};}};
  return host;
}
function headerHost(){
  const element=(text='')=>({textContent:text,innerHTML:'',attributes:new Map(),setAttribute(name,value){this.attributes.set(name,value);},getAttribute(name){return this.attributes.get(name)||null;}}),label=element('Pause'),glyph=element(),pause=element(),speed=element('1×');pause.setAttribute('aria-label','Pause game');pause.querySelector=selector=>selector==='.header-pause-label'?label:glyph;
  return {hidden:true,writes:0,pause,speed,label,get innerHTML(){return this.markup||'';},set innerHTML(value){this.writes++;this.markup=value;this.mounted=true;},querySelector(selector){return this.mounted?(selector==='[data-action="pause"]'?pause:speed):null;}};
}
function completeActualWave(game){
  for(const queued of game.combat.spawnQueue.splice(0))game.combat.spawn(queued.type,queued.modifiers);
  for(const enemy of game.combat.enemies)game.combat.damage(enemy,enemy.maxHp*100+1000,'holy',{});
  game.combat.update(.01);
}
function keepDraft(game){
  for(const x of [5,7,9,11,13])assert.equal(game.place(x,10),true);assert.equal(game.keep(),true);
}

// These tests execute the saved production main functions with a minimal DOM
// boundary, real Game/combat objects and the actual imported UI renderers.
// WebGL, layout, native pointer hit-testing and touch scrolling remain in the
// separate browser checklist; this is not a replacement for that inspection.
test('actual main sidebar keeps individual live enemy HP and close control without duplicating global combat controls',()=>{
  const game=new Game(data,{seed:475});prepareEnemyInspectionReview(game);const ui=sidebarFixture(game);
  ui.renderSidebar();assert.match(ui.body.innerHTML,/current-wave-panel/);assert.ok(ui.body.innerHTML.includes(game.wave.name));assert.match(ui.body.innerHTML,/invaders remaining/);assert.doesNotMatch(ui.body.innerHTML,/data-action="(?:pause|speed)"/);
  assert.doesNotMatch(ui.body.innerHTML,/current-warband|boss-health|enemy-count|wave-intelligence|Remaining enemy health/);
  const enemy=game.combat.enemies.find(candidate=>game.combat.isRevealed(candidate));assert.ok(enemy);assert.equal(game.selectEnemy(enemy.id),true);
  ui.renderSidebar();assert.match(ui.body.innerHTML,new RegExp(`data-inspected-enemy="${enemy.id}"`));assert.match(ui.body.innerHTML,/Remaining enemy health/);assert.match(ui.body.innerHTML,/ HP/);
  const hp=enemy.hp;game.combat.damage(enemy,Math.min(20,hp/10),'pure',{});ui.body.scrollTop=83;ui.renderSidebar();assert.equal(ui.body.scrollTop,83);assert.ok(enemy.hp<hp);assert.equal(game.enemySelection,enemy);
  game.select(null);ui.renderSidebar();assert.equal(ui.body.scrollTop,0);assert.doesNotMatch(ui.body.innerHTML,/data-inspected-enemy|enemy-inspection-health|current-warband|boss-health|data-action="(?:pause|speed)"/);assert.match(ui.body.innerHTML,/current-wave-panel|invaders remaining/);
});

test('actual main HUD follows real damage, pause and death while retaining individual scroll, peak DPS and persistent header controls',()=>{
  const game=new Game(data,{seed:693});prepareEnemyInspectionReview(game);const ui=sidebarFixture(game),tracker=new TowerDpsTracker(),measurement=new DpsMeasurement(),samples=[];
  tracker.reset(game.combat.elapsed);measurement.startWave(game.round);game.on((type,payload)=>{if(type==='hit')tracker.recordHit(payload,game.combat.elapsed);});
  for(const id of ['hud-wave','hud-lives','hud-gold','hud-time','hud-cp','hud-score','tower-dps','developer-mode-indicator','combat-counts','persistent-boss','context-guidance','menu-stats','pinned-goal'])ui.nodes.set(id,{textContent:'',innerHTML:'',parentElement:{parentElement:{classList:{add(){},remove(){}}}}});
  const waveSummary=waveHost();ui.nodes.set('next-wave-summary',waveSummary);
  const header=headerHost();ui.nodes.set('header-combat-controls',header);ui.nodes.set('dialog',{open:false});
  let audioSyncs=0;const {hud}=compile(['hud'],{game,$:ui.$,app:{dataset:{}},phaseUi:ui.phaseUi,updateCurrentWaveSummaryPanel,updateCombatStatus,craftingDockModel,pinnedGoalMarkup,contextGuidanceMarkup,guidance:null,audio:{syncGameState(actual,options){assert.equal(actual,game);assert.equal(options.musicPaused,game.paused);audioSyncs++;}},developerConnection:null,updateHeaderCombatControls,updateSelectedEnemyPanel,updateCurrentWavePanel,enemyInspectionOptions:ui.enemyInspectionOptions,renderSidebar:ui.renderSidebar,renderRecipeBrowser(){},updateTowerDpsPanel:(panel,rows,...rest)=>samples.push({rows,options:rest.at(-1)}),dpsTracker:tracker,dpsMeasurement:measurement,data,images:ui.images,balance:data.balance,formatRunDuration,profile:{bestScore:0},renderWarbandsOverview(){},supportEffectsMarkup(){throw new Error('No defender is selected');}});
  const enemy=game.combat.enemies.find(candidate=>game.combat.isRevealed(candidate)),attacker=game.towers.find(t=>t.state==='active');assert.equal(game.selectEnemy(enemy.id),true);ui.renderSidebar();ui.body.scrollTop=107;
  for(let n=0;n<8;n++){
    game.combat.damage(enemy,Math.min(3,enemy.hp/100),'pure',{},attacker);hud();assert.equal(ui.body.scrollTop,107);
    assert.match(ui.inspection.innerHTML,new RegExp(`aria-valuenow="${enemy.hp}"`));assert.equal(game.enemySelection,enemy);
  }
  assert.ok(samples.at(-1).rows.some(row=>row.id===attacker.id&&row.dps>0));assert.equal(samples.at(-1).options.wave,15);
  assert.equal(audioSyncs,8);assert.equal(ui.nodes.get('developer-mode-indicator').hidden,true);game.developerMode=true;hud();assert.equal(ui.nodes.get('developer-mode-indicator').hidden,false);
  game.paused=true;game.speed=2;const pausedHP=enemy.hp;game.tick(.5);hud();assert.equal(enemy.hp,pausedHP);assert.equal(samples.at(-1).options.paused,true);assert.equal(header.label.textContent,'Resume');assert.equal(header.speed.textContent,'2×');assert.equal(header.hidden,false);assert.equal(header.writes,1);assert.doesNotMatch(ui.inspection.innerHTML,/data-action="(?:pause|speed)"/);assert.match(waveSummary.querySelector('summary').innerHTML,/Current wave 15/);
  game.combat.damage(enemy,enemy.maxHp*10,'pure',{},attacker);ui.phaseUi.open('wave');hud();assert.equal(game.enemySelection,null);assert.doesNotMatch(ui.body.innerHTML,/id="selected-enemy-panel"|current-warband|boss-health|data-action="(?:pause|speed)"/);assert.match(ui.body.innerHTML,/current-wave-panel/);assert.match(ui.currentWave.innerHTML,/invaders remaining/);assert.equal(header.writes,1);
  const compact=bodyNode();ui.nodes.set('compact-draft-actions',compact);ui.nodes.set('folio-command-actions',bodyNode());
  const draftMarkup=compile(['renderDraft'],{game,$:id=>id==='draft'?ui.body:ui.nodes.get(id)||null,icon,commandPointsMarkup,data,images:ui.images,draftCardsMarkup:()=>'<div>Current draft controls</div>'});draftMarkup.renderDraft();assert.doesNotMatch(ui.body.innerHTML,/draft-combat-actions|data-action="(?:pause|speed)"/);assert.equal(ui.body.innerHTML,'','Combat removes historical draft controls');
  assert.equal(compact.hidden,true,'Construction command points do not duplicate combat controls');assert.equal(compact.innerHTML,'');
  const bossType=Object.entries(game.data.enemies).find(([,definition])=>definition.boss)?.[0];assert.ok(bossType);const boss=game.combat.spawn(bossType);boss.cloaked=false;game.select(attacker.id);ui.phaseUi.open('unit');ui.renderSidebar();hud();
  const counts=ui.nodes.get('combat-counts'),banner=ui.nodes.get('persistent-boss');assert.equal(counts.textContent,`${game.combat.enemies.filter(e=>!e.dead).length} on field · ${game.combat.spawnQueue.length} queued`);assert.equal(banner.hidden,false);assert.match(banner.innerHTML,new RegExp(`aria-valuenow="${boss.hp}"`));assert.match(ui.body.innerHTML,/defender-panel/);assert.doesNotMatch(ui.body.innerHTML,/current-wave-panel/);
  game.combat.damage(boss,1,'pure',{},attacker);hud();assert.match(banner.innerHTML,new RegExp(`aria-valuenow="${boss.hp}"`));const frozenBoss=boss.hp;game.tick(1);hud();assert.equal(boss.hp,frozenBoss);assert.equal(header.label.textContent,'Resume');assert.equal(counts.textContent,`${game.combat.enemies.filter(e=>!e.dead).length} on field · ${game.combat.spawnQueue.length} queued`,'Persistent counts continue independently of defender inspection and global pause');
});

test('actual main selected-wall markup puts demolition immediately after the title and matches real Game.remove phase restrictions',()=>{
  for(const phase of ['build','select','ready','reward','combat','won','lost']){
    const game=new Game(data,{seed:815});keepDraft(game);const wall=game.towers.find(t=>t.state==='ruin');assert.ok(wall);
    if(phase==='combat')assert.equal(game.startCombat(),true);else if(['won','lost'].includes(phase))game.end(phase==='won');else game.phase=phase;
    game.select(wall.id);const ui=sidebarFixture(game);ui.renderSidebar();
    const markup=ui.body.innerHTML,button=markup.match(/<button[^>]*data-action="remove"[^>]*>/)?.[0];assert.ok(button);
    const allowed=['build','select','ready','reward'].includes(phase);assert.equal(button.includes('disabled'),!allowed,phase);
    const title=markup.indexOf('<h2>Castle wall</h2>'),action=markup.indexOf('data-action="remove"'),portrait=markup.indexOf('tower-portrait');assert.ok(title>=0&&action>title&&portrait>action);
    assert.doesNotMatch(markup.slice(title,action),/<img|command-points-panel/);
    assert.equal(game.remove(),allowed,phase);assert.equal(game.towers.includes(wall),!allowed,phase);
  }
});

test('actual main keyboard and overlay-entry listeners prevent panel controls from also driving the battlefield',()=>{
  const game=new Game(data,{seed:724});prepareEnemyInspectionReview(game);const initial=JSON.stringify({towers:game.towers,draws:game.draft.draws,cp:game.commandPoints.value}),callbacks=new Map();
  let cleared=0,renders=0,unlocked=0;const world={keys:new Set(['w','arrowleft']),maze:{editing:false},clearPointer(){cleared++;},edgePointer:{x:1,y:5}},panel={addEventListener:(type,fn)=>callbacks.set('overlay:'+type,fn)};
  const pointerLine=source.split('\n').find(line=>line.includes("$('battlefield-overlays').addEventListener('pointerenter'"));assert.ok(pointerLine);new Function('$','world',pointerLine)(()=>panel,world);callbacks.get('overlay:pointerenter')();assert.equal(cleared,1);assert.equal(world.keys.size,0);
  const keyboardLine=source.split('\n').find(line=>line.startsWith("window.addEventListener('keydown'"));assert.ok(keyboardLine);
  const document={activeElement:{tagName:'DIV',isContentEditable:false,closest:selector=>selector==='.battlefield-overlays'?panel:null}},window={addEventListener:(type,fn)=>callbacks.set(type,fn)};
  const {mainAction}=compile(['mainAction'],{game,render:()=>renders++,sendWave:()=>{throw new Error('Combat cannot send another wave');}});
  new Function('window','document','game','world','$','audio','mainAction',keyboardLine)(window,document,game,world,()=>({open:false}),{unlock:()=>unlocked++},mainAction);
  const keydown=callbacks.get('keydown');let prevented=0;
  for(const key of [' ','ArrowDown','ArrowLeft','q','e','1','Delete'])keydown({key,preventDefault(){prevented++;}});
  assert.equal(world.keys.size,0);assert.equal(prevented,0);assert.equal(unlocked,0);assert.equal(renders,0);assert.equal(JSON.stringify({towers:game.towers,draws:game.draft.draws,cp:game.commandPoints.value}),initial);
  document.activeElement.closest=()=>null;document.activeElement.tagName='BODY';game.paused=false;keydown({key:' ',preventDefault(){prevented++;}});assert.equal(game.paused,true);assert.equal(renders,1);assert.equal(unlocked,1);assert.equal(prevented,1);
});

test('actual main uses one shared Next/Current slot through real wave31 completion and final10 victory, preserving disclosure and hidden draws',()=>{
  for(const limit of [50,10]){
    const game=new Game(data,{seed:428,waveLimit:limit});prepareWavePreviewReview(game,limit===50?31:10);
    const calls=[],host=waveHost(),analyzer=new WaveThreatAnalyzer(data),readiness=new ArmyReadiness(data);
    const {renderIntelligence}=compile(['renderIntelligence'],{game,$:id=>{assert.equal(id,'next-wave-summary');return host;},nextWavePreviewIndex,threatAnalyzer:analyzer,armyReadiness:readiness,data,images:{},updateCurrentWaveSummaryPanel:(panel,run,...rest)=>{calls.push(['current',run.round]);return updateCurrentWaveSummaryPanel(panel,run,...rest);},updateNextWaveSummaryPanel:(panel,model,...rest)=>{calls.push(['next',model?.next?.number??null]);return updateNextWaveSummaryPanel(panel,model,...rest);}},'let intelligenceModel=null,intelligenceKey=null;');
    const latent=JSON.stringify(game.draft.draws),resources=JSON.stringify({cp:game.commandPoints.value,gold:game.economy.gold,towers:game.towers});
    renderIntelligence();const details=host.querySelector('details'),summary=host.querySelector('summary');assert.equal(details.open,true);details.open=false;summary.focus();
    for(let n=0;n<20;n++)renderIntelligence();assert.deepEqual(calls,[['next',limit===50?31:10]]);assert.equal(JSON.stringify(game.draft.draws),latent);assert.equal(JSON.stringify({cp:game.commandPoints.value,gold:game.economy.gold,towers:game.towers}),resources);
    keepDraft(game);assert.equal(game.startCombat(),true);renderIntelligence();assert.deepEqual(calls.at(-1),['current',limit===50?31:10]);assert.equal(host.querySelector('details'),details);assert.equal(details.open,false);assert.equal(host.ownerDocument.activeElement,summary);assert.match(summary.innerHTML,new RegExp('Current wave '+game.round));assert.doesNotMatch(summary.innerHTML,/Next wave/);
    game.paused=true;renderIntelligence();assert.deepEqual(calls.at(-1),['current',game.round]);assert.equal(details.open,false);game.paused=false;
    completeActualWave(game);renderIntelligence();assert.deepEqual(calls.at(-1),['next',limit===50?32:null]);assert.equal(game.phase,limit===50?'build':'won');assert.equal(host.querySelector('details'),details);assert.equal(details.open,false);assert.equal(host.hidden,limit===10);
    if(limit===50){assert.ok(game.draft.draws.every(draw=>!draw.placed&&!draw.family));assert.match(summary.innerHTML,/Next wave 32/);}else assert.doesNotMatch(summary.innerHTML,/Next wave 11/);
  }
});
