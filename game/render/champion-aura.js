import * as THREE from 'three';
import {championAuraLevel,championClassification} from './champion-classification.js';

// These visual signals never enter towerStats, combat or support calculations.
// Ordinary champions keep the former TOP effect. The two Secret champions have
// a brighter, bounded gold style; basic defenders still have no champion aura.
export const CHAMPION_AURA_COLORS=Object.freeze({
  Basic:'#3989ed',Intermediate:'#3eac63',Advanced:'#9555d8',TOP:'#ffd969',Secret:'#ffd969',
});
export const CHAMPION_AURA_STYLE=Object.freeze({strength:.50,radius:.92,rings:3,particles:18,wisps:6,height:.94});
export const SECRET_CHAMPION_AURA_STYLE=Object.freeze({strength:.80,radius:1.03,rings:4,particles:30,wisps:8,height:1.18});
export const CHAMPION_AURA_TIERS=Object.freeze({0:CHAMPION_AURA_STYLE,1:CHAMPION_AURA_STYLE,2:CHAMPION_AURA_STYLE,3:CHAMPION_AURA_STYLE,4:SECRET_CHAMPION_AURA_STYLE});

const vertex=`
  varying vec2 auraUV;
  void main(){auraUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
`;
const groundFragment=`
  varying vec2 auraUV;
  uniform vec3 tint;uniform float opacity;
  void main(){
    float distanceFromCentre=length(auraUV-.5)*2.0;
    float fade=pow(1.0-smoothstep(.05,1.0,distanceFromCentre),1.6);
    gl_FragColor=vec4(tint,opacity*fade);
  }
`;
const wispFragment=`
  varying vec2 auraUV;
  uniform vec3 tint;uniform float opacity;
  void main(){
    float edge=1.0-smoothstep(.04,.5,abs(auraUV.x-.5));
    float ends=smoothstep(0.0,.15,auraUV.y)*(1.0-smoothstep(.45,1.0,auraUV.y));
    gl_FragColor=vec4(tint,opacity*edge*ends);
  }
`;
const pointVertex=`
  uniform float pointScale;uniform float minPointSize;uniform float maxPointSize;
  void main(){
    vec4 viewPosition=modelViewMatrix*vec4(position,1.0);
    gl_Position=projectionMatrix*viewPosition;
    gl_PointSize=clamp(pointScale*180.0/max(.01,-viewPosition.z),minPointSize,maxPointSize);
  }
`;
const pointFragment=`
  uniform vec3 tint;uniform float opacity;
  void main(){
    float distanceFromCentre=length(gl_PointCoord-.5)*2.0;
    gl_FragColor=vec4(tint,opacity*(1.0-smoothstep(.1,1.0,distanceFromCentre)));
  }
`;
const cosmeticMaterial=(color,opacity,fragmentShader)=>new THREE.ShaderMaterial({
  uniforms:{tint:{value:new THREE.Color(color)},opacity:{value:opacity}},
  vertexShader:vertex,fragmentShader,transparent:true,depthWrite:false,
  depthTest:true,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false,
});
const ignoreRaycast=()=>{};

