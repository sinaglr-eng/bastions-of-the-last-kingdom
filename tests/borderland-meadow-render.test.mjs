import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GridManager} from '../game/core/grid.js';
import {BorderlandMeadow} from '../game/render/borderland-meadow.js';

function decorationModel(){
  const model=new THREE.Group(),geometry=new THREE.BoxGeometry(.3,.2,.3);
  const material=new THREE.MeshStandardMaterial();
  for(const [x,z] of [[10,12],[11,12],[15,16]]){
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.set(x-18,.1,z-18);
    mesh.userData={meadowCell:[x,z],meadowCells:[[x,z],[x+1,z]]};
    model.add(mesh);
  }
  return {scene:model,animations:[]};
}

test('moving a wall and rerouting update the instanced dressing without changing walkability',async()=>{
  const grid=new GridManager(),meadow=new BorderlandMeadow(new THREE.Scene(),grid);
  await meadow.load(async()=>decorationModel());
  assert.equal(meadow.ready,true);assert.equal(meadow.placeholder,null);
  const [{batch}]=meadow.batches;
  const route=grid.route;
  grid.occupied.set('11,12',7);meadow.sync(grid);
  assert.equal(batch.count,1);
  assert.deepEqual(meadow.dressing.map(p=>p.node.visible),[false,false,true]);
  grid.occupied.delete('11,12');
  meadow.sync(grid,[{x:15,z:14},{x:15,z:18}]);
  assert.equal(batch.count,2);
  meadow.sync(grid);assert.equal(batch.count,3);
  assert.equal(grid.route,route);assert.equal(grid.type(15,16),'buildable');
  meadow.dispose();
});

test('interrupted scenery requests remain playable and disposed battlefields reject late installs',async()=>{
  const scene=new THREE.Scene(),meadow=new BorderlandMeadow(scene,new GridManager());
  await assert.rejects(meadow.load(async()=>{throw Error('disconnected');}),/disconnected/);
  assert.equal(meadow.placeholder.visible,true);assert.equal(meadow.ready,false);
  let finish;const pending=meadow.load(()=>new Promise(resolve=>{finish=resolve;}));
  meadow.dispose();finish(decorationModel());await pending;
  assert.equal(meadow.ready,false);assert.equal(scene.children.length,0);
});
