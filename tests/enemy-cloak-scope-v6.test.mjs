import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {inspectProportionsV5,partSemanticV5} from '../tools/audit-geometric-proportions-v5.mjs';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';

const file=new URL('../public/assets/geometric/enemies/host_33.glb',import.meta.url);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const parsed=value=>typeof value==='string'?JSON.parse(value):value;
async function fixture(){
 const bytes=readFileSync(file),digest=sha(bytes);
 const gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 let metadata;gltf.scene.traverse(node=>{if(node.userData?.geometricRig)metadata=node.userData;});
 const cloth=parsed(metadata?.foldedCloakV5);
 assert.ok(cloth?.garments?.length,'the delivered replacement cloth must retain an actual inspection scope');
 assert.ok(cloth.garments.every(entry=>Array.isArray(entry.parts)&&entry.parts.length),'the actual replacement garment names must be explicit');
 assert.equal(inspectProportionsV5(gltf.scene,{id:'host_33'}).failures.length,0,'actual delivered replacement volume must pass before private corruption');
 return {gltf,metadata,cloth,dispose(){disposeDecodedGeometricAsset(gltf);assert.equal(sha(readFileSync(file)),digest,'private corruption must preserve the delivered asset bytes');}};
}

test('replacement cloak scope cannot pass when its named real surfaces are absent',async()=>{
 const f=await fixture();
 const detached=[];
 try{
  const parts=new Set(f.cloth.garments.flatMap(entry=>entry.parts));
  const originalMetadata=f.metadata.foldedCloakV5;
  f.gltf.scene.traverse(node=>{if(node.isMesh&&parts.has(partSemanticV5(node)))detached.push({node,parent:node.parent});});
  assert.ok(detached.reduce((total,{node})=>total+node.geometry.attributes.position.count,0)>=100,'actual delivered cloth surfaces must be removed');
  for(const {node} of detached)node.removeFromParent();
  assert.equal(f.metadata.foldedCloakV5,originalMetadata,'inspection metadata must remain unchanged by the physical corruption');
  const report=inspectProportionsV5(f.gltf.scene,{id:'host_33'});
  assert.ok(report.failures.some(check=>check.name==='cloak has actual wrapped depth and multiple physical drape stations'));
  assert.ok(report.failures.some(check=>check.name==='folded cloak is actual closed cloth volume'));
 }finally{for(const {node,parent} of detached)parent.add(node);f.dispose();}
});

test('replacement cloak metadata cannot certify a physically flattened garment',async()=>{
 const f=await fixture();
 try{
  const parts=new Set(f.cloth.garments.flatMap(entry=>entry.parts));
  f.gltf.scene.updateMatrixWorld(true);
  let vertices=0;
  f.gltf.scene.traverse(node=>{
   if(!node.isMesh||!parts.has(partSemanticV5(node)))return;
   const position=node.geometry.attributes.position,inverse=node.matrixWorld.clone().invert(),point=new THREE.Vector3();
   for(let i=0;i<position.count;i++){
    point.fromBufferAttribute(position,i).applyMatrix4(node.matrixWorld);point.z=0;point.applyMatrix4(inverse);
    position.setXYZ(i,point.x,point.y,point.z);vertices++;
   }
  });
  assert.ok(vertices>=100,'actual delivered cloth vertices must be corrupted');
  const report=inspectProportionsV5(f.gltf.scene,{id:'host_33'});
  assert.ok(report.failures.some(check=>check.name==='cloak has actual wrapped depth and multiple physical drape stations'));
 }finally{f.dispose();}
});
