import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {basicFamilyFrame} from '../game/render/atelier-framing.js';
import {geometricEntries} from '../game/render/geometric-assets.js';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';

const entries=geometricEntries(JSON.parse(readFileSync(new URL('../public/assets/geometric/geometric-defenders.json',import.meta.url))));
test('all basic rank comparisons use one enclosing family camera scale independent of rank order and equipment',()=>{
 for(const family of new Set(entries.map(entry=>entry.family))){
  const frame=basicFamilyFrame(entries,family);assert.ok(frame,family);assert.deepEqual(basicFamilyFrame([...entries].reverse(),family),frame);
  assert.ok(frame.radius>=1);assert.ok(frame.centre.every(Number.isFinite));
 }
});
test('actual Mage V and VI bodies remain the same physical and projected size with their different equipment',async()=>{
 const frame=basicFamilyFrame(entries,'mage'),camera=new THREE.PerspectiveCamera(33,1,.1,50);
 camera.position.set(...frame.centre).add(new THREE.Vector3(0,1.06,-5).multiplyScalar(frame.radius));camera.lookAt(new THREE.Vector3(...frame.centre));camera.updateMatrixWorld();
 const sizes=[],spans=[];
 for(const tier of [5,6]){
  const entry=entries.find(entry=>entry.family==='mage'&&entry.tier===tier),bytes=readFileSync(new URL('../public/assets/geometric/'+entry.file,import.meta.url));
  const gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  try{
   const bodice=gltf.scene.getObjectByName('Continuous_tunic_bodice');assert.ok(bodice,'actual imported bodice');const box=new THREE.Box3().setFromObject(bodice,true);sizes.push(box.getSize(new THREE.Vector3()));
   const points=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z).project(camera).y);
   spans.push(Math.max(...points)-Math.min(...points));
  }finally{disposeDecodedGeometricAsset(gltf);}
 }
 assert.ok(sizes[0].distanceTo(sizes[1])<.004,'the higher Mage rank must not have a smaller trunk');
 assert.ok(Math.abs(spans[0]-spans[1])<.004,'equal body geometry must also look equal at the same family camera scale');
});
test('missing or invalid native rank bounds cannot invent a family camera frame',()=>{
 assert.equal(basicFamilyFrame(entries,'unknown'),null);
 const mage=entries.filter(entry=>entry.family==='mage');assert.equal(basicFamilyFrame(mage.slice(1),'mage'),null);
 const bad=structuredClone(mage);bad[0].metrics.boundsMax[2]=NaN;assert.equal(basicFamilyFrame(bad,'mage'),null);
 const duplicate=structuredClone(mage);duplicate[5].tier=5;assert.equal(basicFamilyFrame(duplicate,'mage'),null);
});
