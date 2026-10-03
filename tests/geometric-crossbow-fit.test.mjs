import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {attackRig,attackMuzzle,previewGeometricAttack,updateGeometricPreview,resetAttack,disposeAttack} from '../game/render/battle-animation.js';
import {physicalSurfaceGap} from '../game/render/geometric-contacts.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
import {geometricMetadata} from '../game/render/geometric-motion.js';
import {scaleBattlefieldUnit} from '../game/render/battlefield-scale.js';
import {optimizeGeometricSiblings} from '../game/render/geometric-batching.js';
import {partMeshes} from '../tools/audit-geometric-appearance.mjs';

async function load(id){
  const root=process.env.GEOMETRIC_V3_FIXTURE_DIR||'public/assets/geometric/champions',bytes=readFileSync(`${root}/${id}.glb`);
  return new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
function transforms(root){const rows=[];root.traverse(node=>rows.push([node.name,...node.position.toArray(),...node.quaternion.toArray(),...node.scale.toArray()].map(value=>typeof value==='number'&&value===0?0:value)));return rows;}
function descendant(node,parent){for(let current=node;current;current=current.parent)if(current===parent)return true;return false;}
function meshes(root,condition){const list=[];root.traverse(node=>{if(node.isMesh&&condition(node))list.push(node);});return list;}
function local(actor,node){actor.updateWorldMatrix(true,true);return actor.worldToLocal(node.getWorldPosition(new THREE.Vector3()));}
function contact(actor,side){
  const fore=actor.getObjectByName('forearm_'+side),hand=actor.getObjectByName('hand_'+side),weapon=actor.getObjectByName('weapon_'+side);
  const sleeves=meshes(fore,node=>!descendant(node,hand)),palm=meshes(hand,node=>!descendant(node,weapon));
  assert.ok(sleeves.length&&palm.length,'inspect real sleeve and palm triangles');
  return physicalSurfaceGap(sleeves,palm);
}

test('actual Rimewatch and Royalranger crossbows have distinct rear trigger/front support palms, physical stocks/strings and joined wrists through recoil at .88 scale',async()=>{
  for(const id of ['rimewatch','royalranger'])for(const batch of [false,true]){
    const gltf=await load(id),sourceBefore=transforms(gltf.scene);
    if(batch)optimizeGeometricSiblings(gltf.scene);
    const source=transforms(gltf.scene),actor=cloneDefenderTemplate(gltf.scene),peer=cloneDefenderTemplate(gltf.scene),peerBefore=transforms(peer);
    actor.position.set(3,1.3,5);actor.rotation.y=.72;actor.scale.setScalar(.7);scaleBattlefieldUnit(actor);
    assert.equal(geometricMetadata(actor).attackStyle,'crossbow');
    const rig=attackRig(actor,id,JSON.parse(readFileSync('data/towers.json'))[id]);
    assert.ok(rig.crossbowArms&&rig.crossbowForegrip,'actual canonical two-arm IK contract');
    const trigger=actor.getObjectByName('crossbow_trigger_grip'),support=actor.getObjectByName('crossbow_foregrip'),handR=actor.getObjectByName('hand_R'),handL=actor.getObjectByName('hand_L');
    const right=local(actor,handR),left=local(actor,handL);
    assert.ok(right.z-left.z>.20,'support palm lies ahead of the rear trigger grip along actual -Z');
    assert.ok(Math.abs(right.x)<.10&&Math.abs(left.x)<.10,'both palms hold the stock rather than transverse bow tips');
    assert.ok(right.distanceTo(local(actor,trigger))<1e-7&&left.distanceTo(local(actor,support))<1e-7);
    assert.ok(actor.getObjectByName('Crossbow_shaped_rear_shoulder_butt'),'proper physical butt');
    assert.ok(actor.getObjectByName('Crossbow_physical_trigger_guard'),'proper physical trigger');
    assert.ok(rig.authoredStrings.some(entry=>entry.node.isMesh&&entry.node.userData.visualCue==='crossbowString'),'real authored string remains separately addressable after batching');
    assert.ok(!rig.bowArms,'crossbow does not run the historical bow draw');
    const rest=transforms(actor),restMuzzle=local(actor,rig.muzzle),restNock=local(actor,rig.string.authoredNock);
    const restRail=local(actor,rig.muzzle).sub(local(actor,trigger)).normalize();
    let maximumRecoil=0;
    for(const phase of [0,.21,.42,.49,.58,.72,.87,1]){
      resetAttack(rig);previewGeometricAttack(rig,{duration:1});updateGeometricPreview(rig,phase);
      const scale=actor.getWorldScale(new THREE.Vector3()).y;
      for(const side of ['R','L']){
        assert.ok(contact(actor,side).gap/scale<.0001,`${id} ${side} wrist remains physically joined at ${phase}`);
        const upper=actor.getObjectByName('upper_arm_'+side),fore=actor.getObjectByName('forearm_'+side),torso=actor.getObjectByName('torso_pivot');
        const shoulder=meshes(upper,node=>!descendant(node,fore)),body=meshes(torso,node=>/^Tailored_continuous_bodice/.test(node.name)||batch&&node.parent===torso&&node.userData.geometricBatch);
        assert.ok(shoulder.length&&body.length&&physicalSurfaceGap(shoulder,body).gap/scale<.0001,'actual arm remains joined to the source torso during whole-arm recoil');
        const grip=side==='R'?trigger:support,hand=side==='R'?handR:handL;
        assert.ok(hand.getWorldPosition(new THREE.Vector3()).distanceTo(grip.getWorldPosition(new THREE.Vector3()))/scale<.0001,`${id} ${side} palm stays on the actual moving grip at ${phase}`);
      }
      const rail=local(actor,rig.muzzle).sub(local(actor,trigger)).normalize();
      assert.ok(rail.distanceTo(restRail)<1e-6,'recoil retains the actual stock firing axis');
      maximumRecoil=Math.max(maximumRecoil,local(actor,rig.muzzle).z-restMuzzle.z);
      const positions=rig.string.object.geometry.attributes.position;
      for(const [index,node] of [[0,rig.string.top],[2,rig.string.bottom],[1,rig.string.authoredNock],[3,rig.string.authoredNock]])assert.ok(new THREE.Vector3().fromBufferAttribute(positions,index).distanceTo(local(actor,node))<1e-7,'taut physical string follows its actual end/nock');
      if(phase===.49)assert.ok(local(actor,rig.string.authoredNock).z<restNock.z-.15,'cocked V-string actually releases forwards along the bolt rail');
      assert.ok(attackMuzzle(rig).distanceTo(rig.muzzle.getWorldPosition(new THREE.Vector3()))<1e-8,'world effect starts at the physical bolt tip');
    }
    assert.ok(maximumRecoil>.030&&maximumRecoil<.036,'whole gun/hands recoil together by a bounded natural distance');
    resetAttack(rig);assert.deepEqual(transforms(actor),rest,'recovery restores exact canonical pose including nock');
    previewGeometricAttack(rig,{duration:1});updateGeometricPreview(rig,.58,{reducedMotion:true});
    for(const side of ['R','L'])assert.ok(contact(actor,side).gap<.0001,'reduced motion retains complete wrist contacts');
    assert.deepEqual(transforms(gltf.scene),source,'private draw never mutates cached source joints');assert.deepEqual(transforms(peer),peerBefore);
    if(!batch)assert.deepEqual(source,sourceBefore);
    disposeAttack(rig);assert.ok(rig.authoredStrings.every(entry=>entry.node.visible===entry.visible));
    disposeDefenderInstance(actor);disposeDefenderInstance(peer);disposeDecodedGeometricAsset(gltf);
  }
});

test('actual Greenheart staff focus/branches connect to the weapon and Nature Spirit has a nonhuman face integrated into its body',async()=>{
  const green=await load('greenheart'),actor=cloneDefenderTemplate(green.scene),weapon=actor.getObjectByName('weapon_R');
  actor.updateWorldMatrix(true,true);
  const shaft=meshes(weapon,node=>/continuous_curved_staff_shaft/i.test(node.name)),forks=meshes(weapon,node=>/connected_branch_fork/i.test(node.name)),focus=meshes(weapon,node=>/broad_connected_faceted_staff_leaf/i.test(node.name));
  assert.equal(shaft.length,1);assert.equal(forks.length,2);assert.equal(focus.length,1);
  assert.equal(physicalSurfaceGap(shaft,focus).gap,0,'leaf lower tip physically touches actual stem');
  for(const fork of forks)assert.equal(physicalSurfaceGap(shaft,[fork]).gap,0,'actual wooden fork begins on the shaft');
  assert.ok(descendant(actor.getObjectByName('staff_tip'),weapon)&&descendant(actor.getObjectByName('attack_muzzle'),weapon));
  const spirit=await load('mothernature'),body=cloneDefenderTemplate(spirit.scene),head=body.getObjectByName('head_pivot');
  const metadata=geometricMetadata(body);assert.equal(metadata.integratedHeadInTorso,true);assert.equal(metadata.natureSpiritFaceContract,'unified-living-body-recessed-almond-eyes-v5');
  const torso=body.getObjectByName('torso_pivot'),face=partMeshes(body,/^Nature unified living wood leaf body with integrated face$/i),eyes=partMeshes(body,/^Nature (?:integrated luminous almond eye|V5 flush recessed living almond light)$/i);
  assert.ok(face.length>0);assert.equal(eyes.length,2);
  assert.equal(meshes(head,node=>/face|skin|eye/i.test(node.userData.semanticPart||node.name)).length,0,'face and eyes are absent from a separate head');
  assert.ok([...face,...eyes].every(node=>descendant(node,torso)&&!descendant(node,head)),'real face surfaces belong to the living body');
  assert.equal(meshes(body,node=>/observed_face|construct_square_eye/i.test(node.name)).length,0,'human skin cube and square eyes really are absent');
  for(const eye of eyes){assert.ok(eye.material.emissiveIntensity>0);assert.ok(!/skin/i.test(eye.material.name));}
  body.updateWorldMatrix(true,true);const unified=new THREE.Box3();for(const part of face)unified.union(new THREE.Box3().setFromObject(part,true));
  assert.ok(unified.max.y>1.5&&unified.min.y<.4,'same living body geometry includes the face and roots');
  for(const eye of eyes)assert.ok(physicalSurfaceGap([eye],face).gap<.02,'luminous eyes actually meet the living body surface');
  disposeDefenderInstance(actor);disposeDefenderInstance(body);disposeDecodedGeometricAsset(green);disposeDecodedGeometricAsset(spirit);
});

test('the actual three repaired humanoid skin heads sit over the torso axis and Royalranger hair physically supports its cap; displacing a private head is detected',async()=>{
  function headOffset(actor){
    actor.updateWorldMatrix(true,true);
    const face=meshes(actor.getObjectByName('head_pivot'),node=>/^Observed_face$/.test(node.name)),bodice=meshes(actor,node=>/^Tailored_continuous_bodice$/.test(node.name));
    assert.equal(face.length,1);assert.equal(bodice.length,1);
    const centre=nodes=>{const points=[];for(const mesh of nodes){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)points.push(actor.worldToLocal(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld)));}return new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());};
    const delta=centre(face).sub(centre(bodice));return Math.hypot(delta.x,delta.z);
  }
  for(const id of ['rimewatch','royalranger','greenheart']){
    const gltf=await load(id),actor=cloneDefenderTemplate(gltf.scene),source=transforms(gltf.scene);
    assert.ok(headOffset(actor)<.035,`${id} actual skull volume, rather than the empty joint, is centred above the torso`);
    if(id==='royalranger'){
      const head=actor.getObjectByName('head_pivot'),hair=meshes(head,node=>/Hair_closed_faceted_cap/i.test(node.name)),cap=meshes(head,node=>/Royal_ranger_blue_beret_cap/i.test(node.name));
      assert.ok(hair.length&&cap.length);assert.equal(physicalSurfaceGap(hair,cap).gap,0,'actual fitted hair cap supports the actual blue beret');
    }
    actor.getObjectByName('head_pivot').position.z-=.16;
    assert.ok(headOffset(actor)>.12,'the prior forward-displaced-head defect fails the actual mesh-axis check');
    assert.deepEqual(transforms(gltf.scene),source,'diagnostic mutation remains private');
    disposeDefenderInstance(actor);disposeDecodedGeometricAsset(gltf);
  }
});
