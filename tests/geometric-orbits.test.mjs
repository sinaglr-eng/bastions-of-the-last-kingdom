import {testApprovedOrLegacy} from './reconstructed-roster-revision.test.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {animateGeometricOrbits} from '../game/render/geometric-orbits.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';

const transforms=root=>{const result=[];root.traverse(node=>result.push([node.name,...node.position.toArray(),...node.quaternion.toArray(),...node.scale.toArray()]));return JSON.stringify(result);};
function centre(node){node.updateWorldMatrix(true,true);return node.parent.worldToLocal(new THREE.Box3().setFromObject(node,true).getCenter(new THREE.Vector3()));}
testApprovedOrLegacy(["ladyclaire"],"Approved Claire preserves current source physical gem surfaces and isolated supported runtime behavior","the three real Claire source diamonds orbit around their baked geometry centres without moving the actor or cached peers",async()=>{
  const bytes=readFileSync('public/assets/geometric/champions/ladyclaire.glb'),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const source=gltf.scene,actor=cloneDefenderTemplate(source),peer=cloneDefenderTemplate(source),sourcePose=transforms(source),peerPose=transforms(peer);
  const orbs=[];actor.traverse(node=>{if(node.userData.sourceOrbitGem)orbs.push(node);});assert.equal(orbs.length,3);
  const rest=new Map(orbs.map(node=>[node,{centre:centre(node),position:node.position.clone(),quaternion:node.quaternion.clone(),scale:node.scale.clone()}]));
  const vertices=new Map();source.traverse(node=>{if(node.geometry)vertices.set(node.geometry,node.geometry.attributes.position.array.slice());});
  actor.position.set(3,.4,8);actor.rotation.y=.9;actor.scale.setScalar(.6);animateGeometricOrbits(actor,20);animateGeometricOrbits(actor,20.2);
  assert.deepEqual(actor.position.toArray(),[3,.4,8]);assert.equal(actor.rotation.y,.9);assert.deepEqual(actor.scale.toArray(),[.6,.6,.6]);
  for(const orb of orbs){const original=rest.get(orb),actual=centre(orb);assert.ok(actual.distanceTo(original.centre)>.02,'an actual source diamond moves');assert.ok(Math.abs(Math.hypot(actual.x,actual.z)-Math.hypot(original.centre.x,original.centre.z))<1e-6,'actual source orbit radius stays exact');assert.ok(Math.abs(actual.y-original.centre.y)<.05);assert.deepEqual(orb.scale.toArray(),original.scale.toArray());}
  const paused=transforms(actor);animateGeometricOrbits(actor,20.2);assert.equal(transforms(actor),paused);
  animateGeometricOrbits(actor,21,{reducedMotion:true});for(const orb of orbs){const original=rest.get(orb);assert.deepEqual(orb.position.toArray(),original.position.toArray());assert.deepEqual(orb.quaternion.toArray(),original.quaternion.toArray());assert.deepEqual(orb.scale.toArray(),original.scale.toArray());}
  assert.equal(transforms(source),sourcePose);assert.equal(transforms(peer),peerPose);for(const [geometry,before] of vertices)assert.deepEqual(geometry.attributes.position.array,before);
  disposeDefenderInstance(actor);disposeDefenderInstance(peer);disposeDecodedGeometricAsset(gltf);
});

test('baked off-origin orbit gems spin at their actual centre and melancholy slows their travel without shrinking them',()=>{
  const create=()=>{const root=new THREE.Group(),orb=new THREE.Group();orb.userData.sourceOrbitGem=true;const mesh=new THREE.Mesh(new THREE.OctahedronGeometry(.1,0),new THREE.MeshBasicMaterial());mesh.geometry.translate(1,1.3,.4);orb.add(mesh);root.add(orb);return {root,orb};};
  const a=create(),b=create();animateGeometricOrbits(a.root,0);animateGeometricOrbits(b.root,0);animateGeometricOrbits(a.root,.2);animateGeometricOrbits(b.root,.2,{melancholy:true});
  const initial=new THREE.Vector3(1,1.3,.4);assert.ok(centre(a.orb).distanceTo(initial)>centre(b.orb).distanceTo(initial)*3);assert.deepEqual(b.orb.scale.toArray(),[1,1,1]);
  for(const object of [a.root,b.root])object.traverse(node=>{node.geometry?.dispose();node.material?.dispose();});
});
