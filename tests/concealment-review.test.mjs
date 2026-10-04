import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {Game} from '../game/core/game.js';
import {towerStats} from '../game/core/math.js';
import {prepareConcealmentReview} from '../game/core/debug-review.js';
import {EnemyConcealmentEffects} from '../game/render/enemy-concealment-effects.js';
import {towerSupportState} from '../game/render/support-effects.js';
import {ENEMY_RULES,enemyDisarmActive} from '../game/core/enemy-rules.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));

test('development concealment scene uses real round18 stats, normal route movement and visible-hidden-visible transitions without fake ability or data changes',()=>{
  const game=new Game(data,{seed:42}),before=JSON.stringify(data);
  const enemy=prepareConcealmentReview(game),fx=new EnemyConcealmentEffects(new THREE.Scene(),{isVisible:e=>game.combat.isRevealed(e)});
  try{
    assert.equal(game.round,18);assert.equal(game.phase,'combat');assert.equal(game.paused,false);assert.equal(game.speed,1);
    assert.deepEqual(game.towers.map(t=>[t.id,t.family,t.tier,t.state,t.x,t.z]),[[1,'soldier',1,'active',12,17],[2,'soldier',1,'active',25,17]]);
    assert.equal(game.grid.occupied.size,2);assert.equal(game.combat.enemies.length,1);assert.equal(game.combat.spawnQueue.length,0);assert.equal(game.combat.total,1);
    assert.equal(enemy.type,'host_18');assert.equal(enemy.speed,data.enemies.host_18.speed);assert.equal(enemy.armor,data.enemies.host_18.armor);assert.equal(enemy.stealth,true);assert.equal(enemy.disarm,true);
    assert.equal(enemy.hp,1e8);assert.equal(enemy.maxHp,1e8);assert.equal(enemy.pathLength,46);assert.equal(enemy.pathIndex,1);assert.equal(enemy.traveled,0);
    assert.deepEqual(enemy.route,[[12,18.5],[12,24],[25,24],[25,19],[25,14],[12,14],[12,18.5]].map(([x,z])=>({x,z})));
    for(const tower of game.towers){const stats=towerStats(tower,data);assert.equal(stats.damage,data.towers.soldier.levels[0].damage);assert.equal(stats.range,data.towers.soldier.levels[0].range);}
    assert.equal(game.combat.isRevealed(enemy),true);
    const transitions=[],shots=[];let sawDisarm=false,lastPublicPoint=null,departureChecked=false,suppressedVisibleFrames=0;
    game.on((type,shot)=>{if(type==='shot')shots.push(shot);});
    for(let i=0;i<140;i++){
      game.tick(.1);fx.sync(game.combat.enemies,{time:game.combat.elapsed});
      const visible=game.combat.isRevealed(enemy);if(visible!==transitions.at(-1))transitions.push(visible);
      if(i===0){assert.equal(visible,true,'Browser first ticks movement before sampling visibility');assert.equal(fx.object.count,0);assert.equal(fx.states.get(enemy.id).visible,true);}
      if(!visible&&!departureChecked){
        const cloud=fx.clouds.find(c=>c.kind==='departure');assert.ok(cloud,'The first browser-order visible-to-hidden transition creates departure smoke');
        assert.deepEqual(cloud.anchor.toArray(),lastPublicPoint);assert.notEqual(cloud.anchor.z,enemy.z,'Departure uses the previous public point, not the newly hidden location');departureChecked=true;
      }
      if(visible)lastPublicPoint=[enemy.x,.12,enemy.z];
      for(const tower of game.towers){const state=towerSupportState(tower,game.towers,data,{combat:game.combat,phase:game.phase});assert.equal(!!state.byKey.disarm,tower.disarmed);sawDisarm||=tower.disarmed;}
      if(visible){
        const guards=game.towers.filter(t=>game.combat.targetList(t,towerStats(t,data)).includes(enemy));
        assert.ok(guards.length>0,'The publicly revealed enemy is a real guard target');
        assert.ok(enemyDisarmActive(enemy,game.combat.elapsed));
        assert.ok(guards.every(t=>t.disarmed),'Every in-range revealed frame falls inside the actual five-second disarm window');
        suppressedVisibleFrames++;
      }
      if(!visible){assert.deepEqual(fx.states.get(enemy.id),{visible:false});for(const cloud of fx.clouds)assert.ok(!('enemy' in cloud)&&!('id' in cloud),'Smoke retains no hidden actor reference');}
    }
    assert.deepEqual(transitions,[true,false,true,false]);assert.ok(sawDisarm,'Actual nearby disarm windows affect a real guard');
    assert.equal(departureChecked,true);
    assert.ok(enemy.traveled>30&&Math.abs(enemy.traveled-enemy.speed*game.combat.elapsed)<1e-8,'Movement comes from the unchanged speed and normal CombatManager route integrator');
    assert.ok(suppressedVisibleFrames>0);assert.equal(shots.length,0,'Active disarm prevents real visible-target shots');
    assert.equal(enemy.hp,enemy.maxHp,'The longer disarm window covers both reveals in this route timing');
    assert.equal(game.phase,'combat');assert.equal(enemy.dead,false);assert.equal(JSON.stringify(data),before);
    const frozen={elapsed:game.combat.elapsed,x:enemy.x,z:enemy.z,traveled:enemy.traveled};game.paused=true;game.tick(1);assert.deepEqual({elapsed:game.combat.elapsed,x:enemy.x,z:enemy.z,traveled:enemy.traveled},frozen);
  }finally{fx.dispose();}
});

test('the same real concealment review guards naturally attack a visible target after the staggered disarm window expires',()=>{
  const game=new Game(data,{seed:42}),before=JSON.stringify(data),enemy=prepareConcealmentReview(game),shots=[];
  // Only this test fixture starts its combat clock at the real window boundary.
  // The development route, source speed, reveal coverage and ability stay intact.
  const {duration,phasePerId}=ENEMY_RULES.disarm;
  game.combat.elapsed=duration-enemy.id*phasePerId;
  game.on((type,shot)=>{
    if(type!=='shot')return;
    assert.equal(game.combat.canSee(shot.target,shot.source),true);
    assert.equal(shot.source.disarmed,false);assert.equal(enemyDisarmActive(enemy,game.combat.elapsed),false);
    shots.push(shot);
  });
  for(let i=0;i<2;i++)game.tick(.1);
  assert.equal(shots.length,1);assert.equal(shots[0].source,game.towers[0]);assert.equal(shots[0].target,enemy);
  assert.equal(game.combat.isRevealed(enemy),true);assert.ok(enemy.hp<enemy.maxHp,'The actual guard projectile lands after disarm expiry');
  assert.equal(enemy.speed,data.enemies.host_18.speed);assert.ok(Math.abs(enemy.traveled-enemy.speed*.2)<1e-8);
  assert.equal(enemy.stealth,true);assert.equal(enemy.disarm,true);assert.equal(JSON.stringify(data),before);
});
