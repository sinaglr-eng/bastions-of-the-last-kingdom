import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {NativeTestGLTFLoader} from '../tests/helpers/native-gltf.mjs';
import {optimizeGeometricSiblings} from '../game/render/geometric-batching.js';
import {disposeGeometricResources} from '../game/render/geometric-resources.js';

const root=resolve(fileURLToPath(new URL('..',import.meta.url))),assetRoot=join(root,'public/assets/geometric');
const protectedNode=node=>{
  for(let current=node;current;current=current.parent)if(current.userData.visualCue||/^(refraction_shards|authored_bowstring|bow_tip_upper|bow_tip_lower|bow_nock|attack_muzzle|staff_tip|sword_tip)(?:_?\d+)?$|bow_?string/i.test(current.name))return true;
  return false;
};
const layout=geometry=>Object.entries(geometry.attributes).map(([name,attribute])=>`${name}:${attribute.itemSize}:${attribute.normalized}:${attribute.array?.constructor.name}`).sort().join('|');
const models=[];
for(const folder of ['defenders','champions','enemies'])for(const file of readdirSync(join(assetRoot,folder)).filter(file=>file.endsWith('.glb')).sort()){
  const path=join(assetRoot,folder,file),bytes=readFileSync(path),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const groups=new Map();let calls=0,protectedCalls=0,triangles=0;
  gltf.scene.traverse(node=>{
    if(!node.isMesh)return;
    const drawCalls=Array.isArray(node.material)?node.geometry.groups.length||node.material.length:1;calls+=drawCalls;triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;
    const cannotBatch=protectedNode(node)||node.isSkinnedMesh||node.children.length>0||Array.isArray(node.material)||node.material.transparent||Object.keys(node.geometry.morphAttributes).length||Object.values(node.geometry.attributes).some(attribute=>attribute.isInterleavedBufferAttribute);
    if(cannotBatch){protectedCalls+=drawCalls;return;}
    // This estimate permits only immediate siblings of the exact same rigid
    // parent with an identical shared material and attribute/render contract.
    const key=[node.parent.uuid,node.material.uuid,layout(node.geometry),node.renderOrder,node.castShadow,node.receiveShadow,node.layers.mask].join(';');
    groups.set(key,(groups.get(key)||0)+1);
  });
  const actual=optimizeGeometricSiblings(gltf.scene,{animations:gltf.animations});
  models.push({id:file.replace('.glb',''),category:folder,file:relative(root,path).replaceAll('\\','/'),fileSha256:createHash('sha256').update(bytes).digest('hex'),meshDrawCalls:calls,triangles,safeSiblingBatchEstimate:protectedCalls+groups.size,actualSiblingBatchCalls:actual.after,actualMergedGroups:actual.mergedGroups,protectedCalls,mergeableSiblingGroups:[...groups.values()].filter(count=>count>1).length});
  disposeGeometricResources(gltf.scene);
}
const waves=JSON.parse(readFileSync(join(root,'data/waves.json'))),byId=new Map(models.filter(model=>model.category==='enemies').map(model=>[model.id,model]));
const waveBudgets=waves.map((wave,index)=>({wave:index+1,spawned:wave.groups.reduce((sum,group)=>sum+group.count,0),enemyAndRetainedCorpseCalls:wave.groups.reduce((sum,group)=>sum+group.count*(byId.get(group.type)?.meshDrawCalls||0),0),safeSiblingBatchEstimate:wave.groups.reduce((sum,group)=>sum+group.count*(byId.get(group.type)?.safeSiblingBatchEstimate||0),0),actualSiblingBatchCalls:wave.groups.reduce((sum,group)=>sum+group.count*(byId.get(group.type)?.actualSiblingBatchCalls||0),0)}));
const categories=['defenders','champions','enemies'].map(category=>{
  const entries=models.filter(model=>model.category===category),total=entries.reduce((sum,model)=>sum+model.meshDrawCalls,0),batched=entries.reduce((sum,model)=>sum+model.safeSiblingBatchEstimate,0);
  const actual=entries.reduce((sum,model)=>sum+model.actualSiblingBatchCalls,0);
  return {category,models:entries.length,totalCalls:total,safeSiblingBatchEstimate:batched,actualBatchedCalls:actual,meanCalls:total/entries.length,meanSafeSiblingBatchEstimate:batched/entries.length,meanActualBatchedCalls:actual/entries.length,largest:entries.toSorted((a,b)=>b.meshDrawCalls-a.meshDrawCalls).slice(0,4).map(({id,meshDrawCalls,safeSiblingBatchEstimate,actualSiblingBatchCalls})=>({id,meshDrawCalls,safeSiblingBatchEstimate,actualSiblingBatchCalls}))};
});
const report={revision:'geometric-drawcall-audit-v1',optimizerSha256:createHash('sha256').update(readFileSync(join(root,'game/render/geometric-batching.js'))).digest('hex'),method:'Actual imported production GLB meshes/materials. Counts exclude frustum culling and include every physical part; safe estimate merges only opaque leaf siblings under the SAME immediate joint and SAME material/layout/render flags, protecting all cue/shard/string/endpoints.',limitations:'Static submission counts, not measured renderer.info or an FPS benchmark. Shadows can add passes. Wave figures are a conservative all-spawned live-or-retained-corpse budget, excluding towers, auras, HUD and scenery. Existing models.js optimize flattens the full hierarchy and is unsafe for these actors.',categories,waveBudgets,models};
const outputArg=process.argv.find(arg=>arg.startsWith('--output=')),output=outputArg?resolve(outputArg.slice('--output='.length)):join(root,'output/design/geometric-game-v1/drawcall-audit.json');mkdirSync(resolve(output,'..'),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({categories,largestWaveBudgets:waveBudgets.toSorted((a,b)=>b.enemyAndRetainedCorpseCalls-a.enemyAndRetainedCorpseCalls).slice(0,5),output}));
