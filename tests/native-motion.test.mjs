import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {createSecretAnimation,updateSecretAnimation,disposeSecretAnimation} from '../game/render/secret-animation.js';
import {animateEnemyMotion} from '../game/render/enemy-motion.js';
import {enemyFigure,disposeEnemyFigure} from '../game/render/enemy-assets.js';
import {animateSecretChampion} from '../game/render/secret-champions.js';
import {createChampionAura,disposeChampionAura} from '../game/render/champion-aura.js';

const sources=new Map();
async function load(path){
  if(!sources.has(path))sources.set(path,(async()=>{const bytes=readFileSync(new URL('../public/assets/'+path,import.meta.url));const gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');gltf.scene.animations=gltf.animations;return gltf.scene;})());
  return sources.get(path);
}
const rotations=root=>{const values=[];root.traverse(node=>values.push([node.name,...node.rotation.toArray()]));return values;};

test('native bat, wolf rider and queen-wyvern motion changes private limbs and preserves cached rest geometry',async()=>{
  for(const [id,flying,model]of [['host_05',true,'bat'],['host_19',false,'wolf'],['host_40',true,'dragon'],['host_50',true,'dragon']]){
    const source=await load('enemies/'+id+'.glb'),original=rotations(source),originalScale=source.scale.clone();
    const enemy={id:2,type:id,visualAsset:id,flying,model,speed:1},figure=enemyFigure(enemy,new Map([[id,source]]));
    const moving=[...figure.userData.limbs,...figure.userData.wings],before=moving.map(node=>node.rotation.clone());
    assert.ok(moving.length>0,id);animateEnemyMotion(figure,enemy,1);
    assert.ok(moving.some((node,index)=>node.rotation.toArray().some((value,axis)=>typeof value==='number'&&Math.abs(value-before[index].toArray()[axis])>.001)),id);
    assert.deepEqual(rotations(source),original,id+' cached model mutated');assert.ok(source.scale.equals(originalScale));
    animateEnemyMotion(figure,enemy,2,{reducedMotion:true});
    if(figure.userData.nativeFlight){const settled=rotations(figure);animateEnemyMotion(figure,enemy,200,{reducedMotion:true});assert.deepEqual(rotations(figure),settled,id+' native reduced-motion clip must settle without drift');}
    else for(const node of moving)assert.ok(Math.abs((node.name.startsWith('wing_')?node.rotation.z:node.rotation.x)-node.userData.restRotation)<1e-12,id+' reduced-motion rest');
    assert.ok(figure.userData.body.scale.equals(originalScale));disposeEnemyFigure(figure);
  }
});

test('native Lady Claire orbs keep their Y-up heights and restore exact authored poses with reduced motion',async()=>{
  const source=await load('models/advanced_ladyclaire.glb'),actor=cloneDefenderTemplate(source),peer=cloneDefenderTemplate(source);
  const orbs=[0,1,2].map(i=>actor.getObjectByName('secret_orb_'+i));
  const rest=orbs.map(node=>({position:node.position.clone(),rotation:node.rotation.clone(),scale:node.scale.clone()}));
  actor.position.set(7,.85,3);actor.rotation.y=.8;actor.scale.setScalar(.7);
  animateSecretChampion(actor,0,{reducedMotion:true});
  orbs.forEach((node,index)=>assert.ok(node.position.equals(rest[index].position),'Reduced motion moved an authored orb'));
  animateSecretChampion(actor,.1);animateSecretChampion(actor,.3,{melancholy:true});
  assert.ok(orbs.some((node,index)=>node.position.distanceTo(rest[index].position)>.05));
  orbs.forEach((node,index)=>assert.ok(Math.abs(node.position.y-rest[index].position.y)<=.04501,'An imported orb lost its upper-body Y-up height'));
  animateSecretChampion(actor,.6,{reducedMotion:true});
  orbs.forEach((node,index)=>{assert.ok(node.position.equals(rest[index].position));assert.deepEqual(node.rotation.toArray(),rest[index].rotation.toArray());assert.ok(node.scale.equals(rest[index].scale));assert.ok(peer.getObjectByName(node.name).position.equals(rest[index].position));assert.ok(source.getObjectByName(node.name).position.equals(rest[index].position));});
  assert.deepEqual(actor.position.toArray(),[7,.85,3]);assert.equal(actor.rotation.y,.8);assert.deepEqual(actor.scale.toArray(),[.7,.7,.7]);
});

test('native Bernhard idle moves the horse neck through skin bones and freezes exactly when simulation pauses',async()=>{
  const source=await load('models/advanced_lordbernhard.glb'),actor=cloneDefenderTemplate(source),rig=createSecretAnimation(actor,'lordbernhard');
  assert.ok(rig);const neck=actor.getObjectByName('horse_neck'),original=source.getObjectByName('horse_neck').quaternion.toArray(),before=neck.quaternion.clone();
  updateSecretAnimation(rig,.2);assert.ok(neck.quaternion.angleTo(before)>.001);
  const pose=rotations(actor);updateSecretAnimation(rig,0);assert.deepEqual(rotations(actor),pose);
  animateSecretChampion(actor,.4);assert.deepEqual(rotations(actor),pose,'Cosmetic motion overwrote native skeletal animation');
  assert.deepEqual(source.getObjectByName('horse_neck').quaternion.toArray(),original);
  disposeSecretAnimation(rig);disposeDefenderInstance(actor);
});

test('both native secret families receive the private gold Secret aura',()=>{
  const auras=['ladyclaire','lordbernhard'].map(family=>createChampionAura(family));
  for(const aura of auras){assert.equal(aura.userData.classification,'Secret');assert.equal(aura.userData.level,4);assert.equal(aura.userData.color,'#ffd969');assert.equal(aura.userData.rings.length,4);}
  assert.notEqual(auras[0].userData.ground.material,auras[1].userData.ground.material);
  auras.forEach(disposeChampionAura);
});

after(async()=>{
  const resources=new Set();for(const source of await Promise.all(sources.values()))source.traverse(node=>{if(node.geometry)resources.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])if(material)resources.add(material);});for(const resource of resources)resource.dispose();
});
