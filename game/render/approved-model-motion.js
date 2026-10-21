import * as THREE from 'three';
import {createBasicMotion} from './approved-motion-v1/basic-motion.js';
import {createChampionMotion} from './approved-motion-v1/champion-motion.js';
import {createEnemyMotion} from './approved-motion-v1/enemy-motion.js';
import {createRig} from './optimized-motion-rig.js';
import {optimizeGeometricSiblings} from './geometric-batching.js';
import {batchPrivateSkinnedActor} from './skinned-batching.js';
import {ENEMY_RULES} from '../core/enemy-rules.js';

// Approved authoring files stay immutable. Controllers and deforming buffers
// belong to individual actors, never their cached templates or combat state.
const actors=new WeakMap();
const enemyPoses=new Map();let sourceGeneration=0;
const finite=(n,f=0)=>Number.isFinite(n)?n:f;
const clamp=n=>Math.max(0,Math.min(1,n));
export const APPROVED_MOTION_REVISION='approved-motion-v1';

export function prepareApprovedMotionTemplate(scene,entry){
  if(entry?.motion?.revision!==APPROVED_MOTION_REVISION)return false;
  scene.userData.approvedMotionTemplate={id:entry.id,family:entry.family,tier:entry.tier,
    kind:entry.motion.kind,height:entry.motion.height,revision:APPROVED_MOTION_REVISION,
    presentationScale:entry.reconstruction?.presentationScale||1,
    poseGeneration:entry.motion.kind==='enemy'?++sourceGeneration:null,
    attackStyle:entry.reconstruction?.attackStyle||entry.attackStyle||'staff',
    sourceFile:entry.reconstruction?.sourceGlbFile,sourceGlbSha256:entry.assetSha256};
  return true;
}

export function prepareApprovedMotionActor(actor){
  const entry=actor?.userData?.approvedMotionTemplate;if(!entry)return null;
  const existing=actor.children.find(child=>child.userData.approvedMotionSource);if(existing)return existing;
  const source=new THREE.Group();source.name='Approved source motion coordinates';
  source.userData.approvedMotionSource=true;
  for(const child of [...actor.children])source.add(child);
  actor.add(source);
  // Basic V7 exports face -Z. Champion V8 and enemy V6 exports face +Z;
  // this inner conversion leaves the world's aim/position/scale authoritative.
  if(entry.kind!=='basic')source.rotation.y=Math.PI;
  source.scale.setScalar(entry.presentationScale);
  return source;
}
export function bindApprovedMotion(actor){
  if(actors.has(actor))return actors.get(actor);
  const entry=actor?.userData?.approvedMotionTemplate;if(!entry)return null;
  const source=prepareApprovedMotionActor(actor);
  actor.updateWorldMatrix(true,true);
  let runtimeRig=null;const helpers={createRig(...args){return runtimeRig=createRig(...args);}};
  const motion=entry.kind==='basic'?createBasicMotion(THREE,source,{...entry,rank:entry.tier}):
    entry.kind==='champion'?createChampionMotion(THREE,source,entry,helpers):
      createEnemyMotion(THREE,source,entry,helpers);
  if(!motion||!motion.channels?.length)throw new Error('No approved articulation for '+entry.id);
  const controller={actor,source,entry,motion,runtimeRig,clock:0,lastClock:null,lastFrame:-Infinity,
    elapsed:1,duration:1,stage:'idle',lastRelease:null,phase:0,disposed:false,anchors:new Map(),
    releasePhase:motion.releaseTime===null?.4:clamp(finite(motion.releaseTime,motion.duration*.4)/motion.duration)};
  actors.set(actor,controller);
  actor.userData.geometricRig=true;
  actor.userData.approvedMotionRevision=APPROVED_MOTION_REVISION;
  actor.userData.reconstructionRevision=entry.kind==='basic'?'basic-defenders-v7':entry.kind==='champion'?'champions-v8':'enemies-v6';
  actor.userData.id=entry.id;actor.userData.family=entry.family;actor.userData.tier=entry.tier;
  actor.userData.attackStyle=entry.attackStyle;actor.userData.sourceFile=entry.sourceFile;
  actor.userData.sourceGlbSha256=entry.sourceGlbSha256;
  actor.userData.bodyHeight=entry.height;actor.userData.integratedHeadInTorso=true;
  // Bind every literal part before batching. Dynamic surfaces are explicitly
  // excluded; compatible static siblings keep their original parent transform.
  source.userData.geometricRig=true;
  if(entry.kind==='basic')controller.skinnedBatching=batchPrivateSkinnedActor(source);
  controller.batching=optimizeGeometricSiblings(source);
  controller.ownedStaticGeometry=new Set();source.traverse(node=>{if(node.userData.geometricBatch&&node.geometry)controller.ownedStaticGeometry.add(node.geometry);});
  return controller;
}

