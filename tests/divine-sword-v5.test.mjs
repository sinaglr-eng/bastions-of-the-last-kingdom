import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
import {attackRig,previewGeometricAttack,updateGeometricPreview,resetAttack,attackMuzzle,disposeAttack} from '../game/render/battle-animation.js';

test('the actual Archangel divine sword makes a complete cut and carries its physical blade tip without changing its frost combat stats',async()=>{
 const bytes=readFileSync(new URL('../public/assets/geometric/champions/archangel.glb',import.meta.url));
 const source=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const actor=cloneDefenderTemplate(source.scene),stats=JSON.parse(readFileSync(new URL('../data/towers.json',import.meta.url))).archangel,before=structuredClone(stats),rig=attackRig(actor,'archangel',stats);
 try{
  assert.equal(rig.kind,'frost');assert.equal(rig.attackStyle,'sword');
  const weapon=actor.getObjectByName('weapon_R'),tip=actor.getObjectByName('sword_tip'),blade=actor.getObjectByName('Archangel_divine_sword_blade');
  assert.ok(weapon&&tip&&blade,'actual exported sword blade and endpoint');
  assert.equal(tip.parent,weapon);assert.equal(rig.muzzle,tip);
  actor.updateWorldMatrix(true,true);
  const rest=weapon.getWorldQuaternion(new THREE.Quaternion()),relative=new THREE.Matrix4().copy(weapon.matrixWorld).invert().multiply(blade.matrixWorld).elements;
  let largestCut=0;
  for(const phase of [0,.10,.21,.30,.42,.48,.58,.70,.85,1]){
   resetAttack(rig);previewGeometricAttack(rig,{duration:1});updateGeometricPreview(rig,phase);actor.updateWorldMatrix(true,true);
   largestCut=Math.max(largestCut,rest.angleTo(weapon.getWorldQuaternion(new THREE.Quaternion())));
   const current=new THREE.Matrix4().copy(weapon.matrixWorld).invert().multiply(blade.matrixWorld).elements;
   assert.ok(current.every((value,i)=>Math.abs(value-relative[i])<1e-7),'the physical blade remains rigidly attached through cut and return');
   assert.ok(new THREE.Box3().setFromObject(blade,true).expandByScalar(.018).containsPoint(attackMuzzle(rig)),'magical release follows the actual blade tip');
  }
  assert.ok(largestCut>.3,'the actual held sword turns through a visible cut');
  resetAttack(rig);actor.updateWorldMatrix(true,true);assert.ok(rest.angleTo(weapon.getWorldQuaternion(new THREE.Quaternion()))<1e-7,'the sword returns to its authored rest');
  assert.deepEqual(stats,before,'presentation retains the authoritative frost combat values');
 }finally{disposeAttack(rig);disposeDefenderInstance(actor);disposeDecodedGeometricAsset(source);}
});
