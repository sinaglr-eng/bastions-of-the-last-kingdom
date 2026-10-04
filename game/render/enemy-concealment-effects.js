import * as THREE from 'three';

// Visibility is supplied by CombatManager.isRevealed. A departure owns only its
// last public point AND body bounds: no hidden actor, health, glyph or model
// reference. Lifetime uses combat time; billowing may use an unpaused clock.
const vertex=`
  attribute float cloudAlpha;
  varying float alpha;varying float shade;
  void main(){
    vec4 viewPosition=modelViewMatrix*instanceMatrix*vec4(position,1.0);
    float rim=abs(dot(normalize(normalMatrix*normal),normalize(-viewPosition.xyz)));
    alpha=cloudAlpha*(.3+.7*smoothstep(0.0,.65,rim));shade=.76+.24*abs(normal.y);
    gl_Position=projectionMatrix*viewPosition;
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
    this.maxClouds=Math.max(1,Math.min(64,Math.floor(maxClouds)||24));this.puffsPerCloud=10;
    this.states=new Map();this.clouds=[];this.time=0;this.cosmeticTime=0;this.disposed=false;
    const capacity=this.maxClouds*this.puffsPerCloud,geometry=new THREE.IcosahedronGeometry(1,1);
    geometry.setAttribute('cloudAlpha',new THREE.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(THREE.DynamicDrawUsage));
    const material=new THREE.ShaderMaterial({uniforms:{tint:{value:new THREE.Color('#82909c')}},vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,depthTest:true,toneMapped:false});
    this.object=new THREE.InstancedMesh(geometry,material,capacity);this.object.name='Bounded last-visible concealment smoke';
    this.object.count=0;this.object.visible=false;this.object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.object.frustumCulled=false;this.object.raycast=noPick;this.object.renderOrder=7;scene.add(this.object);
    this.matrix=new THREE.Matrix4();this.rotation=new THREE.Quaternion();this.scale=new THREE.Vector3();this.offset=new THREE.Vector3();this.centre=new THREE.Vector3();this.extent=new THREE.Vector3();
  }
  captureBounds(figures,id,anchor){
    // Called only for an actually revealed unit. HP bars and runtime auras are
    // siblings of body, so they cannot accidentally enlarge the smoke.
    const figure=figures?.get(id),body=figure?.userData?.body||figure;
    let bounds;
    if(body){body.updateWorldMatrix(true,true);bounds=new THREE.Box3().setFromObject(body);}
    if(!bounds||bounds.isEmpty()||![...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite)){
      bounds=new THREE.Box3(anchor.clone().add(new THREE.Vector3(-.5,-.12,-.5)),anchor.clone().add(new THREE.Vector3(.5,1.58,.5)));
    }
    const centre=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
    if(size.x>=.35&&size.y>=.65&&size.z>=.35)return bounds;
    size.set(Math.max(.35,size.x),Math.max(.65,size.y),Math.max(.35,size.z));
    return new THREE.Box3().setFromCenterAndSize(centre,size);
  }
  emit(anchor,bounds,kind){
    // Copy public numeric geometry, never retain the enemy, model or its id.
    if(this.clouds.length===this.maxClouds)this.clouds.shift();
    this.clouds.push({anchor:anchor.clone(),bounds:bounds.clone(),kind,born:this.time,cosmeticBorn:this.cosmeticTime,lifetime:kind==='departure'?.65:.45});
  }
  sync(enemies,{time=this.time,cosmeticTime=time,figures,active=true}={}){
    if(this.disposed)return;
    if(Number.isFinite(time)&&time<this.time){this.states.clear();this.clouds.length=0;}
    this.time=Number.isFinite(time)?time:this.time;
    this.cosmeticTime=Number.isFinite(cosmeticTime)?cosmeticTime:this.cosmeticTime;
    if(!active){this.states.clear();this.clouds.length=0;this.update(this.time,{cosmeticTime:this.cosmeticTime});return;}
    const seen=new Set();
    for(const enemy of enemies){
      if(enemy.dead)continue;const id=enemy.id;seen.add(id);
      const visible=!!this.isVisible(enemy),previous=this.states.get(id);
      if(!visible){
        if(previous?.visible&&previous.last)this.emit(previous.last,previous.bounds,'departure');
        this.states.set(id,{visible:false});continue;
      }
      // Coordinates are sampled only after actual shared reveal succeeds.
      if(!Number.isFinite(enemy.x)||!Number.isFinite(enemy.z)){this.states.delete(id);continue;}
      const point=this.position(enemy.x,enemy.flying?.8:.12,enemy.z);
      const bounds=this.captureBounds(figures,id,point);
      if(previous&&!previous.visible)this.emit(point,bounds,'arrival');
      this.states.set(id,{visible:true,last:point.clone(),bounds});
    }
    for(const id of this.states.keys())if(!seen.has(id))this.states.delete(id);
    this.update(this.time,{cosmeticTime:this.cosmeticTime});
  }
  update(time=this.time,{cosmeticTime=time,reducedMotion}={}){
    if(this.disposed)return;
    this.time=Number.isFinite(time)?time:this.time;
    this.cosmeticTime=Number.isFinite(cosmeticTime)?cosmeticTime:this.cosmeticTime;
    const still=reducedMotion??(typeof this.reducedMotion==='function'?this.reducedMotion():this.reducedMotion);
    this.clouds=this.clouds.filter(cloud=>this.time<cloud.born+cloud.lifetime);
    const alpha=this.object.geometry.attributes.cloudAlpha;let count=0;
    for(const cloud of this.clouds){
      const progress=THREE.MathUtils.clamp((this.time-cloud.born)/cloud.lifetime,0,1),growth=still?1:1+progress*.1;
      cloud.bounds.getCenter(this.centre);cloud.bounds.getSize(this.extent);
      const clock=still?0:(this.cosmeticTime-cloud.cosmeticBorn)%1e6;
      for(let i=0;i<this.puffsPerCloud;i++){
        const core=i===0,row=core?0:Math.floor((i-1)/3)-1,angle=core?0:(i-1)%3*Math.PI*2/3+row*.6;
        const drift=still?0:Math.sin(clock*1.8+i*.73)*.025;
        this.offset.set((core?0:Math.cos(angle)*.16)+drift,row*.30+(still?0:Math.sin(clock*1.3+i)*.025),(core?0:Math.sin(angle)*.16)-drift).multiply(this.extent).add(this.centre);
        const swell=still?1:1+.04*Math.sin(clock*1.7+i);
        this.scale.set(this.extent.x*(core?.78:.50),this.extent.y*(core?.68:.32),this.extent.z*(core?.78:.50)).multiplyScalar(growth*swell);
        this.matrix.compose(this.offset,this.rotation,this.scale);this.object.setMatrixAt(count,this.matrix);
        alpha.setX(count,.56*(1-progress)*(cloud.kind==='arrival'?.8:1));count++;
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
