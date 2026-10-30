import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {installDefenderTemplate,cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {attackRig,triggerAttack,animateAttack,disposeAttack} from '../game/render/battle-animation.js';
const registry=JSON.parse(readFileSync(new URL('../data/factions-v060.json',import.meta.url))),samples=new Map();
for(const f of registry.factions)for(const a of f.assets){const key=f.id+':'+a.attack.bodyType+':'+a.attack.mode;if(!samples.has(key))samples.set(key,a);}
for(const [key,entry]of samples)test(`approved V3 live pipeline: ${key} uses private actual skins and authored clips`,async()=>{
 const b=gunzipSync(readFileSync(new URL('../public/'+entry.packedFile,import.meta.url))),gltf=await new NativeTestGLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const field={imported:new Map(),models:new Map(),game:{towers:[],data:{towers:{}}},sync(){}};assert.equal(installDefenderTemplate(field,entry,gltf.scene,gltf.animations),true);
 const bones=root=>{const values=[];root.traverse(n=>{if(n.isBone)values.push(...n.position.toArray(),...n.quaternion.toArray());});return values;};
 const original=bones(gltf.scene),actor=cloneDefenderTemplate(gltf.scene),peer=cloneDefenderTemplate(gltf.scene),rest=bones(peer);assert.deepEqual(bones(actor),rest);
 actor.position.set(4,1.1,5);actor.scale.setScalar(1.2);const rig=attackRig(actor,entry.family,{type:entry.attack.damageType});assert.ok(rig.faction);assert.equal(rig.approved,undefined);
 const state=rig.faction.state;const payload={id:1,volleyStamp:55,source:{weaponCycleState:entry.attack.weaponCycle?{phase:.45}:undefined},target:{x:18,z:20},stats:{interval:entry.attack.intervalSeconds,weaponCycle:entry.attack.weaponCycle},visualRate:1};
 if(state.mode==='discrete')triggerAttack(rig,payload);
 else rig.faction.setChannel(true);
 animateAttack(rig,.2,.2,{target:payload.target,tower:payload.source});assert.ok(bones(actor).every(Number.isFinite));assert.notDeepEqual(bones(actor),rest);assert.deepEqual(bones(peer),rest);assert.deepEqual(bones(gltf.scene),original);assert.deepEqual(actor.position.toArray(),[4,1.1,5]);assert.deepEqual(actor.scale.toArray(),[1.2,1.2,1.2]);
 const paused=bones(actor),phase=rig.faction.state.phase;animateAttack(rig,0,.5,{blocked:true});assert.deepEqual(bones(actor),paused);assert.equal(rig.faction.state.phase,phase);
 disposeAttack(rig);disposeDefenderInstance(actor);disposeDefenderInstance(peer);const geometries=new Set(),materials=new Set();gltf.scene.traverse(n=>{if(n.geometry)geometries.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:n.material?[n.material]:[])materials.add(m);});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
});
