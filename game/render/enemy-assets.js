import * as THREE from 'three';
import {enemyModel} from './models.js';

export function enemyAssetKey(enemy,templates){
  const variant=`${enemy.type}-${enemy.model}`;
  return templates.has(variant)?variant:enemy.type;
}
export function enemyFigure(enemy,templates){
  const template=templates.get(enemyAssetKey(enemy,templates));
  if(!template)return enemyModel(enemy.type,enemy);
  const root=new THREE.Group(),body=template.clone(true),limbs=[],wings=[];
  root.add(body);root.userData.sharedAsset=true;root.userData.body=body;
  body.traverse(o=>{
    if(o.name.startsWith('leg_')){o.userData.restRotation=o.rotation.x;limbs.push(o);}
    if(o.name.startsWith('wing_')){o.userData.restRotation=o.rotation.z;wings.push(o);}
    if(o.name==='refraction_shards')root.userData.shards=o;
  });
  root.userData.limbs=limbs;root.userData.wings=wings;
  root.userData.barHeight=new THREE.Box3().setFromObject(body).max.y+.15;
  return root;
}
export function disposeEnemyFigure(root){
  // Imported clones share the pack's geometries and materials with future spawns.
  root.userData.bar?.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  root.userData.aura?.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  if(!root.userData.sharedAsset)root.userData.body?.traverse(o=>o.geometry?.dispose());
}
