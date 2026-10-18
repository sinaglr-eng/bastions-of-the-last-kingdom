import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {Game} from '../game/core/game.js';import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {PhaseUiState,phaseStripMarkup,combatStatusModel,combatBossMarkup} from '../ui/phase-ui.js';
import {defenderPanelMarkup} from '../ui/defender-panel.js';import {DefenderRankPreview} from '../ui/defender-rank-preview.js';
const read=name=>JSON.parse(fs.readFileSync(new URL('../data/'+name+'.json',import.meta.url))),data={balance:read('balance'),towers:campaignTowers(read('towers')),enemies:campaignEnemies(read('enemies')),waves:campaignWaves(read('waves')),recipes:campaignRecipes(read('recipes'))};
const placeFive=game=>{for(const [x,z]of [[16,16],[17,16],[18,16],[19,16],[20,16]])assert.equal(game.place(x,z+game.round-1),true);};

test('real Game phases collapse history for ready/combat and restore five cards in successive construction rounds without a UI decision',()=>{
 const game=new Game(data,{seed:208}),ui=new PhaseUiState();ui.sync(game);assert.equal(ui.historyExpanded,true);assert.equal(ui.inspectorOpen,false);placeFive(game);ui.sync(game);assert.equal(game.phase,'select');assert.equal(game.draft.draws.length,5);assert.equal(ui.historyExpanded,true);assert.equal(game.keep(),true);ui.sync(game);assert.equal(game.phase,'ready');assert.equal(ui.historyExpanded,false);assert.doesNotMatch(phaseStripMarkup(game,ui),/data-action="start"/);assert.equal(game.startCombat(),true);ui.sync(game);assert.equal(ui.inspectorOpen,false);assert.equal(ui.view,'unit');assert.equal(ui.historyExpanded,false);assert.equal(phaseStripMarkup(game,ui),'');
 const draws=JSON.stringify(game.draft.draws),towers=JSON.stringify(game.towers),seed=game.seed;ui.toggleHistory();ui.close();game.paused=true;ui.sync(game);assert.equal(ui.historyExpanded,true);assert.equal(phaseStripMarkup(game,ui),'');assert.equal(combatStatusModel(game).paused,true);assert.equal(JSON.stringify(game.draft.draws),draws);assert.equal(JSON.stringify(game.towers),towers);assert.equal(game.seed,seed);game.paused=false;game.completeWave();ui.sync(game);assert.equal(game.phase,'build');assert.equal(game.round,2);assert.equal(ui.historyExpanded,true);assert.equal(game.draft.draws.length,5);assert.equal(game.draft.draws.filter(draw=>draw.placed).length,0);
 placeFive(game);ui.sync(game);game.keep();ui.sync(game);game.startCombat();ui.sync(game);assert.equal(ui.historyExpanded,false);game.completeWave();ui.sync(game);assert.equal(game.round,3);assert.equal(ui.historyExpanded,true);
});
test('closing a combat inspector does not clear selected unit or repeatedly reopen on damage refresh; a new selection opens it',()=>{
 const game=new Game(data,{seed:208});placeFive(game);game.keep();game.select(null);game.startCombat();const ui=new PhaseUiState();ui.sync(game);game.select(game.towers.find(t=>t.state==='active').id);ui.sync(game);assert.equal(ui.inspectorOpen,true);ui.close();ui.sync(game);assert.equal(ui.inspectorOpen,false);assert.ok(game.selection);game.select(game.towers.find(t=>t.state==='ruin').id);ui.sync(game);assert.equal(ui.inspectorOpen,true);
});

