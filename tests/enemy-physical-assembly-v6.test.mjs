import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
import {partSemanticV5} from '../tools/audit-geometric-proportions-v5.mjs';
import {enemyPhysicalScopeV6,enemyPhysicalMeshesV6,inspectEnemyAssembliesV6,measureActualCavityV6,actualPhysicalComponentsV6,REQUIRED_SOURCE_APERTURES_V6,nativeObjectNameV6} from '../tools/enemy-physical-assembly-v6.mjs';
import {inspectActualRiderAnatomyV6} from '../tools/enemy-rider-anatomy-v6.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const beneath=(node,parent)=>{for(let p=node;p;p=p.parent)if(p===parent)return true;return false;};
const selected=(actor,names,scopeJoint,objectNames)=>enemyPhysicalMeshesV6(actor).filter(node=>names.includes(partSemanticV5(node))&&(!objectNames||objectNames.includes(nativeObjectNameV6(node)))&&(!scopeJoint||(()=>{for(let p=node;p;p=p.parent)if(p.name===scopeJoint||p.userData?.name===scopeJoint)return true;return false;})()));
const metadata=actor=>{const result=[];actor.traverse(node=>result.push([node.name,JSON.stringify(node.userData)]));return JSON.stringify(result);};
// During authoring, the same actual-byte regressions can target an explicitly
// provided staged manifest. Final pnpm test uses only the canonical release.
const stage=process.env.GEOMETRIC_V6_STAGE_MANIFEST?JSON.parse(readFileSync(process.env.GEOMETRIC_V6_STAGE_MANIFEST,'utf8')):null;
async function actual(id){
 const row=stage?.entries.find(row=>row.id===id);if(stage)assert.ok(row,'Missing actual staged fixture '+id);
 const file=new URL('../public/assets/geometric/'+(row?.file||'enemies/'+id+'.glb'),import.meta.url),bytes=readFileSync(file),digest=sha(bytes);if(row)assert.equal(digest,row.qa.fileSha256,'staged fixture must use actual recorded GLB bytes');
 const gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 return {actor:gltf.scene,dispose:()=>{disposeDecodedGeometricAsset(gltf);assert.equal(sha(readFileSync(file)),digest,'private corruption must leave the released GLB byte-identical');}};
}
// A real surface edit in a private decoded GLB. Rig transforms and all original
// mesh names/extras remain unchanged, including any author's certification.
function moveSurfaces(actor,nodes,worldOffset){
 actor.updateWorldMatrix(true,true);
 for(const node of nodes){const old=node.geometry,geometry=old.clone(),p=geometry.attributes.position,inverse=node.matrixWorld.clone().invert();for(let i=0;i<p.count;i++){const value=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(node.matrixWorld).add(worldOffset).applyMatrix4(inverse);p.setXYZ(i,value.x,value.y,value.z);}geometry.computeBoundingBox();geometry.computeBoundingSphere();node.geometry=geometry;old.dispose();}
}
function closeActualOpening(actor,shell,measurement){
 const ray=measurement.rays[0],direction=new THREE.Vector3().fromArray(ray.directionThreeAxes),centre=new THREE.Vector3().fromArray(ray.originM).addScaledVector(direction,ray.interiorDistanceM-.015);
 const scale=new THREE.Box3().setFromObject(actor).getSize(new THREE.Vector3()).length(),blocker=new THREE.BoxGeometry(scale,scale,.006),rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),direction),matrix=new THREE.Matrix4().compose(centre,rotation,new THREE.Vector3(1,1,1));
 const node=shell[0],inverse=node.matrixWorld.clone().invert(),original=node.geometry.toNonIndexed(),extra=blocker.toNonIndexed(),positions=[];
 for(let i=0;i<original.attributes.position.count;i++){const p=new THREE.Vector3().fromBufferAttribute(original.attributes.position,i);positions.push(...p.toArray());}
 for(let i=0;i<extra.attributes.position.count;i++){const p=new THREE.Vector3().fromBufferAttribute(extra.attributes.position,i).applyMatrix4(matrix).applyMatrix4(inverse);positions.push(...p.toArray());}
 const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeBoundingBox();geometry.computeBoundingSphere();const old=node.geometry;node.geometry=geometry;old.dispose();original.dispose();extra.dispose();blocker.dispose();
}

