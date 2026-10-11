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
