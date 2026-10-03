import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
import {measureGeometricContacts,measureHeadCoverCoverage} from '../game/render/geometric-contacts.js';
import {auditGeometricContacts} from '../tools/audit-geometric-contacts.mjs';

for(const id of ['druid-3','mage-4'])test(id+' actual previously failing posed/scaled head rays remain valid',async()=>{
  const r=await auditGeometricContacts('public/assets/geometric/defenders/'+id+'.glb');assert.deepEqual(r.failures,[],id+': real poses keep cap seated');assert.deepEqual(r.coverageFailures,[],id+': real poses cannot open a rigid closed hood ridge');
});

test('actual head-local cap and hood triangle rays remain invariant across world rotations, .704 scale and 1e-7 metre translations',async()=>{
  for(const id of ['druid-3','mage-4']){
    const bytes=readFileSync('public/assets/geometric/defenders/'+id+'.glb'),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),actor=cloneDefenderTemplate(gltf.scene);
    const read=()=>{const coverage=measureHeadCoverCoverage(actor),contacts=measureGeometricContacts(actor),cap=contacts.interfaces.find(c=>c.kind==='cap-crown-seat');assert.deepEqual(coverage.failures,[],id+' protected actual hood surfaces');assert.deepEqual(contacts.failures,[],id+' actual contacts');return {coverage:coverage.results.flatMap(r=>r.rays.map(ray=>[ray.skinDistanceLocalM,ray.coverDistanceLocalM])),cap:cap?.samples.map(s=>[...s.originHeadLocal,s.gapLocalM])||[]};};
    const baseline=read();
    for(const scale of [1,.704])for(const displacement of [0,1e-7,-1e-7]){
      actor.scale.setScalar(scale);actor.position.set(displacement,displacement,-displacement);actor.rotation.set(.17,.39,-.23);actor.getObjectByName('head_pivot').rotation.set(.11,-.21,.08);
      const measured=read();for(const group of ['coverage','cap']){assert.equal(measured[group].length,baseline[group].length,id+' same finite ray set');for(let i=0;i<baseline[group].length;i++)for(let j=0;j<baseline[group][i].length;j++)assert.ok(Math.abs(measured[group][i][j]-baseline[group][i][j])<1e-9,id+' invariant '+group+' ray '+i+' coordinate '+j);}
    }
    disposeDefenderInstance(actor);disposeDecodedGeometricAsset(gltf);
  }
});

test('tiny triangle seam robustness cannot cover a real missing hood roof or a face moved beyond the opaque cover',()=>{
  const actor=new THREE.Group(),head=new THREE.Group();head.name='head_pivot';actor.add(head);
  const face=new THREE.Mesh(new THREE.BoxGeometry(.4,.5,.32),new THREE.MeshStandardMaterial());face.name='Observed_face';head.add(face);
  const cover=new THREE.Mesh(new THREE.BoxGeometry(.5,.6,.4),new THREE.MeshStandardMaterial());cover.name='Closed_hood';head.add(cover);
  assert.equal(measureHeadCoverCoverage(actor).failures.length,0);
  const roofless=cover.geometry.toNonIndexed(),p=roofless.attributes.position,kept=[];for(let i=0;i<p.count;i+=3){const ys=[0,1,2].map(k=>p.getY(i+k));if(ys.every(y=>y>.299))continue;for(let k=0;k<3;k++)kept.push(p.getX(i+k),p.getY(i+k),p.getZ(i+k));}cover.geometry.dispose();roofless.dispose();cover.geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(kept,3));
  assert.ok(measureHeadCoverCoverage(actor).failures.length,'actual missing upward hood triangles stay detectable');
  cover.geometry.dispose();cover.geometry=new THREE.BoxGeometry(.5,.6,.4);face.position.x=.1;actor.rotation.set(.2,.3,.4);actor.scale.setScalar(.704);
  assert.ok(measureHeadCoverCoverage(actor).failures.length,'an actual displaced skin surface still fails');actor.traverse(n=>{n.geometry?.dispose();n.material?.dispose();});
});
