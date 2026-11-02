import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {castleWallModel} from '../game/render/walls.js';
import {WallInstances} from '../game/render/wall-instances.js';
import {pointedTower} from '../game/render/defender-assets.js';
import {pointedEnemy} from '../game/render/enemy-pointer.js';

test('wall instances retain exact per-tile geometry, materials, transforms, shadows and selection through moves/removal',()=>{
  const scene=new THREE.Scene(),template=castleWallModel(10),models=new Map(),sources=[];
  for(let id=1;id<=3;id++){const object=template.clone(true);object.position.set((id-1)*2,0,0);scene.add(object);models.set(id,{object});object.traverse(n=>{if(n.isMesh)sources.push(n);});}
  const helper=new WallInstances(scene);let geometryDisposals=0,materialDisposals=0;
  template.traverse(n=>{n.geometry?.addEventListener('dispose',()=>geometryDisposals++);n.material?.addEventListener('dispose',()=>materialDisposals++);});
  assert.equal(helper.sync(sources),true);assert.equal(helper.batches.length,5);assert.equal(helper.sync(sources),false);
  for(const batch of helper.batches){assert.equal(batch.count,3);assert.equal(batch.castShadow,true);assert.equal(batch.receiveShadow,true);for(let i=0;i<3;i++){const original=[...models.values()][i].object.children.find(n=>n.geometry===batch.geometry);assert.ok(original);assert.equal(batch.material,original.material);const matrix=new THREE.Matrix4();batch.getMatrixAt(i,matrix);assert.deepEqual(matrix.elements,original.matrixWorld.elements);assert.equal(original.visible,false);}}
  const ray=new THREE.Raycaster(new THREE.Vector3(2,8,0),new THREE.Vector3(0,-1,0));assert.equal(pointedTower(ray,models),2);
  models.get(2).object.position.x=3;assert.equal(helper.sync(sources),true);ray.ray.origin.x=3;assert.equal(pointedTower(ray,models),2);
  const removed=models.get(2).object;removed.removeFromParent();helper.sync(sources.filter(n=>n.parent!==removed));assert.ok(removed.children.every(n=>n.visible));assert.ok(helper.batches.every(b=>b.count===2));helper.dispose();assert.ok(sources.every(n=>n.visible));assert.equal(geometryDisposals,0);assert.equal(materialDisposals,0);
  template.traverse(n=>n.geometry?.dispose());
});
test('instanced wall originals still occlude enemies and do not make hidden ancestors selectable',()=>{
  const scene=new THREE.Scene(),a=castleWallModel(),b=a.clone(true);b.position.x=2;scene.add(a,b);const helper=new WallInstances(scene),meshes=[];for(const wall of[a,b])wall.traverse(n=>{if(n.isMesh)meshes.push(n);});helper.sync(meshes);
  const body=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2),new THREE.MeshStandardMaterial()),figure=new THREE.Group();figure.add(body);figure.userData.body=body;figure.position.y=-1;scene.add(figure);scene.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(0,8,0),new THREE.Vector3(0,-1,0)),figures=new Map([[1,figure]]),game={phase:'combat',combat:{enemies:[{id:1,hp:10}],isRevealed:()=>true}};
  assert.equal(pointedEnemy(ray,figures,game,{occluders:[a]}),null);a.visible=false;assert.equal(pointedEnemy(ray,figures,game,{occluders:[a]}),1);helper.dispose();body.geometry.dispose();body.material.dispose();a.traverse(n=>n.geometry?.dispose());
});
