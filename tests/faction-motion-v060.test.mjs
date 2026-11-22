import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {installDefenderTemplate,cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {attackRig,triggerAttack,animateAttack,attackMuzzle,disposeAttack} from '../game/render/battle-animation.js';
const registry=JSON.parse(readFileSync(new URL('../data/factions-v060.json',import.meta.url))),samples=new Map();
async function nativeRig(family){
 const entry=registry.factions.flatMap(f=>f.assets).find(a=>a.family===family&&a.tier===1);
 const b=gunzipSync(readFileSync(new URL('../public/'+entry.packedFile,import.meta.url)));
 const g=await new NativeTestGLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 installDefenderTemplate({imported:new Map(),game:{towers:[]}},entry,g.scene,g.animations);
 const actor=cloneDefenderTemplate(g.scene);
 return {actor,rig:attackRig(actor,family,{type:entry.attack.damageType}),entry};
}
test('native windup, actual primary release, recovery and guard follow the live cooldown under haste',async()=>{
 const {actor,rig}=await nativeRig('soldier'),source={family:'soldier',id:1};
 const target={x:18,z:23},other={x:10,z:18},stats={interval:3};
 const context={combat:true,tower:source,target,interval:3,rate:2,stamp:1,cooldown:.15};
 animateAttack(rig,.01,1,context);assert.equal(rig.stage,'preparation');assert.ok(rig.faction.state.phase>0);
 animateAttack(rig,.01,1.01,{...context,target:null});assert.equal(rig.stage,'idle');
 triggerAttack(rig,{source,target,stats,id:4,volleyStamp:4,combatTime:2,visualRate:2});
 const phase=rig.faction.state.phase,yaw=actor.quaternion.clone(),point=attackMuzzle(rig);
 triggerAttack(rig,{source,target:other,stats,id:5,volleyStamp:4,combatTime:2,firstPrimary:false});
 triggerAttack(rig,{source,target:other,stats,id:6,breath:true,combatTime:2});
 assert.ok(actor.quaternion.equals(yaw));assert.deepEqual(attackMuzzle(rig),point);
 animateAttack(rig,.016,2,{...context,stamp:2});assert.equal(rig.faction.state.phase,phase);
 animateAttack(rig,.016,2.016,{...context,stamp:2.016,cooldown:2.9});assert.ok(rig.faction.state.phase>phase);
 animateAttack(rig,1,3,{...context,stamp:3,cooldown:1});assert.equal(rig.stage,'idle');
 disposeAttack(rig);disposeDefenderInstance(actor);
});
test('authored drums emit from their membrane, airship from its bomb, fist from its knuckles, paired blades from their respective hands',async()=>{
 for(const family of ['dw_warcaller','dw_dwarship','dw_deepdelve','el_drow_eclipse_duelist']){
  const {actor,rig}=await nativeRig(family),source={family,id:1},target={x:18,z:20},stats={interval:1};
  if(rig.runtimeAttack.weaponCycle)source.weaponCycleState={phase:.38};
  const paired=family==='dw_warcaller'||family==='el_drow_eclipse_duelist';
  if(family!=='el_drow_eclipse_duelist')assert.equal(actor.userData.factionVfxAnchor.method,'Native named equipment surface');
  triggerAttack(rig,{source,target,stats,id:1,volleyStamp:1,releaseCount:1});
  const first=attackMuzzle(rig);
  triggerAttack(rig,{source,target,stats,id:2,volleyStamp:2,releaseCount:2});
  const delta=attackMuzzle(rig).distanceTo(first);
  if(paired)assert.ok(delta>.05,'second volley uses its native contact on the other side');
  else assert.ok(delta<1e-8);
  disposeAttack(rig);disposeDefenderInstance(actor);
 }
});
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
for(const family of ['stormcaller','tempest'])test(`V3 ${family}: lightning follows the moving palm or the actual staff head`,async()=>{
 const entry=registry.factions.find(f=>f.id==='crown').assets.find(a=>a.family===family&&a.tier===1),b=gunzipSync(readFileSync(new URL('../public/'+entry.packedFile,import.meta.url))),gltf=await new NativeTestGLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const field={imported:new Map(),models:new Map(),game:{towers:[],data:{towers:{}}},sync(){}};installDefenderTemplate(field,entry,gltf.scene,gltf.animations);const actor=cloneDefenderTemplate(gltf.scene),rig=attackRig(actor,family,{type:'magical'}),hand=actor.getObjectByName(THREE.PropertyBinding.sanitizeNodeName('cast.right.hand'));assert.ok(hand);actor.position.set(4,1.1,5);actor.scale.setScalar(1.2);
 triggerAttack(rig,{id:99,source:{},target:{x:20,z:18},stats:{interval:1}});animateAttack(rig,.2,.2,{target:{x:20,z:18},tower:{}});actor.updateWorldMatrix(true,true);
 const actual=attackMuzzle(rig,new THREE.Vector3(),{kind:'hand'}),expected=hand.getWorldPosition(new THREE.Vector3());
 if(family==='stormcaller')assert.ok(actual.distanceTo(expected)<1e-9);
 else{
   assert.match(actor.userData.factionVfxAnchor.bone,/prop/);
   assert.ok(actual.distanceTo(expected)>.15,'the emitter reaches the head of the staff');
 }
 assert.ok(actual.distanceTo(actor.getWorldPosition(new THREE.Vector3()))>.1);disposeAttack(rig);disposeDefenderInstance(actor);
});
