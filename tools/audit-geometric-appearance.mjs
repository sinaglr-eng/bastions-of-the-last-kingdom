// Source-specific shape regression checks on actual exported vertices.
// These checks do not replace the six-view visual review.
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync} from 'node:fs';
import {resolve,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from '../tests/helpers/native-gltf.mjs';
import {geometricMetadata} from '../game/render/geometric-motion.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';

const project=resolve(fileURLToPath(new URL('..',import.meta.url))),assetRoot=join(project,'public/assets/geometric');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const semantic=node=>node.userData?.semanticPart||node.userData?.name||node.name.replaceAll('_',' ');
function partOf(node){for(let p=node;p;p=p.parent)if(p.userData?.semanticPart)return p.userData.semanticPart;return semantic(node);}
export function partMeshes(root,selector){const out=[];root.traverse(node=>{if(node.isMesh&&node.geometry?.attributes.position?.count>=3&&(selector instanceof RegExp?selector.test(partOf(node)):selector.includes(partOf(node))))out.push(node);});return out;}
export function partBounds(root,selector){root.updateMatrixWorld(true);const bounds=new THREE.Box3();for(const mesh of partMeshes(root,selector)){const positions=mesh.geometry.attributes.position,v=new THREE.Vector3();for(let i=0;i<positions.count;i++)bounds.expandByPoint(v.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld));}return bounds;}
const extent=(box,axis)=>box.isEmpty()?NaN:box.max[axis]-box.min[axis];
const descends=(node,parent)=>{for(let p=node;p;p=p.parent)if(p===parent)return true;return false;};

// Compare the closed flat main stroke's real projected face area with its
// convex hull. Concave lightning corners have less area than a diamond/box.
export function projectedConcavity(meshes){
 const points=new Map();let area=0;
 for(const mesh of meshes){const p=mesh.geometry.attributes.position,index=mesh.geometry.index,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3();
  for(let i=0;i<p.count;i++){a.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);points.set(a.x.toFixed(7)+','+a.y.toFixed(7),[a.x,a.y]);}
  for(let i=0;i<(index?.count||p.count);i+=3){a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);normal.crossVectors(b.clone().sub(a),c.clone().sub(a));if(Math.abs(normal.z)>1e-10&&Math.hypot(normal.x,normal.y)<Math.abs(normal.z)*1e-4)area+=Math.abs(normal.z)/2;}
 }
 const sorted=[...points.values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 function half(list){const hull=[];for(const p of list){while(hull.length>=2&&cross(hull.at(-2),hull.at(-1),p)<=1e-10)hull.pop();hull.push(p);}return hull.slice(0,-1);}
 const hull=half(sorted).concat(half([...sorted].reverse()));let hullArea=0;for(let i=0;i<hull.length;i++){const p=hull[i],q=hull[(i+1)%hull.length];hullArea+=p[0]*q[1]-p[1]*q[0];}hullArea=Math.abs(hullArea)/2;
 return {projectedArea:area/2,convexHullArea:hullArea,areaFraction:hullArea?area/2/hullArea:NaN,projectedUniqueVertices:points.size};
}

