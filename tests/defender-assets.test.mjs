import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {installDefenderTemplate,pointedTower} from '../game/render/defender-assets.js';

test('Master Druid already on the battlefield refreshes when its own GLB arrives, without waiting for other downloads',()=>{
  const field={disposed:false,imported:new Map(),models:new Map([[1,{signature:'fallback'}],[2,{signature:'mage'}],[3,{signature:'wall'}]]),game:{data:{towers:{greenheart:{advanced:true},mage:{}}},towers:[{id:1,family:'greenheart',tier:3,state:'active'},{id:2,family:'mage',tier:1,state:'active'},{id:3,family:'greenheart',tier:1,state:'ruin'}]},sync(){this.refreshes=(this.refreshes||0)+1;}};
  const template=new Group();assert.equal(installDefenderTemplate(field,{family:'greenheart',tier:1},template),true);
  assert.equal(field.imported.get('greenheart:1'),template);assert.equal(field.models.get(1).signature,'');assert.equal(field.models.get(2).signature,'mage');assert.equal(field.models.get(3).signature,'wall');assert.equal(field.refreshes,1);
  field.disposed=true;assert.equal(installDefenderTemplate(field,{family:'mage',tier:1},new Group()),false);assert.equal(field.imported.has('mage:1'),false);
});

test('clicking an elevated figure resolves its tower rather than the empty ground behind it',()=>{
  const object=new Group(),actor=new Group(),mesh=new Mesh(new BoxGeometry(.5,2,.5),new MeshBasicMaterial());mesh.position.set(0,2,0);actor.add(mesh);object.add(actor);object.updateMatrixWorld(true);
  const ray=new Raycaster(new Vector3(0,3,5),new Vector3(0,-.2,-1).normalize());assert.equal(pointedTower(ray,new Map([[7,{object}]])),7);
  ray.set(new Vector3(4,3,5),new Vector3(0,-.2,-1).normalize());assert.equal(pointedTower(ray,new Map([[7,{object}]])),null);mesh.geometry.dispose();mesh.material.dispose();
});
