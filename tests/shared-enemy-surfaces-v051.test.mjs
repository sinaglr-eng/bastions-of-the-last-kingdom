import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {optimizeGeometricSiblings,releaseSharedGeometricBatches,sharedGeometricBatchStats} from '../game/render/geometric-batching.js';
import {prepareApprovedMotionTemplate,approvedMotionController} from '../game/render/approved-model-motion.js';
import {enemyFigure,disposeEnemyFigure} from '../game/render/enemy-assets.js';
import {animateEnemyMotion} from '../game/render/enemy-motion.js';
import {beginDeath,animateDeath} from '../game/render/battle-animation.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';

const sha=value=>createHash('sha256').update(value).digest('hex');
const root=new URL('../public/assets/geometric/',import.meta.url);
const entries=JSON.parse(readFileSync(new URL('geometric-enemies.json',root))).entries;
const surfaces=actor=>{const result=[];actor.traverse(node=>{if(node.isMesh&&node.userData.geometricBatch)result.push(node);});return result;};
function digest(actor){
  const h=createHash('sha256');actor.updateWorldMatrix(true,true);
  actor.traverse(node=>{
    h.update(JSON.stringify([node.name,node.visible,...node.matrixWorld.elements]));
    if(!node.isMesh)return;
    for(const [key,a]of Object.entries(node.geometry.attributes)){h.update(key);h.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));}
    for(const m of Array.isArray(node.material)?node.material:[node.material])h.update(JSON.stringify([m.uuid,m.color?.getHex(),m.emissive?.getHex(),m.metalness,m.roughness,m.map?.uuid,m.normalMap?.uuid]));
  });return h.digest('hex');
}
async function load(id){
  const entry=entries.find(row=>row.id===id),bytes=readFileSync(new URL(entry.file,root));
  assert.equal(sha(bytes),entry.assetSha256,'approved original GLB bytes');
  const gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  prepareApprovedMotionTemplate(gltf.scene,entry);return {entry,gltf};
}
function boxSource(){
  const root=new THREE.Group();root.userData.geometricRig=true;
  const geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial({color:'#9ea2a8'});
  for(let i=0;i<2;i++){const mesh=new THREE.Mesh(geometry,material);mesh.name='fixed_'+i;mesh.position.x=i;root.add(mesh);}
  return {root,geometry,material};
}

test('shared static batches retain their exact immutable surfaces until the last borrower leaves',()=>{
  const source=boxSource(),scope={},a=source.root.clone(true),b=source.root.clone(true);
  optimizeGeometricSiblings(a,{sharedScope:scope});optimizeGeometricSiblings(b,{sharedScope:scope});
  const first=surfaces(a)[0],second=surfaces(b)[0];assert.equal(first.geometry,second.geometry);assert.equal(first.material,second.material);
  let disposals=0;first.geometry.addEventListener('dispose',()=>disposals++);
  const unchanged=digest(b);
  assert.equal(releaseSharedGeometricBatches(a),0);assert.equal(disposals,0);assert.equal(digest(b),unchanged);
  assert.equal(releaseSharedGeometricBatches(a),0,'release is idempotent');
  assert.equal(releaseSharedGeometricBatches(b),1);assert.equal(disposals,1);assert.equal(sharedGeometricBatchStats().geometries,0);
  source.geometry.dispose();source.material.dispose();
});

test('different decoded scopes, local transforms and materials never reuse an incompatible batch',()=>{
  const source=boxSource(),scope={},actors=Array.from({length:4},()=>source.root.clone(true));
  actors[2].children[1].position.y=.37;
  const alternate=source.material.clone();actors[3].children.forEach(mesh=>{mesh.material=alternate;});
  const scopes=[scope,{},scope,scope];actors.forEach((actor,i)=>optimizeGeometricSiblings(actor,{sharedScope:scopes[i]}));
  assert.equal(new Set(actors.map(actor=>surfaces(actor)[0].geometry)).size,4);
  actors.forEach(releaseSharedGeometricBatches);assert.equal(sharedGeometricBatchStats().geometries,0);
  source.geometry.dispose();source.material.dispose();alternate.dispose();
});

test('two matching groups within one actor release both borrowed references exactly once',()=>{
  const source=boxSource(),actor=new THREE.Group();actor.userData.geometricRig=true;
  actor.add(source.root.clone(true),source.root.clone(true));optimizeGeometricSiblings(actor,{sharedScope:{}});
  const meshes=surfaces(actor);assert.equal(meshes.length,2);assert.equal(meshes[0].geometry,meshes[1].geometry);
  assert.equal(sharedGeometricBatchStats().borrowers,2);let disposals=0;meshes[0].geometry.addEventListener('dispose',()=>disposals++);
  assert.equal(releaseSharedGeometricBatches(actor),1);assert.equal(disposals,1);assert.equal(sharedGeometricBatchStats().geometries,0);
  source.geometry.dispose();source.material.dispose();
});