export const approvedMotionController=actor=>actors.get(actor)||null;
export function disposeApprovedMotion(actor){
  const c=actors.get(actor);if(!c||c.disposed)return;
  const poses=enemyPoses.get(c.entry.poseGeneration);
  if(poses){for(const [mode,row]of poses)if(row.controller===c)poses.delete(mode);if(!poses.size)enemyPoses.delete(c.entry.poseGeneration);}
  c.skinnedBatching?.dispose();c.motion.dispose?.();for(const geometry of c.ownedStaticGeometry)geometry.dispose();c.ownedStaticGeometry.clear();c.disposed=true;actors.delete(actor);
}
function evaluate(c,phase,{idle=false,reducedMotion=false,melancholy=false}={}){
  if(reducedMotion){c.motion.reset();return;}
  c.runtimeRig?.beginUpdate();try{
    if(c.entry.kind==='basic')c.motion.update(c.clock,{mode:idle?'rest':'attack',phase});
    else c.motion.update(idle?c.clock:phase*c.motion.duration,{mode:idle?'idle':'attack',melancholy});
  }finally{c.runtimeRig?.endUpdate();}
  c.actor.updateWorldMatrix(true,true);
}
export function releaseApprovedAttack(c,payload={}){
  if(!c||c.disposed)return false;
  // Continuous dragon aura callbacks must not restart a simultaneous ordinary
  // weapon/elemental cast. Their approved breathing track already runs at idle.
  if(payload.breath)return false;
  const stamp=payload.combatTime;
  if(stamp!==undefined&&stamp===c.lastRelease)return false;
  c.lastRelease=stamp;c.stage='recovery';
  const rate=Math.max(.01,finite(payload.visualRate,1)),interval=finite(payload.stats?.interval,c.motion.duration);
  c.duration=Math.max(.001,Math.min(c.motion.duration,interval/rate*.9));
  c.elapsed=c.duration*c.releasePhase;c.phase=c.releasePhase;
  evaluate(c,c.phase,{reducedMotion:payload.reducedMotion});return true;
}
export function animateApprovedAttack(c,dt,time,context={}){
  if(!c||c.disposed)return;
  const delta=Math.max(0,finite(dt));if(!delta)return;
  c.clock+=delta;
  const blocked=context.blocked||context.combat===false;
  if(c.stage==='recovery'){
    if(context.stamp!==undefined&&context.stamp===c.lastRelease)return;
    c.elapsed=Math.min(c.duration,c.elapsed+delta);c.phase=c.elapsed/c.duration;
    if(c.elapsed>=c.duration)c.stage='idle';
  }else{
    const rate=Math.max(.01,finite(context.rate,1)),duration=Math.max(.001,Math.min(c.motion.duration,finite(context.interval,c.motion.duration)/rate*.9));
    const remaining=finite(context.cooldown,Infinity)/rate,preparation=duration*c.releasePhase;
    if(context.combat&&!blocked&&context.target&&remaining>0&&remaining<=preparation){
      c.duration=duration;c.elapsed=preparation-remaining;c.phase=c.elapsed/duration;c.stage='preparation';
    }else{c.stage='idle';c.phase=0;}
  }
  if(blocked&&c.stage==='preparation'){c.stage='idle';c.phase=0;}
  evaluate(c,c.phase,{idle:c.stage==='idle',reducedMotion:context.reducedMotion,melancholy:context.melancholy});
}
export function resetApprovedAttack(c){
  if(!c||c.disposed)return;c.stage='idle';c.phase=0;c.elapsed=c.duration;c.motion.reset();
}
export function sampleApprovedAttack(c,phase,options={}){
  if(!c||c.disposed)return;c.phase=clamp(phase);evaluate(c,c.phase,options);
}
export function animateApprovedEnemy(actor,enemy,time,{moving=true,reducedMotion=false}={}){
  const c=actors.get(actor)||bindApprovedMotion(actor);if(!c)return null;
  if(c.disposed||actor.userData.death)return 0;
  const clock=Math.max(0,finite(time));if(c.lastClock===clock)return 0;
  c.lastClock=clock;
  const blocked=enemy.dead||enemy.statuses?.freeze||enemy.statuses?.petrify;
  const running=['host_19','host_37','host_47'].includes(c.entry.id)||
    enemy.rush&&clock%ENEMY_RULES.rush.period<ENEMY_RULES.rush.duration;
  const mode=reducedMotion||blocked?'rest':enemy.flying?'fly':moving?(running?'run':'walk'):'idle';
  // Living enemy fields are pure functions of this decoded source, exact
  // combat clock, mode and fixed speed1. Defenders keep independent cooldowns.
  // Each mode holds just its current clock; buffers remain private to actors.
  // The owner may seek, change mode, reset or receive another copied pose.
  // Reuse requires its exact recorded revision, not merely a matching key.
  let poses=enemyPoses.get(c.entry.poseGeneration);if(!poses){poses=new Map();enemyPoses.set(c.entry.poseGeneration,poses);}
  const cached=poses.get(mode);
  if(!cached||cached.clock!==clock||cached.controller.disposed||cached.revision!==cached.controller.runtimeRig.poseRevision||!c.runtimeRig.copyPoseFrom(cached.controller.runtimeRig)){
    c.runtimeRig?.beginUpdate();try{c.motion.update(clock,{mode,speed:1});}finally{c.runtimeRig?.endUpdate();}
    poses.set(mode,{clock,controller:c,revision:c.runtimeRig.poseRevision});
  }
  actor.updateWorldMatrix(true,true);return 0;
}

