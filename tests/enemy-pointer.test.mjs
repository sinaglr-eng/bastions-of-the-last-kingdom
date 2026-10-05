import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import * as THREE from 'three';
import {Game} from '../game/core/game.js';
import {pointedEnemy,createEnemySelectionRing,syncEnemySelectionRing,disposeEnemySelectionRing} from '../game/render/enemy-pointer.js';
import {enemyFigure,disposeEnemyFigure} from '../game/render/enemy-assets.js';
import {castleWallModel} from '../game/render/walls.js';
import {scaleBattlefieldUnit} from '../game/render/battlefield-scale.js';
import {optimizeGeometricSiblings} from '../game/render/geometric-batching.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {PointerTapGesture,SelectedTowerDoubleTap} from '../game/render/touch-input.js';

// Load Vite's JSON imports read-only so actual World methods can be exercised
// with a real camera/raycaster and no WebGL/DOM construction.
const jsonHooks=registerHooks({load(url,context,nextLoad){
  if(url.startsWith('file:')&&url.endsWith('.json'))return {format:'module',source:`export default JSON.parse(${JSON.stringify(readFileSync(new URL(url),'utf8'))});`,shortCircuit:true};
  return nextLoad(url,context);
}});
const {Battlefield}=await import('../game/render/world.js');jsonHooks.deregister();

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL('../data/'+key+'.json',import.meta.url)))]));
function arena(){const game=new Game(data,{seed:12});game.phase='combat';game.combat.spawnQueue=[{time:999999,type:'host_01'}];return game;}
const box=(w=1,h=1,d=1)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial());
function figure(x=0,y=0,z=0){const root=new THREE.Group(),body=new THREE.Group(),nested=new THREE.Group();nested.add(box());body.add(nested);root.add(body);root.userData.body=body;root.position.set(x,y,z);return root;}
const ray=(x=0,y=0)=>new THREE.Raycaster(new THREE.Vector3(x,y,10),new THREE.Vector3(0,0,-1));
const event=(pointerId=1,type='mouse',button=0,x=400,y=300)=>({pointerId,pointerType:type,button,clientX:x,clientY:y});

test('nearest visible nested body wins; dead, concealed, invisible and effect-only meshes cannot be picked',()=>{
  const game=arena(),near=game.combat.spawn('host_01'),far=game.combat.spawn('host_01'),a=figure(0,0,3),b=figure(),figures=new Map([[near.id,a],[far.id,b]]);
  assert.equal(pointedEnemy(ray(),figures,game),near.id);a.visible=false;assert.equal(pointedEnemy(ray(),figures,game),far.id);a.visible=true;
  near.dead=true;assert.equal(pointedEnemy(ray(),figures,game),far.id);near.dead=false;near.cloaked=true;near.x=12;near.z=20;assert.equal(game.combat.isRevealed(near),false);assert.equal(pointedEnemy(ray(),figures,game),far.id);near.cloaked=false;
  a.userData.body.children[0].visible=false;const bar=box();bar.position.z=6;a.add(bar);a.userData.bar=bar;const aura=box();aura.position.z=7;a.add(aura);a.userData.aura=aura;
  const shards=box();shards.position.z=8;a.userData.body.add(shards);a.userData.shards=shards;
  const orbit=box();orbit.position.z=9;orbit.userData.sourceOrbitGem=true;a.userData.body.add(orbit);
  assert.equal(pointedEnemy(ray(),figures,game),far.id,'Bars, aura, shard and orbit surfaces are not body targets');
  b.userData.body.children[0].children[0].material.visible=false;assert.equal(pointedEnemy(ray(),figures,game),null);
  game.phase='build';a.userData.body.children[0].visible=true;assert.equal(pointedEnemy(ray(),figures,game),null);
});

test('actual imported optimized ground and flying enemy body triangles remain pickable without geometry mutation',async()=>{
  for(const id of ['host_01','host_25']){
    const bytes=readFileSync(new URL('../public/assets/geometric/enemies/'+id+'.glb',import.meta.url)),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    const before=[];gltf.scene.traverse(node=>{if(node.isMesh)before.push(Array.from(node.geometry.attributes.position.array));});
    optimizeGeometricSiblings(gltf.scene);const game=arena(),enemy=game.combat.spawn(id),actor=scaleBattlefieldUnit(enemyFigure(enemy,new Map([[id,gltf.scene]])),enemy);actor.position.y=enemy.flying?.8:0;
    const bounds=new THREE.Box3().setFromObject(actor.userData.body,true),centre=bounds.getCenter(new THREE.Vector3()),directions=[new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0)];
    assert.ok(directions.some(direction=>pointedEnemy(new THREE.Raycaster(centre.clone().addScaledVector(direction,10),direction.clone().negate()),new Map([[enemy.id,actor]]),game)===enemy.id),`${id}: real body surface intersects inspection ray`);
    const optimized=[];actor.userData.body.traverse(node=>{if(node.isMesh)optimized.push(node.geometry.attributes.position.array.slice());});
    for(let i=0;i<3;i++)pointedEnemy(ray(),new Map([[enemy.id,actor]]),game);
    let index=0;actor.userData.body.traverse(node=>{if(node.isMesh)assert.deepEqual(node.geometry.attributes.position.array,optimized[index++]);});
    assert.ok(before.length>20);disposeEnemyFigure(actor);disposeDecodedGeometricAsset(gltf);
  }
});

