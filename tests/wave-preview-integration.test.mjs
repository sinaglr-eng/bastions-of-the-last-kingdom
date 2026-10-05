import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {WaveThreatAnalyzer} from '../game/core/wave-threats.js';
import {ArmyReadiness} from '../game/core/army-readiness.js';
import {nextWavePreviewIndex} from '../ui/wave-preview-flow.js';
import {RecipeMarkerActivation} from '../ui/recipe-marker-input.js';
import {DraftCardActivation,drawKeeperKey,keepDrawKeeper,mergeTowerKey,mergeTowerFromBadge} from '../ui/draft-input.js';
import {prepareWavePreviewReview} from '../game/core/debug-review.js';
import {campaignEnemies,campaignRecipes,campaignTowers,campaignWaves} from '../game/core/campaign-roster.js';

const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,enemies:campaignEnemies(raw.enemies),recipes:campaignRecipes(raw.recipes),towers:campaignTowers(raw.towers),waves:campaignWaves(raw.waves)};
const pointer={pointerType:'mouse',button:0,clientX:100,clientY:100};
const fixture=()=>new Game(data,{seed:274});
const resources=game=>JSON.stringify({towers:game.towers,occupied:[...game.grid.occupied],draws:game.draft.draws,cp:game.commandPoints.value,gold:game.economy.gold,lives:game.lives,score:game.score,phase:game.phase,round:game.round});
function placeDraft(game,family='mage',z=10+game.round*2){
  const candidates=[];
  for(const [index,x] of [14,16,18,20,22].entries()){
    if(game.draft.draws[index].placed)continue;
    game.activeDraw=index;game.draft.roundForced=family?{family,tier:1}:null;assert.equal(game.place(x,z),true);candidates.push(game.selection);
  }
  game.draft.roundForced=null;return candidates;
}
function winActualWave(game){
  assert.equal(game.startCombat(),true);
  for(const queued of game.combat.spawnQueue.splice(0))game.combat.spawn(queued.type,queued.modifiers);
  const expected=game.wave.groups.reduce((count,group)=>count+group.count,0);
  assert.equal(game.combat.enemies.length,expected);
  for(const enemy of game.combat.enemies)game.combat.damage(enemy,enemy.maxHp*100+1000,'pure',{});
  game.combat.update(.01);
}

test('A fresh run immediately accepts all five placements while sidebar analysis keeps recruits latent',()=>{
  const game=fixture(),analyzer=new WaveThreatAnalyzer(data),readiness=new ArmyReadiness(data),before=resources(game);
  assert.equal(game.phase,'build');assert.equal(game.draft.draws.length,5);
  assert.ok(game.draft.draws.every(draw=>!draw.placed&&!draw.family));
  const outlook=analyzer.outlook(nextWavePreviewIndex(game),game.waveLimit);
  assert.equal(outlook.next.number,1);assert.equal(outlook.next.totalCount,8);
  assert.equal(readiness.evaluate(outlook.next,game.towers).activeCount,0);assert.equal(resources(game),before);
  const candidates=placeDraft(game,null);
  assert.equal(candidates.length,5);assert.equal(game.phase,'select');assert.equal(game.roundCandidates.length,5);
  assert.equal(game.commandPoints.value,3);assert.equal(game.commandActions.reroll.available,true);assert.equal(game.commandActions.reserve.available,true);
});

test('Actual wave completion revalidates stale world-recipe input while the new draft is immediately usable',()=>{
  const game=fixture();
  for(const family of ['frostwarden','soldier','stormcaller']){
    placeDraft(game,family);
    game.select(game.draft.draws[0].towerId);assert.equal(game.keep(),true);
    if(family!=='stormcaller')winActualWave(game);
  }
  const anchor=game.towers.find(t=>t.state==='active'&&t.family==='frostwarden'),marker=new RecipeMarkerActivation(()=>100);
  assert.equal(marker.activate(game,anchor.id,'rimewatch',pointer),false);assert.equal(game.recipePreview.recipe.id,'rimewatch');
  winActualWave(game);assert.equal(game.round,4);assert.equal(game.phase,'build');assert.equal(nextWavePreviewIndex(game),3);
  assert.equal(game.selection,null);assert.equal(game.recipePreview.recipe.id,'rimewatch');
  const before=resources(game);
  assert.equal(marker.activate(game,anchor.id,'rimewatch',pointer),false);assert.equal(resources(game),before);
  assert.equal(anchor.family,'frostwarden');assert.equal(game.recipePreview.recipe.id,'rimewatch');
  const analysis=new WaveThreatAnalyzer(data).analyze(3),readiness=new ArmyReadiness(data),oldArmy=readiness.evaluate(analysis,game.towers);
  assert.equal(oldArmy.activeCount,3);assert.equal(marker.activate(game,anchor.id,'rimewatch',pointer),true);
  assert.equal(anchor.family,'rimewatch');assert.equal(game.phase,'build');assert.ok(game.draft.draws.every(draw=>!draw.placed&&!draw.family));
  const newArmy=readiness.evaluate(analysis,game.towers);assert.equal(newArmy.activeCount,1);assert.notEqual(newArmy,oldArmy);
});

