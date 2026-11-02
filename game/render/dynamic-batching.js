import * as THREE from 'three';import{mergeGeometries}from'three/addons/utils/BufferGeometryUtils.js';
const layout=g=>Object.entries(g.attributes).map(([k,a])=>[k,a.itemSize,a.normalized,a.array.constructor.name].join(':')).sort().join('|');
const states=new WeakMap();
const releaseRow=row=>{if(row.ownerDisposed&&!row.users&&!row.retired){row.retired=true;row.geometry.dispose();}};
// Private deforming buffers keep every authored part/anchor. Compatible parts
// under one moving parent share a draw; only changed attributes are copied.
// Identical submitted poses may be borrowed read-only. Owners rotate reusable
// buffers before writing; a peer or corpse pins its exact older pose until its
// final release. Pool growth is bounded by actual retained poses, not frames.
export function batchDynamicActor(source){
 source.updateWorldMatrix(true,true);const groups=new Map(),batches=[],originals=[],records=[],slots=[],point=new THREE.Vector3(),normal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3();
 source.traverse(mesh=>{
  const g=mesh.geometry,m=mesh.material;if(!mesh.isMesh||mesh.isSkinnedMesh||mesh.children.length||!g?.userData.motionOwned||!mesh.visible||!mesh.layers.mask||Array.isArray(m)||!m?.isMeshStandardMaterial||m.transparent||Object.keys(g.morphAttributes).length||g.drawRange.start!==0||g.drawRange.count!==Infinity||Object.values(g.attributes).some(a=>a.isInterleavedBufferAttribute||a.isInstancedBufferAttribute))return;
  if(m.onBeforeCompile!==THREE.Material.prototype.onBeforeCompile||m.customProgramCacheKey!==THREE.Material.prototype.customProgramCacheKey||mesh.onBeforeRender!==THREE.Object3D.prototype.onBeforeRender||mesh.onAfterRender!==THREE.Object3D.prototype.onAfterRender||mesh.raycast!==THREE.Mesh.prototype.raycast||mesh.matrix.determinant()<=0)return;
  for(let n=mesh;n;n=n.parent)if(n.userData.visualCue||n.name==='refraction_shards')return;
  const key=[mesh.parent.uuid,m.uuid,layout(g),!!g.index,mesh.renderOrder,mesh.castShadow,mesh.receiveShadow,mesh.layers.mask].join(';');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);
 });
 for(const meshes of groups.values()){
  if(meshes.length<2)continue;const copies=meshes.map(m=>m.geometry.clone().applyMatrix4(m.matrix));let geometry;try{geometry=mergeGeometries(copies,false);}finally{for(const copy of copies)copy.dispose();}if(!geometry)continue;
  const first=meshes[0],batch=new THREE.Mesh(geometry,first.material);batch.name='Private dynamic surface batch '+(batches.length+1);batch.userData.dynamicActorBatch=true;batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;batch.renderOrder=first.renderOrder;batch.layers.mask=first.layers.mask;batch.frustumCulled=false;first.parent.add(batch);batches.push(batch);let start=0;
  const slot={batch,pool:[],borrowed:null,signature:meshes.map(m=>[m.parent.name,m.name,m.material.uuid,layout(m.geometry),m.geometry.attributes.position.count,m.geometry.index?.count,...m.matrix.elements].join(':')).join('|')},row={geometry,users:0,ownerDisposed:false,versions:new Map()};slot.own=row;slot.pool.push(row);slots.push(slot);
  for(const mesh of meshes){const part={mesh,batch,slot,start,count:mesh.geometry.attributes.position.count};records.push(part);row.versions.set(part,{attributes:Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([k,a])=>[k,a.version])),matrix:mesh.matrix.clone()});start+=mesh.geometry.attributes.position.count;originals.push([mesh,mesh.layers.mask]);mesh.layers.mask=0;}
 }
 let disposed=false;
 function unborrow(slot){if(!slot.borrowed)return;slot.borrowed.users--;releaseRow(slot.borrowed);slot.borrowed=null;}
 function writable(slot){
  unborrow(slot);
  if(slot.own.users){
   let free=slot.pool.find(row=>!row.users);if(!free){const previous=slot.own;free={geometry:previous.geometry.clone(),users:0,ownerDisposed:false,versions:new Map([...previous.versions].map(([part,state])=>[part,{attributes:{...state.attributes},matrix:state.matrix.clone()}]))};slot.pool.push(free);}slot.own=free;
  }slot.batch.geometry=slot.own.geometry;
 }
 function sync(){
  if(disposed)return;const changed=new Map();for(const slot of slots)writable(slot);
  for(const part of records){const{mesh,batch,slot,start,count}=part,state=slot.own.versions.get(part),transformed=!state.matrix.equals(mesh.matrix);normalMatrix.getNormalMatrix(mesh.matrix);
   for(const[key,a]of Object.entries(mesh.geometry.attributes)){if(state.attributes[key]===a.version&&(!transformed||!['position','normal','tangent'].includes(key)))continue;const target=batch.geometry.attributes[key];
    if(key==='position'||key==='normal'||key==='tangent'){for(let i=0;i<count;i++){if(key==='position'){point.fromBufferAttribute(a,i).applyMatrix4(mesh.matrix);target.setXYZ(start+i,point.x,point.y,point.z);}else{normal.fromBufferAttribute(a,i);if(key==='tangent')normal.transformDirection(mesh.matrix);else normal.applyMatrix3(normalMatrix).normalize();target.setXYZ(start+i,normal.x,normal.y,normal.z);if(a.itemSize===4)target.setW(start+i,a.getW(i));}}}
    else target.array.set(a.array,start*a.itemSize);
    state.attributes[key]=a.version;if(!changed.has(batch))changed.set(batch,new Set());changed.get(batch).add(key);
   }state.matrix.copy(mesh.matrix);
  }
  for(const[batch,keys]of changed)for(const key of keys)batch.geometry.attributes[key].needsUpdate=true;
 }
 const api={batches,parts:records,sync,shareFrom(other){
  const peer=states.get(other);if(disposed||!peer||peer.disposed()||peer.slots.length!==slots.length||peer.slots.some((s,i)=>s.signature!==slots[i].signature))return false;
  for(let i=0;i<slots.length;i++){const slot=slots[i],from=peer.slots[i],row=from.borrowed||from.own;if(slot.borrowed===row)continue;unborrow(slot);if(slot.pool.includes(row))slot.own=row;else{slot.borrowed=row;row.users++;}slot.batch.geometry=row.geometry;}return true;
 },dispose(){if(disposed)return;disposed=true;for(const slot of slots){unborrow(slot);for(const row of slot.pool){row.ownerDisposed=true;releaseRow(row);}slot.batch.removeFromParent();}for(const[mesh,layers]of originals)mesh.layers.mask=layers;}};
 states.set(api,{slots,disposed:()=>disposed});return api;
}

