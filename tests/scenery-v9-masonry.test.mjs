import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RIVER_CONTROL_POINTS,townStreamFootprintClearance} from '../game/render/valley-relief.js';

const json=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url)));
const proof=json('output/design/battlefield-refinements-v10/castle-masonry-source-proof.json');
const manifest=json('public/assets/scenery/manifest.json');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function load(version){const bytes=readFileSync(new URL(`../public/assets/scenery/royal-castle-v${version}.glb`,import.meta.url));const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');scene.position.set(38,0,14);scene.updateWorldMatrix(true,true);return scene;}
const sources=Promise.all([load(7),load(9)]);
function dispose(scene){const resources=new Set();scene.traverse(node=>{if(node.geometry)resources.add(node.geometry);for(const material of(node.material?Array.isArray(node.material)?node.material:[node.material]:[]))resources.add(material);});resources.forEach(resource=>resource.dispose());}
after(async()=>{for(const scene of await sources)dispose(scene);});
const roles=(scene,role)=>{const nodes=[];scene.traverse(node=>{if(node.userData.sceneryRole===role)nodes.push(node);});return nodes;};
function triangles(mesh){
  const p=mesh.geometry.attributes.position,index=mesh.geometry.index,list=[];
  for(let i=0;i<(index?.count??p.count);i+=3){const indices=[0,1,2].map(j=>index?index.getX(i+j):i+j);list.push({indices,triangle:new THREE.Triangle(...indices.map(j=>new THREE.Vector3().fromBufferAttribute(p,j).applyMatrix4(mesh.matrixWorld)))});}
  return list;
}
function boxes(scene,predicate){
  const components=[];scene.updateWorldMatrix(true,true);
  scene.traverse(mesh=>{
    if(!mesh.isMesh||!predicate(mesh.material.name))return;
    const p=mesh.geometry.attributes.position,vertices=[],lookup=new Map(),parents=[];
    for(let i=0;i<p.count;i++){
      const point=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld),key=point.toArray().map(value=>value.toFixed(6)).join(',');
      if(!lookup.has(key)){lookup.set(key,parents.length);parents.push(parents.length);}vertices[i]=lookup.get(key);
    }
    const find=i=>parents[i]===i?i:parents[i]=find(parents[i]);
    const list=triangles(mesh);for(const {indices}of list){const a=find(vertices[indices[0]]);for(const index of indices.slice(1))parents[find(vertices[index])]=a;}
    const groups=new Map();for(const record of list){const key=find(vertices[record.indices[0]]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(record);}
    for(const records of groups.values()){
      const bounds=new THREE.Box3().setFromPoints(records.flatMap(({triangle})=>[triangle.a,triangle.b,triangle.c]));
      components.push({mesh,records,bounds,centre:bounds.getCenter(new THREE.Vector3()),size:bounds.getSize(new THREE.Vector3())});
    }
  });return components;
}
const ashlar=scene=>boxes(scene,name=>/^V9 .*limestone face$/.test(name));
function mortar(scene){
  // Two original end-to-end walls share their end-face vertices. They form one
  // connected volume; use the retained per-cube primitive vertex ranges to
  // select each actual source wall instead of requiring artificial separation.
  const walls=[];scene.traverse(mesh=>{
    if(!mesh.isMesh||mesh.material.name!=='V9 recessed limestone mortar')return;
    assert.equal(mesh.geometry.attributes.position.count%24,0);
    const groups=new Map();for(const record of triangles(mesh)){const key=Math.floor(record.indices[0]/24);assert.ok(record.indices.every(index=>Math.floor(index/24)===key));if(!groups.has(key))groups.set(key,[]);groups.get(key).push(record);}
    for(const records of groups.values()){assert.equal(records.length,12);const bounds=new THREE.Box3().setFromPoints(records.flatMap(({triangle})=>[triangle.a,triangle.b,triangle.c]));walls.push({mesh,records,bounds,centre:bounds.getCenter(new THREE.Vector3()),size:bounds.getSize(new THREE.Vector3())});}
  });return walls;
}
function scope(scene){
  const walls=mortar(scene),stones=ashlar(scene);
  for(const wall of walls){wall.axis=wall.size.x<wall.size.z?'x':'z';wall.lengthAxis=wall.axis==='x'?'z':'x';wall.stones=[];
    wall.marker=roles(scene,'ashlarCurtainWall').find(marker=>marker.getWorldPosition(new THREE.Vector3()).distanceTo(wall.centre)<.00002);assert.ok(wall.marker,'Physical curtain wall has its exact source scope: '+JSON.stringify({centre:wall.centre.toArray(),triangles:wall.records.length,nearest:roles(scene,'ashlarCurtainWall').map(marker=>[marker.name,marker.getWorldPosition(new THREE.Vector3()).distanceTo(wall.centre)]).sort((a,b)=>a[1]-b[1]).slice(0,2)}));
  }
  for(const stone of stones){
    const candidates=walls.filter(wall=>stone.size[wall.axis]<.029&&stone.centre[wall.lengthAxis]>=wall.bounds.min[wall.lengthAxis]&&stone.centre[wall.lengthAxis]<=wall.bounds.max[wall.lengthAxis]&&stone.centre.y>wall.bounds.min.y&&stone.centre.y<wall.bounds.max.y);
    const wall=candidates.find(wall=>Math.min(Math.abs(stone.centre[wall.axis]-wall.bounds.min[wall.axis]+.010),Math.abs(stone.centre[wall.axis]-wall.bounds.max[wall.axis]-.010))<.00002);
    assert.ok(wall,'Each actual stone face is seated on a physical wall, not collapsed at the origin');
    stone.side=stone.centre[wall.axis]<wall.centre[wall.axis]?-1:1;stone.wall=wall;wall.stones.push(stone);
  }
  return {walls,stones};
}
function surfaceRelief(stone,wall,side){
  const face=side<0?wall.bounds.min[wall.axis]:wall.bounds.max[wall.axis],origin=stone.centre.clone();origin[wall.axis]=face+side*.10;
  const direction=new THREE.Vector3();direction[wall.axis]=-side;const ray=new THREE.Ray(origin,direction),hit=new THREE.Vector3();
  const nearest=records=>{let distance=Infinity;for(const {triangle}of records)if(ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,hit))distance=Math.min(distance,origin.distanceTo(hit));return distance;};
  return nearest(wall.records)-nearest(stone.records);
}

