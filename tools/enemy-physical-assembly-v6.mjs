// Read-only measurements of actual V6 enemy triangles. Scope contracts select
// physical surfaces; they never provide a pass, distance, aperture, or island.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from '../tests/helpers/native-gltf.mjs';
import {physicalSurfaceGap} from '../game/render/geometric-contacts.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
import {partSemanticV5} from './audit-geometric-proportions-v5.mjs';
import {inspectActualRiderAnatomyV6} from './enemy-rider-anatomy-v6.mjs';

const project=resolve(fileURLToPath(new URL('..',import.meta.url)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const semantic=partSemanticV5;
const descendant=(node,parent)=>{for(let p=node;p;p=p.parent)if(p===parent)return true;return false;};
const decode=value=>typeof value==='string'?JSON.parse(value):value;
export const ASSEMBLY_CONTACT_TOLERANCE_V6=.004;
export const APERTURE_ROUNDING_TOLERANCE_V6=.00002;
// Independently selected from the initial six-view findings, before authoring
// contract records exist. Each feature still has to pass actual triangle rays.
export const REQUIRED_SOURCE_APERTURES_V6={
 host_07:['skull-eye-L','skull-eye-R'],
 host_10:['mace-skull-eye-L','mace-skull-eye-R'],
 host_11:['skull-eye-L','skull-eye-R'],
 host_12:['bell-underside','bell-front-crack'],
 host_16:['mask-eye-L','mask-eye-R'],
 host_20:['staff-skull-eye-L','staff-skull-eye-R'],
 host_27:['open-rib-cage','mount-skull-eye-L','mount-skull-eye-R','mount-skull-mouth'],
 host_32:['open-chest-cage'],
 host_34:['skull-mask-eye-L','skull-mask-eye-R','mount-mask-eye-L','mount-mask-eye-R'],
 host_39:['mask-eye-L','mask-eye-R'],
 host_40:['skull-mouth','open-rib-cage'],
 host_44:['mask-eye-L','mask-eye-R'],
 host_46:['hollow-armor-recess'],
 host_47:['mount-mask-eye-L','mount-mask-eye-R'],
 host_49:['belly-mouth'],
 host_50:['head-mouth','eye-L','eye-R'],
};
// These original six-view steel-shell PNGs were opened independently, including
// the side views. Crests, horns and crowns are outside the helmet shell scope.
// The interval deliberately allows raster/camera approximation.
export const INDEPENDENT_HELMET_INTERVALS_V6=Object.fromEntries(['host_04','host_10','host_11','host_14','host_22','host_25','host_35','host_41','host_42','host_45','host_47'].map(id=>[id,[.45,1.15]]));
export function enemyPhysicalScopeV6(actor){let value;actor.traverse(node=>{if(node.userData?.enemyPhysicalContractV6)value=decode(node.userData.enemyPhysicalContractV6);});return value;}
export function enemyPhysicalMeshesV6(actor){actor.updateWorldMatrix(true,true);const result=[];actor.traverse(node=>{if(node.isMesh&&node.geometry?.attributes.position)result.push(node);});return result;}
export function nativeObjectNameV6(node){for(let p=node;p;p=p.parent)if(p.userData?.name||p.userData?.semanticPart)return p.userData.name||p.name;return node.name;}
const select=(meshes,names,scopeJoint,objectNames)=>meshes.filter(node=>Array.isArray(names)&&names.includes(semantic(node))&&(!objectNames||objectNames.includes(nativeObjectNameV6(node)))&&(!scopeJoint||(()=>{for(let p=node;p;p=p.parent)if(p.name===scopeJoint||p.userData?.name===scopeJoint)return true;return false;})()));
function triangles(nodes){const out=[];for(const node of nodes){const p=node.geometry.attributes.position,index=node.geometry.index;for(let i=0;i<(index?.count||p.count);i+=3)out.push(new THREE.Triangle(...[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(node.matrixWorld))));}return out;}
function bounds(nodes){const box=new THREE.Box3();for(const tri of triangles(nodes)){box.expandByPoint(tri.a);box.expandByPoint(tri.b);box.expandByPoint(tri.c);}return box;}

// The barycentric tolerance only resolves numerical edge seams. It is the same
// 1e-10 dimensionless rounding used by existing protected-skin ray checks.
export function firstActualSurfaceHitV6(nodes,origin,direction){
 let best=Infinity;for(const triangle of triangles(nodes)){
  const e1=triangle.b.clone().sub(triangle.a),e2=triangle.c.clone().sub(triangle.a),cross=direction.clone().cross(e2),det=e1.dot(cross);
  if(Math.abs(det)<=1e-14*e1.length()*e2.length()*direction.length())continue;
  const inv=1/det,rel=origin.clone().sub(triangle.a),u=rel.dot(cross)*inv,q=rel.clone().cross(e1),v=direction.dot(q)*inv,t=e2.dot(q)*inv;
  if(u>=-1e-10&&v>=-1e-10&&u+v<=1+1e-10&&t>=0)best=Math.min(best,t);
 }return best;
}

export function measureActualCavityV6(shell,interior,{minimumRecessM=.008,nativeRayDirection=[0,-1,0],sourceFeature}={}){
 minimumRecessM=Math.max(.008,minimumRecessM);
 const outer=bounds(shell),inner=bounds(interior);
 if(outer.isEmpty()||inner.isEmpty())return {passed:false,missingActualSurface:true,rays:[]};
 const c=inner.getCenter(new THREE.Vector3());
 // Native +Y forward becomes -Z. Arbitrary directions allow real upward bell
 // underside rays and lateral skull sockets, without changing the criterion.
 const direction=new THREE.Vector3(nativeRayDirection[0],nativeRayDirection[2],-nativeRayDirection[1]);
 if(!direction.toArray().every(Number.isFinite)||direction.lengthSq()<1e-12)return {passed:false,invalidRayDirection:true,rays:[]};
 direction.normalize();const u=new THREE.Vector3(Math.abs(direction.x)<.9?1:0,Math.abs(direction.x)<.9?0:1,0).addScaledVector(direction,-direction.dot(new THREE.Vector3(Math.abs(direction.x)<.9?1:0,Math.abs(direction.x)<.9?0:1,0))).normalize(),v=new THREE.Vector3().crossVectors(direction,u).normalize();
 const projected=nodes=>{const result={minD:Infinity,minU:Infinity,maxU:-Infinity,minV:Infinity,maxV:-Infinity};for(const tri of triangles(nodes))for(const p of[tri.a,tri.b,tri.c]){const d=p.dot(direction),x=p.dot(u),y=p.dot(v);result.minD=Math.min(result.minD,d);result.minU=Math.min(result.minU,x);result.maxU=Math.max(result.maxU,x);result.minV=Math.min(result.minV,y);result.maxV=Math.max(result.maxV,y);}return result;};
 const a=projected(shell),b=projected(interior),front=Math.min(a.minD,b.minD)-.05,width=b.maxU-b.minU,height=b.maxV-b.minV;
 const originAt=(x,y)=>c.clone().addScaledVector(u,x*width).addScaledVector(v,y*height).addScaledVector(direction,front-c.dot(direction));
 // A source rib cage contains a real central sternum and crossing ribs. Its
 // opening must be an actual finite visible patch between those physical bars,
 // rather than an unobstructed geometric centre. Search a fixed measured grid
 // over the interior and require four neighbouring rays plus the centre/rim
 // criterion. The 8mm recess floor and numerical ray tolerance stay identical.
 const cage=['open-chest-cage','open-rib-cage'].includes(sourceFeature),centres=cage?[0,-.25,.25,-.4,.4].flatMap(x=>[0,-.25,.25,-.4,.4].map(y=>[x,y])):[[0,0]],patchU=cage?Math.max(.004/Math.max(width,1e-12),.04):.15,patchV=cage?Math.max(.004/Math.max(height,1e-12),.04):.15,candidates=[];
 for(const [centreX,centreY]of centres){const rays=[];
 for(const [x,y]of[[0,0],[-patchU,0],[patchU,0],[0,-patchV],[0,patchV]]){
  const origin=originAt(centreX+x,centreY+y),a=firstActualSurfaceHitV6(shell,origin,direction),b=firstActualSurfaceHitV6(interior,origin,direction);
  rays.push({originM:origin.toArray(),directionThreeAxes:direction.toArray(),shellDistanceM:Number.isFinite(a)?a:null,interiorDistanceM:Number.isFinite(b)?b:null,visibleActualInterior:Number.isFinite(b)&&b<=a+APERTURE_ROUNDING_TOLERANCE_V6});
 }
 const centre=rays[0],adjacent=[];
 // Search actual nearby rim surfaces. Their entry depth distinguishes a real
 // recess from an eye or dark mouth painted onto the outermost face.
 for(const factor of [.6,.8,1,1.25,1.6])for(const [x,y]of[[-factor,0],[factor,0],[0,-factor],[0,factor]]){
  const origin=originAt(centreX+x,centreY+y),distance=firstActualSurfaceHitV6(shell,origin,direction);
  if(Number.isFinite(distance))adjacent.push({originM:origin.toArray(),shellDistanceM:distance,recessFromActualRimM:centre.interiorDistanceM===null?null:centre.interiorDistanceM-distance});
 }
 const actualRecessM=Math.max(-Infinity,...adjacent.map(row=>row.recessFromActualRimM??-Infinity));
 const result={passed:centre.visibleActualInterior&&rays.filter(row=>row.visibleActualInterior).length>=4&&actualRecessM>=minimumRecessM,minimumRecessM,actualRecessM:Number.isFinite(actualRecessM)?actualRecessM:null,rays,adjacentActualShellRays:adjacent,measuredPatchCentreUV:[centreX,centreY],measuredPatchHalfExtentM:[patchU*width,patchV*height],criterion:'Actual triangle line of sight through a finite opening to a physically recessed interior; no inferred anchor radius or color certification'};candidates.push(result);if(result.passed)break;
 }
 const result=candidates.find(row=>row.passed)||candidates.sort((a,b)=>b.rays.filter(row=>row.visibleActualInterior).length-a.rays.filter(row=>row.visibleActualInterior).length)[0];
 return {...result,...(cage?{independentCageGridSearch:true,actualCandidatePatches:candidates.map(row=>({centreUV:row.measuredPatchCentreUV,actualVisibleRays:row.rays.filter(ray=>ray.visibleActualInterior).length,actualRecessM:row.actualRecessM,passed:row.passed}))}:{})};
}

// Split actual material seams and vertex-connected triangle islands before
// comparing physical surfaces. One mesh name cannot conceal disconnected bits.
export function actualSurfacePiecesV6(nodes){
 const pieces=[],parts=new Map();
 for(const node of nodes){const key=semantic(node);if(!parts.has(key))parts.set(key,[]);parts.get(key).push(node);}
 for(const [part,partNodes]of parts){
  // Rejoin material-split faces before testing closed-solid containment.
  const tris=triangles(partNodes),parent=tris.map((_,i)=>i),first=new Map();
  const find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));const unite=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;};
  tris.forEach((tri,i)=>{for(const p of[tri.a,tri.b,tri.c]){const key=p.toArray().map(v=>v.toFixed(7)).join(',');if(first.has(key))unite(i,first.get(key));else first.set(key,i);}});
  const groups=new Map();tris.forEach((tri,i)=>{const key=find(i);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(tri);});
  for(const group of groups.values()){
   const positions=group.flatMap(tri=>[...tri.a.toArray(),...tri.b.toArray(),...tri.c.toArray()]);
   const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float64Array(positions),3));
   // CPU-only surface record. It owns this temporary geometry, no GPU material.
   pieces.push({name:partNodes.map(node=>node.name).join(' + '),semanticPart:part,geometry,matrixWorld:new THREE.Matrix4(),source:partNodes,triangleCount:group.length});
  }
 }return pieces;
}
export function actualPhysicalComponentsV6(nodes,{tolerance=ASSEMBLY_CONTACT_TOLERANCE_V6}={}){
 const pieces=actualSurfacePiecesV6(nodes),neighbors=pieces.map(()=>new Set()),edges=[];
 try{
  for(let i=0;i<pieces.length;i++)for(let j=i+1;j<pieces.length;j++){
   const actual=physicalSurfaceGap([pieces[i]],[pieces[j]]);
   if(actual.gap<=tolerance){neighbors[i].add(j);neighbors[j].add(i);edges.push({a:i,b:j,gapM:actual.gap,intersecting:!!actual.intersecting,contained:!!actual.contained});}
  }
  const remaining=new Set(pieces.map((_,i)=>i)),groups=[];
  while(remaining.size){const seed=remaining.values().next().value;remaining.delete(seed);const queue=[seed],group=[];while(queue.length){const i=queue.pop();group.push(i);for(const j of neighbors[i])if(remaining.delete(j))queue.push(j);}groups.push(group.map(i=>({piece:i,part:pieces[i].semanticPart,mesh:pieces[i].name,triangles:pieces[i].triangleCount})));}
  return {passed:pieces.length>0&&groups.length===1,toleranceM:tolerance,pieces:pieces.length,actualConnectedComponents:groups,actualSurfaceEdges:edges};
 }finally{for(const piece of pieces)piece.geometry.dispose();}
}