const labels=node=>{const names=[node.name];for(let p=node;p;p=p.parent){if(p.userData?.name)names.push(p.userData.name);if(p.userData?.semanticPart)names.push(p.userData.semanticPart);}return names.join(' ').replace(/_/g,' ');};
const ANCHOR_PARTS={mouth:/mandible|lower.*jaw|mouth|beak/i,nock:/bowstring|string.*nock|drawn.*string/i,
  staff:/staff|stave|scepter|sceptre|focus|lightning.*right.hand|Weapon.*(?:shaft|crystal|orb)/i,
  hand:/(?:hand.*right|right.*hand).*(?:palm|cup|fingers)|right.*(?:palm|fist)/i,
  fist:/fist|right.*palm|hand.*right/i,eye:/eye.*(?:right|left)|luminous.*eye/i,
  weapon:/sword.*(?:blade|point)|spear.*point|lance.*point|arrow.*head|bolt.*head|barrel|cannon|bomb|loaded stone|staff|stave|weapon|hammer|mallet/i};
function makeAnchor(c,kind){
  const candidates=[];c.source.updateWorldMatrix(true,true);
  const pattern=kind==='hand'&&['tempest','stormcitadel'].includes(c.entry.id)?/LEFT.casting.arm.hand/i:
    c.entry.id==='mechanicalgolem'&&['weapon','staff','fist'].includes(kind)?/Dwarship.*RIGHT.*bomb.support.*palm/i:
    c.entry.id==='rangermentor'?/Nature.Spirit.*green.energy.core/i:ANCHOR_PARTS[kind];
  c.source.traverse(node=>{if(node.isMesh&&pattern.test(labels(node)))candidates.push(node);});
  if(!candidates.length&&kind!=='weapon')return makeAnchor(c,'weapon');
  if(!candidates.length)return null;
  const point=new THREE.Vector3(),box=new THREE.Box3(),samples=[];
  for(const mesh of candidates){
    const attr=mesh.geometry.getAttribute('position');mesh.skeleton?.update();
    for(let i=0;i<attr.count;i++){
      mesh.getVertexPosition(i,point);point.applyMatrix4(mesh.matrixWorld);c.source.worldToLocal(point);
      box.expandByPoint(point);samples.push({mesh,index:i,x:point.x,y:point.y,z:point.z});
    }
  }
  const centre=box.getCenter(new THREE.Vector3());let best=null,score=-Infinity;
  for(const s of samples){
    // The real string centre is the nock. Staff heads are their upper end;
    // other weapons and jaws use the original source's forward-most surface.
    const value=kind==='nock'?-((s.x-centre.x)**2+(s.y-centre.y)**2+(s.z-centre.z)**2):
      kind==='staff'&&c.entry.id!=='mechanicalgolem'?s.y:kind==='mouth'?s.z-Math.abs(s.x-centre.x)*.5:(c.entry.kind==='basic'?-s.z:s.z)+(s.y-box.min.y)*.08;
    if(value>score){score=value;best=s;}
  }
  return best;
}
/** Read the actual posed surface; no bounding-box work occurs per frame. */
export function approvedMotionAnchor(actor,out=new THREE.Vector3(),{kind='weapon',breath=false}={}){
  const c=actors.get(actor);if(!c||c.disposed)return null;
  const key=breath?'mouth':Object.hasOwn(ANCHOR_PARTS,kind)?kind:'weapon';
  if(!c.anchors.has(key))c.anchors.set(key,makeAnchor(c,key));
  const anchor=c.anchors.get(key);if(!anchor)return null;
  actor.updateWorldMatrix(true,true);anchor.mesh.skeleton?.update();
  anchor.mesh.getVertexPosition(anchor.index,out);return out.applyMatrix4(anchor.mesh.matrixWorld);
}
