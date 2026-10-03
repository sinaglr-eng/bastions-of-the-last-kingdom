import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {LANDMARK_SITES} from '../game/render/scenery-landmarks.js';
import {townStreamFootprintClearance,RIVER_CONTROL_POINTS} from '../game/render/valley-relief.js';

const json=file=>JSON.parse(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
const layout=json('data/scenery-v7.json');
const river=new THREE.CatmullRomCurve3(RIVER_CONTROL_POINTS.map(([x,z])=>new THREE.Vector3(x,0,z))).getPoints(480);
const waterClearance=([lo,hi,bottom,top])=>Math.min(...river.map(p=>Math.hypot(Math.max(lo-p.x,0,p.x-hi),Math.max(bottom-p.z,0,p.z-top))))-2.05;
const bounds=o=>[o.userData.worldMinX,o.userData.worldMaxX,o.userData.worldMinZ,o.userData.worldMaxZ];
const role=(scene,name)=>{const found=[];scene.traverse(o=>{if(o.userData.sceneryRole===name)found.push(o);});return found;};
function dispose(scene){const resources=new Set();scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of(o.material?Array.isArray(o.material)?o.material:[o.material]:[]))resources.add(m);});resources.forEach(o=>o.dispose());}
async function model(version){
  const bytes=readFileSync(new URL('../public/assets/scenery/royal-castle-v'+version+'.glb',import.meta.url));
  const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  scene.position.set(38,0,14);scene.updateMatrixWorld(true);return scene;
}

test('V7 adds dry angled sharpened stakes and irregular thornbrush before the western curtain wall with an open bridge approach',async()=>{
  const scene=await model(7),stakes=role(scene,'defensiveStake'),brush=role(scene,'defensiveThornbrush');
  assert.ok(stakes.length>=95&&stakes.length<170);assert.equal(brush.length,layout.royalOuterDefenses.thornCount);
  assert.ok(new Set(stakes.map(o=>o.userData.height.toFixed(2))).size>25,'The defensive strip varies log height');
  assert.ok(new Set(stakes.map(o=>o.getWorldPosition(new THREE.Vector3()).x.toFixed(2))).size>25,'The bands are staggered and uneven');
  for(const marker of [...stakes,...brush]){
    const b=bounds(marker);assert.ok(b.every(Number.isFinite));
    assert.ok(waterClearance(b)>=.279&&townStreamFootprintClearance(...b)>=.279,marker.name+' full geometry stays on dry bank');
    assert.ok(b[1]<=38+layout.royalOuterDefenses.wallX-layout.royalOuterDefenses.minimumWallGap+1e-5,'There is a gap before the stone wall');
    assert.ok(b[3]<=14-layout.royalOuterDefenses.gateRoadHalfWidth||b[2]>=14+layout.royalOuterDefenses.gateRoadHalfWidth,'The complete approach road remains clear');
    assert.equal(marker.userData.cosmeticOnly,true);assert.equal(marker.userData.gameplayEffect,'none');
    if(marker.userData.sceneryRole==='defensiveStake')assert.ok(marker.userData.tipX<marker.position.x&&marker.userData.lean>=.30,'Sharp tips lean outward from the castle');
  }
  const p=new THREE.Vector3();let actualVertices=0;
  scene.traverse(o=>{if(!o.isMesh||!o.material.name.startsWith('V7'))return;const position=o.geometry.attributes.position;
    for(let i=0;i<position.count;i++){
      p.fromBufferAttribute(position,i).applyMatrix4(o.matrixWorld);actualVertices++;
      assert.ok(p.x<27.481&&p.x>=18.5,'Actual added geometry is west of the wall and outside the board');
      assert.ok(Math.abs(p.z-14)>=3.5,'Every exported tip and thorn clears the bridge road');
      assert.ok(waterClearance([p.x,p.x,p.z,p.z])>=.279,'Actual rendered geometry stays off the river');
    }
    const index=o.geometry.index,count=index?.count??position.count;
    for(let i=0;i<count;i+=3){
      const vertices=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(position,index?index.getX(i+k):i+k).applyMatrix4(o.matrixWorld));
      const b=[Math.min(...vertices.map(v=>v.x)),Math.max(...vertices.map(v=>v.x)),Math.min(...vertices.map(v=>v.z)),Math.max(...vertices.map(v=>v.z))];
      assert.ok(waterClearance(b)>=.279,'Every actual triangle, including sharp tips and thorns, clears the water');
    }
  });
  assert.ok(actualVertices>3000,'Stakes and thorns have actual exported geometry, beyond role markers');
  assert.equal(role(scene,'royalGate')[0].userData.width,2.8);dispose(scene);
});

function originalGeometry(scene){
  const signature={};const p=new THREE.Vector3();
  scene.traverse(o=>{if(!o.isMesh||o.material.name.startsWith('V7'))return;
    const position=o.geometry.attributes.position,index=o.geometry.index,vertices=[];
    for(let i=0;i<position.count;i++){p.fromBufferAttribute(position,i).applyMatrix4(o.matrixWorld);vertices.push([p.x,p.y,p.z].map(v=>v.toFixed(5)).join(','));}
    // Material batches retain their original vertex order, transforms and faces.
    signature[o.material.name+'|'+(o.parent.userData.sceneryRole??'root')]=[vertices,index?Array.from(index.array):null];
  });return signature;
}

test('V7 inherits all original royal geometry and V6 landscape coordinates without moving fields, pastures, houses, walls or river',async()=>{
  const previous=json('data/scenery-v6.json'),current=structuredClone(layout);delete current.royalOuterDefenses;current.edition='V6';assert.deepEqual(current,previous);
  const [oldScene,newScene]=await Promise.all([model(6),model(7)]);
  assert.deepEqual(originalGeometry(newScene),originalGeometry(oldScene),'All pre-existing rendered vertices and faces remain unchanged');
  for(const kind of ['royalWallSegment','townBuilding','farmPlot','animalPen','sheep','cow','settlementTree','wallArcher','wallSoldier']){
    const records=scene=>role(scene,kind).map(o=>({name:o.name,position:o.getWorldPosition(new THREE.Vector3()).toArray(),data:o.userData}));
    assert.deepEqual(records(newScene),records(oldScene),kind+' stays unchanged');
  }
  assert.equal(LANDMARK_SITES.keep.file,'royal-castle-v7.glb');assert.equal(LANDMARK_SITES.camp.file,'fortified-warcamp-v8.glb');
  dispose(oldScene);dispose(newScene);
});

test('V7 keeps the native editable source and real review proof with a bounded additive geometry budget',async()=>{
  const scene=await model(7);let triangles=0,meshes=0;
  scene.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;meshes++;}});
  assert.ok(triangles>102588&&triangles<110000);assert.ok(meshes<=41);
  const entries=json('public/assets/scenery/manifest.json'),entry=entries.find(o=>o.file==='royal-castle-v7.glb');
  assert.equal(entry.style,'scenery-v7');assert.equal(entry.inherits,'royal-castle-v6.blend');assert.equal(entry.triangles,triangles);assert.equal(entry.gameplayEffect,'none');
  assert.ok(entries.some(o=>o.file==='royal-castle-v6.glb'));assert.ok(entries.some(o=>o.file==='fortified-warcamp-v6.glb'));
  for(const file of ['blender/scenes/'+entry.source,'blender/renders/'+entry.review,'blender/renders/royal-outer-defenses-v7.png','blender/renders/royal-bridge-clearance-v7.png'])assert.ok(statSync(new URL('../'+file,import.meta.url)).size>10000);
  dispose(scene);
});
