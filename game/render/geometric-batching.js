import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const optimized=new WeakMap(),retired=new WeakMap();
// Enemy copies keep independent transforms and deforming surfaces. Compatible
// static batches are immutable, so one decoded source can lend their buffers
// to all of its living figures, preview and corpses instead of uploading the
// complete merged body once for every invader. A borrower owns a reference,
// never the shared geometry's disposal.
const sharedScopes=new Map(),borrowedBatches=new WeakMap();
const bufferBytes=geometry=>Object.values(geometry.attributes).reduce((n,a)=>n+a.array.byteLength,geometry.index?.array.byteLength||0);
const sharedSignature=siblings=>siblings.map(node=>[node.geometry.uuid,node.material.uuid,layout(node.geometry),...node.matrix.elements].join(',')).join('|');
export function releaseSharedGeometricBatches(root){
  const borrowed=borrowedBatches.get(root);if(!borrowed)return 0;
  borrowedBatches.delete(root);let disposed=0;
  for(const [row,count]of borrowed){
    row.users-=count;
    if(row.users)continue;
    row.geometry.dispose();disposed++;row.scope.delete(row.key);
    if(!row.scope.size)sharedScopes.delete(row.scopeId);
  }
  return disposed;
}
export function sharedGeometricBatchStats(){
  let geometries=0,borrowers=0,bytes=0,unsharedBytes=0;
  for(const scope of sharedScopes.values())for(const row of scope.values()){
    geometries++;borrowers+=row.users;const size=bufferBytes(row.geometry);bytes+=size;unsharedBytes+=size*row.users;
  }
  return {geometries,borrowers,bytes,unsharedBytes};
}
const dynamicName=/^(?:torso_pivot|head_pivot|mount_head_pivot|mount_torso_pivot|upper_arm_[RL]|forearm_[RL]|hand_[RL]|weapon_[RL]|upper_leg_(?:[RL]|[FB][RL])|shin_(?:[RL]|[FB][RL])|foot_(?:[RL]|[FB][RL])|wing_[RL]|tail_pivot|jaw_pivot|mouth_pivot|siege_arm|bow_pivot|weapon_pivot|attack_arm|bow_arm|dragon_jaw|left_wing_pivot|right_wing_pivot)$/;
const protectedName=/^(?:refraction_shards|authored_bowstring|bow_tip_upper|bow_tip_lower|bow_nock|attack_muzzle|staff_tip|sword_tip)(?:_?\d+)?$|bow_?string|crossbow.*string|actual drawn string tip to nock/i;
const layout=geometry=>Object.entries(geometry.attributes).map(([name,attribute])=>`${name}:${attribute.itemSize}:${attribute.normalized}:${attribute.array.constructor.name}`).sort().join('|');
const calls=root=>{let count=0;root.traverse(node=>{if(node.isMesh)count+=Array.isArray(node.material)?node.geometry.groups.length||node.material.length:1;});return count;};

export const retiredGeometricBuffers=root=>retired.get(root)||[];

function eligible(node,animated){
  if(!node.isMesh||node.isSkinnedMesh||node.isInstancedMesh||node.geometry?.userData.motionOwned||node.children.length||!node.visible||node.userData.reconstructionBowString||dynamicName.test(node.name)||animated.has(node.name)||animated.has(node.uuid))return false;
  for(let current=node;current;current=current.parent)if(current.userData.visualCue||protectedName.test(current.name)||current.userData.geometricBatch)return false;
  const {geometry,material}=node;
  if(Array.isArray(material)||!material?.isMeshStandardMaterial||material.transparent||material.onBeforeCompile!==THREE.Material.prototype.onBeforeCompile||material.customProgramCacheKey!==THREE.Material.prototype.customProgramCacheKey)return false;
  if(node.onBeforeRender!==THREE.Object3D.prototype.onBeforeRender||node.onAfterRender!==THREE.Object3D.prototype.onAfterRender||node.raycast!==THREE.Mesh.prototype.raycast)return false;
  if(!geometry?.attributes.position||geometry.isInstancedBufferGeometry||geometry.drawRange.start!==0||geometry.drawRange.count!==Infinity||Object.keys(geometry.morphAttributes).length)return false;
  if(Object.values(geometry.attributes).some(attribute=>attribute.isInterleavedBufferAttribute||attribute.isInstancedBufferAttribute))return false;
  // Baking a reflection would also require changing winding/front-face state.
  // Leave those rare meshes separate rather than changing their culling.
  return node.matrix.determinant()>0;
}

