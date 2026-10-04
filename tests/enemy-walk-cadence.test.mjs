import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {campaignEnemies} from '../game/core/campaign-roster.js';
import {enemyFigure,disposeEnemyFigure} from '../game/render/enemy-assets.js';
import {animateEnemyMotion} from '../game/render/enemy-motion.js';
import {ENEMY_WALK_CADENCE_SCALE,ENEMY_WALK_MAX_CYCLES_PER_SECOND,resetGeometricMotion} from '../game/render/geometric-motion.js';
import {scaleBattlefieldUnit} from '../game/render/battlefield-scale.js';
import {measureGeometricContacts,measureHeadCoverCoverage} from '../game/render/geometric-contacts.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';

const definitions=campaignEnemies(JSON.parse(readFileSync(new URL('../data/enemies.json',import.meta.url))));
const walking=Object.entries(definitions).filter(([id,definition])=>id.startsWith('host_')&&!definition.flying);
const transforms=root=>{const values=[];root.traverse(node=>values.push([node.name,...node.position.toArray(),...node.quaternion.toArray(),...node.scale.toArray()]));return JSON.stringify(values);};
async function actor(id,definition=definitions[id]){
  const bytes=readFileSync(new URL('../public/assets/geometric/enemies/'+id+'.glb',import.meta.url));
  const decoded=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const source=decoded.scene,enemy={...definition,id:0,type:id,traveled:0,statuses:{}},figure=enemyFigure(enemy,new Map([[id,source]]));
  scaleBattlefieldUnit(figure,enemy);return {decoded,source,enemy,figure};
}
function cleanup({decoded,figure}){disposeEnemyFigure(figure);disposeDecodedGeometricAsset(decoded);}
function oldCadence(rig,speed){
  const height=Math.max(.3,rig.metadata.bodyHeight||rig.metadata.bodyHeightMeters||1.8);
  const lengths=rig.legs.filter(leg=>leg.ik).map(leg=>leg.l1+leg.l2);
  const natural=lengths.length?Math.min(height*.26,Math.min(...lengths)*.85):height*.26;
  const oldStride=Math.min(1.8,Math.max(.15,rig.metadata.strideLength??natural));
  return speed/(oldStride*rig.body.getWorldScale(new THREE.Vector3()).y);
}

test('all 35 actual grounded campaign enemies take slow alternating steps at unchanged combat speeds without flipping soles',async()=>{
  assert.equal(walking.length,35);
  for(const [id,definition] of walking){
    const loaded=await actor(id,definition),{source,enemy,figure}=loaded;
    try{
      const sourceRest=transforms(source),stats=JSON.stringify(enemy),vertices=new Map();
      source.traverse(node=>{if(node.geometry?.attributes.position)vertices.set(node.geometry,node.geometry.attributes.position.array.slice());});
      const soles=new Map();figure.updateMatrixWorld(true);
      for(const name of ['L','R','FL','FR','BL','BR']){
        const foot=figure.getObjectByName('foot_'+name);
        if(foot)soles.set(name,new THREE.Vector3(0,1,0).applyQuaternion(foot.getWorldQuaternion(new THREE.Quaternion())));
      }
      animateEnemyMotion(figure,enemy,0);figure.updateMatrixWorld(true);
      const rig=figure.userData.geometricMotion,start=rig.phase,beforeHz=oldCadence(rig,enemy.speed);
      assert.ok(rig.legs.every(leg=>leg.ik),id+' uses real authored knee/ankle chains');
      let previous=rig.legs.map(leg=>({hip:leg.hip.node.quaternion.clone(),foot:leg.foot.node.getWorldQuaternion(new THREE.Quaternion())}));
      const first=rig.legs.find(leg=>leg.side==='L'||leg.side==='FL'),swingStarts=[];
      let previousSwing=new Set();
      for(let frame=1;frame<=120;frame++){
        const time=frame/60;enemy.traveled=time*definition.speed;figure.position.z=-enemy.traveled;
        const requested=JSON.stringify(enemy);
        assert.equal(animateEnemyMotion(figure,enemy,time),0,'grounded IK does not add a root bob');
        assert.equal(JSON.stringify(enemy),requested,id+' motion cannot mutate combat state');
        figure.updateMatrixWorld(true);const swinging=new Set();
        for(const [index,leg] of rig.legs.entries()){
          const hip=leg.hip.node.quaternion.clone(),foot=leg.foot.node.getWorldQuaternion(new THREE.Quaternion());
          // The previous 150 mm sweep/body-height lift snapped the bell's
          // short knee by 85 degrees in a frame. Keep even that chain below
          // 23 degrees, while the actual sole changes by less than 2.3 degrees.
          assert.ok(hip.angleTo(previous[index].hip)<.4,id+' '+leg.side+' continuous knee branch');
          assert.ok(foot.angleTo(previous[index].foot)<.04,id+' '+leg.side+' continuous sole rotation');
          const up=new THREE.Vector3(0,1,0).applyQuaternion(foot);
          assert.ok(up.dot(soles.get(leg.side))>.96,id+' '+leg.side+' sole retains its authored facing');
          const rest=rig.body.localToWorld(leg.restFoot.clone()),height=leg.foot.node.getWorldPosition(new THREE.Vector3()).y-rest.y;
          if(height>.0001)swinging.add(leg.side);
          previous[index]={hip,foot};
        }
        if(rig.locomotion==='quadruped'){
          assert.equal(swinging.has('FL'),swinging.has('BR'),id+' first actual diagonal pair');
          assert.equal(swinging.has('FR'),swinging.has('BL'),id+' second actual diagonal pair');
        }
        const opposite=first.side==='FL'?'FR':'R';
        for(const side of [first.side,opposite])if(swinging.has(side)&&!previousSwing.has(side))swingStarts.push(side);
        assert.ok(!(swinging.has(first.side)&&swinging.has(opposite)),id+' opposing feet do not swing together');
        previousSwing=swinging;
      }
      const afterHz=(rig.phase-start)/(2*Math.PI*2);
      assert.ok(afterHz<=ENEMY_WALK_MAX_CYCLES_PER_SECOND+1e-10,id+' normal-speed cadence cap');
      assert.ok(afterHz<=beforeHz*ENEMY_WALK_CADENCE_SCALE+1e-10,id+' at least four times slower than the former stride cadence');
      assert.ok(swingStarts.length>=3,id+' actual alternating feet visibly lift');
      for(let i=1;i<swingStarts.length;i++)assert.notEqual(swingStarts[i],swingStarts[i-1],id+' alternating support/swing sequence');
      enemy.traveled=0;assert.equal(JSON.stringify(enemy),stats,id+' only the caller advanced traveled distance');
      assert.equal(transforms(source),sourceRest,id+' cached native hierarchy stays untouched');
      for(const [geometry,before] of vertices)assert.deepEqual(geometry.attributes.position.array,before,id+' native vertex buffers stay untouched');
    }finally{cleanup(loaded);}
  }
});

