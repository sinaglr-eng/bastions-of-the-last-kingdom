import * as THREE from 'three';

// The exported rest pose is authoritative. These rigid joints carry complete
// physical parts (including every layer of a hood/helmet) rather than deforming
// shared vertex buffers. The actor keeps its world position, aim and scale.
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const smooth=value=>{value=clamp(value,0,1);return value*value*(3-2*value);};
const TAU=Math.PI*2;
const JOINT=/^(torso_pivot|head_pivot|upper_arm_[RL]|forearm_[RL]|hand_[RL]|upper_leg_(?:[RL]|[FB][RL])|shin_(?:[RL]|[FB][RL])|foot_(?:[RL]|[FB][RL])|wing_[RL]|tail_pivot|jaw_pivot|mouth_pivot)$/;

export function geometricMetadata(actor){
  let metadata=null;
  actor?.traverse(node=>{if(!metadata&&node.userData.geometricRig)metadata=node.userData;});
  return metadata;
}
export function createGeometricMotionRig(figure){
  const body=figure?.userData.body||figure,metadata=geometricMetadata(body);
  if(!metadata)return null;
  const joints=new Map();
  body.traverse(node=>{if(JOINT.test(node.name)&&!node.isMesh)joints.set(node.name,{node,position:node.position.clone(),rotation:node.rotation.clone(),scale:node.scale.clone()});});
  const locomotion=metadata.locomotion||'biped';
  const rig={figure,body,metadata,locomotion,joints,bodyRest:{position:body.position.clone(),rotation:body.rotation.clone(),scale:body.scale.clone()},phase:finite(figure.userData.phase,0),clock:null,traveled:null,dead:false,footTarget:new THREE.Vector3(),footCurrent:new THREE.Vector3(),parentFromBody:new THREE.Matrix4(),worldScale:new THREE.Vector3()};
  const legs=locomotion==='quadruped'||locomotion==='flying'&&joints.has('upper_leg_FL')?['FL','FR','BL','BR']:['L','R'];
  rig.legs=legs.map(side=>{
    const hip=joints.get('upper_leg_'+side),knee=joints.get('shin_'+side),foot=joints.get('foot_'+side);
    const l1=knee?Math.hypot(knee.position.y,knee.position.z):0,l2=foot?Math.hypot(foot.position.y,foot.position.z):0;
    // Only opt into two-link IK when the hierarchy and authored axes agree.
    // Small stone creatures have a valid 22 mm thigh. Reject degenerate
    // links using a numerical epsilon, without imposing humanoid dimensions.
    const ik=!!(hip&&knee&&foot&&knee.node.parent===hip.node&&foot.node.parent===knee.node&&l1>.002&&l2>.002&&knee.position.y<0&&foot.position.y<0);
    const upperAngle=knee?Math.atan2(-knee.position.z,-knee.position.y):0,lowerAngle=foot?Math.atan2(-foot.position.z,-foot.position.y):0;
    // Crouched front and rear paws bend in opposite directions. Preserve the
    // authored branch instead of rejecting its slanted shin or inverting it.
    const bendSign=Math.abs(lowerAngle-upperAngle)>.02?Math.sign(lowerAngle-upperAngle):1;
    body.updateWorldMatrix(true,true);
    const restFoot=foot?body.worldToLocal(foot.node.getWorldPosition(new THREE.Vector3())):null;
    return {side,hip,knee,foot,l1,l2,ik,upperAngle,lowerAngle,bendSign,restFoot,restY:(knee?.position.y||0)+(foot?.position.y||0),restZ:(knee?.position.z||0)+(foot?.position.z||0)};
  }).filter(leg=>leg.hip);
  return rig;
}
export function resetGeometricMotion(rig){
  if(!rig)return;
  const {body,bodyRest}=rig;
  body.position.copy(bodyRest.position);body.rotation.copy(bodyRest.rotation);body.scale.copy(bodyRest.scale);
  for(const joint of rig.joints.values()){joint.node.position.copy(joint.position);joint.node.rotation.copy(joint.rotation);joint.node.scale.copy(joint.scale);}
}
function rotate(rig,name,x=0,y=0,z=0){
  const joint=rig.joints.get(name);if(!joint)return;
  joint.node.rotation.set(joint.rotation.x+x,joint.rotation.y+y,joint.rotation.z+z,joint.rotation.order);
}
function solveLeg(leg,phase,stride,lift){
  const cycle=((phase/TAU)%1+1)%1,stance=.62;
  const swinging=cycle>=stance,p=swinging?(cycle-stance)/(1-stance):cycle/stance;
  // Phase completes one cycle per stride of world travel. During the 62%
  // support interval the ankle therefore sweeps 62% of that distance locally,
  // cancelling actor translation exactly; a full-stride sweep would skid.
  const sweep=stride*stance;
  const z=leg.restZ+(swinging?THREE.MathUtils.lerp(sweep/2,-sweep/2,smooth(p)):THREE.MathUtils.lerp(-sweep/2,sweep/2,p));
  const length=leg.l1+leg.l2,maximumReach=length-.0001,supportReach=Math.min(-leg.restY,Math.sqrt(Math.max(0,maximumReach*maximumReach-z*z)));
  // Lower the hip only when this actual ankle target exceeds the two links'
  // reach. Planning that drop for the furthest future step alters the native
  // crouch even at stance centre, where its authored target already fits.
  // The foot target remains fixed while the hip supplies needed clearance.
  leg.hip.node.position.y=leg.hip.position.y-(-leg.restY-supportReach);
  const y=-supportReach+(swinging?Math.sin(p*Math.PI)*lift:0);
  const r=clamp(Math.hypot(y,z),Math.abs(leg.l1-leg.l2)+.0001,leg.l1+leg.l2-.0001);
  const heading=Math.atan2(-z,-y),hipAngle=Math.acos(clamp((leg.l1*leg.l1+r*r-leg.l2*leg.l2)/(2*leg.l1*r),-1,1));
  const kneeAngle=Math.PI-Math.acos(clamp((leg.l1*leg.l1+leg.l2*leg.l2-r*r)/(2*leg.l1*leg.l2),-1,1));
  const hipDelta=heading-leg.bendSign*hipAngle-leg.upperAngle,kneeDelta=leg.bendSign*kneeAngle+leg.upperAngle-leg.lowerAngle;
  leg.hip.node.rotation.x=leg.hip.rotation.x+hipDelta;
  leg.knee.node.rotation.x=leg.knee.rotation.x+kneeDelta;
  // The sole stays level during support, then the toe clears the ground.
  leg.foot.node.rotation.x=leg.foot.rotation.x-(hipDelta+kneeDelta)+(swinging?.20*Math.sin(Math.PI*p):0);
  return {z:z-leg.restZ,y:swinging?Math.sin(p*Math.PI)*lift:0};
}

