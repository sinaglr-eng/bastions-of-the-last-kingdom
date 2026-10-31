import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {installDefenderTemplate,cloneDefenderTemplate} from '../game/render/defender-assets.js';
import {applyDefenderClassificationScale} from '../game/render/defender-classification-scale.js';
import {scaleBattlefieldUnit} from '../game/render/battlefield-scale.js';
import {attachChampionAura,disposeChampionAura} from '../game/render/champion-aura.js';
const registry=JSON.parse(fs.readFileSync(new URL('../data/factions-v060.json',import.meta.url)));
const height=a=>{a.updateMatrixWorld(true);return new THREE.Box3().setFromObject(a,true).getSize(new THREE.Vector3()).y;};
async function native(family){
 const entry=registry.factions.find(f=>f.id==='grove').assets.find(a=>a.family===family),file=new URL('../public/'+entry.packedFile,import.meta.url),original=fs.readFileSync(file),hash=createHash('sha256').update(original).digest('hex'),bytes=gunzipSync(original),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 installDefenderTemplate({imported:new Map(),game:{towers:[]}},entry,gltf.scene,gltf.animations);
 return {actor:cloneDefenderTemplate(gltf.scene),source:gltf.scene,unchanged:()=>assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash)};
}
test('Baby Fire Dragon matches the native Fire Dragon height on the battlefield without altering their source models',async()=>{
 const baby=await native('el_baby_fire_dragon'),fire=await native('el_fire_dragon'),baseBaby=height(baby.actor),baseSource=height(baby.source);
 applyDefenderClassificationScale(baby.actor,'el_baby_fire_dragon');applyDefenderClassificationScale(fire.actor,'el_fire_dragon');scaleBattlefieldUnit(baby.actor);scaleBattlefieldUnit(fire.actor);
 assert.ok(Math.abs(height(baby.actor)/height(fire.actor)-1)<.002);
 assert.equal(baby.actor.userData.defenderPresentationScale,3.85);assert.ok(height(baby.actor)>baseBaby*2.5);
 assert.equal(height(baby.source),baseSource);const scale=baby.actor.scale.clone();applyDefenderClassificationScale(baby.actor,'el_baby_fire_dragon');assert.deepEqual(baby.actor.scale,scale);
 const aura=attachChampionAura(baby.actor,'el_baby_fire_dragon');assert.equal(aura.userData.classification,'Basic');assert.equal(aura.userData.color,'#247cff');assert.equal(aura.scale.x,1/3.85);disposeChampionAura(aura);
 baby.unchanged();fire.unchanged();
});
test('larger Elf dragon descendants retain their current model and classification proportions',async()=>{
 for(const family of ['el_fire_dragon','el_mother_fire_dragon','el_ancient_patriarch']){const n=await native(family),before=height(n.actor);applyDefenderClassificationScale(n.actor,family);assert.equal(n.actor.userData.defenderPresentationScale,1);assert.ok(Math.abs(height(n.actor)/before-n.actor.userData.classificationScale)<1e-7);n.unchanged();}
});
