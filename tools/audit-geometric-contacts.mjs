import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {NativeTestGLTFLoader} from '../tests/helpers/native-gltf.mjs';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {enemyFigure,disposeEnemyFigure} from '../game/render/enemy-assets.js';
import {attackRig,previewGeometricAttack,updateGeometricPreview,resetAttack,disposeAttack} from '../game/render/battle-animation.js';
import {animateGeometricEnemyMotion,geometricMetadata} from '../game/render/geometric-motion.js';
import {measureGeometricContacts,measureHeadCoverCoverage} from '../game/render/geometric-contacts.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';

const project=resolve(fileURLToPath(new URL('..',import.meta.url))),root=join(project,'public/assets/geometric');
const towerData=JSON.parse(readFileSync(join(project,'data/towers.json'))),enemyData=JSON.parse(readFileSync(join(project,'data/enemies.json')));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function auditGeometricContacts(file,{stages=[.21,.42,.58],walking=true}={}){
  const bytes=readFileSync(file),assetSha256=sha(bytes),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  gltf.scene.animations=gltf.animations;const source=gltf.scene,actor=cloneDefenderTemplate(source),metadata=geometricMetadata(actor),id=file.split(/[\\/]/).at(-1).replace('.glb',''),family=metadata.family||id.replace(/-\d$/,'');
  const poses=[],measure=(name,node)=>poses.push({name,...measureGeometricContacts(node),coverage:measureHeadCoverCoverage(node)});
  measure('authored-rest',actor);
  const rig=attackRig(actor,family,towerData[family]||{type:'physical'});
  for(const stage of stages){resetAttack(rig);previewGeometricAttack(rig,{duration:1});updateGeometricPreview(rig,stage);measure('attack-'+stage,actor);}
  resetAttack(rig);actor.scale.multiplyScalar(.88);measure('battlefield-rest-0.88',actor);
  previewGeometricAttack(rig,{duration:1});updateGeometricPreview(rig,.42);measure('battlefield-attack-0.88',actor);
  const enemy={...enemyData[id],id:0,type:id,speed:1,traveled:0,statuses:{},flying:metadata.locomotion==='flying'},figure=enemyFigure(enemy,new Map([[id,source]]));
  animateGeometricEnemyMotion(figure,enemy,0,{moving:false});animateGeometricEnemyMotion(figure,enemy,.75,{moving:false});measure('actual-idle',figure.userData.body);
  if(walking){for(const [time,traveled] of [[1,.07],[1.3,.14],[1.6,.23]]){enemy.traveled=traveled;animateGeometricEnemyMotion(figure,enemy,time);measure('actual-gait-'+time,figure.userData.body);}}
  figure.scale.multiplyScalar(.88);animateGeometricEnemyMotion(figure,enemy,2,{moving:false});measure('battlefield-idle-0.88',figure.userData.body);
  const failures=poses.flatMap(pose=>pose.failures.map(failure=>({pose:pose.name,...failure}))),coverageFailures=poses.flatMap(pose=>pose.coverage.failures.map(failure=>({pose:pose.name,...failure}))),changedDuringRead=assetSha256!==sha(readFileSync(file));
  disposeAttack(rig);disposeDefenderInstance(actor);disposeEnemyFigure(figure);disposeDecodedGeometricAsset(gltf);
  return {file:relative(project,file).replaceAll('\\','/'),id,assetSha256,sourceSha256:metadata.sourceSha256,locomotion:metadata.locomotion,attackStyle:metadata.attackStyle,bowPlane:metadata.bowPlane,changedDuringRead,poses,failures,coverageFailures};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),outputArg=args.find(a=>a.startsWith('--output=')),selected=args.filter(a=>!a.startsWith('--'));
  const files=selected.length?selected.map(file=>resolve(file)):['defenders','champions','enemies'].flatMap(folder=>readdirSync(join(root,folder)).filter(name=>name.endsWith('.glb')).map(name=>join(root,folder,name)));
  const results=[];for(const file of files){const result=await auditGeometricContacts(file);results.push(result);console.log(JSON.stringify({id:result.id,checked:results.length,failures:result.failures.length,rest:result.poses[0].failures.map(x=>({kind:x.kind,side:x.side,gapNativeM:x.gapNativeM}))}));}
  const report={revision:'actual-geometric-surface-contacts-v1',createdAt:new Date().toISOString(),scope:'Actual imported triangle surfaces in authored rest, preparation, release, recovery, live idle/gait and 0.88 battlefield scale. Closed hat/cap crown seating uses five head-local skin-to-underside rays; open double mitres use their physical base contact. Protected hood/helmet skin rays exempt legitimate front openings and bare cheeks below the actual helmet rim. No bounding-box contact certification.',toleranceNativeM:.004,coverageToleranceNativeM:.00002,limitations:'Finite actual surface and protected-ray samples establish these inspected poses and interfaces; they do not prove every camera silhouette, every possible pose or a source dimension error below 1%.',models:results.length,interfaces:results.reduce((sum,r)=>sum+r.poses.reduce((n,p)=>n+p.interfaces.length,0),0),failures:results.reduce((sum,r)=>sum+r.failures.length,0),coverageTestedRays:results.reduce((sum,r)=>sum+r.poses.reduce((n,p)=>n+p.coverage.results.reduce((a,b)=>a+b.testedRays,0),0),0),coverageFailures:results.reduce((sum,r)=>sum+r.coverageFailures.length,0),assetMutationsDuringRead:results.filter(r=>r.changedDuringRead).map(r=>r.id),runtimeModules:['geometric-contacts.js','geometric-motion.js','battle-animation.js'].map(name=>({file:'game/render/'+name,sha256:sha(readFileSync(join(project,'game/render',name)))})),results};
  report.runtimeModules.push({file:'game/render/models.js',sha256:sha(readFileSync(join(project,'game/render/models.js')))});
  report.manifests=['geometric-defenders.json','geometric-champions.json','geometric-enemies.json'].map(name=>({file:'public/assets/geometric/'+name,sha256:sha(readFileSync(join(root,name)))}));
  const output=resolve(outputArg?outputArg.slice('--output='.length):join(project,'output/design/geometric-game-v1/actual-surface-contact-audit.json'));mkdirSync(resolve(output,'..'),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({models:report.models,interfaces:report.interfaces,failures:report.failures,coverageTestedRays:report.coverageTestedRays,coverageFailures:report.coverageFailures,assetMutationsDuringRead:report.assetMutationsDuringRead,output}));
  if(report.failures||report.coverageFailures||report.assetMutationsDuringRead.length)process.exitCode=1;
}
