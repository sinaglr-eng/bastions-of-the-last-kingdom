import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
import {attackRig,previewGeometricAttack,updateGeometricPreview,resetAttack,attackMuzzle,disposeAttack} from '../game/render/battle-animation.js';
import {prepareReconstructedDefender} from '../game/render/reconstruction-adapter.js';

const entry=JSON.parse(readFileSync(new URL('../public/assets/geometric/geometric-champions.json',import.meta.url))).entries.find(row=>row.id==='archangel');

function assertLegacyCut(actor,stats){
 const before=structuredClone(stats),rig=attackRig(actor,'archangel',stats);
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
 }finally{disposeAttack(rig);}
}

test('the actual approved Angel carries its physical source staff and frost release endpoint through conservative attack',async()=>{
 const bytes=readFileSync(new URL('../public/assets/geometric/champions/archangel.glb',import.meta.url));
 const source=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const stats=JSON.parse(readFileSync(new URL('../data/towers.json',import.meta.url))).archangel,before=structuredClone(stats);
 if(!entry.reconstruction){const actor=cloneDefenderTemplate(source.scene);try{assertLegacyCut(actor,stats);}finally{disposeDefenderInstance(actor);disposeDecodedGeometricAsset(source);}return;}
 assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.reconstruction.sourceGlbSha256,'exact approved source GLB');
 prepareReconstructedDefender(source.scene,entry);
 const actor=cloneDefenderTemplate(source.scene),rig=attackRig(actor,'archangel',stats);
 try{
  assert.equal(entry.name,'Angel');assert.equal(rig.kind,'frost');assert.equal(rig.attackStyle,'staff');
  const weapon=actor.getObjectByName('weapon_R'),tip=actor.getObjectByName('staff_tip'),staff=[];
  weapon.traverse(node=>{if(node.isMesh&&/staff shaft|staff ferrule/i.test(node.userData.semanticPart||''))staff.push(node);});
  assert.ok(staff.length>=3,'actual coherent shaft and end ferrules rather than empty semantic markers');assert.equal(tip.parent,weapon);assert.equal(rig.muzzle,tip);
  actor.updateWorldMatrix(true,true);
  const rest=weapon.getWorldQuaternion(new THREE.Quaternion()),relative=staff.map(mesh=>weapon.matrixWorld.clone().invert().multiply(mesh.matrixWorld).elements),buffers=staff.map(mesh=>mesh.geometry.attributes.position.array.slice());
  const vertex=mesh=>mesh.getVertexPosition(0,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld),restPoint=vertex(staff[0]),restMuzzle=attackMuzzle(rig);let travel=0,muzzleTravel=0;
  for(const phase of [0,.10,.21,.30,.42,.48,.58,.70,.85,1]){
   resetAttack(rig);previewGeometricAttack(rig,{duration:1});updateGeometricPreview(rig,phase);actor.updateWorldMatrix(true,true);
   travel=Math.max(travel,vertex(staff[0]).distanceTo(restPoint));muzzleTravel=Math.max(muzzleTravel,attackMuzzle(rig).distanceTo(restMuzzle));
   const bounds=new THREE.Box3();for(const [i,mesh] of staff.entries()){
    bounds.union(new THREE.Box3().setFromObject(mesh,true));const current=weapon.matrixWorld.clone().invert().multiply(mesh.matrixWorld).elements;
    assert.ok(current.every((value,j)=>Math.abs(value-relative[i][j])<1e-7),'physical staff stays rigidly carried through preparation, cast and return');
    assert.deepEqual(mesh.geometry.attributes.position.array,buffers[i],'approved physical buffers stay unchanged');
   }
   assert.ok(bounds.expandByScalar(.003).containsPoint(attackMuzzle(rig)),'magical release follows the physical staff focus');
  }
  assert.ok(travel>.005&&muzzleTravel>.005,'both source geometry and release endpoint move, not just empty pivots');
  resetAttack(rig);actor.updateWorldMatrix(true,true);assert.ok(rest.angleTo(weapon.getWorldQuaternion(new THREE.Quaternion()))<1e-7,'the staff returns to its authored rest');assert.ok(vertex(staff[0]).distanceTo(restPoint)<1e-7);
  assert.deepEqual(stats,before,'presentation retains the authoritative frost combat values');
 }finally{disposeAttack(rig);disposeDefenderInstance(actor);disposeDecodedGeometricAsset(source);}
});

test('legacy divine-sword right-hand cut contract remains functional independently of the new staff delivery',()=>{
 const actor=new THREE.Group();actor.userData={geometricRig:true,attackStyle:'sword'};
 const joint=(name,parent,position)=>{const group=new THREE.Group();group.name=name;group.position.set(...position);parent.add(group);return group;};
 const torso=joint('torso_pivot',actor,[0,.6,0]),arm=joint('upper_arm_R',torso,[.2,.5,0]),forearm=joint('forearm_R',arm,[0,-.2,0]),hand=joint('hand_R',forearm,[0,-.2,0]),weapon=joint('weapon_R',hand,[0,0,0]);
 const blade=new THREE.Mesh(new THREE.BoxGeometry(.09,.6,.04),new THREE.MeshStandardMaterial());blade.name='Archangel_divine_sword_blade';blade.position.y=.3;weapon.add(blade);joint('sword_tip',weapon,[0,.6,0]);
 try{assertLegacyCut(actor,JSON.parse(readFileSync(new URL('../data/towers.json',import.meta.url))).archangel);}finally{blade.geometry.dispose();blade.material.dispose();}
});
