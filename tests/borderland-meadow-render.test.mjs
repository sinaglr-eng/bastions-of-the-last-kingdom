import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GridManager} from '../game/core/grid.js';
import {BorderlandMeadow} from '../game/render/borderland-meadow.js';
import {meadowMarket} from '../game/render/meadow-market.js';
import {BATTLEFIELD_ASSET,STRONGHOLD_ASSETS,releaseAsset} from '../game/release.js';

test('an inhabitant turns, walks with alternating poses, then stands with feet together',()=>{
  const resident=new THREE.Group(),limbs=new THREE.Mesh();
  resident.userData={marketStart:0,marketAisles:JSON.stringify([[[0,0],[2,0]],[[1],[0]]])};
  limbs.morphTargetInfluences=Array(8).fill(0);
  resident.add(limbs);
  const tick=meadowMarket([resident],()=>.5);
  const poses=new Set();
  let left=false,arrived=false;
  for(let frame=0;frame<350;frame++){
    tick(1/60);
    const weights=limbs.morphTargetInfluences;
    if(resident.position.x>.05&&resident.position.x<1.95){
      left=true;
      poses.add(weights.indexOf(Math.max(...weights)));
    }
    if(resident.position.x===2&&weights.every(x=>x===0)){arrived=true;break;}
  }
  assert.ok(left&&arrived);
  assert.equal(poses.size,8);
});

test('shipped settlements carry their resident walks independently of the five common checkpoints',()=>{
  function documentFor(asset){
    const bytes=readFileSync(new URL('../public/'+asset,import.meta.url));
    return JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  }
  const map=documentFor(BATTLEFIELD_ASSET);
  assert.deepEqual(map.nodes.map(n=>n.extras?.checkpointIndex).filter(Number.isInteger).sort(),[1,2,3,4,5]);
  assert.ok(!map.nodes.some(n=>Number.isInteger(n.extras?.marketStart)));
  const animated=map.animations.flatMap(clip=>clip.channels
    .filter(channel=>channel.target.path==='weights')
    .map(channel=>map.nodes[channel.target.node].name));
  for(const name of ['Ogre Glutton cook','Ogre Glutton / seasoning cook','Field kitchen','Campfire']){
    assert.ok(animated.some(node=>node.startsWith(name)),name);
  }
  for(const asset of Object.values(STRONGHOLD_ASSETS)){
    const {nodes,animations}=documentFor(asset);
    const residents=nodes.filter(n=>Number.isInteger(n.extras?.marketStart));
    assert.ok(residents.length>1,asset);
    assert.ok(animations.some(clip=>clip.channels.length),asset);
    const [points,links]=JSON.parse(residents[0].extras.marketAisles);
    for(const resident of residents){
      const start=resident.extras.marketStart;
      assert.equal(points[start].length,2);
      assert.ok(links[start].length>0);
    }
  }
});

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
  await meadow.load(async url=>url===releaseAsset(BATTLEFIELD_ASSET)?decorationModel():{scene:new THREE.Group(),animations:[]});
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
  let finish;const delayed=new Promise(resolve=>{finish=resolve;});
  const pending=meadow.load(async()=>{await delayed;return decorationModel();});
  meadow.dispose();finish();await pending;
  assert.equal(meadow.ready,false);assert.equal(scene.children.length,0);
});

test('each run loads its own stronghold and follows the ambient clock until disposal',async()=>{
  for(const faction of ['crown','forge','grove',null]){
    const scene=new THREE.Scene(),meadow=new BorderlandMeadow(scene,new GridManager(),faction);
    const resident=new THREE.Group(),stronghold=new THREE.Group(),urls=[];
    resident.name='Resident';stronghold.add(resident);
    const walk=new THREE.AnimationClip('Patrol',2,[new THREE.NumberKeyframeTrack('Resident.position[x]',[0,1,2],[0,1,0])]);
    await meadow.load(async url=>{
      urls.push(url);
      return url===releaseAsset(BATTLEFIELD_ASSET)?decorationModel():{scene:stronghold,animations:[walk]};
    });
    assert.deepEqual(urls,[releaseAsset(BATTLEFIELD_ASSET),releaseAsset(STRONGHOLD_ASSETS[faction||'crown'])]);
    meadow.update(.5);assert.equal(resident.position.x,.5);
    meadow.update(0);assert.equal(resident.position.x,.5);
    meadow.update(.25);assert.equal(resident.position.x,.75);
    meadow.dispose();assert.equal(scene.children.length,0);assert.equal(meadow.mixers.length,0);
  }
});

test('a failed stronghold load releases the terrain before a clean retry',async()=>{
  const meadow=new BorderlandMeadow(new THREE.Scene(),new GridManager(),'grove'),terrain=decorationModel();
  let disposed=0;
  terrain.scene.children[0].geometry.addEventListener('dispose',()=>disposed++);
  await assert.rejects(meadow.load(async url=>{
    if(url===releaseAsset(BATTLEFIELD_ASSET))return terrain;
    throw new Error('interrupted stronghold download');
  }),/interrupted stronghold/);
  assert.equal(disposed,1);assert.equal(meadow.placeholder.visible,true);
  await meadow.load(async()=>({scene:new THREE.Group(),animations:[]}));
  assert.equal(meadow.ready,true);meadow.dispose();
});