function retainFootTarget(rig,leg,offset){
  if(!leg.restFoot||!offset)return;
  // New creatures attach their legs to the moving torso, whereas a rider's
  // mount legs attach to its own torso. Preserve the real sole target after
  // either parent hierarchy's sway; otherwise correctly solved ankles skid.
  const parent=leg.hip.node.parent,transform=rig.parentFromBody.identity();
  // Solve inside the body hierarchy. A world-to-local round trip depends on
  // the actor's previous bob height at machine precision, so even a paused
  // frame can otherwise change its pose despite identical motion inputs.
  for(let node=parent;node&&node!==rig.body;node=node.parent){node.updateMatrix();transform.premultiply(node.matrix);}
  const desired=rig.footTarget.copy(leg.restFoot);desired.y+=offset.y;desired.z+=offset.z;desired.applyMatrix4(transform.invert());
  leg.knee.node.updateMatrix();leg.hip.node.updateMatrix();
  const current=rig.footCurrent.copy(leg.foot.node.position).applyMatrix4(leg.knee.node.matrix).applyMatrix4(leg.hip.node.matrix);
  leg.hip.node.position.add(desired.sub(current));
}

export function animateGeometricEnemyMotion(figure,enemy,time,{moving=true,reducedMotion=false}={}){
  if(!Object.hasOwn(figure.userData,'geometricMotion'))figure.userData.geometricMotion=createGeometricMotionRig(figure);
  const rig=figure.userData.geometricMotion;if(!rig)return null;
  if(rig.dead||figure.userData.death)return 0;
  const clock=Math.max(0,finite(time)),previous=rig.clock;
  const dt=previous===null?0:clamp(clock-previous,0,.5);rig.clock=clock;
  const traveled=Math.max(0,finite(enemy.traveled)),previousDistance=rig.traveled;rig.traveled=traveled;
  const active=moving&&!enemy.dead&&!enemy.statuses?.freeze&&!enemy.statuses?.petrify;
  const flying=typeof enemy.flying==='boolean'?enemy.flying:rig.locomotion==='flying';
  const locomotion=rig.locomotion==='flying'&&!flying?(rig.legs.length===4?'quadruped':'biped'):rig.locomotion;
  const height=Math.max(.3,finite(rig.metadata.bodyHeight,finite(rig.metadata.bodyHeightMeters,1.8)));
  const legReach=rig.legs.filter(leg=>leg.ik).map(leg=>leg.l1+leg.l2),naturalStride=legReach.length?Math.min(height*.26,Math.min(...legReach)*.85):height*.26;
  const stride=clamp(finite(rig.metadata.strideLength,naturalStride),.15,1.8);
  const worldStride=stride*Math.max(1e-8,rig.body.getWorldScale(rig.worldScale).y);
  let distance=previousDistance===null?0:Math.max(0,traveled-previousDistance);
  // A blink contributes to combat traveled distance, but cannot cycle the legs
  // through a kilometre of walking in one visual frame.
  const speed=Math.max(0,finite(enemy.speed,1));
  if(distance>Math.max(worldStride,dt*speed*3))distance=0;
  if(active&&!reducedMotion)rig.phase+=distance/worldStride*TAU;
  const phase=rig.phase+finite(enemy.id)*.91;
  resetGeometricMotion(rig);
  if(reducedMotion)return 0;
  if(flying&&(enemy.statuses?.freeze||enemy.statuses?.petrify))return 0;
  if(flying){
    const archetype=enemy.designArchetype||'',wyvern=archetype.includes('wyvern')||enemy.model==='dragon',manta=archetype.includes('manta');
    if(archetype==='wing-scrapper'||rig.metadata.sourceFile==='enemies/host_28.png'){
      // This source is a rigid winged engine, not a bat. Its metal wings stay
      // fixed while the complete vehicle banks and pitches gently in flight.
      rig.body.rotation.x=rig.bodyRest.rotation.x+Math.cos(clock*2.1)*.012;
      rig.body.rotation.z=rig.bodyRest.rotation.z+Math.sin(clock*1.6+finite(enemy.id))*.035;
      return Math.sin(clock*2.1+finite(enemy.id))*.045;
    }
    const frequency=wyvern?3.4:manta?4.1:archetype==='iron-bat'?5.2:9,stroke=Math.sin(clock*frequency+finite(enemy.id)*1.618);
    const amplitude=wyvern?.36:manta?.29:archetype==='iron-bat'?.50:.68;
    rotate(rig,'wing_L',0,0,-stroke*amplitude);rotate(rig,'wing_R',0,0,stroke*amplitude);
    rotate(rig,'torso_pivot',Math.cos(clock*frequency)*.022,0,Math.sin(clock*2)*.025);
    for(const leg of rig.legs){rotate(rig,'upper_leg_'+leg.side,.12+Math.sin(clock*2.4)*.06);rotate(rig,'shin_'+leg.side,.35);}
    rotate(rig,'tail_pivot',0,Math.sin(clock*2.3)*.13,0);
    return Math.sin(clock*frequency+finite(enemy.id)*1.618)*.075;
  }
  const footTargets=[];
  if(active){
    for(const leg of rig.legs){
      const offset=locomotion==='quadruped'?(['FL','BR'].includes(leg.side)?0:Math.PI):leg.side==='L'?0:Math.PI;
      if(leg.ik)footTargets.push({leg,offset:solveLeg(leg,phase+offset,stride,height*.055)});
      else{rotate(rig,'upper_leg_'+leg.side,Math.sin(phase+offset)*.36);rotate(rig,'shin_'+leg.side,Math.max(0,Math.sin(phase+offset-.45))*.48);rotate(rig,'foot_'+leg.side,-Math.sin(phase+offset)*.14);}
    }
    if(locomotion==='serpent'){rotate(rig,'torso_pivot',0,Math.sin(phase)*.17,0);rotate(rig,'tail_pivot',0,-Math.sin(phase+.6)*.35,0);}
    else{rotate(rig,'upper_arm_L',-Math.sin(phase)*.21,0,.025);rotate(rig,'upper_arm_R',Math.sin(phase)*.21,0,-.025);rotate(rig,'torso_pivot',0,Math.sin(phase)*.035,Math.sin(phase)*.015);if(!rig.metadata.integratedHeadInTorso)rotate(rig,'head_pivot',0,-Math.sin(phase)*.025,0);}
  }else if(!enemy.statuses?.freeze&&!enemy.statuses?.petrify){
    const breathe=Math.sin(clock*2.1+finite(enemy.id))*.012;
    const torso=rig.joints.get('torso_pivot');if(torso)torso.node.scale.y=torso.scale.y*(1+breathe*.35);
  }
  if(enemy.hit>0)rotate(rig,'torso_pivot',0,0,.07);
  for(const target of footTargets)retainFootTarget(rig,target.leg,target.offset);
  // Grounded support IK already retains each planted foot in world space.
  // Moving the whole root vertically afterwards would lift that support foot.
  return 0;
}

