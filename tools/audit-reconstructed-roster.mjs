import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from '../tests/helpers/native-gltf.mjs';
import {geometricEntries} from '../game/render/geometric-assets.js';
import {prepareReconstructedDefender} from '../game/render/reconstruction-adapter.js';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {optimizeGeometricSiblings,retiredGeometricBuffers} from '../game/render/geometric-batching.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
import {geometricMetadata} from '../game/render/geometric-motion.js';
import {attackRig,attackMuzzle,previewGeometricAttack,updateGeometricPreview,resetAttack,triggerAttack,animateAttack,disposeAttack} from '../game/render/battle-animation.js';
import {scaleBattlefieldUnit,BATTLEFIELD_UNIT_SCALE} from '../game/render/battlefield-scale.js';
import {CombatEffects} from '../game/render/combat-effects.js';
import {towerStats} from '../game/core/math.js';

const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const assetRoot=resolve(project,'public/assets/geometric');
const designDefault='C:/Users/sinag/.codex/worktrees/4a36/Tower Defense game';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const runtimePaths=['game/render/reconstruction-adapter.js','game/render/defender-assets.js','game/render/battle-animation.js','game/render/geometric-batching.js','game/render/geometric-resources.js','game/render/battlefield-scale.js','game/render/combat-effects.js','game/core/math.js'];
const loadedRuntimeHashes=runtimePaths.map(file=>({file,sha256:hash(readFileSync(resolve(project,file)))}));
const json=file=>JSON.parse(readFileSync(file,'utf8'));
const finite=values=>values.every(Number.isFinite);
const within=(a,b,tolerance=1e-5)=>a.length===b.length&&a.every((value,index)=>Math.abs(value-b[index])<=tolerance);
const textureKey=texture=>texture?{name:texture.name,colorSpace:texture.colorSpace,channel:texture.channel,wrapS:texture.wrapS,wrapT:texture.wrapT,flipY:texture.flipY,offset:texture.offset.toArray(),repeat:texture.repeat.toArray(),rotation:texture.rotation}:null;
function materialKey(material){
  return hash(JSON.stringify({type:material.type,name:material.name,color:material.color?.toArray(),emissive:material.emissive?.toArray(),emissiveIntensity:material.emissiveIntensity,metalness:material.metalness,roughness:material.roughness,opacity:material.opacity,transparent:material.transparent,alphaTest:material.alphaTest,side:material.side,vertexColors:material.vertexColors,depthWrite:material.depthWrite,map:textureKey(material.map),normalMap:textureKey(material.normalMap),roughnessMap:textureKey(material.roughnessMap),metalnessMap:textureKey(material.metalnessMap)}));
}
function geometryKey(geometry){
  const digest=createHash('sha256');
  for(const [name,attribute] of Object.entries(geometry.attributes).sort(([a],[b])=>a.localeCompare(b))){digest.update(JSON.stringify([name,attribute.itemSize,attribute.normalized,attribute.array.constructor.name]));digest.update(Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));}
  if(geometry.index)digest.update(Buffer.from(geometry.index.array.buffer,geometry.index.array.byteOffset,geometry.index.array.byteLength));
  return digest.digest('hex');
}
function update(root){root.updateWorldMatrix(true,true);root.traverse(node=>{if(node.isSkinnedMesh)node.skeleton.update();});}
function resources(root){
  const result=new Set(retiredGeometricBuffers(root));
  root.traverse(node=>{if(node.geometry)result.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])if(material){result.add(material);for(const value of Object.values(material))if(value?.isTexture)result.add(value);}});
  return result;
}
function monitor(values){const counts=new Map();for(const resource of values){counts.set(resource,0);resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));}return counts;}
function physicalTransforms(root,excluded=[]){
  update(root);const entries=[];
  root.traverse(node=>{for(let current=node;current;current=current.parent)if(excluded.includes(current))return;entries.push([node.name,...node.matrixWorld.elements]);});return JSON.stringify(entries);
}
function physicalRenderState(root,excluded=[]){
  const entries=[];root.traverse(node=>{for(let current=node;current;current=current.parent)if(excluded.includes(current))return;if(node.isMesh)entries.push([node.name,node.visible,node.castShadow,node.receiveShadow,node.renderOrder,node.layers.mask,...(Array.isArray(node.material)?node.material:[node.material]).map(materialKey)]);});return JSON.stringify(entries);
}
function surface(root,{basis=null,excluded=[]}={}){
  update(root);const groups=new Map(),point=new THREE.Vector3(),normal=new THREE.Vector3(),normalPoint=new THREE.Vector3(),origin=new THREE.Vector3(),matrix=new THREE.Matrix3();let triangles=0,meshes=0;
  root.traverse(node=>{
    if(!node.isMesh)return;for(let current=node;current;current=current.parent)if(excluded.includes(current))return;
    meshes++;const geometry=node.geometry,position=geometry.attributes.position,normals=geometry.attributes.normal,index=geometry.index;
    if(!position||!normals)throw new Error(`${node.name}: missing actual position/normal`);
    const world=basis?new THREE.Matrix4().multiplyMatrices(basis,node.matrixWorld):node.matrixWorld;
    matrix.getNormalMatrix(world);const vertices=new Float64Array(position.count*6);
    for(let i=0;i<position.count;i++){
      node.getVertexPosition(i,point);normal.fromBufferAttribute(normals,i);
      if(node.isSkinnedMesh){origin.copy(point);normalPoint.fromBufferAttribute(position,i).add(normal);node.applyBoneTransform(i,normalPoint);normal.copy(normalPoint.sub(origin)).normalize();}
      point.applyMatrix4(world);normal.applyMatrix3(matrix).normalize();vertices.set([...point.toArray(),...normal.toArray()],i*6);
    }
    const count=index?.count??position.count;if(count%3)throw new Error(`${node.name}: non-triangle primitive`);triangles+=count/3;
    const materials=Array.isArray(node.material)?node.material:[node.material],ranges=Array.isArray(node.material)?geometry.groups:[{start:0,count,materialIndex:0}];
    for(const range of ranges){const key=materialKey(materials[range.materialIndex]),values=groups.get(key)||[];groups.set(key,values);for(let i=range.start;i<range.start+range.count;i++){const at=(index?index.getX(i):i)*6;for(let c=0;c<6;c++)values.push(vertices[at+c]);}}
  });
  return {groups:new Map([...groups].map(([key,values])=>[key,new Float64Array(values)])),triangles,meshes,vertices:[...groups.values()].reduce((sum,values)=>sum+values.length/6,0)};
}
function equalSurface(expected,actual){
  if(expected.triangles!==actual.triangles||expected.vertices!==actual.vertices||expected.groups.size!==actual.groups.size)return {passed:false,reason:'Physical triangle/vertex/material counts differ.'};
  let maximumError=0;
  for(const [material,points] of expected.groups){
    const current=actual.groups.get(material);if(!current||current.length!==points.length)return {passed:false,reason:'Actual PBR material assignment differs.'};
    const buckets=new Map(),quant=value=>Math.round(value*1e4),token=(x,y,z)=>`${x},${y},${z}`;
    for(let i=0;i<points.length;i+=6){const key=token(quant(points[i]),quant(points[i+1]),quant(points[i+2]));if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);}
    for(let i=0;i<current.length;i+=6){
      const xyz=[quant(current[i]),quant(current[i+1]),quant(current[i+2])];let matched=false;
      for(let dx=-1;dx<=1&&!matched;dx++)for(let dy=-1;dy<=1&&!matched;dy++)for(let dz=-1;dz<=1&&!matched;dz++){
        const key=token(xyz[0]+dx,xyz[1]+dy,xyz[2]+dz),bucket=buckets.get(key);if(!bucket)continue;
        const found=bucket.findIndex(start=>{for(let c=0;c<6;c++)if(Math.abs(points[start+c]-current[i+c])>1e-5)return false;return true;});
        if(found>=0){const start=bucket.splice(found,1)[0];for(let c=0;c<6;c++)maximumError=Math.max(maximumError,Math.abs(points[start+c]-current[i+c]));if(!bucket.length)buckets.delete(key);matched=true;}
      }
      if(!matched)return {passed:false,reason:'A physical world vertex or normal has no original material-matched counterpart.',maximumError};
    }
    if(buckets.size)return {passed:false,reason:'Original physical vertices lost.',maximumError};
  }
  return {passed:true,maximumError,positionNormalTolerance:1e-5};
}
export {surface as captureReconstructionSurface,equalSurface as compareReconstructionSurfaces};
function poseBounds(actor){
  update(actor);const box=new THREE.Box3().setFromObject(actor,true),size=box.getSize(new THREE.Vector3());return {min:box.min.toArray(),max:box.max.toArray(),size:size.toArray(),finite:finite([...box.min.toArray(),...box.max.toArray()])&&size.x>0&&size.y>0&&size.z>0};
}
function finiteTransforms(root){update(root);let valid=true;root.traverse(node=>{if(!finite(node.matrixWorld.elements))valid=false;});return valid;}
function physicalSamples(root,excluded=[]){
  update(root);const samples=[];
  root.traverse(node=>{
    if(!node.isMesh)return;for(let parent=node;parent;parent=parent.parent)if(excluded.includes(parent))return;
    const count=node.geometry.attributes.position.count;
    for(const index of new Set([0,Math.floor(count/2),count-1])){const point=node.getVertexPosition(index,new THREE.Vector3()).applyMatrix4(node.matrixWorld);samples.push({node,index,point});}
  });return samples;
}
function stringBoundToActualEndpoints(rig){
  if(!rig.string)return false;update(rig.actor);const line=rig.string.object,position=line.geometry.attributes.position;
  return [[0,rig.string.top],[2,rig.string.bottom],[1,rig.string.nock],[3,rig.string.nock]].every(([index,node])=>!!node&&new THREE.Vector3().fromBufferAttribute(position,index).applyMatrix4(line.matrixWorld).distanceTo(node.getWorldPosition(new THREE.Vector3()))<1e-5);
}
function skinState(root){const skins=[];root.traverse(node=>{if(node.isSkinnedMesh)skins.push({node,skeleton:node.skeleton,bones:node.skeleton.bones});});return skins;}
function sourceFile(entry,designRoot){return resolve(designRoot,'output/design',entry.reconstruction.revision==='basic-defenders-v7'?'basic-defenders-reconstruction-v7/models':'champions-reconstruction-v8/refined/models',entry.id+'.glb');}
function jsonChunk(bytes){const length=bytes.readUInt32LE(12);return JSON.parse(bytes.subarray(20,20+length).toString('utf8'));}

