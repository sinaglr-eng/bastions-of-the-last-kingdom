import * as THREE from 'three';
import {attackVisualKind} from './combat-effects.js';
import {createSecretAnimation,releaseSecretAttack,updateSecretAnimation,resetSecretAnimation,disposeSecretAnimation} from './secret-animation.js';
import {geometricMetadata,beginGroundedDeath,animateGroundedDeath} from './geometric-motion.js';

const CLAN_AURAS=['#c85e43','#77bfd5','#93be69','#b287d3','#e2bb67'];
export function bossAura(clan=0){
  const root=new THREE.Group();root.name='Warlord aura';
  const color=CLAN_AURAS[clan]||CLAN_AURAS[0];
  const veil=new THREE.Mesh(new THREE.PlaneGeometry(2.8,2.8),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{color:{value:new THREE.Color(color)},time:{value:0}},vertexShader:'varying vec2 uvAura; void main(){uvAura=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 uvAura; uniform vec3 color; uniform float time; void main(){float r=length(uvAura-.5)*2.;float glow=(1.-smoothstep(.2,1.,r))*.18;float wave=exp(-pow((r-mod(time*.22,1.))/.055,2.))*.15*(1.-r);gl_FragColor=vec4(color,glow+wave);}' }));
  veil.rotation.x=-Math.PI/2;veil.position.y=.14;root.add(veil);
  for(let i=0;i<2;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.85+i*.18,.035,6,56),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false}));ring.rotation.x=Math.PI/2;ring.position.y=.16+i*.03;root.add(ring);}
  const motes=new THREE.Group();motes.name='Warlord embers';root.add(motes);
  for(let i=0;i<12;i++){const spark=new THREE.Mesh(new THREE.OctahedronGeometry(.065),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false}));spark.userData.angle=i*Math.PI/6;spark.userData.height=i*.22;motes.add(spark);}
  return root;
}
export function animateBossAura(root,time){
  root.children[0].material.uniforms.time.value=time;
  root.children.slice(1,3).forEach((ring,i)=>{ring.scale.setScalar(1+Math.sin(time*1.4+i)*.055);ring.material.opacity=.68+Math.sin(time*1.6+i)*.12;});
  const motes=root.getObjectByName('Warlord embers');motes.rotation.y=-time*.25;
  for(const spark of motes.children){const y=(spark.userData.height+time*.35)%2.8,a=spark.userData.angle;spark.position.set(Math.cos(a)*(.6+y*.08),y,Math.sin(a)*(.6+y*.08));spark.material.opacity=Math.sin(y/2.8*Math.PI)*.6;}
}

// The same detailed figure falls, then rests on the terrain until the round ends.
export function beginDeath(root,enemy){
  return beginGroundedDeath(root,enemy);
}
export function animateDeath(root,dt){
  animateGroundedDeath(root,dt);
}

export function siegeRig(actor){
  const arm=actor.getObjectByName('siege_arm');
  return arm?{arm,restX:arm.rotation.x,elapsed:1,duration:.65}:null;
}
export function animateSiege(rig,dt){
  if(!rig)return;rig.elapsed=Math.min(rig.duration,rig.elapsed+dt);
  const p=rig.elapsed/rig.duration;
  // Fast release of the counterweight, followed by a slower winch reset.
  const swing=p<.2?Math.sin(p/.2*Math.PI/2):Math.pow(1-(p-.2)/.8,2);
  rig.arm.rotation.x=rig.restX-swing*.85;
}

