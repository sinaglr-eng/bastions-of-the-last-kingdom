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
import {WaveThreatAnalyzer} from '../game/core/wave-threats.js';
import {ArmyReadiness} from '../game/core/army-readiness.js';
import {nextWavePreviewIndex} from '../ui/wave-preview-flow.js';

const source=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL('../data/'+key+'.json',import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
function declaration(name){
  const start=source.indexOf(`function ${name}(`),next=source.indexOf('\nfunction ',start+1);
  assert.ok(start>=0&&next>start,`actual main declaration ${name} is available`);return source.slice(start,next);
}
function compile(names,bindings,prefix=''){
  return new Function(...Object.keys(bindings),prefix+'\n'+names.map(declaration).join('\n')+`\nreturn {${names.join(',')}};`)(...Object.values(bindings));
}
const bodyNode=()=>({innerHTML:'',dataset:{},scrollTop:0,scrollLeft:0,insertAdjacentHTML(where,markup){this.innerHTML=where==='afterbegin'?markup+this.innerHTML:this.innerHTML+markup;}});
function sidebarFixture(game){
  const body=bodyNode(),nodes=new Map([['side-top',bodyNode()],['side-body',body]]),images={ruin:'approved-wall.png'},inspection=bodyNode();
  inspection.closest=()=>body;inspection.ownerDocument={activeElement:null};inspection.querySelectorAll=()=>[];
  const $=id=>id==='selected-enemy-panel'?(body.innerHTML.includes('id="selected-enemy-panel"')?inspection:null):nodes.get(id)||null;
  const functions=compile(['towerPanel','enemyInspectionOptions','combatPanel','renderSidebar'],{game,$,data,images,icon,rankPreview:{clear(){}},selectedEnemyMarkup,commandPointsMarkup,wallPanelMarkup,tutorial:()=>'<h2>Construction</h2>'});
  return {body,nodes,inspection,$,images,...functions};
}
function completeActualWave(game){
  for(const queued of game.combat.spawnQueue.splice(0))game.combat.spawn(queued.type,queued.modifiers);
  for(const enemy of game.combat.enemies)game.combat.damage(enemy,enemy.maxHp*100+1000,'pure',{});
  game.combat.update(.01);
}
function keepDraft(game){
  for(const x of [5,7,9,11,13])assert.equal(game.place(x,10),true);assert.equal(game.keep(),true);
}

// These tests execute the saved production main functions with a minimal DOM
// boundary, real Game/combat objects and the actual imported UI renderers.
// WebGL, layout, native pointer hit-testing and touch scrolling remain in the
// separate browser checklist; this is not a replacement for that inspection.
test('actual main sidebar keeps individual live enemy HP and controls, then returns to combat commands without aggregate enemy overview',()=>{
  const game=new Game(data,{seed:475});prepareEnemyInspectionReview(game);const ui=sidebarFixture(game);
  ui.renderSidebar();assert.match(ui.body.innerHTML,/data-action="pause"/);assert.match(ui.body.innerHTML,/data-action="speed"/);
  assert.doesNotMatch(ui.body.innerHTML,/current-warband|boss-health|enemy-count|wave-intelligence|Remaining enemy health/);
  const enemy=game.combat.enemies.find(candidate=>game.combat.isRevealed(candidate));assert.ok(enemy);assert.equal(game.selectEnemy(enemy.id),true);
  ui.renderSidebar();assert.match(ui.body.innerHTML,new RegExp(`data-inspected-enemy="${enemy.id}"`));assert.match(ui.body.innerHTML,/Remaining enemy health/);assert.match(ui.body.innerHTML,/ HP/);
  const hp=enemy.hp;game.combat.damage(enemy,Math.min(20,hp/10),'pure',{});ui.body.scrollTop=83;ui.renderSidebar();assert.equal(ui.body.scrollTop,83);assert.ok(enemy.hp<hp);assert.equal(game.enemySelection,enemy);
  game.select(null);ui.renderSidebar();assert.equal(ui.body.scrollTop,0);assert.doesNotMatch(ui.body.innerHTML,/data-inspected-enemy|enemy-inspection-health|current-warband|boss-health/);assert.match(ui.body.innerHTML,/data-action="pause"/);
});

test('actual main HUD follows real damage, pause and death while retaining individual scroll, peak DPS and lower combat controls',()=>{
  const game=new Game(data,{seed:693});prepareEnemyInspectionReview(game);const ui=sidebarFixture(game),tracker=new TowerDpsTracker(),samples=[];
  tracker.reset(game.combat.elapsed);game.on((type,payload)=>{if(type==='hit')tracker.recordHit(payload,game.combat.elapsed);});
  for(const id of ['hud-wave','hud-lives','hud-gold','hud-time','hud-cp','hud-score','tower-dps'])ui.nodes.set(id,{textContent:'',innerHTML:'',parentElement:{parentElement:{classList:{add(){},remove(){}}}}});
  const {hud}=compile(['hud'],{game,$:ui.$,updateSelectedEnemyPanel,enemyInspectionOptions:ui.enemyInspectionOptions,renderSidebar:ui.renderSidebar,renderRecipeBrowser(){},updateTowerDpsPanel:(panel,rows,...rest)=>samples.push({rows,options:rest.at(-1)}),dpsTracker:tracker,dpsWave:game.round,data,images:ui.images,balance:data.balance,formatRunDuration,profile:{bestScore:0},renderWarbandsOverview(){},supportEffectsMarkup(){throw new Error('No defender is selected');}});
  const enemy=game.combat.enemies.find(candidate=>game.combat.isRevealed(candidate)),attacker=game.towers.find(t=>t.state==='active');assert.equal(game.selectEnemy(enemy.id),true);ui.renderSidebar();ui.body.scrollTop=107;
  for(let n=0;n<8;n++){
    game.combat.damage(enemy,Math.min(3,enemy.hp/100),'pure',{},attacker);hud();assert.equal(ui.body.scrollTop,107);
    assert.match(ui.inspection.innerHTML,new RegExp(`aria-valuenow="${enemy.hp}"`));assert.equal(game.enemySelection,enemy);
  }
  assert.ok(samples.at(-1).rows.some(row=>row.id===attacker.id&&row.dps>0));assert.equal(samples.at(-1).options.wave,15);
  game.paused=true;game.speed=3;const pausedHP=enemy.hp;game.tick(.5);hud();assert.equal(enemy.hp,pausedHP);assert.equal(samples.at(-1).options.paused,true);assert.match(ui.inspection.innerHTML,/>Resume<\/button>/);assert.match(ui.inspection.innerHTML,/3× speed/);
  game.combat.damage(enemy,enemy.maxHp*10,'pure',{},attacker);hud();assert.equal(game.enemySelection,null);assert.doesNotMatch(ui.body.innerHTML,/id="selected-enemy-panel"|current-warband|boss-health/);assert.match(ui.body.innerHTML,/data-action="pause"/);
  const draftMarkup=compile(['renderDraft'],{game,$:id=>id==='draft'?ui.body:null,icon,commandPointsMarkup,data,images:ui.images,draftCardsMarkup:()=>'<div>Current draft controls</div>'});draftMarkup.renderDraft();assert.match(ui.body.innerHTML,/draft-combat-actions/);assert.match(ui.body.innerHTML,/data-action="pause"/);assert.match(ui.body.innerHTML,/data-action="speed"/);
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

test('actual main next-wave integration follows real round31 completion and final10 victory without resetting disclosure preference or revealing drafts',()=>{
  for(const limit of [50,10]){
    const game=new Game(data,{seed:428,waveLimit:limit});prepareWavePreviewReview(game,limit===50?31:10);
    const calls=[],host={open:false},analyzer=new WaveThreatAnalyzer(data),readiness=new ArmyReadiness(data);
    const {renderIntelligence}=compile(['renderIntelligence'],{game,$:()=>host,nextWavePreviewIndex,threatAnalyzer:analyzer,armyReadiness:readiness,data,images:{},updateNextWaveSummaryPanel:(panel,model,actualData,images,options)=>{assert.equal(options,undefined,'main must not override the independently retained open state');assert.equal(panel.open,false);calls.push(model?.next?.number??null);}},'let intelligenceModel=null,intelligenceKey=null;');
    const latent=JSON.stringify(game.draft.draws),resources=JSON.stringify({cp:game.commandPoints.value,gold:game.economy.gold,towers:game.towers});
    for(let n=0;n<20;n++)renderIntelligence();assert.deepEqual(calls,[limit===50?31:10]);assert.equal(JSON.stringify(game.draft.draws),latent);assert.equal(JSON.stringify({cp:game.commandPoints.value,gold:game.economy.gold,towers:game.towers}),resources);
    keepDraft(game);assert.equal(game.startCombat(),true);renderIntelligence();assert.equal(calls.at(-1),limit===50?32:null);
    completeActualWave(game);renderIntelligence();assert.equal(calls.at(-1),limit===50?32:null);assert.equal(game.phase,limit===50?'build':'won');assert.equal(host.open,false);
    if(limit===50)assert.ok(game.draft.draws.every(draw=>!draw.placed&&!draw.family));
  }
});