test('actual skeleton mouth rays reject a closed surface while all native extras stay unchanged',async()=>{
 const model=await actual('host_40');
 try{
  const {actor}=model,contract=enemyPhysicalScopeV6(actor),cavity=contract?.cavities?.find(row=>row.sourceFeature==='skull-mouth');assert.ok(cavity,'final source skeleton must expose a measured mouth');
  const shell=selected(actor,cavity.shellParts,cavity.scopeJoint,cavity.shellObjectNames),interior=selected(actor,cavity.interiorParts,cavity.scopeJoint,cavity.interiorObjectNames),before=measureActualCavityV6(shell,interior,cavity),extras=metadata(actor);
  assert.equal(before.passed,true,'actual unmodified skeleton mouth must be genuinely open');closeActualOpening(actor,shell,before);
  assert.equal(metadata(actor),extras);assert.equal(measureActualCavityV6(shell,interior,cavity).passed,false,'a physical front closure must defeat the unchanged aperture metadata');
 }finally{model.dispose();}
});

test('actual wyvern wing bone separation fails its physical interface with unchanged rig metadata',async()=>{
 const model=await actual('host_50');
 try{
  const {actor}=model,contract=enemyPhysicalScopeV6(actor);assert.ok(contract?.contacts?.length);
  const relation=contract.contacts.find(row=>[...(row.leftParts||[]),...(row.rightParts||[])].some(part=>/wing.*(?:bone|shoulder|wrist)/i.test(part)));assert.ok(relation,'final wyvern must select a real wing bone interface');
  const before=inspectEnemyAssembliesV6(actor,{id:'host_50'});assert.equal(before.failures.length,0,JSON.stringify(before.failures));
  const parts=relation.leftParts.some(part=>/wing.*(?:bone|shoulder|wrist)/i.test(part))?relation.leftParts:relation.rightParts,nodes=selected(actor,parts,relation.scopeJoint),extras=metadata(actor),size=new THREE.Box3().setFromObject(actor).getSize(new THREE.Vector3()).length();assert.ok(nodes.length);
  moveSurfaces(actor,nodes,new THREE.Vector3(size*3,0,0));assert.equal(metadata(actor),extras);
  const after=inspectEnemyAssembliesV6(actor,{id:'host_50'});assert.ok(after.failures.some(row=>row.name===(relation.name||'actual assembly surface contact')),'actual triangle gap must be rejected despite identical joint anchors and extras');
 }finally{model.dispose();}
});

test('actual lantern held piece isolation fails connectivity despite unchanged names and extras',async()=>{
 const model=await actual('host_32');
 try{
  const {actor}=model,contract=enemyPhysicalScopeV6(actor),ignored=new Set(contract?.intentionalMagicParts||[]),meshes=enemyPhysicalMeshesV6(actor),weapons=[];actor.traverse(node=>{if(!node.isMesh&&/^weapon_[LR]$/.test(node.name))weapons.push(node);});
  const options=weapons.map(weapon=>({weapon,held:meshes.filter(node=>beneath(node,weapon)&&!ignored.has(partSemanticV5(node)))})).filter(row=>new Set(row.held.map(partSemanticV5)).size>=2);assert.ok(options.length,'actual lantern needs multiple touching physical components');
  const {held}=options.find(row=>row.held.some(node=>/lantern|cage/i.test(partSemanticV5(node))))||options[0],before=actualPhysicalComponentsV6(held);assert.equal(before.passed,true,JSON.stringify(before));
  const part=partSemanticV5(held.find(node=>/lantern|cage/i.test(partSemanticV5(node)))||held[0]),nodes=held.filter(node=>partSemanticV5(node)===part),extras=metadata(actor),size=new THREE.Box3().setFromObject(actor).getSize(new THREE.Vector3()).length();
  moveSurfaces(actor,nodes,new THREE.Vector3(size*3,0,0));assert.equal(metadata(actor),extras);const after=actualPhysicalComponentsV6(held);assert.equal(after.passed,false);assert.ok(after.actualConnectedComponents.length>1);
 }finally{model.dispose();}
});

