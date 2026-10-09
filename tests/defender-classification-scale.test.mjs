import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {geometricEntries} from '../game/render/geometric-assets.js';
import {prepareReconstructedDefender} from '../game/render/reconstruction-adapter.js';
import {geometricMetadata} from '../game/render/geometric-motion.js';
import {optimizeGeometricSiblings} from '../game/render/geometric-batching.js';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
import {DEFENDER_CLASSIFICATION_SCALE_STEP,defenderClassificationMultiplier,defenderPresentationMultiplier,applyDefenderClassificationScale} from '../game/render/defender-classification-scale.js';
import {championClassification,CLASSIFICATION_LEVELS} from '../game/render/champion-classification.js';
import {CHAMPION_AURA_COLORS,CHAMPION_AURA_STYLE,SECRET_CHAMPION_AURA_STYLE,DIVINE_CHAMPION_AURA_STYLE,createChampionAura,disposeChampionAura} from '../game/render/champion-aura.js';
import {BATTLEFIELD_UNIT_SCALE,BATTLEFIELD_BOSS_MULTIPLIER,scaleBattlefieldUnit,animateBattlefieldIdleScale} from '../game/render/battlefield-scale.js';
import {WALL_DECK_HEIGHT,WALL_REFERENCE_ENEMY_NATIVE_HEIGHT,castleWallModel} from '../game/render/walls.js';
import {attackRig,attackMuzzle,previewGeometricAttack,updateGeometricPreview,resetAttack,disposeAttack} from '../game/render/battle-animation.js';
import {CombatEffects} from '../game/render/combat-effects.js';
import {towerStats} from '../game/core/math.js';
import {disposeRankAdornment} from '../game/render/ranks.js';

// Match Vite's read-only JSON module handling, without replacing production
// geometry, scale helpers or Battlefield methods with test implementations.
const jsonHooks=registerHooks({load(url,context,nextLoad){
  if(url.startsWith('file:')&&url.endsWith('.json'))return {format:'module',source:`export default JSON.parse(${JSON.stringify(readFileSync(new URL(url),'utf8'))});`,shortCircuit:true};
  return nextLoad(url,context);
}});
const {Battlefield}=await import('../game/render/world.js');jsonHooks.deregister();

