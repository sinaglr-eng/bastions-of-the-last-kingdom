import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {partMeshes,partBounds} from '../tools/audit-geometric-appearance.mjs';
import {physicalSurfaceGap} from '../game/render/geometric-contacts.js';
import {geometricMetadata} from '../game/render/geometric-motion.js';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {attackRig,resetAttack,previewGeometricAttack,updateGeometricPreview,disposeAttack} from '../game/render/battle-animation.js';
import {scaleBattlefieldUnit} from '../game/render/battlefield-scale.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
const assetRoot=process.env.GEOMETRIC_V4_FIXTURE_DIR||'public/assets/geometric';
const descendant=(node,parent)=>{for(let p=node;p;p=p.parent)if(p===parent)return true;return false;};
function meshes(root,select=()=>true){const out=[];root.traverse(n=>{if(n.isMesh&&select(n))out.push(n);});return out;}
function bounds(nodes){const b=new THREE.Box3();for(const n of nodes)b.union(new THREE.Box3().setFromObject(n,true));return b;}
function nodes(root,select){const out=[];root.traverse(n=>{if(select(n))out.push(n);});return out;}
async function load(id){const category=id.startsWith('host_')?'enemies':'champions',bytes=readFileSync(`${assetRoot}/${category}/${id}.glb`);return new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}
function firstHit(parts,start,direction){const ray=new THREE.Ray(start,direction),hit=new THREE.Vector3();let nearest=Infinity;for(const mesh of parts){const p=mesh.geometry.attributes.position,ix=mesh.geometry.index;for(let i=0;i<(ix?.count||p.count);i+=3){const vs=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));if(ray.intersectTriangle(...vs,false,hit))nearest=Math.min(nearest,hit.distanceTo(start));}}return nearest;}

// Test imported surfaces and meaningful negative variants; author metadata is
// used only to identify the source-specific assemblies, never as pass proof.
test('Paladin/Archangel use one physical hollow visor shell with two real open eye apertures; plugged apertures fail',async()=>{
 for(const id of ['kingdomprotector','archangel']){
  const gltf=await load(id),actor=gltf.scene;actor.updateMatrixWorld(true);
  const shells=nodes(actor,n=>n.userData.singleIntegratedHelmetV4),parts=partMeshes(actor,['Helmet single integrated hollow armored visor shell']),eyes=partMeshes(actor,['Helmet recessed aperture interior']);
  assert.equal(shells.length,1);assert.ok(parts.length);assert.equal(eyes.length,2);
  assert.equal(partMeshes(actor,/^Helmet (solid crown|integrated crown cheeks|visor|lower oval)/).length,0,'underlying oval and separate face stacks are absent');
  const shellBounds=bounds(parts);
  function opening(parts,eye){const c=new THREE.Box3().setFromObject(eye,true).getCenter(new THREE.Vector3()),start=c.clone();start.z=shellBounds.min.z-.3;return firstHit(parts,start,new THREE.Vector3(0,0,1))>c.z-start.z+.02;}
  for(const eye of eyes){assert.ok(opening(parts,eye),id+' ray crosses open front wall into actual hollow shell');const c=new THREE.Box3().setFromObject(eye,true).getCenter(new THREE.Vector3()),plug=new THREE.Mesh(new THREE.BoxGeometry(.065,.05,.02));plug.position.set(c.x,c.y,shellBounds.min.z);plug.updateMatrixWorld(true);assert.equal(opening([...parts,plug],eye),false,'opaque eye-plug regression is detected');plug.geometry.dispose();plug.material.dispose();}
  const c=shellBounds.getCenter(new THREE.Vector3()),start=new THREE.Vector3(0,c.y,shellBounds.min.z-.3);assert.ok(firstHit(parts,start,new THREE.Vector3(0,0,1))<.36,'actual nose bridge remains solid between eye apertures');
  disposeDecodedGeometricAsset(gltf);
 }
});

