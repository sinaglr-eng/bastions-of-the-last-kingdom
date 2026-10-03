import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {inspectAppearance,partMeshes,projectedConcavity} from '../tools/audit-geometric-appearance.mjs';

async function model(id,category='defenders'){const bytes=readFileSync(new URL('../public/assets/geometric/'+category+'/'+id+'.glb',import.meta.url));return (await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;}
test('appearance audit detects the original 160mm whole-skull displacement in actual vertices',async()=>{
 const actor=await model('runebreaker-1');
 assert.equal(inspectAppearance(actor,{id:'runebreaker-1'}).failures.length,0);
 const face=partMeshes(actor,/^Observed face$/);assert.equal(face.length,1);
 face[0].geometry.translate(0,0,-.16);
 const result=inspectAppearance(actor,{id:'runebreaker-1'});
 assert.ok(result.failures.some(row=>row.name==='whole skull stays over actual torso axis'));
});
test('lightning audit rejects a convex diamond in place of the actual concave stroke',async()=>{
 const actor=await model('stormcaller-1');assert.equal(inspectAppearance(actor,{id:'stormcaller-1'}).failures.length,0);
 const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(.12,.28);shape.lineTo(0,.56);shape.lineTo(-.12,.28);shape.closePath();
 const diamond=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.046,bevelEnabled:false}),new THREE.MeshBasicMaterial());diamond.updateMatrixWorld(true);
 assert.ok(projectedConcavity([diamond]).areaFraction>.9999);
 for(const node of partMeshes(actor,/^Continuous flattened held lightning$/))node.removeFromParent();
 diamond.userData.semanticPart='Continuous flattened held lightning';actor.add(diamond);
 const result=inspectAppearance(actor,{id:'stormcaller-1'});
 assert.ok(result.failures.some(row=>row.name==='held focus has one tall concave lightning silhouette'));
});
test('all six exported Stormcaller crowns have actual rank-specific geometry and low fitted hair',async()=>{
 const observed=[];
 for(let rank=1;rank<=6;rank++){
  const actor=await model('stormcaller-'+rank),result=inspectAppearance(actor,{id:'stormcaller-'+rank});assert.deepEqual(result.failures,[]);
  const bounds=new THREE.Box3();for(const mesh of partMeshes(actor,/^Crown lightning tooth \d+$/))bounds.union(new THREE.Box3().setFromObject(mesh,true));
  const metadata=(()=>{let value;actor.traverse(node=>{if(node.userData.geometricRig)value=node.userData;});return value;})();
  observed.push({rank,actualBounds:bounds.min.toArray().concat(bounds.max.toArray()),design:metadata.lightningCrownDesign});
 }
 assert.equal(new Set(observed.map(row=>JSON.stringify(row.actualBounds))).size,6);
});
test('names and metadata cannot certify missing physical lightning crown teeth',async()=>{
 const actor=await model('stormcaller-2');
 for(const mesh of partMeshes(actor,/^Crown lightning tooth \d+$/))mesh.geometry=new THREE.BufferGeometry();
 const result=inspectAppearance(actor,{id:'stormcaller-2'});
 assert.ok(result.failures.some(row=>row.name==='actual crown teeth distinguish the requested rank'));
});
test('low-hair check measures every actual lock instead of just the scalp cap',async()=>{
 const actor=await model('stormcaller-1'),locks=partMeshes(actor,/^Natural tapered rear hair lock/);
 assert.ok(locks.length>0);for(const mesh of locks)mesh.geometry.translate(0,.8,0);
 assert.ok(inspectAppearance(actor,{id:'stormcaller-1'}).failures.some(row=>row.name==='all actual hair locks stay low around the skull'));
});
test('source proportions reject a materially undersized dragon head despite intact connected anatomy',async()=>{
 const actor=await model('embercrown','champions'),source=JSON.parse(readFileSync(new URL('../output/design/geometric-game-v3/source-creature-checkpoints.json',import.meta.url))),criteria=source.entries.find(row=>row.id==='embercrown').ratioChecks;
 assert.deepEqual(inspectAppearance(actor,{id:'embercrown',criteria}).failures,[]);
 for(const mesh of partMeshes(actor,criteria[0].numerator.parts))mesh.geometry.scale(.55,1,1);
 assert.ok(inspectAppearance(actor,{id:'embercrown',criteria}).failures.some(row=>row.name==='baby_head_width_over_wing_span'));
});
test('recoloring the real rider torso purple is detected even when the palette metadata is unchanged',async()=>{
 const actor=await model('thunderheart','champions');assert.deepEqual(inspectAppearance(actor,{id:'thunderheart'}).failures,[]);
 const mount=partMeshes(actor,/^Dragon sculpted faceted cranial volume source broad wedge$/)[0],torso=partMeshes(actor,/^Tailored continuous bodice$/)[0];assert.ok(torso&&mount);
 const mountMaterial=Array.isArray(mount.material)?mount.material[0]:mount.material;
 torso.material=mountMaterial.clone();
 assert.ok(inspectAppearance(actor,{id:'thunderheart'}).failures.some(row=>row.name==='whole rider armor contrasts with the actual purple dragon'));
});
test('spirit appearance requires the real integrated body and torso-owned glowing eyes',async()=>{
 const actor=await model('mothernature','champions');assert.deepEqual(inspectAppearance(actor,{id:'mothernature'}).failures,[]);
 const eyes=partMeshes(actor,/^Nature (?:integrated luminous almond eye|V5 flush recessed living almond light)$/);assert.equal(eyes.length,2);
 actor.getObjectByName('head_pivot').attach(eyes[0]);
 assert.ok(inspectAppearance(actor,{id:'mothernature'}).failures.some(row=>row.name==='spirit face belongs to the continuous torso rather than a separate head'));
 const missingBody=await model('mothernature','champions');for(const mesh of partMeshes(missingBody,/^Nature unified living wood leaf body with integrated face$/))mesh.geometry=new THREE.BufferGeometry();
 assert.ok(inspectAppearance(missingBody,{id:'mothernature'}).failures.some(row=>row.name==='spirit face belongs to the continuous torso rather than a separate head'));
});
