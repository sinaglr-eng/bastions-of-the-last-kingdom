import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Scene} from 'three';
import {Game} from '../game/core/game.js';
import {ENEMY_RULES as R,enemyDisarmActive} from '../game/core/enemy-rules.js';
import {CombatEffects} from '../game/render/combat-effects.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL('../data/'+key+'.json',import.meta.url)))]));
const close=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-8,`${message}: ${actual} != ${expected}`);
function arena(speed=1){
  const game=new Game(data,{seed:42});game.phase='combat';game.speed=speed;
  game.combat.start({groups:[{type:'host_01',count:3,interval:.5}]});
  game.combat.spawnQueue.push({time:1e6,type:'host_01',modifiers:{}});
  return game;
}
function longRoute(enemy,x=0){
  enemy.x=x;enemy.z=0;enemy.route=[{x,z:0},{x:x+10000,z:0}];enemy.pathLength=10000;enemy.pathIndex=1;
  return enemy;
}
function clockArena(speed){
  const game=arena(speed),actors={};
  const target=longRoute(game.combat.spawn('host_01',{hp:1e5}));target.speed=0;
  const tower={id:100,family:'archer',tier:1,state:'active',x:0,z:0,priority:'first',cooldown:.4,kills:0};game.towers.push(tower);
  for(const [index,type] of ['host_15','host_32','host_14','host_24','host_38','host_37','host_42'].entries()){
    const enemy=longRoute(game.combat.spawn(type),100+index*20);enemy.speed=0;actors[type]=enemy;
  }
  actors.host_42.speed=data.enemies.host_42.speed;
  actors.host_15.hp=actors.host_15.maxHp*.2;
  game.combat.applyEffects(actors.host_15,{healingBlockDuration:1.25,slow:.25,slowDuration:2,poisonDps:10,dotDuration:1.5});
  actors.host_15.statuses.freeze={time:.8};actors.host_15.statuses.petrify={time:.5};
  actors.host_32.hp=actors.host_32.maxHp*.5;
  actors.host_14.shields=0;actors.host_14.hit=.16;
  actors.host_24.reactiveStacks=5;
  longRoute(game.combat.spawn('host_12'),2).speed=0;
  return {game,actors,tower};
}
function state(game){
  return {elapsed:game.combat.elapsed,spawned:game.combat.spawned,lives:game.lives,queue:game.combat.spawnQueue.map(item=>[item.time,item.type]),
    enemies:game.combat.enemies.map(e=>({id:e.id,type:e.type,hp:e.hp,maxHp:e.maxHp,x:e.x,z:e.z,traveled:e.traveled,pathIndex:e.pathIndex,hit:e.hit,
      cloaked:e.cloaked,shields:e.shields,shieldClock:e.shieldClock,rechargeClock:e.rechargeClock,blinkClock:e.blinkClock,reactiveStacks:e.reactiveStacks,
      statuses:Object.fromEntries(Object.entries(e.statuses).map(([key,s])=>[key,{time:s.time,dps:s.dps,amount:s.amount}]))})),
    towers:game.towers.map(t=>({cooldown:t.cooldown,disarmed:t.disarmed,melancholy:t.melancholy,weakened:t.weakened})),
    projectiles:game.combat.projectiles.map(p=>({id:p.id,target:p.target.id,progress:p.progress,duration:p.duration,x:p.x,z:p.z}))};
}
function equivalent(actual,expected,path='state'){
  if(typeof expected==='number'){close(actual,expected,path);return;}
  if(expected&&typeof expected==='object'){
    assert.deepEqual(Object.keys(actual),Object.keys(expected),path);
    for(const key of Object.keys(expected))equivalent(actual[key],expected[key],path+'.'+key);
  }else assert.equal(actual,expected,path);
}

test('actual 1× and 3× ticks produce the same spawn, ability, status, attack and projectile trace at equal game time',()=>{
  const normal=clockArena(1),fast=clockArena(3),normalHits=[],fastHits=[];
  normal.game.on((event,payload)=>{if(event==='hit')normalHits.push([normal.game.combat.elapsed,payload.enemy.id,payload.damage]);});
  fast.game.on((event,payload)=>{if(event==='hit')fastHits.push([fast.game.combat.elapsed,payload.enemy.id,payload.damage]);});
  // Equal game-time samples isolate clock scaling from the renderer's ordinary
  // frame-sized movement/targeting quantization. They cross 2/5/6/8s deadlines.
  for(let frame=1;frame<=512;frame++){
    normal.game.tick(1/64);fast.game.tick(1/192);
    if(frame%16===0)equivalent(state(fast.game),state(normal.game));
  }
  equivalent(fastHits,normalHits);assert.ok(normalHits.length>0,'Actual attacks and DoT must be exercised');
  assert.ok(normal.game.combat.spawned>10,'The scheduled patrol really spawned');
  assert.equal(normal.actors.host_14.shields,3,'Refraction restored its actual charges at eight game seconds');
  close(normal.actors.host_32.hp/normal.actors.host_32.maxHp,.56,'The actual five-second missing-health pulse occurred');
  close(normal.actors.host_24.reactiveStacks,0,'Actual armor stacks decayed');
  assert.ok(!Object.keys(normal.actors.host_15.statuses).length,'All sampled status clocks expired');
});

