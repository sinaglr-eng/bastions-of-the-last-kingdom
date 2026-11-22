import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from '../tests/helpers/native-gltf.mjs';
import {loadCurrentDatasets} from './current-datasets.mjs';
import {towerStats} from '../game/core/math.js';
import {installDefenderTemplate,cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {attackRig,attackMuzzle,triggerAttack,animateAttack,disposeAttack} from '../game/render/battle-animation.js';
const registry=JSON.parse(fs.readFileSync('data/factions-v060.json')),datasets=loadCurrentDatasets(),rows=[];
for(const f of registry.factions)for(const a of f.assets){
 const bytes=gunzipSync(fs.readFileSync('public/'+a.packedFile));assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256);
 const g=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 installDefenderTemplate({imported:new Map(),game:{towers:[]}},a,g.scene,g.animations);
 const actor=cloneDefenderTemplate(g.scene),stats=towerStats({family:a.family,tier:a.tier},datasets[f.id]);
 const rig=attackRig(actor,a.family,stats),poses=[];assert.ok(actor.userData.factionVfxAnchor);
 const target={x:19,z:21},source={id:1,family:a.family,tier:a.tier};
 if(stats.weaponCycle)source.weaponCycleState={phase:.42};
 const context={combat:true,target,tower:source,rate:1,interval:stats.interval,cooldown:.01,stamp:1};
 function record(){
  const point=attackMuzzle(rig);assert.ok(point?.toArray().every(Number.isFinite));
  poses.push({stage:rig.stage,phase:rig.faction.state.phase,point:point.toArray()});
 }
 const discrete=rig.faction.state.mode==='discrete';
 animateAttack(rig,.02,1,context);record();
 if(discrete&&!stats.weaponCycle)assert.equal(rig.stage,'preparation',a.family+' actual cooldown winds up');
 triggerAttack(rig,{id:1,volleyStamp:1,releaseCount:1,source,target,stats,combatTime:1,breath:!discrete});record();
 const primaryYaw=actor.quaternion.clone(),release=rig.faction.state.phase;
 if(discrete){
  triggerAttack(rig,{id:2,volleyStamp:1,source,target:{x:12,z:12},stats,firstPrimary:false,combatTime:1});
  assert.ok(actor.quaternion.equals(primaryYaw));assert.equal(rig.faction.state.phase,release);
 }
 animateAttack(rig,0,1,context);assert.equal(rig.faction.state.phase,release);
 animateAttack(rig,.12,1.12,{...context,stamp:1.12});record();
 animateAttack(rig,.02,1.14,{...context,stamp:1.14,blocked:true});
 assert.equal(rig.stage,'idle',a.family+' interrupted cleanly');
 const anchor=actor.userData.factionVfxAnchor;
 if(anchor.weapon==='paired-flame-nozzles'){assert.equal(anchor.lanes.length,2);assert.ok(new THREE.Vector3().fromArray(anchor.lanes[0]).distanceTo(new THREE.Vector3().fromArray(anchor.lanes[1]))>.03);}
 rows.push({factionId:f.id,family:a.family,tier:a.tier,decodedModelSha256:a.sha256,anchor,poses});
 disposeAttack(rig);disposeDefenderInstance(actor);
 const geometries=new Set(),materials=new Set();g.scene.traverse(n=>{if(n.geometry)geometries.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])if(m)materials.add(m);});for(const x of geometries)x.dispose();for(const x of materials)x.dispose();
 if(rows.length%24===0){console.log('Verified '+rows.length+' actual native profiles');global.gc?.();}
}
assert.equal(rows.length,258);
fs.mkdirSync('output/implementation/native-render-current',{recursive:true});fs.writeFileSync('output/implementation/native-render-current/verification.json',JSON.stringify({status:'passed',actualNativeProfiles:258,method:'Exact packed GLBs with verified hashes. Live battle adapter sampled at preparation, release and recovery using current game data. Verified pause, interruption, primary volley facing and weapon-specific emitter coordinates.',rows},null,2)+'\n');
console.log('Verified all 258 actual native profiles.');
