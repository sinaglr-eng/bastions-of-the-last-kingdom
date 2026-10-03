import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {disposeGeometricResources,disposeDecodedGeometricAsset,adoptDecodedGeometricAsset} from '../game/render/geometric-resources.js';
import {loadModelEntries} from '../game/render/geometric-assets.js';

function fixture(){
  let bitmapCloses=0;
  const bitmap={close(){bitmapCloses++;}},texture=new THREE.Texture(bitmap),otherTexture=new THREE.Texture(bitmap);
  const geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial({map:texture,normalMap:otherTexture});
  const shader=new THREE.ShaderMaterial({uniforms:{maps:{value:[texture,otherTexture]}}});
  const first=new THREE.Group(),second=new THREE.Group();first.add(new THREE.Mesh(geometry,[material,shader]));second.add(new THREE.Mesh(geometry,material));
  const events={geometry:0,material:0,shader:0,texture:0,otherTexture:0};
  for(const [name,resource] of Object.entries({geometry,material,shader,texture,otherTexture}))resource.addEventListener('dispose',()=>events[name]++);
  return {first,second,geometry,material,shader,texture,otherTexture,events,closes:()=>bitmapCloses,gltf:{scene:first,scenes:[first,second]}};
}

test('final cache cleanup emits one GPU buffer/material/texture disposal and closes a shared bitmap once across roots and clones',()=>{
  const f=fixture(),clone=f.first.clone(true),vertices=f.geometry.attributes.position.array.slice();
  assert.deepEqual(disposeGeometricResources([f.first,f.second,clone]),{geometries:1,materials:2,textures:2,bitmaps:1});
  assert.deepEqual(f.events,{geometry:1,material:1,shader:1,texture:1,otherTexture:1});assert.equal(f.closes(),1);
  assert.deepEqual(f.geometry.attributes.position.array,vertices,'disposal never rewrites source geometry');
  assert.deepEqual(disposeDecodedGeometricAsset(f.gltf),{geometries:0,materials:0,textures:0,bitmaps:0});
  assert.deepEqual(f.events,{geometry:1,material:1,shader:1,texture:1,otherTexture:1});assert.equal(f.closes(),1);
});

test('a live decoded asset is adopted without releasing its shared buffers, while rejected installation releases every scene',()=>{
  const live=fixture(),cache=new Map();
  assert.equal(adoptDecodedGeometricAsset(live.gltf,gltf=>{cache.set('live',gltf.scene);return true;}),true);
  assert.equal(cache.get('live'),live.first);assert.deepEqual(live.events,{geometry:0,material:0,shader:0,texture:0,otherTexture:0});assert.equal(live.closes(),0);
  const rejected=fixture();assert.equal(adoptDecodedGeometricAsset(rejected.gltf,()=>false),false);
  assert.deepEqual(rejected.events,{geometry:1,material:1,shader:1,texture:1,otherTexture:1});assert.equal(rejected.closes(),1);
  disposeDecodedGeometricAsset(live.gltf);
});

test('all in-flight late decodes release GPU and bitmap resources without install or further dispatch after a battlefield is disposed',async()=>{
  const fixtures=[],releases=[];let disposed=false,installs=0,decodes=0;
  const run=loadModelEntries(Array.from({length:9},(_,id)=>({id})),async()=>{
    const f=fixture();fixtures.push(f);decodes++;
    await new Promise(resolve=>releases.push(resolve));
    assert.equal(adoptDecodedGeometricAsset(f.gltf,()=>{installs++;return true;},{isDisposed:()=>disposed}),false);
  },{concurrency:3,isDisposed:()=>disposed});
  assert.equal(decodes,3);disposed=true;for(const release of releases)release();
  assert.deepEqual(await run,[]);assert.equal(installs,0);assert.equal(decodes,3);
  for(const f of fixtures){assert.deepEqual(f.events,{geometry:1,material:1,shader:1,texture:1,otherTexture:1});assert.equal(f.closes(),1);}
});

test('an installation failure releases the first decode before a retry while preserving the original error',async()=>{
  const first=fixture(),second=fixture(),failure=new Error('renderer sync failed'),attempts=[];
  const failures=await loadModelEntries([{id:'retry'}],async()=>{
    for(const gltf of [first.gltf,second.gltf]){
      try{
        adoptDecodedGeometricAsset(gltf,()=>{
          attempts.push(gltf);
          if(gltf===first.gltf)throw failure;
          assert.deepEqual(first.events,{geometry:1,material:1,shader:1,texture:1,otherTexture:1});
          return true;
        });
        return;
      }catch(error){assert.equal(error,failure);}
    }
  });
  assert.deepEqual(failures,[]);assert.equal(attempts.length,2);assert.equal(first.closes(),1);assert.equal(second.closes(),0);
  assert.deepEqual(second.events,{geometry:0,material:0,shader:0,texture:0,otherTexture:0});disposeDecodedGeometricAsset(second.gltf);
});