export function currentReconstructionEntry(id){
  return ['defenders','champions'].flatMap(kind=>geometricEntries(json(resolve(assetRoot,`geometric-${kind}.json`)))).find(entry=>entry.id===id&&entry.reconstruction);
}
const currentAudits=new Map();
export async function auditCurrentReconstructionIds(ids){
  const entries=ids.map(currentReconstructionEntry);if(entries.some(entry=>!entry))return null;
  return Promise.all(entries.map(entry=>{if(!currentAudits.has(entry.id))currentAudits.set(entry.id,auditReconstructedEntry(entry));return currentAudits.get(entry.id);}));
}

export async function auditReconstructedEntry(entry,{designRoot=existsSync(designDefault)?designDefault:null}={}){
  const started=performance.now(),checks=[],check=(name,pass,detail=null)=>checks.push({name,passed:!!pass,...(detail===null?{}:{detail})});
  const file=resolve(assetRoot,entry.file),bytes=readFileSync(file),raw=jsonChunk(bytes),sha256=hash(bytes),data={towers:json(resolve(project,'data/towers.json')),balance:json(resolve(project,'data/balance.json'))},familyStats=data.towers[entry.family],stats=familyStats?towerStats({family:entry.family,tier:entry.tier},data):null,dataBefore=JSON.stringify(data);
  let decoded,actor,peer,rig,result;
  try{
    check('Mapped runtime family exists and exact approved export hash matches',!!stats&&sha256===entry.assetSha256&&sha256===entry.reconstruction.sourceGlbSha256,{sha256});
    if(designRoot){const original=sourceFile(entry,designRoot);check('Delivered GLB equals independently read approved source bytes',existsSync(original)&&hash(readFileSync(original))===sha256,{file:original});}
    if(designRoot){
      const native=resolve(designRoot,entry.reconstruction.sourceNativeFile),reference=entry.reconstruction.approvedAuthoringReference,referenceFile=reference.path?resolve(designRoot,reference.path):resolve(designRoot,entry.reconstruction.sourceDelivery,reference.file);
      check('Native master provenance equals independently read approved Blender bytes',existsSync(native)&&hash(readFileSync(native))===entry.reconstruction.sourceNativeSha256,{file:native});
      check('Current authoring reference equals independently read original approved concept bytes',existsSync(referenceFile)&&hash(readFileSync(referenceFile))===reference.sha256,{file:referenceFile});
    }
    decoded=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    const source=decoded.scene;source.animations=[...decoded.animations];
    const beforeGeometry=new Map(),beforeMaterials=new Map();source.traverse(node=>{if(node.geometry)beforeGeometry.set(node.geometry,geometryKey(node.geometry));for(const material of Array.isArray(node.material)?node.material:[node.material])if(material)beforeMaterials.set(material,materialKey(material));});
    const sourceSkins=skinState(source),presentationScale=entry.reconstruction.presentationScale||1,basis=new THREE.Matrix4().makeRotationY(entry.reconstruction.revision==='champions-v8'?Math.PI:0).scale(new THREE.Vector3().setScalar(presentationScale));
    check('Declared presentation adjustment is an explicit uniform approved whole-model factor',[1,1.6].includes(presentationScale)&&(entry.reconstruction.revision!=='basic-defenders-v7'||presentationScale===1),{presentationScale});
    check('Raw approval has its actual native skin/static structure without hidden loader adaptation',entry.reconstruction.revision==='basic-defenders-v7'?sourceSkins.length>0&&sourceSkins.every(s=>s.bones.length===20):sourceSkins.length===0&&!(raw.animations?.length),{skins:sourceSkins.length,boneCounts:sourceSkins.map(s=>s.bones.length),exportedClips:decoded.animations.map(c=>c.name)});
    const original=surface(source,{basis});
    const rawBounds=poseBounds(source),authoredSize=entry.metrics.boundsSize;
    check('Actual raw triangles and source-space axis-converted bounds match the delivered manifest',original.triangles===entry.metrics.triangles&&rawBounds.finite&&within(rawBounds.size,[authoredSize[0],authoredSize[2],authoredSize[1]]),{triangles:original.triangles,rawBounds,authoredSize});
    check('Explicit reconstruction adapter returns the decoded scene',prepareReconstructedDefender(source,entry)===source);
    const meta=geometricMetadata(source),adapted=surface(source),restAgreement=equalSurface(original,adapted);
    check('Every approved rest vertex/normal and PBR assignment survives the declared whole-model basis',restAgreement.passed,restAgreement);
    check('Runtime metadata identifies this exact family/tier/reconstruction',!!meta&&meta.family===entry.family&&meta.tier===entry.tier&&meta.reconstructionRevision===entry.reconstruction.revision,{metadata:meta?{family:meta.family,tier:meta.tier,reconstructionRevision:meta.reconstructionRevision,attackStyle:meta.attackStyle}:null});
    const preparedPose=physicalTransforms(source);prepareReconstructedDefender(source,entry);check('Adapter is idempotent without extra transforms',physicalTransforms(source)===preparedPose);
    check('Actual exported animation clips stay available after adaptation',source.animations.length===decoded.animations.length&&source.animations.every((clip,index)=>clip===decoded.animations[index]));
    const batching=optimizeGeometricSiblings(source,{animations:decoded.animations}),batchedAgreement=equalSurface(adapted,surface(source));
    check('Production sibling batching preserves all approved world surfaces and materials',batchedAgreement.passed,batchedAgreement);
    check('Batching never increases render submissions',batching.after<=batching.before,batching);
    const cachePose=physicalTransforms(source),sharedMonitor=monitor(resources(source));
    actor=cloneDefenderTemplate(source);peer=cloneDefenderTemplate(source);const peerPose=physicalTransforms(peer);
    check('Clones preserve available exported clips',actor.animations.length===decoded.animations.length&&peer.animations.length===decoded.animations.length);
    const actorSkins=skinState(actor),peerSkins=skinState(peer);
    check('Every remaining skin has private bones/skeletons per actor',actorSkins.every(s=>!sourceSkins.some(t=>t.skeleton===s.skeleton)&&!peerSkins.some(t=>t.skeleton===s.skeleton)&&s.bones.every(b=>!peerSkins.some(t=>t.bones.includes(b)))));
    const privateTextures=[];for(const skeleton of new Set([...actorSkins,...peerSkins].map(skin=>skin.skeleton))){skeleton.computeBoneTexture();privateTextures.push(skeleton.boneTexture);}const privateMonitor=monitor(privateTextures);
    const nativeBounds=poseBounds(actor),unscaled=actor.scale.clone();scaleBattlefieldUnit(actor);const scaled=actor.scale.clone();scaleBattlefieldUnit(actor);check('Game scale applies once and preserves native per-model/rank proportions',within(scaled.toArray(),unscaled.multiplyScalar(BATTLEFIELD_UNIT_SCALE).toArray())&&within(actor.scale.toArray(),scaled.toArray()));
    const fieldBounds=poseBounds(actor);check('Actual runtime bounds remain finite under the current game scale',nativeBounds.finite&&fieldBounds.finite&&within(fieldBounds.size,nativeBounds.size.map(value=>value*BATTLEFIELD_UNIT_SCALE)),{nativeBounds,fieldBounds});
    rig=attackRig(actor,entry.family,stats);check('Actual runtime actor exposes attack joints rather than a whole-figure fallback',!!rig?.geometric&&rig.pivots.length>0,{jointNames:rig?.pivots.map(p=>p.name),style:rig?.attackStyle});
    if(rig.attackStyle==='bow')check('Real source bows expose physical string endpoints and preserve native strings at authored rest',!!rig.string&&rig.authoredStrings.length>0&&rig.authoredStrings.every(record=>record.node.isMesh&&record.node.visible===record.visible)&&rig.string.object.visible===false);
    const rest=physicalTransforms(actor,rig.owned),restRender=physicalRenderState(actor,rig.owned),rootPosition=actor.position.clone(),rootScale=actor.scale.clone(),statsBefore=JSON.stringify(stats),muzzleRest=attackMuzzle(rig),samplesRest=physicalSamples(actor,rig.owned),poses=[];let maximumMuzzleTravel=0,maximumPhysicalTravel=0,maximumExtent=0;
    check('Current attack has a finite physical endpoint',!!muzzleRest&&finite(muzzleRest.toArray()),muzzleRest?.toArray());
    previewGeometricAttack(rig,{duration:1});let releases=0,releaseBounds;
    for(const delta of [.10,.14,.18,.08,.14,.18,.18]){
      updateGeometricPreview(rig,delta,{onRelease:()=>{releases++;releaseBounds=poseBounds(actor);}});
      const bound=poseBounds(actor),muzzle=attackMuzzle(rig);maximumExtent=Math.max(maximumExtent,...bound.size);if(muzzle&&muzzleRest)maximumMuzzleTravel=Math.max(maximumMuzzleTravel,muzzle.distanceTo(muzzleRest));
      for(const sample of samplesRest)maximumPhysicalTravel=Math.max(maximumPhysicalTravel,sample.node.getVertexPosition(sample.index,new THREE.Vector3()).applyMatrix4(sample.node.matrixWorld).distanceTo(sample.point));
      if(rig.string){check('Actual animated string vertices meet the current physical tips and source nock',stringBoundToActualEndpoints(rig));const active=rig.string.draw>1e-5;check('Source and actor-owned strings switch visibly at draw without doubling the rendered string',rig.string.object.visible===active&&rig.authoredStrings.every(record=>record.node.visible===(active?false:record.visible)));}
      const paused=physicalTransforms(actor,rig.owned),elapsed=rig.elapsed;updateGeometricPreview(rig,0);check('Zero elapsed preview time freezes the exact current authored pose',physicalTransforms(actor,rig.owned)===paused&&rig.elapsed===elapsed);
      check('Actual sampled attack matrices, bounds and endpoint are finite',bound.finite&&!!muzzle&&finite(muzzle.toArray())&&within(actor.position.toArray(),rootPosition.toArray())&&within(actor.scale.toArray(),rootScale.toArray()));
      poses.push({progress:rig.duration?rig.elapsed/rig.duration:0,bounds:bound,muzzle:muzzle?.toArray()});
    }
    check('Preview releases once at the actual attack event',releases===1&&releaseBounds?.finite,{releases});
    check('Physical endpoint actually moves during attack',maximumMuzzleTravel>1e-5,{maximumMuzzleTravel});
    check('Actual approved physical mesh vertices move, independently of endpoint marker motion',maximumPhysicalTravel>1e-5,{sampledVertices:samplesRest.length,maximumPhysicalTravel});
    check('Conservative attack has bounded size without transform explosions',maximumExtent<Math.max(...fieldBounds.size)*3+.2,{maximumExtent,restExtent:Math.max(...fieldBounds.size)});
    resetAttack(rig);check('Attack reset restores exact authored runtime rest and physical visibility/PBR state',physicalTransforms(actor,rig.owned)===rest&&physicalRenderState(actor,rig.owned)===restRender);
    previewGeometricAttack(rig,{duration:1});updateGeometricPreview(rig,.42,{reducedMotion:true});check('Reduced motion preserves authored physical rest',physicalTransforms(actor,rig.owned)===rest);resetAttack(rig);
    triggerAttack(rig,{combatTime:1,stats});const releasedPose=physicalTransforms(actor,rig.owned),elapsed=rig.elapsed;triggerAttack(rig,{combatTime:1,stats});check('Duplicate combat event does not restart/repose the same release',rig.elapsed===elapsed&&physicalTransforms(actor,rig.owned)===releasedPose);animateAttack(rig,.03,0,{stamp:2});resetAttack(rig);
    const rootQuaternion=actor.quaternion.clone();
    for(const aim of [0,.6,1.7,3.1]){
      actor.position.set(3,.6,8);actor.rotation.y=aim;triggerAttack(rig,{combatTime:aim+10,stats});
      const scene=new THREE.Scene(),fx=new CombatEffects(scene,{getMuzzle:(_source,out,options)=>attackMuzzle(rig,out,options)}),shot={id:1,source:{id:9,family:entry.family,tier:entry.tier,x:3,z:8},target:{id:2,x:3-Math.sin(aim)*3,z:8-Math.cos(aim)*3},stats,progress:0,duration:.35,start:{x:3,z:8}},packet=JSON.stringify(shot);
      try{
        fx.event('shot',shot);const record=fx.projectiles.get(1),muzzle=attackMuzzle(rig);
        check('World aim '+aim+' binds the real projectile release to the moving physical endpoint',!!record&&!!muzzle&&record.origin.distanceTo(muzzle)<1e-8);
        for(const progress of [0,.25,.6,1]){shot.progress=progress;fx.syncProjectiles([shot],progress);fx.update(0,progress);check('World aim '+aim+' projectile phase '+progress+' has finite actual scene transforms',finiteTransforms(scene));}
        shot.progress=0;check('World aim '+aim+' preserves gameplay packet and actor aim/scale',JSON.stringify(shot)===packet&&actor.rotation.y===aim&&within(actor.position.toArray(),[3,.6,8])&&within(actor.scale.toArray(),rootScale.toArray()));
        fx.syncProjectiles([],2);fx.update(2,2);check('World aim '+aim+' expires all owned projectile/effect objects',fx.projectiles.size===0&&fx.effects.length===0&&scene.children.length===0);
      }finally{fx.dispose();fx.dispose();resetAttack(rig);}
    }
    actor.position.copy(rootPosition);actor.quaternion.copy(rootQuaternion);update(actor);
    check('Cached template and independent peer never move during actor actions',physicalTransforms(source)===cachePose&&physicalTransforms(peer)===peerPose);
    check('Original vertex/index/UV/color/skin buffers and native PBR factors remain immutable',[...beforeGeometry].every(([g,key])=>geometryKey(g)===key)&&[...beforeMaterials].every(([m,key])=>materialKey(m)===key));
    check('Authoritative tier-specific gameplay stats and underlying balance data are unchanged by visual attacks',JSON.stringify(stats)===statsBefore&&JSON.stringify(data)===dataBefore);
    const owned=monitor(new Set(rig.owned.flatMap(object=>[...resources(object)])));disposeAttack(rig);disposeAttack(rig);disposeDefenderInstance(actor);disposeDefenderInstance(actor);disposeDefenderInstance(peer);disposeDefenderInstance(peer);
    check('Actor cleanup releases each private owned/bone resource once',[...owned.values(),...privateMonitor.values()].every(count=>count===1),{ownedResources:owned.size,privateBoneTextures:privateMonitor.size});
    check('Actor cleanup keeps every shared template resource alive',[...sharedMonitor.values()].every(count=>count===0));
    disposeDecodedGeometricAsset(decoded);disposeDecodedGeometricAsset(decoded);check('Final cache cleanup releases every shared resource exactly once',[...sharedMonitor.values()].every(count=>count===1),{sharedResources:sharedMonitor.size});
    check('Raw delivered approved GLB bytes are unchanged by this audit',hash(readFileSync(file))===sha256);
    result={id:entry.id,family:entry.family,tier:entry.tier,reconstruction:entry.reconstruction.revision,assetSha256:sha256,assetBytes:bytes.length,presentationScale,productionStats:{damage:stats.damage,interval:stats.interval,range:stats.range,type:stats.type,effectKind:rig.kind},nativeSkins:sourceSkins.length,decodedAnimations:decoded.animations.map(clip=>({name:clip.name,duration:clip.duration,tracks:clip.tracks.length})),physicalMeshes:adapted.meshes,triangles:adapted.triangles,batching,nativeBounds,fieldBounds,maximumMuzzleTravel,maximumPhysicalTravel,poses,checks};
  }catch(error){check('Audit completes without loader/adapter/runtime exception',false,{error:String(error),stack:error.stack});result={id:entry.id,assetSha256:sha256,checks};}
  finally{disposeAttack(rig);disposeDefenderInstance(actor);disposeDefenderInstance(peer);if(decoded)disposeDecodedGeometricAsset(decoded);}
  result.durationMs=performance.now()-started;result.failures=checks.filter(record=>!record.passed);return result;
}

