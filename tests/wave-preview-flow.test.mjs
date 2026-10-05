import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {WavePreviewFlow,previewDisclosureOpen} from '../ui/wave-preview-flow.js';
import {prepareWavePreviewReview,prepareCommandPointsReview} from '../game/core/debug-review.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
function fixture(){const game=new Game(data,{seed:428}),flow=new WavePreviewFlow();Object.defineProperty(game,'previewPending',{get:()=>flow.pending(game)});return {game,flow};}
function placeFive(game){for(const [x,z] of [[16,17],[18,17],[20,17],[17,19],[19,19]])assert.equal(game.place(x,z),true);}

test('initial preview has five latent candidates and blocks placement without RNG or CP consumption',()=>{
  const {game,flow}=fixture(),control=new Game(data,{seed:428});
  assert.equal(flow.pending(game),true);assert.equal(game.draft.draws.length,5);
  assert.ok(game.draft.draws.every(draw=>!draw.placed));assert.equal(game.place(16,17),false);
  assert.equal(game.towers.length,0);assert.equal(game.commandPoints.value,3);assert.equal(game.rng(),control.rng());
});
test('opening a preview changes no core phase, recruits, map or seeded generator',()=>{
  const {game,flow}=fixture(),control=new Game(data,{seed:428});
  assert.equal(flow.open(game),true);assert.equal(flow.open(game),false);assert.equal(game.phase,'build');
  assert.equal(game.grid.occupied.size,0);assert.deepEqual(game.draft.draws,control.draft.draws);assert.equal(game.rng(),control.rng());
});
test('open draft completes all five placements and keeps the chosen defender before starting',()=>{
  const {game,flow}=fixture();flow.open(game);placeFive(game);
  assert.equal(game.phase,'select');assert.equal(flow.pending(game),false);
  game.select(game.draft.draws[0].towerId);assert.equal(game.keep(),true);assert.equal(game.phase,'ready');
  assert.equal(game.towers.filter(t=>t.state==='active').length,1);assert.equal(game.startCombat(),true);assert.equal(game.phase,'combat');
});
test('a completed wave opens the new preview before a fresh draft',()=>{
  const {game,flow}=fixture();flow.open(game);placeFive(game);game.select(game.draft.draws[0].towerId);game.keep();game.startCombat();
  game.combat.enemies=[];game.combat.spawnQueue=[];game.completeWave();
  assert.equal(game.round,2);assert.equal(flow.pending(game),true);assert.equal(game.place(14,17),false);
  assert.equal(flow.open(game),true);assert.equal(game.place(14,17),true);
});
test('Reserve remains fixed and counts among the five after opening the next preview',()=>{
  const {game,flow}=fixture();flow.open(game);placeFive(game);
  const carried=game.towers[0],position=[carried.x,carried.z];game.select(carried.id);assert.equal(game.reserve(),true);
  game.select(game.towers.find(t=>t.state==='draft').id);game.keep();game.startCombat();game.combat.enemies=[];game.combat.spawnQueue=[];game.completeWave();
  assert.equal(flow.pending(game),true);assert.equal(game.draft.draws.length,5);assert.equal(game.draft.draws[0].towerId,carried.id);
  assert.equal(game.draft.draws[0].fixedPosition,true);assert.deepEqual([carried.x,carried.z],position);
  flow.open(game);assert.equal(game.draft.draws.filter(draw=>!draw.placed).length,4);assert.deepEqual([carried.x,carried.z],position);
});
test('Controlled RNG Reroll and Reserve work after the reviewed draft has five placements',()=>{
  const {game,flow}=fixture();flow.open(game);placeFive(game);assert.equal(game.reroll(),true);
  assert.equal(game.draft.draws.length,5);assert.equal(game.commandPoints.value,2);assert.equal(game.phase,'select');
  game.select(game.draft.draws[1].towerId);assert.equal(game.reserve(),true);assert.equal(game.commandPoints.value,1);
});
test('pre-preview Move, wall demolition and active recipe crafting cannot mutate preparation',()=>{
  const {game,flow}=fixture();flow.runScene(game,()=>prepareCommandPointsReview(game));
  game.phase='build';game.round=11;game.draft.roll(game.economy.mastery);flow.reset(game);
  const wall=game.towers.find(t=>t.state==='ruin');game.select(wall.id);const count=game.towers.length,cp=game.commandPoints.value;
  assert.equal(game.remove(),false);assert.equal(game.beginMove(),false);assert.equal(game.canCombine(game.towers.find(t=>t.state==='active')),false);
  assert.equal(game.towers.length,count);assert.equal(game.commandPoints.value,cp);flow.open(game);assert.equal(game.remove(),true);
});
test('forthcoming index changes at combat start and omits futures after final wave',()=>{
  const {game,flow}=fixture();assert.equal(flow.nextIndex(game),0);game.round=10;game.phase='ready';assert.equal(flow.nextIndex(game),9);
  game.phase='combat';assert.equal(flow.nextIndex(game),10);game.round=50;assert.equal(flow.nextIndex(game),null);
  game.phase='ready';assert.equal(flow.nextIndex(game),49);for(const phase of ['won','lost']){game.phase=phase;assert.equal(flow.nextIndex(game),null);}
});
test('new runs and DEV scenes cannot inherit another run’s reviewed draft state',()=>{
  const {game,flow}=fixture();flow.open(game);const fresh=new Game(data,{seed:428});assert.equal(flow.pending(fresh),true);
  flow.runScene(game,()=>prepareWavePreviewReview(game,14));flow.reset(game);assert.equal(flow.pending(game),true);assert.equal(game.round,14);
  assert.equal(game.towers.filter(t=>t.state==='active').length,4);assert.equal(game.draft.draws.length,5);
});
test('DEV scene guard is restored even when scene setup fails',()=>{
  const {game,flow}=fixture();assert.throws(()=>flow.runScene(game,()=>{assert.equal(flow.pending(game),false);throw Error('scene failure');}));
  assert.equal(flow.pending(game),true);
});

test('new interwave gate expands intelligence even when combat already previewed the same wave',()=>{
  assert.equal(previewDisclosureOpen({index:1,previousIndex:1,pending:true,previousPending:false,open:false}),true);
  assert.equal(previewDisclosureOpen({index:1,previousIndex:1,pending:true,previousPending:true,open:false}),false,'ordinary inspection respects a player-collapsed preview');
  assert.equal(previewDisclosureOpen({index:1,previousIndex:1,pending:false,previousPending:true,open:false}),false,'opening the draft preserves its compact preview');
});

test('main keeps intelligence outside selected details and never analyses waves in the frame HUD',()=>{
  const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8'),hud=main.slice(main.indexOf('function hud()'),main.indexOf('function render(){'));
  assert.match(main,/id="wave-intelligence"[^]*?id="side-body"/);assert.match(main,/function render\(\)\{renderIntelligence\(\)/);
  assert.doesNotMatch(hud,/threatAnalyzer|armyReadiness/);assert.match(main,/if\(previewFlow\.pending\(game\)\).*wavePreviewGateMarkup/);
  assert.match(main,/\['INPUT','SELECT','TEXTAREA','BUTTON','A','SUMMARY'\]\.includes\(document.activeElement.tagName\)/,'Space on a native details summary must not open a draft, keep a defender or start combat');
});
