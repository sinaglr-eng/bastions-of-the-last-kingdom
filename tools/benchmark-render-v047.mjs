import {readFileSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from '../tests/helpers/native-gltf.mjs';
import {createRig as originalRig} from '../game/render/approved-motion-v1/motion-rig.js';
import {createRig as optimizedRig} from '../game/render/optimized-motion-rig.js';
import {createChampionMotion} from '../game/render/approved-motion-v1/champion-motion.js';
import {createEnemyMotion} from '../game/render/approved-motion-v1/enemy-motion.js';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
import {prepareApprovedMotionTemplate,prepareApprovedMotionActor,approvedMotionController,bindApprovedMotion} from '../game/render/approved-model-motion.js';
import {enemyFigure,disposeEnemyFigure} from '../game/render/enemy-assets.js';
import {animateEnemyMotion} from '../game/render/enemy-motion.js';
import {optimizeGeometricSiblings} from '../game/render/geometric-batching.js';

const arg=name=>process.argv.includes(name)?process.argv[process.argv.indexOf(name)+1]:null;
const frames=Math.max(30,Number(arg('--frames'))||120),cases=[['champions','phoenix'],['enemies','host_31-wraith'],['enemies','host_38-wraith'],['enemies','host_50']];
const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
const distribution=values=>{const sorted=[...values].sort((a,b)=>a-b);return {p50Ms:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1)};};
const results=[];
for(const [kind,id]of cases){
  const entry=JSON.parse(readFileSync(new URL(`../public/assets/geometric/geometric-${kind}.json`,import.meta.url))).entries.find(e=>e.id===id);
  const bytes=readFileSync(new URL('../public/assets/geometric/'+entry.file,import.meta.url));
  const decoded=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const row={id,frames};
  for(const [label,createRig]of [['baseline',originalRig],['optimized',optimizedRig]]){
    const scene=cloneDefenderTemplate(decoded.scene),factory=kind==='champions'?createChampionMotion:createEnemyMotion;let rig;
    const motion=factory(THREE,scene,{id,height:entry.motion.height},{createRig(...args){return rig=createRig(...args);}});
    const update=time=>{rig.beginUpdate?.();try{motion.update(time,{mode:kind==='enemies'?'walk':'attack'});}finally{rig.endUpdate?.();}};
    for(let i=0;i<10;i++)update(i/60);
    let normals=0,spheres=0;scene.traverse(node=>{if(!node.geometry?.userData.motionOwned)return;const g=node.geometry,n=g.computeVertexNormals.bind(g),s=g.computeBoundingSphere.bind(g);g.computeVertexNormals=()=>{normals++;return n();};g.computeBoundingSphere=()=>{spheres++;return s();};});
    const times=[],samples=[];for(let repeat=0;repeat<3;repeat++){const start=performance.now();for(let i=0;i<frames;i++){const tick=performance.now();update((i+1)/60);samples.push(performance.now()-tick);}times.push(performance.now()-start);}
    row[label]={medianTotalMs:median(times),msPerActorFrame:median(times)/frames,normalPasses:normals,spherePasses:spheres,distribution:distribution(samples)};
    motion.dispose?.();disposeDefenderInstance(scene);
  }
  row.speedup=row.baseline.medianTotalMs/row.optimized.medianTotalMs;results.push(row);disposeDecodedGeometricAsset(decoded);
}
const peers=12,peerFrames=Math.min(60,frames),crowds=[];
for(const id of ['host_31-wraith','host_38-wraith']){
  const entry=JSON.parse(readFileSync(new URL('../public/assets/geometric/geometric-enemies.json',import.meta.url))).entries.find(e=>e.id===id),bytes=readFileSync(new URL('../public/assets/geometric/'+entry.file,import.meta.url));
  const decoded=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');prepareApprovedMotionTemplate(decoded.scene,entry);
  const row={id,peers,frames:peerFrames};
  for(const label of ['baseline046','optimized047']){
    const actors=[],motions=[],rigs=[],enemy={id:1,type:id.split('-')[0],visualAsset:id,statuses:{},speed:1};
    for(let i=0;i<peers;i++){
      if(label==='baseline046'){
        const actor=cloneDefenderTemplate(decoded.scene),source=prepareApprovedMotionActor(actor);let rig;
        const motion=createEnemyMotion(THREE,source,{id,height:entry.motion.height},{createRig(...args){return rig=originalRig(...args);}});
        source.userData.geometricRig=true;optimizeGeometricSiblings(source);actors.push(actor);motions.push(motion);rigs.push(rig);
      }else{const actor=enemyFigure(enemy,new Map([[id,decoded.scene]]));actors.push(actor);rigs.push(approvedMotionController(actor.userData.body).runtimeRig);}
    }
    const update=clock=>{for(let i=0;i<peers;i++)if(label==='baseline046'){motions[i].update(clock,{mode:'walk',speed:1});actors[i].updateWorldMatrix(true,true);}else animateEnemyMotion(actors[i],enemy,clock);};
    for(let i=0;i<5;i++)update(i/60);
    let normalPasses=0,spherePasses=0;for(const actor of actors)actor.traverse(n=>{if(!n.geometry?.userData.motionOwned)return;const g=n.geometry,normal=g.computeVertexNormals.bind(g),sphere=g.computeBoundingSphere.bind(g);g.computeVertexNormals=()=>{normalPasses++;return normal();};g.computeBoundingSphere=()=>{spherePasses++;return sphere();};});
    const evaluationsBefore=rigs.reduce((n,r)=>n+(r.evaluations||0),0),copiesBefore=rigs.reduce((n,r)=>n+(r.copies||0),0),times=[],samples=[];
    for(let repeat=0;repeat<3;repeat++){const start=performance.now();for(let i=0;i<peerFrames;i++){const tick=performance.now();update((i+10+repeat*peerFrames)/60);samples.push(performance.now()-tick);}times.push(performance.now()-start);}
    row[label]={medianTotalMs:median(times),msPerSceneFrame:median(times)/peerFrames,distribution:distribution(samples),normalPasses,spherePasses,
      fieldEvaluations:label==='baseline046'?peers*peerFrames*3:rigs.reduce((n,r)=>n+r.evaluations,0)-evaluationsBefore,
      privatePoseCopies:rigs.reduce((n,r)=>n+(r.copies||0),0)-copiesBefore};
    for(let i=0;i<actors.length;i++)if(label==='baseline046'){motions[i].dispose();disposeDefenderInstance(actors[i]);}else disposeEnemyFigure(actors[i]);
  }
  row.speedup=row.baseline046.msPerSceneFrame/row.optimized047.msPerSceneFrame;crowds.push(row);disposeDecodedGeometricAsset(decoded);
}
const skeletalDraws=[];
for(const entry of JSON.parse(readFileSync(new URL('../public/assets/geometric/geometric-defenders.json',import.meta.url))).entries){
  const bytes=readFileSync(new URL('../public/assets/geometric/'+entry.file,import.meta.url)),decoded=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');prepareApprovedMotionTemplate(decoded.scene,entry);
  const actor=cloneDefenderTemplate(decoded.scene),c=bindApprovedMotion(actor);let before=0,after=0;actor.traverse(n=>{if(!n.isMesh)return;if(!n.userData.privateSkinnedBatch)before++;if(n.layers.mask)after++;});
  skeletalDraws.push({id:entry.id,before,after});disposeDefenderInstance(actor);disposeDecodedGeometricAsset(decoded);
}
const report={schema:'render-motion-cpu-benchmark-v047',scope:'Same actual approved GLTF sources, motion fields and sample times; CPU only, excludes browser/GPU/real iPad performance. Crowds compare046 field/reset/bounds work to047 exact-field memoization with private buffers. Skeletal draws are per camera/shadow pass, without reducing submitted triangles.',frames,results,crowds,skeletalDraws};
const output=JSON.stringify(report,null,2)+'\n';if(arg('--output'))writeFileSync(arg('--output'),output);console.log(output);
