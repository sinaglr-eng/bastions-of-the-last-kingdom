import * as THREE from 'three';
import {attackVisualKind} from './combat-effects.js';

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

// The exported soldiers are mostly material-joined meshes. Animate their actor
// transform safely; only explicit authored pivots may be articulated separately.
// Position, scale and aim rotation Y are exclusively owned by Battlefield.
const ATTACK_POSES={
  melee:{x:-.15,z:.23,duration:.32},arrow:{x:-.065,z:.085,duration:.24},
  roots:{x:.065,z:-.11,duration:.42},flame:{x:-.12,z:.025,duration:.52},
  lightning:{x:.055,z:-.10,duration:.30},siege:{x:-.038,z:0,duration:.33},
  holy:{x:.025,z:-.06,duration:.35},frost:{x:.055,z:-.075,duration:.33},
  arcane:{x:.06,z:-.11,duration:.32},
};
export function attackRig(actor,family,stats={}){
  if(!actor)return null;
  const kind=attackVisualKind(family,stats),pose=ATTACK_POSES[kind],pivots=[];
  for(const name of ['attack_arm','weapon_pivot','bow_arm','dragon_jaw','mouth_pivot','left_wing_pivot','right_wing_pivot']){
    const node=actor.getObjectByName(name);
    if(node)pivots.push({node,name,x:node.rotation.x,z:node.rotation.z});
  }
  return {actor,family,kind,pose,pivots,restX:actor.rotation.x,restZ:actor.rotation.z,elapsed:pose.duration,duration:pose.duration,active:false};
}
export function triggerAttack(rig,payload={}){
  if(!rig)return;
  // Simultaneous multishot callbacks describe one release pose.
  if(rig.active&&rig.elapsed<.025)return;
  const interval=payload.stats?.interval;
  rig.duration=Math.min(rig.pose.duration,Number.isFinite(interval)&&interval>0?Math.max(.12,interval*.8):rig.pose.duration);
  rig.elapsed=0;rig.active=true;
}
export function animateAttack(rig,dt,time=0,{reducedMotion=false}={}){
  if(!rig)return;
  rig.elapsed=Math.min(rig.duration,rig.elapsed+(Number.isFinite(dt)?Math.max(0,dt):0));
  const progress=rig.duration>0?rig.elapsed/rig.duration:1;
  const stroke=reducedMotion?0:Math.sin(progress*Math.PI)*(progress<.42?1:Math.pow(Math.max(0,1-(progress-.42)/.58),.4));
  rig.actor.rotation.x=rig.restX+rig.pose.x*stroke;
  rig.actor.rotation.z=rig.restZ+rig.pose.z*stroke;
  for(const pivot of rig.pivots){
    const jaw=pivot.name==='dragon_jaw'||pivot.name==='mouth_pivot',wing=pivot.name.includes('wing');
    pivot.node.rotation.x=pivot.x+stroke*(jaw ? .28 : wing ? .10 : -.34);
    pivot.node.rotation.z=pivot.z+(wing?stroke*(pivot.name.startsWith('left') ? .12 : -.12):0);
  }
  if(progress>=1)rig.active=false;
}
export function resetAttack(rig){
  if(!rig)return;rig.elapsed=rig.duration;rig.active=false;
  rig.actor.rotation.x=rig.restX;rig.actor.rotation.z=rig.restZ;
  for(const pivot of rig.pivots){pivot.node.rotation.x=pivot.x;pivot.node.rotation.z=pivot.z;}
}
