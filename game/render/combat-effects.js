import * as THREE from 'three';

const ROOTS=new Set(['druid','greenheart','eldergrove','mothernature','rangermentor']);
const DRAGONS=new Set(['embercrown','worldfire','thunderheart','phoenix']);
const STORMS=new Set(['stormcaller','tempest','stormcitadel','starfall']);
const SIEGE=new Set(['stonewarden','kingsreach','fireballista','royalarsenal','royalmarshal','griffinbomber']);
const MELEE=new Set(['soldier','frostblade','roseguard','highking','crownofages','kingdomprotector']);
const LOBBED=new Set(['stonewarden','royalmarshal','griffinbomber','royalarsenal']);
export const ATTACK_COLORS=Object.freeze({roots:'#78b957',flame:'#ff973f',lightning:'#a5dcff',melee:'#e7e9c5',siege:'#d9aa68',holy:'#fff0b3',frost:'#a1e2ef',arcane:'#bc9aef',arrow:'#eadbb5'});
export function attackVisualKind(family,stats={}){
  if(ROOTS.has(family))return 'roots';
  if(DRAGONS.has(family)||stats.type==='fire')return 'flame';
  if(STORMS.has(family))return 'lightning';
  if(stats.melee||MELEE.has(family))return 'melee';
  if(SIEGE.has(family)||stats.unitKind==='siege')return 'siege';
  if(stats.type==='holy')return 'holy';
  if(stats.type==='frost')return 'frost';
  if(['arcane','poison'].includes(stats.type))return 'arcane';
  return 'arrow';
}
const clampProgress=p=>THREE.MathUtils.clamp(Number.isFinite(p)?p:0,0,1);
const noRaycast=()=>{};
const material=(color,opacity=1,additive=false)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,toneMapped:false});
const mesh=(geometry,mat,name)=>{const object=new THREE.Mesh(geometry,mat);object.name=name;object.raycast=noRaycast;return object;};
const disposeObject=object=>{
  const geometries=new Set(),materials=new Set();
  object.traverse(node=>{if(node.isInstancedMesh)node.dispose();if(node.geometry)geometries.add(node.geometry);for(const m of Array.isArray(node.material)?node.material:[node.material])if(m)materials.add(m);});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());object.removeFromParent();
};
const fadeObject=(object,opacity)=>object.traverse(node=>{if(node.material)node.material.opacity=(node.material.userData.baseOpacity??1)*opacity;});
const sealMaterials=object=>object.traverse(node=>{if(node.material)node.material.userData.baseOpacity=node.material.opacity;node.raycast=noRaycast;});
const orientY=(object,start,end)=>{
  const delta=new THREE.Vector3().subVectors(end,start),length=delta.length();
  object.position.copy(start).add(end).multiplyScalar(.5);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),length>.0001?delta.multiplyScalar(1/length):new THREE.Vector3(0,1,0));
  object.scale.y=Math.max(.001,length);
};
function zigzag(color,name='Forked lightning'){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(10*3),3));
  const object=new THREE.Line(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity:.92,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));object.name=name;object.raycast=noRaycast;object.frustumCulled=false;return object;
}
function animateZigzag(object,start,end,clock=0,seed=0,motion=true){
  const positions=object.geometry.attributes.position,delta=new THREE.Vector3().subVectors(end,start);
  const sideways=new THREE.Vector3(delta.z,0,-delta.x).normalize();
  for(let i=0;i<10;i++){
    const t=i/9,envelope=Math.sin(t*Math.PI),jitter=Math.sin(i*9.17+seed+(motion?Math.floor(clock*18):0))*.14*envelope;
    positions.setXYZ(i,start.x+delta.x*t+sideways.x*jitter,start.y+delta.y*t+Math.cos(i*4.6+seed)*.08*envelope,start.z+delta.z*t+sideways.z*jitter);
  }positions.needsUpdate=true;
}
function groundRing(color,radius=.45){const ring=mesh(new THREE.RingGeometry(radius*.65,radius,32),material(color,.72,true),'Impact ground seal');ring.rotation.x=-Math.PI/2;ring.position.y=.06;return ring;}
function thorns(color){
  const object=new THREE.Group();object.name='Living roots under target';
  const geometry=new THREE.ConeGeometry(.065,.62,5),thorn=new THREE.InstancedMesh(geometry,material('#ffffff',.95),7),pose=new THREE.Object3D();
  thorn.name='Rising poisonous thorns';thorn.raycast=noRaycast;
  for(let i=0;i<7;i++){
    const a=i*Math.PI*2/7,r=.14+(i%2)*.10;
    pose.position.set(Math.cos(a)*r,.27,Math.sin(a)*r);pose.rotation.set(Math.sin(a)*.28,0,Math.cos(a)*-.28);pose.updateMatrix();thorn.setMatrixAt(i,pose.matrix);thorn.setColorAt(i,new THREE.Color(i%3?'#50652d':color));
  }object.add(thorn,groundRing(color,.35));return object;
}
function arrow(color){
  const object=new THREE.Group();object.name='Crafted arrow';
  const shaft=mesh(new THREE.CylinderGeometry(.009,.009,.52,5),material('#b79f73'),'Arrow shaft');shaft.rotation.x=Math.PI/2;object.add(shaft);
  const tip=mesh(new THREE.ConeGeometry(.032,.12,4),material(color),'Steel arrowhead');tip.rotation.x=Math.PI/2;tip.position.z=.30;object.add(tip);
  const feathers=mesh(new THREE.BoxGeometry(.08,.01,.12),material('#d8d9c8'),'Arrow fletching');feathers.position.z=-.22;object.add(feathers);return object;
}
function spell(kind,color){
  const object=new THREE.Group();object.name=`${kind} shaped spell`;
  const focus=mesh(kind==='frost'?new THREE.OctahedronGeometry(.13,0):new THREE.IcosahedronGeometry(.11,1),material(color,.92,true),`${kind} spell core`);object.add(focus);
  const ring=mesh(new THREE.TorusGeometry(.17,.012,4,18),material(color,.66,true),`${kind} spell orbit`);ring.rotation.x=Math.PI/2;object.add(ring);
  if(kind==='holy'){
    object.add(mesh(new THREE.BoxGeometry(.24,.027,.027),material(color,.88,true),'Holy spell cross'));
    object.add(mesh(new THREE.BoxGeometry(.027,.27,.027),material(color,.88,true),'Holy spell cross stem'));
  }else if(kind==='frost'){
    for(let i=0;i<4;i++){const shard=mesh(new THREE.ConeGeometry(.035,.25,4),material(color,.63,true),'Trailing frost shard');shard.position.set(Math.cos(i*Math.PI/2)*.12,Math.sin(i*Math.PI/2)*.12,-.12);shard.rotation.x=Math.PI/2;object.add(shard);}
  }else{const orbit=ring.clone();orbit.geometry=ring.geometry;orbit.material=ring.material;orbit.rotation.set(0,Math.PI/3,0);object.add(orbit);}
  return object;
}
function bomb(color){
  const object=new THREE.Group();object.name='Lobbed siege charge';
  object.add(mesh(new THREE.IcosahedronGeometry(.13,1),material('#44453b'),'Siege charge body'));
  const band=mesh(new THREE.TorusGeometry(.128,.012,4,12),material(color),'Charge iron binding');object.add(band);
  const fuse=mesh(new THREE.CylinderGeometry(.012,.012,.12,5),material('#eadcae'),'Visible bomb fuse');fuse.position.y=.17;fuse.rotation.z=-.28;object.add(fuse);
  const spark=mesh(new THREE.OctahedronGeometry(.035),material('#ffc064',.9,true),'Bomb fuse spark');spark.position.set(.015,.24,0);object.add(spark);return object;
}
function flameStream(color){
  const object=new THREE.Group();object.name='Dragon fire breath';
  const outer=mesh(new THREE.CylinderGeometry(.43,.09,1,8,3,true),material('#ed651b',.44),'Tapered dragon flame plume');object.add(outer);
  const inner=mesh(new THREE.CylinderGeometry(.21,.045,1,8,3,true),material(color,.35,true),'Hot flame core');object.add(inner);
  for(const shell of [outer,inner])shell.geometry.userData.flameRestPosition=new Float32Array(shell.geometry.attributes.position.array);
  const embers=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.15,1),material('#ff8b28',.87),7);embers.name='Breath flying embers';embers.raycast=noRaycast;embers.frustumCulled=false;object.add(embers);
  for(let i=0;i<7;i++)embers.setColorAt(i,new THREE.Color(i%3?'#ffffff':'#ffd09b'));
  return object;
}
const emberPose=new THREE.Object3D();
const impactPose=new THREE.Object3D();
function animateBreath(stream,clock,motion){
  // Each plume owns its vertices; small bends keep the broad flame alive without extra meshes.
  for(let shellIndex=0;shellIndex<2;shellIndex++){
    const shell=stream.children[shellIndex],positions=shell.geometry.attributes.position,rest=shell.geometry.userData.flameRestPosition;
    for(let i=0;i<positions.count;i++){
      const offset=i*3,t=rest[offset+1]+.5,envelope=t*.8+.2;
      const pulse=motion?1+Math.sin(clock*6.7+t*8+shellIndex)*.10:1;
      positions.setXYZ(i,rest[offset]*pulse+(motion?Math.sin(clock*4.7+t*7+shellIndex)*.055*envelope:0),rest[offset+1],rest[offset+2]*pulse+(motion?Math.cos(clock*5.1+t*9+shellIndex)*.045*envelope:0));
    }positions.needsUpdate=true;
  }
  const embers=stream.children[2];
  for(let i=0;i<7;i++){
    const t=motion?((clock+i/7)%1+1)%1:(i+.5)/7;
    emberPose.position.set(Math.sin(i*4.2+(motion?clock*.8:0))*(.055+t*.24),t-.5,Math.cos(i*3.1+(motion?clock*.7:0))*(.055+t*.24));
    const puff=.7+t*.75;emberPose.scale.set(puff,puff/Math.max(.001,stream.scale.y),puff);emberPose.updateMatrix();embers.setMatrixAt(i,emberPose.matrix);
  }embers.instanceMatrix.needsUpdate=true;
}
function slash(color){
  const object=new THREE.Group();object.name='Sweeping melee blade';
  const arc=mesh(new THREE.RingGeometry(.29,.43,20,1,0,Math.PI*1.3),material(color,.90,true),'Blade cut arc');arc.rotation.x=-Math.PI*.28;object.add(arc);return object;
}

