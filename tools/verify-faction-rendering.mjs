import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from '../tests/helpers/native-gltf.mjs';
import {loadDatasets} from './fr001-validation/datasets.mjs';
import {towerStats} from '../game/core/math.js';
import {installDefenderTemplate,cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {attackRig,attackMuzzle,disposeAttack} from '../game/render/battle-animation.js';
const registry=JSON.parse(fs.readFileSync('data/factions-v060.json')),datasets=loadDatasets({patchFiles:[]}),rows=[];
for(const f of registry.factions)for(const a of f.assets){
 const bytes=gunzipSync(fs.readFileSync('public/'+a.packedFile));assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256);
 const g=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 installDefenderTemplate({imported:new Map(),game:{towers:[]}},a,g.scene,g.animations);
 const actor=cloneDefenderTemplate(g.scene),stats=towerStats({family:a.family,tier:a.tier},datasets[f.id]);
 const rig=attackRig(actor,a.family,stats),poses=[];assert.ok(actor.userData.factionVfxAnchor);
 if(rig.faction.state.mode==='discrete')rig.faction.playAttack();else rig.faction.setChannel(true);
 for(const dt of [0,.1,.2]){rig.faction.update(dt);actor.updateMatrixWorld(true);const point=attackMuzzle(rig);assert.ok(point?.toArray().every(Number.isFinite));poses.push(point.toArray());}
 const anchor=actor.userData.factionVfxAnchor;
 if(anchor.weapon==='paired-flame-nozzles'){assert.equal(anchor.lanes.length,2);assert.ok(new THREE.Vector3().fromArray(anchor.lanes[0]).distanceTo(new THREE.Vector3().fromArray(anchor.lanes[1]))>.03);}
 rows.push({factionId:f.id,family:a.family,tier:a.tier,decodedModelSha256:a.sha256,anchor,poses});
 disposeAttack(rig);disposeDefenderInstance(actor);
 const geometries=new Set(),materials=new Set();g.scene.traverse(n=>{if(n.geometry)geometries.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])if(m)materials.add(m);});for(const x of geometries)x.dispose();for(const x of materials)x.dispose();
 if(rows.length%24===0){console.log('Verified '+rows.length+' actual native profiles');global.gc?.();}
}
assert.equal(rows.length,258);
fs.writeFileSync('output/releases/v0.6.3/native-render-verification.json',JSON.stringify({status:'passed',actualNativeProfiles:258,method:'Exact approved packed GLBs; real imported skins, private actors, current runtime attack profiles, three actual animation samples and emitting surfaces. No model bytes or combat data altered.',rows},null,2)+'\n');
console.log('Verified all 258 actual native profiles.');
