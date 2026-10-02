import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {attackRig,triggerAttack,animateAttack,resetAttack,disposeAttack} from '../game/render/battle-animation.js';

function fixture({neutral=true,family='archer'}={}){
  const actor=new THREE.Group(),unit=new THREE.Group();actor.add(unit);
  if(neutral)unit.userData.bowRestPose='lowered-hand';
  const node=(name,parent,position)=>{const joint=new THREE.Group();joint.name=name;joint.position.fromArray(position);parent.add(joint);return joint;};
  const torso=node('torso_pivot',unit,[0,.88,0]);node('head_pivot',torso,[0,.61,0]);
  const upperR=node('upper_arm_R',torso,[.245,.37,0]);
  const foreR=node('forearm_R',upperR,[.056,-.256,-.016]);
  const handR=node('hand_R',foreR,[.009,-.254,-.05]);
  node('weapon_R',handR,[0,0,0]);const nock=node('bow_nock',handR,[0,0,0]);
  const upperL=node('upper_arm_L',torso,[-.245,.37,0]);
  const foreL=node('forearm_L',upperL,[-.089,-.193,-.150]);
  const handL=node('hand_L',foreL,[-.154,-.131,-.370]);
  const bow=node('bow_pivot',handL,[0,0,0]);
  const top=node('bow_tip_upper',bow,[0,.94,0]),bottom=node('bow_tip_lower',bow,[0,-.90,0]);
  const authored=node('authored_bowstring',bow,[0,0,0]);node('attack_muzzle',bow,[0,0,0]);
  actor.position.set(4,.85,8);actor.rotation.y=.8;actor.scale.setScalar(.72);actor.updateMatrixWorld(true);
  const rig=attackRig(actor,family);return {actor,rig,top,bottom,nock,authored};
}
const local=(actor,node)=>actor.worldToLocal(node.getWorldPosition(new THREE.Vector3()));
const endpoint=(rig,index)=>new THREE.Vector3().fromBufferAttribute(rig.string.object.geometry.attributes.position,index);
function straight({actor,rig,top,bottom}){
  actor.updateMatrixWorld(true);const a=local(actor,top),b=local(actor,bottom),mid=a.clone().lerp(b,.5);
  assert.ok(endpoint(rig,0).distanceTo(a)<1e-6,'upper end must follow the actual bow tip');
  assert.ok(endpoint(rig,2).distanceTo(b)<1e-6,'lower end must follow the actual bow tip');
  for(const index of [1,3])assert.ok(endpoint(rig,index).distanceTo(mid)<1e-6,'neutral string must remain straight between tips');
}

test('lowered-hand bow is straight at idle and after release, and catches the actual moving nock at full draw',()=>{
  const state=fixture();straight(state);
  const {actor,rig,nock,authored}=state,restNock=local(actor,nock);
  assert.ok(endpoint(rig,1).distanceTo(restNock)>.2,'free neutral hand must not pull idle string across the torso');
  assert.equal(authored.visible,false);
  triggerAttack(rig);animateAttack(rig,rig.duration*.21);
  const midpoint=local(actor,state.top).lerp(local(actor,state.bottom),.5),moving=local(actor,nock);
  assert.ok(endpoint(rig,1).distanceTo(midpoint)>1e-3,'string begins drawing towards the hand');
  assert.ok(endpoint(rig,1).distanceTo(moving)>1e-3,'early draw catches progressively rather than jumping to the free hand');
  animateAttack(rig,rig.duration*.21);
  for(const index of [1,3])assert.ok(endpoint(rig,index).distanceTo(local(actor,nock))<1e-6,'full draw follows real hand nock');
  const drawnNock=local(actor,nock);
  assert.ok(drawnNock.y>restNock.y+.2,'neutral drawing hand rises from lowered rest to chest height');
  assert.ok(drawnNock.z<restNock.z-.2,'neutral drawing hand catches the bow string in front of the body');
  animateAttack(rig,rig.duration*.3);straight(state);
  animateAttack(rig,1);assert.equal(rig.active,false);straight(state);
  disposeAttack(rig);assert.equal(authored.visible,true);
});

test('neutral lowered-hand bow remains straight with reduced motion and explicit reset restores rest pose',()=>{
  const state=fixture(),{rig}=state,rest=rig.pivots.map(p=>p.node.rotation.toArray());
  triggerAttack(rig);animateAttack(rig,rig.duration*.42,0,{reducedMotion:true});straight(state);
  rig.pivots.forEach((p,i)=>assert.deepEqual(p.node.rotation.toArray(),rest[i]));
  resetAttack(rig);straight(state);assert.equal(rig.active,false);
  disposeAttack(rig);
});

test('unmarked historical and champion bows preserve their authored nock-linked string',()=>{
  for(const family of ['archer','thornwarden']){
    const state=fixture({neutral:false,family}),{actor,rig,nock}=state;
    assert.equal(rig.string.restStraight,false);
    for(const index of [1,3])assert.ok(endpoint(rig,index).distanceTo(local(actor,nock))<1e-6);
    triggerAttack(rig);animateAttack(rig,rig.duration*.21);
    for(const index of [1,3])assert.ok(endpoint(rig,index).distanceTo(local(actor,nock))<1e-6);
    resetAttack(rig);
    for(const index of [1,3])assert.ok(endpoint(rig,index).distanceTo(local(actor,nock))<1e-6);
    disposeAttack(rig);
  }
});
