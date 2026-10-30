import * as THREE from 'three';
import {CombatPathBatch} from './combat-path-batch.js';
import {factionAttackVisualKind,factionWeaponVisual} from './faction-attack-visuals.js';

const ROOTS=new Set(['druid','greenheart','eldergrove','mothernature','rangermentor']);
const DRAGONS=new Set(['embercrown','worldfire','thunderheart','phoenix']);
const STORMS=new Set(['stormcaller','tempest','stormcitadel','starfall']);
const SIEGE=new Set(['stonewarden','kingsreach','fireballista','royalarsenal','royalmarshal','griffinbomber']);
const MELEE=new Set(['soldier','frostblade','roseguard','highking','crownofages','kingdomprotector']);
const LOBBED=new Set(['stonewarden','royalmarshal','griffinbomber','royalarsenal']);
export const ATTACK_COLORS=Object.freeze({roots:'#78b957',flame:'#ff973f',lightning:'#a5dcff',melee:'#e7e9c5',thrust:'#e7e9c5',siege:'#d9aa68',holy:'#fff0b3',frost:'#a1e2ef',arcane:'#bc9aef',arrow:'#eadbb5',runic:'#e1ba7d',stone:'#95a779',dart:'#a3d96d',venomArrow:'#95ce73',hammer:'#e7ddb0',axe:'#f3d59b',pick:'#bdd8e2',bullet:'#ffd295',bulletRapid:'#ffba68',shell:'#edb373',cannon:'#f4aa65',grenade:'#ffac5a',drum:'#edc587',treeSlam:'#86b75a',web:'#c4a6ef',moon:'#c3b7ff',stormSpear:'#83dfff',claw:'#e7d3a7',forge:'#ffad52'});
const secretFamily=family=>family==='ladyclaire'||family==='lordbernhard';
export const attackVisualColor=(family,kind,stats={})=>secretFamily(family)?'#ffda72':kind==='arrow'&&factionWeaponVisual(family)?.factionId==='grove'&&stats.type==='magical'?'#9bdfff':ATTACK_COLORS[kind];
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
function arrow(color,toxic=false){
  const object=new THREE.Group();object.name='Crafted arrow';
  const shaft=mesh(new THREE.CylinderGeometry(.009,.009,.52,5),material('#b79f73'),'Arrow shaft');shaft.rotation.x=Math.PI/2;object.add(shaft);
  const tip=mesh(new THREE.ConeGeometry(.032,.12,4),material(color),'Steel arrowhead');tip.rotation.x=Math.PI/2;tip.position.z=.30;object.add(tip);
  const feathers=mesh(new THREE.BoxGeometry(.08,.01,.12),material(toxic?color:'#d8d9c8'),'Arrow fletching');feathers.position.z=-.22;object.add(feathers);
  if(toxic){object.name='Venom-coated royal arrow';const coating=mesh(new THREE.CylinderGeometry(.013,.013,.11,5),material(color,.85),'Green venom arrow coating');coating.rotation.x=Math.PI/2;coating.position.z=.22;object.add(coating);}return object;
}
function frostBolt(color){
  const object=arrow(color);object.name='Frost-coated crossbow bolt';
  const frost=mesh(new THREE.CylinderGeometry(.015,.021,.16,5),material(color,.92),'Ice-lined bolt shaft');frost.rotation.x=Math.PI/2;frost.position.z=.18;object.add(frost);
  for(const side of [-1,1]){const crystal=mesh(new THREE.ConeGeometry(.025,.11,3),material('#d3f8ff',.88),'Crossbow bolt ice accent');crystal.rotation.x=Math.PI/2;crystal.position.set(side*.023,0,.245);object.add(crystal);}
  return object;
}
function runicBolt(color){
  const object=new THREE.Group();object.name='Physical armor-breaking rune bolt';
  const core=mesh(new THREE.CylinderGeometry(.045,.075,.34,6),material('#a5adb0'),'Forged runic bolt');core.rotation.x=Math.PI/2;object.add(core);
  const rune=mesh(new THREE.TorusGeometry(.10,.013,3,4),material(color,.88,true),'Hammer-released square rune');rune.rotation.z=Math.PI/4;object.add(rune);
  for(const side of [-1,1]){const notch=mesh(new THREE.BoxGeometry(.14,.018,.018),material(color,.82,true),'Etched armor-break rune');notch.position.z=side*.095;object.add(notch);}
  return object;
}
function stoneShard(color){
  const object=new THREE.Group();object.name='Fist-released physical stone shard';
  const stone=mesh(new THREE.IcosahedronGeometry(.15,0),material('#777f6c'),'Faceted stone projectile');stone.scale.set(.85,1,1.5);object.add(stone);
  const vein=mesh(new THREE.BoxGeometry(.035,.15,.20),material(color),'Embedded emerald stone vein');vein.rotation.z=.35;object.add(vein);return object;
}
function toxicDart(color){
  const object=new THREE.Group();object.name='Mechanical cannon toxic dart';
  const shaft=mesh(new THREE.CylinderGeometry(.022,.022,.24,6),material('#9ba6a6'),'Forged toxic dart body');shaft.rotation.x=Math.PI/2;object.add(shaft);
  const tip=mesh(new THREE.ConeGeometry(.037,.095,5),material('#c2cccc'),'Metal dart point');tip.rotation.x=Math.PI/2;tip.position.z=.165;object.add(tip);
  const venom=mesh(new THREE.BoxGeometry(.031,.031,.14),material(color),'Cannon dart venom channel');venom.position.y=.024;object.add(venom);return object;
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
function spearImpact(color){
  const object=new THREE.Group();object.name='Physical lance thrust';
  const streak=mesh(new THREE.CylinderGeometry(.024,.014,.44,5),material(color,.78,true),'Forward spear impact streak');streak.rotation.x=Math.PI/2;object.add(streak);
  const point=mesh(new THREE.ConeGeometry(.046,.15,4),material(color,.88,true),'Pointed spear impact');point.rotation.x=Math.PI/2;point.position.z=.25;object.add(point);return object;
}
function hammerStrike(color){
  const object=new THREE.Group();object.name='Concussive physical hammer blow';object.add(groundRing(color,.38));
  const fragment=mesh(new THREE.IcosahedronGeometry(.10,0),material('#a4a7a1'),'Hammer impact stone fragment');fragment.position.y=.12;object.add(fragment);return object;
}
function weaponProjectile(kind,color){
  if(kind==='grenade')return bomb(color);
  if(kind==='shell'){const g=new THREE.Group();g.name='Arcing mortar shell';const body=mesh(new THREE.CylinderGeometry(.065,.065,.25,7),material('#555e60'),'Mortar shell body');body.rotation.x=Math.PI/2;g.add(body);const nose=mesh(new THREE.ConeGeometry(.065,.12,7),material(color),'Mortar shell nose');nose.rotation.x=Math.PI/2;nose.position.z=.18;g.add(nose);return g;}
  if(kind==='axe')return slash(color);
  if(['pick','claw','treeSlam'].includes(kind))return kind==='treeSlam'?thorns(color):spearImpact(color);
  if(kind==='forge')return stoneShard(color);
  if(kind==='drum'){const g=new THREE.Group();g.name='Drum percussion wave';for(let i=0;i<3;i++){const r=groundRing(color,.18+i*.09);r.position.z=-i*.12;g.add(r);}return g;}
  if(kind==='moon'){const g=new THREE.Group();g.name='Lunar crescent spell';g.add(mesh(new THREE.TorusGeometry(.13,.025,4,20,Math.PI*1.4),material(color,.95,true),'Open lunar crescent'));return g;}
  if(kind==='web')return zigzag(color,'Fang-released silken venom thread');
  if(kind==='stormSpear')return zigzag(color,'Storm-spear tip discharge');
  if(kind==='cannon'){const g=stoneShard(color);g.name='Solid iron cannonball';g.children[0].material.color.set('#464b50');g.children[1].visible=false;return g;}
  if(kind==='bullet'||kind==='bulletRapid'){
    const g=new THREE.Group();g.name=kind==='bulletRapid'?'Gatling tracer':'Rifle bullet and tracer';
    const shot=mesh(new THREE.CylinderGeometry(.014,.014,.15,5),material('#d5bc87'),'Metal bullet');shot.rotation.x=Math.PI/2;g.add(shot);
    const trail=mesh(new THREE.CylinderGeometry(.008,.003,.42,4),material(color,.65,true),'Short shot tracer');trail.rotation.x=Math.PI/2;trail.position.z=-.25;g.add(trail);return g;
  }
  return null;
}

/** Cosmetic presentation only; never updates projectile timing, targets or damage. */
export class CombatEffects{
  constructor(scene,{position=(x,y,z)=>new THREE.Vector3(x,y,z),sourceHeight=1.5,targetHeight=enemy=>enemy?.flying?1.9:enemy?.boss?1.4:1,
    getStats=()=>({}),getMuzzle=null,getSimulationTime=null,isVisible=()=>true,reducedMotion=false,maxEffects=48,maxProjectiles=96,maxDetailed=192,maxBreaths=8}={}){
    this.scene=scene;this.position=position;this.sourceHeight=sourceHeight;this.targetHeight=targetHeight;this.getStats=getStats;this.getMuzzle=getMuzzle;this.getSimulationTime=getSimulationTime;this.isVisible=isVisible;this.reducedMotion=reducedMotion;
    this.maxEffects=Math.max(1,Math.floor(maxEffects));this.maxProjectiles=Math.max(1,Math.floor(maxProjectiles));this.effects=[];this.projectiles=new Map();this.disposed=false;this.time=0;
    this.maxDetailed=maxDetailed;this.maxBreaths=maxBreaths;this.paths=new CombatPathBatch(scene);this.procPaths=[];this.channels=new Map();this.resolved=new WeakMap();this.dreadAccents=new Map();
  }
  motion(){return !(typeof this.reducedMotion==='function'?this.reducedMotion():this.reducedMotion);}
  visible(target){return !target||this.isVisible(target)!==false;}
  animationClock(source,time=this.time){const simulation=this.getSimulationTime?.();return Number.isFinite(simulation)?simulation:time;}
  point(target,height){return this.position(target.x,height,target.z);}
  muzzle(source,fallback=source,options={}){
    const kind=['stormcaller','tempest','stormcitadel'].includes(source?.family)?'hand':['embercrown','worldfire','thunderheart','phoenix','starfall'].includes(source?.family)?'mouth':['archer','thornwarden','verdantguard','royalranger','wyvernhunter','kingsrangerguard','elvenking'].includes(source?.family)?'nock':['mage','cleric','druid','frostwarden','royalarsenal','greenheart','eldergrove','mothernature','rangermentor','sunward','monk','archbishop','archangel','ladyclaire'].includes(source?.family)?'staff':'weapon';
    const out=new THREE.Vector3(),point=this.getMuzzle?.(source,out,{kind,...options});
    return point&&[point.x,point.y,point.z].every(Number.isFinite)?out.copy(point):this.point(fallback,this.sourceHeight);
  }
  addEffect(object,duration,animate,target=null){
    if(this.disposed||!this.visible(target)){disposeObject(object);return null;}
    while(this.effects.length&&(this.effects.length>=this.maxEffects||this.effects.length+this.projectiles.size>=this.maxDetailed))this.removeEffect(this.effects[0],true);
    if(this.effects.length+this.projectiles.size>=this.maxDetailed){disposeObject(object);return null;}
    sealMaterials(object);this.scene.add(object);const createdAt=this.getSimulationTime?.(),effect={object,duration,elapsed:0,createdAt:Number.isFinite(createdAt)?createdAt:null,animate,target};this.effects.push(effect);return effect;
  }
  removeEffect(effect,fallback=false){if(fallback&&effect.pathPacket&&this.procPaths.length<4096)this.procPaths.push({payload:effect.pathPacket,at:effect.createdAt??this.time});disposeObject(effect.object);const index=this.effects.indexOf(effect);if(index>=0)this.effects.splice(index,1);}
  removeProjectile(id){const record=this.projectiles.get(id);if(record){disposeObject(record.object);this.projectiles.delete(id);}}
  shot(shot){
    if(this.disposed||!shot?.source||!shot.target||!this.visible(shot.target))return null;
    if(this.projectiles.has(shot.id))return this.projectiles.get(shot.id);
    if(this.projectiles.size>=this.maxProjectiles||this.projectiles.size+this.effects.length>=this.maxDetailed)return null;
    const stats=shot.stats||this.getStats(shot.source),damageKind=attackVisualKind(shot.source.family,stats);
    // These approved physical weapons stab along their shaft. Keep the same
    // combat packet and timing while displaying a narrow forward impact.
    const spear=damageKind==='melee'&&['soldier','frostblade','roseguard'].includes(shot.source.family);
    const kind=spear?'thrust':damageKind,color=attackVisualColor(shot.source.family,kind,stats);
    const lobbed=['grenade','shell'].includes(kind)||kind==='siege'&&LOBBED.has(shot.source.family),physicalBolt=false;
    if(kind==='flame'&&this.breathCount()>=this.maxBreaths)return null;
    const object=weaponProjectile(kind,color)||(physicalBolt?frostBolt(color):kind==='roots'?spell('poison',color):kind==='flame'?flameStream(color):kind==='lightning'?zigzag(color,'Primary electric shot'):kind==='melee'?slash(color):kind==='thrust'?spearImpact(color):kind==='hammer'?hammerStrike(color):kind==='runic'?runicBolt(color):kind==='stone'?stoneShard(color):kind==='dart'?bomb(color):kind==='venomArrow'?arrow(color,true):lobbed?bomb(color):kind==='arrow'||kind==='siege'?arrow(color):spell(kind,color));
    if(kind==='dart')object.name='Hand-thrown toxic canister';
    if(shot.source.family==='stonewarden'){object.name='Sling-released catapult stone';object.children.forEach(child=>{if(child.name==='Visible bomb fuse'||child.name==='Bomb fuse spark')child.visible=false;});}
    if(secretFamily(shot.source.family))object.name=shot.source.family==='lordbernhard'?'Sword-released golden magical bolt':'Staff-released golden spell';
    if(kind==='siege'&&!lobbed)object.scale.setScalar(1.4);
    sealMaterials(object);this.scene.add(object);const record={object,kind,shot,stats,color,lobbed,physicalBolt,origin:this.muzzle(shot.source,shot.start||shot.source)};this.projectiles.set(shot.id,record);this.poseProjectile(record,this.time);
    if(['bullet','bulletRapid','cannon','shell'].includes(kind)){
      const flash=mesh(new THREE.ConeGeometry(kind==='cannon'?.12:.05,.22,5),material('#ffe4a5',.9,true),'Actual muzzle flash');
      const end=this.point(shot.target,this.targetHeight(shot.target));flash.position.copy(record.origin);flash.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(record.origin).normalize());
      this.addEffect(flash,.08,(o,p)=>{o.scale.setScalar(1-p);fadeObject(o,1-p);},shot.target);
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
    if(['lightning','stormSpear','web'].includes(kind)){
      animateZigzag(object,start,start.clone().lerp(end,Math.max(.08,p)),time,shot.id||0,motion);
    }else if(kind==='flame'){
      orientY(object,start,end);animateBreath(object,time*2.8,motion);
    }else if(kind==='hammer'){
      object.position.copy(end);object.position.y=.06;object.scale.setScalar(motion ? .45+p*.9 : .85);
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
      if(motion&&!record.physicalBolt&&!['arrow','venomArrow','dart','bullet','bulletRapid','cannon'].includes(kind)&&(kind!=='siege'||lobbed))object.rotateZ(time*(kind==='siege'?5:2));
    }
  }
  syncProjectiles(shots,time=this.time){
    if(this.disposed)return;this.time=Number.isFinite(time)?time%1e6:0;
    for(const effect of [...this.effects])if(!this.visible(effect.target))this.removeEffect(effect);
    const visibleShots=shots.filter(shot=>this.visible(shot.target));
    const active=new Set(visibleShots.map(shot=>shot.id));
    for(const id of this.projectiles.keys())if(!active.has(id))this.removeProjectile(id);
    const paths=[];
    for(const shot of visibleShots){const record=this.shot(shot);if(record){record.shot=shot;this.poseProjectile(record,this.time);}else{const from=this.muzzle(shot.source,shot.start||shot.source),end=this.point(shot.target,this.targetHeight(shot.target)),kind=attackVisualKind(shot.source.family,shot.stats||this.getStats(shot.source));paths.push({from,to:from.clone().lerp(end,clampProgress(shot.progress)),color:attackVisualColor(shot.source.family,kind)});}}
    this.procPaths=this.procPaths.filter(row=>this.animationClock(null)-row.at<.24&&this.visible(row.payload.from)&&this.visible(row.payload.to));
    for(const row of this.procPaths){const p=row.payload;paths.push({from:p.from.family?this.muzzle(p.from):this.point(p.from,this.targetHeight(p.from)),to:this.point(p.to,this.targetHeight(p.to)),color:p.effect==='frost'?ATTACK_COLORS.frost:p.color||ATTACK_COLORS.lightning});}
    for(const [id,row] of this.channels){
      if(this.animationClock(null)-row.at>.28||!this.visible(row.payload.target)){this.channels.delete(id);continue;}
      if(!this.effects.some(e=>e.channelId===id))paths.push({from:this.muzzle(row.payload.source,row.payload.source,{breath:true}),to:this.point(row.payload.target,this.targetHeight(row.payload.target)),color:ATTACK_COLORS.flame});
    }
    this.paths.sync(paths);
  }
  impact(payload){
    if(this.disposed||!this.visible(payload.target))return;
    const stats=payload.stats||{},kind=payload.effect==='fire'||payload.aura&&stats.burnAura?'flame':payload.effect==='poison'?'roots':attackVisualKind(payload.source?.family,{...stats,projectileEffect:payload.effect||stats.projectileEffect}),color=attackVisualColor(payload.source?.family,kind);
    if(payload.aura)return; // Sparse actual victim heat belongs to the reconciled status batch.
    const result=this.resolved.get(payload.target)?.get(payload.source?.id),blocked=result&&result.effectiveDamage<=0;
    const centre=payload.target?this.point(payload.target,this.targetHeight(payload.target)):this.position(payload.x,.04,payload.z),radius=blocked?.18:Math.min(.55,Math.max(.18,payload.radius||.3)),tint=blocked?'#9aa6a4':color;
    const object=new THREE.Group();object.name=blocked?'Resolved blocked contact':`${kind} attack impact`;object.position.copy(centre);
    object.add(groundRing(tint,radius));
    {
      const shardGeometry=kind==='frost'?new THREE.ConeGeometry(.035,.24,4):new THREE.OctahedronGeometry(.044,0),sparkMat=material(color,.88,true);
      if(blocked)sparkMat.color.set(tint);
      const sparks=new THREE.InstancedMesh(shardGeometry,sparkMat,8);sparks.name=`${kind} impact sparks`;sparks.raycast=noRaycast;sparks.frustumCulled=false;object.add(sparks);
    }
    const duration=kind==='roots' ? .62 : kind==='siege'||kind==='flame' ? .48 : .28;
    this.addEffect(object,duration,(effect,p,motion)=>{
      {
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
    const id=payload.source.id,clock=this.animationClock(payload.source);this.channels.set(id,{payload,at:clock});
    const existing=this.effects.find(e=>e.channelId===id);
    if(existing){existing.payload=payload;existing.target=payload.target;existing.createdAt=clock;existing.elapsed=0;return;}
    if(this.breathCount()>=this.maxBreaths)return;
    const paired=factionWeaponVisual(payload.source.family)?.weapon==='paired-flame-nozzles',object=paired?new THREE.Group():flameStream(ATTACK_COLORS.flame);
    if(paired){object.name='Paired actual flame-nozzle streams';object.add(flameStream(ATTACK_COLORS.flame),flameStream(ATTACK_COLORS.flame));}
    const pose=(effect,current,clock,motion)=>{for(let lane=0;lane<(paired?2:1);lane++){const stream=paired?effect.children[lane]:effect;orientY(stream,this.muzzle(current.source,current.source,{breath:true,lane}),this.point(current.target,this.targetHeight(current.target)));animateBreath(stream,clock,motion);}};pose(object,payload,clock*2,this.motion());
    const effect=this.addEffect(object,.57,(effect,p,motion)=>{
      // Follow the target without changing its combat location or the actor's aim.
      const current=this.channels.get(id)?.payload||payload;
      pose(effect,current,this.animationClock(payload.source)*2,motion);
      fadeObject(effect,this.channels.has(id)?.72:Math.max(0,1-p));
    },payload.target);if(effect){effect.breath=true;effect.channelId=id;effect.payload=payload;}
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
  chain(payload){
    if(payload.visible===false||!payload.from||!payload.to||!this.visible(payload.from)||!this.visible(payload.to))return;
    if(this.effects.length>=this.maxEffects||this.effects.length+this.projectiles.size>=this.maxDetailed){if(this.procPaths.length<4096)this.procPaths.push({payload,at:this.animationClock(payload.source)});return;}
    const frost=payload.effect==='frost',fork=!!payload.from.family;
    const object=frost?spell('frost',ATTACK_COLORS.frost):zigzag(payload.color||ATTACK_COLORS.lightning,fork?'Actual source fork branch':'Actual enemy chain link');
    // Subsequent enemy-to-enemy chain packets carry the original tower colour,
    // rather than its reference. This palette belongs to the two Secret towers.
    const source=secretFamily(payload.from.family)?payload.from:payload.color==='#ffd969'?{family:'ladyclaire'}:null;
    const record=this.addEffect(object,.24,(effect,p,motion)=>{const start=payload.from.family?this.muzzle(payload.from):this.point(payload.from,this.targetHeight(payload.from)),end=this.point(payload.to,this.targetHeight(payload.to));if(frost){effect.position.lerpVectors(start,end,p);effect.scale.setScalar(.8);}else animateZigzag(effect,start,end,this.animationClock(source),payload.to.id||0,motion);fadeObject(effect,1-p);},payload.to);if(record){record.endpoints=[payload.from,payload.to];record.pathPacket=payload;}
  }
  event(type,payload={}){
    if(this.disposed)return;
    if(type==='damage-trace'&&payload.enemy){let bySource=this.resolved.get(payload.enemy);if(!bySource){bySource=new Map();this.resolved.set(payload.enemy,bySource);}bySource.set(payload.source?.id,payload);this.dread(payload);}
    if(type==='shot')this.shot(payload);
    else if(type==='impact')this.impact(payload);
    else if(type==='aura-attack'&&((payload.stats||this.getStats(payload.source)).burnAura||attackVisualKind(payload.source?.family,payload.stats||this.getStats(payload.source))==='flame'))this.breath(payload);
    else if(type==='chain')this.chain(payload);
    else if(type==='recover')this.recover(payload);
  }
  update(dt,time=this.time){
    if(this.disposed)return;this.time=Number.isFinite(time)?time%1e6:0;const elapsed=Number.isFinite(dt)?Math.max(0,dt):0;
    for(const effect of [...this.effects]){
      effect.elapsed=effect.createdAt===null?effect.elapsed+elapsed:Math.max(0,this.animationClock(null)-effect.createdAt);
      if(effect.elapsed>=effect.duration||!this.visible(effect.target)||effect.endpoints?.some(e=>!this.visible(e))){this.removeEffect(effect);continue;}
      effect.animate(effect.object,clampProgress(effect.elapsed/effect.duration),this.motion());
    }
  }
  clear(){for(const id of [...this.projectiles.keys()])this.removeProjectile(id);for(const effect of [...this.effects])this.removeEffect(effect);this.procPaths=[];this.channels.clear();this.paths.clear();this.resolved=new WeakMap();this.dreadAccents.clear();}
  dispose(){if(this.disposed)return;this.clear();this.paths.dispose();this.disposed=true;}
}
