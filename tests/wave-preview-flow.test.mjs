import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {nextWavePreviewIndex,previewDisclosureOpen} from '../ui/wave-preview-flow.js';
import {WaveThreatAnalyzer} from '../game/core/wave-threats.js';
import {prepareWavePreviewReview,prepareCommandPointsReview} from '../game/core/debug-review.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL('../data/'+key+'.json',import.meta.url)))]));
function fixture(){return new Game(data,{seed:428});}
function placeFive(game){for(const [x,z] of [[16,17],[18,17],[20,17],[17,19],[19,19]])assert.equal(game.place(x,z),true);}

test('five latent candidates accept placement immediately before preview interaction',()=>{
  const game=fixture();assert.equal(game.phase,'build');assert.equal(game.draft.draws.length,5);
  assert.ok(game.draft.draws.every(draw=>!draw.placed));assert.equal(game.place(16,17),true);
  assert.equal(game.towers.length,1);assert.equal(game.commandPoints.value,3);
});
test('reading sidebar intelligence leaves recruits, map, phase, CP and RNG unchanged',()=>{
  const game=fixture(),control=fixture(),before=JSON.stringify(game.draft.draws),analyzer=new WaveThreatAnalyzer(data);
  for(let i=0;i<3;i++)analyzer.outlook(nextWavePreviewIndex(game),game.waveLimit);
  assert.equal(game.phase,'build');assert.equal(game.grid.occupied.size,0);assert.equal(JSON.stringify(game.draft.draws),before);
  assert.equal(game.commandPoints.value,3);assert.equal(game.rng(),control.rng());
});
test('direct draft completes five placements and keeper before combat',()=>{
  const game=fixture();placeFive(game);assert.equal(game.phase,'select');game.select(game.draft.draws[0].towerId);
  assert.equal(game.keep(),true);assert.equal(game.phase,'ready');assert.equal(game.towers.filter(t=>t.state==='active').length,1);
  assert.equal(game.startCombat(),true);assert.equal(game.phase,'combat');
});
test('next draft is immediately usable after wave completion',()=>{
  const game=fixture();placeFive(game);game.select(game.draft.draws[0].towerId);game.keep();game.startCombat();
  game.combat.enemies=[];game.combat.spawnQueue=[];game.completeWave();
  assert.equal(game.round,2);assert.equal(game.phase,'build');assert.equal(game.draft.draws.length,5);assert.equal(game.place(14,17),true);
});
test('fixed Reserve returns among five direct candidates without moving',()=>{
  const game=fixture();placeFive(game);const carried=game.towers[0],position=[carried.x,carried.z];game.select(carried.id);
  assert.equal(game.reserve(),true);game.select(game.towers.find(t=>t.state==='draft').id);game.keep();game.startCombat();
  game.combat.enemies=[];game.combat.spawnQueue=[];game.completeWave();
  assert.equal(game.draft.draws.length,5);assert.equal(game.draft.draws[0].towerId,carried.id);assert.equal(game.draft.draws[0].fixedPosition,true);
  assert.equal(game.draft.draws.filter(draw=>!draw.placed).length,4);assert.equal(game.place(14,17),true);assert.deepEqual([carried.x,carried.z],position);
});
test('Reroll and Reserve retain existing costs after direct placement',()=>{
  const game=fixture();placeFive(game);assert.equal(game.reroll(),true);assert.equal(game.draft.draws.length,5);
  assert.equal(game.commandPoints.value,2);assert.equal(game.phase,'select');game.select(game.draft.draws[1].towerId);
  assert.equal(game.reserve(),true);assert.equal(game.commandPoints.value,1);
});
test('preparation Move, demolition and retained recipes need no preview opening',()=>{
  const game=fixture();prepareCommandPointsReview(game);game.phase='build';game.round=11;game.draft.roll(game.economy.mastery);
  const wall=game.towers.find(t=>t.state==='ruin');game.select(wall.id);const count=game.towers.length;
  assert.equal(game.canCombine(game.towers.find(t=>t.state==='active')),true);assert.equal(game.beginMove(),true);
  assert.equal(game.cancelMove(),true);game.select(wall.id);assert.equal(game.remove(),true);assert.equal(game.towers.length,count-1);
});
test('forthcoming index advances at combat start and omits final futures',()=>{
  const game=fixture();assert.equal(nextWavePreviewIndex(game),0);game.round=10;game.phase='ready';assert.equal(nextWavePreviewIndex(game),9);
  game.phase='combat';assert.equal(nextWavePreviewIndex(game),10);game.round=50;assert.equal(nextWavePreviewIndex(game),null);
  game.phase='ready';assert.equal(nextWavePreviewIndex(game),49);for(const phase of ['won','lost']){game.phase=phase;assert.equal(nextWavePreviewIndex(game),null);}
  assert.equal(nextWavePreviewIndex(null),null);
});
test('new runs and authored review scenes have immediately usable drafts',()=>{
  const game=fixture();assert.equal(prepareWavePreviewReview(game,14),true);assert.equal(game.round,14);
  assert.equal(game.towers.filter(t=>t.state==='active').length,4);assert.equal(game.draft.draws.length,5);assert.equal(game.place(14,17),true);
  const fresh=fixture();assert.equal(fresh.place(16,17),true);assert.equal(nextWavePreviewIndex(fresh),0);
});
test('new round reopens intelligence even when combat previewed that same wave',()=>{
  assert.equal(previewDisclosureOpen({index:1,previousIndex:1,round:2,previousRound:1,preparing:true,open:false}),true);
  assert.equal(previewDisclosureOpen({index:1,previousIndex:1,round:2,previousRound:2,preparing:true,open:false}),false);
  assert.equal(previewDisclosureOpen({index:1,previousIndex:0,round:1,previousRound:1,preparing:false,open:true}),false);
  assert.equal(previewDisclosureOpen({index:0,previousIndex:null,round:1,previousRound:null,preparing:true,open:false}),true);
});
test('intelligence remains separate from direct cards and never analysed in frame HUD',()=>{
  const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8'),hud=main.slice(main.indexOf('function hud()'),main.indexOf('function render(){'));
  assert.match(main,/id="wave-intelligence"[^]*?id="side-body"/);assert.match(main,/function render\(\)\{renderIntelligence\(\)/);
  assert.doesNotMatch(hud,/threatAnalyzer|armyReadiness/);assert.doesNotMatch(main,/previewPending|previewFlow|wavePreviewGateMarkup|open-defender-draft/);
  assert.match(main,/draftCardsMarkup\(game,/);
  assert.ok(main.includes("['INPUT','SELECT','TEXTAREA','BUTTON','A','SUMMARY'].includes(document.activeElement.tagName)"));
});
