import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {physicalSurfaceGap} from '../game/render/geometric-contacts.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
import {geometricEntries} from '../game/render/geometric-assets.js';
import {auditReconstructedRoster,auditCurrentReconstructionIds,currentReconstructionEntry} from '../tools/audit-reconstructed-roster.mjs';

const label=n=>(n.userData.semanticPart||n.name||'').replaceAll('_',' ').replace(/(?: fitted facets| mesh)(?: \d+)?$/,'');
const descendants=(n,parent)=>{for(let p=n;p;p=p.parent)if(p===parent)return true;return false;};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const vertices=nodes=>nodes.flatMap(n=>Array.from({length:n.geometry.attributes.position.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(n.geometry.attributes.position,i).applyMatrix4(n.matrixWorld)));
const box=nodes=>new THREE.Box3().setFromPoints(vertices(nodes));
const centre=points=>points.reduce((a,p)=>a.add(p),new THREE.Vector3()).divideScalar(points.length);
const nodesMatching=(actor,pattern)=>{const nodes=[];actor.traverse(n=>{if(n.isMesh&&pattern.test(label(n)))nodes.push(n);});return nodes;};
const opaque=n=>{const mats=Array.isArray(n.material)?n.material:[n.material];return mats.length&&mats.every(m=>m&&m.opacity>=.999&&!m.transparent);};

// glTF is Y-up; tests derive all coordinates from imported mesh vertices.
// Authored marker coordinates or manifest "passed" values cannot pass these checks.
export function measureDefenderFitV4(actor,id){
  actor.updateWorldMatrix(true,true);
  const body=nodesMatching(actor,/^(Continuous tunic bodice|Tunic bodice)$/),yoke=nodesMatching(actor,/^Direct fitted upper chest shoulder (yoke|plate)$/);
  const face=nodesMatching(actor,/^(Observed face|Face)$/);
  let seated=face;
  if(!seated.length){const helmets=nodesMatching(actor,/^Helmet/).filter(n=>!/ridge|shadow/i.test(label(n)));const low=Math.min(...helmets.map(n=>box([n]).min.y));seated=helmets.filter(n=>Math.abs(box([n]).min.y-low)<1e-5);}
  assert.ok(body.length&&seated.length,id+' has actual clothing and head surfaces');
  const headLow=box(seated).min.y,bodyTop=box(body).max.y,overlap=bodyTop-headLow;
  const directGap=physicalSurfaceGap(seated,[...body,...yoke]);
  const joinedYoke=!yoke.length||physicalSurfaceGap(yoke,body).gap<.00001;
  const checks=[{kind:'direct-head-to-real-upper-chest',headLowerSurfaceM:headLow,bodyUpperSurfaceM:bodyTop,restOverlapM:overlap,actualTriangleGapM:directGap.gap,joinedYoke,pass:overlap>=.0139&&overlap<=.0141&&directGap.gap<.00001&&joinedYoke}];
  if(id.startsWith('runebreaker-')){
    const head=actor.getObjectByName('head_pivot'),heads=[];actor.traverse(n=>{if(n.isMesh&&descendants(n,head)&&!/^Fitted neckline core$/.test(label(n)))heads.push(n);});
    const hammer=nodesMatching(actor,/^(Mallet head|Hammer steel head|Double hammer|Hammer claw)/),haft=nodesMatching(actor,/^Hammer haft$/),hand=nodesMatching(actor,/^Hand R$/);
    const actual=physicalSurfaceGap(heads,hammer),faceGap=physicalSurfaceGap(face,hammer),lateral=box(hammer).min.x-box(heads).max.x;
    checks.push({kind:'hammer-clear-of-whole-head',nearestSurfaceGapM:actual.gap,nearestFaceGapM:faceGap.gap,fullHeadLateralClearanceM:lateral,nearestHeadSurface:actual.nearestA,nearestHammerSurface:actual.nearestB,pass:actual.gap>=.060&&lateral>=.060});
    const grasp=physicalSurfaceGap(hand,haft);checks.push({kind:'real-hammer-haft-grasp',actualTriangleGapM:grasp.gap,pass:grasp.gap<.00001});
  }
  if(id.startsWith('cleric-')){
    const shaft=nodesMatching(actor,/^Staff shaft$/),p=vertices(shaft),b=box(shaft),lower=centre(p.filter(v=>Math.abs(v.y-b.min.y)<1e-6)),upper=centre(p.filter(v=>Math.abs(v.y-b.max.y)<1e-6));
    const drift=Math.hypot(upper.x-lower.x,upper.z-lower.z),grasp=physicalSurfaceGap(nodesMatching(actor,/^Hand R$/),shaft);
    checks.push({kind:'actual-vertical-staff-axis',actualLowerEndCentre:lower.toArray(),actualUpperEndCentre:upper.toArray(),horizontalAxisDriftM:drift,pass:drift<.000001&&upper.y-lower.y>.8});
    checks.push({kind:'real-staff-shaft-grasp',actualTriangleGapM:grasp.gap,pass:grasp.gap<.00001});
    if(Number(id.split('-').at(-1))>=2){
      const foundation=nodesMatching(actor,/^Fitted mitre foundation$/),roof=nodesMatching(actor,/^Mitre closed upper roof /).filter(opaque),bounds=box(foundation),c=bounds.getCenter(new THREE.Vector3()),ray=new THREE.Ray(),hit=new THREE.Vector3();
      const rays=[];
      for(const [dx,dz]of[[0,0],[-.20,0],[.20,0],[0,-.20],[0,.20]]){
        const origin=new THREE.Vector3(c.x+dx*(bounds.max.x-bounds.min.x),bounds.max.y+2,c.z+dz*(bounds.max.z-bounds.min.z));ray.set(origin,new THREE.Vector3(0,-1,0));let closest=Infinity,actualPart=null;
        for(const node of roof){const a=node.geometry.attributes.position,idx=node.geometry.index,count=idx?idx.count:a.count;for(let i=0;i<count;i+=3){const t=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(a,idx?idx.getX(i+k):i+k).applyMatrix4(node.matrixWorld));if(ray.intersectTriangle(...t,false,hit)){const d=origin.distanceTo(hit);if(d<closest){closest=d;actualPart=label(node);}}}}
        rays.push({origin:origin.toArray(),actualOpaqueRoofPart:actualPart,distanceM:Number.isFinite(closest)?closest:null,pass:Number.isFinite(closest)});
      }
      checks.push({kind:'opaque-closed-mitre-roof',rays,pass:new Set(roof.map(label)).size===2&&rays.every(r=>r.pass)});
    }
  }
  return {id,checks,failures:checks.filter(c=>!c.pass)};
}

