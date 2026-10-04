import * as THREE from 'three';

// Visibility is supplied by CombatManager.isRevealed. A departure owns only its
// last public point: no hidden actor, health, glyph, position or model reference.
const vertex=`
  attribute float cloudAlpha;
  varying float alpha;varying float shade;
  void main(){
    alpha=cloudAlpha;shade=.76+.24*abs(normal.y);
    gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);
  }
`;
const fragment=`
  uniform vec3 tint;varying float alpha;varying float shade;
  void main(){gl_FragColor=vec4(tint*shade,alpha);}
`;
const defaultPosition=(x,y,z)=>new THREE.Vector3(x,y,z);
const noPick=()=>{};
export class EnemyConcealmentEffects{
  constructor(scene,{position=defaultPosition,isVisible=enemy=>!enemy.cloaked,reducedMotion=()=>false,maxClouds=24}={}){
    this.position=position;this.isVisible=isVisible;this.reducedMotion=reducedMotion;
    this.maxClouds=Math.max(1,Math.min(64,Math.floor(maxClouds)||24));this.puffsPerCloud=7;
    this.states=new Map();this.clouds=[];this.time=0;this.disposed=false;
    const capacity=this.maxClouds*this.puffsPerCloud,geometry=new THREE.IcosahedronGeometry(1,1);
    geometry.setAttribute('cloudAlpha',new THREE.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(THREE.DynamicDrawUsage));
    const material=new THREE.ShaderMaterial({uniforms:{tint:{value:new THREE.Color('#82909c')}},vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,depthTest:true,toneMapped:false});
    this.object=new THREE.InstancedMesh(geometry,material,capacity);this.object.name='Bounded last-visible concealment smoke';
    this.object.count=0;this.object.visible=false;this.object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.object.frustumCulled=false;this.object.raycast=noPick;this.object.renderOrder=7;scene.add(this.object);
    this.matrix=new THREE.Matrix4();this.rotation=new THREE.Quaternion();this.scale=new THREE.Vector3();this.offset=new THREE.Vector3();
  }
  emit(anchor,kind){
    // Copy the approved point, never retain the enemy object or its id.
    if(this.clouds.length===this.maxClouds)this.clouds.shift();
    this.clouds.push({anchor:anchor.clone(),kind,born:this.time,lifetime:kind==='departure'?.65:.45});
  }
  sync(enemies,{time=this.time,active=true}={}){
    if(this.disposed)return;
    if(Number.isFinite(time)&&time<this.time){this.states.clear();this.clouds.length=0;}
    this.time=Number.isFinite(time)?time:this.time;
    if(!active){this.states.clear();this.clouds.length=0;this.update(this.time);return;}
    const seen=new Set();
    for(const enemy of enemies){
      if(enemy.dead)continue;const id=enemy.id;seen.add(id);
      const visible=!!this.isVisible(enemy),previous=this.states.get(id);
      if(!visible){
        if(previous?.visible&&previous.last)this.emit(previous.last,'departure');
        this.states.set(id,{visible:false});continue;
      }
      // Coordinates are sampled only after actual shared reveal succeeds.
      if(!Number.isFinite(enemy.x)||!Number.isFinite(enemy.z)){this.states.delete(id);continue;}
      const point=this.position(enemy.x,enemy.flying?.8:.12,enemy.z);
      if(previous&&!previous.visible)this.emit(point,'arrival');
      this.states.set(id,{visible:true,last:point.clone()});
    }
    for(const id of this.states.keys())if(!seen.has(id))this.states.delete(id);
    this.update(this.time);
  }
  update(time=this.time,{reducedMotion}={}){
    if(this.disposed)return;
    this.time=Number.isFinite(time)?time:this.time;
    const still=reducedMotion??(typeof this.reducedMotion==='function'?this.reducedMotion():this.reducedMotion);
    this.clouds=this.clouds.filter(cloud=>this.time<cloud.born+cloud.lifetime);
    const alpha=this.object.geometry.attributes.cloudAlpha;let count=0;
    for(const cloud of this.clouds){
      const progress=THREE.MathUtils.clamp((this.time-cloud.born)/cloud.lifetime,0,1),spread=still?.12:.10+progress*.21;
      for(let i=0;i<this.puffsPerCloud;i++){
        const angle=i*Math.PI*2/this.puffsPerCloud,radius=i===0?0:spread;
        this.offset.set(Math.cos(angle)*radius,.11+(i%3)*.085+(still?0:progress*.18),Math.sin(angle)*radius).add(cloud.anchor);
        const size=(.13+(i%3)*.024)*(still?1:1+progress*.65);this.scale.set(size,size*.86,size);
        this.matrix.compose(this.offset,this.rotation,this.scale);this.object.setMatrixAt(count,this.matrix);
        alpha.setX(count,.40*(1-progress)*(cloud.kind==='arrival'?.75:1));count++;
      }
    }
    this.object.count=count;this.object.visible=count>0;this.object.instanceMatrix.needsUpdate=true;alpha.needsUpdate=true;
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.states.clear();this.clouds.length=0;
    this.object.geometry.dispose();this.object.material.dispose();this.object.dispose();this.object.removeFromParent();
    this.object.count=0;this.object.visible=false;
  }
}
