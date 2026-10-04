import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Game} from '../game/core/game.js';
import {EnemyConcealmentEffects} from '../game/render/enemy-concealment-effects.js';
import {enemyFigure,disposeEnemyFigure} from '../game/render/enemy-assets.js';
import {scaleBattlefieldUnit} from '../game/render/battlefield-scale.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
const snapshot=fx=>({matrix:Array.from(fx.object.instanceMatrix.array),alpha:Array.from(fx.object.geometry.attributes.cloudAlpha.array),count:fx.object.count});

test('concealment never samples initially hidden coordinates and departure stays at the last actually public point',()=>{
  const scene=new THREE.Scene(),fx=new EnemyConcealmentEffects(scene,{position:(x,y,z)=>new THREE.Vector3(x-18,y,z-18)});
  const hidden={id:1,cloaked:true,get x(){throw new Error('Hidden x leaked');},get z(){throw new Error('Hidden z leaked');},get flying(){throw new Error('Hidden height leaked');}};
  try{
    fx.sync([hidden],{time:0,figures:{get(){throw Error('Initial hidden figure leaked');}}});assert.equal(fx.object.count,0);assert.deepEqual(fx.states.get(1),{visible:false});
    const visible={id:1,cloaked:false,x:20,z:22};fx.sync([visible],{time:.1});assert.equal(fx.clouds.length,1);assert.equal(fx.clouds[0].kind,'arrival');
    visible.x=21;visible.z=23;fx.sync([visible],{time:.15});assert.equal(fx.clouds.length,1,'Repeated visible frames cannot emit extra smoke');
    fx.sync([hidden],{time:.2});assert.equal(fx.clouds.length,2);const departure=fx.clouds[1];assert.equal(departure.kind,'departure');assert.deepEqual(departure.anchor.toArray(),[3,.12,5]);
    assert.deepEqual(Object.keys(departure).sort(),['anchor','born','bounds','cosmeticBorn','kind','lifetime']);assert.deepEqual(fx.states.get(1),{visible:false},'Hidden history has no positional or actor reference');
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

test('smoke expires only with simulation time while optional cosmetic time billows during pause, with bounded capacity and idempotent cleanup',()=>{
  const scene=new THREE.Scene(),fx=new EnemyConcealmentEffects(scene,{maxClouds:2}),enemy={id:1,x:3,z:4,cloaked:false};
  try{
    fx.sync([enemy],{time:1});assert.equal(fx.object.count,0,'An initial visible actor needs no concealment smoke');
    enemy.cloaked=true;fx.sync([enemy],{time:1.1});const paused=snapshot(fx);
    fx.sync([enemy],{time:1.1});fx.update(1.1);assert.deepEqual(snapshot(fx),paused);
    fx.sync([enemy],{time:1.1,cosmeticTime:2.2});assert.notDeepEqual(Array.from(fx.object.instanceMatrix.array),paused.matrix,'Unpaused cosmetic clock moves the cloud without advancing combat');assert.deepEqual(Array.from(fx.object.geometry.attributes.cloudAlpha.array),paused.alpha);assert.equal(fx.clouds.length,1);assert.equal(fx.time,1.1);
    fx.update(1.2,{reducedMotion:true});const matrices=Array.from(fx.object.instanceMatrix.array),firstAlpha=fx.object.geometry.attributes.cloudAlpha.getX(0);
    fx.update(1.3,{reducedMotion:true});assert.deepEqual(Array.from(fx.object.instanceMatrix.array),matrices);assert.ok(fx.object.geometry.attributes.cloudAlpha.getX(0)<firstAlpha,'Reduced motion keeps semantic expiry while disabling movement');
    for(let i=0;i<10;i++){enemy.cloaked=!enemy.cloaked;fx.sync([enemy],{time:1.31+i*.001});}
    assert.equal(fx.clouds.length,2);assert.equal(fx.object.count,20);assert.ok(fx.object.instanceMatrix.array.every(Number.isFinite));assert.equal(fx.object.raycast(),undefined);assert.equal(fx.object.material.depthWrite,false);
    fx.sync([enemy],{time:0});assert.equal(fx.clouds.length,0,'New simulation clock clears prior-run visibility and smoke');
    fx.sync([enemy],{time:NaN});fx.update(Infinity);assert.ok(fx.object.instanceMatrix.array.every(Number.isFinite));
    const resources=[fx.object.geometry,fx.object.material],counts=[0,0];resources.forEach((r,i)=>r.addEventListener('dispose',()=>counts[i]++));
    fx.dispose();fx.dispose();fx.sync([enemy],{time:10});fx.update(10);assert.deepEqual(counts,[1,1]);assert.equal(scene.children.length,0);assert.equal(fx.states.size,0);assert.equal(fx.clouds.length,0);
  }finally{fx.dispose();}
});

test('smoke envelopes the complete actual visible native body, including enlarged boss wings, and never reads a hidden figure or appearance',async()=>{
  const smokeBounds=fx=>{
    const box=new THREE.Box3(),matrix=new THREE.Matrix4();fx.object.geometry.computeBoundingBox();
    for(let i=0;i<fx.object.count;i++){fx.object.getMatrixAt(i,matrix);box.union(fx.object.geometry.boundingBox.clone().applyMatrix4(matrix));}return box;
  };
  for(const type of ['host_18','host_50']){
    const bytes=readFileSync(new URL(`../public/assets/geometric/enemies/${type}.glb`,import.meta.url)),template=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
    const enemy={...data.enemies[type],type,id:1,cloaked:false,x:3,z:4},figure=scaleBattlefieldUnit(enemyFigure(enemy,new Map([[type,template]])),enemy);
    figure.position.set(3,enemy.flying?.8:0,4);figure.rotation.y=.67;
    const bar=new THREE.Mesh(new THREE.BoxGeometry(1,100,1),new THREE.MeshBasicMaterial());bar.position.y=100;figure.add(bar);
    const fx=new EnemyConcealmentEffects(new THREE.Scene()),figures=new Map([[1,figure]]);
    try{
      figure.updateWorldMatrix(true,true);const bodyBounds=new THREE.Box3().setFromObject(figure.userData.body),size=bodyBounds.getSize(new THREE.Vector3());
      fx.sync([enemy],{time:1,cosmeticTime:10,figures});assert.equal(fx.object.count,0);
      assert.deepEqual(fx.states.get(1).bounds.min.toArray(),bodyBounds.min.toArray());assert.deepEqual(fx.states.get(1).bounds.max.toArray(),bodyBounds.max.toArray(),'Sibling HP bar is excluded from actual body measurements');
      const hidden={id:1,cloaked:true,get x(){throw Error('Hidden x');},get z(){throw Error('Hidden z');},get flying(){throw Error('Hidden flight');},get type(){throw Error('Hidden identity');},get visualAsset(){throw Error('Hidden model');},get name(){throw Error('Hidden name');}};
      const forbiddenFigures={get(){throw Error('Hidden figure lookup');}};
      fx.sync([hidden],{time:1.1,cosmeticTime:10.1,figures:forbiddenFigures});assert.equal(fx.clouds.length,1);
      const cloud=fx.clouds[0];assert.deepEqual(cloud.bounds.min.toArray(),bodyBounds.min.toArray());assert.deepEqual(cloud.bounds.max.toArray(),bodyBounds.max.toArray());
      const coverage=smokeBounds(fx),cloudSize=coverage.getSize(new THREE.Vector3());assert.ok(coverage.containsBox(bodyBounds),`${type} whole actual unit is inside the enlarged cloud envelope`);assert.ok(cloudSize.y>size.y*1.2&&cloudSize.x>size.x*1.2);assert.ok(cloudSize.y<size.y*2.5,'Smoke follows measured size, not the100m HP bar');
      figure.position.set(80,80,80);figure.scale.multiplyScalar(2);fx.sync([hidden],{time:1.2,cosmeticTime:10.2,figures:forbiddenFigures});assert.deepEqual(cloud.bounds.min.toArray(),bodyBounds.min.toArray());assert.deepEqual(cloud.bounds.max.toArray(),bodyBounds.max.toArray(),'Departure keeps copied public bounds after a hidden model moves');
      const tiny=new THREE.Matrix4().compose(cloud.anchor,new THREE.Quaternion(),new THREE.Vector3(.18,.18,.18));
      for(let i=0;i<fx.object.count;i++)fx.object.setMatrixAt(i,tiny);assert.equal(smokeBounds(fx).containsBox(bodyBounds),false,'Coverage regression rejects the former tiny ground-puff geometry');
    }finally{
      fx.dispose();disposeEnemyFigure(figure);bar.geometry.dispose();bar.material.dispose();const resources=new Set();template.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)resources.add(m);});for(const r of resources)r.dispose();
    }
  }
});
