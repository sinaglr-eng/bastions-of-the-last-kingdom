import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {enemyFigure,disposeEnemyFigure} from '../game/render/enemy-assets.js';
import {createGeometricMotionRig,animateGeometricEnemyMotion,resetGeometricMotion} from '../game/render/geometric-motion.js';
import {scaleBattlefieldUnit,BATTLEFIELD_UNIT_SCALE,BATTLEFIELD_BOSS_MULTIPLIER} from '../game/render/battlefield-scale.js';

const bytes=readFileSync(new URL('../public/assets/geometric/enemies/host_50.glb',import.meta.url));
const source=(await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
const definition=JSON.parse(readFileSync(new URL('../data/enemies.json',import.meta.url))).host_50;
const pose=root=>{const values=[];root.traverse(node=>values.push([node.name,...node.position.toArray(),...node.quaternion.toArray(),...node.scale.toArray()]));return JSON.stringify(values);};
const sourceRest=pose(source);
function actor(){
  const enemy={...definition,id:0,type:'host_50',traveled:0,statuses:{}};
  const figure=enemyFigure(enemy,new Map([['host_50',source]]));scaleBattlefieldUnit(figure,enemy);
  const rig=createGeometricMotionRig(figure);figure.userData.geometricMotion=rig;
  return {enemy,figure,rig};
}
function physical(node){let meshes=0;node?.traverse(part=>{if(part.isMesh&&part.geometry?.attributes.position?.count>=3)meshes++;});return meshes;}

test('final wyvern source has two physical hindleg chains instead of invisible front chains',()=>{
  const {figure,rig}=actor();
  try{
    assert.equal(figure.userData.body.getObjectByName('upper_leg_FL'),undefined);
    assert.equal(figure.userData.body.getObjectByName('upper_leg_FR'),undefined);
    assert.deepEqual(rig.legs.map(leg=>leg.side).sort(),['BL','BR']);
    assert.ok(rig.legs.every(leg=>leg.ik&&physical(leg.hip.node)>0&&physical(leg.knee.node)>0&&physical(leg.foot.node)>0));
    assert.equal(figure.scale.y,BATTLEFIELD_UNIT_SCALE*BATTLEFIELD_BOSS_MULTIPLIER);
  }finally{disposeEnemyFigure(figure);}
});

test('both actual wyvern hindlegs animate in production flight and preserve freeze/petrify/reduced motion',()=>{
  const {enemy,figure,rig}=actor();
  try{
    animateGeometricEnemyMotion(figure,enemy,0);
    const before=rig.legs.map(leg=>leg.hip.node.quaternion.clone());
    animateGeometricEnemyMotion(figure,enemy,.3);
    assert.equal(rig.legs.length,2);
    assert.ok(rig.legs.every((leg,index)=>leg.hip.node.quaternion.angleTo(before[index])>.01));
    for(const status of ['freeze','petrify']){
      enemy.statuses={[status]:{time:1}};animateGeometricEnemyMotion(figure,enemy,.4);
      const frozen=pose(figure);animateGeometricEnemyMotion(figure,enemy,20);assert.equal(pose(figure),frozen);
      assert.ok([...rig.joints.values()].every(joint=>joint.node.position.equals(joint.position)&&joint.node.rotation.equals(joint.rotation)&&joint.node.scale.equals(joint.scale)));
    }
    enemy.statuses={};animateGeometricEnemyMotion(figure,enemy,21,{reducedMotion:true});
    assert.ok([...rig.joints.values()].every(joint=>joint.node.position.equals(joint.position)&&joint.node.rotation.equals(joint.rotation)&&joint.node.scale.equals(joint.scale)));
    assert.equal(pose(source),sourceRest);
    assert.equal(figure.scale.y,BATTLEFIELD_UNIT_SCALE*BATTLEFIELD_BOSS_MULTIPLIER);
  }finally{disposeEnemyFigure(figure);}
});

test('grounded resilience alternates the two actual hindlegs and keeps the left sole planted',()=>{
  const {enemy,figure,rig}=actor();
  try{
    enemy.flying=false;rig.phase=.31*Math.PI*2;
    figure.position.y=animateGeometricEnemyMotion(figure,enemy,0);
    const left=rig.legs.find(leg=>leg.side==='BL'),right=rig.legs.find(leg=>leg.side==='BR');
    assert.ok(left?.ik&&right?.ik);
    assert.ok(left.hip.node.quaternion.angleTo(right.hip.node.quaternion)>.01);
    figure.updateMatrixWorld(true);const planted=left.foot.node.getWorldPosition(new THREE.Vector3());
    enemy.traveled=.01;figure.position.z=-.01;figure.position.y=animateGeometricEnemyMotion(figure,enemy,.02);
    figure.updateMatrixWorld(true);assert.ok(left.foot.node.getWorldPosition(new THREE.Vector3()).distanceTo(planted)<1e-7);
    resetGeometricMotion(rig);assert.equal(pose(source),sourceRest);
  }finally{disposeEnemyFigure(figure);}
});
