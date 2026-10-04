import * as THREE from 'three';
import {hasEnemySpecialMechanic} from './geometric-enemy-effects.js';

export const ENEMY_AURA_STAGES = Object.freeze([
  {name:'No aura',color:'#ffffff',smoke:false},
  {name:'Yellow aura',color:'#ffd34f',smoke:false},
  {name:'Red aura',color:'#e44b42',smoke:false},
  {name:'Dark violet aura',color:'#8744bd',smoke:true},
  {name:'Black smoke · violet edge',color:'#9253d4',smoke:true},
]);
export function enemyAuraStage(enemy){
  if(!hasEnemySpecialMechanic(enemy))return 0;
  const wave=Number(/^host_(\d+)/.exec(enemy.type||'')?.[1]);
  return THREE.MathUtils.clamp(Number.isInteger(enemy.auraStage)?enemy.auraStage:Number.isFinite(wave)?Math.floor((wave-1)/10):0,0,4);
}

function boundsInAuraParent(body){
  body.updateWorldMatrix(true,true);
  // The aura becomes a sibling of body. World bounds would apply the actor's
  // scale, heading and flight lift here and then again when the aura is added.
  const toParent=body.parent?body.parent.matrixWorld.clone().invert():new THREE.Matrix4();
  const bounds=new THREE.Box3(),part=new THREE.Box3(),transform=new THREE.Matrix4();
  body.traverse(node=>{
    if(!node.geometry)return;
    if(node.boundingBox!==undefined){
      if(node.boundingBox===null)node.computeBoundingBox();
      part.copy(node.boundingBox);
    }else{
      if(node.geometry.boundingBox===null)node.geometry.computeBoundingBox();
      part.copy(node.geometry.boundingBox);
    }
    transform.multiplyMatrices(toParent,node.matrixWorld);
    bounds.union(part.applyMatrix4(transform));
  });
  return bounds;
}

// Cosmetic only: the shell follows the authored lower body or wing roots and
// never changes hit detection, visibility rules, speed, defenses or damage.
export function createEnemyAura(enemy,body){
  const stage=enemyAuraStage(enemy);if(!stage)return null;
  const bounds=boundsInAuraParent(body),size=bounds.getSize(new THREE.Vector3());
  const flying=!!enemy.flying,finalBoss=enemy.type==='host_50';
  const radius=Math.max(.28,Math.min(size.x*(flying?.50:.38),flying?5.5:1.15))*(enemy.boss?1.08:1);
  const height=Math.max(.4,size.y*(flying?.48:.40)),y=flying?bounds.min.y+size.y*.47:bounds.min.y+.035;
  const root=new THREE.Group();root.name=ENEMY_AURA_STAGES[stage].name;root.userData.stage=stage;
  const uniforms={time:{value:0},color:{value:new THREE.Color(ENEMY_AURA_STAGES[stage].color)},stage:{value:stage},strength:{value:enemy.boss?(finalBoss?1.4:1.15):1}};
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms,
    vertexShader:'varying vec2 auraUV; void main(){auraUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 auraUV;uniform float time,stage,strength;uniform vec3 color;
      void main(){float u=auraUV.x*6.2831853,v=auraUV.y;
        float wisps=sin(u*5.+v*13.-time*1.1)*sin(u*3.-v*7.+time*.6);
        float fade=pow(max(0.,sin(v*3.14159265)),1.4);
        float rim=pow(max(0.,sin(u*3.+v*12.-time*.75)),16.);
        float density=stage>3.5?.20:stage>2.5?.14:.10;
        float alpha=(density+.16*(wisps*.5+.5)+.085*rim)*fade*strength;
        vec3 tint=stage>3.5?mix(vec3(.025,.018,.035),color,rim*.55):color;
        gl_FragColor=vec4(tint,alpha);}`});
  const shell=new THREE.Mesh(new THREE.CylinderGeometry(radius*.72,radius,height,24,6,true),material);
  shell.position.y=y+height/2;root.add(shell);
  if(flying)shell.scale.z=.48;
  const ring=new THREE.Mesh(new THREE.RingGeometry(radius*(stage===4?.985:.96),radius,48),new THREE.MeshBasicMaterial({color:uniforms.color.value,side:THREE.DoubleSide,transparent:true,opacity:stage===4?.32:.26,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;ring.position.y=y+.015;if(flying)ring.scale.y=.48;root.add(ring);
  const positions=new Float32Array(18*3);
  for(let i=0;i<18;i++){const angle=i*2.39996323;positions[i*3]=Math.cos(angle)*radius;positions[i*3+1]=y+(i/18)*height;positions[i*3+2]=Math.sin(angle)*radius;}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const sparks=new THREE.Points(geometry,new THREE.PointsMaterial({color:uniforms.color.value,size:stage>2?.035:.055,transparent:true,opacity:stage>2?.25:.55,depthWrite:false}));root.add(sparks);
  if(finalBoss){
    // Thin saddle vortex gives the final wyvern a readable violet outline inside
    // the dark mist without covering the queen's wings or the rider's face.
    const vortex=new THREE.Mesh(new THREE.TorusGeometry(radius*.42,.018,4,48),new THREE.MeshBasicMaterial({color:'#a45ce0',transparent:true,opacity:.4,depthWrite:false}));
    vortex.position.y=bounds.min.y+size.y*.70;vortex.rotation.x=Math.PI/2;root.add(vortex);root.userData.vortex=vortex;
  }
  root.userData.uniforms=uniforms;root.userData.sparks=sparks;
  root.traverse(o=>{o.raycast=()=>{};o.renderOrder=2;});return root;
}
export function animateEnemyAura(root,time,{reducedMotion=false}={}){
  if(!root)return;const clock=reducedMotion?0:Number.isFinite(time)?Math.max(0,time):0;
  root.userData.uniforms.time.value=clock;root.userData.sparks.rotation.y=clock*(root.userData.stage>2?-.13:.18);
  if(root.userData.vortex)root.userData.vortex.rotation.z=-clock*.16;
}
