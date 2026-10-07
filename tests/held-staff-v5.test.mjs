import {testApprovedOrLegacy} from './reconstructed-roster-revision.test.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
import {optimizeGeometricSiblings} from '../game/render/geometric-batching.js';
import {attackRig,previewGeometricAttack,updateGeometricPreview,resetAttack,attackMuzzle,disposeAttack} from '../game/render/battle-animation.js';

const phases=[0,.10,.21,.30,.42,.48,.58,.70,.85,1];
async function claire(){
 const bytes=readFileSync(new URL('../public/assets/geometric/champions/ladyclaire.glb',import.meta.url));
 const source=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const actor=cloneDefenderTemplate(source.scene);return {source,actor};
}
const staffParts=actor=>{const meshes=[];actor.traverse(n=>{if(!n.isMesh)return;for(let p=n;p;p=p.parent)if(/^Staff_(?:golden_shaft|foot|ring_socket|open_faceted_ring)/.test(p.name)){meshes.push(n);break;}});return meshes;};
const relative=(weapon,node)=>new THREE.Matrix4().copy(weapon.matrixWorld).invert().multiply(node.matrixWorld).elements;
const difference=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
function driftingParts(actor,rig){
 const weapon=actor.getObjectByName('weapon_R'),parts=staffParts(actor),failed=new Set();
 resetAttack(rig);actor.updateWorldMatrix(true,true);const rest=new Map(parts.map(n=>[n,relative(weapon,n)]));
 for(const p of phases){resetAttack(rig);previewGeometricAttack(rig,{duration:1});updateGeometricPreview(rig,p);actor.updateWorldMatrix(true,true);for(const n of parts)if(difference(relative(weapon,n),rest.get(n))>1e-7)failed.add(n.name);}
 return [...failed];
}

testApprovedOrLegacy(["ladyclaire"],"Approved Claire staff surfaces remain intact and move with her runtime release endpoint","the actual Claire staff including its open gold crown moves as one rigid weapon for the whole attack",async()=>{
 const {source,actor}=await claire(),rig=attackRig(actor,'ladyclaire',{type:'holy'});
 try{
  const parts=staffParts(actor);assert.ok(parts.length>=4,'the physical shaft, foot, socket and ring are imported');
  const ring=parts.filter(n=>/^Staff_open_faceted_ring/.test(n.name));assert.ok(ring.length,'the physical decorative ring is included');
  assert.deepEqual(driftingParts(actor,rig),[]);
  resetAttack(rig);actor.updateWorldMatrix(true,true);const before=new THREE.Box3().setFromObject(ring[0],true).getCenter(new THREE.Vector3());
  previewGeometricAttack(rig,{duration:1});updateGeometricPreview(rig,.42);actor.updateWorldMatrix(true,true);
  const after=new THREE.Box3().setFromObject(ring[0],true).getCenter(new THREE.Vector3());assert.ok(before.distanceTo(after)>.015,'the physical crown actually moves in world space');
  const focus=attackMuzzle(rig);assert.ok(focus&&new THREE.Box3().setFromObject(actor.getObjectByName('Staff_open_faceted_ring'),true).expandByScalar(.01).containsPoint(focus),'the cast originates on the moving physical focus');
 }finally{disposeAttack(rig);disposeDefenderInstance(actor);disposeDecodedGeometricAsset(source);}
});

testApprovedOrLegacy(["ladyclaire"],"Approved Claire source staff binding survives actual attack phases, reset and private resource cleanup","the staff check detects a physical crown incorrectly left on the head even if its cast endpoint follows the hand",async()=>{
 const {source,actor}=await claire(),ring=actor.getObjectByName('Staff_open_faceted_ring');
 actor.updateWorldMatrix(true,true);assert.ok(ring);actor.getObjectByName('head_pivot').attach(ring);
 const rig=attackRig(actor,'ladyclaire',{type:'holy'});
 try{assert.ok(driftingParts(actor,rig).some(name=>/^Staff_open_faceted_ring/.test(name)),'the real reported regression must fail independently of muzzle metadata');}
 finally{disposeAttack(rig);disposeDefenderInstance(actor);disposeDecodedGeometricAsset(source);}
});
testApprovedOrLegacy(["ladyclaire"],"Approved Claire production batching preserves real staff surfaces and runtime attack behavior","the production batched Claire crown stays fixed to the moving shaft through release and recovery",async()=>{
 const {source,actor}=await claire();optimizeGeometricSiblings(actor);const rig=attackRig(actor,'ladyclaire',{type:'holy'});
 try{assert.ok(staffParts(actor).length,'actual physical ring/shaft surfaces remain after production batching');assert.deepEqual(driftingParts(actor,rig),[]);}
 finally{disposeAttack(rig);disposeDefenderInstance(actor);disposeDecodedGeometricAsset(source);}
});