// Authored rigid joints carry the real arms, gloves and held weapons. Cached
// GLB geometry/materials stay untouched; only this actor's local joints move.
const ATTACK_POSES={
  melee:{x:-.15,z:.23,duration:.44},arrow:{x:-.065,z:.085,duration:.48},
  roots:{x:.065,z:-.11,duration:.42},flame:{x:-.12,z:.025,duration:.52},
  lightning:{x:.055,z:-.10,duration:.30},siege:{x:-.038,z:0,duration:.33},
  holy:{x:.025,z:-.06,duration:.35},frost:{x:.055,z:-.075,duration:.33},
  arcane:{x:.06,z:-.11,duration:.32},
  runic:{x:-.085,z:.035,duration:.44},stone:{x:-.065,z:0,duration:.42},
  dart:{x:-.015,z:0,duration:.28},venomArrow:{x:-.065,z:.085,duration:.48},
  hammer:{x:-.085,z:.035,duration:.44},
};
const JOINT_NAMES=['torso_pivot','head_pivot','upper_arm_L','upper_arm_R','forearm_L','forearm_R','hand_L','hand_R','weapon_L','weapon_R','bow_pivot','weapon_pivot','crossbow_nock','siege_arm','attack_arm','bow_arm','dragon_jaw','jaw_pivot','mouth_pivot','left_wing_pivot','right_wing_pivot','wing_L','wing_R'];
const SPELL_KINDS=new Set(['arcane','holy','frost','roots','lightning']);
const smooth=p=>{p=THREE.MathUtils.clamp(p,0,1);return p*p*(3-2*p);};
const noPick=()=>{};
function bindRigidArms(rig){
  const arms={};for(const side of ['R','L']){
    const shoulder=rig.joints.get('upper_arm_'+side),elbow=rig.joints.get('forearm_'+side),hand=rig.joints.get('hand_'+side);
    if(!shoulder||!elbow||!hand)continue;
    rig.actor.updateWorldMatrix(true,true);
    arms[side]={shoulder,elbow,hand,restTarget:rig.actor.worldToLocal(hand.node.getWorldPosition(new THREE.Vector3())),restElbow:rig.actor.worldToLocal(elbow.node.getWorldPosition(new THREE.Vector3())),handOrientation:rig.actor.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(hand.node.getWorldQuaternion(new THREE.Quaternion())),reach:shoulder.node.getWorldPosition(new THREE.Vector3()).distanceTo(elbow.node.getWorldPosition(new THREE.Vector3()))+elbow.node.getWorldPosition(new THREE.Vector3()).distanceTo(hand.node.getWorldPosition(new THREE.Vector3()))};
  }
  return arms.R&&arms.L?arms:null;
}
export function attackRig(actor,family,stats={}){
  if(!actor)return null;
  const kind=attackVisualKind(family,stats),pose=ATTACK_POSES[kind],pivots=[];
  for(const name of JOINT_NAMES){
    const node=actor.getObjectByName(name);
    if(node)pivots.push({node,name,rotation:node.rotation.clone(),position:node.position.clone()});
  }
  const rig={actor,family,kind,pose,pivots,joints:new Map(pivots.map(p=>[p.name,p])),restX:actor.rotation.x,restZ:actor.rotation.z,elapsed:pose.duration,duration:pose.duration,active:false,owned:[],disposed:false};
  rig.geometric=geometricMetadata(actor);rig.attackStyle=rig.geometric?.attackStyle;rig.stage='idle';rig.lastRelease=null;
  const shoulder=rig.joints.get('upper_arm_R')?.node,hand=rig.joints.get('hand_R')?.node;
  if(shoulder&&hand){actor.updateMatrixWorld(true);const reach=shoulder.worldToLocal(hand.getWorldPosition(new THREE.Vector3()));rig.forwardArmLift=THREE.MathUtils.clamp(1.32-Math.atan2(-reach.z,-reach.y),0,1.2);}
  rig.native=createSecretAnimation(actor,family);
  let heldMuzzle=null;const heldWeapon=actor.getObjectByName('weapon_R');
  heldWeapon?.traverse(node=>{if(!heldMuzzle&&/^attack_muzzle(?:_?\d+)?$/.test(node.name))heldMuzzle=node;});
  rig.muzzle=(family==='lordbernhard'?actor.getObjectByName('sword_tip'):kind==='flame'?actor.getObjectByName('attack_muzzle'):actor.getObjectByName('staff_tip')||heldMuzzle)||actor.getObjectByName('attack_muzzle')||null;
  rig.breathMuzzle=actor.getObjectByName('attack_muzzle')||rig.muzzle;
  rig.breathTrack={active:false,elapsed:ATTACK_POSES.flame.duration,duration:ATTACK_POSES.flame.duration,lastRelease:null};
  const tip=['ladyclaire','lordbernhard'].includes(family)?rig.muzzle:actor.getObjectByName('staff_tip');
  if(tip&&SPELL_KINDS.has(kind)){
    const color=['ladyclaire','lordbernhard'].includes(family)?'#ffdc78':kind==='holy'?'#ffe7a3':kind==='roots'?'#9bdd67':kind==='frost'?'#a4efff':kind==='lightning'?'#b1ddff':'#cb9fff';
    const glow=new THREE.Group();glow.name='Charging staff focus';glow.visible=false;tip.add(glow);
    glow.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.095,1),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false})),new THREE.Mesh(new THREE.TorusGeometry(.14,.012,4,20),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false})));
    glow.traverse(node=>node.raycast=noPick);rig.glow=glow;rig.owned.push(glow);
  }
  const crossbow=rig.attackStyle==='crossbow'&&rig.geometric?.crossbowGripContract==='rear-trigger-front-support-v3';
  let top=actor.getObjectByName(crossbow?'crossbow_string_left':'bow_tip_upper')||(!crossbow&&actor.getObjectByName('bow_string_top')),bottom=actor.getObjectByName(crossbow?'crossbow_string_right':'bow_tip_lower')||(!crossbow&&actor.getObjectByName('bow_string_bottom')),nock=actor.getObjectByName(crossbow?'crossbow_nock':'bow_nock');
  const namedStrings=[];actor.traverse(node=>{if(!node.isLine&&(/bow_?string/i.test(node.name)||crossbow&&/crossbow.*string/i.test(node.name)))namedStrings.push(node);});
  const physicalStrings=namedStrings.filter(node=>node.isMesh);
  if(rig.attackStyle==='bow'&&physicalStrings.length&&!top){
    // Champion exports have a real string mesh, but no semantic endpoints.
    // Derive its two ends without changing any authored vertex buffer.
    const original=physicalStrings[0],bounds=new THREE.Box3().setFromObject(original,true),centre=bounds.getCenter(new THREE.Vector3()),parent=original.parent;
    const endpoint=(name,point)=>{const node=new THREE.Group();node.name=name;node.position.copy(parent.worldToLocal(point));parent.add(node);rig.owned.push(node);return node;};
    top=endpoint('runtime_bow_tip_upper',new THREE.Vector3(centre.x,bounds.max.y,centre.z));bottom=endpoint('runtime_bow_tip_lower',new THREE.Vector3(centre.x,bounds.min.y,centre.z));nock=endpoint('runtime_bow_nock',centre.clone());
  }
  if(top&&bottom&&nock){
    let restStraight=false;actor.traverse(node=>{if(node.userData.bowRestPose==='lowered-hand')restStraight=true;});
    const handR=actor.getObjectByName('hand_R'),handL=actor.getObjectByName('hand_L');
    if(rig.geometric&&handR&&handL){
      const arms=bindRigidArms(rig);
      if(arms&&crossbow){rig.crossbowArms=arms;rig.crossbowForegrip=actor.getObjectByName('crossbow_foregrip');}
      else if(arms){rig.bowArms=arms;restStraight=true;}
    }
    rig.authoredStrings=namedStrings.map(node=>({node,visible:node.visible}));for(const entry of rig.authoredStrings)entry.node.visible=false;
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3));
    const string=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#eee3c9',depthWrite:false,toneMapped:false}));string.name='Articulated taut bowstring';string.raycast=noPick;string.frustumCulled=false;actor.add(string);
    rig.string={object:string,top,bottom,nock:rig.bowArms?handR:nock,authoredNock:nock,restStraight,draw:0,point:new THREE.Vector3(),topPoint:new THREE.Vector3(),bottomPoint:new THREE.Vector3(),nockPoint:new THREE.Vector3()};rig.owned.push(string);updateBowString(rig);
  }
  return rig;
}
function updateBowString(rig){
  if(!rig.string)return;
  const {object,top,bottom,nock,point,topPoint,bottomPoint,nockPoint,restStraight,draw}=rig.string,positions=object.geometry.attributes.position;rig.actor.updateMatrixWorld(true);
  rig.actor.worldToLocal(top.getWorldPosition(topPoint));rig.actor.worldToLocal(bottom.getWorldPosition(bottomPoint));
  rig.actor.worldToLocal(nock.getWorldPosition(point));nockPoint.copy(point);
  // A lowered free hand in the neutral turnaround pose has not yet caught the
  // string. Draw/release blends onto that hand's real moving nock. Historical
  // drawn poses and champion archers keep their existing nock-linked string.
  if(restStraight)nockPoint.lerpVectors(topPoint,bottomPoint,.5).lerp(point,draw);
  [topPoint,nockPoint,bottomPoint,nockPoint].forEach((p,i)=>positions.setXYZ(i,p.x,p.y,p.z));positions.needsUpdate=true;
}
export function attackMuzzle(rig,out=new THREE.Vector3(),{breath=false}={}){
  const muzzle=breath?rig?.breathMuzzle:rig?.muzzle;
  if(!rig||rig.disposed||!muzzle)return null;
  rig.actor.updateMatrixWorld(true);return muzzle.getWorldPosition(out);
}
export function triggerAttack(rig,payload={}){
  if(!rig||rig.disposed)return;
  if(rig.native){releaseSecretAttack(rig.native,{interval:payload.stats?.interval,rate:payload.visualRate,stamp:payload.combatTime,reducedMotion:payload.reducedMotion});rig.active=true;return;}
  if(rig.geometric){
    const breath=!!payload.breath;
    if(breath){
      const track=rig.breathTrack;if(payload.combatTime!==undefined&&track.lastRelease===payload.combatTime)return;
      track.lastRelease=payload.combatTime;track.duration=ATTACK_POSES.flame.duration;track.elapsed=track.duration*.42;track.active=true;
      // Aura fire and the rider's weapon are independent abilities. Opening
      // the mount's jaw must not restart the arm preparation/release/recovery.
      applyBreath(rig,payload.reducedMotion);return;
    }
    if(payload.combatTime!==undefined&&payload.combatTime===rig.lastRelease)return;
    rig.lastRelease=payload.combatTime;rig.stage='recovery';
    const interval=payload.stats?.interval,rate=Number.isFinite(payload.visualRate)?Math.max(.01,payload.visualRate):1;
    const poseDuration=rig.pose.duration;
    rig.duration=Math.max(.001,Math.min(poseDuration,Number.isFinite(interval)&&interval>0?interval/rate*.90:poseDuration));
    rig.elapsed=rig.duration*.42;rig.active=true;
    // The projectile event sees the actual release pose and moving muzzle.
    animateAttack(rig,0,0,{reducedMotion:payload.reducedMotion});return;
  }
  // Simultaneous multishot callbacks describe one release pose.
  if(rig.active&&rig.elapsed<.025)return;
  const interval=payload.stats?.interval;
  rig.duration=Math.min(rig.pose.duration,Number.isFinite(interval)&&interval>0?Math.max(.12,interval*.8):rig.pose.duration);
  rig.elapsed=0;rig.active=true;
}
const handAdvanceOrigin=new THREE.Vector3(),handAdvancePoint=new THREE.Vector3();
function applyBreath(rig,reducedMotion=false){
  const track=rig.breathTrack;if(!track)return;
  const p=track.duration>0?track.elapsed/track.duration:1,stroke=reducedMotion||!track.active?0:Math.sin(Math.PI*p)*Math.pow(Math.max(0,1-(p-.42)/.58),.4);
  for(const name of ['dragon_jaw','jaw_pivot','mouth_pivot']){
    const pivot=rig.joints.get(name);if(!pivot)continue;
    if(track.active||rig.kind!=='flame'||!rig.active)pivot.node.rotation.copy(pivot.rotation);
    if(track.active)pivot.node.rotation.x-=.36*stroke;
  }
}
function advanceJoint(rig,name,distance){
  const joint=rig.joints.get(name)?.node;if(!joint?.parent)return;
  // Advance along the character's front, not the already-bent elbow's local
  // Z axis (which otherwise sends an authored raised lance upwards).
  rig.actor.updateMatrixWorld(true);
  joint.parent.worldToLocal(rig.actor.localToWorld(handAdvanceOrigin.set(0,0,0)));
  joint.parent.worldToLocal(rig.actor.localToWorld(handAdvancePoint.set(0,0,-distance)));
  joint.position.add(handAdvancePoint.sub(handAdvanceOrigin));
}
function advanceHand(rig,distance){advanceJoint(rig,'hand_R',distance);}
function solveBowArm(rig,side,target,arms=rig.bowArms){
  const arm=arms[side],{shoulder,elbow,hand}=arm;
  rig.actor.updateMatrixWorld(true);
  const origin=shoulder.node.getWorldPosition(new THREE.Vector3()),end=rig.actor.localToWorld(target.clone()),elbowRest=elbow.node.getWorldPosition(new THREE.Vector3()),handRest=hand.node.getWorldPosition(new THREE.Vector3());
  const l1=origin.distanceTo(elbowRest),l2=elbowRest.distanceTo(handRest),delta=end.clone().sub(origin),r=THREE.MathUtils.clamp(delta.length(),Math.abs(l1-l2)+.0001,l1+l2-.0001),direction=delta.normalize();
  const normal=arms===rig.crossbowArms?rig.actor.localToWorld(arm.restElbow.clone()).sub(origin):rig.actor.localToWorld(new THREE.Vector3(0,-1,0)).sub(rig.actor.getWorldPosition(new THREE.Vector3()));normal.addScaledVector(direction,-normal.dot(direction)).normalize();
  const along=(l1*l1-l2*l2+r*r)/(2*r),height=Math.sqrt(Math.max(0,l1*l1-along*along)),bend=origin.clone().addScaledVector(direction,along).addScaledVector(normal,height);
  const upperDirection=shoulder.node.parent.worldToLocal(bend.clone()).sub(shoulder.node.position).normalize(),upperRest=elbow.position.clone().applyEuler(shoulder.rotation).normalize();
  shoulder.node.quaternion.setFromUnitVectors(upperRest,upperDirection).multiply(new THREE.Quaternion().setFromEuler(shoulder.rotation));rig.actor.updateMatrixWorld(true);
  const lowerDirection=elbow.node.parent.worldToLocal(end.clone()).sub(elbow.node.position).normalize(),lowerRest=hand.position.clone().applyEuler(elbow.rotation).normalize();
  elbow.node.quaternion.setFromUnitVectors(lowerRest,lowerDirection).multiply(new THREE.Quaternion().setFromEuler(elbow.rotation));rig.actor.updateMatrixWorld(true);
  hand.node.quaternion.copy(hand.node.parent.getWorldQuaternion(new THREE.Quaternion()).invert()).multiply(rig.actor.getWorldQuaternion(new THREE.Quaternion())).multiply(arm.handOrientation);
}
function applyCrossbowPose(rig,recoil,progress){
  const arms=rig.crossbowArms;
  // The right rear grip carries the entire rigid stock, butt and limbs. Solve
  // its arm backwards into recoil, then solve the support wrist onto that
  // actual moving fore-stock. Translating just weapon_R breaks the palm grip.
  solveBowArm(rig,'R',arms.R.restTarget.clone().add(new THREE.Vector3(0,0,.035*recoil)),arms);
  rig.actor.updateWorldMatrix(true,true);
  const support=rig.actor.worldToLocal(rig.crossbowForegrip.getWorldPosition(new THREE.Vector3()));
  solveBowArm(rig,'L',support,arms);
  const nock=rig.joints.get('crossbow_nock'),string=rig.string;
  if(nock&&string){
    // Release the cocked V-string along the bolt rail; recock during recovery.
    // The physical endpoints stay on their actual transverse wooden limbs.
    const cocked=progress<.42?1:progress<.50?1-smooth((progress-.42)/.08):progress<.72?0:smooth((progress-.72)/.28);
    const forward=string.top.position.clone().add(string.bottom.position).multiplyScalar(.5);
    nock.node.position.lerpVectors(forward,nock.position,cocked);
  }
}
function applyBowDraw(rig,draw){
  if(!draw||!rig.bowArms)return;
  const {R,L}=rig.bowArms,worldScale=rig.actor.getWorldScale(new THREE.Vector3()).y,reach=Math.min(R.reach,L.reach)/worldScale;
  // Bring the shoulders in naturally, then solve the real elbow chains. The
  // lowered neutral hand cannot be approximated by twisting a bow-side nock.
  R.shoulder.node.position.x-=reach*.20*draw;L.shoulder.node.position.x+=reach*.20*draw;
  R.shoulder.node.position.z-=reach*.20*draw;L.shoulder.node.position.z-=reach*.20*draw;rig.actor.updateMatrixWorld(true);
  const right=rig.actor.worldToLocal(R.shoulder.node.getWorldPosition(new THREE.Vector3())),left=rig.actor.worldToLocal(L.shoulder.node.getWorldPosition(new THREE.Vector3())),mid=right.clone().add(left).multiplyScalar(.5),halfWidth=Math.abs(right.x-left.x)/2,drop=reach*.20;
  const forward=Math.sqrt(Math.max(.0025,reach*reach*.96-halfWidth*halfWidth-drop*drop))*.86;
  const bowGoal=mid.clone().add(new THREE.Vector3(0,-drop,-forward)),leftTarget=L.restTarget.clone().lerp(bowGoal,draw);solveBowArm(rig,'L',leftTarget);
  const pivot=rig.joints.get('bow_pivot')||rig.joints.get('weapon_L');
  // Current exports carry a forward/vertical bow plane in their actual rest
  // geometry. Only older front-facing bows need the historical quarter turn;
  // applying it again would make the new string draw sideways across the bow.
  const plane=rig.geometric?.bowPlane||pivot?.node.userData.bowPlane;
  if(pivot&&plane!=='forward-vertical')pivot.node.rotation.y=pivot.rotation.y+Math.PI/2*draw;
  rig.actor.updateMatrixWorld(true);const nock=rig.actor.worldToLocal(rig.string.authoredNock.getWorldPosition(new THREE.Vector3())),rightGoal=nock.add(new THREE.Vector3(0,0,Math.min(.18,Math.max(.065,forward*.34)))),rightTarget=R.restTarget.clone().lerp(rightGoal,draw);solveBowArm(rig,'R',rightTarget);
}
export function animateAttack(rig,dt,time=0,{reducedMotion=false,...context}={}){
  if(!rig||rig.disposed)return;
  if(rig.native){
    updateSecretAnimation(rig.native,dt,{...context,reducedMotion});rig.active=rig.native.stage!=='idle';
    if(rig.glow){const phase=rig.native.phase;rig.glow.visible=rig.active;rig.glow.scale.setScalar(reducedMotion?1:.6+Math.sin(phase*Math.PI)*1.05);}
    return;
  }
  if(rig.geometric){
    const track=rig.breathTrack;
    if(track.active&&!(context.stamp!==undefined&&context.stamp===track.lastRelease)){track.elapsed=Math.min(track.duration,track.elapsed+(Number.isFinite(dt)?Math.max(0,dt):0));track.active=track.elapsed<track.duration;}
    const blocked=context.blocked||context.combat===false;
    if(blocked&&rig.stage==='preparation'){resetAttack(rig,{preserveBreath:true});applyBreath(rig,reducedMotion);return;}
    if(rig.stage!=='recovery'){
      const rate=Number.isFinite(context.rate)?Math.max(.01,context.rate):1,remaining=Number.isFinite(context.cooldown)?Math.max(0,context.cooldown)/rate:Infinity;
      const duration=Math.max(.001,Math.min(rig.pose.duration,Number.isFinite(context.interval)?Math.max(.001,context.interval)/rate*.9:rig.pose.duration)),preparation=duration*.42;
      if(context.combat&&!blocked&&context.target&&remaining>0&&remaining<=preparation){rig.duration=duration;rig.elapsed=preparation*(1-remaining/preparation);rig.stage='preparation';rig.active=true;}
      else if(rig.stage==='preparation'){resetAttack(rig,{preserveBreath:true});applyBreath(rig,reducedMotion);return;}
    }
  }
  if(!rig.active){applyBreath(rig,reducedMotion);return;}
  if(rig.stage!=='preparation'&&!(rig.geometric&&context.stamp!==undefined&&context.stamp===rig.lastRelease))rig.elapsed=Math.min(rig.duration,rig.elapsed+(Number.isFinite(dt)?Math.max(0,dt):0));
  const progress=rig.duration>0?rig.elapsed/rig.duration:1;
  const stroke=reducedMotion?0:Math.sin(progress*Math.PI)*(progress<.42?1:Math.pow(Math.max(0,1-(progress-.42)/.58),.4));
  const articulated=rig.joints.has('torso_pivot');
  rig.actor.rotation.x=rig.restX+(articulated?0:rig.pose.x*stroke);
  rig.actor.rotation.z=rig.restZ+(articulated?0:rig.pose.z*stroke);
  const draw=progress<.42?smooth(progress/.42):1-smooth((progress-.42)/.18);
  const cast=Math.sin(progress*Math.PI),slash=progress<.28?smooth(progress/.28):progress<.60?1-2*smooth((progress-.28)/.32):-1+smooth((progress-.60)/.40);
  const move=(name,x=0,y=0,z=0)=>{
    const pivot=rig.joints.get(name);if(!pivot||reducedMotion)return;
    pivot.node.rotation.set(pivot.rotation.x+x,pivot.rotation.y+y,pivot.rotation.z+z,pivot.rotation.order);
  };
  for(const pivot of rig.pivots){pivot.node.rotation.copy(pivot.rotation);pivot.node.position.copy(pivot.position);}
  const mechanical=rig.kind==='siege'&&!rig.joints.has('upper_arm_R'),style=rig.attackStyle;
  if(!mechanical)move('torso_pivot',-.045*stroke,rig.kind==='melee'?.18*slash:-.035*stroke,.045*stroke);
  move('head_pivot',-.055*stroke,0,0);
  if(mechanical){
    const lobbed=['stonewarden','royalmarshal','griffinbomber','royalarsenal'].includes(rig.family);
    if(lobbed){move('weapon_R',-.95*cast,0,0);move('siege_arm',-.95*cast,0,0);}
    else{const recoil=progress<.42?0:Math.sin(Math.PI*Math.min(1,(progress-.42)/.32));const weapon=rig.joints.get('weapon_R');if(weapon&&!reducedMotion)weapon.node.position.z+=.095*recoil;}
  }else if(style==='punch'){
    // Imported arms point down (-Y) and the character faces -Z. Positive
    // local X therefore extends the real fist forwards at the release event.
    const thrust=progress<.42?smooth(progress/.42):1-smooth((progress-.42)/.58);
    const lift=rig.forwardArmLift??1.20;
    move('upper_arm_R',lift*thrust,0,-.045*thrust);move('forearm_R',.25*thrust,0,0);
    move('hand_R',-(lift+.25)*thrust,0,0);move('torso_pivot',.055*thrust,-.06*thrust,0);
    move('upper_arm_L',.30*draw,0,.035*draw);move('forearm_L',.22*draw,0,0);
    if(!reducedMotion)advanceHand(rig,.07*thrust);
  }else if(style==='dartCannon'){
    // The authored barrel already points forwards. Keep its axis aligned,
    // brace the free fist, and kick the actual cannon back after releasing.
    const recoil=progress<.42?0:Math.sin(Math.PI*Math.min(1,(progress-.42)/.32));
    move('torso_pivot',-.012*stroke,0,0);move('upper_arm_L',.20*draw,0,.025*draw);
    move('forearm_L',.18*draw,0,0);
    const weapon=rig.joints.get('weapon_R')||rig.joints.get('hand_R');if(weapon&&!reducedMotion)weapon.node.position.z+=.085*recoil;
  }else if(style==='hammer'){
    move('upper_arm_R',-.82*draw,.04*stroke,-.10*stroke);move('forearm_R',-.38*draw,0,.05*stroke);
    move('hand_R',-.18*cast,0,0);move('torso_pivot',-.075*stroke,.055*slash,0);
    move('upper_arm_L',-.075*stroke,0,.045*stroke);
  }else if(style==='crossbow'){
    const recoil=progress<.42?0:Math.sin(Math.PI*Math.min(1,(progress-.42)/.32));
    if(rig.crossbowArms&&rig.crossbowForegrip){
      if(!reducedMotion)applyCrossbowPose(rig,recoil,progress);
    }else{
    move('upper_arm_R',-.12*stroke,0,-.035*stroke);move('forearm_R',-.17*draw,0,0);
    move('upper_arm_L',-.05*stroke,0,.02*stroke);move('weapon_pivot',.065*recoil,0,0);
    const weapon=rig.joints.get('weapon_R')||rig.joints.get('weapon_pivot');if(weapon&&!reducedMotion)weapon.node.position.z+=.07*recoil;
    }
  }else if(rig.string||style==='bow'||['arrow','venomArrow'].includes(rig.kind)&&!['staff','cross','orb'].includes(style)){
    if(rig.bowArms&&!reducedMotion)applyBowDraw(rig,draw);
    else{
    // Authored bow joints choose the draw pose independently of projectile FX.
    // Pull the drawing hand away from the bow; the actual string endpoints follow it.
    if(rig.string?.restStraight){
      // The new neutral pose starts with a lowered free hand. Lift the upper
      // arm and bend the elbow to catch/draw at the chest before releasing.
      move('upper_arm_R',.62*draw,-.20*draw,-.10*draw);move('forearm_R',1.02*draw,-.35*draw,.08*draw);
    }else{
      move('upper_arm_R',-.12*draw,-.20*draw,-.10*draw);move('forearm_R',.08*draw,-.55*draw,.10*draw);
    }
    move('hand_R',0,-.12*draw,0);move('upper_arm_L',-.035*stroke,0,.05*stroke);move('forearm_L',-.08*stroke,0,0);
    move('bow_pivot',0,-.035*stroke,.045*stroke);
    }
  }else if(['spear','lance'].includes(style)){
    // Elemental lances retain their physical thrust even when the emitted
    // effect is frost/lightning rather than a physical melee damage packet.
    const thrust=progress<.42?smooth(progress/.42):1-smooth((progress-.42)/.58);
    const lift=rig.forwardArmLift??1.2;
    move('upper_arm_R',lift*thrust,0,-.05*thrust);move('forearm_R',.15*thrust,0,0);move('hand_R',-(lift+.15)*thrust,0,0);
    move('weapon_R',-1.35*thrust,0,0);
    // Protract the complete arm slightly while the elbow extends. Translating
    // only the hand detaches the glove from the real forearm in source v2.
    if(!reducedMotion)advanceJoint(rig,'upper_arm_R',.045*thrust);
    move('torso_pivot',-.055*thrust,.025*thrust,0);
    move('upper_arm_L',.16*stroke,0,.13*stroke);move('forearm_L',.16*stroke,0,0);
  }else if(rig.kind==='melee'){
    // Shoulder, elbow and wrist carry the entire weapon through the sweep.
    move('upper_arm_R',-1.05*slash,.20*stroke,-.43*stroke);move('forearm_R',-.48*draw,.15*stroke,.12*stroke);
    move('hand_R',-.12*stroke,0,.22*slash);move('weapon_R',0,-.65*slash,0);
    move('upper_arm_L',-.16*stroke,0,.13*stroke);move('forearm_L',-.16*stroke,0,0);
  }else if(SPELL_KINDS.has(rig.kind)||['staff','cross','orb'].includes(style)){
    move('upper_arm_R',-.28*cast,-.07*cast,-.22*cast);move('forearm_R',-.35*cast,0,.12*cast);
    move('weapon_R',-.20*cast,0,.06*cast);move('upper_arm_L',-.38*cast,.10*cast,.20*cast);move('forearm_L',-.25*cast,0,-.12*cast);
    move('hand_L',.18*cast,0,.14*cast);
  }else if(rig.kind==='siege'){
    move('weapon_pivot',.085*stroke,0,0);move('upper_arm_R',-.55*stroke,0,-.16*stroke);move('forearm_R',-.35*stroke,0,0);
    move('upper_arm_L',-.25*stroke,0,.10*stroke);
  }
  const recoil=rig.joints.get('weapon_pivot');if(recoil&&!reducedMotion)recoil.node.position.z+=.11*stroke;
  for(const pivot of rig.pivots){
    const jaw=['dragon_jaw','jaw_pivot','mouth_pivot'].includes(pivot.name),wing=pivot.name.includes('wing');
    if(jaw)move(pivot.name,rig.kind==='flame'?-.36*stroke:0,0,0);
    else if(wing)move(pivot.name,.12*stroke,0,stroke*(pivot.name.startsWith('left')||pivot.name.endsWith('_L')?.20:-.20));
    else if(['attack_arm','bow_arm'].includes(pivot.name))move(pivot.name,-.34*stroke,0,0);
  }
  if(rig.glow){rig.glow.visible=rig.active&&progress<.92;rig.glow.scale.setScalar(reducedMotion?1:.6+1.55*Math.sin(Math.PI*progress));rig.glow.children[1].rotation.set(reducedMotion?0:progress*3,reducedMotion?0:progress*2,0);}
  if(rig.string)rig.string.draw=reducedMotion?0:draw;
  updateBowString(rig);
  if(progress>=1)resetAttack(rig,{preserveBreath:true});
  applyBreath(rig,reducedMotion);
}
export function resetAttack(rig,{preserveBreath=false}={}){
  if(!rig)return;rig.elapsed=rig.duration;rig.active=false;rig.stage='idle';
  if(!preserveBreath&&rig.breathTrack){rig.breathTrack.active=false;rig.breathTrack.elapsed=rig.breathTrack.duration;}
  if(rig.native){resetSecretAnimation(rig.native);if(rig.glow)rig.glow.visible=false;return;}
  rig.actor.rotation.x=rig.restX;rig.actor.rotation.z=rig.restZ;
  for(const pivot of rig.pivots){pivot.node.rotation.copy(pivot.rotation);pivot.node.position.copy(pivot.position);}
  if(rig.glow)rig.glow.visible=false;if(rig.string)rig.string.draw=0;updateBowString(rig);
}
// Atelier uses the same physical joints and release pose as combat. It never
// creates damage or schedules a real shot; its callback only previews effects.
export function previewGeometricAttack(rig,{duration=1}={}){
  if(!rig?.geometric||rig.disposed)return false;
  resetAttack(rig);rig.duration=Number.isFinite(duration)?Math.max(.001,duration):1;rig.elapsed=0;rig.stage='preview';rig.active=true;
  animateAttack(rig,0);return true;
}
export function updateGeometricPreview(rig,dt,{reducedMotion=false,onRelease=()=>{}}={}){
  if(!rig?.geometric||rig.disposed||rig.stage!=='preview')return false;
  const elapsed=Number.isFinite(dt)?Math.max(0,dt):0;if(!elapsed)return true;
  const previous=rig.elapsed/rig.duration,next=Math.min(1,previous+elapsed/rig.duration);
  if(previous<.42&&next>=.42){rig.elapsed=rig.duration*.42;animateAttack(rig,0,0,{reducedMotion});onRelease({elapsedAfterRelease:(next-.42)*rig.duration});}
  rig.elapsed=next*rig.duration;animateAttack(rig,0,0,{reducedMotion});return true;
}
export function disposeAttack(rig){
  if(!rig||rig.disposed)return;resetAttack(rig);
  disposeSecretAnimation(rig.native);
  for(const object of rig.owned){object.traverse(node=>{node.geometry?.dispose();node.material?.dispose();});object.removeFromParent();}
  for(const entry of rig.authoredStrings||[])entry.node.visible=entry.visible;
  rig.owned.length=0;rig.disposed=true;
}
