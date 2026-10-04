import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {enemyFigure,disposeEnemyFigure} from '../game/render/enemy-assets.js';
import {animateEnemyMotion} from '../game/render/enemy-motion.js';
import {geometricMetadata,resetGeometricMotion} from '../game/render/geometric-motion.js';
import {scaleBattlefieldUnit} from '../game/render/battlefield-scale.js';
import {measureGeometricContacts,physicalSurfaceGap} from '../game/render/geometric-contacts.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
import {partSemanticV5} from '../tools/audit-geometric-proportions-v5.mjs';

const definition=JSON.parse(readFileSync(new URL('../data/enemies.json',import.meta.url))).host_09;
const entry=JSON.parse(readFileSync(new URL('../public/assets/geometric/geometric-enemies.json',import.meta.url))).entries.find(e=>e.id==='host_09');
const pose=root=>{const out=[];root.traverse(n=>out.push([n.name,...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray()]));return JSON.stringify(out);};
const meshes=root=>{const out=[];root.traverse(n=>{if(n.isMesh)out.push(n);});return out;};
async function load(){
  const bytes=readFileSync(new URL('../public/assets/geometric/enemies/host_09.glb',import.meta.url)),decoded=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const source=decoded.scene,enemy={...definition,id:0,type:'host_09',traveled:0,statuses:{}},templates=new Map([['host_09',source]]),figure=enemyFigure(enemy,templates),peer=enemyFigure(enemy,templates);scaleBattlefieldUnit(figure,enemy);
  return {decoded,source,enemy,figure,peer};
}
const cleanup=loaded=>{disposeEnemyFigure(loaded.figure);disposeEnemyFigure(loaded.peer);disposeDecodedGeometricAsset(loaded.decoded);};
function stance(root){
  root.updateWorldMatrix(true,true);
  const point=name=>root.getObjectByName(name).getWorldPosition(new THREE.Vector3());
  const left=point('foot_L'),right=point('foot_R');
  const bootCentre=side=>new THREE.Box3().setFromObject(root.getObjectByName('Grounded_boot_'+side),true).getCenter(new THREE.Vector3());
  return {hipL:point('upper_leg_L').x,hipR:point('upper_leg_R').x,kneeL:point('shin_L').x,kneeR:point('shin_R').x,ankleWidth:right.x-left.x,bootWidth:bootCentre('R').x-bootCentre('L').x};
}
function assertNarrow(s){
  assert.ok(Math.abs(s.hipL+.1311)<.0001&&Math.abs(s.hipR-.1311)<.0001,'Hip bearings retain their original source attachment');
  assert.ok(Math.abs(s.kneeL+.1611)<.0001&&Math.abs(s.kneeR-.1611)<.0001,'Actual knee bearings move inward with both leg surfaces');
  assert.ok(Math.abs(s.ankleWidth-.4)<.0001,'Actual ankle spacing is400mm instead of the former699mm');
  assert.ok(Math.abs(s.bootWidth-.4)<.02,'The actual boot geometry follows the narrower joints');
}
function minimumFootY(foot){
  let minimum=Infinity;for(const mesh of meshes(foot)){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)minimum=Math.min(minimum,new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).y);}return minimum;
}
function physicalScopeGaps(figure){
  figure.updateWorldMatrix(true,true);const metadata=geometricMetadata(figure),contract=JSON.parse(metadata.enemyPhysicalContractV6),parts=meshes(figure),scale=figure.getWorldScale(new THREE.Vector3()).y;
  return contract.contacts.map(contact=>{
    const select=names=>parts.filter(n=>names.includes(partSemanticV5(n)));
    return {name:contact.name,gap:physicalSurfaceGap(select(contact.leftParts),select(contact.rightParts)).gap/scale};
  });
}

test('the actual production Dust Dancer has narrower physical legs bound to its fresh native and unchanged original source',async()=>{
  const loaded=await load();try{
    assert.equal(entry.stanceRevision,'geometric-game-v7');assert.match(entry.native,/geometric-game-v7\/enemies\/host_09\.blend$/);assert.ok(existsSync(new URL('../'+entry.native,import.meta.url)),'Fresh editable native source exists');
    const sourceBytes=readFileSync(new URL('../public/geometric-turnarounds-v1/'+entry.source,import.meta.url));assert.equal(createHash('sha256').update(sourceBytes).digest('hex'),entry.sourceSha256);
    assertNarrow(stance(loaded.source));assert.equal(geometricMetadata(loaded.source).sourceSha256,entry.sourceSha256);
    const contacts=measureGeometricContacts(loaded.source);assert.deepEqual(contacts.failures,[]);assert.equal(contacts.toleranceNativeM,.004);
    for(const side of ['L','R'])assert.ok(contacts.interfaces.some(c=>c.kind==='knee-link'&&c.side===side)&&contacts.interfaces.some(c=>c.kind==='shoe-to-shin'&&c.side===side),'Both physical knee and ankle interfaces are actually measured');
  }finally{cleanup(loaded);}
});