/** Cosmetic presentation only; never updates projectile timing, targets or damage. */
export class CombatEffects{
  constructor(scene,{position=(x,y,z)=>new THREE.Vector3(x,y,z),sourceHeight=1.5,targetHeight=enemy=>enemy?.flying?1.9:enemy?.boss?1.4:1,
    getStats=()=>({}),isVisible=()=>true,reducedMotion=false,maxEffects=48,maxProjectiles=96}={}){
    this.scene=scene;this.position=position;this.sourceHeight=sourceHeight;this.targetHeight=targetHeight;this.getStats=getStats;this.isVisible=isVisible;this.reducedMotion=reducedMotion;
    this.maxEffects=Math.max(1,Math.floor(maxEffects));this.maxProjectiles=Math.max(1,Math.floor(maxProjectiles));this.effects=[];this.projectiles=new Map();this.disposed=false;this.time=0;
  }
  motion(){return !(typeof this.reducedMotion==='function'?this.reducedMotion():this.reducedMotion);}
  visible(target){return !target||this.isVisible(target)!==false;}
  point(target,height){return this.position(target.x,height,target.z);}
  addEffect(object,duration,animate,target=null){
    if(this.disposed||!this.visible(target)){disposeObject(object);return null;}
    while(this.effects.length>=this.maxEffects)this.removeEffect(this.effects[0]);
    sealMaterials(object);this.scene.add(object);const effect={object,duration,elapsed:0,animate,target};this.effects.push(effect);return effect;
  }
  removeEffect(effect){disposeObject(effect.object);const index=this.effects.indexOf(effect);if(index>=0)this.effects.splice(index,1);}
  removeProjectile(id){const record=this.projectiles.get(id);if(record){disposeObject(record.object);this.projectiles.delete(id);}}
  shot(shot){
    if(this.disposed||!shot?.source||!shot.target||!this.visible(shot.target))return null;
    if(this.projectiles.has(shot.id))return this.projectiles.get(shot.id);
    if(this.projectiles.size>=this.maxProjectiles)return null;
    const stats=shot.stats||this.getStats(shot.source),kind=attackVisualKind(shot.source.family,stats),color=ATTACK_COLORS[kind];
    const lobbed=kind==='siege'&&LOBBED.has(shot.source.family);
    const object=kind==='roots'?thorns(color):kind==='flame'?flameStream(color):kind==='lightning'?zigzag(color):kind==='melee'?slash(color):lobbed?bomb(color):kind==='arrow'||kind==='siege'?arrow(color):spell(kind,color);
    if(kind==='siege'&&!lobbed)object.scale.setScalar(1.4);
    sealMaterials(object);this.scene.add(object);const record={object,kind,shot,stats,color,lobbed};this.projectiles.set(shot.id,record);this.poseProjectile(record,this.time);return record;
  }
  poseProjectile(record,time){
    const {object,kind,shot,lobbed}=record,p=clampProgress(shot.progress),motion=this.motion();
    const start=this.point(shot.start||shot.source,this.sourceHeight),end=this.point(shot.target,this.targetHeight(shot.target));
    if(kind==='roots'){
      object.position.copy(this.point(shot.target,.03));object.scale.setScalar(1);object.scale.y=motion ? .16+.84*Math.sin(Math.min(1,p*1.35)*Math.PI/2) : .85;
    }else if(kind==='lightning'){
      animateZigzag(object,start,start.clone().lerp(end,Math.max(.08,p)),time,shot.id||0,motion);
    }else if(kind==='flame'){
      orientY(object,start,end);animateBreath(object,time*2.8,motion);
    }else if(kind==='melee'){
      object.position.copy(end);object.rotation.y=Math.atan2(end.x-start.x,end.z-start.z);object.rotation.z=motion?-.6+p*1.2:0;
      object.scale.setScalar(.85+Math.min(p,.8)*.4);
    }else{
      object.position.lerpVectors(start,end,p);
      if(lobbed)object.position.y+=Math.sin(p*Math.PI)*Math.min(2.3,1+start.distanceTo(end)*.12);
      else object.position.y+=Math.sin(p*Math.PI)*.13;
      object.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3().subVectors(end,start).normalize());
      if(motion&&kind!=='arrow'&&(kind!=='siege'||lobbed))object.rotateZ(time*(kind==='siege'?5:2));
    }
  }
  syncProjectiles(shots,time=this.time){
    if(this.disposed)return;this.time=Number.isFinite(time)?time%1e6:0;
    const visibleShots=shots.filter(shot=>this.visible(shot.target)).slice(0,this.maxProjectiles);
    const active=new Set(visibleShots.map(shot=>shot.id));
    for(const id of this.projectiles.keys())if(!active.has(id))this.removeProjectile(id);
    for(const shot of visibleShots){const record=this.shot(shot);if(record){record.shot=shot;this.poseProjectile(record,this.time);}}
  }
  impact(payload){
    if(this.disposed||!this.visible(payload.target))return;
    const stats=payload.stats||{},kind=attackVisualKind(payload.source?.family,stats),color=ATTACK_COLORS[kind];
    const centre=this.position(payload.x,.04,payload.z),radius=Math.min(1.1,Math.max(.28,payload.radius||.4));
    const object=kind==='roots'?thorns(color):new THREE.Group();object.name=`${kind} attack impact`;object.position.copy(centre);
    if(kind!=='roots')object.add(groundRing(color,radius));
    if(kind!=='roots'){
      const shardGeometry=kind==='frost'?new THREE.ConeGeometry(.035,.24,4):new THREE.OctahedronGeometry(.044,0),sparkMat=material(color,.88,true);
      const sparks=new THREE.InstancedMesh(shardGeometry,sparkMat,8);sparks.name=`${kind} impact sparks`;sparks.raycast=noRaycast;sparks.frustumCulled=false;object.add(sparks);
    }
    const duration=kind==='roots' ? .62 : kind==='siege'||kind==='flame' ? .48 : .28;
    this.addEffect(object,duration,(effect,p,motion)=>{
      if(kind==='roots'){effect.scale.y=motion?Math.sin(p*Math.PI)*1.15:.8;}
      else{
        effect.children[0].scale.setScalar(motion ? .55+p*1.15 : 1);
        const sparks=effect.children[1],pose=impactPose;
        for(let i=0;i<8;i++){
          const a=i*Math.PI/4,r=motion?radius*(.15+p*.85):radius*.5;
          pose.position.set(Math.cos(a)*r,motion ? .13+Math.sin(p*Math.PI)*.32 : .2,Math.sin(a)*r);pose.updateMatrix();sparks.setMatrixAt(i,pose.matrix);
        }sparks.instanceMatrix.needsUpdate=true;
      }
      fadeObject(effect,1-p);
    },payload.target);
  }
  breath(payload){
    if(!payload.source||!payload.target||!this.visible(payload.target))return;
    const object=flameStream(ATTACK_COLORS.flame),start=this.point(payload.source,this.sourceHeight),end=this.point(payload.target,this.targetHeight(payload.target));
    orientY(object,start,end);
    this.addEffect(object,.57,(effect,p,motion)=>{
      // Follow the target without changing its combat location or the actor's aim.
      orientY(effect,this.point(payload.source,this.sourceHeight),this.point(payload.target,this.targetHeight(payload.target)));
      animateBreath(effect,p*2,motion);
      fadeObject(effect,Math.sin(Math.PI*Math.min(1,p*1.1))*.85);
    },payload.target);
  }
  chain(payload){
    if(!payload.from||!payload.to||!this.visible(payload.from)||!this.visible(payload.to))return;
    const object=zigzag(payload.color||ATTACK_COLORS.lightning,'Jumping elemental lightning');
    this.addEffect(object,.24,(effect,p,motion)=>{animateZigzag(effect,this.point(payload.from,.9),this.point(payload.to,this.targetHeight(payload.to)),this.time,payload.to.id||0,motion);fadeObject(effect,1-p);},payload.to);
  }
  event(type,payload={}){
    if(this.disposed)return;
    if(type==='shot')this.shot(payload);
    else if(type==='impact')this.impact(payload);
    else if(type==='aura-attack'&&attackVisualKind(payload.source?.family,payload.stats||this.getStats(payload.source))==='flame')this.breath(payload);
    else if(type==='chain')this.chain(payload);
  }
  update(dt,time=this.time){
    if(this.disposed)return;this.time=Number.isFinite(time)?time%1e6:0;const elapsed=Number.isFinite(dt)?Math.max(0,dt):0;
    for(const effect of [...this.effects]){
      effect.elapsed+=elapsed;
      if(effect.elapsed>=effect.duration||!this.visible(effect.target)){this.removeEffect(effect);continue;}
      effect.animate(effect.object,clampProgress(effect.elapsed/effect.duration),this.motion());
    }
  }
  dispose(){if(this.disposed)return;for(const id of [...this.projectiles.keys()])this.removeProjectile(id);for(const effect of [...this.effects])this.removeEffect(effect);this.disposed=true;}
}
