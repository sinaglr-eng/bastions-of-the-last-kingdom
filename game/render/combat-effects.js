import * as THREE from 'three';
import {CombatPathBatch,electricPathSegments,electricRadius,electricPulse} from './combat-path-batch.js';
import {factionAttackVisualKind,factionAttackVisualStyle,factionWeaponVisual} from './faction-attack-visuals.js';
import {createAttackProjectile,createAttackImpact,animateAttackImpact,createFlameStream,animateFlameStream,animateProjectileDecoration,animateSilk,createFireSplash,animateFireSplash} from './attack-vfx-primitives.js';

const ROOTS=new Set(['druid','greenheart','eldergrove','mothernature','rangermentor']);
const DRAGONS=new Set(['embercrown','worldfire','thunderheart','phoenix']);
const STORMS=new Set(['stormcaller','tempest','stormcitadel','starfall']);
const SIEGE=new Set(['stonewarden','kingsreach','fireballista','royalarsenal','royalmarshal','griffinbomber']);
const MELEE=new Set(['soldier','frostblade','roseguard','highking','crownofages','kingdomprotector']);
const LOBBED=new Set(['stonewarden','royalmarshal','griffinbomber','royalarsenal']);
export const ATTACK_COLORS=Object.freeze({roots:'#78b957',flame:'#ff973f',lightning:'#a5dcff',melee:'#e7e9c5',thrust:'#e7e9c5',siege:'#d9aa68',holy:'#fff0b3',frost:'#a1e2ef',arcane:'#bc9aef',arrow:'#eadbb5',runic:'#e1ba7d',stone:'#95a779',dart:'#a3d96d',venomArrow:'#95ce73',hammer:'#e7ddb0',axe:'#f3d59b',pick:'#bdd8e2',bullet:'#ffd295',bulletRapid:'#ffba68',shell:'#edb373',cannon:'#f4aa65',grenade:'#ffac5a',drum:'#edc587',treeSlam:'#86b75a',web:'#c4a6ef',moon:'#c3b7ff',stormSpear:'#83dfff',claw:'#e7d3a7',forge:'#ffad52'});
const secretFamily=family=>family==='ladyclaire'||family==='lordbernhard';
export const attackVisualStyle=(family,stats={})=>{
  const style=factionAttackVisualStyle(family,stats),kind=attackVisualKind(family,stats);
  return {...style,kind,element:['lightning','stormSpear'].includes(kind)?'lightning':kind==='flame'?'fire':kind==='roots'?'poison':kind==='frost'?'frost':kind==='holy'?'holy':style.element};
};
export const attackVisualColor=(family,kind,stats={})=>{
  if(secretFamily(family))return '#ffda72';
  const style=attackVisualStyle(family,stats),elementColors={lightning:'#99e8ff',frost:'#b6f1ff',poison:'#a3d96d',fire:'#ffab4f',holy:'#fff0b3',lunar:'#c3b7ff',rune:stats.type==='physical'?'#e1ba7d':'#b9d4ff',arcane:'#bda2ff'};
  return elementColors[style.element]||ATTACK_COLORS[kind]||ATTACK_COLORS.arrow;
};
export function attackVisualKind(family,stats={}){
  const faction=factionAttackVisualKind(family,stats);if(faction)return faction;
  const presentation=stats.projectileEffect||stats.effect||stats.type;
  if(family==='royalarsenal')return 'arcane';
  if(['rimewatch','winterhold','archangel'].includes(family))return 'frost';
  if(family==='kingdomprotector')return 'holy';
  if(family==='runebreaker')return 'runic';
  if(family==='emeraldgolem')return 'stone';
  if(family==='mechanicalgolem')return 'dart';
  if(family==='thunderheart')return 'lightning';
  if(family==='royalranger')return 'venomArrow';
  if(family==='kingdomprotector')return 'hammer';
  if(ROOTS.has(family))return 'roots';
  if(DRAGONS.has(family)||presentation==='fire')return 'flame';
  if(STORMS.has(family))return 'lightning';
  if(stats.melee||MELEE.has(family))return 'melee';
  if(SIEGE.has(family)||stats.unitKind==='siege')return 'siege';
  if(presentation==='holy')return 'holy';
  if(presentation==='frost')return 'frost';
  if(['arcane','poison','magical'].includes(presentation))return 'arcane';
  return 'arrow';
}
const clampProgress=p=>THREE.MathUtils.clamp(Number.isFinite(p)?p:0,0,1);
const presentTarget=target=>!target?.dead&&!target?.escaped&&!target?.removed;
const noRaycast=()=>{};
const material=(color,opacity=1,additive=false)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,toneMapped:false});
const mesh=(geometry,mat,name)=>{const object=new THREE.Mesh(geometry,mat);object.name=name;object.raycast=noRaycast;return object;};
const disposeObject=object=>{
  const geometries=new Set(),materials=new Set();
  object.traverse(node=>{if(node.isInstancedMesh)node.dispose();if(node.geometry)geometries.add(node.geometry);for(const m of Array.isArray(node.material)?node.material:[node.material])if(m)materials.add(m);});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());object.removeFromParent();
};
const fadeObject=(object,opacity)=>object.traverse(node=>{if(node.material){node.material.opacity=(node.material.userData.baseOpacity??1)*opacity;if(node.material.uniforms?.opacity)node.material.uniforms.opacity.value=node.material.opacity;}});
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
function electricity(color,name){
  const object=new THREE.Group();object.name=name;object.userData.electric=true;
  // Diagnostic centreline retains the exact moving muzzle/target connection.
  object.geometry=new THREE.BufferGeometry();object.geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(30),3));
  const coronaColor=new THREE.Color(color);if(coronaColor.b>coronaColor.r*.9)coronaColor.lerp(new THREE.Color('#268fe8'),.55);
  // The normal-blended white centre survives pale paths where additive light clips away.
  const geometry=new THREE.CylinderGeometry(1,1,1,7),corona=new THREE.InstancedMesh(geometry,material(coronaColor,.40),15),core=new THREE.InstancedMesh(geometry,material('#f4fdff',.99),15);
  corona.name='Volumetric electric corona and forks';core.name='Bright white electric core and forks';
  for(const layer of [corona,core]){layer.raycast=noRaycast;layer.frustumCulled=false;layer.instanceMatrix.setUsage(THREE.DynamicDrawUsage);object.add(layer);}
  return object;
}
const electricPose=new THREE.Object3D(),electricUp=new THREE.Vector3(0,1,0);
function animateElectricity(object,start,end,{clock=0,seed=0,motion=true,progress=0,radius=.03}={}){
  const {points,segments}=electricPathSegments(start,end,{clock,seed,motion}),positions=object.geometry.attributes.position,pulse=electricPulse(progress,motion);
  points.forEach((point,index)=>positions.setXYZ(index,point.x,point.y,point.z));positions.needsUpdate=true;
  object.children.forEach((layer,lane)=>{const width=radius*(lane?.68:3);layer.count=segments.length;layer.material.opacity=(lane?.98:.34)*pulse;
    segments.forEach(([a,b],index)=>{const delta=b.clone().sub(a),length=delta.length();electricPose.position.copy(a).add(b).multiplyScalar(.5);electricPose.quaternion.setFromUnitVectors(electricUp,length>1e-8?delta.multiplyScalar(1/length):electricUp);electricPose.scale.set(width,Math.max(.001,length),width);electricPose.updateMatrix();layer.setMatrixAt(index,electricPose.matrix);});layer.instanceMatrix.needsUpdate=true;
  });
}
/** Cosmetic presentation only; never updates projectile timing, targets or damage. */
export class CombatEffects{
  constructor(scene,{position=(x,y,z)=>new THREE.Vector3(x,y,z),sourceHeight=1.5,targetHeight=enemy=>enemy?.flying?1.9:enemy?.boss?1.4:1,
    getStats=()=>({}),getMuzzle=null,getSimulationTime=null,isVisible=()=>true,reducedMotion=false,camera=null,getViewport=null,maxEffects=48,maxProjectiles=96,maxDetailed=192,maxBreaths=8}={}){
    this.scene=scene;this.position=position;this.sourceHeight=sourceHeight;this.targetHeight=targetHeight;this.getStats=getStats;this.getMuzzle=getMuzzle;this.getSimulationTime=getSimulationTime;this.isVisible=isVisible;this.reducedMotion=reducedMotion;
    this.maxEffects=Math.max(1,Math.floor(maxEffects));this.maxProjectiles=Math.max(1,Math.floor(maxProjectiles));this.effects=[];this.projectiles=new Map();this.disposed=false;this.time=0;
    this.camera=camera;this.getViewport=getViewport;this.maxDetailed=maxDetailed;this.maxBreaths=maxBreaths;this.paths=new CombatPathBatch(scene,{camera,getViewport});this.procPaths=[];this.fireSplashPaths=[];this.channels=new Map();this.resolved=new WeakMap();this.dreadAccents=new Map();
  }
  motion(){return !(typeof this.reducedMotion==='function'?this.reducedMotion():this.reducedMotion);}
  visible(target){return !target||this.isVisible(target)!==false;}
  animationClock(source,time=this.time){const simulation=this.getSimulationTime?.();return Number.isFinite(simulation)?simulation:time;}
  point(target,height){return this.position(target.x,height,target.z);}
  electricOptions(start,end,options={}){return {radius:electricRadius(start,end,typeof this.camera==='function'?this.camera():this.camera,this.getViewport?.()?.height),...options};}
  muzzle(source,fallback=source,options={}){
    const authored=factionWeaponVisual(source?.family),native=authored&&(authored.factionId!=='crown'||this.getStats(source)?.factionId==='crown');
    const kind=native?authored.motion==='bow-shot'?'nock':authored.motion==='staff-cast'?'staff':authored.motion==='hand-cast'?'hand':['dragon-breath','beak-strike'].includes(authored.motion)?'mouth':'weapon':['stormcaller','tempest','stormcitadel'].includes(source?.family)?'hand':['embercrown','worldfire','thunderheart','phoenix','starfall'].includes(source?.family)?'mouth':['archer','thornwarden','verdantguard','royalranger','wyvernhunter','kingsrangerguard','elvenking'].includes(source?.family)?'nock':['mage','cleric','druid','frostwarden','royalarsenal','greenheart','eldergrove','mothernature','rangermentor','sunward','monk','archbishop','archangel','ladyclaire'].includes(source?.family)?'staff':'weapon';
    const out=new THREE.Vector3(),point=this.getMuzzle?.(source,out,{kind,...options});
    return point&&[point.x,point.y,point.z].every(Number.isFinite)?out.copy(point):this.point(fallback,this.sourceHeight);
  }
  addEffect(object,duration,animate,target=null){
    if(this.disposed||!this.visible(target)){disposeObject(object);return null;}
    while(this.effects.length&&(this.effects.length>=this.maxEffects||this.effects.length+this.projectiles.size>=this.maxDetailed))this.removeEffect(this.effects[0],true);
    if(this.effects.length+this.projectiles.size>=this.maxDetailed){disposeObject(object);return null;}
    sealMaterials(object);this.scene.add(object);const createdAt=this.getSimulationTime?.(),effect={object,duration,elapsed:0,createdAt:Number.isFinite(createdAt)?createdAt:null,animate,target};this.effects.push(effect);return effect;
  }
  removeEffect(effect,fallback=false){if(fallback&&effect.pathPacket&&this.procPaths.length<4096)this.procPaths.push({payload:effect.pathPacket,at:effect.createdAt??this.time});if(fallback&&effect.fireSplashPacket)this.queueFireSplash(effect.fireSplashPacket);disposeObject(effect.object);const index=this.effects.indexOf(effect);if(index>=0)this.effects.splice(index,1);}
  removeProjectile(id){const record=this.projectiles.get(id);if(record){disposeObject(record.object);this.projectiles.delete(id);}}
  shot(shot){
    if(this.disposed||!shot?.source||!shot.target||!this.visible(shot.target))return null;
    if(this.projectiles.has(shot.id))return this.projectiles.get(shot.id);
    if(this.projectiles.size>=this.maxProjectiles||this.projectiles.size+this.effects.length>=this.maxDetailed)return null;
    const stats=shot.stats||this.getStats(shot.source),damageKind=attackVisualKind(shot.source.family,stats);
    if(!(stats.damage>0)&&stats.burnAura&&!stats.continuousAttack)return null;
    // These approved physical weapons stab along their shaft. Keep the same
    // combat packet and timing while displaying a narrow forward impact.
    const spear=damageKind==='melee'&&['soldier','frostblade','roseguard'].includes(shot.source.family);
    const kind=spear?'thrust':damageKind,color=attackVisualColor(shot.source.family,kind,stats),style=attackVisualStyle(shot.source.family,stats);
    const lobbed=['grenade','shell'].includes(kind)||kind==='siege'&&LOBBED.has(shot.source.family),physicalBolt=false;
    if(kind==='flame'&&this.breathCount()>=this.maxBreaths)return null;
    const object=['lightning','stormSpear'].includes(kind)?electricity(color,kind==='stormSpear'?'Storm-spear tip discharge':'Primary electric shot'):createAttackProjectile(kind,color,{style,family:shot.source.family,lobbed});
    if(kind==='dart')object.name='Hand-thrown toxic canister';
    if(kind==='runic'&&style.damageType==='magical')object.name='Weapon-released magical rune bolt';
    if(kind==='forge')object.name='Forge-released hot metal fragment';
    if(kind==='pick')object.name='Pickaxe contact sparks';
    if(kind==='claw')object.name='Claw contact streaks';
    if(shot.source.family==='stonewarden')object.name='Sling-released catapult stone';
    if(secretFamily(shot.source.family))object.name=shot.source.family==='lordbernhard'?'Sword-released golden magical bolt':'Staff-released golden spell';
    if(['arrow','venomArrow','siege'].includes(kind)&&style.element==='lightning')object.add(electricity(color,'Weapon-bound electric arrowhead'));
    object.userData.attackVisualStyle=style;sealMaterials(object);this.scene.add(object);const record={object,kind,shot,stats,color,style,lobbed,physicalBolt,origin:this.muzzle(shot.source,shot.start||shot.source)};this.projectiles.set(shot.id,record);this.poseProjectile(record,this.time);
    if(['bullet','bulletRapid','cannon','shell'].includes(kind)){
      const flash=new THREE.Group();flash.name='Actual muzzle flash';
      const outer=mesh(new THREE.ConeGeometry(kind==='cannon'?.13:.055,.27,6),material('#ffb44e',.7),'Powder muzzle petals'),hot=mesh(new THREE.ConeGeometry(kind==='cannon'?.065:.025,.17,5),material('#fff5d0',.95),'Hot muzzle centre');
      for(const part of [outer,hot]){part.rotation.z=Math.PI;part.position.y=.12;flash.add(part);}
      const smoke=mesh(new THREE.SphereGeometry(kind==='cannon'?.13:.065,8,6),material('#92928b',.13),'Brief powder smoke');smoke.position.y=.15;flash.add(smoke);
      const end=this.point(shot.target,this.targetHeight(shot.target));flash.position.copy(record.origin);flash.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(record.origin).normalize());
      const flashRecord=this.addEffect(flash,.18,(o,p,motion)=>{const light=Math.max(0,1-p*3.2);outer.material.opacity=.7*light;hot.material.opacity=.95*light;smoke.material.opacity=.13*Math.sin(Math.PI*p)*(1-p*.3);smoke.position.y=.15+(motion?p*.16:0);smoke.scale.setScalar(.7+(motion?p:0)*1.1);},shot.target);if(flashRecord)flashRecord.animate(flash,0,this.motion());
    }
    if(['arcane','holy','frost'].includes(kind)&&!physicalBolt)this.magicWave(record.origin,this.point(shot.target,this.targetHeight(shot.target)),color,shot.target);
    return record;
  }
  magicWave(start,end,color,target){
    const object=mesh(new THREE.TorusGeometry(.16,.017,4,24),material(color,.82,true),'Staff-tip released magic wave');object.position.copy(start);
    const direction=end.clone().sub(start).normalize();object.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);
    this.addEffect(object,.32,(effect,p,motion)=>{effect.position.copy(start).addScaledVector(direction,motion?p*.7:.18);effect.scale.setScalar(motion ? .45+p*2.7 : 1.8);fadeObject(effect,1-p);},target);
  }
  poseProjectile(record,time){
    const {object,kind,shot,lobbed}=record,p=clampProgress(shot.progress),motion=this.motion();
    time=this.animationClock(shot.source,time);
    // A connected electrical discharge follows its actual posed release surface
    // throughout recovery, just like breath follows the moving mouth.
    const start=['flame','lightning','stormSpear','web'].includes(kind)?this.muzzle(shot.source,shot.start||shot.source):record.origin,end=this.point(shot.target,this.targetHeight(shot.target));
    if(['lightning','stormSpear'].includes(kind)){
      const tip=start.clone().lerp(end,Math.max(.08,p));animateElectricity(object,start,tip,this.electricOptions(start,tip,{clock:time,seed:shot.id||0,motion,progress:p}));
    }else if(kind==='web'){
      animateSilk(object,start,start.clone().lerp(end,Math.max(.08,p)),time,motion);
    }else if(kind==='flame'){
      orientY(object,start,end);animateFlameStream(object,time*2.8,motion);
    }else if(kind==='hammer'){
      object.position.copy(end);object.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),end.clone().sub(start).normalize());object.scale.setScalar(motion ? .65+p*.35 : .85);
    }else if(kind==='thrust'){
      const direction=new THREE.Vector3().subVectors(end,start).normalize();
      object.position.copy(end).addScaledVector(direction,-.16);object.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);object.scale.setScalar(motion?.72+p*.35:1);
    }else if(['melee','axe','pick','claw','treeSlam'].includes(kind)){
      object.position.copy(end);object.rotation.y=Math.atan2(end.x-start.x,end.z-start.z);object.rotation.z=motion?-.6+p*1.2:0;
      object.scale.setScalar(.85+Math.min(p,.8)*.4);
    }else{
      object.position.lerpVectors(start,end,p);
      if(lobbed)object.position.y+=Math.sin(p*Math.PI)*Math.min(2.3,1+start.distanceTo(end)*.12);
      else object.position.y+=Math.sin(p*Math.PI)*.13;
      object.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3().subVectors(end,start).normalize());
      if(motion&&!record.physicalBolt&&!['arrow','venomArrow','dart','bullet','bulletRapid','cannon','shell'].includes(kind)&&(kind!=='siege'||lobbed))object.rotateZ(time*(kind==='siege'?3:.8));
    }
    // A contact strip is a strike, never a projectile visible at a distant target before arrival.
    if(object.userData.contact){object.visible=p>=.72;fadeObject(object,motion?Math.min(1,Math.max(0,(p-.72)/.12)):1);}
    animateProjectileDecoration(object,time,motion);
    // Keep the actual short arrow/bullet silhouette visible at overview zoom;
    // only its transverse thickness grows, never its path, length or lifetime.
    let transverse=1;
    if(!lobbed&&['arrow','venomArrow','siege','bullet','bulletRapid'].includes(kind)){
      const camera=typeof this.camera==='function'?this.camera():this.camera;
      transverse=camera?Math.max(1,Math.min(3.2,electricRadius(start,end,camera,this.getViewport?.()?.height)/.012)):1;
      object.scale.set(transverse,transverse,1);
    }
    const electricArrow=object.getObjectByName('Weapon-bound electric arrowhead');
    if(electricArrow){electricArrow.scale.set(1/transverse,1/transverse,1);animateElectricity(electricArrow,new THREE.Vector3(0,0,-.42),new THREE.Vector3(0,0,.30),{clock:time,seed:shot.id||0,motion,progress:p,radius:.023});}
  }
  syncProjectiles(shots,time=this.time){
    if(this.disposed)return;this.time=Number.isFinite(time)?time%1e6:0;
    for(const effect of [...this.effects])if(!this.visible(effect.target))this.removeEffect(effect);
    const visibleShots=shots.filter(shot=>{const s=shot.stats||this.getStats(shot.source);return this.visible(shot.target)&&!(!(s.damage>0)&&s.burnAura&&!s.continuousAttack);});
    const active=new Set(visibleShots.map(shot=>shot.id));
    for(const id of this.projectiles.keys())if(!active.has(id))this.removeProjectile(id);
    const paths=[];
    for(const shot of visibleShots){const record=this.shot(shot);if(record){record.shot=shot;this.poseProjectile(record,this.time);}else{
      const stats=shot.stats||this.getStats(shot.source),from=this.muzzle(shot.source,shot.start||shot.source),end=this.point(shot.target,this.targetHeight(shot.target)),kind=attackVisualKind(shot.source.family,stats),progress=clampProgress(shot.progress),to=from.clone().lerp(end,['lightning','stormSpear','web'].includes(kind)?Math.max(.08,progress):progress),lobbed=['grenade','shell'].includes(kind)||kind==='siege'&&LOBBED.has(shot.source.family);
      if(lobbed)to.y+=Math.sin(progress*Math.PI)*Math.min(2.3,1+from.distanceTo(end)*.12);
      paths.push({from,to,target:end,kind,subtype:kind==='siege'&&lobbed?'catapult-stone':null,style:attackVisualStyle(shot.source.family,stats),color:attackVisualColor(shot.source.family,kind,stats),progress,seed:shot.id||0,clock:this.animationClock(shot.source),motion:this.motion()});
    }}
    this.procPaths=this.procPaths.filter(row=>this.animationClock(null)-row.at<.24&&presentTarget(row.payload.from)&&presentTarget(row.payload.to)&&this.visible(row.payload.from)&&this.visible(row.payload.to));
    for(const row of this.procPaths){const p=row.payload,style=this.chainStyle(p);paths.push({from:p.from.family?this.muzzle(p.from):this.point(p.from,this.targetHeight(p.from)),to:this.point(p.to,this.targetHeight(p.to)),target:this.point(p.to,this.targetHeight(p.to)),...style,ricochet:style.ricochet,progress:(this.animationClock(null)-row.at)/.24,seed:p.to.id||0,clock:this.animationClock(null),motion:this.motion()});}
    for(const [id,row] of this.channels){
      // Native continuous cones emit once per combat step. Missing that step is stop, not lingering damage.
      if(this.animationClock(null)-row.at>1e-5||row.payload.target.dead||row.payload.source.attackPaused||row.payload.source.state&&row.payload.source.state!=='active'||!this.visible(row.payload.target)){this.channels.delete(id);for(const effect of [...this.effects])if(effect.channelId===id)this.removeEffect(effect);continue;}
      if(!this.effects.some(e=>e.channelId===id)){const paired=factionWeaponVisual(row.payload.source.family)?.weapon==='paired-flame-nozzles';for(let lane=0;lane<(paired?2:1);lane++)paths.push({from:this.muzzle(row.payload.source,row.payload.source,{breath:true,lane}),to:this.point(row.payload.target,this.targetHeight(row.payload.target)),kind:'flame',color:ATTACK_COLORS.flame,motion:this.motion(),clock:this.animationClock(null)});}
    }
    this.fireSplashPaths=this.fireSplashPaths.filter(row=>this.animationClock(null)-row.at<.40&&this.visible(row.target));
    const splashPaths=this.fireSplashPaths.map(row=>({kind:'fire-splash',from:row.centre,to:row.centre,radius:row.radius,eruption:row.eruption,victims:row.victims.filter(e=>presentTarget(e)&&this.visible(e)).map(e=>this.point(e,this.targetHeight(e))),progress:clampProgress((this.animationClock(null)-row.at)/.40),motion:this.motion(),color:'#ffad52'}));
    paths.unshift(...splashPaths); // Rare confirmed procs retain their typed cue even under the projectile budget.
    this.paths.sync(paths);
  }
  impact(payload){
    if(this.disposed||!this.visible(payload.target))return;
    const stats=payload.stats||this.getStats(payload.source)||{},kind=payload.effect==='fire'||payload.aura&&stats.burnAura?'flame':payload.effect==='poison'?'roots':attackVisualKind(payload.source?.family,{...stats,projectileEffect:payload.effect||stats.projectileEffect}),color=attackVisualColor(payload.source?.family,kind,{...stats,projectileEffect:payload.effect||stats.projectileEffect});
    if(payload.aura)return; // Sparse actual victim heat belongs to the reconciled status batch.
    const result=this.resolved.get(payload.target)?.get(payload.source?.id),blocked=result&&result.effectiveDamage<=0;
    const centre=payload.target?this.point(payload.target,this.targetHeight(payload.target)):this.position(payload.x,.04,payload.z),radius=blocked?.18:Math.min(.55,Math.max(.18,payload.radius||.3)),tint=blocked?'#9aa6a4':color;
    const style=attackVisualStyle(payload.source?.family,stats),object=createAttackImpact(kind,tint,{blocked,radius,element:style.element,heavy:payload.heavy});object.position.copy(centre);
    const direction=payload.source?centre.clone().sub(this.muzzle(payload.source)).normalize():new THREE.Vector3(0,0,1);object.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);
    const duration=blocked?.18:kind==='roots'?.32:['siege','cannon','shell','grenade'].includes(kind)?.36:.23;
    this.addEffect(object,duration,(effect,p,motion)=>{
      animateAttackImpact(effect,p,motion);
      fadeObject(effect,1-p);
    },payload.target);
  }
  breath(payload){
    if(!payload.source||!payload.target||!this.visible(payload.target))return;
    const stats=payload.stats||this.getStats(payload.source)||{};
    if(!stats.continuousAttack||payload.target.dead||stats.continuousAttack.targeting!=='ground-and-air'&&payload.target.flying)return;
    const id=payload.source.id,clock=this.animationClock(payload.source);this.channels.set(id,{payload,at:clock});
    const existing=this.effects.find(e=>e.channelId===id);
    if(existing){existing.payload=payload;existing.target=payload.target;existing.createdAt=clock;existing.elapsed=0;return;}
    if(this.breathCount()>=this.maxBreaths)return;
    const paired=factionWeaponVisual(payload.source.family)?.weapon==='paired-flame-nozzles',object=paired?new THREE.Group():createFlameStream();
    if(paired){object.name='Paired actual flame-nozzle streams';object.add(createFlameStream(),createFlameStream());}
    const pose=(effect,current,clock,motion)=>{for(let lane=0;lane<(paired?2:1);lane++){const stream=paired?effect.children[lane]:effect,start=this.muzzle(current.source,current.source,{breath:true,lane}),end=this.point(current.target,this.targetHeight(current.target));orientY(stream,start,end);const angle=(current.stats||stats).continuousAttack?.angleDegrees||30,width=start.distanceTo(end)*Math.tan(angle*Math.PI/360)*.85;stream.scale.x=stream.scale.z=Math.max(.20,width/.41)*(paired?.55:1);stream.userData.coneAngleDegrees=angle;animateFlameStream(stream,clock,motion);}};pose(object,payload,clock*2,this.motion());
    const effect=this.addEffect(object,.57,(effect,p,motion)=>{
      // Follow the target without changing its combat location or the actor's aim.
      const current=this.channels.get(id)?.payload||payload;
      pose(effect,current,this.animationClock(payload.source)*2,motion);
      fadeObject(effect,this.channels.has(id)?.72:Math.max(0,1-p));
    },payload.target);if(effect){effect.breath=true;effect.channelId=id;effect.payload=payload;effect.animate(effect.object,0,this.motion());}
  }
  breathCount(){return this.effects.filter(e=>e.breath).length+[...this.projectiles.values()].filter(p=>p.kind==='flame').length;}
  recover(payload){
    if(!(payload.amount>0)||!payload.source)return;
    const object=new THREE.Group();object.name='Confirmed keep recovery';const start=this.muzzle(payload.source);
    for(let i=0;i<3;i++)object.add(mesh(new THREE.OctahedronGeometry(.045,0),material(i?'#b4eab7':'#ffe3a1',.7,true),'Actual recovery mote'));
    object.position.copy(start);this.addEffect(object,.42,(effect,p,motion)=>{effect.position.copy(start);effect.children.forEach((m,i)=>{const a=i*Math.PI*2/3;m.position.set(Math.cos(a)*.12,(motion?p:.5)*.5,Math.sin(a)*.12);});fadeObject(effect,1-p);});
  }
  dread(payload){
    const {enemy,source}=payload,clock=this.animationClock(source);
    if(!(payload.effectiveDamage>0)||payload.visible===false||!enemy?.untouchable||source?.dread?.source!==enemy||!(source.dread.until>clock)||!this.visible(enemy))return;
    if(clock-(this.dreadAccents.get(source.id)??-Infinity)<.3)return;
    this.dreadAccents.set(source.id,clock);const object=zigzag('#b69acb','Actual Dread reaction tether');
    const record=this.addEffect(object,.18,(effect,p,motion)=>{animateZigzag(effect,this.point(enemy,this.targetHeight(enemy)),this.muzzle(source),clock,source.id,motion);fadeObject(effect,(1-p)*.45);},enemy);if(record)record.endpoints=[enemy,source];
  }
  chainStyle(payload){
    const source=payload.source||(payload.from?.family?payload.from:null),stats=source?this.getStats(source)||{}:{},frost=payload.effect==='frost';
    // Existing emitted Lightning and Frost links are explicit. Ricochet preserves its weapon instead.
    const ricochet=payload.abilityId==='ricochet'||!!source&&!frost&&payload.effect!=='lightning'&&!!stats.abilities?.some(a=>a.familyId==='ricochet');
    const kind=ricochet?attackVisualKind(source.family,stats):frost?'frost':'lightning',style=source?attackVisualStyle(source.family,stats):null;
    const secret=secretFamily(source?.family)||payload.color==='#ffd969';
    return {kind,style,ricochet,color:secret?'#ffda72':ricochet?attackVisualColor(source.family,kind,stats):frost?ATTACK_COLORS.frost:payload.color||ATTACK_COLORS.lightning};
  }
  chain(payload){
    if(payload.visible===false||!payload.from||!payload.to||!this.visible(payload.from)||!this.visible(payload.to))return;
    if(this.effects.length>=this.maxEffects||this.effects.length+this.projectiles.size>=this.maxDetailed){if(this.procPaths.length<4096)this.procPaths.push({payload,at:this.animationClock(payload.source)});return;}
    const branch=this.chainStyle(payload),frost=payload.effect==='frost',fork=!!payload.from.family;
    const object=branch.ricochet?createAttackProjectile(branch.kind,branch.color,{style:branch.style||{}}):frost?createAttackProjectile('frost',ATTACK_COLORS.frost):electricity(branch.color,fork?'Actual source fork branch':'Actual enemy chain link');
    if(branch.ricochet){object.name=`Weapon-consistent ${branch.kind} Ricochet`;object.userData.ricochetKind=branch.kind;object.userData.contact=false;}
    // Subsequent enemy-to-enemy chain packets carry the original tower colour,
    // rather than its reference. This palette belongs to the two Secret towers.
    const source=secretFamily(payload.from.family)?payload.from:payload.color==='#ffd969'?{family:'ladyclaire'}:null;
    const record=this.addEffect(object,.24,(effect,p,motion)=>{const start=payload.from.family?this.muzzle(payload.from):this.point(payload.from,this.targetHeight(payload.from)),end=this.point(payload.to,this.targetHeight(payload.to));if(frost||branch.ricochet){
      // The secondary hit has already resolved: put its brief residual at the victim immediately.
      effect.position.copy(end);effect.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),end.clone().sub(start).normalize());effect.scale.setScalar(frost?.8:.85);fadeObject(effect,1-p);
    }else{animateElectricity(effect,start,end,this.electricOptions(start,end,{clock:this.animationClock(source),seed:payload.to.id||0,motion,progress:p}));effect.children.forEach(layer=>{layer.material.opacity*=1-p;});}},payload.to);if(record){record.endpoints=[payload.from,payload.to];record.pathPacket=payload;record.removeOnDeath=true;record.animate(record.object,0,this.motion());}
  }
  queueFireSplash(packet){
    const prior=this.fireSplashPaths.find(row=>row.target===packet.target&&row.source===packet.source&&row.at===packet.at);
    if(prior){prior.eruption||=packet.eruption;prior.victims=[...new Set([...prior.victims,...packet.victims])].slice(0,32);return;}
    if(this.fireSplashPaths.length>=64)this.fireSplashPaths.shift();
    this.fireSplashPaths.push({...packet,centre:packet.centre.clone(),victims:packet.victims.slice(0,32)});
  }
  fireSplash(payload){
    if(payload.visible===false||!payload.source||!payload.target||!(payload.amount>0)||!this.visible(payload.target))return;
    const victims=(payload.victims||[]).filter(e=>presentTarget(e)&&this.visible(e));if(!victims.length)return;
    const stats=this.getStats(payload.source)||{},radius=Number(stats.burnedRadius||stats.abilities?.find(a=>a.familyId==='fire-splash')?.radius);
    if(!Number.isFinite(radius)||radius<=0)return;
    const packet={source:payload.source,target:payload.target,centre:this.point(payload.target,this.targetHeight(payload.target)),radius,victims,at:this.animationClock(payload.source),eruption:true};
    if(this.effects.length+this.projectiles.size>=this.maxDetailed){this.queueFireSplash(packet);return;}
    const object=createFireSplash(radius);object.position.copy(packet.centre);object.userData.actualVictimIds=victims.map(e=>e.id);
    // Radius belongs to resolved source stats; packet.radius is deliberately never consulted.
    const effect=this.addEffect(object,.40,(o,p,motion)=>{animateFireSplash(o,p,motion,orientY);fadeObject(o,(1-p)*.8);},payload.target);
    if(effect){effect.fireSplashPacket={...packet,victims:[]};effect.animate(object,0,this.motion());}else this.queueFireSplash({...packet,victims:[]});
    // Keep the known impact fixed even when the initiating arrow killed the primary; never follow its corpse.
    for(const victim of victims){if(this.effects.length+this.projectiles.size>=this.maxDetailed){this.queueFireSplash({...packet,eruption:false,victims:[victim]});continue;}const contact=createAttackImpact('flame','#ffad52',{radius:.13,element:'fire'});contact.position.copy(this.point(victim,this.targetHeight(victim)));const record=this.addEffect(contact,.22,(o,p,motion)=>{o.position.copy(this.point(victim,this.targetHeight(victim)));animateAttackImpact(o,p,motion);fadeObject(o,1-p);},victim);if(record){record.removeOnDeath=true;record.fireSplashPacket={...packet,eruption:false,victims:[victim]};}else this.queueFireSplash({...packet,eruption:false,victims:[victim]});}
  }
  event(type,payload={}){
    if(this.disposed)return;
    if(type==='damage-trace'&&payload.enemy){let bySource=this.resolved.get(payload.enemy);if(!bySource){bySource=new Map();this.resolved.set(payload.enemy,bySource);}bySource.set(payload.source?.id,payload);this.dread(payload);}
    if(type==='shot')this.shot(payload);
    else if(type==='impact')this.impact(payload);
    else if(type==='aura-attack'&&((payload.stats||this.getStats(payload.source)).burnAura||attackVisualKind(payload.source?.family,payload.stats||this.getStats(payload.source))==='flame'))this.breath(payload);
    else if(type==='chain')this.chain(payload);
    else if(type==='burn-proc')this.fireSplash(payload);
    else if(type==='recover')this.recover(payload);
  }
  update(dt,time=this.time){
    if(this.disposed)return;this.time=Number.isFinite(time)?time%1e6:0;const elapsed=Number.isFinite(dt)?Math.max(0,dt):0;
    for(const effect of [...this.effects]){
      effect.elapsed=effect.createdAt===null?effect.elapsed+elapsed:Math.max(0,this.animationClock(null)-effect.createdAt);
      if(effect.elapsed>=effect.duration||!this.visible(effect.target)||effect.endpoints?.some(e=>!this.visible(e))||effect.removeOnDeath&&(!presentTarget(effect.target)||effect.endpoints?.some(e=>!presentTarget(e)))){this.removeEffect(effect);continue;}
      effect.animate(effect.object,clampProgress(effect.elapsed/effect.duration),this.motion());
    }
  }
  clear(){for(const id of [...this.projectiles.keys()])this.removeProjectile(id);for(const effect of [...this.effects])this.removeEffect(effect);this.procPaths=[];this.fireSplashPaths=[];this.channels.clear();this.paths.clear();this.resolved=new WeakMap();this.dreadAccents.clear();}
  dispose(){if(this.disposed)return;this.clear();this.paths.dispose();this.disposed=true;}
}
