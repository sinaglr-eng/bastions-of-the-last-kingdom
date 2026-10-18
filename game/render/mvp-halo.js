import * as THREE from 'three';
import {mvpLevel} from '../core/mvp.js';
export function createMvpHalo(){
  const group=new THREE.Group();group.name='MAX MVP head halo';group.userData.mvpHalo=true;
  const material=new THREE.MeshBasicMaterial({color:'#ffdd73',transparent:true,opacity:.9,depthWrite:false});
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.28,.025,6,28),material);ring.rotation.x=Math.PI/2;group.add(ring);
  const geometry=new THREE.IcosahedronGeometry(.035,0);
  for(let i=0;i<8;i++){const particle=new THREE.Mesh(geometry,material);particle.userData.mvpParticle=i;group.add(particle);}
  return group;
}
export function disposeMvpHalo(group){
  const geometries=new Set(),materials=new Set();group.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)materials.add(object.material);});
  geometries.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());group.removeFromParent();
}
export class MvpHalos{
  constructor(){this.halos=new Map();}
  sync(models,time=0,{reducedMotion=false}={}){
    const current=new Set();
    for(const [id,value] of models){
      if(value.tower.state!=='active'||value.modelStatus!=='ready'||mvpLevel(value.tower)!==10)continue;
      current.add(id);let row=this.halos.get(id);
      if(row&&row.actor!==value.actor){disposeMvpHalo(row.group);this.halos.delete(id);row=null;}
      if(!row){
        const group=createMvpHalo();let head=null;
        value.actor.traverse(node=>{if(!head&&/^(head|head_mesh|head_root|head_pivot|skull)(?:[._-]\d+)?$/i.test(node.name))head=node;});
        const bounds=new THREE.Box3().setFromObject(head||value.actor),point=bounds.getCenter(new THREE.Vector3());point.y=bounds.max.y+.1;
        value.object.worldToLocal(point);group.position.copy(point);value.object.add(group);
        row={group,actor:value.actor};this.halos.set(id,row);
      }
      const t=reducedMotion?0:time;
      row.group.children[0].scale.setScalar(1+(reducedMotion?0:Math.sin(t*2.2+id)*.06));
      for(const particle of row.group.children.slice(1)){
        const index=particle.userData.mvpParticle,angle=index*Math.PI/4+t*.65;
        particle.position.set(Math.cos(angle)*.31,.035+Math.sin(t*2+index)*.06,Math.sin(angle)*.31);
      }
    }
    for(const [id,row] of this.halos)if(!current.has(id)){disposeMvpHalo(row.group);this.halos.delete(id);}
  }
  dispose(){for(const row of this.halos.values())disposeMvpHalo(row.group);this.halos.clear();}
}

function awardLabel(){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=144;
  const context=canvas.getContext('2d');if(!context)return null;
  context.textAlign='center';context.textBaseline='middle';context.font='bold 76px Georgia, serif';
  context.lineWidth=10;context.strokeStyle='#473018';context.strokeText('MVP +1',256,75);
  context.fillStyle='#fff1a9';context.fillText('MVP +1',256,75);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));
  label.geometry=label.geometry.clone();
  label.name='MVP +1 award label';label.scale.set(2.4,.675,1);label.renderOrder=25;return label;
}

export function createMvpAward({createLabel=awardLabel}={}){
  const group=new THREE.Group();group.name='MVP award divine light';group.userData.mvpAward=true;
  const beam=(top,bottom,opacity)=>{
    const material=new THREE.MeshBasicMaterial({color:'#fff0b2',transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,7,24,1,true),material);mesh.position.y=3.5;mesh.userData.awardOpacity=opacity;mesh.renderOrder=8;group.add(mesh);
  };
  beam(.1,.58,.21);beam(.04,.26,.35);
  const material=new THREE.MeshBasicMaterial({color:'#ffe69b',transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending});
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.62,.035,5,40),material);ring.rotation.x=Math.PI/2;ring.position.y=.08;ring.userData.awardOpacity=.85;group.add(ring);
  const label=createLabel?.();if(label){label.position.y=2.8;label.userData.mvpAwardLabel=true;label.userData.awardOpacity=1;group.add(label);}
  return group;
}

function disposeAward(group){
  const textures=new Set();group.traverse(node=>{if(node.material?.map)textures.add(node.material.map);});
  textures.forEach(texture=>texture.dispose());disposeMvpHalo(group);
}

// The real mvp-awarded event is the only entry point. This cosmetic clock is
// independent of game speed and keeps the reward readable after a wave ends.
export class MvpAwardEffects{
  constructor(scene,{position=(x,y,z)=>new THREE.Vector3(x,y,z),duration=3.2,reducedMotion=()=>false,createLabel=awardLabel}={}){
    this.scene=scene;this.position=position;this.duration=duration;this.reducedMotion=reducedMotion;this.createLabel=createLabel;this.awards=new Map();this.seen=new Set();
  }
  award(payload,time=0){
    const tower=payload?.tower;
    if(!tower||tower.state!=='active'||!Number.isFinite(tower.id)||!Number.isFinite(payload.level)||payload.level<1)return false;
    const key=`${payload.round}:${tower.id}:${payload.level}`;if(this.seen.has(key))return false;this.seen.add(key);
    const previous=this.awards.get(tower.id);if(previous)disposeAward(previous.group);
    const group=createMvpAward({createLabel:this.createLabel});group.position.copy(this.position(tower.x,.12,tower.z));this.scene.add(group);
    this.awards.set(tower.id,{group,tower,start:time,key});return true;
  }
  update(time){
    for(const [id,row]of this.awards){
      const elapsed=Math.max(0,time-row.start),progress=elapsed/this.duration;
      if(progress>=1||row.tower.state!=='active'){disposeAward(row.group);this.awards.delete(id);continue;}
      row.group.position.copy(this.position(row.tower.x,.12,row.tower.z));
      const still=this.reducedMotion(),fade=Math.min(1,elapsed/.15,(this.duration-elapsed)/.8);
      for(const object of row.group.children){
        if(object.material)object.material.opacity=object.userData.awardOpacity*fade;
        if(object.userData.mvpAwardLabel)object.position.y=2.8+(still?0:progress*.9);
      }
      if(!still){const ring=row.group.children[2];ring.scale.setScalar(1+Math.sin(Math.min(1,progress*2)*Math.PI)*.18);}
    }
  }
  dispose(){for(const row of this.awards.values())disposeAward(row.group);this.awards.clear();this.seen.clear();}
}
