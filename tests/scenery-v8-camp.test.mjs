import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {LANDMARK_SITES} from '../game/render/scenery-landmarks.js';
const json=file=>JSON.parse(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
const config=json('data/scenery-v8-camp.json'),lanes=config.lanes.flatMap(lane=>lane.slice(1).map((b,i)=>[lane[i],b]));
const role=(scene,name)=>{const nodes=[];scene.traverse(o=>{if(o.userData.sceneryRole===name)nodes.push(o);});return nodes;};
const pointSegment=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);};
function clearance([lo,hi,bottom,top]){
 return Math.min(...lanes.map(([a,b])=>{
  let enter=0,leave=1;
  for(const [start,end,mn,mx] of [[a[0],b[0],lo,hi],[a[1],b[1],bottom,top]]){
   if(Math.abs(end-start)<1e-12){if(start<mn||start>mx)return Math.min(...[[lo,bottom],[lo,top],[hi,bottom],[hi,top]].map(p=>pointSegment(p,a,b)),...[a,b].map(p=>Math.hypot(Math.max(lo-p[0],0,p[0]-hi),Math.max(bottom-p[1],0,p[1]-top))));}
   else{const values=[(mn-start)/(end-start),(mx-start)/(end-start)].sort((a,b)=>a-b);enter=Math.max(enter,values[0]);leave=Math.min(leave,values[1]);}
  }
  if(enter<=leave)return 0;
  return Math.min(...[[lo,bottom],[lo,top],[hi,bottom],[hi,top]].map(p=>pointSegment(p,a,b)),...[a,b].map(p=>Math.hypot(Math.max(lo-p[0],0,p[0]-hi),Math.max(bottom-p[1],0,p[1]-top))));
 }))-config.laneWidth/2;
}
async function model(version){const bytes=readFileSync(new URL('../public/assets/scenery/fortified-warcamp-v'+version+'.glb',import.meta.url));const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');scene.updateMatrixWorld(true);return scene;}
function dispose(scene){const resources=new Set();scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});resources.forEach(o=>o.dispose());}
test('V8 fits every complete tent shoulder and adds actual trees, covered firewood, weapon stores and supply cart off all inherited walk lanes',async()=>{
 const scene=await model(8);
 for(const [kind,count] of [['campTent',22],['campTree',8],['campFirewood',3],['campArmory',2],['campSupplyCart',1],['campWalkLane',10]])assert.equal(role(scene,kind).length,count);
 for(const kind of ['campTent','campTree','campFirewood','campArmory','campSupplyCart'])for(const node of role(scene,kind)){
  const d=node.userData,b=[d.localMinX,d.localMaxX,d.localMinY,d.localMaxY];assert.ok(b.every(Number.isFinite));assert.ok(clearance(b)>=.219999,'full '+kind+' bounds including tent guy ropes clear all existing walkways');assert.equal(d.cosmeticOnly,true);assert.equal(d.gameplayEffect,'none');
 }
 assert.ok(role(scene,'campTent').filter(o=>o.userData.movedX||o.userData.movedY).length>0,'tents previously on roads were actually moved');
 let triangles=0,vertices=0;const p=new THREE.Vector3();
 scene.traverse(o=>{if(!o.isMesh||!o.material.name.startsWith('V8'))return;const position=o.geometry.attributes.position,index=o.geometry.index,count=index?.count??position.count;triangles+=count/3;
  for(let i=0;i<count;i+=3){const xs=[],ys=[];for(let k=0;k<3;k++){p.fromBufferAttribute(position,index?index.getX(i+k):i+k).applyMatrix4(o.matrixWorld);vertices++;xs.push(p.x);ys.push(-p.z);assert.ok(p.x-25<=-18.5||Math.abs(-14+p.z)>=18.5,'every new vertex clears the playable field');}
   assert.ok(clearance([Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)])>=.21999,'actual added triangle clears the preserved walking lane');
  }
 });
 assert.ok(triangles>5000&&triangles<8000);assert.ok(vertices>15000);dispose(scene);
});
test('V8 keeps wolves, cave residents, palisade, forest and all real trodden-earth lane geometry in place',async()=>{
 const [previous,current]=await Promise.all([model(6),model(8)]);
 for(const kind of ['wolf','wolfPen','wolfCage','cave','caveGuard','troll','ogre','mountainTent','mountainCamp','mountainFire','outerPalisadeSegment','outerPalisadeStake','clanGate','palisadeForest']){
  const records=scene=>role(scene,kind).map(o=>({name:o.name,position:o.getWorldPosition(new THREE.Vector3()).toArray(),data:o.userData}));assert.deepEqual(records(current),records(previous),kind+' inherits identical original native placement');
 }
 const earth=scene=>{const positions=[],p=new THREE.Vector3();scene.traverse(o=>{if(!o.isMesh||!o.material.name.toLowerCase().includes('packed camp earth'))return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);positions.push(p.toArray().map(v=>v.toFixed(5)).join(','));}});return positions.sort();};
 const oldEarth=earth(previous);assert.ok(oldEarth.length>100,'the check covers actual inherited soil/track triangles');assert.deepEqual(earth(current),oldEarth);
 dispose(previous);dispose(current);
});
test('V8 keeps a reproducible editable native scene, actual render proof and a strict small additive camp budget',async()=>{
 const [previous,current]=await Promise.all([model(6),model(8)]),counts=scene=>{let triangles=0,meshes=0;scene.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;meshes++;}});return {triangles,meshes};};
 const before=counts(previous),after=counts(current);assert.ok(before.triangles<140000&&before.meshes<=30,'the historical V6 limit stays strict');assert.ok(after.triangles<150000&&after.meshes<=36);assert.ok(after.triangles-before.triangles>0&&after.triangles-before.triangles<8000);
 const entry=json('public/assets/scenery/manifest.json').find(o=>o.file===LANDMARK_SITES.camp.file);assert.equal(entry.style,'scenery-v8');assert.equal(entry.inherits,config.inherits);assert.equal(entry.triangles,after.triangles);assert.equal(entry.gameplayEffect,'none');
 for(const file of ['blender/scenes/'+entry.source,'blender/renders/'+entry.review])assert.ok(statSync(new URL('../'+file,import.meta.url)).size>10000);
 dispose(previous);dispose(current);
});