test('slow real biped, short-knee, quadruped, boss and hollow-armor gait preserves strict surface contacts and protected head coverage',async()=>{
  for(const id of ['host_02','host_10','host_12','host_19','host_20','host_46','host_49']){
    const loaded=await actor(id),{enemy,figure}=loaded;
    try{
      for(let frame=0;frame<=120;frame++){
        const time=frame/60;enemy.traveled=time*enemy.speed;figure.position.z=-enemy.traveled;animateEnemyMotion(figure,enemy,time);
        if(![0,15,40,75,105].includes(frame))continue;
        const contacts=measureGeometricContacts(figure),cover=measureHeadCoverCoverage(figure);
        assert.ok(contacts.interfaces.length>=4,id+' actual physical interfaces inspected');
        assert.equal(contacts.toleranceNativeM,.004);
        assert.deepEqual(contacts.failures,[],id+' physical interfaces at '+time);
        assert.deepEqual(cover.failures,[],id+' actual protected head rays at '+time);
      }
    }finally{cleanup(loaded);}
  }
});

test('reset review samples and frozen, petrified, paused or reduced-motion walking do not inherit an old support target',async()=>{
  const loaded=await actor('host_02'),{enemy,figure}=loaded;
  try{
    animateEnemyMotion(figure,enemy,0);
    for(let frame=1;frame<=12;frame++){const time=frame/60;enemy.traveled=time*enemy.speed;animateEnemyMotion(figure,enemy,time);}
    const rig=figure.userData.geometricMotion;
    for(const status of ['freeze','petrify']){
      enemy.statuses={[status]:{time:1}};animateEnemyMotion(figure,enemy,1);
      const settled=transforms(figure),phase=rig.phase;animateEnemyMotion(figure,enemy,10);
      assert.equal(transforms(figure),settled);assert.equal(rig.phase,phase);
    }
    enemy.statuses={};animateEnemyMotion(figure,enemy,11,{reducedMotion:true});
    const reduced=transforms(figure);animateEnemyMotion(figure,enemy,30,{reducedMotion:true});assert.equal(transforms(figure),reduced);
    rig.phase=.31*Math.PI*2;rig.clock=null;rig.traveled=null;enemy.traveled=0;animateEnemyMotion(figure,enemy,0);
    const sampled=transforms(figure);animateEnemyMotion(figure,enemy,0);assert.equal(transforms(figure),sampled,'a paused sample does not drift');
    enemy.traveled=.12;animateEnemyMotion(figure,enemy,.1);
    resetGeometricMotion(rig);assert.ok(rig.legs.every(leg=>leg.supportZ===null),'stopping a preview clears its cached support targets');
    rig.phase=.31*Math.PI*2;rig.clock=null;rig.traveled=null;enemy.traveled=0;animateEnemyMotion(figure,enemy,0);
    assert.equal(transforms(figure),sampled,'resampling the same preview phase resets its actual foot support');
  }finally{cleanup(loaded);}
});

test('legacy fallback walking has the same quarter cadence without changing combat state',()=>{
  const enemy={...definitions.host_02,id:0,type:'host_02'},before=JSON.stringify(enemy),figure=enemyFigure(enemy,new Map());
  try{
    figure.position.set(7,.2,-3);
    const [left,right]=figure.userData.limbs,rest=left.userData.restRotation||0;
    let previous=0,positiveCrossings=0;
    for(let frame=0;frame<=480;frame++){
      animateEnemyMotion(figure,enemy,frame/60);
      const angle=left.rotation.x-rest;
      if(angle>0&&previous<=0)positiveCrossings++;
      assert.ok(Math.abs(angle-previous)<.025,'fallback limbs move continuously at normal speed');
      assert.ok(Math.abs(angle+right.rotation.x-(right.userData.restRotation||0))<1e-12,'fallback feet alternate');
      previous=angle;
    }
    // The former real fallback completed about 17 cycles in eight seconds.
    // Observe slow real limb crossings instead of reimplementing its sine.
    assert.ok(positiveCrossings>=3&&positiveCrossings<=5,'fallback cadence remains visibly slow but moving');
    assert.deepEqual(figure.position.toArray(),[7,.2,-3],'animation never moves the combat actor along its route');
    assert.equal(JSON.stringify(enemy),before);
  }finally{disposeEnemyFigure(figure);}
});