test('V9 has nine real curtain scopes and 2018 connected closed stone boxes within the bounded additive budget and immutable V7 source',async()=>{
  const [oldScene,scene]=await sources,entry=manifest.find(entry=>entry.file==='royal-castle-v9.glb');let count=0,batches=0;scene.traverse(node=>{if(node.isMesh){count+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;batches++;}});
  assert.equal(count,133786);assert.equal(count,entry.triangles);assert.ok(count<140000);assert.equal(batches,45);
  assert.equal(entry.inherits,'royal-castle-v7.blend');assert.equal(entry.gameplayEffect,'none');assert.ok(statSync(new URL('../blender/scenes/'+entry.source,import.meta.url)).size>10000);
  const original=readFileSync(new URL('../blender/scenes/royal-castle-v7.blend',import.meta.url));assert.equal(sha(original),'a9e0c36a7eafd17bc1ffd219d1dcf59046a139931118a7235bca0272891066ff');assert.equal(sha(original),proof.inheritedSourceSha256);assert.equal(proof.allInheritedGeometryAndTransformsPreserved,true);
  const actual=scope(scene);assert.equal(actual.walls.length,9);assert.equal(actual.stones.length,2018);assert.equal(actual.stones.length,proof.addedStoneFaces);
  for(const stone of actual.stones){assert.equal(stone.records.length,12);const edges=new Map();for(const {triangle}of stone.records){const points=[triangle.a,triangle.b,triangle.c].map(p=>p.toArray().map(v=>v.toFixed(6)).join(','));for(let i=0;i<3;i++){const key=[points[i],points[(i+1)%3]].sort().join('|');edges.set(key,(edges.get(key)||0)+1);}assert.ok(triangle.getArea()>.00001);}assert.ok([...edges.values()].every(count=>count===2),'Every actual stone box remains closed');}
  assert.equal(roles(oldScene,'ashlarCurtainWall').length,0,'Preserved V7 source predates this additive detail');
});

