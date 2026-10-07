import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {physicalSurfaceGap,measureGeometricContacts,measureHeadCoverCoverage} from '../game/render/geometric-contacts.js';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
import {attackRig,previewGeometricAttack,updateGeometricPreview,disposeAttack} from '../game/render/battle-animation.js';
import {scaleBattlefieldUnit,BATTLEFIELD_UNIT_SCALE} from '../game/render/battlefield-scale.js';
import {auditGeometricContacts} from '../tools/audit-geometric-contacts.mjs';
import {prepareReconstructedDefender} from '../game/render/reconstruction-adapter.js';
import {currentReconstructionEntry,auditCurrentReconstructionIds} from '../tools/audit-reconstructed-roster.mjs';

const mesh=(name,size,position,parent)=>{const node=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial());node.name=name;node.position.set(...position);parent.add(node);return node;};
const joint=(name,position,parent)=>{const node=new THREE.Group();node.name=name;node.position.set(...position);parent.add(node);return node;};
const belongs=(node,parent)=>{for(let current=node;current;current=current.parent)if(current===parent)return true;return false;};
const actualMeshes=(root,select=()=>true)=>{const result=[];root.traverse(node=>{if(node.isMesh&&select(node))result.push(node);});return result;};
const label=node=>node.userData.semanticPart||node.name;
const localFrames=root=>{const rows=[];root.traverse(node=>rows.push([node.name,...node.position.toArray(),...node.quaternion.toArray(),...node.scale.toArray(),...node.matrix.elements]));return JSON.stringify(rows);};

