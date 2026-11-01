import test from 'node:test';import assert from 'node:assert/strict';import {Group,Mesh,BoxGeometry,MeshStandardMaterial,Texture} from 'three';import {createLandmarkScenery} from '../game/render/scenery-landmarks.js';
function asset(){let textures=0,images=0,geometries=0;const map=new Texture({close(){images++;}}),geometry=new BoxGeometry(),material=new MeshStandardMaterial({map}),scene=new Group();scene.add(new Mesh(geometry,material));map.addEventListener('dispose',()=>textures++);geometry.addEventListener('dispose',()=>geometries++);return{scene,counts:()=>({textures,images,geometries})};}
test('both private native landmarks release PBR textures and bitmaps when a battlefield closes',async()=>{
 const assets=[asset(),asset()],scenery=createLandmarkScenery();let i=0;await scenery.load({loadAsync:async()=>({scene:assets[i++].scene})});scenery.dispose();scenery.dispose();for(const a of assets)assert.deepEqual(a.counts(),{textures:1,images:1,geometries:1});
});
test('native scenery completing after closure releases its own maps without adopting another live battlefield',async()=>{
 const assets=[asset(),asset()],pending=[],scenery=createLandmarkScenery();let i=0;const p=scenery.load({loadAsync:()=>new Promise(resolve=>{const a=assets[i++];pending.push(()=>resolve({scene:a.scene}));})});scenery.dispose();pending.forEach(f=>f());await p;for(const a of assets)assert.deepEqual(a.counts(),{textures:1,images:1,geometries:1});
});
