// Inspect real exported head assemblies and draped cloth, independently of
// authoring flags. Named-part flags choose a scope; actual vertices decide it.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from '../tests/helpers/native-gltf.mjs';
const project=resolve(fileURLToPath(new URL('..',import.meta.url)));
export function partSemanticV5(node){for(let p=node;p;p=p.parent)if(p.userData?.semanticPart)return p.userData.semanticPart;return node.userData?.name||node.name.replaceAll('_',' ');}
const semantic=partSemanticV5;
const descends=(node,parent)=>{for(let p=node;p;p=p.parent)if(p===parent)return true;return false;};
const parsed=value=>typeof value==='string'?JSON.parse(value):value;
export function actualPartBounds(root,predicate){root.updateMatrixWorld(true);const box=new THREE.Box3(),point=new THREE.Vector3();root.traverse(node=>{if(!node.isMesh||!node.geometry?.attributes.position||!predicate(node))return;const p=node.geometry.attributes.position;for(let i=0;i<p.count;i++)box.expandByPoint(point.fromBufferAttribute(p,i).applyMatrix4(node.matrixWorld));});return box;}
export function inspectProportionsV5(root,{id}={}){
 root.updateMatrixWorld(true);let metadata;root.traverse(node=>{if(node.userData?.geometricRig)metadata=node.userData;});const checks=[];const check=(name,passed,measurements)=>checks.push({name,passed:!!passed,measurements});
 const heads=parsed(metadata?.headProportionV5),cloak=parsed(metadata?.foldedCloakV5);
 for(const entry of heads?.assemblies||[]){
  const head=root.getObjectByName(entry.headPivot);const actual=actualPartBounds(root,n=>head&&descends(n,head)&&!semantic(n).toLowerCase().startsWith('staff'));const size=actual.getSize(new THREE.Vector3());const expected=entry.newHeadAssemblySizeM;const error=expected?Math.max(Math.abs(size.x-expected[0]),Math.abs(size.y-expected[2]),Math.abs(size.z-expected[1])):Infinity;
  check('actual whole head and all attached covers retain contracted dimensions',head&&!actual.isEmpty()&&error<.00001,{id,actualSizeThreeAxes:size.toArray(),expectedNativeAxes:expected,maxDeviationM:error});
  const bearing=actualPartBounds(root,n=>entry.bearingParts?.includes(semantic(n)));const drift=bearing.min.y-entry.baseBeforeM;
  check('actual seated jaw or helmet base remains at the real rest bearing elevation',!bearing.isEmpty()&&Math.abs(drift)<.00001,{id,actualBearingBaseM:bearing.min.y,previousBearingBaseM:entry.baseBeforeM,driftM:drift});
  const face=actualPartBounds(root,n=>head&&descends(n,head)&&['Observed face','Face'].includes(semantic(n)));const cover=actualPartBounds(root,n=>head&&descends(n,head)&&/(hood|hat|helmet|hair)/i.test(semantic(n)));if(!face.isEmpty()&&!cover.isEmpty())check('actual head cover stays registered over the physical face',cover.max.y>=face.max.y-.008&&cover.max.x>=face.max.x-.022&&cover.min.x<=face.min.x+.022,{face:face.min.toArray().concat(face.max.toArray()),cover:cover.min.toArray().concat(cover.max.toArray())});
 }
 for(const entry of cloak?.garments||[]){
  const meshes=[];root.traverse(node=>{if(node.isMesh&&semantic(node)===entry.part)meshes.push(node);});const box=actualPartBounds(root,n=>meshes.includes(n));const s=box.getSize(new THREE.Vector3());const heights=new Set();let points=0;for(const mesh of meshes){const pos=mesh.geometry.attributes.position,p=new THREE.Vector3();for(let i=0;i<pos.count;i++){p.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);heights.add(p.y.toFixed(5));points++;}}
  check('cloak has actual wrapped depth and multiple physical drape stations',meshes.length>0&&s.z>Math.min(.05,s.x*.10)&&heights.size>=7&&points>=100,{id,actualSizeM:s.toArray(),actualDistinctDrapeHeights:heights.size,actualVertices:points});
  // Weld duplicated material/normal vertices and count every triangle edge.
  const edges=new Map(),pointKeys=new Map();let nextKey=0;let degenerate=0;
  for(const mesh of meshes){const pos=mesh.geometry.attributes.position,index=mesh.geometry.index,p=new THREE.Vector3();const keys=[];for(let i=0;i<pos.count;i++){p.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);const k=p.toArray().map(v=>v.toFixed(6)).join(',');if(!pointKeys.has(k))pointKeys.set(k,nextKey++);keys.push(pointKeys.get(k));}for(let i=0;i<(index?.count||pos.count);i+=3){const tri=[0,1,2].map(j=>keys[index?index.getX(i+j):i+j]);if(new Set(tri).size!==3)degenerate++;for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3];const k=a<b?a+':'+b:b+':'+a;edges.set(k,(edges.get(k)||0)+1);}}}
  const unmatched=[...edges.values()].filter(n=>n!==2).length;check('folded cloak is actual closed cloth volume',edges.size>0&&unmatched===0&&degenerate===0,{id,weldedVertices:pointKeys.size,triangleEdges:edges.size,unmatchedEdges:unmatched,collapsedTriangles:degenerate});
 }
 return {id,checks,failures:checks.filter(c=>!c.passed)};
}
async function main(){const reports=[];for(const category of ['defenders','champions','enemies']){const mf=JSON.parse(readFileSync(resolve(project,'public/assets/geometric/geometric-'+category+'.json')));for(const row of mf.assets||mf.entries){const path=resolve(project,'public/assets/geometric',row.file),bytes=readFileSync(path);const root=(await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;reports.push({...inspectProportionsV5(root,{id:row.id}),category,actualGlbSha256:createHash('sha256').update(bytes).digest('hex')});}}
 const checks=reports.flatMap(r=>r.checks),result={revision:'geometric-game-v5',subjects:reports.length,checks:checks.length,failures:checks.filter(c=>!c.passed).length,entries:reports};const dest=resolve(project,'output/design/geometric-game-v5/proportions-cloak-audit.json');mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({subjects:result.subjects,checks:result.checks,failures:result.failures,report:dest}));if(result.failures)process.exitCode=1;}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