test('pause retains every actual simulation clock and queued actor while wall time passes, then resumes without banking that time',()=>{
  const paused=clockArena(3),control=clockArena(3);
  paused.game.tick(.1);control.game.tick(.1);const before=state(paused.game);
  paused.game.paused=true;
  for(let frame=0;frame<120;frame++)paused.game.tick(1/60);
  assert.deepEqual(state(paused.game),before);
  paused.game.speed=1;paused.game.tick(2);assert.deepEqual(state(paused.game),before,'Changing speed while paused cannot release timers or queued enemies');
  paused.game.speed=3;paused.game.paused=false;
  paused.game.tick(.05);control.game.tick(.05);equivalent(state(paused.game),state(control.game));
});

test('wave42 rush is ×2 for two game seconds, ending after two-thirds of a wall second at 3× and repeating at six game seconds',()=>{
  assert.equal(data.enemies.host_42.rush,2);assert.equal(data.enemies.host_19.rush,5);assert.equal(data.enemies.host_47.rush,5);
  assert.deepEqual([R.rush.duration,R.rush.period],[2,6]);
  for(const speed of [1,3]){
    const game=arena(speed),enemy=longRoute(game.combat.spawn('host_42'));game.combat.spawnQueue=[{time:1e6,type:'host_01',modifiers:{}}];
    const gameStep=.125,wallStep=gameStep/speed;let wallTime=0;
    for(let frame=0;frame<15;frame++){game.tick(wallStep);wallTime+=wallStep;}
    close(enemy.traveled,enemy.speed*2*1.875,'All samples inside the first rush window use twice the ordinary speed');
    let previous=enemy.traveled;game.tick(wallStep);wallTime+=wallStep;
    close(game.combat.elapsed,2,'The rush deadline is expressed in game seconds');close(wallTime,2/speed,'Speed changes wall duration rather than game duration');
    close(enemy.traveled-previous,enemy.speed*gameStep,'The deadline sample uses ordinary speed');
    for(let frame=0;frame<31;frame++)game.tick(wallStep);
    close(game.combat.elapsed,5.875,'The quiet part lasts until the six-second period');previous=enemy.traveled;
    game.tick(wallStep);close(game.combat.elapsed,6,'The same game-time period is retained');close(enemy.traveled-previous,enemy.speed*2*gameStep,'The next rush returns at six game seconds');
  }
});

test('changing speed preserves ongoing regeneration, recharge and phase-offset disarm instead of resetting their clocks',()=>{
  const subject=clockArena(1),control=clockArena(1);
  for(let n=0;n<125;n++){subject.game.tick(.01);control.game.tick(.01);}
  subject.game.speed=3;
  for(let n=0;n<475;n++){subject.game.tick(.01/3);control.game.tick(.01);}
  equivalent(state(subject.game),state(control.game));
  const enemy=subject.game.combat.enemies.find(e=>e.type==='host_12');
  assert.equal(enemyDisarmActive(enemy,subject.game.combat.elapsed),enemyDisarmActive(enemy,control.game.combat.elapsed));
  close(subject.actors.host_15.hp,control.actors.host_15.hp,'Modified maximum-health regeneration keeps its phase');
  close(subject.actors.host_32.rechargeClock,control.actors.host_32.rechargeClock,'Recharge has no speed-switch reset');
});

test('actual combat impact lifetimes follow scaled simulation progress and freeze during pause despite a changing cosmetic clock',()=>{
  for(const speed of [1,3]){
    const game=arena(speed),enemy=longRoute(game.combat.spawn('host_01'));enemy.speed=0;
    const scene=new Scene(),effects=new CombatEffects(scene),source={id:1,family:'archer',x:0,z:0};
    effects.impact({source,target:enemy,stats:{type:'physical'},x:enemy.x,z:enemy.z});
    const record=effects.effects[0];assert.equal(record.duration,.28);let wallTime=0;
    const step=wallDt=>{const before=game.combat.elapsed;game.tick(wallDt);wallTime+=wallDt;effects.update(game.combat.elapsed-before,wallTime);};
    try{
      step(.1/speed);close(record.elapsed,.1,'Effect age equals actual scaled simulation progress');
      game.paused=true;const opacity=record.object.children[0].material.opacity;
      for(let n=0;n<20;n++)step(.05);
      close(record.elapsed,.1,'A cosmetic clock cannot age a paused combat impact');assert.equal(record.object.children[0].material.opacity,opacity);
      game.paused=false;step(.17/speed);assert.equal(effects.effects.length,1);close(record.elapsed,.27,'The effect remains just before its actual deadline');
      step(.011/speed);assert.equal(effects.effects.length,0);assert.equal(scene.children.length,0,'Actual expired resources leave the scene');
    }finally{effects.dispose();}
  }
});
