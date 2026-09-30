import * as THREE from 'three';

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