test('200 real narrow-stance gait frames retain ground, surfaces, alternating support and untouched cached peers',async()=>{
  const loaded=await load(),{source,figure,peer,enemy}=loaded;
  try{
    const sourceRest=pose(source),peerRest=pose(peer),vertices=new Map(meshes(source).map(n=>[n.geometry,n.geometry.attributes.position.array.slice()]));
    animateEnemyMotion(figure,enemy,0);figure.updateWorldMatrix(true,true);const rig=figure.userData.geometricMotion;
    assert.equal(rig.legs.length,2);assert.ok(rig.legs.every(l=>l.ik&&l.knee.node.parent===l.hip.node&&l.foot.node.parent===l.knee.node));
    let previous=rig.legs.map(l=>({hip:l.hip.node.quaternion.clone(),sole:l.foot.node.getWorldQuaternion(new THREE.Quaternion())})),previousSwing=new Set();const starts=[];
    for(let frame=1;frame<=200;frame++){
      const time=frame/60;enemy.traveled=time*definition.speed;figure.position.z=-enemy.traveled;const combat=JSON.stringify(enemy);
      assert.equal(animateEnemyMotion(figure,enemy,time),0);assert.equal(JSON.stringify(enemy),combat);figure.updateWorldMatrix(true,true);
      const swinging=new Set();
      for(const [index,leg]of rig.legs.entries()){
        assert.ok(minimumFootY(leg.foot.node)>=-.002,`Frame${frame} ${leg.side} actual sole triangles do not penetrate terrain`);
        const hip=leg.hip.node.quaternion.clone(),sole=leg.foot.node.getWorldQuaternion(new THREE.Quaternion());assert.ok(hip.angleTo(previous[index].hip)<.4);assert.ok(sole.angleTo(previous[index].sole)<.04);
        const up=new THREE.Vector3(0,1,0).applyQuaternion(sole);assert.ok(up.y>.96,'Actual footwear never flips away from its authored ground-facing orientation');
        const rest=rig.body.localToWorld(leg.restFoot.clone()),height=leg.foot.node.getWorldPosition(new THREE.Vector3()).y-rest.y;if(height>.0001)swinging.add(leg.side);previous[index]={hip,sole};
      }
      assert.ok(!(swinging.has('L')&&swinging.has('R')));for(const side of ['L','R'])if(swinging.has(side)&&!previousSwing.has(side))starts.push(side);previousSwing=swinging;
      if(frame%20===0){assert.deepEqual(measureGeometricContacts(figure).failures,[],'Actual contacts at frame'+frame);assert.deepEqual(physicalScopeGaps(figure).filter(c=>c.gap>.004),[],'Actual source hip/shoulder/held surface scopes at frame'+frame);}
    }
    assert.ok(starts.length>=5,'Narrowed native legs complete several actual support/swing changes');for(let i=1;i<starts.length;i++)assert.notEqual(starts[i],starts[i-1]);
    assert.equal(pose(source),sourceRest);assert.equal(pose(peer),peerRest);for(const [geometry,before]of vertices)assert.deepEqual(geometry.attributes.position.array,before);
    for(const status of ['freeze','petrify']){enemy.statuses={[status]:{time:1}};animateEnemyMotion(figure,enemy,4);const fixed=pose(figure);animateEnemyMotion(figure,enemy,7);assert.equal(pose(figure),fixed);}
    enemy.statuses={};animateEnemyMotion(figure,enemy,8,{reducedMotion:true});const reduced=pose(figure);animateEnemyMotion(figure,enemy,9,{reducedMotion:true});assert.equal(pose(figure),reduced);resetGeometricMotion(rig);assert.equal(pose(source),sourceRest);
  }finally{cleanup(loaded);}
});

test('narrow-stance checks reject old wide footwear geometry even when joints and author metadata still claim the corrected stance',async()=>{
  const loaded=await load(),owned=[];try{
    const root=loaded.peer;assertNarrow(stance(root));const beforeJoints=['foot_L','foot_R'].map(n=>root.getObjectByName(n).position.toArray());
    for(const side of ['L','R'])for(const mesh of meshes(root.getObjectByName('foot_'+side))){mesh.geometry=mesh.geometry.clone();owned.push(mesh.geometry);mesh.geometry.translate(side==='L'?-.1496:.1496,0,0);}
    assert.deepEqual(['foot_L','foot_R'].map(n=>root.getObjectByName(n).position.toArray()),beforeJoints);assert.throws(()=>assertNarrow(stance(root)),/actual boot geometry/);assert.ok(measureGeometricContacts(root).failures.length>0,'Real moved footwear breaks an actual surface interface');assertNarrow(stance(loaded.source));
  }finally{owned.forEach(g=>g.dispose());cleanup(loaded);}
});