test('combat opens no duplicate inspector; explicit Current detail survives refresh and pause while Ready/Combat expose no legacy phase strip',()=>{
 const game=new Game(data,{seed:208}),ui=new PhaseUiState();ui.sync(game);placeFive(game);game.keep();ui.sync(game);assert.equal(phaseStripMarkup(game,ui),'');game.startCombat();ui.sync(game);assert.equal(ui.inspectorOpen,false);
 ui.open('wave');for(let i=0;i<10;i++){game.paused=i%2===0;ui.sync(game);assert.equal(ui.inspectorOpen,true);assert.equal(ui.view,'wave');assert.equal(phaseStripMarkup(game,ui),'');}ui.close();ui.sync(game);assert.equal(ui.inspectorOpen,false);
 for(const phase of ['won','lost']){game.phase=phase;ui.sync(game);const html=phaseStripMarkup(game,ui);assert.match(html,/Read-only battlefield/);assert.match(html,/data-action="restart"/);assert.match(html,/data-action="result-return"/);assert.doesNotMatch(html,/inspect-keeper|draft-history|data-action="start"|data-action="inspect-wave"/);}
});
test('persistent status is independent of selected defender and global pause, with actual queued/live counts and revealed boss HP',()=>{
 const game=new Game(data,{seed:208});placeFive(game);game.keep();game.startCombat();game.combat.enemies=[];game.combat.spawnQueue=[];const boss=game.combat.spawn('host_10');boss.hp=boss.maxHp/2;game.combat.spawnQueue.push({type:'host_10',modifiers:{}});game.select(game.towers.find(t=>t.state==='active').id);game.paused=true;
 const model=combatStatusModel(game);assert.equal(model.onField,1);assert.equal(model.queued,1);assert.equal(model.paused,true);assert.equal(model.boss.hp,boss.maxHp/2);assert.equal(model.boss.approaching,1);assert.match(combatBossMarkup(model),/role="progressbar"/);assert.equal(game.selection.state,'active');
});
test('concealed boss HP and name are never read for persistent status or ARIA',()=>{
 const enemy={boss:true,dead:false,get hp(){throw Error('Private HP read');},get maxHp(){throw Error('Private max HP read');},get name(){throw Error('Private identity read');}};
 const game={phase:'combat',round:50,paused:true,wave:{boss:true},data:{enemies:{}},combat:{enemies:[enemy],spawnQueue:[],isRevealed:()=>false}};
 const model=combatStatusModel(game);assert.equal(model.boss.concealed,1);assert.match(combatBossMarkup(model),/Boss concealed/);assert.doesNotMatch(combatBossMarkup(model),/progressbar|aria-valuenow/);
});
test('candidate folio keeps actual legal actions and places displayed effects before rank comparison and base metrics',()=>{
 const game=new Game(data,{seed:208});placeFive(game);const tower=game.selection,preview=new DefenderRankPreview();preview.select(tower,4,data);const html=defenderPanelMarkup(game,tower,{rankPreview:preview});assert.match(html,new RegExp('Actual rank I · Candidate'));assert.ok(html.indexOf('data-action="keep-draw"')<html.indexOf('defender-core'));assert.ok(html.indexOf('folio-effects')<html.indexOf('class="rank-preview"'));assert.ok(html.indexOf('class="rank-preview"')<html.indexOf('folio-metrics'));assert.ok(html.indexOf('folio-metrics')<html.indexOf('folio-recipes'));assert.match(html,/Preview rank IV · Actual rank I unchanged/);assert.match(html,new RegExp('data-tower-id="'+tower.id+'"'));assert.equal(tower.tier,1);
});
test('retained MVP stays expanded below Move, support follows MVP, and comparison/core precede targeting; ended inspection has no commands',()=>{
 const game=new Game(data,{seed:208});placeFive(game);game.keep();const tower=game.towers.find(t=>t.state==='active'),html=defenderPanelMarkup(game,tower,{rankPreview:new DefenderRankPreview()});
 const order=['data-action="move"','class="mvp-details"','class="selected-support"','class="defender-core"','folio-effects','class="rank-preview"','folio-metrics','id="targeting"'].map(key=>html.indexOf(key));
 assert.ok(order.every((position,index)=>position>=0&&(!index||position>order[index-1])));assert.doesNotMatch(html,/data-detail-key="mvp"|<summary>MVP/);
 game.phase='lost';const ended=defenderPanelMarkup(game,tower,{rankPreview:new DefenderRankPreview()});assert.match(ended,/Read-only defender inspection/);assert.doesNotMatch(ended,/data-action="(?:keep-draw|merge-tower|move|tower-pause)"|id="targeting"/);
});
test('aura-only defender prominently presents actual per-enemy aura instead of attributing fictional direct DPS',()=>{
 const game=new Game(data,{seed:208}),family=Object.keys(data.towers).find(f=>data.towers[f].burnAura>0&&data.towers[f].damage===0),tower={id:999,family,tier:1,state:'active',priority:'first',mvpLevel:0,kills:0};assert.ok(family);game.towers.push(tower);const html=defenderPanelMarkup(game,tower);assert.match(html,/aura damage\/s per enemy/);assert.ok(html.indexOf('aura damage/s per enemy')<html.indexOf('Direct DPS'));assert.match(html,/Direct DPS<\/span><strong>0<\/strong>/);assert.equal((html.match(/aura damage\/s per enemy/g)||[]).length,1);
});
test('a real keeper decision closes the prior candidate inspector and keeps it closed during Ready refreshes until explicit inspection',()=>{
 const game=new Game(data,{seed:208}),ui=new PhaseUiState();ui.sync(game);placeFive(game);ui.sync(game);ui.open('unit');const selected=game.selected;
 assert.equal(ui.inspectorOpen,true);assert.equal(game.keep(),true);ui.sync(game);assert.equal(game.phase,'ready');assert.equal(ui.inspectorOpen,false);assert.equal(game.selected,selected);
 for(let i=0;i<3;i++){ui.sync(game);assert.equal(ui.inspectorOpen,false);}ui.open('unit');ui.sync(game);assert.equal(ui.inspectorOpen,true,'An explicit user inspection remains open');assert.equal(game.selected,selected);
});
