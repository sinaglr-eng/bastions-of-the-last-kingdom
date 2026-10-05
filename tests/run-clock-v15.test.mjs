import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {formatRunDuration} from '../ui/run-clock.js';
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL('../data/'+key+'.json',import.meta.url)))]));

test('elapsed time begins at zero, includes actual construction and resets only for a new run',()=>{
  const game=new Game(data,{seed:15});assert.equal(game.elapsedSeconds,0);game.tick(2);assert.equal(game.elapsedSeconds,2);
  for(const [x,z] of [[5,5],[7,5],[9,5],[11,5],[13,5]])game.place(x,z);
  assert.equal(game.phase,'select');game.tick(3);game.keep();assert.equal(game.phase,'ready');game.tick(4);
  assert.equal(game.elapsedSeconds,9);assert.equal(new Game(data,{seed:15}).elapsedSeconds,0);
});
test('actual elapsed seconds are independent of 1×/3× simulation and the combat frame cap',()=>{
  const game=new Game(data,{seed:15});game.phase='combat';game.combat.spawnQueue=[{time:99999,type:'host_01'}];
  game.tick(.05,2);assert.equal(game.elapsedSeconds,2);assert.equal(game.combat.elapsed,.05);
  game.speed=3;game.tick(.05,2);assert.equal(game.elapsedSeconds,4);assert.equal(game.combat.elapsed,.2);
  game.paused=true;game.tick(.05,50);assert.equal(game.elapsedSeconds,54);assert.equal(game.combat.elapsed,.2);
  game.paused=false;game.tick(.05,1);assert.equal(game.elapsedSeconds,55);assert.ok(Math.abs(game.combat.elapsed-.35)<1e-12);
});
test('pauses count throughout construction and combat, while ended runs keep their final duration',()=>{
  for(const phase of ['build','select','ready','reward','combat']){
    const game=new Game(data,{seed:15});game.phase=phase;game.paused=true;game.tick(.1,10);assert.equal(game.elapsedSeconds,10,phase);
  }
  for(const won of [true,false]){const game=new Game(data,{seed:15});game.tick(2);game.end(won);game.tick(30);assert.equal(game.elapsedSeconds,2);}
});
test('invalid elapsed intervals never corrupt the clock while finite intervals stay exact',()=>{
  const game=new Game(data,{seed:15});for(const value of [NaN,Infinity,-Infinity,-1,0])game.tick(0,value);assert.equal(game.elapsedSeconds,0);
  for(let i=0;i<4;i++)game.tick(0,.25);assert.equal(game.elapsedSeconds,1);
});
test('duration formatting is readable across minute and hour boundaries without rounding up',()=>{
  for(const [seconds,text] of [[0,'00:00'],[59.999,'00:59'],[60,'01:00'],[3599,'59:59'],[3600,'1:00:00'],[3661,'1:01:01'],[360000,'100:00:00'],[NaN,'00:00'],[-1,'00:00']])assert.equal(formatRunDuration(seconds),text);
});
