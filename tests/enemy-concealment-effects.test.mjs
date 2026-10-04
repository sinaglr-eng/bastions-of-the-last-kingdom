import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {Game} from '../game/core/game.js';
import {EnemyConcealmentEffects} from '../game/render/enemy-concealment-effects.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
const snapshot=fx=>({matrix:Array.from(fx.object.instanceMatrix.array),alpha:Array.from(fx.object.geometry.attributes.cloudAlpha.array),count:fx.object.count});

test('concealment never samples initially hidden coordinates and departure stays at the last actually public point',()=>{
  const scene=new THREE.Scene(),fx=new EnemyConcealmentEffects(scene,{position:(x,y,z)=>new THREE.Vector3(x-18,y,z-18)});
  const hidden={id:1,cloaked:true,get x(){throw new Error('Hidden x leaked');},get z(){throw new Error('Hidden z leaked');},get flying(){throw new Error('Hidden height leaked');}};
  try{
    fx.sync([hidden],{time:0});assert.equal(fx.object.count,0);assert.deepEqual(fx.states.get(1),{visible:false});
    const visible={id:1,cloaked:false,x:20,z:22};fx.sync([visible],{time:.1});assert.equal(fx.clouds.length,1);assert.equal(fx.clouds[0].kind,'arrival');
    visible.x=21;visible.z=23;fx.sync([visible],{time:.15});assert.equal(fx.clouds.length,1,'Repeated visible frames cannot emit extra smoke');
    fx.sync([hidden],{time:.2});assert.equal(fx.clouds.length,2);const departure=fx.clouds[1];assert.equal(departure.kind,'departure');assert.deepEqual(departure.anchor.toArray(),[3,.12,5]);
    assert.deepEqual(Object.keys(departure).sort(),['anchor','born','kind','lifetime']);assert.deepEqual(fx.states.get(1),{visible:false},'Hidden history has no positional or actor reference');
    fx.sync([hidden],{time:.25});assert.equal(fx.clouds.length,2);assert.deepEqual(departure.anchor.toArray(),[3,.12,5]);
    for(const t of [.3,.4,.6])fx.sync([hidden],{time:t});assert.equal(fx.clouds.filter(c=>c.kind==='departure').length,1);
    const matrix=new THREE.Matrix4(),point=new THREE.Vector3();
    for(let i=0;i<fx.object.count;i++){fx.object.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);assert.ok(Math.hypot(point.x-3,point.z-5)<.35,'Departure does not track a hidden actor');}
    fx.update(departure.born+departure.lifetime);assert.equal(fx.object.count,0);assert.equal(fx.object.visible,false,'Departure ends exactly at its bounded simulation lifetime');
  }finally{fx.dispose();}
});

test('real shared combat reveal transitions create only last-public departure and actual arrival smoke without mutating game data',()=>{
  const game=new Game(data,{seed:42});game.phase='combat';game.combat.spawnQueue=[{time:9999,type:'grunt'}];
  const enemy=game.combat.spawn('host_08');Object.assign(enemy,{x:12,z:12,speed:0,hp:1e6,maxHp:1e6});
  const cleric={id:1,family:'cleric',tier:1,state:'draft',x:12,z:17,kills:0,cooldown:999};game.towers=[cleric];
  const before=JSON.stringify({enemy,data}),fx=new EnemyConcealmentEffects(new THREE.Scene(),{isVisible:e=>game.combat.isRevealed(e)});
  try{
    assert.equal(game.combat.isRevealed(enemy),false);fx.sync([enemy],{time:0});assert.equal(fx.object.count,0);
    cleric.state='active';assert.equal(game.combat.isRevealed(enemy),true);fx.sync([enemy],{time:.1});assert.equal(fx.clouds[0].kind,'arrival');
    cleric.state='ruin';assert.equal(game.combat.isRevealed(enemy),false);fx.sync([enemy],{time:.2});const last=fx.clouds.at(-1).anchor.clone();
    enemy.x=22;enemy.z=25;fx.sync([enemy],{time:.3});assert.deepEqual(fx.clouds.at(-1).anchor.toArray(),last.toArray());
    enemy.x=12;enemy.z=12;assert.equal(JSON.stringify({enemy,data}),before,'Visual transitions never change stats, HP, RNG, or source definitions');
    enemy.cloaked=false;fx.sync([enemy],{time:.4});assert.equal(fx.clouds.at(-1).kind,'arrival');assert.deepEqual(fx.clouds.at(-1).anchor.toArray(),[12,.12,12]);
    enemy.dead=true;fx.sync([enemy],{time:.5});assert.equal(fx.states.size,0,'Dead actors cannot emit a new disappearance');
    fx.sync([],{active:false,time:.5});assert.equal(fx.object.count,0);assert.equal(fx.clouds.length,0);
  }finally{fx.dispose();}
});

test('smoke uses only simulation time, reduced motion holds puff shapes, capacity and rollback are bounded, and cleanup is idempotent',()=>{
  const scene=new THREE.Scene(),fx=new EnemyConcealmentEffects(scene,{maxClouds:2}),enemy={id:1,x:3,z:4,cloaked:false};
  try{
    fx.sync([enemy],{time:1});assert.equal(fx.object.count,0,'An initial visible actor needs no concealment smoke');
    enemy.cloaked=true;fx.sync([enemy],{time:1.1});const paused=snapshot(fx);
    fx.sync([enemy],{time:1.1});fx.update(1.1);assert.deepEqual(snapshot(fx),paused);
    fx.update(1.2,{reducedMotion:true});const matrices=Array.from(fx.object.instanceMatrix.array),firstAlpha=fx.object.geometry.attributes.cloudAlpha.getX(0);
    fx.update(1.3,{reducedMotion:true});assert.deepEqual(Array.from(fx.object.instanceMatrix.array),matrices);assert.ok(fx.object.geometry.attributes.cloudAlpha.getX(0)<firstAlpha,'Reduced motion keeps semantic expiry while disabling movement');
    for(let i=0;i<10;i++){enemy.cloaked=!enemy.cloaked;fx.sync([enemy],{time:1.31+i*.001});}
    assert.equal(fx.clouds.length,2);assert.equal(fx.object.count,14);assert.ok(fx.object.instanceMatrix.array.every(Number.isFinite));assert.equal(fx.object.raycast(),undefined);assert.equal(fx.object.material.depthWrite,false);
    fx.sync([enemy],{time:0});assert.equal(fx.clouds.length,0,'New simulation clock clears prior-run visibility and smoke');
    fx.sync([enemy],{time:NaN});fx.update(Infinity);assert.ok(fx.object.instanceMatrix.array.every(Number.isFinite));
    const resources=[fx.object.geometry,fx.object.material],counts=[0,0];resources.forEach((r,i)=>r.addEventListener('dispose',()=>counts[i]++));
    fx.dispose();fx.dispose();fx.sync([enemy],{time:10});fx.update(10);assert.deepEqual(counts,[1,1]);assert.equal(scene.children.length,0);assert.equal(fx.states.size,0);assert.equal(fx.clouds.length,0);
  }finally{fx.dispose();}
});
