import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// V7 literal equipment/body parts share one private actor skeleton. Keep every
// named source surface for anchors, bounds and inspection, but submit compatible
// surfaces together. No skin weights, bind matrices or materials are changed.
export function batchPrivateSkinnedActor(source){
  source.updateWorldMatrix(true,true);
  const groups=new Map(),batches=[],originals=[],partsByBatch=new Map();
  source.traverse(node=>{
    const {geometry:g,material:m}=node;
    if(!node.isSkinnedMesh||node.children.length||!node.visible||!node.layers.mask||Array.isArray(m)||!m?.isMeshStandardMaterial||m.transparent||
      m.onBeforeCompile!==THREE.Material.prototype.onBeforeCompile||m.customProgramCacheKey!==THREE.Material.prototype.customProgramCacheKey||
      node.onBeforeRender!==THREE.Object3D.prototype.onBeforeRender||node.onAfterRender!==THREE.Object3D.prototype.onAfterRender||
      node.raycast!==THREE.SkinnedMesh.prototype.raycast||!g?.attributes.position||g.drawRange.start!==0||g.drawRange.count!==Infinity||
      Object.keys(g.morphAttributes).length||Object.values(g.attributes).some(a=>a.isInterleavedBufferAttribute||a.isInstancedBufferAttribute))return;
    const attributes=Object.entries(g.attributes).map(([key,a])=>[key,a.itemSize,a.normalized,a.array.constructor.name].join(':')).sort().join('|');
    const key=[node.skeleton.uuid,node.bindMode,...node.bindMatrix.elements,...node.bindMatrixInverse.elements,...node.matrixWorld.elements,
      m.uuid,attributes,!!g.index,node.renderOrder,node.castShadow,node.receiveShadow,node.layers.mask,node.frustumCulled].join(';');
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(node);
  });
  for(const meshes of groups.values()){
    if(meshes.length<2)continue;
    const geometry=mergeGeometries(meshes.map(mesh=>mesh.geometry),false);if(!geometry)continue;
    const first=meshes[0],batch=new THREE.SkinnedMesh(geometry,first.material);
    batch.name='Private skeletal material batch '+(batches.length+1);batch.userData.privateSkinnedBatch=true;
    batch.position.copy(first.position);batch.quaternion.copy(first.quaternion);batch.scale.copy(first.scale);batch.matrix.copy(first.matrix);batch.matrixAutoUpdate=first.matrixAutoUpdate;
    batch.skeleton=first.skeleton;batch.bindMode=first.bindMode;batch.bindMatrix.copy(first.bindMatrix);batch.bindMatrixInverse.copy(first.bindMatrixInverse);
    batch.renderOrder=first.renderOrder;batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;batch.layers.mask=first.layers.mask;
    // Bone poses can leave an authored rest sphere. A handful of actor-local
    // batches stay submitted rather than risking clipping any moving equipment.
    batch.frustumCulled=false;
    first.parent.add(batch);batches.push(batch);
    const parts=[];let offset=0;
    for(const mesh of meshes){
      parts.push({mesh,start:offset,count:mesh.geometry.attributes.position.count});offset+=mesh.geometry.attributes.position.count;
      originals.push({mesh,layers:mesh.layers.mask});mesh.layers.mask=0;mesh.userData.privateSkinnedBatchSource=true;
    }
    partsByBatch.set(batch,parts);
  }
  let disposed=false;
  return {before:originals.length,after:batches.length,batches,parts:partsByBatch,dispose(){
    if(disposed)return;disposed=true;
    for(const {mesh,layers}of originals){mesh.layers.mask=layers;delete mesh.userData.privateSkinnedBatchSource;}
    for(const batch of batches){batch.removeFromParent();batch.geometry.dispose();}partsByBatch.clear();
  }};
}