test('every rebuilt humanoid head physically touches the structural chest with no exposed neck shaft; a detached head fails',async()=>{
 let measured=0;
 for(const category of ['champions','enemies']){
  const file=`${assetRoot}/geometric-${category}.json`,mf=JSON.parse(readFileSync(file)),entries=mf.entries||mf;
  for(const entry of entries){const gltf=await load(entry.id),actor=gltf.scene,meta=geometricMetadata(actor);actor.updateMatrixWorld(true);
   const fits=JSON.parse(meta?.humanoidHeadFitDetailsV4||'[]');
   for(const fit of fits){const head=actor.getObjectByName(fit.head),headParts=partMeshes(head,fit.bearingParts),bodyParts=partMeshes(actor,fit.structuralBodyParts).filter(n=>!descendant(n,head));assert.ok(headParts.length&&bodyParts.length,entry.id+' actual nondecorative surfaces');assert.equal(partMeshes(head,/^Connected neck inside collar$/).length,0,entry.id+' exposed shaft removed');assert.ok(physicalSurfaceGap(headParts,bodyParts).gap<=.00002,entry.id+' chin seats in actual chest');measured++;
    const old=head.position.clone();head.position.y+=.50;actor.updateMatrixWorld(true);assert.ok(physicalSurfaceGap(headParts,bodyParts).gap>.08,entry.id+' prior floating head variant fails');head.position.copy(old);actor.updateMatrixWorld(true);
   }
   if(meta?.locomotion!=='flying')assert.ok(new THREE.Box3().setFromObject(actor,true).min.y>=-.002,entry.id+' actual all-mesh floor');disposeDecodedGeometricAsset(gltf);
  }
 }
 assert.ok(measured>=10,'measure actual humanoid assemblies rather than an empty roster');
});

test('all actual champion/enemy crossbows retain rear trigger/front support and physically joined palms throughout recoil at battlefield scale',async()=>{
 for(const id of ['rimewatch','wyvernhunter','kingsrangerguard','royalranger','host_25','host_28']){
  if(!existsSync(`${assetRoot}/${id.startsWith('host_')?'enemies':'champions'}/${id}.glb`))continue;
  const gltf=await load(id),actor=cloneDefenderTemplate(gltf.scene);scaleBattlefieldUnit(actor);actor.updateMatrixWorld(true);const meta=geometricMetadata(actor);assert.equal(meta.crossbowGripContract,'rear-trigger-front-support-v3');
  const rig=attackRig(actor,id,{}),rear=actor.getObjectByName('crossbow_trigger_grip'),front=actor.getObjectByName('crossbow_foregrip');assert.ok(rig.crossbowArms&&rear&&front);const worldScale=actor.getWorldScale(new THREE.Vector3()).y;const stock=partBounds(actor,/^Crossbow connected fore-stock$/).getSize(new THREE.Vector3()).z;assert.ok((rear.getWorldPosition(new THREE.Vector3()).z-front.getWorldPosition(new THREE.Vector3()).z)/stock>.30,'support palm is physically forward of trigger relative to actual stock size');
  for(const phase of [0,.21,.42,.49,.58,.72,.87,1]){resetAttack(rig);previewGeometricAttack(rig,{duration:1});updateGeometricPreview(rig,phase);actor.updateMatrixWorld(true);for(const side of ['R','L']){const hand=actor.getObjectByName('hand_'+side),fore=actor.getObjectByName('forearm_'+side),weapon=actor.getObjectByName('weapon_'+side),grip=side==='R'?rear:front;assert.ok(hand.getWorldPosition(new THREE.Vector3()).distanceTo(grip.getWorldPosition(new THREE.Vector3()))/worldScale<.0001,id+' '+side+' palm follows actual moving grip');const sleeve=meshes(fore,n=>!descendant(n,hand)),palm=meshes(hand,n=>!descendant(n,weapon));assert.ok(physicalSurfaceGap(sleeve,palm).gap/worldScale<.0001,id+' joined wrist at '+phase);}}
  disposeAttack(rig);disposeDefenderInstance(actor);disposeDecodedGeometricAsset(gltf);
 }
});

test('dragon/griffin rider leg surfaces are forward of physical wing roots; Thunderheart wings are larger while roots stay joined',async()=>{
 for(const id of ['thunderheart','phoenix','griffinbomber']){
  const gltf=await load(id),actor=gltf.scene;actor.updateMatrixWorld(true);
  for(const side of ['R','L']){const leg=actor.getObjectByName('upper_leg_'+side),wing=actor.getObjectByName('wing_'+side),root=wing.getWorldPosition(new THREE.Vector3()),surface=meshes(wing),samples=[];
   for(const mesh of surface){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const q=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);if(q.distanceTo(root)<.13)samples.push(q);}}
   assert.ok(samples.length>=4,id+' physical root surface is measured');const front=Math.min(...samples.map(p=>p.z));assert.ok(new THREE.Box3().setFromObject(leg,true).max.z<front-.005,id+' entire actual leg volume stays ahead of wing-root front surface');
   const old=leg.position.clone();leg.position.z+=.25;actor.updateMatrixWorld(true);assert.ok(new THREE.Box3().setFromObject(leg,true).max.z>=front,'old rider-through-root variant fails');leg.position.copy(old);actor.updateMatrixWorld(true);
  }
  if(id==='thunderheart'){const wingBounds=partBounds(actor,/^Dragon source broad scalloped closed wing membrane$/),headBounds=partBounds(actor,/^Dragon sculpted faceted cranial volume source broad wedge$/);assert.ok(!headBounds.isEmpty());assert.ok(wingBounds.getSize(new THREE.Vector3()).x>2.5,'actual larger membrane exceeds the documented 0.3.2 span of2.2677m; this is a user enlargement regression, not a drawing-fidelity certificate');}
  disposeDecodedGeometricAsset(gltf);
 }
});

