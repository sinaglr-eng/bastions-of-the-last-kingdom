import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {LANDMARK_SITES} from '../game/render/scenery-landmarks.js';
import {RIVER_CONTROL_POINTS,TOWN_RIVER_CONTROL_POINTS,TOWN_STREAM_CURVE,TOWN_STREAM_WATER_WIDTH,TOWN_STREAM_SAMPLES,townStreamFootprintClearance,valleyRiverDistance} from '../game/render/valley-relief.js';

const layout=JSON.parse(readFileSync(new URL('../data/scenery-v5.json',import.meta.url),'utf8'));
async function model(name){
  const site=LANDMARK_SITES[name],bytes=readFileSync(new URL('../public/assets/scenery/'+site.file,import.meta.url));
  const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  scene.position.set(site.x,site.y,site.z);scene.updateMatrixWorld(true);return scene;
}
function nodes(scene,role){const found=[];scene.traverse(o=>{if(o.userData.sceneryRole===role)found.push(o);});return found;}
function dispose(scene){const all=new Set();scene.traverse(o=>{if(o.geometry)all.add(o.geometry);for(const m of(o.material?Array.isArray(o.material)?o.material:[o.material]:[]))all.add(m);});all.forEach(o=>o.dispose());}
function rect(node){const d=node.userData;return [d.worldMinX,d.worldMaxX,d.worldMinZ,d.worldMaxZ];}
function overlap(a,b){return a[0]<b[1]&&a[1]>b[0]&&a[2]<b[3]&&a[3]>b[2];}
function segmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=THREE.MathUtils.clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy),0,1);return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
function inside(p,polygon){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function localClan(node){const p=node.getWorldPosition(new THREE.Vector3());return [p.x+25,-14-p.z];}

test('V5 mountain stream is narrow, independent upstream and reaches the main river only downstream',()=>{
  assert.equal(TOWN_STREAM_WATER_WIDTH,1.45);assert.equal(TOWN_STREAM_SAMPLES.length,481);
  const first=TOWN_STREAM_CURVE.getPoint(0),last=TOWN_STREAM_CURVE.getPoint(1);
  assert.deepEqual(first.toArray(),[62,5.6,-30]);assert.deepEqual(last.toArray(),[20,0,24]);
  assert.ok(valleyRiverDistance(first.x,first.z)>30,'The alpine source is separate from the main river');
  assert.ok(RIVER_CONTROL_POINTS.some(([x,z])=>x===last.x&&z===last.z));
  for(const [x,z]of TOWN_RIVER_CONTROL_POINTS.slice(0,-1))assert.ok(valleyRiverDistance(x,z)>4,'Only the final confluence joins the main river');
  for(let i=1;i<=100;i++)assert.ok(TOWN_STREAM_CURVE.getPoint(i/100).y<=TOWN_STREAM_CURVE.getPoint((i-1)/100).y+.001,'Source flow runs downhill');
  const authored=JSON.parse(readFileSync(new URL('../public/assets/scenery/layout-v5.json',import.meta.url),'utf8'));
  assert.deepEqual(authored.townStream.samples,TOWN_STREAM_CURVE.getPoints(480).map(p=>p.toArray()),'Blender and runtime use the same curve, widths and elevations');
});

test('every V5 town roof, footing and mill house clears the real curved water ribbon',async()=>{
  const scene=await model('keep'),houses=[...nodes(scene,'townBuilding'),...nodes(scene,'buildingFootprint')];
  assert.equal(houses.length,21);
  for(const house of houses){
    const bounds=rect(house);assert.ok(bounds.every(Number.isFinite),house.name+' includes actual mesh bounds');
    assert.ok(bounds[1]-bounds[0]>2&&bounds[3]-bounds[2]>2,'The footprint includes the whole roof and foundations');
    const clearance=townStreamFootprintClearance(...bounds);
    assert.ok(clearance>=.25,house.name+' has a dry full footprint, not just a dry center');
    assert.ok(Math.abs(clearance-house.userData.waterClearance)<1e-5,'Authored full mesh envelope matches runtime water clearance');
  }
  const spring=nodes(scene,'springSource');assert.equal(spring.length,1);assert.ok(spring[0].getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(62,5.6,-30))<1e-6);
  for(const street of nodes(scene,'street'))for(const house of houses)assert.ok(!overlap(rect(street),rect(house)),street.name+' stays clear of '+house.name);
  dispose(scene);
});

test('V5 fields are several times larger than cottages and occupy dry open ground',async()=>{
  const scene=await model('keep'),farms=nodes(scene,'farmPlot'),houses=nodes(scene,'townBuilding');
  const largestHouse=Math.max(...houses.map(h=>{const b=rect(h);return (b[1]-b[0])*(b[3]-b[2]);}));
  assert.equal(farms.length,7);assert.equal(farms.reduce((sum,f)=>sum+f.userData.area,0),462);
  for(const field of farms){
    assert.ok(field.userData.area>=3*largestHouse,field.name+' is a large farm field');
    assert.ok(townStreamFootprintClearance(...rect(field))>=.25);
    for(const house of houses)assert.ok(!overlap(rect(field),rect(house)),field.name+' does not plant crops under '+house.name);
  }
  assert.ok(nodes(scene,'settlementTree').length>=20);assert.ok(nodes(scene,'settlementRock').length>=8);
  dispose(scene);
});

