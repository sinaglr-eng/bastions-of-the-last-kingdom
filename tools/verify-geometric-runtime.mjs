import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from '../tests/helpers/native-gltf.mjs';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {enemyFigure,disposeEnemyFigure} from '../game/render/enemy-assets.js';
import {attackRig,previewGeometricAttack,updateGeometricPreview,disposeAttack,beginDeath,animateDeath} from '../game/render/battle-animation.js';
import {animateEnemyMotion} from '../game/render/enemy-motion.js';
import {geometricMetadata} from '../game/render/geometric-motion.js';
import {scaleBattlefieldUnit,BATTLEFIELD_UNIT_SCALE} from '../game/render/battlefield-scale.js';

const project=resolve(fileURLToPath(new URL('..',import.meta.url))),assetRoot=join(project,'public/assets/geometric');
const roster=JSON.parse(readFileSync(join(project,'data/towers.json'))),enemyData=JSON.parse(readFileSync(join(project,'data/enemies.json')));
const transforms=(root,excluded=[])=>{root.updateMatrixWorld(true);const values=[];root.traverse(node=>{if(!excluded.some(parent=>descendant(node,parent)))values.push([node.name,...node.position.toArray(),...node.quaternion.toArray(),...node.scale.toArray()]);});return JSON.stringify(values);};
const meshCount=root=>{let n=0;root?.traverse(node=>n+=Number(!!node.isMesh));return n;};
const descendant=(node,parent)=>{for(let current=node;current;current=current.parent)if(current===parent)return true;return false;};
const worldMeshPositions=root=>{root.updateMatrixWorld(true);const values=[];root.traverse(node=>{if(node.isMesh)values.push(...node.matrixWorld.elements);});return values;};
const relativeHeadMatrices=(actor,head)=>{actor.updateMatrixWorld(true);const inverse=head.matrixWorld.clone().invert(),result=new Map();head.traverse(node=>{if(node.isMesh)result.set(node.name,new THREE.Matrix4().multiplyMatrices(inverse,node.matrixWorld).elements.slice());});return result;};
const matrixError=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));