test('A fixed Reserve crosses an actual completed wave, four placements and stale keeper input without relocation',()=>{
  const game=fixture();placeDraft(game);
  const carried=game.towers[0],position={x:carried.x,z:carried.z},oldKey=drawKeeperKey(game,0);
  game.select(carried.id);assert.equal(game.reserve(),true);game.select(game.draft.draws[1].towerId);assert.equal(game.keep(),true);
  winActualWave(game);assert.equal(game.phase,'build');assert.equal(game.draft.draws.length,5);
  assert.equal(game.draft.draws.filter(draw=>!draw.placed&&!draw.family).length,4);
  assert.equal(game.draft.draws[0].towerId,carried.id);assert.equal(game.draft.draws[0].fixedPosition,true);assert.equal(game.grid.occupied.get(`${position.x},${position.z}`),carried.id);
  const before=resources(game),input=new DraftCardActivation(()=>100);
  assert.equal(input.activate(game,0,pointer),false);assert.equal(input.activate(game,0,pointer),false);assert.equal(game.keep(),false);
  assert.equal(resources(game),before);
  const fresh=placeDraft(game,'archer');assert.equal(fresh.length,4);assert.equal(game.phase,'select');assert.equal(game.roundCandidates.length,5);
  assert.equal(game.towers.find(t=>t.id===carried.id),carried);assert.deepEqual({x:carried.x,z:carried.z},position);
  game.select(carried.id);assert.equal(keepDrawKeeper(game,0,carried.id,oldKey),false);
  assert.equal(keepDrawKeeper(game,0,carried.id,drawKeeperKey(game,0)),true);assert.equal(carried.state,'active');assert.equal(game.commandPoints.value,2);
});

test('A stale merge badge cannot execute against the immediately available next draft inventory',()=>{
  const game=fixture();placeDraft(game,'archer');
  const oldId=game.draft.draws[0].towerId,key=mergeTowerKey(game,oldId);assert.ok(key);
  game.select(oldId);assert.equal(game.keep(),true);winActualWave(game);
  const before=resources(game);assert.equal(mergeTowerFromBadge(game,oldId,key),false);assert.equal(resources(game),before);
  placeDraft(game,'archer');const nextId=game.draft.draws[0].towerId;
  assert.equal(mergeTowerFromBadge(game,nextId,key),false);assert.equal(game.phase,'select');
  assert.equal(mergeTowerFromBadge(game,nextId,mergeTowerKey(game,nextId)),true);assert.equal(game.selection.tier,2);assert.equal(game.phase,'ready');
});

test('Repeated sidebar intelligence leaves seeded placements, CP Reroll and fixed Reserve unchanged',()=>{
  const game=fixture(),baseline=fixture(),analyzer=new WaveThreatAnalyzer(data),readiness=new ArmyReadiness(data);
  const inspect=()=>{
    const before=resources(game),outlook=analyzer.outlook(nextWavePreviewIndex(game),game.waveLimit);
    assert.equal(analyzer.outlook(nextWavePreviewIndex(game),game.waveLimit).next,outlook.next);
    readiness.evaluate(outlook.next,game.towers);assert.equal(resources(game),before);
  };
  inspect();placeDraft(game,null);placeDraft(baseline,null);assert.equal(resources(game),resources(baseline));
  inspect();
  for(const current of [game,baseline]){
    assert.equal(current.reroll(),true);assert.equal(current.commandPoints.value,2);
    current.select(current.draft.draws[0].towerId);assert.equal(current.reserve(),true);assert.equal(current.commandPoints.value,1);
    current.select(current.draft.draws[1].towerId);assert.equal(current.keep(),true);
  }
  inspect();assert.equal(resources(game),resources(baseline));winActualWave(game);winActualWave(baseline);
  assert.equal(game.draft.draws.length,5);assert.equal(game.draft.draws[0].fixedPosition,true);
  const carried=structuredClone(game.draft.draws[0].identity);
  inspect();assert.equal(placeDraft(game,null).length,4);assert.equal(placeDraft(baseline,null).length,4);
  assert.equal(game.roundCandidates.length,5);assert.equal(resources(game),resources(baseline));
  inspect();assert.equal(game.reroll(),true);assert.equal(baseline.reroll(),true);
  assert.equal(game.commandPoints.value,0);assert.deepEqual(game.draft.draws[0].identity,carried);
  assert.equal(resources(game),resources(baseline));assert.equal(game.rng(),baseline.rng());
});

test('Final authored boss completion omits future intelligence and a fresh run immediately accepts placement',()=>{
  const game=fixture(),analyzer=new WaveThreatAnalyzer(data);
  assert.equal(prepareWavePreviewReview(game,50),true);
  const preview=analyzer.outlook(nextWavePreviewIndex(game),game.waveLimit);
  assert.equal(preview.next.number,50);assert.equal(preview.boss.distance,0);assert.equal(Object.hasOwn(preview,'after'),false);
  assert.equal(preview.next.name,'Lord Bernhard, the Black Sorcerer on the Wyvern Queen');
  placeDraft(game,'mage',22);game.select(game.draft.draws[0].towerId);assert.equal(game.keep(),true);
  winActualWave(game);assert.equal(game.phase,'won');assert.equal(nextWavePreviewIndex(game),null);
  const fresh=fixture();assert.equal(nextWavePreviewIndex(fresh),0);assert.equal(fresh.place(14,12),true);
  assert.equal(fresh.draft.draws.length,5);assert.equal(fresh.draft.draws.filter(draw=>draw.placed).length,1);assert.equal(fresh.commandPoints.value,3);
});