function ribbonGeometry(height,width){
  const segments=7,vertices=[],uvs=[],indices=[];
  for(let i=0;i<=segments;i++){
    const t=i/segments,bend=Math.sin(t*Math.PI)*.09;
    vertices.push(bend-width/2,height*t,0,bend+width/2,height*t,0);
    uvs.push(0,t,1,t);
    if(i<segments){const v=i*2;indices.push(v,v+1,v+2,v+1,v+3,v+2);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);geometry.computeBoundingSphere();return geometry;
}

export function createChampionAura(family,{phase=0}={}){
  const classification=championClassification(family);
  if(!classification)return null;
  const level=championAuraLevel(family);
  const tier=CHAMPION_AURA_TIERS[level],color=CHAMPION_AURA_COLORS[classification],secret=classification==='Secret';
  const aura=new THREE.Group();aura.name='Champion classification aura';
  const data=aura.userData;
  Object.assign(data,{family,classification,level,tier,color,
    phase:Number.isFinite(phase)?phase:0,disposed:false,rings:[],wisps:[]});
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(tier.radius*2,tier.radius*2),cosmeticMaterial(color,tier.strength,groundFragment));
  glow.name='Fading champion ground glow';glow.rotation.x=-Math.PI/2;glow.position.y=.183;
  glow.raycast=ignoreRaycast;aura.add(glow);data.ground=glow;
  for(let i=0;i<tier.rings;i++){
    const radius=secret?.50+i*.16:.445+i*.15;
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:tier.strength+.16,
      side:THREE.DoubleSide,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,toneMapped:false});
    // Broken outer rings read as runic arcs and leave room for selection markers.
    const ring=new THREE.Mesh(new THREE.RingGeometry(radius,radius+(secret?.031:.021),40,1,0,i?Math.PI*1.55:Math.PI*2),material);
    ring.name=`Champion aura ring ${i+1}`;ring.rotation.x=-Math.PI/2;ring.position.y=.187+i*.006;
    ring.raycast=ignoreRaycast;aura.add(ring);data.rings.push(ring);
  }
  const particleGeometry=new THREE.BufferGeometry();
  particleGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(tier.particles*3),3));
  const particleMaterial=new THREE.ShaderMaterial({
    uniforms:{tint:{value:new THREE.Color(color).lerp(new THREE.Color('#ffffff'),secret?.42:.27)},
      opacity:{value:secret?1:.83},pointScale:{value:secret?.18:.115},
      minPointSize:{value:secret?2.6:1.6},maxPointSize:{value:secret?10:8}},
    vertexShader:pointVertex,fragmentShader:pointFragment,transparent:true,depthWrite:false,
    depthTest:true,blending:THREE.AdditiveBlending,toneMapped:false,
  });
  const particles=new THREE.Points(particleGeometry,particleMaterial);particles.name='Champion aura motes';
  particles.raycast=ignoreRaycast;particles.frustumCulled=false;aura.add(particles);data.particles=particles;
  if(tier.wisps){
    const geometry=ribbonGeometry(tier.height,secret?.15:.109);
    const material=cosmeticMaterial(color,tier.strength*.88,wispFragment);
    for(let i=0;i<tier.wisps;i++){
      const wisp=new THREE.Mesh(geometry,material);wisp.name=`Champion aura rising wisp ${i+1}`;
      wisp.raycast=ignoreRaycast;aura.add(wisp);data.wisps.push(wisp);
    }
  }
  animateChampionAura(aura,0);return aura;
}

export function animateChampionAura(aura,time,{reducedMotion=false}={}){
  if(!aura||aura.userData.disposed)return;
  const data=aura.userData,{tier,phase}=data;
  const clock=reducedMotion?0:((Number.isFinite(time)?time:0)%1e6+phase%1e6);
  data.ground.material.uniforms.opacity.value=tier.strength*(reducedMotion?1:1+.07*Math.sin(clock*1.6));
  data.rings.forEach((ring,i)=>{
    ring.rotation.z=(i%2?-1:1)*clock*(.11+i*.07);
    ring.material.opacity=tier.strength+.16+(reducedMotion?0:.035*Math.sin(clock*1.4+i));
  });
  const positions=data.particles.geometry.attributes.position;
  for(let i=0;i<tier.particles;i++){
    const angle=i*Math.PI*2/tier.particles+clock*.235;
    const radius=tier.radius*(.64+.11*Math.sin(i*2.17));
    const rise=reducedMotion?(i+.5)/tier.particles:((clock*.16+i/tier.particles)%1+1)%1;
    positions.setXYZ(i,Math.cos(angle)*radius,.22+rise*tier.height,Math.sin(angle)*radius);
  }
  positions.needsUpdate=true;
  data.wisps.forEach((wisp,i)=>{
    const angle=i*Math.PI*2/tier.wisps+clock*.12;
    const radius=tier.radius*.78;
    wisp.position.set(Math.cos(angle)*radius,.19,Math.sin(angle)*radius);
    wisp.rotation.y=-angle+Math.PI/2;
    wisp.scale.y=reducedMotion?1:.88+.12*Math.sin(clock*1.5+i*1.1);
  });
}

export function disposeChampionAura(aura){
  if(!aura||aura.userData.disposed)return;
  const geometries=new Set(),materials=new Set();
  aura.traverse(object=>{
    if(object.geometry)geometries.add(object.geometry);
    for(const material of Array.isArray(object.material)?object.material:[object.material])if(material)materials.add(material);
  });
  geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());
  aura.userData.disposed=true;aura.removeFromParent();
}
