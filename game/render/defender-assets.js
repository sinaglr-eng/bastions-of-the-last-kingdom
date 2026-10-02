import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';

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
  scene.animations=[...animations];
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
