import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {campaignEnemies} from '../game/core/campaign-roster.js';
import {enemyFigure,disposeEnemyFigure} from '../game/render/enemy-assets.js';
import {BATTLEFIELD_UNIT_SCALE,BATTLEFIELD_BOSS_MULTIPLIER,scaleBattlefieldUnit,animateBattlefieldIdleScale} from '../game/render/battlefield-scale.js';
import {animateEnemyMotion} from '../game/render/enemy-motion.js';
import {createEnemyAura} from '../game/render/enemy-aura.js';
import {beginDeath,animateDeath} from '../game/render/battle-animation.js';
const enemies=campaignEnemies(JSON.parse(readFileSync(new URL('../data/enemies.json',import.meta.url))));
const bosses=Object.entries(enemies).filter(([id,e])=>id.startsWith('host_')&&e.boss);
const size=actor=>new THREE.Box3().setFromObject(actor,true).getSize(new THREE.Vector3());
async function asset(id){const bytes=readFileSync(new URL('../public/assets/geometric/enemies/'+id+'.glb',import.meta.url));return (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;}
test('every actual imported boss is fifty percent larger than its prior battlefield figure with shared source intact',async()=>{
 assert.ok(bosses.length>=5);assert.equal(BATTLEFIELD_BOSS_MULTIPLIER,1.5);
 for(const [id,definition] of bosses){
  const source=await asset(id),native=size(source),sourceScale=source.scale.clone(),enemy={...definition,id:1,type:id,traveled:0,statuses:{}},figure=enemyFigure(enemy,new Map([[id,source]]));
  scaleBattlefieldUnit(figure,enemy);scaleBattlefieldUnit(figure,enemy);scaleBattlefieldUnit(figure);figure.updateMatrixWorld(true);
  const enlarged=size(figure),baseline=native.clone().multiplyScalar(BATTLEFIELD_UNIT_SCALE);
  for(const axis of ['x','y','z'])assert.ok(Math.abs(enlarged[axis]/baseline[axis]-1.5)<1e-6,id+' '+axis+' retains the full fifty-percent enlargement');
  assert.ok(source.scale.equals(sourceScale));assert.ok(size(source).equals(native),'source model geometry is unchanged');
  for(const stretch of [.018,-.018,0])animateBattlefieldIdleScale(figure,stretch);assert.ok(Math.abs(size(figure).y/baseline.y-1.5)<1e-6,'idle normalization retains the enlarged boss base');
  const aura=createEnemyAura(enemy,figure.userData.body);if(aura){figure.add(aura);figure.userData.aura=aura;assert.equal(aura.parent,figure);}
  for(const time of [0,.1,.25,.4]){enemy.traveled=time*.2;figure.position.y=(enemy.flying?.8:0)+animateEnemyMotion(figure,enemy,time);figure.updateMatrixWorld(true);assert.ok(size(figure.userData.body).toArray().every(Number.isFinite));}
  beginDeath(figure,enemy);for(let i=0;i<30;i++)animateDeath(figure,.04);figure.updateMatrixWorld(true);assert.ok(new THREE.Box3().setFromObject(figure.userData.body,true).min.y>=.02499,'enlarged physical corpse rests on terrain');
  disposeEnemyFigure(figure);const resources=new Set();source.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});resources.forEach(o=>o.dispose());
 }
});
test('fallback bosses retain their previous boss proportions plus fifty percent; ordinary enemies and presentation helpers do not affect stats',()=>{
 for(const [id,definition] of bosses){
  const enemy={...definition,type:id},before=JSON.stringify(enemy),oldFigure=enemyFigure(enemy,new Map()),figure=enemyFigure(enemy,new Map());
  scaleBattlefieldUnit(oldFigure);scaleBattlefieldUnit(figure,enemy);
  for(const axis of ['x','y','z'])assert.ok(Math.abs(size(figure)[axis]/size(oldFigure)[axis]-1.5)<1e-6);
  assert.equal(JSON.stringify(enemy),before);disposeEnemyFigure(oldFigure);disposeEnemyFigure(figure);
 }
 const regular={...enemies.host_01,type:'host_01',boss:false},figure=enemyFigure(regular,new Map()),baseline=size(figure);scaleBattlefieldUnit(figure,regular);assert.ok(size(figure).distanceTo(baseline.multiplyScalar(BATTLEFIELD_UNIT_SCALE))<1e-7);disposeEnemyFigure(figure);
});