export async function auditReconstructedRoster({ids=null,designRoot=existsSync(designDefault)?designDefault:null,output=resolve(project,'output/design/defenders-voices-v19/independent-runtime-audit.json'),quiet=false}={}){
  const started=performance.now(),manifests=['defenders','champions'].map(kind=>({kind,file:resolve(assetRoot,`geometric-${kind}.json`)}));
  const manifestHashes=manifests.map(({file})=>({file:relative(project,file).replaceAll('\\','/'),sha256:hash(readFileSync(file))}));
  const entries=manifests.flatMap(({file})=>geometricEntries(json(file))),keys=entries.map(entry=>`${entry.family}:${entry.tier}`);
  if(entries.length!==86||new Set(keys).size!==86||entries.filter(e=>e.reconstruction?.revision==='basic-defenders-v7').length!==48||entries.filter(e=>e.reconstruction?.revision==='champions-v8').length!==38)throw new Error('Candidate requires exactly 48 approved basic ranks plus 38 approved champions, with unique mapped family/tier IDs.');
  if(ids?.some(id=>!entries.some(entry=>entry.id===id)))throw new Error('Unknown requested reconstruction ID: '+ids.filter(id=>!entries.some(entry=>entry.id===id)).join(', '));
  const selected=ids?entries.filter(entry=>ids.includes(entry.id)):entries,results=[];
  for(const entry of selected){results.push(await auditReconstructedEntry(entry,{designRoot}));if(!quiet)console.log(JSON.stringify({id:entry.id,failures:results.at(-1).failures.map(check=>check.name),durationMs:Math.round(results.at(-1).durationMs)}));}
  const snapshotChanges=[...manifestHashes,...loadedRuntimeHashes].filter(({file,sha256})=>hash(readFileSync(resolve(project,file)))!==sha256).map(({file})=>file);
  const report={revision:'independent-approved-roster-v19',createdAt:new Date().toISOString(),scope:'Actual delivered approved GLB bytes, unmodified Three.js raw decoding, explicit production reconstruction adaptation, full material-matched rest world vertices/normals, batching, actual attack phases, event/pause/reduced-motion behavior, instance isolation and resource lifecycle.',limitations:['Node texture decoding validates embedded PNG bindings, not shaded pixels; browser visual/color review remains separate.','Finite sampled poses and shared buffer checks do not certify every inter-part intersection or all possible gameplay situations.','Absolute reconstruction scales are preserved; no per-model rescaling or new anatomical accuracy guarantee is introduced.'],approvedSourceRoot:designRoot,models:results.length,checks:results.reduce((sum,result)=>sum+result.checks.length,0),failures:results.reduce((sum,result)=>sum+result.failures.length,0)+snapshotChanges.length,runtimeSnapshot:{unchanged:snapshotChanges.length===0,changedFiles:snapshotChanges},durationMs:performance.now()-started,peakRssBytes:process.resourceUsage().maxRSS*1024,manifests:manifestHashes,runtimeModules:loadedRuntimeHashes,workload:{assetBytes:results.reduce((sum,r)=>sum+(r.assetBytes||0),0),triangles:results.reduce((sum,r)=>sum+(r.triangles||0),0),submissionsBeforeBatch:results.reduce((sum,r)=>sum+(r.batching?.before||0),0),submissionsAfterBatch:results.reduce((sum,r)=>sum+(r.batching?.after||0),0)},results};
  if(output){mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2));}
  if(!quiet)console.log(JSON.stringify({models:report.models,checks:report.checks,failures:report.failures,durationMs:Math.round(report.durationMs),peakRssBytes:report.peakRssBytes,output}));return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const idsIndex=process.argv.indexOf('--ids'),outputIndex=process.argv.indexOf('--output');
  const report=await auditReconstructedRoster({ids:idsIndex>=0?process.argv[idsIndex+1].split(','):null,output:outputIndex>=0?resolve(process.argv[outputIndex+1]):undefined});if(report.failures)process.exitCode=1;
}