export function inspectAppearance(root,{id,criteria=[]}={}){
 root.updateMatrixWorld(true);const metadata=geometricMetadata(root),checks=[],measurements=[];
 const check=(name,pass,detail)=>checks.push({name,pass:!!pass,detail});
 const basic=/^(soldier|archer|mage|frostwarden|stormcaller|cleric|druid|runebreaker)-[1-6]$/.test(id);
 if(basic){
  const face=partBounds(root,/^(Observed face|Face)$/),bodice=partBounds(root,/^(Continuous tunic bodice|Tunic bodice|Armor chest|Chestplate)$/);
  if(!face.isEmpty()&&!bodice.isEmpty()&&extent(face,'z')>=.15){
   const offset=face.getCenter(new THREE.Vector3()).z-bodice.getCenter(new THREE.Vector3()).z;
   check('whole skull stays over actual torso axis',Math.abs(offset)<=.061,{offsetNativeM:offset,toleranceNativeM:.061,method:'actual full head and body solid centres; shallow aperture faces are excluded'});
  }
 }
 if(id?.startsWith('stormcaller-')){
  const rank=Number(id.at(-1)),head=root.getObjectByName('head_pivot');
  const hair=partMeshes(root,/^Natural /),bolt=partMeshes(root,/^Continuous flattened held lightning$/),band=partMeshes(root,/^Fitted hollow lightning crown band$/);
  check('natural fitted hair and crown are carried by head',hair.length>0&&band.length>0&&[...hair,...band].every(node=>descends(node,head)),{hairMeshes:hair.length,crownMeshes:band.length});
  const teeth=new Set(partMeshes(root,/^Crown lightning tooth \d+$/).filter(node=>{const box=new THREE.Box3().setFromObject(node,true);return extent(box,'y')>.03&&extent(box,'x')>.01&&extent(box,'z')>.008;}).map(partOf));
  check('actual crown teeth distinguish the requested rank',teeth.size===[1,3,3,5,5,7][rank-1],{actualTeeth:teeth.size,rank});
  const concavity=projectedConcavity(bolt),box=partBounds(root,/^Continuous flattened held lightning$/);
  check('held focus has one tall concave lightning silhouette',bolt.length>0&&concavity.areaFraction>.25&&concavity.areaFraction<.92&&extent(box,'y')>extent(box,'x')*1.6,concavity);
  const scalp=partBounds(root,/^Natural fitted silver hair cap$/),wholeHair=partBounds(root,/^Natural /),face=partBounds(root,/^Observed face$/);
  check('all actual hair locks stay low around the skull',!wholeHair.isEmpty()&&!face.isEmpty()&&extent(scalp,'y')<.20&&wholeHair.max.y-face.max.y<.20&&wholeHair.min.y>=face.min.y-.025,{scalpHeightNativeM:extent(scalp,'y'),highestHairAboveSkullNativeM:wholeHair.max.y-face.max.y,lowestHairAboveJawNativeM:wholeHair.min.y-face.min.y});
 }
 for(const criterion of criteria){
  const numerator=partBounds(root,criterion.numerator.parts),denominator=partBounds(root,criterion.denominator.parts),a=extent(numerator,criterion.numerator.axis),b=extent(denominator,criterion.denominator.axis),ratio=a/b;
  const measurement={name:criterion.name,numeratorNativeM:a,denominatorNativeM:b,ratio,range:criterion.range,sourcePixels:criterion.sourcePixels,sourceLandmarks:criterion.sourceLandmarks,note:criterion.note};
  measurements.push(measurement);check(criterion.name,Number.isFinite(ratio)&&ratio>=criterion.range[0]&&ratio<=criterion.range[1],measurement);
 }
 if(id==='mothernature'){
  const flesh=partMeshes(root,/^(Observed face nature|Construct square eye)/),eyes=partMeshes(root,/^Nature spirit .*eye/i);
  check('nature spirit has luminous eyes and no human skin rectangle',flesh.length===0&&eyes.length>=2&&eyes.every(node=>(Array.isArray(node.material)?node.material:[node.material]).some(material=>material.emissiveIntensity>0)),{humanFaceMeshes:flesh.length,glowingEyeMeshes:eyes.length});
 }
 if(id==='thunderheart'){
  const mount=partMeshes(root,/^Dragon sculpted faceted cranial volume source broad wedge$/),armor=partMeshes(root,/^(Tailored continuous bodice|Breastplate fitted shell|Shoulder plate |Upper arm |Forearm |Upper leg |Helmet integrated crown cheeks|Dragonrider distinct )/);
  const colors=nodes=>nodes.flatMap(node=>(Array.isArray(node.material)?node.material:[node.material]).filter(material=>material?.color).map(material=>material.color));
  const mountColors=colors(mount),armorColors=colors(armor),distance=(a,b)=>Math.hypot(a.r-b.r,a.g-b.g,a.b-b.b);
  const closest=mountColors.length&&armorColors.length?Math.min(...armorColors.flatMap(a=>mountColors.map(b=>distance(a,b)))):0;
  check('whole rider armor contrasts with the actual purple dragon',armor.length>=12&&closest>.16,{actualArmorMeshes:armor.length,minimumLinearRgbDistanceToMount:closest,tolerance:.16,method:'Actual torso, arms, legs, helmet and armor materials, not palette names or override metadata'});
 }
 if(['rimewatch','royalranger'].includes(id)){
  const weapon=root.getObjectByName('weapon_R'),rear=root.getObjectByName('crossbow_trigger_grip'),front=root.getObjectByName('crossbow_foregrip'),hands={R:root.getObjectByName('hand_R'),L:root.getObjectByName('hand_L')};
  check('crossbow stock and cocked string replace any bow',metadata?.attackStyle==='crossbow'&&partMeshes(root,/^Crossbow connected fore-stock$/).length>0&&partMeshes(root,/^Crossbow cocked two-segment physical string$/).length>0&&partMeshes(root,/^Continuous open bow stave$/).length===0,{attackStyle:metadata?.attackStyle});
  if(rear&&front&&hands.R&&hands.L){const a=rear.getWorldPosition(new THREE.Vector3()),b=front.getWorldPosition(new THREE.Vector3()),gapR=a.distanceTo(hands.R.getWorldPosition(new THREE.Vector3())),gapL=b.distanceTo(hands.L.getWorldPosition(new THREE.Vector3()));
   check('rear trigger and front support are separate true hand grips',gapR<1e-5&&gapL<1e-5&&a.z-b.z>.18&&descends(front,weapon)&&descends(rear,weapon),{gapRightNativeM:gapR,gapLeftNativeM:gapL,forwardSeparationNativeM:a.z-b.z});
  }else check('rear trigger and front support are separate true hand grips',false,{missingNativeGrip:true});
 }
 return {checks,measurements,failures:checks.filter(row=>!row.pass)};
}

