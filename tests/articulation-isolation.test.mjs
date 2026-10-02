import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {attackRig,triggerAttack,animateAttack,resetAttack,disposeAttack} from '../game/render/battle-animation.js';

const base=new URL('../public/assets/models/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',base)));
const towers=JSON.parse(readFileSync(new URL('../data/towers.json',import.meta.url)));
const sources=new Map();
async function sourceFor(entry){
  if(!sources.has(entry.file)){
    const bytes=readFileSync(new URL(entry.file,base));
    sources.set(entry.file,(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene);
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
      assert.ok(meshes(hand).length,label+': hand must carry actual geometry');
    }
    let triangles=0;
    for(const mesh of meshes(actor)){
      const position=mesh.geometry.attributes.position;
      assert.ok(position.count>0,label+': empty mesh');
      assert.ok(position.array.every(Number.isFinite),label+': invalid vertex');
      triangles+=(mesh.geometry.index?.count||position.count)/3;
    }
    assert.equal(triangles,entry.triangles,label+': stale triangle count');
    assert.ok(triangles>0&&triangles<10000,label+': real geometry exceeds limit');
  }
});

test('simultaneous clones own independent strings and glows and can dispose without invalidating another actor',async()=>{
  for(const family of ['archer','mage']){
    const source=await sourceFor(manifest.find(entry=>entry.kind==='tower'&&entry.family===family&&entry.tier===1));
    const a=source.clone(true),b=source.clone(true),ra=attackRig(a,family,towers[family]),rb=attackRig(b,family,towers[family]);
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
    disposeAttack(ra);assert.equal(sharedDisposals,0);assert.equal(otherDisposals,0);
    assert.equal(rb.disposed,false);assert.ok(rb.owned.every(object=>object.parent),'other actor effects remain attached');
    animateAttack(rb,.04);assert.ok(rb.active);resetAttack(rb);disposeAttack(rb);
    assert.equal(sharedDisposals,0,'actor cleanup never disposes cached GLB resources');
  }
});

test('actual bow joints retain their draw pose when the projectile presentation uses a spell type',async()=>{
  const source=await sourceFor(manifest.find(entry=>entry.family==='thornwarden'&&entry.tier===1));
  const before=JSON.stringify(towers),actor=source.clone(true);
  // A different projectile palette must not turn a real bow into a casting pose.
  const rig=attackRig(actor,'thornwarden',{...towers.thornwarden,type:'poison'});
  assert.ok(rig.string,'the production elven bow must have real string markers');
  assert.equal(rig.kind,'arcane','projectile presentation remains independent of weapon motion');
  const forearm=rig.joints.get('forearm_R'),restY=forearm.node.rotation.y;
  triggerAttack(rig);animateAttack(rig,.14);
  assert.ok(forearm.node.rotation.y<restY-.4,'the drawing forearm rotates back toward the nock');
  assert.equal(JSON.stringify(towers),before,'presentation never changes approved balance data');
  resetAttack(rig);assert.equal(forearm.node.rotation.y,restY);disposeAttack(rig);
  const bearSource=await sourceFor(manifest.find(entry=>entry.family==='rangermentor'&&entry.tier===1));
  const bear=attackRig(bearSource.clone(true),'rangermentor',towers.rangermentor);
  assert.equal(bear.string,undefined,'Bearking has no bow and retains its own attack presentation');
  assert.equal(bear.kind,'roots');disposeAttack(bear);
});

after(()=>{const owned=new Set();for(const source of sources.values())resources(source).forEach(resource=>owned.add(resource));owned.forEach(resource=>resource.dispose());});
