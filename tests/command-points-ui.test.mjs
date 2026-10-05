import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {draftCardsMarkup} from '../ui/draft-cards.js';
import {commandPointsMarkup} from '../ui/command-points.js';
import {DraftCardActivation,drawnTower,drawKeeperKey,eligibleDrawKeeper,keepDrawKeeper,mergeTowerKey,mergeTowerFromBadge} from '../ui/draft-input.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
function placedGame(){
  const game=new Game(data,{seed:42});game.draft.forced={family:'soldier',tier:2};game.draft.roll(game.economy.mastery);
  for(let x=3;x<8;x++)assert.equal(game.place(x,3),true);
  return game;
}
function carryGame(){
  const game=placedGame();game.select(game.draft.draws[0].towerId);assert.equal(game.reserve(),true);
  game.select(game.draft.draws[1].towerId);assert.equal(game.keep(),true);
  assert.equal(game.startCombat(),true);game.completeWave();assert.equal(game.round,2);return game;
}
const countCards=html=>(html.match(/class="draw-slot/g)||[]).length;
const button=(html,action)=>[...html.matchAll(/<button\b[^>]*>/g)].map(match=>match[0]).find(tag=>tag.includes(`data-action="${action}"`));
const pointer={pointerType:'mouse',button:0,clientX:100,clientY:100};

test('returning reserve is already placed at its fixed tile and selectable among exactly five cards',()=>{
  const game=carryGame(),html=draftCardsMarkup(game,data,{soldier:'soldier.png'});
  assert.equal(countCards(html),5);assert.equal((html.match(/Unrevealed defender\. Build/g)||[]).length,4);
  assert.match(html,/reserved-return/);assert.match(html,/Reserved from previous draft/);assert.match(html,/Fixed position/);assert.match(html,/Already placed at its fixed position/);assert.match(html,/soldier\.png/);
  assert.match(html,/data-action="draw" data-index="0"/);assert.doesNotMatch(html,/keep-draw|Reserved for next draft/);
  const draw=game.draft.draws[0],tower=drawnTower(game,0);assert.equal(draw.placed,true);assert.equal(draw.fixedPosition,true);
  assert.equal(tower.id,draw.identity.id);assert.deepEqual([tower.x,tower.z],[3,3]);assert.equal(tower.state,'draft');assert.equal(tower.round,game.round);
  const input=new DraftCardActivation(()=>1000);assert.equal(input.activate(game,0,pointer),false);assert.equal(game.selected,tower.id);assert.equal(game.phase,'build');
  assert.equal(eligibleDrawKeeper(game,0,tower.id),false,'The returning fixed card cannot resolve an incomplete draft');
});

test('paid reserve displays its inactive fixed path-blocking state, cannot be kept, and creates no sixth card',()=>{
  const game=placedGame(),tower=drawnTower(game,1);game.select(tower.id);assert.equal(game.reserve(),true);
  const html=draftCardsMarkup(game,data,{soldier:'saved.png'}),before=JSON.stringify(game.draft);
  assert.equal(countCards(html),5);assert.match(html,/reserved-pending/);assert.match(html,/Reserved for next draft/);assert.match(html,/Inactive this wave at its fixed position/);assert.match(html,/Inactive · blocks path/);
  assert.equal(game.towers.find(current=>current.id===tower.id),tower);assert.equal(tower.state,'reserved');assert.deepEqual([tower.x,tower.z],[4,3]);assert.equal(game.grid.occupied.get('4,3'),tower.id);
  assert.equal((html.match(/data-action="draw"/g)||[]).length,4);assert.doesNotMatch(html,/data-index="1"/);
  assert.equal(drawnTower(game,1),null);assert.equal(eligibleDrawKeeper(game,1,tower.id),false);assert.equal(keepDrawKeeper(game,1,tower.id),false);
  const input=new DraftCardActivation(()=>1000);assert.equal(input.activate(game,1,pointer),false);assert.equal(game.selected,null);
  assert.equal(JSON.stringify(game.draft),before,'Rendering and rejected input leave the reserve state intact');
});

test('reserving a different current unit removes the returning badge and keeps only the new paid reserve',()=>{
  const game=carryGame();for(let x=3;x<7;x++)assert.equal(game.place(x,5),true);
  assert.match(draftCardsMarkup(game,data,{}),/Reserved from previous draft/);
  game.select(game.draft.draws[2].towerId);assert.equal(game.reserve(),true);
  const html=draftCardsMarkup(game,data,{});assert.equal(countCards(html),5);
  assert.doesNotMatch(html,/Reserved from previous draft/);assert.equal((html.match(/class="draw-reservation pending"/g)||[]).length,1);
  const oldCarry=drawnTower(game,0);game.select(oldCarry.id);assert.equal(eligibleDrawKeeper(game,0,oldCarry.id),true);
});

test('after four new placements the fixed carried card can be kept without changing its tile',()=>{
  const game=carryGame(),tower=drawnTower(game,0),location=[tower.x,tower.z];
  for(let x=3;x<7;x++)assert.equal(game.place(x,5),true);
  assert.equal(game.phase,'select');game.select(tower.id);assert.equal(eligibleDrawKeeper(game,0,tower.id),true);
  const html=draftCardsMarkup(game,data,{});assert.match(html,/data-action="keep-draw" data-index="0"/);assert.match(html,/Fixed position\. Double-click/);
  assert.equal(keepDrawKeeper(game,0,tower.id,drawKeeperKey(game,0)),true);assert.equal(tower.state,'active');assert.deepEqual([tower.x,tower.z],location);
});

test('prices and visible reasons explain initial placement, used reroll, committed reserve and insufficient CP',()=>{
  const initial=new Game(data,{seed:1}),initialHtml=commandPointsMarkup(initial);
  for(const action of ['reroll','reserve'])assert.match(button(initialHtml,action),/disabled/);
  assert.match(initialHtml,/1 CP/);assert.match(initialHtml,/Place all five defenders first/);
  const game=placedGame();assert.doesNotMatch(button(commandPointsMarkup(game),'reroll'),/disabled/);
  assert.equal(game.reroll(),true);assert.match(button(commandPointsMarkup(game),'reroll'),/disabled/);assert.match(commandPointsMarkup(game),/Reroll already used/);
  game.select(game.draft.draws[0].towerId);assert.equal(game.reserve(),true);
  assert.match(button(commandPointsMarkup(game),'reserve'),/disabled/);assert.match(commandPointsMarkup(game),/One defender is already reserved/);
  const poor=placedGame();poor.commandPoints.value=0;const html=commandPointsMarkup(poor);
  assert.match(button(html,'reroll'),/disabled/);assert.match(button(html,'reserve'),/disabled/);assert.match(html,/Not enough Command Points/);assert.equal((html.match(/<b>1 CP<\/b>/g)||[]).length,2);
});

test('configured costs are rendered and disabled reasons are escaped without changing game state',()=>{
  const game={phase:'build',commandActions:{reroll:{available:false,cost:4,reason:'Need <four> CP & "all" placements'},reserve:{available:true,cost:3,reason:''}}};
  const before=JSON.stringify(game),html=commandPointsMarkup(game);
  assert.match(html,/4 CP/);assert.match(html,/3 CP/);assert.match(html,/Need &lt;four&gt; CP &amp; &quot;all&quot; placements/);assert.doesNotMatch(html,/<four>/);
  assert.equal(JSON.stringify(game),before);
});

test('move UI guides defender then wall selection and offers a free cancel, without spending during rendering',()=>{
  const game=placedGame();game.keep();const original=game.commandPoints.value;
  assert.match(commandPointsMarkup(game,{context:'sidebar'}),/2 CP/);assert.equal(game.beginMove(),true);
  let html=commandPointsMarkup(game,{context:'sidebar'});assert.match(html,/Choose a highlighted retained defender/);assert.match(html,/data-action="cancel-move"/);assert.match(html,/Points are spent only after a valid move/);
  assert.equal(game.selectMove(game.commandMove.eligibleDefenders[0].id),true);html=commandPointsMarkup(game,{context:'sidebar'});
  assert.match(html,/Choose a highlighted castle wall/);assert.equal(game.commandPoints.value,original);
  assert.equal(game.cancelMove(),true);assert.doesNotMatch(commandPointsMarkup(game,{context:'sidebar'}),/data-action="cancel-move"/);assert.equal(game.commandPoints.value,original);
  game.phase='combat';assert.match(button(commandPointsMarkup(game,{context:'sidebar'}),'move'),/disabled/);assert.match(commandPointsMarkup(game,{context:'sidebar'}),/Move is available between waves/);
});

test('stale keep tokens and pointer pairs cannot keep a rerolled defender even when forced RNG preserves its identity',()=>{
  const game=placedGame(),tower=drawnTower(game,0);game.select(tower.id);const key=drawKeeperKey(game,0),oldTier=tower.tier,oldFamily=tower.family;
  let now=1000;const input=new DraftCardActivation(()=>now);input.activate(game,0,pointer);
  assert.equal(game.reroll(),true);assert.equal(tower.tier,oldTier);assert.equal(tower.family,oldFamily);
  assert.notEqual(drawKeeperKey(game,0),key);assert.equal(keepDrawKeeper(game,0,tower.id,key),false);
  now+=100;assert.equal(input.activate(game,0,pointer),false);assert.equal(game.phase,'select');
  now+=100;assert.equal(input.activate(game,0,pointer),true);assert.equal(game.phase,'ready');
});

test('merge controls remain valid for four available candidates after Reserve and reject a stale reroll key',()=>{
  const game=placedGame(),tower=drawnTower(game,0),key=mergeTowerKey(game,tower.id);assert.ok(key);
  assert.equal(game.reroll(),true);assert.equal(mergeTowerFromBadge(game,tower.id,key),false);
  game.select(game.draft.draws[4].towerId);assert.equal(game.reserve(),true);
  const current=mergeTowerKey(game,tower.id),html=draftCardsMarkup(game,data,{});assert.ok(current);assert.match(html,/data-action="merge-tower"/);
  assert.equal(mergeTowerFromBadge(game,tower.id,current),true);assert.equal(game.phase,'ready');assert.equal(game.towers.filter(t=>t.state==='active').length,1);assert.equal(game.towers.filter(t=>t.state==='ruin').length,3);
});

test('draft controls disappear after commitment and ended runs expose no CP action',()=>{
  const game=placedGame();game.keep();assert.equal(commandPointsMarkup(game),'');
  for(const phase of ['won','lost']){game.phase=phase;assert.equal(commandPointsMarkup(game),'');assert.equal(commandPointsMarkup(game,{context:'sidebar'}),'');}
});
