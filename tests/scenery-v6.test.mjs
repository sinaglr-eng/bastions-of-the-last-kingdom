import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {LANDMARK_SITES} from '../game/render/scenery-landmarks.js';
import {townStreamFootprintClearance,TOWN_STREAM_CURVE,RIVER_CONTROL_POINTS} from '../game/render/valley-relief.js';

const layout=JSON.parse(readFileSync(new URL('../data/scenery-v6.json',import.meta.url),'utf8'));
const river=new THREE.CatmullRomCurve3(RIVER_CONTROL_POINTS.map(([x,z])=>new THREE.Vector3(x,0,z))).getPoints(480);
async function model(name){
  const site=LANDMARK_SITES[name];
  const bytes=readFileSync(new URL('../public/assets/scenery/'+(name==='keep'?'royal-castle-v6.glb':'fortified-warcamp-v6.glb'),import.meta.url));
  const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  scene.position.set(site.x,site.y,site.z);scene.updateMatrixWorld(true);return scene;
}
function nodes(scene,role){const found=[];scene.traverse(o=>{if(o.userData.sceneryRole===role)found.push(o);});return found;}
function dispose(scene){const all=new Set();scene.traverse(o=>{if(o.geometry)all.add(o.geometry);for(const m of(o.material?Array.isArray(o.material)?o.material:[o.material]:[]))all.add(m);});all.forEach(o=>o.dispose());}
function rect(node){const d=node.userData;return [d.worldMinX,d.worldMaxX,d.worldMinZ,d.worldMaxZ];}
function overlap(a,b){return a[0]<b[1]&&a[1]>b[0]&&a[2]<b[3]&&a[3]>b[2];}
function mainClearance([lo,hi,bottom,top]){return Math.min(...river.map(p=>Math.hypot(Math.max(lo-p.x,0,p.x-hi),Math.max(bottom-p.z,0,p.z-top))))-2.05;}
function segmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=THREE.MathUtils.clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy),0,1);return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
function inside(p,polygon){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function clan(node){const p=node.getWorldPosition(new THREE.Vector3());return [p.x+25,-14-p.z];}
function town(node){const p=node.getWorldPosition(new THREE.Vector3());return [p.x-38,14-p.z];}
function deviation(values){const mean=values.reduce((s,x)=>s+x,0)/values.length;return Math.sqrt(values.reduce((s,x)=>s+(x-mean)**2,0)/values.length);}

test('V6 western walls reach the northern landscape edge and southern river bank while keeping the bridge gate usable',async()=>{
  const scene=await model('keep'),walls=nodes(scene,'royalWallSegment'),gate=nodes(scene,'royalGate');
  assert.equal(walls.length,7);assert.equal(gate.length,1);assert.equal(gate[0].userData.width,2.8);
  const edges=walls.map(w=>[[w.userData.aX,w.userData.aY],[w.userData.bX,w.userData.bY]]);
  for(const end of [[-10,48],layout.royalWesternWall.riverBankEnd,[-6.9,6.1],[-6.9,-6.1]])assert.ok(edges.some(edge=>edge.some(p=>Math.hypot(p[0]-end[0],p[1]-end[1])<1e-6)));
  const longest=Math.max(...edges.map(([a,b])=>Math.hypot(b[0]-a[0],b[1]-a[1])));assert.ok(longest>46,'The northern frontier closes the previously open shoulder');
  for(const wall of walls){
    const b=rect(wall);assert.ok(b.every(Number.isFinite));assert.ok(mainClearance(b)>=.119,wall.name+' actual full geometry stays beside the main river');
    assert.ok(townStreamFootprintClearance(...b)>=.119,wall.name+' does not block the independent stream');
    assert.ok(Math.abs(mainClearance(b)-wall.userData.mainRiverClearance)<1e-5);
    for(const y of [-.9,0,.9])assert.ok(!overlap(b,[27.8,28.2,14+y-.03,14+y+.03]),'The bridge gate remains an open ground passage');
  }
  const towers=nodes(scene,'frontierTower');assert.equal(towers.length,2);
  const bank=towers.find(t=>t.name.includes('Southern'));
  assert.ok(mainClearance(rect(bank))>=.099&&mainClearance(rect(bank))<.6,'The southern tower ends on the bank without a footing in water');
  assert.ok(towers.some(t=>t.getWorldPosition(new THREE.Vector3()).z===-34));
  assert.equal(nodes(scene,'wallArcher').length,13);assert.equal(nodes(scene,'wallSoldier').length,4);
  for(const guard of [...nodes(scene,'wallArcher'),...nodes(scene,'wallSoldier')])assert.ok(guard.getWorldPosition(new THREE.Vector3()).y>=1.6);
  dispose(scene);
});

test('V6 sheep and cattle have doubled irregular dry grazing areas and naturally spaced headings',async()=>{
  const scene=await model('keep'),pens=nodes(scene,'animalPen'),houses=[...nodes(scene,'townBuilding'),...nodes(scene,'buildingFootprint')],fields=nodes(scene,'farmPlot');
  assert.equal(pens.length,2);
  for(const [role,oldArea,count]of [['sheep',6.3*4.5,9],['cow',7.9*6.5,6]]){
    const pen=pens.find(o=>o.userData.animal===role),animals=nodes(scene,role),polygon=JSON.parse(pen.userData.polygon),b=rect(pen);
    assert.ok(pen.userData.area>=oldArea*2,role+' receives at least twice the old grazing space');assert.ok(polygon.length>=6);
    assert.ok(mainClearance(b)>=.25&&townStreamFootprintClearance(...b)>=.25,'The entire pasture is dry');
    assert.equal(animals.length,count);assert.ok(deviation(animals.map(o=>o.userData.heading))>1,'Animals face different grazing directions');
    const positions=animals.map(town);
    for(let i=0;i<positions.length;i++){
      assert.ok(inside(positions[i],polygon));
      assert.ok(Math.min(...polygon.map((a,j)=>segmentDistance(positions[i],a,polygon[(j+1)%polygon.length])))>=1.049,'Every full animal body fits inside its actual fence');
      for(let j=i+1;j<positions.length;j++)assert.ok(Math.hypot(positions[i][0]-positions[j][0],positions[i][1]-positions[j][1])>=animals[i].userData.minimumSpacing-1e-5);
    }
    assert.ok(new Set(positions.map(p=>p[0].toFixed(2))).size>=Math.ceil(count*.8),'Grazing animals do not form repeated columns');
    assert.ok(new Set(positions.map(p=>p[1].toFixed(2))).size>=Math.ceil(count*.8),'Grazing animals do not form repeated rows');
    for(const obstacle of [...houses,...fields])assert.ok(!overlap(b,rect(obstacle)),pen.name+' does not surround a house or field');
  }
  const largestHouse=Math.max(...nodes(scene,'townBuilding').map(o=>{const b=rect(o);return(b[1]-b[0])*(b[3]-b[2]);}));
  assert.equal(fields.length,7);
  for(const field of fields){assert.ok(field.userData.area>=3*largestHouse);assert.ok(townStreamFootprintClearance(...rect(field))>=.25);for(const house of houses)assert.ok(!overlap(rect(field),rect(house)));}
  for(const house of houses)assert.ok(townStreamFootprintClearance(...rect(house))>=.25,'The relocated shepherd barn also clears its whole roof');
  dispose(scene);
});

test('V6 mixed camp woodland covers an irregular deep band instead of repeated rows',async()=>{
  const scene=await model('camp'),forest=nodes(scene,'palisadeForest'),polygon=layout.clanPalisade.polygon,positions=forest.map(clan);
  assert.ok(forest.length>=175);assert.equal(new Set(forest.map(o=>o.userData.species)).size,4);
  assert.ok(new Set(forest.map(o=>o.userData.height.toFixed(1))).size>12);assert.ok(deviation(forest.map(o=>o.userData.heading))>1.4);
  const distances=[];
  for(let i=0;i<positions.length;i++){
    const p=positions[i];assert.ok(!inside(p,polygon));assert.equal(forest[i].userData.naturalScatter,true);
    const d=Math.min(...polygon.map((a,j)=>segmentDistance(p,a,polygon[(j+1)%polygon.length])));distances.push(d);
    assert.ok(d>1.199&&d<9.001);
    assert.ok(!(p[0]>layout.clanPalisade.gateX-1&&Math.abs(p[1])<4.2),'The broad gate approach stays open');
    for(let j=i+1;j<positions.length;j++)assert.ok(Math.hypot(p[0]-positions[j][0],p[1]-positions[j][1])>=1.449,'Woodland trunks have natural space between them');
  }
  assert.ok(deviation(distances)>1.8,'Tree distance from the fence varies across the entire woodland depth');
  assert.equal(nodes(scene,'outerPalisadeSegment').length,polygon.length);assert.ok(nodes(scene,'outerPalisadeStake').length>500);assert.equal(nodes(scene,'clanGate').length,1);
  dispose(scene);
});

test('V6 actual exported triangles remain clear of the full construction field',async()=>{
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(const name of ['keep','camp']){
    const scene=await model(name);let triangles=0,meshes=0;
    scene.traverse(o=>{if(!o.isMesh)return;meshes++;const p=o.geometry.attributes.position,index=o.geometry.index,count=index?.count??p.count;triangles+=count/3;
      for(let i=0;i<count;i+=3){a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(o.matrixWorld);b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(o.matrixWorld);c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(o.matrixWorld);assert.ok(Math.max(a.x,b.x,c.x)<=-18.5||Math.min(a.x,b.x,c.x)>=18.5||Math.max(a.z,b.z,c.z)<=-18.5||Math.min(a.z,b.z,c.z)>=18.5,name+' no rendered triangle intrudes over a construction tile');}
    });
    assert.ok(triangles>80000&&triangles<(name==='keep'?110000:140000));assert.ok(meshes<=(name==='keep'?38:30));dispose(scene);
  }
});

test('V6 retains editable native sources and actual render proofs alongside the historical V5 edition',()=>{
  const all=JSON.parse(readFileSync(new URL('../public/assets/scenery/manifest.json',import.meta.url),'utf8'));
  for(const edition of ['scenery-v5','scenery-v6']){
    const entries=all.filter(o=>o.style===edition);assert.equal(entries.length,2);
    for(const entry of entries){assert.equal(entry.authoring,'Blender 5.2');assert.ok(statSync(new URL('../blender/scenes/'+entry.source,import.meta.url)).size>10000);assert.ok(statSync(new URL('../blender/renders/'+entry.review,import.meta.url)).size>10000);}
  }
  const authored=JSON.parse(readFileSync(new URL('../public/assets/scenery/layout-v6.json',import.meta.url),'utf8'));
  const samples=TOWN_STREAM_CURVE.getPoints(480);assert.equal(authored.townStream.samples.length,samples.length);
  for(let i=0;i<samples.length;i++)assert.ok(new THREE.Vector3(...authored.townStream.samples[i]).distanceTo(samples[i])<1e-8);
});