for(const id of ['host_44','host_45'])test(`${id} preserves every posed vertex, normal, material and actor-local motion while borrowing static batches`,async()=>{
  const {entry,gltf}=await load(id),before=digest(gltf.scene);
  const templates=new Map([[id,gltf.scene]]),enemy={id:1,type:id,statuses:{},speed:1};
  const a=enemyFigure(enemy,templates),b=enemyFigure({...enemy,id:2},templates);
  // The same batching path without sharing supplies an independently built
  // reference for exact complete rendered geometry and transform comparison.
  const referenceTemplate=gltf.scene.clone(true);referenceTemplate.userData.approvedMotionTemplate.poseGeneration=null;
  const reference=enemyFigure(enemy,new Map([[id,referenceTemplate]]));
  const originals=new Set();gltf.scene.traverse(node=>{if(node.geometry)originals.add(node.geometry);for(const m of Array.isArray(node.material)?node.material:[node.material])if(m)originals.add(m);});
  let sourceDisposals=0;for(const resource of originals)resource.addEventListener('dispose',()=>sourceDisposals++);
  try{
    assert.equal(surfaces(a).length,7);assert.ok(surfaces(a).every((mesh,i)=>mesh.geometry===surfaces(b)[i].geometry));
    const ca=approvedMotionController(a.userData.body),cb=approvedMotionController(b.userData.body);
    const fieldA=ca.runtimeRig.deformers[0].meshes[0],fieldB=cb.runtimeRig.deformers[0].meshes[0];
    assert.notEqual(fieldA.geometry,fieldB.geometry);assert.notEqual(fieldA.position.array,fieldB.position.array);
    for(const [clock,options]of [[.25,{}],[.77,{}],[1600,{reducedMotion:true}],[1600.1,{}]]){
      animateEnemyMotion(a,enemy,clock,options);animateEnemyMotion(reference,enemy,clock,options);
      assert.equal(digest(a),digest(reference),id+' exact formerly unshared rendered surface at '+clock);
    }
    animateEnemyMotion(b,{...enemy,id:2,statuses:{freeze:1}},1600.1);
    const frozen=digest(b);animateEnemyMotion(a,enemy,1600.7);assert.equal(digest(b),frozen,'independent private pose and transforms');
    beginDeath(a,enemy);animateDeath(a,.3);assert.equal(digest(b),frozen,'a corpse never deforms a living peer');
    const buffers=surfaces(b).map(mesh=>mesh.geometry),counts=buffers.map(()=>0);
    buffers.forEach((geometry,i)=>geometry.addEventListener('dispose',()=>counts[i]++));
    disposeEnemyFigure(a);assert.deepEqual(counts,Array(7).fill(0));assert.equal(digest(b),frozen,'removing a corpse keeps all living shared surfaces');
    assert.equal(sourceDisposals,0);assert.equal(digest(gltf.scene),before,'approved rest geometry and PBR finish stay exact');
    disposeEnemyFigure(b);assert.deepEqual(counts,Array(7).fill(1),'the last borrower releases each shared GPU geometry once');
  }finally{disposeEnemyFigure(a);disposeEnemyFigure(b);disposeEnemyFigure(reference);disposeDecodedGeometricAsset(gltf);}
  assert.equal(sharedGeometricBatchStats().geometries,0);
});

test('the actual 29-enemy wave44 static geometry budget is one surface set and returns to zero at cleanup',async()=>{
  const {gltf}=await load('host_44'),templates=new Map([['host_44',gltf.scene]]);
  const figures=Array.from({length:29},(_,i)=>enemyFigure({id:i+1,type:'host_44',statuses:{}},templates));
  try{
    const stats=sharedGeometricBatchStats();assert.equal(stats.geometries,7);assert.equal(stats.borrowers,29*7);
    assert.equal(stats.bytes,29263488);assert.equal(stats.unsharedBytes,848641152);
    assert.equal(stats.unsharedBytes-stats.bytes,819377664,'no vertex removal or render-quality reduction is needed for this saving');
  }finally{figures.forEach(disposeEnemyFigure);disposeDecodedGeometricAsset(gltf);}
  assert.deepEqual(sharedGeometricBatchStats(),{geometries:0,borrowers:0,bytes:0,unsharedBytes:0});
});