const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const assets=resolve(project,'public/assets/geometric');
const readJson=file=>JSON.parse(readFileSync(file,'utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
const data={towers:readJson(resolve(project,'data/towers.json')),balance:readJson(resolve(project,'data/balance.json')),enemies:{}};
const dataBefore=JSON.stringify(data);
const manifestFiles=['geometric-defenders.json','geometric-champions.json'];
const entries=manifestFiles.flatMap(file=>geometricEntries(readJson(resolve(assets,file))));
const snapshots=[...manifestFiles.map(file=>'public/assets/geometric/'+file),'game/render/defender-classification-scale.js','game/render/champion-classification.js','game/render/champion-aura.js','game/render/reconstruction-adapter.js','game/render/defender-assets.js','game/render/battlefield-scale.js','game/render/battle-animation.js','game/render/world.js','game/archer-preview.js','game/render/walls.js'].map(file=>({file,sha256:hash(readFileSync(resolve(project,file)))}));
const started=performance.now();
const report={revision:'independent-classification-scale-v20',createdAt:new Date().toISOString(),scope:'All 48 real approved V7 basic exports and 38 V8 champion exports: explicit production adaptation/batching, actual Battlefield.sync, every source vertex/normal, classification transforms, physical attack samples and release endpoints, clone/cache isolation, unchanged wall geometry and ordinary/boss enemy scales.',classes:[['Basic',1],['Intermediate',1.1],['Advanced',1.21],['TOP',1.331],['Secret',1.4641]],models:[],checks:[],runtimeSnapshot:snapshots,limitations:['Uniform factors are relative to each approved model and its existing presentation scale; unequal native models are not forced to have equal class heights.','Node geometry checks validate actual buffers and transforms; they do not measure shaded appearance, browser frame rate or certify every possible collision.','Atelier behavior uses its actual shared preparation/scale/attack path; its DOM/WebGL interface is covered separately by the release browser check.']};
function check(value,name,detail=null){report.checks.push({name,passed:!!value,...(detail===null?{}:{detail})});assert.ok(value,name+(detail===null?'':' '+JSON.stringify(detail)));}
const close=(a,b,tolerance=1e-8)=>Math.abs(a-b)<=tolerance;
const arraysClose=(a,b,tolerance=1e-8)=>a.length===b.length&&a.every((value,i)=>close(value,b[i],tolerance));
function update(root){root.updateWorldMatrix(true,true);root.traverse(node=>{if(node.isSkinnedMesh)node.skeleton.update();});}
function transforms(root,excluded=[]){update(root);const values=[];root.traverse(node=>{for(let parent=node;parent;parent=parent.parent)if(excluded.includes(parent))return;values.push([node.name,...node.matrix.elements]);});return JSON.stringify(values);}
function physicalMeshes(root,geometries=null){const nodes=[];root.traverse(node=>{if(node.isMesh&&(!geometries||geometries.has(node.geometry)))nodes.push(node);});return nodes;}
function capture(root,geometries,{samples=false}={}){
  update(root);const inverse=root.matrixWorld.clone().invert(),nodes=physicalMeshes(root,geometries),records=[],box=new THREE.Box3();let count=0;
  for(const node of nodes){
    const position=node.geometry.attributes.position,normal=node.geometry.attributes.normal,matrix=inverse.clone().multiply(node.matrixWorld),normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix),indices=samples?[...new Set([0,Math.floor(position.count/2),position.count-1])]:Array.from({length:position.count},(_,i)=>i),values=new Float64Array(indices.length*6),worlds=new Float64Array(indices.length*3);
    for(let i=0;i<indices.length;i++){
      const index=indices[i],point=node.getVertexPosition(index,new THREE.Vector3()),world=point.clone().applyMatrix4(node.matrixWorld),direction=new THREE.Vector3().fromBufferAttribute(normal,index).applyMatrix3(normalMatrix).normalize();
      box.expandByPoint(world);point.applyMatrix4(matrix);values.set([...point.toArray(),...direction.toArray()],i*6);worlds.set(world.toArray(),i*3);
    }
    count+=indices.length;records.push({name:node.name,geometry:node.geometry,material:node.material,values,worlds});
  }
  return {records,count,box};
}
function agreement(a,b){
  if(a.records.length!==b.records.length||a.count!==b.count)return {passed:false,maximumError:Infinity};let maximumError=0;
  for(let i=0;i<a.records.length;i++){
    const left=a.records[i],right=b.records[i];
    if(left.name!==right.name||left.geometry!==right.geometry||left.material!==right.material||left.values.length!==right.values.length)return {passed:false,maximumError:Infinity};
    for(let n=0;n<left.values.length;n++)maximumError=Math.max(maximumError,Math.abs(left.values[n]-right.values[n]));
  }
  return {passed:maximumError<1e-5,maximumError};
}
async function decode(entry){const bytes=readFileSync(resolve(assets,entry.file));return {bytes,decoded:await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')};}
function fieldFor(source,entry,state='active'){
  const tower={id:17,family:entry.family,tier:entry.tier,state,x:7,z:9,upgrades:0};
  const field=Object.create(Battlefield.prototype),noop=()=>{};
  Object.assign(field,{game:{towers:[tower],data,grid:{revision:1,route:[],checkpoints:[]},round:1,phase:'select',selection:null,enemySelection:null},scene:new THREE.Scene(),models:new Map(),enemies:new Map(),templates:new Map(),imported:new Map([[`${entry.family}:${entry.tier}`,source]]),updateCampPreview:noop,draftMarkers:{sync:noop},commandMoveEffects:{sync:noop},reservedDefenderEffects:{sync:noop},supportEffects:{sync:noop},selectionRing:{},enemySelectionRing:{},range:{},grid:{},pathGroup:{},maze:{editing:false,sync:noop},ghost:{},rangeGroup:{},rebuildPath:noop,showRanges:false});
  return {field,tower};
}
function syncField(field){
  // Only the rank-VI cosmetic CanvasTexture needs a 2D canvas in this Node
  // test. Restore document before every real GLB decode; no loader is patched.
  const original=globalThis.document;
  if(!original)globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
  try{field.sync();}finally{if(original)globalThis.document=original;else delete globalThis.document;}
}
function auraState(aura){
  if(!aura)return null;const result=[];aura.traverse(node=>{if(node.geometry)result.push([node.name,hash(Buffer.from(node.geometry.attributes.position.array.buffer)),node.material?.color?.getHexString(),node.material?.uniforms?.tint?.value?.getHexString()]);});
  return {classification:aura.userData.classification,level:aura.userData.level,color:aura.userData.color,tier:{...aura.userData.tier},parts:result};
}
function boundsRecord(box){return {min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new THREE.Vector3()).toArray()};}
function finiteBounds(box){return [...box.min.toArray(),...box.max.toArray()].every(Number.isFinite)&&box.getSize(new THREE.Vector3()).toArray().every(value=>value>0);}

test('classification factors have five exact geometric steps, independent of ordinary equipment ranks',()=>{
  check(DEFENDER_CLASSIFICATION_SCALE_STEP===1.1,'Exactly 1.1 per adjacent champion classification');
  const examples=[['rimewatch','Basic',1],['frostblade','Intermediate',1.1],['highking','Advanced',1.21],['mothernature','TOP',1.331],['ladyclaire','Secret',1.4641]];
  for(let i=0;i<examples.length;i++){const [family,classification,factor]=examples[i];check(championClassification(family)===classification&&close(defenderClassificationMultiplier(family),factor),'Known approved class '+classification,{family,factor});if(i)check(close(defenderClassificationMultiplier(family)/defenderClassificationMultiplier(examples[i-1][0]),1.1),'Adjacent class ratio '+classification);}
  check(entries.length===86&&entries.filter(e=>e.reconstruction.revision==='basic-defenders-v7').length===48&&entries.filter(e=>e.reconstruction.revision==='champions-v8').length===38,'Complete 48 + 38 approved model roster');
  for(const family of ['soldier','archer','druid','mage','cleric','runebreaker','frostwarden','stormcaller',undefined,null,'unknown','toString','constructor','__proto__'])check(defenderClassificationMultiplier(family)===1,'Unclassified family retains factor one: '+String(family));
});

test('all 86 actual battlefield clones preserve source shapes, class auras, rank sizes and scaled attack geometry',async()=>{
  const observedClasses=new Set();
  for(const entry of entries){
    const {bytes,decoded}=await decode(entry),source=decoded.scene;source.animations=[...decoded.animations];let value,baseline,baselineRig,comparisonAura;
    const item={id:entry.id,family:entry.family,tier:entry.tier,classification:championClassification(entry.family),multiplier:defenderClassificationMultiplier(entry.family)*defenderPresentationMultiplier(entry.family),presentationScale:entry.reconstruction.presentationScale,assetSha256:hash(bytes)};
    const label=entry.id+': ';
    try{
      check(item.assetSha256===entry.assetSha256&&item.assetSha256===entry.reconstruction.sourceGlbSha256,label+'exact approved GLB bytes');
      prepareReconstructedDefender(source,entry);optimizeGeometricSiblings(source,{animations:decoded.animations});
      const geometries=new Set(physicalMeshes(source).map(node=>node.geometry)),rest=capture(source,geometries),sourcePose=transforms(source),sourceMeta=JSON.stringify(geometricMetadata(source));
      item.vertexCount=rest.count;item.nativeBounds=boundsRecord(rest.box);check(rest.count>0&&finiteBounds(rest.box),label+'real complete physical geometry');
      const {field,tower}=fieldFor(source,entry);syncField(field);value=field.models.get(tower.id);const actor=value.actor;
      check(value.object.parent===field.scene&&actor.parent===value.object,label+'actual Battlefield.sync owns its private scene instance');
      check(arraysClose(actor.scale.toArray(),source.scale.toArray().map(v=>v*item.multiplier*BATTLEFIELD_UNIT_SCALE)),label+'classification is composed before battlefield scale');
      check(actor.position.y===WALL_DECK_HEIGHT&&actor.rotation.y===Math.PI,label+'wall height and authored battlefield facing preserved');
      check(JSON.stringify(geometricMetadata(actor))===sourceMeta,label+'original source and presentation metadata preserved');
      const physical=capture(actor,geometries),match=agreement(rest,physical);item.restAgreement=match;item.battlefieldBounds=boundsRecord(physical.box);
      check(match.passed,label+'every source vertex, normal, geometry and material survives the outer classification transform',match);
      const expectedSize=rest.box.getSize(new THREE.Vector3()).multiplyScalar(item.multiplier*BATTLEFIELD_UNIT_SCALE);
      check(arraysClose(physical.box.getSize(new THREE.Vector3()).toArray(),expectedSize.toArray(),1e-5),label+'actual XYZ bounds follow the uniform class factor');
      if(item.classification)observedClasses.add(item.classification);else check(item.multiplier===1,label+'ordinary equipment rank changes no class scale');
      comparisonAura=createChampionAura(entry.family,{phase:tower.id*1.7});check(JSON.stringify(auraState(value.aura))===JSON.stringify(auraState(comparisonAura)),label+'classification aura retains actual geometry, colors and original style');
      if(value.aura){const expectedStyle=entry.family==='archangel'?DIVINE_CHAMPION_AURA_STYLE:item.classification==='Secret'?SECRET_CHAMPION_AURA_STYLE:CHAMPION_AURA_STYLE;check(value.aura.userData.tier===expectedStyle&&value.aura.userData.color===(entry.family==='archangel'?'#ffe5a3':CHAMPION_AURA_COLORS[item.classification]),label+'existing class/divine aura hierarchy preserved');}
      const downstream=actor.scale.clone();applyDefenderClassificationScale(actor,entry.family);scaleBattlefieldUnit(actor);check(arraysClose(actor.scale.toArray(),downstream.toArray()),label+'same class and battlefield repeat is idempotent');
      animateBattlefieldIdleScale(actor,.031);const idleScale=actor.scale.clone();applyDefenderClassificationScale(actor,entry.family);check(arraysClose(actor.scale.toArray(),idleScale.toArray()),label+'same class repeat preserves an in-progress idle stretch');animateBattlefieldIdleScale(actor,0);
      check(arraysClose(actor.scale.toArray(),downstream.toArray()),label+'idle returns to the classified battlefield base');
      const worldCount=field.scene.children.length;syncField(field);check(field.models.get(tower.id).actor===actor&&field.scene.children.length===worldCount,label+'real world sync retains the same actor without accumulating scale');
      const platform=value.object.children.find(child=>child!==actor),platformBefore=new THREE.Box3().setFromObject(platform,true);check(platform.scale.equals(new THREE.Vector3(1,1,1)),label+'real masonry foundation remains unscaled');
      baseline=cloneDefenderTemplate(source);scaleBattlefieldUnit(baseline);baseline.rotation.copy(actor.rotation);baseline.position.copy(actor.position);const baselineParent=new THREE.Group();baselineParent.position.copy(value.object.position);baselineParent.add(baseline);baselineRig=attackRig(baseline,entry.family,towerStats(tower,data));
      const rig=value.attack,origin=actor.getWorldPosition(new THREE.Vector3());check(!!rig?.geometric&&!!baselineRig?.geometric,label+'actual approved joints drive both attacks');
      const restSamples=capture(actor,geometries,{samples:true}),restMuzzle=attackMuzzle(rig);let maxEndpointError=0,maxSampleError=0,maxMeshTravel=0,maxMuzzleTravel=0,releases=0;
      previewGeometricAttack(rig,{duration:1});previewGeometricAttack(baselineRig,{duration:1});
      for(const delta of [.10,.14,.18,.28,.30]){
        updateGeometricPreview(rig,delta,{onRelease:()=>releases++});updateGeometricPreview(baselineRig,delta);
        const real=capture(actor,geometries,{samples:true}),plain=capture(baseline,geometries,{samples:true}),muzzle=attackMuzzle(rig),plainMuzzle=attackMuzzle(baselineRig);
        check(finiteBounds(real.box)&&!!muzzle&&muzzle.toArray().every(Number.isFinite),label+'finite physical attack geometry and endpoint at '+rig.elapsed);
        const localMatch=agreement(plain,real);check(localMatch.passed,label+'actual moving source geometry preserves animation under classification',localMatch);
        for(let n=0;n<real.records.length;n++)for(let p=0;p<real.records[n].worlds.length;p+=3){
          const current=new THREE.Vector3().fromArray(real.records[n].worlds,p),unscaled=new THREE.Vector3().fromArray(plain.records[n].worlds,p),expected=unscaled.sub(origin).multiplyScalar(item.multiplier).add(origin);
          maxSampleError=Math.max(maxSampleError,current.distanceTo(expected));maxMeshTravel=Math.max(maxMeshTravel,current.distanceTo(new THREE.Vector3().fromArray(restSamples.records[n].worlds,p)));
        }
        const expectedMuzzle=plainMuzzle.clone().sub(origin).multiplyScalar(item.multiplier).add(origin);maxEndpointError=Math.max(maxEndpointError,muzzle.distanceTo(expectedMuzzle));maxMuzzleTravel=Math.max(maxMuzzleTravel,muzzle.distanceTo(restMuzzle));
        const paused=transforms(actor),elapsed=rig.elapsed;updateGeometricPreview(rig,0);check(transforms(actor)===paused&&rig.elapsed===elapsed,label+'zero elapsed preview preserves class scale and exact pose');
        applyDefenderClassificationScale(actor,entry.family);check(arraysClose(actor.scale.toArray(),downstream.toArray()),label+'same-class calls preserve the scaled attack');
      }
      check(maxEndpointError<1e-5&&maxSampleError<1e-5,label+'world endpoint and actual moving geometry both follow class scale',{maxEndpointError,maxSampleError});
      check(releases===1&&maxMeshTravel>1e-5&&maxMuzzleTravel>1e-5,label+'real attack releases once and moves physical source parts',{releases,maxMeshTravel,maxMuzzleTravel});
      resetAttack(rig);resetAttack(baselineRig);const reducedRest=transforms(actor,rig.owned);previewGeometricAttack(rig,{duration:1});updateGeometricPreview(rig,.42,{reducedMotion:true});check(transforms(actor,rig.owned)===reducedRest,label+'reduced motion keeps classified physical rest');resetAttack(rig);
      check(agreement(rest,capture(actor,geometries)).passed,label+'attack reset preserves full native source surface');
      check(arraysClose(new THREE.Box3().setFromObject(platform,true).min.toArray(),platformBefore.min.toArray())&&arraysClose(new THREE.Box3().setFromObject(platform,true).max.toArray(),platformBefore.max.toArray()),label+'attacks and classification leave real wall bounds intact');
      check(transforms(source)===sourcePose,label+'cached approved source remains unchanged during cloned actions');
      check(hash(readFileSync(resolve(assets,entry.file)))===item.assetSha256,label+'approved GLB remains byte-identical after exercise');
      item.attack={maxEndpointError,maxSampleError,maxMeshTravel,maxMuzzleTravel,releases};item.passed=true;report.models.push(item);
    }catch(error){item.passed=false;item.error=String(error);report.models.push(item);throw error;}
    finally{disposeChampionAura(comparisonAura);disposeChampionAura(value?.aura);disposeRankAdornment(value?.actor);disposeAttack(value?.attack);disposeAttack(baselineRig);disposeDefenderInstance(value?.actor);disposeDefenderInstance(baseline);disposeDecodedGeometricAsset(decoded);}
  }
  check(observedClasses.size===5&&Object.keys(CLASSIFICATION_LEVELS).every(c=>observedClasses.has(c)),'Actual roster exercises all five classifications');check(JSON.stringify(data)===dataBefore,'Classification and attacks preserve original game balance data');
  const height=family=>report.models.find(item=>item.family===family&&item.tier===1).battlefieldBounds.size[1];
  check(Math.abs(height('embercrown')/height('archer')-1)<.03,'Actual Baby Fire Dragon is within 3% of ordinary Archer I height');
  for(const [before,after]of [['embercrown','worldfire'],['worldfire','thunderheart'],['thunderheart','phoenix']])check(height(after)>height(before)*1.1,'Real dragon descendants grow by at least 10%: '+before+' → '+after,{before:height(before),after:height(after)});
});

test('nonuniform authored outer transforms and private clone state preserve each original component',async()=>{
  const entry=entries.find(e=>e.family==='ladyclaire'),{decoded}=await decode(entry);let actor,peer;
  try{
    prepareReconstructedDefender(decoded.scene,entry);actor=cloneDefenderTemplate(decoded.scene);peer=cloneDefenderTemplate(decoded.scene);const sourcePose=transforms(decoded.scene),peerPose=transforms(peer);
    actor.scale.set(1.03,.94,1.08);actor.position.set(3,.7,-5);actor.rotation.set(.1,.74,-.04);const original=actor.scale.clone(),position=actor.position.clone(),quaternion=actor.quaternion.clone();
    applyDefenderClassificationScale(actor,entry.family);check(arraysClose(actor.scale.toArray(),original.clone().multiplyScalar(1.4641).toArray()),'All original nonuniform outer scale components receive the same class factor');check(actor.position.equals(position)&&actor.quaternion.equals(quaternion),'Classification preserves original actor position and rotation');
    scaleBattlefieldUnit(actor);animateBattlefieldIdleScale(actor,.025);const active=actor.scale.clone();applyDefenderClassificationScale(actor,entry.family);check(actor.scale.equals(active),'Idempotence retains downstream nonuniform battlefield/idle state');
    check(transforms(decoded.scene)===sourcePose&&transforms(peer)===peerPose,'Scaling one real clone preserves its cached source and independent peer');applyDefenderClassificationScale(peer,'soldier');check(peer.scale.equals(decoded.scene.scale),'Peer class state is independent, with unclassified multiplier one');
  }finally{disposeDefenderInstance(actor);disposeDefenderInstance(peer);disposeDecodedGeometricAsset(decoded);}
});

test('actual secret release projectile starts at the classified physical staff endpoint',async()=>{
  const entry=entries.find(e=>e.family==='ladyclaire'),{decoded}=await decode(entry);let value,fx;
  try{
    prepareReconstructedDefender(decoded.scene,entry);const {field,tower}=fieldFor(decoded.scene,entry);field.sync();value=field.models.get(tower.id);previewGeometricAttack(value.attack,{duration:1});updateGeometricPreview(value.attack,.42);const muzzle=attackMuzzle(value.attack),stats=towerStats(tower,data);
    const scene=new THREE.Scene();fx=new CombatEffects(scene,{getMuzzle:(_source,out,options)=>attackMuzzle(value.attack,out,options)});const shot={id:1,source:{...tower},target:{id:2,x:7,z:5},stats,progress:0,duration:.35,start:{x:7,z:9}},packet=JSON.stringify(shot);fx.event('shot',shot);
    check(fx.projectiles.get(1)?.origin.distanceTo(muzzle)<1e-8,'Real release binds projectile origin to classified moving endpoint');
    for(const progress of [0,.25,.6,1]){shot.progress=progress;fx.syncProjectiles([shot],progress);fx.update(0,progress);let finite=true;scene.updateMatrixWorld(true);scene.traverse(node=>{finite&&=node.matrixWorld.elements.every(Number.isFinite);});check(finite,'Classified projectile has finite real scene transforms at '+progress);}
    shot.progress=0;check(JSON.stringify(shot)===packet,'Visual classification never changes gameplay attack packet');
  }finally{fx?.dispose();disposeAttack(value?.attack);disposeChampionAura(value?.aura);disposeDefenderInstance(value?.actor);disposeDecodedGeometricAsset(decoded);}
});

test('actual ordinary and hostile boss exports retain existing enemy scales, and ruin masonry bypasses classification',async()=>{
  for(const [id,boss] of [['host_01',false],['host_50',true]]){
    const {decoded}=await decode({file:'enemies/'+id+'.glb'});let actor;
    try{actor=cloneDefenderTemplate(decoded.scene);const native=new THREE.Box3().setFromObject(actor,true).getSize(new THREE.Vector3());scaleBattlefieldUnit(actor,{boss});const scale=actor.scale.clone(),size=new THREE.Box3().setFromObject(actor,true).getSize(new THREE.Vector3());applyDefenderClassificationScale(actor,id);check(actor.scale.equals(scale)&&arraysClose(size.toArray(),native.multiplyScalar(BATTLEFIELD_UNIT_SCALE*(boss?BATTLEFIELD_BOSS_MULTIPLIER:1)).toArray(),1e-5),id+' keeps real existing enemy/boss bounds and scale');}finally{disposeDefenderInstance(actor);disposeDecodedGeometricAsset(decoded);}
  }
  const entry=entries.find(e=>e.family==='ladyclaire'),source=castleWallModel(0),{field,tower}=fieldFor(source,entry,'ruin');field.sync();const value=field.models.get(tower.id);
  check(value.actor.scale.equals(new THREE.Vector3(1,1,1))&&!Object.hasOwn(value.actor.userData,'classificationScale'),'Actual Battlefield.sync bypasses even a Secret-family ruin wall');check(close(WALL_DECK_HEIGHT,WALL_REFERENCE_ENEMY_NATIVE_HEIGHT*BATTLEFIELD_UNIT_SCALE),'Wall height keeps the original enemy-derived deck reference');
  check(arraysClose(new THREE.Box3().setFromObject(value.actor,true).getSize(new THREE.Vector3()).toArray(),new THREE.Box3().setFromObject(source,true).getSize(new THREE.Vector3()).toArray()),'Actual ruin wall geometry dimensions are unchanged');
  for(const root of [source,...field.templates.values()])root.traverse(node=>node.geometry?.dispose());
});

after(()=>{
  const changed=snapshots.filter(record=>hash(readFileSync(resolve(project,record.file)))!==record.sha256);report.snapshotUnchanged=changed.length===0;report.changedFiles=changed.map(r=>r.file);report.modelsTested=report.models.length;report.checkCount=report.checks.length;report.failures=report.checks.filter(c=>!c.passed).length+changed.length+report.models.filter(m=>!m.passed).length;report.durationMs=performance.now()-started;report.status=report.failures===0&&report.modelsTested===86?'PASS':'FAIL';report.peakRssBytes=process.resourceUsage().maxRSS*1024;
  const output=resolve(project,'output/design/classification-scale-v20/independent-model-scale-proof.json');mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2));assert.equal(changed.length,0,'Production snapshot changed during independent test: '+JSON.stringify(changed));
});
