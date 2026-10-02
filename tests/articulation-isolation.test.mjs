import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {NativeTestGLTFLoader as GLTFLoader} from './helpers/native-gltf.mjs';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {previewDefenderAttack,updateDefenderPreview,resetDefenderAnimation} from '../game/render/defender-animation.js';
import {attackRig,triggerAttack,animateAttack,resetAttack,disposeAttack} from '../game/render/battle-animation.js';

const base=new URL('../public/assets/models/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',base)));
const towers=JSON.parse(readFileSync(new URL('../data/towers.json',import.meta.url)));
const sources=new Map();
async function sourceFor(entry){
  if(!sources.has(entry.file)){
    const bytes=readFileSync(new URL(entry.file,base));
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');gltf.scene.animations=gltf.animations;sources.set(entry.file,gltf.scene);
  }
  return sources.get(entry.file);
}
function meshes(root){const list=[];root.traverse(node=>{if(node.isMesh)list.push(node);});return list;}
function resources(root){const list=new Set();root.traverse(node=>{if(node.geometry)list.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])if(material)list.add(material);});return list;}

test('every basic rank has a real joint chain and its actual geometry matches the bounded manifest',async()=>{
  const entries=manifest.filter(entry=>entry.kind==='tower'&&!towers[entry.family].advanced);
  assert.equal(entries.length,48);
  for(const entry of entries){
    const actor=await sourceFor(entry),label=`${entry.family} ${entry.tier}`;
    for(const side of ['L','R']){
      const upper=actor.getObjectByName(`upper_arm_${side}`),lower=actor.getObjectByName(`forearm_${side}`),hand=actor.getObjectByName(`hand_${side}`);
      assert.ok(upper&&lower&&hand,label+': joint chain missing');
      assert.equal(lower.parent,upper,label+': elbow must belong to shoulder');
      assert.equal(hand.parent,lower,label+': wrist must belong to elbow');
      assert.ok(upper.isBone&&lower.isBone&&hand.isBone,label+': joints must belong to a native armature');
      const skinned=meshes(actor).filter(mesh=>mesh.isSkinnedMesh);assert.ok(skinned.length,label+': no weighted surfaces');
      const bone=skinned[0].skeleton.bones.indexOf(hand);let influenced=0;
      for(const mesh of skinned)for(let vertex=0;vertex<mesh.geometry.attributes.skinWeight.count;vertex++)for(let slot=0;slot<4;slot++)if(mesh.geometry.attributes.skinIndex.getComponent(vertex,slot)===bone&&mesh.geometry.attributes.skinWeight.getComponent(vertex,slot)>.01)influenced++;
      assert.ok(influenced>10,label+': named hand has no actual geometry weights');
    }
    let triangles=0;
    for(const mesh of meshes(actor)){
      const position=mesh.geometry.attributes.position;
      assert.ok(position.count>0,label+': empty mesh');
      assert.ok(position.array.every(Number.isFinite),label+': invalid vertex');
      triangles+=(mesh.geometry.index?.count||position.count)/3;
    }
    assert.equal(triangles,entry.triangles,label+': stale triangle count');
    assert.ok(triangles>0&&triangles<30000,label+': real geometry exceeds the redesigned basic budget');
  }
});

