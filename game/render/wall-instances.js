import * as THREE from 'three';

// Masonry is static between board edits. Submit identical template surfaces as
// instances while retaining the original, exact per-tile meshes for picking.
// Geometry/materials remain owned by the existing wall-template cache.
export class WallInstances {
  constructor(scene){this.group=new THREE.Group();this.group.name='Castle masonry instances';scene.add(this.group);this.rows=[];this.batches=[];}
  sync(meshes){
    const rows=meshes.map(mesh=>{mesh.updateWorldMatrix(true,false);return{mesh,matrix:mesh.matrixWorld.clone(),visible:mesh.userData.wallInstanceSource?mesh.userData.wallInstanceVisible:mesh.visible};});
    if(rows.length===this.rows.length&&rows.every((r,i)=>r.mesh===this.rows[i].mesh&&r.visible===this.rows[i].visible&&r.matrix.equals(this.rows[i].matrix)))return false;
    this.clear();this.rows=rows;
    const groups=new Map();
    for(const row of rows){const m=row.mesh;if(!row.visible)continue;
      const key=[m.geometry.uuid,m.material.uuid,m.castShadow,m.receiveShadow,m.layers.mask,m.renderOrder].join(':');
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);
    }
    for(const peers of groups.values()){
      if(peers.length<2)continue;const first=peers[0].mesh,batch=new THREE.InstancedMesh(first.geometry,first.material,peers.length);
      batch.name='Instanced castle stone';batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;batch.layers.mask=first.layers.mask;batch.renderOrder=first.renderOrder;batch.raycast=()=>{};
      peers.forEach((row,i)=>{batch.setMatrixAt(i,row.matrix);row.mesh.userData.wallInstanceSource=true;row.mesh.userData.wallInstanceVisible=row.visible;row.mesh.visible=false;});
      batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();this.group.add(batch);this.batches.push(batch);
    }
    return true;
  }
  clear(){
    for(const{mesh}of this.rows)if(mesh.userData.wallInstanceSource){mesh.visible=mesh.userData.wallInstanceVisible;delete mesh.userData.wallInstanceSource;delete mesh.userData.wallInstanceVisible;}
    for(const batch of this.batches){batch.removeFromParent();batch.dispose();}this.batches=[];this.rows=[];
  }
  dispose(){this.clear();this.group.removeFromParent();}
}
