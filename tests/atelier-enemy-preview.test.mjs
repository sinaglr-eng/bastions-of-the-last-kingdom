import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {createAtelierEnemyPreview,updateAtelierEnemyPreview,disposeAtelierEnemyPreview} from '../game/render/atelier-enemy-preview.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
const transforms=root=>{root.updateWorldMatrix(true,true);const result=[];root.traverse(n=>{if(n.isMesh)result.push([n.name,...n.matrixWorld.elements]);});return result;};
const definitions=JSON.parse(readFileSync(new URL('../data/enemies.json',import.meta.url)));
for(const [id,flying] of [['host_13',false],['host_15',true]])test(`actual Atelier ${id} uses live ${flying?'flight':'gait'}, paused frame and exact authored rest without changing private peers or source resources`,async()=>{
  const bytes=readFileSync('public/assets/geometric/enemies/'+id+'.glb'),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),scene=new THREE.Scene(),definition={...definitions[id],type:id,visualAsset:id,wave:Number(id.slice(5)),statuses:{}},resources=new Set();
  assert.equal(definition.flying,flying,'the preview uses the actual campaign locomotion');
  gltf.scene.traverse(n=>{if(n.geometry)resources.add(n.geometry);for(const material of Array.isArray(n.material)?n.material:[n.material])if(material)resources.add(material);});
  let nativeDisposals=0;for(const resource of resources)resource.addEventListener('dispose',()=>nativeDisposals++);
  const original=transforms(gltf.scene),a=createAtelierEnemyPreview(scene,definition,gltf.scene),b=createAtelierEnemyPreview(scene,definition,gltf.scene),peer=transforms(b.figure);
  const aura=a.figure.userData.aura;
  if(id==='host_13')assert.equal(aura,null,'ordinary armor cannot create an Atelier aura');
  else{assert.equal(definition.regen,3.9,'the real Blood Bat regeneration is exercised');assert.ok(aura,'the actual special ability retains its wave aura');assert.equal(aura.visible,true);}
  updateAtelierEnemyPreview(a,0);const rest=transforms(a.figure.userData.body);a.moving=true;updateAtelierEnemyPreview(a,.1);updateAtelierEnemyPreview(a,.2);const animated=transforms(a.figure.userData.body);
  assert.notDeepEqual(animated,rest,'the actual imported meshes move');assert.ok(a.figure.userData.geometricMotion,'canonical live motion rig is used');const paused=transforms(a.figure),time=a.time,traveled=a.enemy.traveled;
  updateAtelierEnemyPreview(a,0);assert.deepEqual(transforms(a.figure),paused);assert.equal(a.time,time);assert.equal(a.enemy.traveled,traveled);
  if(aura){assert.equal(aura.visible,true);assert.equal(aura.userData.uniforms.time.value,time,'a paused preview preserves the actual aura clock');assert.equal(a.effects.batches.get('regen').glyph.count,1,'the real regeneration keeps its symbol');}
  else{assert.equal(a.figure.userData.aura,null);assert.equal(a.effects.batches.size,0,'ordinary enemies allocate no rings or shields');}
  a.moving=false;updateAtelierEnemyPreview(a,.1,{showEffects:false});assert.deepEqual(transforms(a.figure.userData.body),rest,'rest mode returns the actual authored articulated pose');
  if(aura)assert.equal(aura.visible,false,'effects toggle hides a genuine special aura');
  else assert.equal(a.figure.userData.aura,null,'hiding effects does not invent a missing aura');
  assert.equal(a.effects.group.visible,false);
  updateAtelierEnemyPreview(a,.1,{reducedMotion:true});assert.equal(a.effects.still(),true,'defense geometry obeys the same reduced-motion preference');
  if(aura){assert.equal(aura.visible,true,'effects toggle restores a genuine special aura');assert.equal(aura.userData.uniforms.time.value,0,'reduced motion freezes the aura shader');}
  else{assert.equal(a.figure.userData.aura,null);assert.equal(a.effects.batches.size,0);}
  assert.deepEqual(transforms(gltf.scene),original);assert.deepEqual(transforms(b.figure),peer);
  disposeAtelierEnemyPreview(a);disposeAtelierEnemyPreview(a);updateAtelierEnemyPreview(a,100);disposeAtelierEnemyPreview(b);assert.equal(scene.children.length,0);assert.equal(nativeDisposals,0,'closing Atelier releases private cues, auras and effects while cached geometry/materials remain owned by the template');disposeDecodedGeometricAsset(gltf);
});
