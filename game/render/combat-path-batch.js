import * as THREE from 'three';

/** Lightweight representation retains real paths when detailed effects are full. */
export class CombatPathBatch{
  constructor(scene,{capacity=4096}={}){
    this.scene=scene;this.capacity=capacity;this.records=[];this.object=null;this.disposed=false;
  }
  sync(paths){
    if(this.disposed)return;
    this.records=paths.slice(0,this.capacity);
    if(!this.object&&!this.records.length)return;
    if(!this.object){
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(this.capacity*6),3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(this.capacity*6),3));
      this.object=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.7,depthWrite:false,toneMapped:false}));this.object.name='Actual overflow projectile and proc paths';this.object.raycast=()=>{};this.object.frustumCulled=false;this.scene.add(this.object);
    }
    const positions=this.object.geometry.attributes.position,colors=this.object.geometry.attributes.color;
    this.records.forEach(({from,to,color='#e6dfc8'},i)=>{positions.setXYZ(i*2,from.x,from.y,from.z);positions.setXYZ(i*2+1,to.x,to.y,to.z);const c=new THREE.Color(color);colors.setXYZ(i*2,c.r,c.g,c.b);colors.setXYZ(i*2+1,c.r,c.g,c.b);});
    positions.needsUpdate=colors.needsUpdate=true;this.object.geometry.setDrawRange(0,this.records.length*2);this.object.visible=this.records.length>0;
  }
  clear(){this.records=[];if(this.object){this.object.geometry.setDrawRange(0,0);this.object.visible=false;}}
  dispose(){if(this.disposed)return;this.clear();if(this.object){this.object.geometry.dispose();this.object.material.dispose();this.object.removeFromParent();}this.disposed=true;}
}