test('every actual wall face has full-length staggered courses, mortar gaps and ray-measured 24mm relief',async()=>{
  const [,scene]=await sources,{walls}=scope(scene);
  for(const wall of walls){
    const courses=wall.marker.userData.courses,pitch=wall.size.y/courses;assert.ok(courses>=5);assert.equal(wall.stones.length,wall.marker.userData.stones);
    for(const side of [-1,1]){
      let lastRow=null;
      for(let row=0;row<courses;row++){
        const height=wall.bounds.min.y+(row+.5)*pitch,stones=wall.stones.filter(stone=>stone.side===side&&Math.abs(stone.centre.y-height)<.00002).sort((a,b)=>a.bounds.min[wall.lengthAxis]-b.bounds.min[wall.lengthAxis]);
        assert.ok(stones.length>=4,'A complete course uses physically distributed stones');
        const leftMargin=stones[0].bounds.min[wall.lengthAxis]-wall.bounds.min[wall.lengthAxis],rightMargin=wall.bounds.max[wall.lengthAxis]-stones.at(-1).bounds.max[wall.lengthAxis];
        // One clipped end would be a millimetre-wide sliver; the author leaves
        // a narrow20mm mortar end there instead of a detached tiny fragment.
        assert.ok(leftMargin>=.00998&&leftMargin<=.03002,JSON.stringify({wall:wall.marker.name,row,side,leftMargin,rightMargin}));assert.ok(rightMargin>=.00998&&rightMargin<=.03002,JSON.stringify({wall:wall.marker.name,row,side,leftMargin,rightMargin}));
        for(const [index,stone]of stones.entries()){
          assert.ok(Math.abs(stone.size.y-(pitch-.018))<.00002,'Real vertical mortar gap');
          if(index)assert.ok(Math.abs(stone.bounds.min[wall.lengthAxis]-stones[index-1].bounds.max[wall.lengthAxis]-.020)<.00003,'Every actual horizontal gap remains narrow');
          const relief=surfaceRelief(stone,wall,side);assert.ok(Math.abs(relief-.024)<.00002,'Actual exported stone surface projects24mm beyond mortar');
        }
        if(lastRow)assert.ok(Math.abs(stones[0].bounds.max[wall.lengthAxis]-lastRow[0].bounds.max[wall.lengthAxis])>.25,'Adjacent courses have staggered vertical joints');lastRow=stones;
      }
    }
  }
});

test('unchanged masonry metadata cannot hide a collapsed physical stone face',async()=>{
  const [,scene]=await sources,clone=scene.clone(true),original=scope(scene).stones[100],mesh=clone.getObjectByName(original.mesh.name),owned=mesh.geometry.clone();mesh.geometry=owned;
  try{
    const indices=new Set(original.records.flatMap(record=>record.indices)),inverse=mesh.matrixWorld.clone().invert(),wall=original.wall,face=original.side<0?wall.bounds.min[wall.axis]:wall.bounds.max[wall.axis],position=owned.attributes.position;
    for(const index of indices){const point=new THREE.Vector3().fromBufferAttribute(position,index).applyMatrix4(mesh.matrixWorld);if(original.side*(point[wall.axis]-face)>0){point[wall.axis]=face+original.side*.001;point.applyMatrix4(inverse);position.setXYZ(index,point.x,point.y,point.z);}}
    position.needsUpdate=true;
    const changed=ashlar(clone).find(stone=>stone.mesh.name===original.mesh.name&&stone.records.some(record=>record.indices.includes(original.records[0].indices[0])));
    assert.ok(changed);assert.equal(changed.records.length,12);assert.deepEqual(roles(clone,'ashlarCurtainWall').map(node=>node.userData),roles(scene,'ashlarCurtainWall').map(node=>node.userData));
    assert.ok(surfaceRelief(original,wall,original.side)>.020);assert.ok(surfaceRelief(changed,wall,original.side)<.002,'Actual geometry-only loss of relief is rejected with unchanged roles/counts');
  }finally{owned.dispose();}
});