export function optimizeGeometricSiblings(root,{animations=root?.animations||[],sharedScope=null}={}){
  if(!root)return {before:0,after:0,mergedGroups:0,retiredMeshes:0};
  if(optimized.has(root))return optimized.get(root);
  let geometric=false;root.traverse(node=>{if(node.userData.geometricRig)geometric=true;});
  const before=calls(root),stats={before,after:before,mergedGroups:0,retiredMeshes:0};
  if(!geometric)return stats;
  const animated=new Set();
  for(const animation of animations)for(const track of animation.tracks){try{animated.add(THREE.PropertyBinding.parseTrackName(track.name).nodeName);}catch{}}
  root.updateMatrixWorld(true);const groups=new Map(),originals=new Set();
  root.traverse(node=>{
    if(!eligible(node,animated))return;
    const key=[node.parent.uuid,node.material.uuid,layout(node.geometry),node.renderOrder,node.castShadow,node.receiveShadow,node.layers.mask,node.frustumCulled].join(';');
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(node);
  });
  for(const siblings of groups.values()){
    if(siblings.length<2)continue;
    let scope,key,row;
    if(sharedScope!==null){
      scope=sharedScopes.get(sharedScope);key=sharedSignature(siblings);row=scope?.get(key);
    }
    let geometry=row?.geometry;
    if(!geometry){
      const copies=siblings.map(node=>{
        const copy=node.geometry.clone(),geometry=copy.index?copy.toNonIndexed():copy;
        if(geometry!==copy)copy.dispose();return geometry.applyMatrix4(node.matrix);
      });
      try{geometry=mergeGeometries(copies,false);}finally{for(const copy of copies)copy.dispose();}
      if(geometry){geometry.computeBoundingBox();geometry.computeBoundingSphere();}
    }
    if(!geometry)continue;
    const first=siblings[0],parent=first.parent,merged=new THREE.Mesh(geometry,first.material);
    merged.name=`geometric_batch_${stats.mergedGroups+1}`;merged.userData.geometricBatch=true;
    if(sharedScope!==null){
      if(!scope){scope=new Map();sharedScopes.set(sharedScope,scope);}
      if(!row){row={geometry,scope,key,scopeId:sharedScope,users:0};scope.set(key,row);}
      row.users++;let borrowed=borrowedBatches.get(root);if(!borrowed){borrowed=new Map();borrowedBatches.set(root,borrowed);}borrowed.set(row,(borrowed.get(row)||0)+1);
      merged.userData.sharedGeometricBatch=true;
    }
    merged.castShadow=first.castShadow;merged.receiveShadow=first.receiveShadow;merged.renderOrder=first.renderOrder;merged.layers.mask=first.layers.mask;merged.frustumCulled=first.frustumCulled;
    for(const node of siblings){
      originals.add(node.geometry);
      // Names, transform origins and extras remain discoverable. Any runtime
      // endpoint/pivot/cue needing its own mesh was excluded above.
      const semantic=new THREE.Group().copy(node,false),index=parent.children.indexOf(node);
      parent.remove(node);parent.add(semantic);
      parent.children.splice(parent.children.indexOf(semantic),1);parent.children.splice(index,0,semantic);
    }
    parent.add(merged);stats.mergedGroups++;stats.retiredMeshes+=siblings.length;
  }
  stats.after=calls(root);retired.set(root,originals);optimized.set(root,stats);root.updateMatrixWorld(true);return stats;
}