test('new western royal fortifications connect to both palace terrace walls and carry guards',async()=>{
  const scene=await model('keep'),walls=nodes(scene,'royalWallSegment'),archers=nodes(scene,'wallArcher'),soldiers=nodes(scene,'wallSoldier');
  assert.equal(walls.length,6);assert.equal(archers.length,10);assert.equal(soldiers.length,4);
  const edges=walls.map(w=>[[w.userData.aX,w.userData.aY],[w.userData.bX,w.userData.bY]]);
  for(const end of [[-6.9,6.1],[-6.9,-6.1],[-10,8.5],[-10,-8.5]])assert.ok(edges.some(edge=>edge.some(p=>Math.hypot(p[0]-end[0],p[1]-end[1])<1e-6)));
  const gate=nodes(scene,'royalGate');assert.equal(gate.length,1);assert.equal(gate[0].userData.width,2.8);
  for(const guard of [...archers,...soldiers])assert.ok(guard.getWorldPosition(new THREE.Vector3()).y>=1.6,'All guards stand on their actual walls and towers');
  for(const wall of walls)assert.equal(wall.userData.walkwayHeight,2.05);
  dispose(scene);
});

test('V5 palisade forms one complete enclosure with only its usable entrance gap',async()=>{
  const scene=await model('camp'),polygon=layout.clanPalisade.polygon,segments=nodes(scene,'outerPalisadeSegment'),stakes=nodes(scene,'outerPalisadeStake');
  assert.equal(segments.length,polygon.length);assert.ok(stakes.length>500);assert.equal(nodes(scene,'clanGate').length,1);
  const positions=stakes.map(localClan);
  const crownBuckets=new Map(),vertex=new THREE.Vector3();
  scene.traverse(object=>{if(!object.isMesh)return;const vertices=object.geometry.attributes.position;for(let i=0;i<vertices.count;i++){
    vertex.fromBufferAttribute(vertices,i).applyMatrix4(object.matrixWorld);if(vertex.y<1.8||vertex.y>2.18)continue;
    const x=vertex.x+25,y=-14-vertex.z,key=Math.floor(x/.3)+','+Math.floor(y/.3);
    if(!crownBuckets.has(key))crownBuckets.set(key,[]);crownBuckets.get(key).push([x,y]);
  }});
  for(const [x,y]of positions){let count=0;const ix=Math.floor(x/.3),iy=Math.floor(y/.3);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const p of crownBuckets.get((ix+dx)+','+(iy+dy))??[])if(Math.hypot(p[0]-x,p[1]-y)<.16)count++;assert.ok(count>=8,'Every enclosure marker has a real rendered timber crown');}
  for(let index=0;index<polygon.length;index++){
    const a=polygon[index],b=polygon[(index+1)%polygon.length],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.15);
    for(let i=0;i<=steps;i++){
      const p=[a[0]+(b[0]-a[0])*i/steps,a[1]+(b[1]-a[1])*i/steps];
      if(Math.abs(p[0]-layout.clanPalisade.gateX)<.001&&Math.abs(p[1])<layout.clanPalisade.gateHalfWidth+.15)continue;
      assert.ok(positions.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<.30),'The outer wooden wall has no accidental missing section');
    }
  }
  for(const role of ['tent','wolfPen','wolfCage','cave','mountainCamp','mountainTent','troll','ogre'])for(const object of nodes(scene,role))assert.ok(inside(localClan(object),polygon),role+' belongs inside the complete outer wall');
  const forest=nodes(scene,'palisadeForest').filter(o=>o.name.startsWith('Stockade_rear_forest'));
  assert.ok(forest.length>125,'A dense immediate forest backs the enlarged camp');
  for(const tree of forest){const p=localClan(tree),d=Math.min(...polygon.map((a,i)=>segmentDistance(p,a,polygon[(i+1)%polygon.length])));assert.ok(d>=1.1&&d<4.3,'The forest sits immediately beside the palisade');}
  dispose(scene);
});

test('every exported V5 settlement vertex and triangle stays outside the full construction field',async()=>{
  const p=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(const name of ['keep','camp']){
    const scene=await model(name);let vertices=0;
    scene.traverse(o=>{if(!o.isMesh)return;const position=o.geometry.attributes.position;for(let i=0;i<position.count;i++){p.fromBufferAttribute(position,i).applyMatrix4(o.matrixWorld);vertices++;assert.ok(Math.abs(p.x)>=18.5||Math.abs(p.z)>=18.5,name+' scenery must not cover any construction tile');}
      const index=o.geometry.index,count=index?.count??position.count;
      for(let i=0;i<count;i+=3){a.fromBufferAttribute(position,index?index.getX(i):i).applyMatrix4(o.matrixWorld);b.fromBufferAttribute(position,index?index.getX(i+1):i+1).applyMatrix4(o.matrixWorld);c.fromBufferAttribute(position,index?index.getX(i+2):i+2).applyMatrix4(o.matrixWorld);assert.ok(Math.max(a.x,b.x,c.x)<=-18.5||Math.min(a.x,b.x,c.x)>=18.5||Math.max(a.z,b.z,c.z)<=-18.5||Math.min(a.z,b.z,c.z)>=18.5,name+' no triangle crosses a board corner');}
    });
    assert.ok(vertices>50000);dispose(scene);
  }
});

test('V5 manifest keeps native editable Blender sources and actual source renders',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../public/assets/scenery/manifest.json',import.meta.url),'utf8'));
  assert.equal(manifest.length,2);
  for(const entry of manifest){assert.equal(entry.style,'scenery-v5');assert.equal(entry.authoring,'Blender 5.2');assert.ok(statSync(new URL('../blender/scenes/'+entry.source,import.meta.url)).size>10000);assert.ok(statSync(new URL('../artifacts/'+entry.review,import.meta.url)).size>10000);assert.ok(entry.triangles>80000&&entry.triangles<140000);}
});
