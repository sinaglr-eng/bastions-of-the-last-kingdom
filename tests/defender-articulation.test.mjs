import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {attackRig,triggerAttack,animateAttack,attackMuzzle,disposeAttack,resetAttack,siegeRig,animateSiege} from '../game/render/battle-animation.js';
import {CombatEffects} from '../game/render/combat-effects.js';

const folder=new URL('../public/assets/models/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',folder))).filter(e=>e.kind==='tower');
const towers=JSON.parse(readFileSync(new URL('../data/towers.json',import.meta.url)));
const cached=new Map();
async function model(entry){
  if(!cached.has(entry.file))cached.set(entry.file,(async()=>{const bytes=readFileSync(new URL(entry.file,folder)),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');gltf.scene.animations=gltf.animations;return gltf.scene;})());
  return cached.get(entry.file);
}
const meshes=root=>{const parts=[];root.traverse(o=>{if(o.isMesh)parts.push(o);});return parts;};
const sample=o=>{o.updateWorldMatrix(true,false);return new THREE.Vector3().fromBufferAttribute(o.geometry.attributes.position,0).applyMatrix4(o.matrixWorld);};
const entry=(family,tier=1)=>manifest.find(e=>e.family===family&&e.tier===tier);

test('all 87 production defenders export active articulated mesh hierarchies, not dormant named nodes',async()=>{
  assert.equal(manifest.length,87);
  for(const e of manifest){
    const native=['ladyclaire','lordbernhard'].includes(e.family);
    assert.equal(e.articulationRevision,native?2:1,`${e.family}/${e.tier}: not regenerated`);
    const source=await model(e),actor=cloneDefenderTemplate(source),stats=towers[e.family],rig=attackRig(actor,e.family,stats),siege=siegeRig(actor);
    if(native){
      assert.ok(rig.native,'Native assets require exported clips and weighted skins');
      assert.notEqual(actor.getObjectByProperty('isSkinnedMesh',true).skeleton,source.getObjectByProperty('isSkinnedMesh',true).skeleton);
      // Full skin deformation, release and independent-cache checks are exercised
      // against these production assets in secret-native-rig.test.mjs.
      disposeAttack(rig);disposeDefenderInstance(actor);continue;
    }
    const decorations=new Set(rig.owned.flatMap(meshes));
    const moving=rig.pivots.flatMap(p=>meshes(p.node)).filter(m=>!decorations.has(m));if(siege)moving.push(...meshes(siege.arm));
    assert.ok(moving.length>0,`${e.family}/${e.tier}: joints have no real mesh descendants`);
    const samples=moving.map(sample),original=meshes(source).map(sample);
    actor.position.set(7,.85,3);actor.rotation.y=1.15;actor.scale.setScalar(.72);actor.updateMatrixWorld(true);
    const position=actor.position.toArray(),scale=actor.scale.toArray();
    // Compare before/after under the same battlefield transform.
    const rest=moving.map(sample);triggerAttack(rig,{stats});animateAttack(rig,.14);if(siege){siege.elapsed=0;animateSiege(siege,.13);}
    assert.ok(moving.some((part,i)=>sample(part).distanceTo(rest[i])>.02),`${e.family}/${e.tier}: firing did not move real geometry`);
    assert.deepEqual(actor.position.toArray(),position);assert.deepEqual(actor.scale.toArray(),scale);assert.equal(actor.rotation.y,1.15);
    meshes(source).forEach((part,i)=>assert.deepEqual(sample(part).toArray(),original[i].toArray(),'Animating a clone changed the cached model'));
    resetAttack(rig);if(siege){siege.elapsed=siege.duration;animateSiege(siege,0);}
    moving.forEach((part,i)=>assert.ok(sample(part).distanceTo(rest[i])<1e-5,`${e.family}: joint failed to restore rest pose`));
    assert.ok(samples.every(p=>p.toArray().every(Number.isFinite)));disposeAttack(rig);
  }
});

test('Archer drawing hand pulls the actual bowstring, and cloned materials/vertices remain untouched',async()=>{
  const source=await model(entry('archer')),actor=source.clone(true),rig=attackRig(actor,'archer',towers.archer);
  assert.ok(rig.string&&actor.getObjectByName('forearm_R'));const hand=actor.getObjectByName('hand_R'),before=hand.getWorldPosition(new THREE.Vector3());
  const geometry=meshes(source)[0].geometry,vertices=Array.from(geometry.attributes.position.array);
  triggerAttack(rig);animateAttack(rig,rig.duration*.42);assert.ok(hand.getWorldPosition(new THREE.Vector3()).distanceTo(before)>.10);
  const positions=rig.string.object.geometry.attributes.position,nock=actor.worldToLocal(rig.string.nock.getWorldPosition(new THREE.Vector3()));
  assert.ok(new THREE.Vector3().fromBufferAttribute(positions,1).distanceTo(nock)<1e-6);assert.deepEqual(Array.from(geometry.attributes.position.array),vertices);
  animateAttack(rig,2);assert.ok(hand.getWorldPosition(new THREE.Vector3()).distanceTo(before)<1e-5);disposeAttack(rig);
});

test('existing Elven Ranger champion retains its authored nock-linked bow at rest and during attacks',async()=>{
  const actor=(await model(entry('thornwarden'))).clone(true),rig=attackRig(actor,'thornwarden',towers.thornwarden);
  assert.ok(rig.string);assert.equal(rig.string.restStraight,false);
  const linked=()=>{
    actor.updateMatrixWorld(true);const nock=actor.worldToLocal(rig.string.nock.getWorldPosition(new THREE.Vector3()));
    for(const index of [1,3])assert.ok(new THREE.Vector3().fromBufferAttribute(rig.string.object.geometry.attributes.position,index).distanceTo(nock)<1e-6);
  };
  linked();triggerAttack(rig);animateAttack(rig,.14);linked();resetAttack(rig);linked();disposeAttack(rig);
});

test('Soldier sword follows shoulder/elbow/wrist articulation while the pedestal stays planted',async()=>{
  const actor=(await model(entry('soldier',2))).clone(true),rig=attackRig(actor,'soldier',towers.soldier),weapon=actor.getObjectByName('weapon_R');
  const sword=meshes(weapon);assert.ok(sword.length>=2);const before=sword.map(sample),root=actor.position.toArray();
  triggerAttack(rig);animateAttack(rig,.14);assert.ok(sword.some((part,i)=>sample(part).distanceTo(before[i])>.15));assert.deepEqual(actor.position.toArray(),root);
  assert.equal(actor.rotation.x,0,'An articulated attack must not substitute whole-actor leaning');disposeAttack(rig);
});

test('Mage charges the authored moving staff tip and releases a wave from its world-space muzzle',async()=>{
  const source=await model(entry('mage')),actor=source.clone(true),rig=attackRig(actor,'mage',towers.mage);
  actor.position.set(5,.85,8);actor.rotation.y=.6;actor.scale.setScalar(.7);
  const before=attackMuzzle(rig).clone();assert.ok(rig.glow);triggerAttack(rig);animateAttack(rig,.12);assert.ok(rig.glow.visible);const muzzle=attackMuzzle(rig);
  assert.ok(muzzle.distanceTo(before)>.1);const sourceMaterials=meshes(source).map(m=>m.material);
  assert.ok(rig.glow.children.every(m=>!sourceMaterials.includes(m.material)),'Charge materials must belong to this actor');
  const scene=new THREE.Scene(),fx=new CombatEffects(scene,{getMuzzle:(_,out)=>attackMuzzle(rig,out)});
  const shot={id:1,source:{family:'mage',x:1,z:1},target:{x:12,z:12},stats:towers.mage,progress:0};const original=structuredClone(shot);fx.shot(shot);
  assert.ok(fx.projectiles.get(1).object.position.distanceTo(muzzle)<1e-5);assert.ok(scene.getObjectByName('Staff-tip released magic wave'));assert.deepEqual(shot,original);
  fx.dispose();disposeAttack(rig);
});

test('reduced motion keeps joints at rest and owned string/glow resources dispose exactly once',async()=>{
  for(const family of ['archer','mage']){
    const actor=(await model(entry(family))).clone(true),rig=attackRig(actor,family,towers[family]),rest=rig.pivots.map(p=>p.node.rotation.toArray()),disposed=[];
    for(const obj of rig.owned)obj.traverse(node=>{for(const resource of [node.geometry,node.material])if(resource){const item={count:0};resource.addEventListener('dispose',()=>item.count++);disposed.push(item);}});
    triggerAttack(rig);animateAttack(rig,.12,0,{reducedMotion:true});rig.pivots.forEach((p,i)=>assert.deepEqual(p.node.rotation.toArray(),rest[i]));
    disposeAttack(rig);disposeAttack(rig);assert.ok(disposed.every(item=>item.count===1));assert.equal(attackMuzzle(rig),null);assert.equal(rig.owned.length,0);
  }
});

test('Lady Claire native orbs remain independent of her weighted body and peer skeleton',async()=>{
  const source=await model(entry('ladyclaire')),actor=cloneDefenderTemplate(source),peer=cloneDefenderTemplate(source);
  const orbs=[0,1,2].map(index=>actor.getObjectByName('secret_orb_'+index));
  assert.ok(orbs.every((orb,index)=>orb&&orb.userData.secretOrbIndex===index&&meshes(orb).length===2));
  const before=orbs.map(orb=>meshes(orb).map(sample));
  const head=actor.getObjectByName('head'),facePosition=head.getWorldPosition(new THREE.Vector3());
  orbs[0].position.x+=.2;actor.updateMatrixWorld(true);
  assert.ok(meshes(orbs[0]).some((mesh,i)=>sample(mesh).distanceTo(before[0][i])>.19));
  for(const i of [1,2])meshes(orbs[i]).forEach((mesh,j)=>assert.deepEqual(sample(mesh).toArray(),before[i][j].toArray()));
  assert.ok(head.getWorldPosition(new THREE.Vector3()).equals(facePosition));
  assert.notEqual(head,peer.getObjectByName('head'));disposeDefenderInstance(actor);disposeDefenderInstance(peer);
});

after(async()=>{
  const resources=new Set();for(const source of await Promise.all(cached.values()))source.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});for(const resource of resources)resource.dispose();
});
