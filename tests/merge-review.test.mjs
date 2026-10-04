import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {prepareMergeReview} from '../game/core/debug-review.js';
import {mergeTowerKey,mergeTowerFromBadge} from '../ui/draft-input.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));

test('development merge fixture builds five real candidates and one exact pair for all eight basic families and five mergeable ranks',()=>{
  const originalData=JSON.stringify(data),basics=Object.entries(data.towers).filter(([,stats])=>!stats.advanced);assert.equal(basics.length,8);
  for(const [family]of basics)for(let tier=1;tier<=5;tier++){
    const game=new Game(data,{seed:42}),control=new Game(data,{seed:42});let placed=0;game.on(type=>{if(type==='place')placed++;});
    assert.equal(prepareMergeReview(game,family,tier),true);assert.equal(placed,5);assert.equal(game.phase,'select');assert.equal(game.towers.length,5);assert.equal(game.roundCandidates.length,5);assert.equal(game.grid.occupied.size,5);assert.equal(game.nextId,6);
    assert.ok(game.draft.draws.every(draw=>draw.placed));assert.equal(game.activeDraw,-1);assert.equal(game.draft.roundForced,null);
    assert.deepEqual(game.towers.slice(0,2).map(t=>[t.family,t.tier,t.x,t.z]),[[family,tier,15,18],[family,tier,16,18]]);assert.ok(game.grid.route.length>1);
    assert.equal(game.towers.filter(tower=>mergeTowerKey(game,tower.id)).length,2);assert.equal(game.rng(),control.rng(),'Forced reveals do not alter random state');
    const anchor=game.towers[1],key=mergeTowerKey(game,anchor.id);assert.equal(mergeTowerFromBadge(game,anchor.id,key),true);assert.equal(game.phase,'ready');assert.equal(anchor.tier,tier+1);assert.deepEqual([anchor.x,anchor.z],[16,18]);assert.equal(game.towers.filter(t=>t.state==='ruin').length,4);
  }
  assert.equal(JSON.stringify(data),originalData,'Fixture never rewrites campaign stats or recipes');
});

test('default fixture clears previous combat actors and invalid fixture requests leave the current game untouched',()=>{
  const game=new Game(data,{seed:42});game.phase='combat';game.paused=true;game.speed=3;game.combat.enemies=[{id:1}];game.combat.projectiles=[{}];game.combat.spawnQueue=[{}];
  const before=JSON.stringify({phase:game.phase,draws:game.draft.draws,enemy:game.combat.enemies});
  for(const [family,tier]of [['missing',1],['highking',1],['archer',0],['archer',6],['archer',1.5]]){assert.equal(prepareMergeReview(game,family,tier),false);assert.equal(JSON.stringify({phase:game.phase,draws:game.draft.draws,enemy:game.combat.enemies}),before);}
  assert.equal(prepareMergeReview(game),true);assert.equal(game.phase,'select');assert.equal(game.paused,false);assert.equal(game.speed,1);assert.deepEqual(game.combat.enemies,[]);assert.deepEqual(game.combat.projectiles,[]);assert.deepEqual(game.combat.spawnQueue,[]);assert.equal(game.selection.family,'archer');assert.equal(game.selection.tier,3);
});