test('a solid wall face occludes picking while the flying body above its actual wall geometry remains selectable',()=>{
  const game=arena(),enemy=game.combat.spawn('host_25'),actor=figure(0,2,0),wall=castleWallModel(0);wall.position.z=2;
  const options={occluders:[wall]},figures=new Map([[enemy.id,actor]]);
  assert.equal(pointedEnemy(ray(0,2),figures,game,options),enemy.id,'Air body above the wall is independently targetable');
  actor.position.y=.35;assert.equal(pointedEnemy(ray(0,.35),figures,game,options),null,'The visible stone face must retain wall selection');wall.visible=false;assert.equal(pointedEnemy(ray(0,.35),figures,game,options),enemy.id);
});

function viewport(game,figures=new Map()){
  const camera=new THREE.PerspectiveCamera(45,4/3,.1,100);camera.position.set(0,2,10);camera.lookAt(0,2,0);camera.updateMatrixWorld();
  const element={getBoundingClientRect:()=>({left:0,top:0,width:800,height:600}),style:{}},calls=[];
  return {game,enemies:figures,models:new Map(),camera,renderer:{domElement:element},raycaster:new THREE.Raycaster(),pointer:new THREE.Vector2(),plane:new THREE.Plane(new THREE.Vector3(0,1,0),-.03),maze:{editing:false},cursor:{visible:false,position:new THREE.Vector3(),material:{color:new THREE.Color()}},ghost:{visible:false},doubleTap:new SelectedTowerDoubleTap(()=>100),movePointer:Battlefield.prototype.movePointer,onTile:(x,z)=>calls.push([x,z]),calls};
}

test('World accepted mouse/touch/pen taps inspect an air enemy before plane/tile selection, and maze editing bypasses enemy hits',()=>{
  for(const type of ['mouse','touch','pen']){
    const game=arena(),enemy=game.combat.spawn('host_25'),view=viewport(game,new Map([[enemy.id,figure(0,2,0)]]));
    const gesture=new PointerTapGesture();gesture.start(event(1,type));assert.equal(gesture.end(event(1,type)),true);
    Battlefield.prototype.selectPointer.call(view,event(1,type));assert.equal(game.enemySelection,enemy);assert.deepEqual(view.calls,[]);assert.equal(view.hover,null);assert.equal(view.cursor.visible,false);assert.equal(view.renderer.domElement.style.cursor,'pointer');
    view.maze.editing=true;view.movePointer(event(1,type));assert.equal(view.hoverEnemy,null,'Maze mode cannot select an enemy');
  }
});

test('existing tap gate rejects drags, right clicks and multi-touch before enemy or tower selection',()=>{
  const game=arena(),enemy=game.combat.spawn('host_01'),view=viewport(game,new Map([[enemy.id,figure(0,2,0)]]));
  const release=(gesture,e)=>{if(gesture.end(e))Battlefield.prototype.selectPointer.call(view,e);};
  const g=new PointerTapGesture();g.start(event());g.move(event(1,'mouse',0,430));release(g,event());assert.equal(game.selectedEnemy,null);
  g.start(event(1,'mouse',2));release(g,event(1,'mouse',2));assert.equal(game.selectedEnemy,null);
  g.start(event(1,'touch'));g.start(event(2,'touch',0,500));release(g,event(1,'touch'));release(g,event(2,'touch',0,500));assert.equal(game.selectedEnemy,null);assert.deepEqual(view.calls,[]);
});

test('World tower selection and candidate double-tap still run when no visible enemy surface is hit',()=>{
  const game=arena(),view=viewport(game),tower={id:7,x:18,z:18,state:'draft',round:game.round};game.towers.push(tower);game.phase='select';
  view.movePointer=()=>{view.hoverEnemy=null;view.hover={x:18,z:18};};view.onTile=()=>game.select(7);let kept=0;game.keep=()=>kept++;
  Battlefield.prototype.selectPointer.call(view,event(1,'touch'));assert.equal(game.selected,7);assert.equal(kept,0);
  Battlefield.prototype.selectPointer.call(view,event(2,'touch'));assert.equal(kept,1);assert.equal(view.doubleTap.last,null);
});

test('selection ring follows actual world position/size for a flying boss, has no raycast and disposes its owned resources',()=>{
  const ring=createEnemySelectionRing(),scene=new THREE.Scene(),actor=figure(3,.8,4),enemy={flying:true,boss:true};scene.add(actor,ring);
  assert.equal(syncEnemySelectionRing(ring,enemy,actor),true);const normal=ring.scale.x;actor.scale.setScalar(1.875);actor.position.set(6,1.1,8);assert.equal(syncEnemySelectionRing(ring,enemy,actor),true);
  assert.ok(Math.abs(ring.scale.x/normal-1.875)<1e-7);assert.deepEqual(ring.position.toArray(),[6,1.165,8]);scene.updateMatrixWorld(true);assert.deepEqual(ray().intersectObject(ring),[]);
  assert.equal(syncEnemySelectionRing(ring,null,actor),false);assert.equal(ring.visible,false);actor.visible=false;assert.equal(syncEnemySelectionRing(ring,enemy,actor),false);
  let geometry=0,material=0;ring.geometry.addEventListener('dispose',()=>geometry++);ring.material.addEventListener('dispose',()=>material++);disposeEnemySelectionRing(ring);assert.equal(ring.parent,null);assert.equal(geometry,1);assert.equal(material,1);
});