const load=async id=>{const bytes=readFileSync('public/assets/geometric/defenders/'+id+'.glb'),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');return {bytes,gltf};};
test('all 48 current approved GLBs preserve source surfaces and functional runtime fit; legacy V4 solids retain their physical fit diagnostics',async()=>{
  const current=geometricEntries(JSON.parse(readFileSync('public/assets/geometric/geometric-defenders.json')));
  if(current.every(row=>row.reconstruction)){
    const report=await auditReconstructedRoster({ids:current.map(row=>row.id),output:'output/design/defenders-voices-v19/independent-basic-fit-runtime.json',quiet:true});
    assert.equal(report.models,48);assert.equal(report.failures,0,JSON.stringify(report.results.filter(row=>row.failures.length)));return;
  }
  const manifest=JSON.parse(readFileSync('public/assets/geometric/geometric-defenders.json')),results=[];assert.equal(manifest.assets.length,48);
  for(const row of manifest.assets){const {bytes,gltf}=await load(row.id);const r=measureDefenderFitV4(gltf.scene,row.id);assert.deepEqual(r.failures,[],row.id+': actual v4 physical fit');results.push({...r,actualGlbSha256:sha(bytes),sourceSha256:row.sourceSha256});disposeDecodedGeometricAsset(gltf);}
  const report={revision:'actual-defender-fit-v4',createdAtUtc:new Date().toISOString(),method:'Actual imported triangle surfaces; direct jaw/closed helmet to real bodice/yoke, full head to hammer triangle distance, actual shaft end-ring centres, five actual opaque mitre roof rays. No authored passed values or marker-only certification.',models:results.length,checks:results.reduce((n,r)=>n+r.checks.length,0),failures:results.flatMap(r=>r.failures).length,results};
  mkdirSync('output/design/defenders-voices-v19',{recursive:true});writeFileSync('output/design/defenders-voices-v19/independent-legacy-defender-fit.json',JSON.stringify(report,null,2)+'\n');
});
test('current Engineer/Cleric execute source-preserving attacks; legacy V4 detached-head/tool/roof regressions remain detectable',async()=>{
  if(currentReconstructionEntry('runebreaker-1')){for(const report of await auditCurrentReconstructionIds(['runebreaker-1','cleric-3']))assert.deepEqual(report.failures,[],report.id+' actual approved geometry/attack/owned-resource assertions');return;}
  const engineer=await load('runebreaker-1'),scene=engineer.gltf.scene;scene.getObjectByName('head_pivot').position.y+=.15;
  assert.ok(measureDefenderFitV4(scene,'runebreaker-1').failures.some(c=>c.kind==='direct-head-to-real-upper-chest'),'a moved actual head must fail despite intact metadata');
  scene.getObjectByName('head_pivot').position.y-=.15;const weapon=scene.getObjectByName('weapon_R');weapon.position.x-=.30;
  assert.ok(measureDefenderFitV4(scene,'runebreaker-1').failures.some(c=>c.kind==='hammer-clear-of-whole-head'),'hammer entering cap/skull is detected');disposeDecodedGeometricAsset(engineer.gltf);
  const cleric=await load('cleric-3'),actor=cleric.gltf.scene;actor.getObjectByName('weapon_R').rotation.z+=.1;
  assert.ok(measureDefenderFitV4(actor,'cleric-3').failures.some(c=>c.kind==='actual-vertical-staff-axis'),'a genuinely sloping shaft is detected');actor.getObjectByName('weapon_R').rotation.z-=.1;
  for(const n of nodesMatching(actor,/^Mitre closed upper roof /))n.removeFromParent();
  assert.ok(measureDefenderFitV4(actor,'cleric-3').failures.some(c=>c.kind==='opaque-closed-mitre-roof'),'missing physical roof fails even though an old fitted open-mitre base remains');disposeDecodedGeometricAsset(cleric.gltf);
});
