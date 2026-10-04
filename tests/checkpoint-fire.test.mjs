import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCheckpointMarker,takeCheckpointEffects,animateCheckpointEffects,disposeCheckpointEffects} from '../game/render/checkpoint-marker.js';
import {optimize} from '../game/render/models.js';

function resources(root){const geometries=new Set(),materials=new Set(),meshes=[];root.traverse(node=>{if(node.isMesh){geometries.add(node.geometry);materials.add(node.material);meshes.push(node);}});return {geometries:[...geometries],materials:[...materials],meshes};}
function view(root){return resources(root).meshes.map(mesh=>[mesh.position.toArray(),mesh.rotation.toArray(),mesh.scale.toArray(),mesh.visible,mesh.material.emissiveIntensity,mesh.instanceMatrix?Array.from(mesh.instanceMatrix.array):null,mesh.instanceColor?Array.from(mesh.instanceColor.array):null]);}
const disposeStatic=root=>root.traverse(node=>node.geometry?.dispose());

test('fire survives static scenery merging with its exact placed world transform and no picking',()=>{
  const parent=new THREE.Group(),marker=createCheckpointMarker({label:'IV'});parent.position.set(2,0,-3);parent.rotation.y=.21;parent.add(marker);marker.position.set(6,0,4);marker.scale.setScalar(1.15);marker.rotation.y=-.35;parent.updateMatrixWorld(true);
  const fire=marker.children.find(node=>node.userData.checkpointPart==='fire'),before=new THREE.Box3().setFromObject(fire,true),owned=resources(fire),disposed=[];owned.geometries.forEach(geometry=>geometry.addEventListener('dispose',()=>disposed.push(geometry.uuid)));
  const effects=takeCheckpointEffects(marker);assert.ok(effects);assert.equal(takeCheckpointEffects(marker),null);const after=new THREE.Box3().setFromObject(effects,true);assert.ok(before.min.distanceTo(after.min)<1e-6&&before.max.distanceTo(after.max)<1e-6,'Detached fire keeps the original full world placement');
  const merged=optimize(parent);assert.deepEqual(disposed,[],'Static optimize never disposes a retained flame or ember buffer');assert.ok(resources(merged).geometries.every(geometry=>!owned.geometries.includes(geometry)));
  assert.deepEqual(new THREE.Raycaster(new THREE.Vector3(8,2,0),new THREE.Vector3(0,-1,0)).intersectObject(effects,true),[]);animateCheckpointEffects(effects,1);assert.ok(owned.meshes.every(mesh=>mesh.geometry.attributes.position.array.every(Number.isFinite)));
  disposeStatic(merged);disposeCheckpointEffects(effects);assert.equal(disposed.length,owned.geometries.length);
});

test('cosmetic fire flickers during gameplay pause and reduced motion restores a steady scene',()=>{
  const marker=createCheckpointMarker({label:'IV'}),effects=takeCheckpointEffects(marker);animateCheckpointEffects(effects,.2);const first=view(effects);animateCheckpointEffects(effects,1.4,{paused:true});assert.notDeepEqual(view(effects),first,'Absolute cosmetic time moves actual flame transforms and ember matrices independently of combat pause');
  animateCheckpointEffects(effects,20,{reducedMotion:true});const steady=view(effects);animateCheckpointEffects(effects,300,{reducedMotion:true});assert.deepEqual(view(effects),steady);assert.equal(resources(effects).meshes.find(mesh=>mesh.isInstancedMesh).visible,false,'Reduced motion hides rising sparks');
  animateCheckpointEffects(effects,301);assert.notDeepEqual(view(effects),steady);assert.equal(resources(effects).meshes.find(mesh=>mesh.isInstancedMesh).visible,true);disposeStatic(marker);disposeCheckpointEffects(effects);
});

test('hundreds of fire updates reuse all GPU resources and tolerate invalid clocks',()=>{
  const marker=createCheckpointMarker({label:'IV'}),effects=takeCheckpointEffects(marker),owned=resources(effects),instances=owned.meshes.find(mesh=>mesh.isInstancedMesh),matrix=instances.instanceMatrix,color=instances.instanceColor;
  for(let i=0;i<400;i++)animateCheckpointEffects(effects,i/20,{reducedMotion:i%29===0});const current=resources(effects);assert.deepEqual(current.geometries,owned.geometries);assert.deepEqual(current.materials,owned.materials);assert.equal(instances.instanceMatrix,matrix);assert.equal(instances.instanceColor,color);assert.ok(matrix.array.every(Number.isFinite)&&color.array.every(Number.isFinite));
  const prior=view(effects);for(const value of [NaN,Infinity,-Infinity])animateCheckpointEffects(effects,value);assert.deepEqual(view(effects),prior);effects.visible=false;animateCheckpointEffects(effects,50);assert.deepEqual(view(effects),prior);disposeStatic(marker);disposeCheckpointEffects(effects);
});

test('fire disposal releases every unique resource exactly once',()=>{
  const marker=createCheckpointMarker({label:'IV'}),effects=takeCheckpointEffects(marker),owned=resources(effects),released=new Map();for(const resource of [...owned.geometries,...owned.materials])resource.addEventListener('dispose',()=>released.set(resource,(released.get(resource)||0)+1));
  disposeCheckpointEffects(effects);disposeCheckpointEffects(effects);animateCheckpointEffects(effects,100);assert.equal(released.size,owned.geometries.length+owned.materials.length);assert.ok([...released.values()].every(count=>count===1));assert.equal(resources(effects).meshes.length,0);disposeStatic(marker);
});