const centroidKey=point=>point.toArray().map(v=>Math.floor(v/.001)).join(',');
function allTriangles(scene){const list=[];scene.traverse(mesh=>{if(mesh.isMesh)list.push(...triangles(mesh).map(record=>record.triangle));});return list;}
test('all109570 inherited rendered triangles, residents, animals, fields, guards and the waterwheel remain in place',async()=>{
  const [oldScene,scene]=await sources,old=allTriangles(oldScene),current=allTriangles(scene),lookup=new Map();assert.equal(old.length,109570);
  for(const triangle of current){const key=centroidKey(triangle.getMidpoint(new THREE.Vector3()));if(!lookup.has(key))lookup.set(key,[]);lookup.get(key).push(triangle);}
  for(const triangle of old){
    const centre=triangle.getMidpoint(new THREE.Vector3()),coordinates=centre.toArray().map(v=>Math.floor(v/.001)),points=[triangle.a,triangle.b,triangle.c];let found=false;
    for(let x=-1;x<=1&&!found;x++)for(let y=-1;y<=1&&!found;y++)for(let z=-1;z<=1&&!found;z++)for(const candidate of lookup.get([coordinates[0]+x,coordinates[1]+y,coordinates[2]+z].join(','))||[]){const vertices=[candidate.a,candidate.b,candidate.c];if(points.every(point=>vertices.some(vertex=>vertex.distanceTo(point)<.00002))){found=true;break;}}
    assert.ok(found,'An actual inherited world-space triangle cannot be dropped or moved');
  }
  for(const role of ['resident','sheep','cow','animalPen','farmPlot','townBuilding','street','wallArcher','wallSoldier','watermill','waterwheel','canalBridge','defensiveStake','defensiveThornbrush']){
    const records=root=>roles(root,role).map(node=>({name:node.name,data:node.userData,position:node.getWorldPosition(new THREE.Vector3()).toArray()})).sort((a,b)=>a.name.localeCompare(b.name));assert.deepEqual(records(scene),records(oldScene),role+' actual source locations and identity preserved');
  }
  const wheel=scene.getObjectByName('MillWaterwheel'),oldWheel=oldScene.getObjectByName('MillWaterwheel');assert.ok(wheel.children.some(node=>node.isMesh));assert.deepEqual(wheel.position.toArray(),oldWheel.position.toArray());assert.deepEqual(wheel.quaternion.toArray(),oldWheel.quaternion.toArray());
});

test('actual added triangle footprints clear the playable field, the full gate approach and both rivers',async()=>{
  const [,scene]=await sources,river=new THREE.CatmullRomCurve3(RIVER_CONTROL_POINTS.map(([x,z])=>new THREE.Vector3(x,0,z))).getPoints(480);
  const clearance=([lo,hi,bottom,top])=>Math.min(...river.map(point=>Math.hypot(Math.max(lo-point.x,0,point.x-hi),Math.max(bottom-point.z,0,point.z-top))))-2.05;
  for(const stone of ashlar(scene))for(const {triangle}of stone.records){
    const box=new THREE.Box3().setFromPoints([triangle.a,triangle.b,triangle.c]),bounds=[box.min.x,box.max.x,box.min.z,box.max.z];
    for(const point of [triangle.a,triangle.b,triangle.c])assert.ok(Math.abs(point.x)>=18.5||Math.abs(point.z)>=18.5,'Actual new geometry never enters a playable tile');
    assert.ok(!(box.max.x>18.5&&box.min.x<29.2&&box.max.z>13&&box.min.z<15),'The existing bridge-to-gate corridor stays open');
    assert.ok(clearance(bounds)>=.08,'Actual triangle stays on the dry main-river bank');assert.ok(townStreamFootprintClearance(...bounds)>=.08,'Actual triangle clears the mill stream');
  }
});
