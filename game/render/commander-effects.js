import * as THREE from 'three';
import {commanderSkillArt} from '../../ui/commander-art.js';
import {battlefieldIcon} from './battlefield-icon.js';

const GOLD='#f8d577',WHITE='#fff8dc',GREEN='#93dfac';
const finite=value=>Number.isFinite(value);
const material=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
function textLabel(text,color=WHITE){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;
  const context=canvas.getContext('2d');if(!context)return null;
  context.textAlign='center';context.textBaseline='middle';context.font='bold 55px Georgia, serif';context.lineJoin='round';context.lineWidth=8;context.strokeStyle='#223b36';context.strokeText(text,384,66);context.fillStyle=color;context.fillText(text,384,66);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));sprite.geometry=sprite.geometry.clone();sprite.scale.set(3.6,.6,1);sprite.renderOrder=28;return sprite;
}
function release(group){
  const geometries=new Set(),materials=new Set(),textures=new Set();
  group.traverse(object=>{if(object.geometry)geometries.add(object.geometry);for(const value of [].concat(object.material||[])){materials.add(value);if(value.map)textures.add(value.map);}});
  textures.forEach(value=>value.dispose());geometries.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());group.removeFromParent();
}
const RANKS=['','I','II','III','IV','V','VI'];

// Cosmetic event consumers only. No simulation state, random draws, target
// selection or damage resolution is performed by this renderer.
export class CommanderEffects{
  constructor(scene,{position=(x,y,z)=>new THREE.Vector3(x,y,z),towerPoint=null,targetPoint=null,isVisible=target=>target.visible!==false,camera=()=>null,fortressPoint=()=>new THREE.Vector3(38,19.4,14),reducedMotion=()=>false,createLabel=textLabel,maxTargets=1024}={}){
    this.scene=scene;this.position=position;this.towerPoint=towerPoint;this.targetPoint=targetPoint;this.isVisible=isVisible;this.camera=camera;this.fortressPoint=fortressPoint;this.reducedMotion=reducedMotion;this.createLabel=createLabel;this.maxTargets=Math.min(4096,Math.max(1,Math.floor(maxTargets)||1024));this.promotions=[];this.fortified=null;this.strike=null;this.disposed=false;
    this.range=null;this.matrix=new THREE.Matrix4();this.scale=new THREE.Vector3();this.point=new THREE.Vector3();this.rotation=new THREE.Quaternion();
    this.beams=new THREE.InstancedMesh(new THREE.CylinderGeometry(.035,.035,1,5),material(WHITE),this.maxTargets);
    this.glows=new THREE.InstancedMesh(new THREE.CylinderGeometry(.13,.06,1,5),material(GOLD,.35),this.maxTargets);
    this.marks=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.16,0),material(GOLD),this.maxTargets);
    for(const [index,mesh] of [this.beams,this.glows,this.marks].entries()){mesh.name=['Commander white strike cores','Commander golden strike shafts','Commander strike marks'][index];mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);}
  }
  event(type,payload={}){
    if(this.disposed)return false;
    if(type==='general-promoted')return this.promote(payload);
    if(type==='general-strike')return this.strikeTargets(payload);
    if(type==='general-fortified')return this.fortify(payload);
    if(type==='general-range')return this.extendRange(payload);
    return false;
  }
  promote(payload){
    let added=false;
    for(const upgrade of (payload.upgrades||[]).slice(0,5)){
      const tower=upgrade.tower||upgrade,from=upgrade.from??upgrade.fromTier,to=upgrade.to??upgrade.toTier;
      if(!finite(tower.x)||!finite(tower.z)||!Number.isInteger(from)||!Number.isInteger(to)||to!==from+1||to>6)continue;
      const group=new THREE.Group();group.name='Commander field promotion';
      const icon=battlefieldIcon(commanderSkillArt('field-promotion'),1.15);icon.position.y=.3;group.add(icon);
      const label=this.createLabel?.(`${RANKS[from]} → ${RANKS[to]}`);if(label){label.position.y=1.05;group.add(label);}
      const origin=this.towerPoint?.(tower)||this.position(tower.x,2.1,tower.z);group.position.copy(origin);this.scene.add(group);this.promotions.push({group,origin:origin.clone(),age:0,duration:.85});added=true;
    }
    // At most the current and previous five-candidate flourish can coexist.
    while(this.promotions.length>10)release(this.promotions.shift().group);
    return added;
  }
  strikeTargets(payload){
    const points=[];
    for(const target of payload.targets||[]){
      if(target.visible===false||!this.isVisible(target)||!finite(target.x)||!finite(target.z))continue;
      const point=this.targetPoint?.(target)||this.position(target.x,(target.flying?1.9:1.1)+(target.boss?.8:0),target.z);
      if(point&&finite(point.x)&&finite(point.y)&&finite(point.z))points.push(point.clone());
      if(points.length===this.maxTargets)break;
    }
    this.strike=points.length?{points,age:0,duration:.8}:null;
    this.syncStrike();return points.length>0;
  }
  fortify(payload){
    const amount=payload.amount;if(![5,10,15].includes(amount))return false;
    if(this.fortified)release(this.fortified.group);
    const group=new THREE.Group();group.name='Commander fortified keep';
    group.add(battlefieldIcon(commanderSkillArt('fortified-keep'),2.9));
    const label=this.createLabel?.(`+${amount} maximum health`,GREEN);if(label){label.position.y=-1.9;label.scale.set(6.5,1.08,1);group.add(label);}
    const origin=this.fortressPoint();group.position.copy(origin);this.scene.add(group);this.fortified={group,origin:origin.clone(),age:0,duration:1.4};return true;
  }
  extendRange(payload){
    if(![1,1.5,2].includes(payload.bonus))return false;
    if(this.range)release(this.range.group);
    const group=new THREE.Group();group.name='Commander extended range';
    group.add(battlefieldIcon(commanderSkillArt('extended-range'),1.5));
    const label=this.createLabel?.(`+${payload.bonus} range · this wave`,GOLD);if(label){label.position.y=.85;label.scale.set(6.5,1.08,1);group.add(label);}
    const origin=this.fortressPoint();group.position.copy(origin);this.scene.add(group);this.range={group,origin:origin.clone(),age:0,duration:1.2};return true;
  }
  syncStrike(){
    const strike=this.strike,progress=strike?strike.age/strike.duration:1,still=this.reducedMotion(),count=strike?.points.length||0;
    this.beams.count=this.glows.count=this.marks.count=count;
    for(const mesh of [this.beams,this.glows,this.marks])mesh.visible=count>0;
    if(!strike)return;
    // One bounded, simultaneous light pulse. Reduced motion keeps a static
    // gold mark and omits the descending shafts entirely.
    this.beams.visible=this.glows.visible=!still;
    const fade=Math.min(1,(1-progress)*2.3),height=still?0:2.6;
    this.beams.material.opacity=fade*.85;this.glows.material.opacity=fade*.28;this.marks.material.opacity=fade;
    for(let index=0;index<count;index++){
      const target=strike.points[index];this.point.copy(target);this.point.y+=height/2+.12;this.scale.set(1,height,1);this.matrix.compose(this.point,this.rotation,this.scale);this.beams.setMatrixAt(index,this.matrix);this.glows.setMatrixAt(index,this.matrix);
      this.point.copy(target);this.point.y+=.3;this.scale.setScalar(still?1:1+Math.sin(Math.min(1,progress*2)*Math.PI)*.4);this.matrix.compose(this.point,this.rotation,this.scale);this.marks.setMatrixAt(index,this.matrix);
    }
    for(const mesh of [this.beams,this.glows,this.marks])mesh.instanceMatrix.needsUpdate=true;
  }
  update(dt){
    if(this.disposed)return;
    const step=finite(dt)?Math.max(0,dt):0,still=this.reducedMotion(),camera=this.camera();
    const animate=row=>{row.age+=step;const p=Math.min(1,row.age/row.duration),fade=Math.min(1,(1-p)*3);row.group.position.copy(row.origin);if(!still)row.group.position.y+=p*.65;if(camera)row.group.quaternion.copy(camera.quaternion);row.group.traverse(object=>{if(object.material)object.material.opacity=fade*(object.isSprite?1:.9);});return p<1;};
    this.promotions=this.promotions.filter(row=>{if(animate(row))return true;release(row.group);return false;});
    if(this.fortified&&!animate(this.fortified)){release(this.fortified.group);this.fortified=null;}
    if(this.range&&!animate(this.range)){release(this.range.group);this.range=null;}
    if(this.strike){this.strike.age+=step;if(this.strike.age>=this.strike.duration)this.strike=null;this.syncStrike();}
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;
    this.promotions.forEach(row=>release(row.group));this.promotions=[];if(this.fortified)release(this.fortified.group);if(this.range)release(this.range.group);this.range=null;this.fortified=null;this.strike=null;
    for(const mesh of [this.beams,this.glows,this.marks]){mesh.dispose();mesh.geometry.dispose();mesh.material.dispose();mesh.removeFromParent();}
  }
}