// Shared geometry is never disposed or recolored by death. Terrain contact is
// measured in the actual falling pose, including wings, weapons and actor scale.
export function beginGroundedDeath(root,enemy={}){
  const body=root.userData.body;if(!body||root.userData.death)return root;
  const rig=root.userData.geometricMotion; if(rig)rig.dead=true;
  for(const name of ['bar','aura','shards'])if(root.userData[name])root.userData[name].visible=false;
  const nodes=new Set([...(root.userData.limbs||[]),...(root.userData.wings||[]),...(rig?[...rig.joints.values()].map(j=>j.node):[])]);
  const pose=[...nodes].map(node=>({node,rotation:node.rotation.clone(),target:node.rotation.clone()}));
  for(const entry of pose){
    const rest=rig?.joints.get(entry.node.name)?.rotation;
    if(rest)entry.target.copy(rest);
    if(entry.node.name.startsWith('wing_'))entry.target.z+=(entry.node.name.endsWith('L')?-.45:.45);
    if(entry.node.name.startsWith('shin_'))entry.target.x+=.38;
  }
  const startRotation=body.rotation.clone(),endRotation=startRotation.clone();
  if(rig&&['quadruped','crawler','serpent'].includes(rig.locomotion))endRotation.z+=(finite(enemy.id)%2?1:-1)*Math.PI/2;
  else endRotation.x=-Math.PI/2;
  root.userData.death={elapsed:0,duration:enemy.flying?.95:.65,initialY:root.position.y,groundY:finite(root.userData.groundY,0),body,startRotation,endRotation,pose,bounds:new THREE.Box3(),settled:false};
  return root;
}
export function animateGroundedDeath(root,dt){
  const death=root.userData.death;if(!death||death.settled)return;
  death.elapsed=Math.min(death.duration,death.elapsed+Math.max(0,finite(dt)));
  const p=death.elapsed/death.duration,ease=1-Math.pow(1-p,3);
  const {body,startRotation,endRotation}=death;
  body.rotation.set(THREE.MathUtils.lerp(startRotation.x,endRotation.x,ease),THREE.MathUtils.lerp(startRotation.y,endRotation.y,ease),THREE.MathUtils.lerp(startRotation.z,endRotation.z,ease),startRotation.order);
  for(const entry of death.pose)entry.node.rotation.set(THREE.MathUtils.lerp(entry.rotation.x,entry.target.x,ease),THREE.MathUtils.lerp(entry.rotation.y,entry.target.y,ease),THREE.MathUtils.lerp(entry.rotation.z,entry.target.z,ease),entry.rotation.order);
  root.position.y=THREE.MathUtils.lerp(death.initialY,death.groundY,ease)+(p<1?Math.sin(p*Math.PI)*.07:0);
  root.updateMatrixWorld(true);death.bounds.setFromObject(body,true);
  if(!death.bounds.isEmpty())root.position.y+=Math.max(0,death.groundY+.025-death.bounds.min.y);
  root.updateMatrixWorld(true);
  if(p>=1){death.settled=true;death.lift=root.position.y;}
}