export async function auditGeometricAppearance(file,criteria=[]){
 const bytes=readFileSync(file),id=file.split(/[\\/]/).at(-1).replace('.glb',''),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const result=inspectAppearance(gltf.scene,{id,criteria});disposeDecodedGeometricAsset(gltf);
 return {id,file:relative(project,file).replaceAll('\\','/'),assetSha256:sha(bytes),...result};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const outputArg=process.argv.find(arg=>arg.startsWith('--output=')),criteriaFile=join(project,'output/design/geometric-game-v3/source-creature-checkpoints.json');
 if(!existsSync(criteriaFile))throw new Error('Source-first creature checkpoint file is required before the full appearance audit.');
 const sourceCriteria=JSON.parse(readFileSync(criteriaFile));
 for(const row of sourceCriteria.entries)if(sha(readFileSync(join(project,'public/geometric-turnarounds-v1',row.source)))!==row.sourceSha256)throw new Error('Source changed: '+row.id);
 const results=[];
 for(const folder of ['defenders','champions'])for(const name of readdirSync(join(assetRoot,folder)).filter(name=>name.endsWith('.glb'))){const id=name.replace('.glb',''),criterion=sourceCriteria.entries.find(row=>row.id===id);const result=await auditGeometricAppearance(join(assetRoot,folder,name),criterion?.ratioChecks||[]);if(result.checks.length)results.push(result);}
 const report={revision:'actual-source-appearance-regressions-v3',createdAt:new Date().toISOString(),models:results.length,checks:results.reduce((n,row)=>n+row.checks.length,0),failures:results.reduce((n,row)=>n+row.failures.length,0),sourceCheckpointSha256:sha(readFileSync(criteriaFile)),sourceCheckpointFile:relative(project,criteriaFile).replaceAll('\\','/'),limitations:'Source raster landmarks have uncertain edges and different camera perspective. These tolerant ratios and identity checks detect specified regressions; they do not certify entire silhouettes or replace actual six-view inspection.',runtimeModules:['tools/audit-geometric-appearance.mjs','game/render/walls.js','game/render/battlefield-scale.js'].map(file=>({file,sha256:sha(readFileSync(join(project,file)))})),results};
 const output=resolve(outputArg?outputArg.slice('--output='.length):join(project,'output/design/geometric-game-v3/appearance-proportion-audit.json'));mkdirSync(resolve(output,'..'),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,results:undefined}));if(report.failures)process.exitCode=1;
}
