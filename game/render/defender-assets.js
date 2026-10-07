import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {Group,Mesh,RingGeometry,BoxGeometry,MeshBasicMaterial,DoubleSide} from 'three';
import {prepareReconstructedDefender} from './reconstruction-adapter.js';
import {optimizeGeometricSiblings} from './geometric-batching.js';

// A pending asset must not impersonate a defender from a different renderer
// or rank. This low, selectable dial retains the occupied tile while the
// exact approved figure loads. It has no character rig or source materials.
export function defenderLoadingTemplate(status='loading'){
  const root=new Group();root.name=status==='unavailable'?'Defender model unavailable':'Loading approved defender model';
  root.userData.defenderModelStatus=status;
  const material=new MeshBasicMaterial({color:status==='unavailable'?'#e09a7c':'#e6d7a9',side:DoubleSide});
  const ring=new Mesh(new RingGeometry(.20,.27,24),material);ring.rotation.x=-Math.PI/2;ring.position.y=.06;root.add(ring);
  const bar=(length,angle)=>{const mesh=new Mesh(new BoxGeometry(.028,.035,length),material);mesh.position.set(Math.sin(angle)*length/2,.08,Math.cos(angle)*length/2);mesh.rotation.y=angle;root.add(mesh);};
  if(status==='unavailable'){bar(.16,Math.PI/4);bar(.16,-Math.PI/4);}
  else {bar(.15,0);bar(.11,-Math.PI/2);}
  return root;
}

// A skinned actor needs its own bones and Skeleton. Mesh geometry, textures,
// materials and immutable AnimationClips remain shared with the cached asset.
export function cloneDefenderTemplate(source){
  const actor=cloneSkeleton(source);actor.animations=[...(source.animations||[])];
  // glTF material batches share a single skin. SkeletonUtils otherwise makes
  // one Skeleton per batch; reuse that actor's private skin and bone texture.
  const sourceMeshes=[];source.traverse(node=>{if(node.isSkinnedMesh)sourceMeshes.push(node);});
  const skeletons=new Map();let index=0;
  actor.traverse(node=>{if(!node.isSkinnedMesh)return;const sourceSkin=sourceMeshes[index++].skeleton;if(skeletons.has(sourceSkin))node.skeleton=skeletons.get(sourceSkin);else skeletons.set(sourceSkin,node.skeleton);});
  return actor;
}
const disposedInstances=new WeakSet();
export function disposeDefenderInstance(actor){
  if(!actor||disposedInstances.has(actor))return;disposedInstances.add(actor);
  const skeletons=new Set();actor.traverse(node=>{if(node.isSkinnedMesh)skeletons.add(node.skeleton);});
  for(const skeleton of skeletons)skeleton.dispose();
}

export function installDefenderTemplate(field,entry,scene,animations=scene.animations||[]){
  if(field.disposed)return false;
  prepareReconstructedDefender(scene,entry);
  optimizeGeometricSiblings(scene,{animations});
  scene.animations=[...animations];
  scene.userData.defenderModelStatus='ready';scene.userData.defenderModelKey=`${entry.family}:${entry.tier}`;
  field.imported.set(`${entry.family}:${entry.tier}`,scene);
  let changed=false;
  for(const tower of field.game.towers){
    const rank=field.game.data.towers[tower.family]?.advanced?1:tower.tier;
    if(tower.state==='ruin'||tower.family!==entry.family||rank!==entry.tier)continue;
    const model=field.models.get(tower.id);if(model){model.signature='';changed=true;}
  }
  if(changed)field.sync();return true;
}

// Figure selection must hit the elevated model, not the ground tile behind it.
export function pointedTower(raycaster,models){
  const objects=[];const ids=new Map();for(const [id,model] of models){objects.push(model.object);ids.set(model.object,id);}
  const hit=raycaster.intersectObjects(objects,true)[0];if(!hit)return null;
  for(let node=hit.object;node;node=node.parent)if(ids.has(node))return ids.get(node);
  return null;
}
