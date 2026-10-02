import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {attackRig,triggerAttack,animateAttack,attackMuzzle,disposeAttack} from '../game/render/battle-animation.js';
import {previewDefenderAttack,updateDefenderPreview,resetDefenderAnimation} from '../game/render/defender-animation.js';
import {CombatEffects} from '../game/render/combat-effects.js';

const folder=new URL('../public/assets/models/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',folder))).filter(e=>e.kind==='tower');
const towers=JSON.parse(readFileSync(new URL('../data/towers.json',import.meta.url))),cached=new Map();
async function model(entry){
  if(!cached.has(entry.file))cached.set(entry.file,(async()=>{const bytes=readFileSync(new URL(entry.file,folder)),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');gltf.scene.animations=gltf.animations;gltf.scene.updateMatrixWorld(true);return gltf.scene;})());
  return cached.get(entry.file);
}
const meshes=root=>{const parts=[];root.traverse(o=>{if(o.isMesh)parts.push(o);});return parts;};
const skins=root=>meshes(root).filter(o=>o.isSkinnedMesh);
const sample=(o,i=0)=>o.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(o.matrixWorld);
const entry=(family,tier=1)=>manifest.find(e=>e.family===family&&e.tier===tier);
const pose=root=>skins(root)[0].skeleton.bones.map(b=>[b.name,...b.position.toArray(),...b.quaternion.toArray(),...b.scale.toArray()]);
function points(root){root.updateMatrixWorld(true);return skins(root).flatMap(mesh=>Array.from({length:Math.min(100,mesh.geometry.attributes.position.count)},(_,i)=>{const index=Math.floor(i*mesh.geometry.attributes.position.count/100);return {mesh,index,point:sample(mesh,index)};}));}

test('all 86 available variants and the retained Bernhard archive deform actual surfaces independently of cached templates',async()=>{
  assert.equal(manifest.length,87);
  for(const e of manifest){
    assert.equal(e.articulationRevision,e.family==='lordbernhard'?2:3,e.family+'/'+e.tier);
    const source=await model(e),actor=cloneDefenderTemplate(source),rig=attackRig(actor,e.family,towers[e.family]);
    try{
      assert.ok(rig.native,e.family+' has no native weighted clip');assert.notEqual(skins(actor)[0].skeleton,skins(source)[0].skeleton);
      actor.position.set(7,.85,3);actor.rotation.y=1.15;actor.scale.setScalar(.72);actor.updateMatrixWorld(true);
      const transform=[actor.position.toArray(),actor.rotation.toArray(),actor.scale.toArray()],rest=points(actor),original=pose(source);
      previewDefenderAttack(rig.native);updateDefenderPreview(rig.native,.36);
      assert.ok(rest.some(({mesh,index,point})=>sample(mesh,index).distanceTo(point)>.002),e.family+'/'+e.tier+' clip did not move real geometry');
      assert.deepEqual([actor.position.toArray(),actor.rotation.toArray(),actor.scale.toArray()],transform);assert.deepEqual(pose(source),original);
      resetDefenderAnimation(rig.native,{reducedMotion:true});actor.updateMatrixWorld(true);
      for(const {mesh,index,point}of rest)assert.ok(sample(mesh,index).distanceTo(point)<1e-5,e.family+'/'+e.tier+' surface failed to return to rest');
      assert.ok(rest.every(({point})=>point.toArray().every(Number.isFinite)));
    }finally{disposeAttack(rig);disposeDefenderInstance(actor);}
  }
});

test('Archer draws a real weighted bowstring between bow and hand without altering cached vertices',async()=>{
  const source=await model(entry('archer')),actor=cloneDefenderTemplate(source),rig=attackRig(actor,'archer',towers.archer);
  try{
    assert.ok(rig.native);const skeleton=skins(actor)[0].skeleton,bow=skeleton.bones.findIndex(b=>b.name==='bow'),handIndex=skeleton.bones.findIndex(b=>b.name==='hand_R');assert.ok(bow>=0&&handIndex>=0);const string=[];
    for(const mesh of skins(actor)){
      const weights=mesh.geometry.attributes.skinWeight,indices=mesh.geometry.attributes.skinIndex;
      for(let v=0;v<weights.count;v++){let bw=0,hw=0;for(let i=0;i<4;i++){if(indices.getComponent(v,i)===bow)bw+=weights.getComponent(v,i);if(indices.getComponent(v,i)===handIndex)hw+=weights.getComponent(v,i);}
        if(bw>.02&&hw>.02)string.push({mesh,index:v,point:sample(mesh,v)});
      }
    }
    assert.ok(string.length>10,'Bowstring geometry must blend the bow and drawing hand');
    const hand=actor.getObjectByName('hand_R'),before=hand.getWorldPosition(new THREE.Vector3()),geometry=skins(source)[0].geometry,vertices=Array.from(geometry.attributes.position.array);
    previewDefenderAttack(rig.native);updateDefenderPreview(rig.native,.2);actor.updateMatrixWorld(true);
    assert.ok(hand.getWorldPosition(new THREE.Vector3()).distanceTo(before)>.005);assert.ok(string.some(({mesh,index,point})=>sample(mesh,index).distanceTo(point)>.005));
    assert.deepEqual(Array.from(geometry.attributes.position.array),vertices);resetDefenderAnimation(rig.native,{reducedMotion:true});assert.ok(hand.getWorldPosition(new THREE.Vector3()).distanceTo(before)<1e-5);
  }finally{disposeAttack(rig);disposeDefenderInstance(actor);}
});

test('Soldier actual blade vertices follow the arm/wrist while the pedestal stays planted',async()=>{
  const actor=cloneDefenderTemplate(await model(entry('soldier'))),rig=attackRig(actor,'soldier',towers.soldier);
  try{
    const weapon=skins(actor)[0].skeleton.bones.findIndex(b=>b.name==='weapon');assert.ok(weapon>=0);const blade=[];
    for(const mesh of skins(actor))for(let v=0;v<mesh.geometry.attributes.position.count;v++){
      const weights=mesh.geometry.attributes.skinWeight,indices=mesh.geometry.attributes.skinIndex;
      if([0,1,2,3].some(i=>indices.getComponent(v,i)===weapon&&weights.getComponent(v,i)>.5))blade.push({mesh,index:v,point:sample(mesh,v)});
    }
    assert.ok(blade.length>30);const root=actor.position.toArray();previewDefenderAttack(rig.native);updateDefenderPreview(rig.native,.36);actor.updateMatrixWorld(true);
    assert.ok(blade.some(({mesh,index,point})=>sample(mesh,index).distanceTo(point)>.03));assert.deepEqual(actor.position.toArray(),root);assert.ok(Math.abs(actor.rotation.x)<1e-12);
  }finally{disposeAttack(rig);disposeDefenderInstance(actor);}
});

test('Mage charges its authored moving focus and releases from its actual muzzle without mutating combat data',async()=>{
  const source=await model(entry('mage')),actor=cloneDefenderTemplate(source),rig=attackRig(actor,'mage',towers.mage);
  try{
    actor.position.set(5,.85,8);actor.rotation.y=.6;actor.scale.setScalar(.7);const before=attackMuzzle(rig).clone();assert.ok(rig.glow);
    triggerAttack(rig);animateAttack(rig,.01);assert.ok(rig.glow.visible);const muzzle=attackMuzzle(rig);assert.ok(muzzle.distanceTo(before)>.01);
    const materials=meshes(source).map(m=>m.material);assert.ok(rig.glow.children.every(m=>!materials.includes(m.material)));
    const scene=new THREE.Scene(),fx=new CombatEffects(scene,{getMuzzle:(_,out)=>attackMuzzle(rig,out)}),shot={id:1,source:{family:'mage',x:1,z:1},target:{x:12,z:12},stats:towers.mage,progress:0},original=structuredClone(shot);
    fx.shot(shot);assert.ok(fx.projectiles.get(1).object.position.distanceTo(muzzle)<1e-5);assert.ok(scene.getObjectByName('Staff-tip released magic wave'));assert.deepEqual(shot,original);fx.dispose();
  }finally{disposeAttack(rig);disposeDefenderInstance(actor);}
});

test('reduced motion keeps native bones at rest and actor-owned charge resources dispose exactly once',async()=>{
  for(const family of ['archer','mage']){
    const actor=cloneDefenderTemplate(await model(entry(family))),rig=attackRig(actor,family,towers[family]),rest=pose(actor),disposed=[];
    for(const object of rig.owned)object.traverse(node=>{for(const resource of [node.geometry,node.material])if(resource){const item={count:0};resource.addEventListener('dispose',()=>item.count++);disposed.push(item);}});
    triggerAttack(rig,{reducedMotion:true});animateAttack(rig,.12,0,{reducedMotion:true});assert.deepEqual(pose(actor),rest);
    disposeAttack(rig);disposeAttack(rig);assert.ok(disposed.every(item=>item.count===1));assert.equal(attackMuzzle(rig),null);assert.equal(rig.owned.length,0);disposeDefenderInstance(actor);
  }
});

test('Lady Claire native orbs remain independent of her weighted body and peer skeleton',async()=>{
  const source=await model(entry('ladyclaire')),actor=cloneDefenderTemplate(source),peer=cloneDefenderTemplate(source),orbs=[0,1,2].map(i=>actor.getObjectByName('secret_orb_'+i));
  assert.ok(orbs.every((orb,i)=>orb&&orb.userData.secretOrbIndex===i&&meshes(orb).length===2));
  const before=orbs.map(orb=>meshes(orb).map(mesh=>sample(mesh))),head=actor.getObjectByName('head'),facePosition=head.getWorldPosition(new THREE.Vector3());
  orbs[0].position.x+=.2;actor.updateMatrixWorld(true);assert.ok(meshes(orbs[0]).some((mesh,i)=>sample(mesh).distanceTo(before[0][i])>.19));
  for(const i of [1,2])meshes(orbs[i]).forEach((mesh,j)=>assert.deepEqual(sample(mesh).toArray(),before[i][j].toArray()));
  assert.ok(head.getWorldPosition(new THREE.Vector3()).equals(facePosition));assert.notEqual(head,peer.getObjectByName('head'));disposeDefenderInstance(actor);disposeDefenderInstance(peer);
});

after(async()=>{const resources=new Set();for(const source of await Promise.all(cached.values()))source.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const material of Array.isArray(o.material)?o.material:[o.material])if(material)resources.add(material);});for(const resource of resources)resource.dispose();});