export async function auditGeometricRuntime(file){
  const bytes=readFileSync(file),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');gltf.scene.animations=gltf.animations;
  const source=gltf.scene,actor=cloneDefenderTemplate(source),peer=cloneDefenderTemplate(source),metadata=geometricMetadata(actor),checks=[];
  const check=(name,pass,detail=null)=>checks.push({name,pass:!!pass,...(detail!==null?{detail}:{})});
  const nativeBefore=transforms(source),peerBefore=transforms(peer),vertices=new Map();source.traverse(node=>{if(node.isMesh)vertices.set(node.geometry,Array.from(node.geometry.attributes.position.array));});
  check('geometric metadata',metadata?.geometricRig);check('canonical six-view source',metadata?.sourceViews===6||metadata?.sourceFile&&metadata?.sourceSha256);
  const family=metadata?.family||file.split(/[\\/]/).at(-1).replace('.glb','').replace(/-\d$/,''),isEnemy=file.includes('enemies'),head=actor.getObjectByName('head_pivot');
  if(metadata?.locomotion!=='flying'){
    const minimum=new THREE.Box3().setFromObject(actor,true).min.y;
    check('actual authored ground geometry rests on terrain without buried ankle parts',Math.abs(minimum)<.002,minimum);
  }
  const human=!!actor.getObjectByName('upper_arm_R')||!!actor.getObjectByName('upper_arm_L'),mechanical=metadata?.attackStyle==='siege'&&!human;
  check('real physical meshes',meshCount(actor)>0);if(!mechanical)check('one canonical head pivot',!!head&&!head.isMesh);
  const names=new Map();actor.traverse(node=>names.set(node.name,(names.get(node.name)||0)+1));
  for(const name of ['torso_pivot',...(!mechanical?['head_pivot']:[]),...(human?['upper_arm_R','upper_arm_L','hand_R','hand_L']:[])])check(name+' unique',names.get(name)===1,names.get(name)||0);
  for(const side of human?['R','L']:[]){
    const arm=actor.getObjectByName('upper_arm_'+side),forearm=actor.getObjectByName('forearm_'+side),hand=actor.getObjectByName('hand_'+side),weapon=actor.getObjectByName('weapon_'+side);
    check(side+' arm carries actual parts',meshCount(arm)>0);check(side+' elbow stays under shoulder',descendant(forearm,arm));check(side+' wrist stays under elbow',descendant(hand,forearm));check(side+' weapon stays under hand',descendant(weapon,hand));
  }
  const localR=actor.getObjectByName('upper_arm_R')?.getWorldPosition(new THREE.Vector3()),localL=actor.getObjectByName('upper_arm_L')?.getWorldPosition(new THREE.Vector3());
  // Two-handed source grips can cross the chest centre. Anatomical ownership
  // is determined at the shoulders and canonical elbow/wrist chains above.
  if(human)check('anatomical right shoulder stays +X',localR&&localL&&localR.x>localL.x,{right:localR?.x,left:localL?.x});
  const eyeNodes=[];actor.traverse(node=>{if(node.isMesh&&/^Eye[ _]|^eye[ _]/i.test(node.name))eyeNodes.push(node);});
  if(head&&eyeNodes.length){const centre=head.getWorldPosition(new THREE.Vector3());for(const eye of eyeNodes){const position=new THREE.Box3().setFromObject(eye,true).getCenter(new THREE.Vector3());check(eye.name+' front faces -Z',position.z<centre.z,{eyeZ:position.z,headZ:centre.z});}}
  if(head){
    const before=relativeHeadMatrices(actor,head),restHead=head.rotation.clone();head.rotation.set(restHead.x+.28,restHead.y+.42,restHead.z-.17,restHead.order);const after=relativeHeadMatrices(actor,head);
    check('all head covers follow the same pivot',Array.from(before).every(([name,matrix])=>matrixError(matrix,after.get(name))<1e-6));head.rotation.copy(restHead);
    const escaped=[];actor.traverse(node=>{if(node.isMesh&&/^(Helmet|Hood|Scalp|Hair|Face|Eye)(?:[_ ]|$)/i.test(node.name)){let covered=false;for(let parent=node.parent;parent;parent=parent.parent)if(parent.name.endsWith('head_pivot'))covered=true;if(!covered)escaped.push(node.name);}});
    check('named face/hood/helmet parts share head',escaped.length===0,escaped);
    if(family==='soldier'&&metadata?.tier===6){const flesh=[];head.traverse(node=>{if(node.isMesh&&/^(Face|Scalp|Neck)/i.test(node.name))flesh.push(node.name);});check('Soldier VI closed helmet contains no hidden skin mesh',flesh.length===0,flesh);}
  }
  const rig=attackRig(actor,family,roster[family]||{type:'physical'}),restPose=transforms(actor,rig.owned),side=metadata?.attackStyle==='bow'?'L':'R',weaponRoot=actor.getObjectByName('weapon_'+side);
  const heldRoot=meshCount(weaponRoot)?weaponRoot:actor.getObjectByName('hand_'+side)||actor,heldBefore=worldMeshPositions(heldRoot);
  if(!isEnemy){
    check('actual geometric attack binds',!!rig.geometric);previewGeometricAttack(rig,{duration:1});updateGeometricPreview(rig,.42);
    actor.updateMatrixWorld(true);const heldRelease=worldMeshPositions(heldRoot);updateGeometricPreview(rig,.16);actor.updateMatrixWorld(true);const heldRecovery=worldMeshPositions(heldRoot);
    check('attack moves actual hand/weapon geometry',heldRelease.some((v,i)=>Math.abs(v-heldBefore[i])>.001)||heldRecovery.some((v,i)=>Math.abs(v-heldBefore[i])>.001));updateGeometricPreview(rig,1);check('attack restores exact authored pose',transforms(actor,rig.owned)===restPose);
  }
  const id=file.split(/[\\/]/).at(-1).replace('.glb',''),enemy={...enemyData[id],id:0,type:id,speed:1,traveled:0,statuses:{},flying:metadata?.locomotion==='flying'},figure=enemyFigure(enemy,new Map([[id,source]]));
  animateEnemyMotion(figure,enemy,0);const motionRig=figure.userData.geometricMotion;
  check('loaded geometric locomotion binds',!!motionRig);
  const support=motionRig?.legs.find(leg=>['L','FL'].includes(leg.side)&&leg.ik);
  if(support&&!enemy.flying){
    const before=support.foot.node.getWorldPosition(new THREE.Vector3());enemy.traveled=.01;figure.position.z=-.01;animateEnemyMotion(figure,enemy,.01);
    const after=support.foot.node.getWorldPosition(new THREE.Vector3()),error=before.distanceTo(after);
    check('actual support ankle remains planted during forward world travel',error<1e-5,error);
  }
  const beforeWalk=worldMeshPositions(figure);enemy.traveled=.08;animateEnemyMotion(figure,enemy,.08);const afterWalk=worldMeshPositions(figure);
  if(isEnemy)check('real exported locomotion moves meshes',afterWalk.some((v,i)=>Math.abs(v-beforeWalk[i])>.001));
  if(motionRig?.legs.length){
    for(const leg of motionRig.legs)check(leg.side+' leg chain has physical descendants',meshCount(leg.hip.node)>0);
    if(!enemy.flying)check('exported leg axes support planted-foot IK',motionRig.legs.every(leg=>leg.ik),motionRig.legs.map(leg=>({side:leg.side,ik:leg.ik})));
  }
  const deathCount=meshCount(figure),bodyScale=figure.userData.body.scale.toArray();beginDeath(figure,enemy);
  let minimum=Infinity;for(let i=0;i<26;i++){animateDeath(figure,.04);figure.updateMatrixWorld(true);minimum=Math.min(minimum,new THREE.Box3().setFromObject(figure.userData.body,true).min.y);}
  check('every actual corpse fall pose clears terrain',minimum>=.02499,minimum);check('death keeps every physical mesh',meshCount(figure)===deathCount);check('death preserves imported scale',JSON.stringify(figure.userData.body.scale.toArray())===JSON.stringify(bodyScale));
  const settled=transforms(figure);animateDeath(figure,800);animateEnemyMotion(figure,{...enemy,dead:true},1000);check('corpse remains stationary after settling',transforms(figure)===settled);
  const scaledFigure=enemyFigure(enemy,new Map([[id,source]]));scaleBattlefieldUnit(scaledFigure);scaleBattlefieldUnit(scaledFigure);
  const scaledOpacity=new Map();scaledFigure.userData.body.traverse(node=>{for(const material of Array.isArray(node.material)?node.material:[node.material])if(material)scaledOpacity.set(material,material.opacity);});
  check('battlefield scale is private and applied exactly once',Math.abs(scaledFigure.scale.y-BATTLEFIELD_UNIT_SCALE)<1e-12&&source.scale.y===1);
  scaledFigure.position.y=enemy.flying?.7:0;beginDeath(scaledFigure,enemy);let scaledMinimum=Infinity;
  for(let i=0;i<26;i++){animateDeath(scaledFigure,.04);scaledFigure.updateWorldMatrix(true,true);scaledMinimum=Math.min(scaledMinimum,new THREE.Box3().setFromObject(scaledFigure.userData.body,true).min.y);}
  check('every .88 battlefield corpse pose clears terrain in world metres',scaledMinimum>=.02499,scaledMinimum);
  const scaledSettled=transforms(scaledFigure);animateDeath(scaledFigure,800);check('scaled corpse preserves imported opacity and remains stationary',transforms(scaledFigure)===scaledSettled&&scaledFigure.scale.y===BATTLEFIELD_UNIT_SCALE&&[...scaledOpacity].every(([material,opacity])=>material.opacity===opacity));
  check('cached source and peer clone remain unmodified',transforms(source)===nativeBefore&&transforms(peer)===peerBefore);
  check('shared native vertex buffers unchanged',[...vertices].every(([geometry,array])=>array.every((v,i)=>v===geometry.attributes.position.array[i])));
  const resources=new Set();source.traverse(node=>{if(node.geometry)resources.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])if(material)resources.add(material);});
  disposeAttack(rig);disposeDefenderInstance(actor);disposeDefenderInstance(peer);disposeEnemyFigure(figure);disposeEnemyFigure(scaledFigure);resources.forEach(resource=>resource.dispose());
  return {file:relative(project,file).replaceAll('\\','/'),fileSha256:createHash('sha256').update(bytes).digest('hex'),family,locomotion:metadata?.locomotion,attackStyle:metadata?.attackStyle,meshCount:deathCount,passed:checks.filter(c=>c.pass).length,total:checks.length,checks};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const files=process.argv.slice(2).filter(arg=>!arg.startsWith('--'));
  const selected=files.length?files.map(file=>resolve(file)):['defenders','champions','enemies'].flatMap(folder=>{try{return readdirSync(join(assetRoot,folder)).filter(file=>file.endsWith('.glb')).map(file=>join(assetRoot,folder,file));}catch{return [];}});
  const models=[];for(const file of selected)models.push(await auditGeometricRuntime(file));
  const runtimeModules=['models.js','battle-animation.js','combat-effects.js','enemy-motion.js','enemy-aura.js','geometric-motion.js','geometric-enemy-effects.js','geometric-orbits.js','geometric-resources.js','geometric-batching.js','geometric-contacts.js','battlefield-scale.js','atelier-enemy-preview.js'].map(name=>{const file=join(project,'game/render',name);return {file:relative(project,file).replaceAll('\\','/'),sha256:createHash('sha256').update(readFileSync(file)).digest('hex')};});
  const report={revision:'geometric-runtime-audit-v1',runtimeModules,models:models.length,passed:models.reduce((sum,m)=>sum+m.passed,0),total:models.reduce((sum,m)=>sum+m.total,0),limitations:'Head articulation checks prove coherent physical hierarchies, not source silhouette accuracy or zero geometric penetration. Source-to-model renders and independent coverage probes are assessed separately.',results:models};
  const outputArg=process.argv.find(arg=>arg.startsWith('--output=')),output=outputArg?resolve(outputArg.slice('--output='.length)):join(project,'output/design/geometric-game-v1/runtime-model-audit.json');mkdirSync(resolve(output,'..'),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2));
  console.log(JSON.stringify({models:report.models,passed:report.passed,total:report.total,failures:models.flatMap(m=>m.checks.filter(c=>!c.pass).map(c=>({file:m.file,...c}))),output}));if(report.passed!==report.total)process.exitCode=1;
}