test('actual chest cage exposes a finite patch between ribs and rejects a physically sealed front',async()=>{
 const model=await actual('host_32');
 try{
  const {actor}=model,contract=enemyPhysicalScopeV6(actor),cavity=contract?.cavities?.find(row=>row.sourceFeature==='open-chest-cage');assert.ok(cavity);
  const shell=selected(actor,cavity.shellParts,cavity.scopeJoint,cavity.shellObjectNames),interior=selected(actor,cavity.interiorParts,cavity.scopeJoint,cavity.interiorObjectNames),before=measureActualCavityV6(shell,interior,cavity),extras=metadata(actor);
  assert.equal(before.passed,true);assert.equal(before.independentCageGridSearch,true);assert.ok(before.actualRecessM>=.008);assert.ok(before.measuredPatchHalfExtentM.every(value=>value>=.004));
  closeActualOpening(actor,shell,before);assert.equal(metadata(actor),extras);assert.equal(measureActualCavityV6(shell,interior,cavity).passed,false,'a sealed cage cannot pass by moving its fixed actual ray patch between ribs');
 }finally{model.dispose();}
});

test('missing bell/mask/cage/aperture declarations cannot skip independently required source findings',async()=>{
 const model=await actual('host_12');
 try{
  const contract=enemyPhysicalScopeV6(model.actor);assert.ok(contract?.contacts?.length);const empty={...contract,cavities:[]};
  for(const [id,features]of Object.entries(REQUIRED_SOURCE_APERTURES_V6)){
   const report=inspectEnemyAssembliesV6(model.actor,{id,contract:empty});
   for(const feature of features)assert.ok(report.failures.some(row=>row.name==='required source aperture '+feature+' is independently covered'),id+': '+feature);
  }
  const wrongDirection={...contract,cavities:contract.cavities.map(row=>row.sourceFeature==='bell-underside'?{...row,nativeRayDirection:[0,-1,0]}:row)};
  assert.ok(inspectEnemyAssembliesV6(model.actor,{id:'host_12',contract:wrongDirection}).failures.some(row=>row.name==='bell underside uses genuine upward rays'));
 }finally{model.dispose();}
});

test('a shallow physical recess cannot lower the independently enforced 8mm cavity minimum',()=>{
 const actor=new THREE.Group(),shell=[];for(const [x,y,w,h]of[[-.06,0,.04,.16],[.06,0,.04,.16],[0,-.06,.08,.04],[0,.06,.08,.04]]){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,.01));mesh.position.set(x,y,0);actor.add(mesh);shell.push(mesh);}
 const inside=new THREE.Mesh(new THREE.BoxGeometry(.07,.07,.001));inside.position.z=-.0015;actor.add(inside);actor.updateMatrixWorld(true);
 try{const measurement=measureActualCavityV6(shell,[inside],{minimumRecessM:.000001});assert.equal(measurement.minimumRecessM,.008);assert.equal(measurement.passed,false);assert.ok(measurement.actualRecessM<.008);}finally{actor.traverse(node=>node.geometry?.dispose());}
});

test('reviewed helmet source interval cannot be bypassed by an empty helmet scope',async()=>{
 const model=await actual('host_04');
 try{const contract=enemyPhysicalScopeV6(model.actor);assert.ok(contract?.contacts?.length);assert.ok(inspectEnemyAssembliesV6(model.actor,{id:'host_04',contract:{...contract,helmetRatios:[]}}).failures.some(row=>row.name==='independent source helmet depth scope is present'));}finally{model.dispose();}
});

test('the second actual rider cannot borrow identically named skin from the first rider',async()=>{
 const model=await actual('host_45');
 try{
  const {actor}=model,meshes=enemyPhysicalMeshesV6(actor),before=inspectActualRiderAnatomyV6(actor,meshes,{id:'host_45'}),first=before.find(row=>row.name==='mandatory actual main_rider head to thorax'),second=before.find(row=>row.name==='mandatory actual drummer_rider head to thorax');
  assert.ok(first?.passed&&second?.passed,'both actual rider heads must contact their own thorax before corruption');
  const nodes=selected(actor,['Observed face','Face'],'drummer_head_pivot'),extras=metadata(actor),size=new THREE.Box3().setFromObject(actor).getSize(new THREE.Vector3()).length();assert.ok(nodes.length);
  moveSurfaces(actor,nodes,new THREE.Vector3(size*3,0,0));assert.equal(metadata(actor),extras);
  const after=inspectActualRiderAnatomyV6(actor,meshes,{id:'host_45'});
  assert.equal(after.find(row=>row.name==='mandatory actual main_rider head to thorax').passed,true,'first rider remains physically seated');
  assert.equal(after.find(row=>row.name==='mandatory actual drummer_rider head to thorax').passed,false,'shared face semantics cannot conceal the actual second-rider gap');
  assert.ok(after.find(row=>row.name==='mandatory actual drummer_rider head to thorax').measurements.actualGapM>.004);
 }finally{model.dispose();}
});
