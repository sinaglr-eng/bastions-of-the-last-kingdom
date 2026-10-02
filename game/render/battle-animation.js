import * as THREE from 'three';
import {attackVisualKind} from './combat-effects.js';
import {createDefenderAnimation,releaseDefenderAttack,updateDefenderAnimation,resetDefenderAnimation,disposeDefenderAnimation} from './defender-animation.js';

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
  const body=root.userData.body;body.scale.setScalar(1);body.rotation.z=0;
  root.userData.bar&&(root.userData.bar.visible=false);
  root.userData.aura&&(root.userData.aura.visible=false);
  if(root.userData.shards)root.userData.shards.visible=false;
  const initialY=root.position.y,originalX=body.rotation.x;
  const limbs=root.userData.limbs||[],wings=root.userData.wings||[];
  const rotations=[...limbs.map(l=>l.rotation.x),...wings.map(w=>w.rotation.z)];
  limbs.forEach(l=>l.rotation.x=l.userData.restRotation||0);
  wings.forEach((w,i)=>w.rotation.z=(w.userData.restRotation||0)+.45*(i%2?1:-1));
  root.position.y=0;body.rotation.x=-Math.PI/2;root.updateMatrixWorld(true);
  const lift=.025-new THREE.Box3().setFromObject(body,true).min.y;
  limbs.forEach((l,i)=>l.rotation.x=rotations[i]);wings.forEach((w,i)=>w.rotation.z=rotations[limbs.length+i]);
  body.rotation.x=originalX;root.position.y=initialY;
  root.userData.death={elapsed:0,duration:enemy.flying?.95:.65,initialY,lift,originalX};
  return root;
}
export function animateDeath(root,dt){
  const death=root.userData.death;if(!death)return;
  death.elapsed=Math.min(death.duration,death.elapsed+dt);
  const p=death.elapsed/death.duration,ease=1-Math.pow(1-p,3),body=root.userData.body;
  body.rotation.x=THREE.MathUtils.lerp(death.originalX,-Math.PI/2,ease);
  root.position.y=THREE.MathUtils.lerp(death.initialY,death.lift,ease)+Math.sin(p*Math.PI)*.10;
  root.userData.limbs?.forEach((limb,i)=>{limb.rotation.x=(limb.userData.restRotation||0)+Math.sin(p*Math.PI)*(i%2?-.3:.3);});
  root.userData.wings?.forEach((wing,i)=>wing.rotation.z=(wing.userData.restRotation||0)+ease*.45*(i%2?1:-1));
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
};
const JOINT_NAMES=['torso_pivot','head_pivot','upper_arm_L','upper_arm_R','forearm_L','forearm_R','hand_L','hand_R','weapon_L','weapon_R','bow_pivot','weapon_pivot','attack_arm','bow_arm','dragon_jaw','mouth_pivot','left_wing_pivot','right_wing_pivot'];
const SPELL_KINDS=new Set(['arcane','holy','frost','roots','lightning']);
const smooth=p=>{p=THREE.MathUtils.clamp(p,0,1);return p*p*(3-2*p);};
const noPick=()=>{};
export function attackRig(actor,family,stats={}){
  if(!actor)return null;
  const kind=attackVisualKind(family,stats),pose=ATTACK_POSES[kind],pivots=[];
  for(const name of JOINT_NAMES){
    const node=actor.getObjectByName(name);
    if(node)pivots.push({node,name,rotation:node.rotation.clone(),position:node.position.clone()});
  }
  const rig={actor,family,kind,pose,pivots,joints:new Map(pivots.map(p=>[p.name,p])),restX:actor.rotation.x,restZ:actor.rotation.z,elapsed:pose.duration,duration:pose.duration,active:false,owned:[],disposed:false};
  rig.native=createDefenderAnimation(actor,family,stats);
  rig.muzzle=actor.getObjectByName('attack_muzzle')||(family==='lordbernhard'?actor.getObjectByName('sword_tip'):kind==='flame'?actor.getObjectByName('attack_muzzle'):actor.getObjectByName('staff_tip'))||actor.getObjectByName('sword_tip')||null;
  const tip=['ladyclaire','lordbernhard'].includes(family)?rig.muzzle:actor.getObjectByName('staff_tip');
  if(tip&&SPELL_KINDS.has(kind)){
    const color=['ladyclaire','lordbernhard'].includes(family)?'#ffdc78':kind==='holy'?'#ffe7a3':kind==='roots'?'#9bdd67':kind==='frost'?'#a4efff':kind==='lightning'?'#b1ddff':'#cb9fff';
    const glow=new THREE.Group();glow.name='Charging staff focus';glow.visible=false;tip.add(glow);
    glow.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.095,1),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false})),new THREE.Mesh(new THREE.TorusGeometry(.14,.012,4,20),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false})));
    glow.traverse(node=>node.raycast=noPick);rig.glow=glow;rig.owned.push(glow);
  }
  const top=actor.getObjectByName('bow_tip_upper'),bottom=actor.getObjectByName('bow_tip_lower'),nock=actor.getObjectByName('bow_nock');
  if(top&&bottom&&nock){
    const authored=actor.getObjectByName('authored_bowstring');if(authored){rig.authoredString={node:authored,visible:authored.visible};authored.visible=false;}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3));
    const string=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#eee3c9',depthWrite:false,toneMapped:false}));string.name='Articulated taut bowstring';string.raycast=noPick;string.frustumCulled=false;actor.add(string);
    rig.string={object:string,top,bottom,nock,point:new THREE.Vector3()};rig.owned.push(string);updateBowString(rig);
  }
  return rig;
}
function updateBowString(rig){
  if(!rig.string)return;
  const {object,top,bottom,nock,point}=rig.string,positions=object.geometry.attributes.position;rig.actor.updateMatrixWorld(true);
  [top,nock,bottom,nock].forEach((node,i)=>{node.getWorldPosition(point);rig.actor.worldToLocal(point);positions.setXYZ(i,point.x,point.y,point.z);});positions.needsUpdate=true;
}
export function attackMuzzle(rig,out=new THREE.Vector3()){
  if(!rig||rig.disposed||!rig.muzzle)return null;
  rig.actor.updateMatrixWorld(true);return rig.muzzle.getWorldPosition(out);
}
export function triggerAttack(rig,payload={}){
  if(!rig||rig.disposed)return;
  if(rig.native){releaseDefenderAttack(rig.native,{interval:payload.stats?.interval,rate:payload.visualRate,stamp:payload.combatTime,reducedMotion:payload.reducedMotion});rig.active=true;return;}
  // Simultaneous multishot callbacks describe one release pose.
  if(rig.active&&rig.elapsed<.025)return;
  const interval=payload.stats?.interval;
  rig.duration=Math.min(rig.pose.duration,Number.isFinite(interval)&&interval>0?Math.max(.12,interval*.8):rig.pose.duration);
  rig.elapsed=0;rig.active=true;
}
export function animateAttack(rig,dt,time=0,{reducedMotion=false,...context}={}){
  if(!rig||rig.disposed)return;
  if(rig.native){
    updateDefenderAnimation(rig.native,dt,{...context,reducedMotion});rig.active=rig.native.stage!=='idle';
    if(rig.glow){const phase=rig.native.phase;rig.glow.visible=rig.active;rig.glow.scale.setScalar(reducedMotion?1:.6+Math.sin(phase*Math.PI)*1.05);}
    return;
  }
  if(!rig.active)return;
  rig.elapsed=Math.min(rig.duration,rig.elapsed+(Number.isFinite(dt)?Math.max(0,dt):0));
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
  move('torso_pivot',-.045*stroke,rig.kind==='melee'?.18*slash:-.035*stroke,.045*stroke);
  move('head_pivot',-.055*stroke,0,0);
  if(rig.string||rig.kind==='arrow'){
    // Authored bow joints choose the draw pose independently of projectile FX.
    // Pull the drawing hand away from the bow; the actual string endpoints follow it.
    move('upper_arm_R',-.12*draw,-.20*draw,-.10*draw);move('forearm_R',.08*draw,-.55*draw,.10*draw);
    move('hand_R',0,-.12*draw,0);move('upper_arm_L',-.035*stroke,0,.05*stroke);move('forearm_L',-.08*stroke,0,0);
    move('bow_pivot',0,-.035*stroke,.045*stroke);
  }else if(rig.kind==='melee'){
    // Shoulder windup, elbow extension and wrist sweep carry the whole sword/hammer.
    move('upper_arm_R',-1.05*slash,.20*stroke,-.43*stroke);move('forearm_R',-.48*draw,.15*stroke,.12*stroke);
    move('hand_R',-.12*stroke,0,.22*slash);move('weapon_R',0,-.65*slash,0);
    move('upper_arm_L',-.16*stroke,0,.13*stroke);move('forearm_L',-.16*stroke,0,0);
  }else if(SPELL_KINDS.has(rig.kind)){
    move('upper_arm_R',-.28*cast,-.07*cast,-.22*cast);move('forearm_R',-.35*cast,0,.12*cast);
    move('weapon_R',-.20*cast,0,.06*cast);move('upper_arm_L',-.38*cast,.10*cast,.20*cast);move('forearm_L',-.25*cast,0,-.12*cast);
    move('hand_L',.18*cast,0,.14*cast);
  }else if(rig.kind==='siege'){
    move('weapon_pivot',.085*stroke,0,0);move('upper_arm_R',-.55*stroke,0,-.16*stroke);move('forearm_R',-.35*stroke,0,0);
    move('upper_arm_L',-.25*stroke,0,.10*stroke);
  }
  const recoil=rig.joints.get('weapon_pivot');if(recoil&&!reducedMotion)recoil.node.position.z+=.11*stroke;
  for(const pivot of rig.pivots){
    const jaw=pivot.name==='dragon_jaw'||pivot.name==='mouth_pivot',wing=pivot.name.includes('wing');
    if(jaw)move(pivot.name,-.36*stroke,0,0);
    else if(wing)move(pivot.name,.12*stroke,0,stroke*(pivot.name.startsWith('left')?.20:-.20));
    else if(['attack_arm','bow_arm'].includes(pivot.name))move(pivot.name,-.34*stroke,0,0);
  }
  if(rig.glow){rig.glow.visible=rig.active&&progress<.92;rig.glow.scale.setScalar(reducedMotion?1:.6+1.55*Math.sin(Math.PI*progress));rig.glow.children[1].rotation.set(reducedMotion?0:progress*3,reducedMotion?0:progress*2,0);}
  updateBowString(rig);
  if(progress>=1)resetAttack(rig);
}
export function resetAttack(rig){
  if(!rig)return;rig.elapsed=rig.duration;rig.active=false;
  if(rig.native){resetDefenderAnimation(rig.native);if(rig.glow)rig.glow.visible=false;return;}
  rig.actor.rotation.x=rig.restX;rig.actor.rotation.z=rig.restZ;
  for(const pivot of rig.pivots){pivot.node.rotation.copy(pivot.rotation);pivot.node.position.copy(pivot.position);}
  if(rig.glow)rig.glow.visible=false;updateBowString(rig);
}
export function disposeAttack(rig){
  if(!rig||rig.disposed)return;resetAttack(rig);
  disposeDefenderAnimation(rig.native);
  for(const object of rig.owned){object.traverse(node=>{node.geometry?.dispose();node.material?.dispose();});object.removeFromParent();}
  if(rig.authoredString)rig.authoredString.node.visible=rig.authoredString.visible;
  rig.owned.length=0;rig.disposed=true;
}