export function inspectEnemyAssembliesV6(actor,{id,contract=enemyPhysicalScopeV6(actor),baselineBossActor=null}={}){
 const meshes=enemyPhysicalMeshesV6(actor),checks=[];
 const check=(name,passed,measurements)=>checks.push({name,passed:!!passed,measurements});
 check('explicit source physical scopes exist',contract&&Array.isArray(contract.contacts)&&contract.contacts.length>0,{id,scopeContractIsSelectionOnly:true});
 checks.push(...inspectActualRiderAnatomyV6(actor,meshes,{id,toleranceM:ASSEMBLY_CONTACT_TOLERANCE_V6}));
 if(!contract)return {id,checks,failures:checks.filter(row=>!row.passed)};
 for(const feature of REQUIRED_SOURCE_APERTURES_V6[id]||[]){
  const probes=(contract.cavities||[]).filter(cavity=>cavity.sourceFeature===feature);
  check('required source aperture '+feature+' is independently covered',probes.length>0,{sourceFeature:feature,criterion:'Independently required scope; actual cavity ray result is a separate mandatory check'});
  if(feature==='bell-underside')check('bell underside uses genuine upward rays',probes.some(probe=>probe.nativeRayDirection?.[2]>.99&&Math.abs(probe.nativeRayDirection[0])<1e-5&&Math.abs(probe.nativeRayDirection[1])<1e-5),{sourceFeature:feature});
 }
 for(const relation of contract.contacts||[]){
  const left=select(meshes,relation.leftParts,relation.leftScopeJoint||relation.scopeJoint,relation.leftObjectNames),right=select(meshes,relation.rightParts,relation.rightScopeJoint||relation.scopeJoint,relation.rightObjectNames),actual=physicalSurfaceGap(left,right);
  check(relation.name||'actual assembly surface contact',left.length&&right.length&&!left.some(node=>right.includes(node))&&actual.gap<=ASSEMBLY_CONTACT_TOLERANCE_V6,{partsA:relation.leftParts,partsB:relation.rightParts,toleranceM:ASSEMBLY_CONTACT_TOLERANCE_V6,actualGapM:Number.isFinite(actual.gap)?actual.gap:null,actualTriangleIntersection:!!actual.intersecting,actualSolidContainment:!!actual.contained});
 }
 for(const cavity of contract.cavities||[]){const actual=measureActualCavityV6(select(meshes,cavity.shellParts,cavity.scopeJoint,cavity.shellObjectNames),select(meshes,cavity.interiorParts,cavity.scopeJoint,cavity.interiorObjectNames),cavity);check(cavity.name||'actual open recessed cavity',actual.passed,actual);}
 if(INDEPENDENT_HELMET_INTERVALS_V6[id])check('independent source helmet depth scope is present',(contract.helmetRatios||[]).length>0,{id});
 for(const helmet of contract.helmetRatios||[]){
  const selected=select(meshes,helmet.coverParts,helmet.scopeJoint,helmet.coverObjectNames),box=bounds(selected),size=box.getSize(new THREE.Vector3()),ratio=size.z/size.x,interval=INDEPENDENT_HELMET_INTERVALS_V6[id];
  // Author declarations cannot widen the independently reviewed interval.
  if(!interval){check('helmet interval requires independent source review',false,{id,coverParts:helmet.coverParts});continue;}
  check(helmet.name||'actual helmet sagittal depth matches the approximate source interval',!box.isEmpty()&&interval?.length===2&&ratio>=interval[0]&&ratio<=interval[1],{actualSizeM:size.toArray(),actualDepthToWidth:ratio,sourceApproximateInterval:interval,criterion:'Actual physical shell dimensions; source raster interval remains an approximation, not 1% dimensional fidelity'});
 }
 const ignored=new Set(contract.intentionalMagicParts||[]),weapons=[];actor.traverse(node=>{if(!node.isMesh&&/(?:^|_)weapon_[LR]$/.test(node.name))weapons.push(node);});
 for(const weapon of weapons){
  const held=meshes.filter(node=>descendant(node,weapon)&&!ignored.has(semantic(node)));if(!held.length)continue;
  const connected=actualPhysicalComponentsV6(held);check('held '+weapon.name+' has one connected actual physical assembly',connected.passed,connected);
  const inverse=weapon.matrixWorld.clone().invert(),relative=held.map(node=>inverse.clone().multiply(node.matrixWorld)),rotation=weapon.quaternion.clone();let error=0;
  try{for(const angle of[-.45,.62]){weapon.quaternion.copy(rotation).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),angle));actor.updateWorldMatrix(true,true);const inv=weapon.matrixWorld.clone().invert();held.forEach((node,i)=>{const matrix=inv.clone().multiply(node.matrixWorld);matrix.elements.forEach((v,j)=>{error=Math.max(error,Math.abs(v-relative[i].elements[j]));});});}}finally{weapon.quaternion.copy(rotation);actor.updateWorldMatrix(true,true);}
  check('all held '+weapon.name+' physical parts move with the actual rig',error<1e-5,{parts:held.map(node=>semantic(node)),actualPoseAnglesRad:[-.45,.62],maximumActualRelativeMatrixError:error,excludedIntentionalMagicParts:[...ignored]});
 }
 if(baselineBossActor){
  const current=bounds(meshes),previous=bounds(enemyPhysicalMeshesV6(baselineBossActor)),height=current.max.y-current.min.y,oldHeight=previous.max.y-previous.min.y;
  check('actual new boss authored height preserves enlarged V5 presentation',height+1e-5>=oldHeight,{actualAuthoredHeightM:height,actualV5AuthoredHeightM:oldHeight,ratio:height/oldHeight,unchangedBattlefieldBossMultiplier:1.5,criterion:'Two actual imported GLB triangle bounds; the existing whole-figure 1.5x production multiplier is retained independently'});
 }
 return {id,checks,failures:checks.filter(row=>!row.passed)};
}

