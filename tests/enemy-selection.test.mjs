import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL('../data/'+key+'.json',import.meta.url)))]));
function arena(){const game=new Game(data,{seed:12});game.phase='combat';game.combat.spawnQueue=[{time:999999,type:'host_01'}];return game;}
function spawn(game,type='host_01'){const enemy=game.combat.spawn(type);enemy.speed=0;enemy.x=12;enemy.z=20;return enemy;}

test('real enemy and tower IDs are independent, and either selection clears the other with one change',()=>{
  const original=JSON.stringify(data),game=arena(),enemy=spawn(game),tower={id:enemy.id,family:'soldier',tier:1,state:'active',x:3,z:10};
  game.towers.push(tower);game.select(tower.id);game.previewRecipeId='knight';let changes=0;
  game.on(type=>{if(type==='change')changes++;});
  assert.equal(game.selectEnemy(enemy.id),true);assert.equal(game.selected,null);assert.equal(game.selection,null);assert.equal(game.enemySelection,enemy);assert.equal(game.previewRecipeId,null);assert.equal(changes,1);
  game.select(tower.id);assert.equal(game.selectedEnemy,null);assert.equal(game.enemySelection,null);assert.equal(game.selection,tower);assert.equal(changes,2);
  game.selectEnemy(enemy.id);game.select(null);assert.equal(game.selectedEnemy,null);assert.equal(game.selection,null);assert.equal(JSON.stringify(data),original,'Picking cannot rewrite source definitions');
});

test('selection rejects missing, dead, hidden and noncombat enemies without changing a valid selection',()=>{
  const game=arena(),visible=spawn(game),hidden=spawn(game,'host_08');
  assert.equal(game.combat.isRevealed(hidden),false);assert.equal(game.selectEnemy(visible.id),true);
  for(const invalid of [null,undefined,'1',NaN,-1,999,hidden.id]){assert.equal(game.selectEnemy(invalid),false);assert.equal(game.enemySelection,visible);}
  hidden.dead=true;hidden.cloaked=false;assert.equal(game.selectEnemy(hidden.id),false);
  visible.hp=0;assert.equal(game.enemySelection,null);assert.equal(game.selectEnemy(visible.id),false);
  visible.hp=visible.maxHp;game.phase='ready';assert.equal(game.enemySelection,null);assert.equal(game.selectEnemy(visible.id),false);game.tick(0);assert.equal(game.selectedEnemy,null);
});

test('actual detector reveal allows a cloaked enemy, then loss of reveal clears even while paused',()=>{
  const game=arena(),enemy=spawn(game,'host_08'),detector={id:20,family:'soldier',tier:1,state:'active',x:12,z:19};
  game.towers.push(detector);assert.equal(enemy.cloaked,true);assert.equal(game.combat.isRevealed(enemy),true);assert.equal(game.selectEnemy(enemy.id),true);
  game.paused=true;game.tick(3);assert.equal(game.enemySelection,enemy);assert.equal(game.combat.elapsed,0);
  detector.x=30;let changes=0;game.on(type=>{if(type==='change'){changes++;assert.equal(game.enemySelection,null);assert.equal(game.selectedEnemy,null);}});
  assert.equal(game.enemySelection,null,'The getter itself never discloses a newly hidden enemy');game.tick(0);game.tick(0);assert.equal(changes,1);assert.equal(game.selectedEnemy,null);
});

test('a real timed cloak transition clears inspection without creating a tower selection',()=>{
  const game=arena(),enemy=spawn(game,'host_38');game.combat.elapsed=4.1;game.tick(0);
  assert.equal(enemy.cloaked,false);assert.equal(game.selectEnemy(enemy.id),true);game.tick(2);
  assert.equal(enemy.cloaked,true);assert.equal(game.selectedEnemy,null);assert.equal(game.enemySelection,null);assert.equal(game.selected,null);
});

test('actual lethal damage and keep escape clear inspection before event listeners, preserving hit/death order',()=>{
  for(const action of ['kill','leak']){
    const game=arena(),enemy=spawn(game);game.selectEnemy(enemy.id);const events=[];
    game.on(type=>{events.push(type);if(type==='death'||type==='leak'){assert.equal(game.selectedEnemy,null);assert.equal(game.enemySelection,null);}});
    if(action==='kill'){game.combat.damage(enemy,enemy.hp+1,'pure',{},null);assert.ok(events.indexOf('hit')<events.indexOf('death'));assert.equal(game.kills,1);}
    else {enemy.pathIndex=enemy.route.length;game.tick(0);assert.equal(game.leaks,1);}
    assert.equal(events.filter(type=>type==='change').length,1);assert.equal(game.enemySelection,null);
  }
});

test('wave completion, loss and the next combat start remove selection before phase notifications',()=>{
  for(const action of ['complete','lost','won','start']){
    const game=arena(),enemy=spawn(game);game.selectEnemy(enemy.id);
    game.on(type=>{if(['wave-complete','lost','won','wave'].includes(type)){assert.equal(game.enemySelection,null);assert.equal(game.selectedEnemy,null);}});
    if(action==='complete')game.completeWave();else if(action==='start'){game.phase='ready';assert.equal(game.startCombat(),true);}else game.end(action==='won');
    assert.equal(game.selectedEnemy,null);assert.equal(game.enemySelection,null);
  }
});