test('Kingslayer palms wrap the real continuous hilt behind a proper straight blade; chest plate leaves the grip visible, horses retain actual jointed anatomy',async()=>{
 const gltf=await load('highking'),actor=gltf.scene;actor.updateMatrixWorld(true);const hilt=partMeshes(actor,/^Kingslayer two hands continuous actual hilt$/),blade=partMeshes(actor,/^Kingslayer source straight broad true greatsword$/),plate=partMeshes(actor,/^Kingslayer source contoured chest armor$/);assert.ok(hilt.length&&blade.length&&plate.length);
 for(const side of ['R','L']){const hand=actor.getObjectByName('hand_'+side),grip=actor.getObjectByName(side==='R'?'greatsword_right_grip':'greatsword_left_grip'),palm=partMeshes(hand,/^Kingslayer actual gripping gauntlet/);assert.ok(hand.getWorldPosition(new THREE.Vector3()).distanceTo(grip.getWorldPosition(new THREE.Vector3()))<1e-7);assert.equal(physicalSurfaceGap(palm,hilt).gap,0,'palm contains physical hilt');assert.ok(bounds(plate).min.z>bounds(palm).min.z+.10,'chest is behind the visible hand along firing front');}
 assert.equal(partMeshes(actor,/^Breastplate fitted shell$/).length,0,'old blocking rectangle removed');disposeDecodedGeometricAsset(gltf);
 for(const id of ['frostblade','roseguard']){const gltf=await load(id),body=gltf.scene;body.updateMatrixWorld(true);const head=body.getObjectByName('mount_head_pivot'),jaw=partMeshes(head,/^Horse (source anatomical rounded jaw mass|actual lower jaw tendon)$/),skull=partMeshes(head,/^Horse /);assert.ok(jaw.length>=4);for(const mesh of jaw)assert.equal(physicalSurfaceGap([mesh],skull.filter(m=>m!==mesh)).gap,0,'real jaw/tendon contact');for(const side of ['FL','FR','BL','BR']){assert.ok(body.getObjectByName('shin_'+side)&&body.getObjectByName('foot_'+side));assert.ok(partMeshes(body.getObjectByName('foot_'+side),/^Horse anatomical (hoof central dark cleft|fitted rounded heel bulb)$/).length>=2);}disposeDecodedGeometricAsset(gltf);}
});

test('Nature Spirit integrates the nonhuman face and twisted roots in one continuous physical torso volume',async()=>{
 const gltf=await load('mothernature'),actor=gltf.scene;actor.updateMatrixWorld(true);const torso=actor.getObjectByName('torso_pivot'),head=actor.getObjectByName('head_pivot'),volume=nodes(actor,n=>n.userData.integratedNatureFaceBody),parts=partMeshes(actor,/^Nature unified living wood leaf body with integrated face$/),eyes=partMeshes(actor,/^Nature integrated luminous almond eye$/);assert.equal(volume.length,1);assert.equal(volume[0].parent,torso);assert.ok(parts.length&&eyes.length===2);assert.equal(meshes(head,n=>/face|skin|eye/i.test(n.userData.semanticPart||n.name)).length,0,'no separate physical head or human flesh');assert.ok(volume[0].userData.actualUnifiedRootLobes===3);const bodyBounds=bounds(parts);assert.ok(bodyBounds.max.y>1.5&&bodyBounds.min.y<.40,'same physical mesh spans root tip and full face');for(const eye of eyes){assert.equal(eye.parent,torso);assert.ok(eye.material.emissiveIntensity>0);assert.ok(physicalSurfaceGap([eye],parts).gap<.02,'eyes reside in actual body surface');}disposeDecodedGeometricAsset(gltf);
});