async function approvedSourceInterfaces(id,entry){
  const bytes=readFileSync('public/assets/geometric/'+entry.file),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  let actor,peer,rig;
  try{
    prepareReconstructedDefender(gltf.scene,entry);actor=cloneDefenderTemplate(gltf.scene);peer=cloneDefenderTemplate(gltf.scene);
    const sourceFrames=localFrames(gltf.scene),peerFrames=localFrames(peer),foot=actor.getObjectByName('foot_L'),leg=actor.getObjectByName('upper_leg_L'),head=actor.getObjectByName('head_pivot');
    assert.ok(foot&&leg&&head,id+' explicit prepared source joints');
    const boots=actualMeshes(foot),legParts=actualMeshes(leg,node=>!belongs(node,foot)),heads=actualMeshes(head,node=>/^(?:Head|Face)\b/i.test(label(node))&&node.userData.category!=='Eyes'),covers=actualMeshes(head,node=>/^(?:Hat|Hood|Cap|Helmet)\b/i.test(label(node)));
    assert.ok(boots.length&&legParts.length&&heads.length&&covers.length,id+' source triangle selectors are nonempty');
    const read=()=>{
      actor.updateWorldMatrix(true,true);const scale=actor.getWorldScale(new THREE.Vector3()).y;
      const bootGap=physicalSurfaceGap(boots,legParts),coverGap=physicalSurfaceGap(heads,covers);
      assert.notEqual(bootGap.missingSurface,true);assert.notEqual(coverGap.missingSurface,true);
      assert.ok(Number.isFinite(bootGap.gap)&&Number.isFinite(coverGap.gap));return {bootGap:bootGap.gap/scale,coverGap:coverGap.gap/scale};
    };
    rig=attackRig(actor,entry.family);const baseline=read();
    // Preserve the actual approved source gaps, including any source-specific
    // spacing. This verifies real triangles instead of importing a V4 tolerance
    // or claiming an absent V4 anatomical contact contract.
    for(const scaled of [false,true]){if(scaled)scaleBattlefieldUnit(actor);actor.rotation.set(.17,.39,-.23);actor.position.set(1e-7,-1e-7,1e-7);
      for(const stage of [0,.21,.42,.7,1]){previewGeometricAttack(rig,{duration:1});updateGeometricPreview(rig,stage);const actual=read();for(const key of ['bootGap','coverGap'])assert.ok(Math.abs(actual[key]-baseline[key])<1e-6,id+' real native '+key+' preserved at '+stage+' scale '+scaled);}
    }
    const position=foot.position.clone(),metadata=JSON.stringify(foot.userData);foot.position.y-=.5;
    assert.ok(read().bootGap>baseline.bootGap+.1,id+' detached real boot increases the actual triangle gap');
    assert.equal(JSON.stringify(foot.userData),metadata,'negative displacement keeps source declarations unchanged');foot.position.copy(position);assert.ok(Math.abs(read().bootGap-baseline.bootGap)<1e-6);
    assert.equal(localFrames(gltf.scene),sourceFrames,id+' source matrices stay untouched');assert.equal(localFrames(peer),peerFrames,id+' peer stays untouched');
  }finally{disposeAttack(rig);disposeDefenderInstance(actor);disposeDefenderInstance(peer);disposeDecodedGeometricAsset(gltf);}
}
for(const [folder,count] of [['defenders',48],['champions',38],['enemies',50]])test(`all ${count} actual ${folder} ${folder==='enemies'?'maintain physical head/neck/cap/shoe/knee surfaces and protected head coverage through live poses and battlefield scale':'preserve approved source surfaces through supported live attacks and battlefield scale'}`,async()=>{
  const directory='public/assets/geometric/'+folder,files=readdirSync(directory).filter(name=>name.endsWith('.glb')).sort();assert.equal(files.length,count);
  for(const file of files){
    if(folder!=='enemies'&&currentReconstructionEntry(file.replace(/\.glb$/,''))){
      const [result]=await auditCurrentReconstructionIds([file.replace(/\.glb$/,'')]);
      assert.deepEqual(result.failures,[],file+' every actual approved surface survives rest adaptation and supported runtime behavior');assert.ok(result.maximumPhysicalTravel>1e-5);assert.ok(result.checks.length>=50);continue;
    }
    const result=await auditGeometricContacts(directory+'/'+file);assert.equal(result.changedDuringRead,false,'inspect one immutable asset revision');assert.deepEqual(result.failures.map(f=>({pose:f.pose,kind:f.kind,side:f.side,gapNativeM:f.gapNativeM})),[],file+': actual physical joint/cap separation');assert.deepEqual(result.coverageFailures.map(f=>({pose:f.pose,head:f.head,failedRays:f.rays.filter(r=>!r.pass).length})),[],file+': protected face protrudes beyond its actual opaque cover');}
});
test('protected actual face surfaces remain inside opaque hood boundaries in posed/scaled coordinates; a protruding private face fails',()=>{
  const actor=new THREE.Group(),head=joint('head_pivot',[0,1,0],actor),face=mesh('Observed_face',[.4,.5,.32],[0,0,0],head);mesh('Closed_hood',[.5,.6,.4],[0,0,0],head);
  assert.equal(measureHeadCoverCoverage(actor).failures.length,0);face.position.x+=.1;assert.equal(measureHeadCoverCoverage(actor).failures.length,1,'face extending outside the real hood side must be detected');
  head.rotation.set(.3,.4,-.5);scaleBattlefieldUnit(actor);assert.equal(measureHeadCoverCoverage(actor).failures.length,1,'posing/scaling both layers cannot hide real protrusion');
  face.position.x-=.1;assert.equal(measureHeadCoverCoverage(actor).failures.length,0);actor.traverse(n=>{n.geometry?.dispose();n.material?.dispose();});
});
test('actual triangle inspection rejects separated surfaces even when their bounding boxes overlap',()=>{
  const a=new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,2,0,0,0,2,0],3)));
  const b=new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([1.2,1.2,0,2,1.2,0,1.2,2,0],3)));
  a.updateMatrixWorld();b.updateMatrixWorld();assert.ok(new THREE.Box3().setFromObject(a).intersectsBox(new THREE.Box3().setFromObject(b)));
  assert.ok(Math.abs(physicalSurfaceGap([a],[b]).gap-Math.sqrt(.08))<1e-7,'the .4 m diagonal gap comes from real triangle edges');
  a.geometry.dispose();b.geometry.dispose();
});
test('cap crown seating catches a floating crown even when its front brim touches the forehead, and stays invariant under posed head and .88 scale',()=>{
  const actor=new THREE.Group(),torso=joint('torso_pivot',[0,0,0],actor),head=joint('head_pivot',[0,1,0],torso);
  mesh('Observed_face',[.4,.5,.32],[0,0,0],head);mesh('Connected_neck',[.12,.28,.12],[0,-.29,0],head);mesh('Bodice',[.5,.5,.3],[0,.46,0],torso);
  const cap=mesh('Work_cap',[.48,.05,.42],[0,.33,0],head);mesh('Work_cap_brim',[.5,.04,.09],[0,.245,-.16],head);
  const rest=measureGeometricContacts(actor),touch=rest.interfaces.find(x=>x.kind==='cap-to-head'),crown=rest.interfaces.find(x=>x.kind==='cap-crown-seat');
  assert.equal(touch.gapNativeM,0,'front brim alone touches the actual forehead');assert.ok(crown.gapNativeM>.0549&&crown.gapNativeM<.0551,'crown underside remains 55 mm above the real head top');assert.equal(crown.pass,false);
  head.rotation.set(.5,.8,-.3);actor.rotation.y=1.3;scaleBattlefieldUnit(actor);scaleBattlefieldUnit(actor);assert.equal(actor.scale.y,BATTLEFIELD_UNIT_SCALE,'battlefield resize is idempotent');
  const posed=measureGeometricContacts(actor).interfaces.find(x=>x.kind==='cap-crown-seat');assert.ok(Math.abs(posed.gapNativeM-crown.gapNativeM)<1e-7,'real contact gap remains expressed in native metres');
  cap.position.y-=.057;const fixed=measureGeometricContacts(actor).interfaces.find(x=>x.kind==='cap-crown-seat');assert.equal(fixed.pass,true,'seating the cap changes the real measured surface contact');
  actor.traverse(n=>{n.geometry?.dispose();n.material?.dispose();});
});
test('current Mage I, Engineer I and Soldier VI preserve actual source boot/headwear triangle gaps through attacks and scale; a detached private boot is detected',async()=>{
  for(const id of ['mage-1','runebreaker-1','soldier-6']){
    const reconstructed=currentReconstructionEntry(id);if(reconstructed){await approvedSourceInterfaces(id,reconstructed);continue;}
    const bytes=readFileSync('public/assets/geometric/defenders/'+id+'.glb'),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),actor=cloneDefenderTemplate(gltf.scene),peer=cloneDefenderTemplate(gltf.scene),sourceMatrices=[];
    gltf.scene.traverse(n=>sourceMatrices.push([...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray()]));
    const rig=attackRig(actor,id.replace(/-\d$/,''));
    for(const scaled of [false,true]){if(scaled)scaleBattlefieldUnit(actor);for(const stage of [0,.21,.42,.7]){
      previewGeometricAttack(rig,{duration:1});updateGeometricPreview(rig,stage);const result=measureGeometricContacts(actor);
      assert.deepEqual(result.failures,[],id+' real surfaces stay connected at stage '+stage+' scaled '+scaled);
    }}
    const foot=actor.getObjectByName('foot_L');foot.position.y-=.5;
    assert.ok(measureGeometricContacts(actor).failures.some(f=>f.kind==='shoe-to-shin'&&f.side==='L'),'a physically detached boot must fail, rather than merely retain its pivot name');
    const current=[];gltf.scene.traverse(n=>current.push([...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray()]));assert.deepEqual(current,sourceMatrices);assert.equal(peer.scale.y,1);
    disposeAttack(rig);disposeDefenderInstance(actor);disposeDefenderInstance(peer);disposeDecodedGeometricAsset(gltf);
  }
});