async function load(path){const bytes=readFileSync(path),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');return {bytes,gltf,actor:gltf.scene};}
export async function runEnemyPhysicalAuditV6(){
 const manifestPath=resolve(project,'public/assets/geometric/geometric-enemies.json'),manifestBytes=readFileSync(manifestPath),manifest=JSON.parse(manifestBytes),baseline=JSON.parse(readFileSync(resolve(project,'output/design/geometric-game-v6/baseline-v5-glbs/manifest.json'))),baselineById=new Map(baseline.entries.map(row=>[row.id,row])),entries=[];
 const helmetReviewPath='output/design/geometric-game-v6/independent-helmet-source-intervals.json',helmetReviewBytes=readFileSync(resolve(project,helmetReviewPath)),helmetReview=JSON.parse(helmetReviewBytes);
 if(!helmetReview.independentOriginalSourceReview||helmetReview.currentModelApproval!==false||helmetReview.entries.length!==Object.keys(INDEPENDENT_HELMET_INTERVALS_V6).length)throw Error('Missing independent original helmet source review');
 for(const row of helmetReview.entries)if(!row.actualOriginalCompositeOpened||sha(readFileSync(resolve(project,row.sourceFile)))!==row.sourceSha256||JSON.stringify(row.approximateDepthToWidthInterval)!==JSON.stringify(INDEPENDENT_HELMET_INTERVALS_V6[row.id]))throw Error('Independent helmet source scope changed: '+row.id);
 if(manifest.entries.length!==50||new Set(manifest.entries.map(row=>row.id)).size!==50||baseline.bosses!==5||baseline.entries.length!==5||['host_10','host_20','host_30','host_40','host_50'].some(id=>!baselineById.has(id)))throw Error('Incomplete actual enemy/boss scope');
 for(const row of manifest.entries){
  const nativePath=resolve(project,row.native),nativeSha=sha(readFileSync(nativePath)),current=await load(resolve(project,'public/assets/geometric',row.file));let previous;
  try{
   if(baselineById.has(row.id)){const entry=baselineById.get(row.id);previous=await load(resolve(project,entry.file));if(sha(previous.bytes)!==entry.sha256)throw Error('V5 actual boss baseline changed: '+row.id);}
   const result=inspectEnemyAssembliesV6(current.actor,{id:row.id,baselineBossActor:previous?.actor});
   entries.push({...result,actualGlbSha256:sha(current.bytes),actualNativeSha256:nativeSha,sourceSha256:row.sourceSha256,nativeUntouched:sha(readFileSync(nativePath))===nativeSha,exportUntouched:sha(readFileSync(resolve(project,'public/assets/geometric',row.file)))===sha(current.bytes)});
  }finally{disposeDecodedGeometricAsset(current.gltf);if(previous)disposeDecodedGeometricAsset(previous.gltf);}
 }
 const report={revision:'geometric-game-v6',readOnly:true,models:entries.length,checks:entries.reduce((n,row)=>n+row.checks.length,0),failures:entries.reduce((n,row)=>n+row.failures.length,0),enemyManifestSha256:sha(manifestBytes),baselineBossGeometry:baseline.entries,independentHelmetSourceReview:{file:helmetReviewPath,sha256:sha(helmetReviewBytes)},contactToleranceM:ASSEMBLY_CONTACT_TOLERANCE_V6,apertureRoundingToleranceM:APERTURE_ROUNDING_TOLERANCE_V6,limitations:'Finite actual contact and ray probes establish selected interfaces/openings; manual six-view source comparison remains separate. Source dimension intervals are approximate. No names, anchors or author flags certify physical contact.',runtimeModules:['tools/enemy-physical-assembly-v6.mjs','tools/enemy-rider-anatomy-v6.mjs','game/render/geometric-contacts.js','tools/audit-geometric-proportions-v5.mjs','tests/helpers/native-gltf.mjs'].map(file=>({file,sha256:sha(readFileSync(resolve(project,file)))})),entries};
 const path=resolve(project,'output/design/geometric-game-v6/enemy-physical-assembly-audit.json');mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({models:report.models,checks:report.checks,failures:report.failures,output:path}));return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const report=await runEnemyPhysicalAuditV6();if(report.failures||report.entries.some(row=>!row.nativeUntouched||!row.exportUntouched))process.exitCode=1;}