test('simultaneous native clones own private skeletons and glows and dispose without invalidating another actor or cached bowstring',async()=>{
  for(const family of ['archer','mage']){
    const source=await sourceFor(manifest.find(entry=>entry.kind==='tower'&&entry.family===family&&entry.tier===1));
    const a=cloneDefenderTemplate(source),b=cloneDefenderTemplate(source),ra=attackRig(a,family,towers[family]),rb=attackRig(b,family,towers[family]);
    assert.ok(ra.native&&rb.native);assert.notEqual(a.getObjectByProperty('isSkinnedMesh',true).skeleton,b.getObjectByProperty('isSkinnedMesh',true).skeleton);
    const sourceResources=resources(source);let sharedDisposals=0,otherDisposals=0;
    sourceResources.forEach(resource=>resource.addEventListener('dispose',()=>sharedDisposals++));
    for(const object of rb.owned)resources(object).forEach(resource=>{
      assert.ok(!sourceResources.has(resource));resource.addEventListener('dispose',()=>otherDisposals++);
    });
    assert.equal(meshes(a)[0].geometry,meshes(b)[0].geometry,'base geometry should remain shared');
    if(ra.string){assert.notEqual(ra.string.object.geometry,rb.string.object.geometry);assert.notEqual(ra.string.object.material,rb.string.object.material);}
    if(ra.glow)assert.notEqual(ra.glow.children[0].material,rb.glow.children[0].material);
    triggerAttack(ra);animateAttack(ra,.14);
    const poseA=ra.pivots.map(pivot=>pivot.node.rotation.toArray());
    const stringA=ra.string?Array.from(ra.string.object.geometry.attributes.position.array):null;
    triggerAttack(rb);animateAttack(rb,.04);
    ra.pivots.forEach((pivot,index)=>assert.deepEqual(pivot.node.rotation.toArray(),poseA[index]));
    if(stringA)assert.deepEqual(Array.from(ra.string.object.geometry.attributes.position.array),stringA);
    disposeAttack(ra);disposeDefenderInstance(a);assert.equal(sharedDisposals,0);assert.equal(otherDisposals,0);
    assert.equal(rb.disposed,false);assert.ok(rb.owned.every(object=>object.parent),'other actor effects remain attached');
    animateAttack(rb,.04);assert.ok(rb.active);resetAttack(rb);disposeAttack(rb);disposeDefenderInstance(b);
    assert.equal(sharedDisposals,0,'actor cleanup never disposes cached GLB resources');
  }
});

test('actual bow joints retain their draw pose when the projectile presentation uses a spell type',async()=>{
  const source=await sourceFor(manifest.find(entry=>entry.family==='thornwarden'&&entry.tier===1));
  const before=JSON.stringify(towers),actor=cloneDefenderTemplate(source);
  // A different projectile palette must not turn a real bow into a casting pose.
  const rig=attackRig(actor,'thornwarden',{...towers.thornwarden,type:'poison'});
  assert.ok(rig.native&&actor.getObjectByName('bow')?.isBone&&actor.getObjectByName('nocked_arrow')?.isBone,'the production elven bow must have native equipment bones');
  assert.equal(rig.kind,'arcane','projectile presentation remains independent of weapon motion');
  const hand=actor.getObjectByName('hand_R'),rest=hand.getWorldPosition(new THREE.Vector3());
  previewDefenderAttack(rig.native);updateDefenderPreview(rig.native,.2);
  assert.ok(hand.getWorldPosition(new THREE.Vector3()).distanceTo(rest)>.005,'the drawing hand articulates toward the nock');
  assert.equal(JSON.stringify(towers),before,'presentation never changes approved balance data');
  resetDefenderAnimation(rig.native,{reducedMotion:true});assert.ok(hand.getWorldPosition(new THREE.Vector3()).distanceTo(rest)<1e-5);disposeAttack(rig);disposeDefenderInstance(actor);
  const bearSource=await sourceFor(manifest.find(entry=>entry.family==='rangermentor'&&entry.tier===1));
  const bearActor=cloneDefenderTemplate(bearSource),bear=attackRig(bearActor,'rangermentor',towers.rangermentor);assert.ok(bear.native);
  assert.equal(bear.string,undefined,'Bearking has no bow and retains its own attack presentation');
  assert.equal(bear.kind,'roots');disposeAttack(bear);disposeDefenderInstance(bearActor);
});

after(()=>{const owned=new Set();for(const source of sources.values())resources(source).forEach(resource=>owned.add(resource));owned.forEach(resource=>resource.dispose());});
