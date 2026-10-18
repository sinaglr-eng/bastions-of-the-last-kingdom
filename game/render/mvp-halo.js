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
  const group=new THREE.Group();group.name='MVP award confetti and stars';group.userData.mvpAward=true;
  const confetti=new THREE.PlaneGeometry(.075,.17),shape=new THREE.Shape();
  for(let index=0;index<=10;index++){const angle=index*Math.PI/5+Math.PI/2,radius=index%2?.052:.12,x=Math.cos(angle)*radius,y=Math.sin(angle)*radius;if(index===0)shape.moveTo(x,y);else shape.lineTo(x,y);}
  const star=new THREE.ShapeGeometry(shape),materials=['#eac55f','#57b7c5','#e08ba4','#a599dd','#80bf91'].map(color=>new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,depthWrite:false,side:THREE.DoubleSide}));
  // Deterministic placement is cosmetic and never samples the combat/draft RNG.
  for(let index=0;index<34;index++){
    const isStar=index>=24,angle=index*2.399963229728653,radius=.5+(index%5)*.15,height=1.75+(index%6)*.18;
    const piece=new THREE.Mesh(isStar?star:confetti,materials[isStar?0:index%materials.length]);
    piece.position.set(Math.cos(angle)*radius,height,Math.sin(angle)*radius);
    piece.rotation.set(isStar?-Math.PI/2:index*.37,index*.61,index*.49);piece.userData.awardOpacity=1;
    piece.userData.mvpAwardParticle={kind:isStar?'star':'confetti',index,angle,radius,height,rotation:piece.rotation.clone()};group.add(piece);
  }
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
  constructor(scene,{position=(x,y,z)=>new THREE.Vector3(x,y,z),duration=2.8,reducedMotion=()=>false,createLabel=awardLabel}={}){
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
        const particle=object.userData.mvpAwardParticle;
        if(particle){
          const {angle,radius,height,index,rotation,kind}=particle,travel=still?0:progress,spread=radius+travel*.7,turn=angle+travel*(kind==='star'?.45:.8);
          object.position.set(Math.cos(turn)*spread,height+Math.sin(travel*Math.PI)*.65-travel*1.1,Math.sin(turn)*spread);
          object.rotation.set(rotation.x+(still?0:elapsed*(kind==='star'?.2:1.8)),rotation.y+(still?0:elapsed*.8),rotation.z+(still?0:elapsed*(index%2?1.4:-1.4)));
        }
      }
    }
  }
  dispose(){for(const row of this.awards.values())disposeAward(row.group);this.awards.clear();this.seen.clear();}
}
