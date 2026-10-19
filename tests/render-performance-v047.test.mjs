import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {createRig as originalRig} from '../game/render/approved-motion-v1/motion-rig.js';
import {createRig as optimizedRig} from '../game/render/optimized-motion-rig.js';
import {createChampionMotion} from '../game/render/approved-motion-v1/champion-motion.js';
import {createEnemyMotion} from '../game/render/approved-motion-v1/enemy-motion.js';
import {prepareApprovedMotionTemplate,prepareApprovedMotionActor,approvedMotionController,sampleApprovedAttack,bindApprovedMotion} from '../game/render/approved-model-motion.js';
import {enemyFigure,disposeEnemyFigure} from '../game/render/enemy-assets.js';
import {animateEnemyMotion} from '../game/render/enemy-motion.js';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';

const jsonHooks=registerHooks({load(url,context,next){
  if(url.startsWith('file:')&&url.endsWith('.json'))return {format:'module',source:`export default JSON.parse(${JSON.stringify(readFileSync(new URL(url),'utf8'))});`,shortCircuit:true};return next(url,context);
}});
const {Battlefield}=await import('../game/render/world.js');jsonHooks.deregister();
test('repeated UI renders do not reset an unchanged drawing buffer or camera projection',()=>{
  let width=1024,height=768,resizes=0,projections=0,fits=0;
  const view={container:{getBoundingClientRect:()=>({width,height})},renderer:{setSize(w,h){assert.equal(w,width);assert.equal(h,height);resizes++;}},camera:{updateProjectionMatrix(){projections++;}},resetCamera(){fits++;}};
  Battlefield.prototype.resize.call(view);
  for(let i=0;i<100;i++)Battlefield.prototype.resize.call(view);
  assert.equal(resizes,1);assert.equal(projections,1);assert.equal(fits,1);
  width=768;height=1024;Battlefield.prototype.resize.call(view);assert.equal(resizes,2);assert.equal(projections,2);assert.equal(view.camera.aspect,.75);assert.equal(fits,1,'a real size change retains the player camera');
  width=0;Battlefield.prototype.resize.call(view);assert.equal(resizes,2,'a hidden viewport does not allocate a zero-size drawing buffer');
});

function pose(scene){
  scene.updateWorldMatrix(true,true);const hash=createHash('sha256');
  scene.traverse(node=>{
    hash.update(JSON.stringify([node.name,node.visible,...node.matrixWorld.elements]));
    if(node.isMesh)for(const key of ['position','normal']){const a=node.geometry.getAttribute(key)?.array;if(a)hash.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));}
  });return hash.digest('hex');
}
function bounded(scene){
  scene.traverse(node=>{
    if(!node.isMesh||!node.geometry.userData.motionOwned)return;
    const geometry=node.geometry,point=new THREE.Vector3();
    assert.ok(Number.isFinite(geometry.boundingSphere.radius));
    for(let i=0;i<geometry.attributes.position.count;i++){
      point.fromBufferAttribute(geometry.attributes.position,i);
      assert.ok(point.distanceTo(geometry.boundingSphere.center)<=geometry.boundingSphere.radius+1e-6,node.name+' conservative culling bound contains the actual deformed surface');
    }
  });
}
test('optimized motion skips redundant restores, sphere scans and unchanged normal work while restoring exact authored rest',()=>{
  const scene=new THREE.Group(),geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute([1,0,0,1,0,0,1,0,0],3));
  const node=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());node.name='Actual surface';scene.add(node);
  const before=pose(scene),rig=optimizedRig(THREE,scene),field=rig.deformer('surface',[node]);
  const owned=node.geometry;let normals=0,spheres=0;
  const normalMethod=owned.computeVertexNormals.bind(owned),sphereMethod=owned.computeBoundingSphere.bind(owned);
  owned.computeVertexNormals=()=>{normals++;normalMethod();};owned.computeBoundingSphere=()=>{spheres++;sphereMethod();};
  for(let i=0;i<10;i++){rig.beginUpdate();rig.reset();field.apply(point=>{point.z+=.2;});rig.endUpdate();}
  assert.equal(normals,1,'unchanged final positions retain the identical recomputed normals');
  assert.equal(spheres,0,'deformation computes conservative bounds during the existing vertex pass');bounded(scene);
  rig.beginUpdate();rig.reset();rig.endUpdate();assert.equal(pose(scene),before,'an unused field restores exact source positions and authored normals');
  rig.dispose();assert.equal(node.geometry,geometry);geometry.dispose();node.material.dispose();
});

function rigPose(rig){
  const hash=createHash('sha256');
  for(const [name,joint]of rig.joints)hash.update(JSON.stringify([name,...joint.node.position.toArray(),...joint.node.quaternion.toArray(),...joint.node.scale.toArray()]));
  for(const field of rig.deformers)for(const mesh of field.meshes)for(const attribute of [mesh.position,mesh.normal])if(attribute)hash.update(Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));
  for(const [name,node]of rig.nodes)hash.update(JSON.stringify([name,node.visible]));
  return hash.digest('hex');
}
test('same-clock enemy poses reuse one evaluation while source, variant, mode, private buffers and disposal remain independent',async()=>{
  const entries=JSON.parse(readFileSync(new URL('../public/assets/geometric/geometric-enemies.json',import.meta.url))).entries;
  const entry=entries.find(e=>e.id==='host_38-wraith'),bytes=readFileSync(new URL('../public/assets/geometric/'+entry.file,import.meta.url));
  const decoded=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  prepareApprovedMotionTemplate(decoded.scene,entry);const templates=new Map([[entry.id,decoded.scene]]);
  const enemy={id:1,type:'host_38',visualAsset:entry.id,statuses:{},speed:1},figures=Array.from({length:4},()=>enemyFigure(enemy,templates)),controllers=figures.map(f=>approvedMotionController(f.userData.body));
  const reference=cloneDefenderTemplate(decoded.scene);let referenceRig;
  const motion=createEnemyMotion(THREE,prepareApprovedMotionActor(reference),{id:entry.id,height:entry.motion.height},{createRig(...args){
    referenceRig=originalRig(...args);const deformer=referenceRig.deformer;referenceRig.deformers=[];
    referenceRig.deformer=(...values)=>{const field=deformer(...values);referenceRig.deformers.push(field);return field;};return referenceRig;
  }});
  try{
    const steps=[{clock:.17,mode:'walk'},{clock:.33,mode:'idle',moving:false},{clock:.5,mode:'rest',statuses:{freeze:1}},{clock:.67,mode:'rest',statuses:{petrify:1}},
      {clock:.84,mode:'fly',flying:true},{clock:1.01,mode:'run',rush:true},{clock:1.18,mode:'rest',reducedMotion:true},{clock:1.35,mode:'walk'}];
    for(const step of steps){
      const state={...enemy,...step,statuses:step.statuses||{}};motion.update(step.clock,{mode:step.mode,speed:1});
      const before=controllers.reduce((n,c)=>n+c.runtimeRig.evaluations,0),copies=controllers.reduce((n,c)=>n+c.runtimeRig.copies,0);
      for(let i=0;i<figures.length;i++){
        figures[i].position.set(i*2,.1,i*-3);figures[i].rotation.y=i*.3;
        animateEnemyMotion(figures[i],state,step.clock,{moving:step.moving!==false,reducedMotion:step.reducedMotion});
        assert.equal(rigPose(controllers[i].runtimeRig),rigPose(referenceRig),step.mode+' exact original field, positions/normals and joint/visibility output');
        assert.deepEqual(figures[i].position.toArray(),[i*2,.1,i*-3],'pose cache does not copy actor navigation transforms');
      }
      assert.equal(controllers.reduce((n,c)=>n+c.runtimeRig.evaluations,0)-before,1,'one exact field evaluation for this source/mode/clock');
      assert.equal(controllers.reduce((n,c)=>n+c.runtimeRig.copies,0)-copies,3,'peers copy privately owned pose buffers');
    }
    const a=controllers[0].runtimeRig.deformers[0].meshes[0],b=controllers[1].runtimeRig.deformers[0].meshes[0];
    assert.notEqual(a.position.array,b.position.array);assert.notEqual(a.geometry,b.geometry);assert.equal(a.sourceGeometry,b.sourceGeometry);
    // Different states in the very same frame cannot consume another mode's pose.
    animateEnemyMotion(figures[0],enemy,2);animateEnemyMotion(figures[1],{...enemy,statuses:{freeze:1}},2);
    assert.notEqual(rigPose(controllers[0].runtimeRig),rigPose(controllers[1].runtimeRig));
    const secondDecoded=decoded.scene.clone(true);prepareApprovedMotionTemplate(secondDecoded,entry);
    const separate=enemyFigure(enemy,new Map([[entry.id,secondDecoded]])),separateController=approvedMotionController(separate.userData.body);
    animateEnemyMotion(separate,enemy,2);assert.equal(separateController.runtimeRig.evaluations,1,'independently decoded source generation cannot reuse another actor source');disposeEnemyFigure(separate);
    disposeEnemyFigure(figures[0]);animateEnemyMotion(figures[2],enemy,2.2);assert.ok(controllers[2].runtimeRig.evaluations>0,'disposing the cached owner permits the next actor to evaluate');
    const frozen=rigPose(controllers[3].runtimeRig);figures[3].userData.death=true;animateEnemyMotion(figures[3],enemy,2.4);assert.equal(rigPose(controllers[3].runtimeRig),frozen,'death owns its settled pose');
    for(const controller of controllers.slice(1)){controller.motion.reset();assert.ok(controller.runtimeRig.deformers.every(d=>!d.dirty),'copied fields restore authored rest independently');}
  }finally{motion.dispose();disposeDefenderInstance(reference);for(const figure of figures)disposeEnemyFigure(figure);disposeDecodedGeometricAsset(decoded);}
});

test('actual enemy cache rejects owners changed by seeking, mode changes, copy receipt or direct reset',async()=>{
  const entry=JSON.parse(readFileSync(new URL('../public/assets/geometric/geometric-enemies.json',import.meta.url))).entries.find(e=>e.id==='host_38-wraith');
  const bytes=readFileSync(new URL('../public/assets/geometric/'+entry.file,import.meta.url)),decoded=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const enemy={id:1,type:'host_38',visualAsset:entry.id,statuses:{},speed:1};
  const reference=cloneDefenderTemplate(decoded.scene);let referenceRig;
  const baseline=createEnemyMotion(THREE,reference,{id:entry.id,height:entry.motion.height},{createRig(...args){
    referenceRig=originalRig(...args);const deformer=referenceRig.deformer;referenceRig.deformers=[];
    referenceRig.deformer=(...values)=>{const field=deformer(...values);referenceRig.deformers.push(field);return field;};return referenceRig;
  }});
  // Preparing a fresh template generation separates each deliberately seeking
  // scenario while all actors within that scenario share its real geometry.
  const scenarios=[
    {name:'walk owner later rests',first:'walk',next:'rest',expected:'walk'},
    {name:'walk owner seeks forward',first:'walk',next:'walk',expected:'walk'},
    {name:'rest owner later walks',first:'rest',next:'walk',expected:'rest'},
    {name:'flying owner later idles',first:'fly',next:'idle',expected:'fly'},
    {name:'walk owner receives cached rest',first:'walk',next:'rest',expected:'walk',copied:true},
    {name:'rest owner receives cached walk',first:'rest',next:'walk',expected:'rest',copied:true},
    {name:'walk owner is explicitly reset',first:'walk',expected:'walk',reset:true},
  ];
  const options=mode=>({moving:mode!=='idle'}),state=mode=>({...enemy,flying:mode==='fly',statuses:mode==='rest'?{freeze:1}:{}});
  try{
    for(const scenario of scenarios){
      prepareApprovedMotionTemplate(decoded.scene,entry);const templates=new Map([[entry.id,decoded.scene]]),actors=[];
      const make=()=>{const actor=enemyFigure(enemy,templates);actors.push(actor);return actor;};
      const owner=make(),ownerController=approvedMotionController(owner.userData.body);
      // The reference is unconverted, so compare source-local joint/buffer
      // output; this model's deformation source matrices are identities.
      try{
        animateEnemyMotion(owner,state(scenario.first),.2,options(scenario.first));const revision=ownerController.runtimeRig.poseRevision;
        if(scenario.reset)ownerController.motion.reset();
        else{
          if(scenario.copied){const donor=make();animateEnemyMotion(donor,state(scenario.next),.4,options(scenario.next));}
          animateEnemyMotion(owner,state(scenario.next),.4,options(scenario.next));
          if(scenario.copied)assert.equal(ownerController.runtimeRig.copies,1,'cached owner itself becomes a private pose-copy recipient');
        }
        assert.ok(ownerController.runtimeRig.poseRevision>revision,scenario.name+' changes the cached owner revision');
        const peer=make(),peerController=approvedMotionController(peer.userData.body);animateEnemyMotion(peer,state(scenario.expected),.2,options(scenario.expected));
        baseline.update(.2,{mode:scenario.expected,speed:1});
        assert.equal(rigPose(peerController.runtimeRig),rigPose(referenceRig),scenario.name+' recomputes the actual requested pose rather than copying mutated owner buffers');
        assert.equal(peerController.runtimeRig.evaluations,1,scenario.name+' rejects stale cache owner');assert.equal(peerController.runtimeRig.copies,0);
      }finally{for(const actor of actors)disposeEnemyFigure(actor);}
    }
    prepareApprovedMotionTemplate(decoded.scene,entry);const templates=new Map([[entry.id,decoded.scene]]),owner=enemyFigure(enemy,templates),peer=enemyFigure(enemy,templates);
    try{
      animateEnemyMotion(owner,enemy,.2);const original=rigPose(approvedMotionController(owner.userData.body).runtimeRig);
      animateEnemyMotion(owner,state('rest'),.2);assert.equal(rigPose(approvedMotionController(owner.userData.body).runtimeRig),original,'repeated same actor/clock retains046 pause semantics even if options change');
      animateEnemyMotion(peer,enemy,.2);assert.equal(rigPose(approvedMotionController(peer.userData.body).runtimeRig),original,'unchanged same-clock owner remains safely reusable');
    }finally{disposeEnemyFigure(owner);disposeEnemyFigure(peer);}
  }finally{baseline.dispose();disposeDefenderInstance(reference);disposeDecodedGeometricAsset(decoded);}
});

test('all 48 actual V7 actors batch only identical skin/material transforms and preserve every posed rendered vertex and normal',async()=>{
  const entries=JSON.parse(readFileSync(new URL('../public/assets/geometric/geometric-defenders.json',import.meta.url))).entries;let before=0,after=0;
  const pointA=new THREE.Vector3(),pointB=new THREE.Vector3(),normalA=new THREE.Vector3(),normalB=new THREE.Vector3();
  const skin=new THREE.Matrix4(),bone=new THREE.Matrix4(),skinIndex=new THREE.Vector4(),skinWeight=new THREE.Vector4();
  function posedNormal(mesh,index,out){
    skinIndex.fromBufferAttribute(mesh.geometry.attributes.skinIndex,index);skinWeight.fromBufferAttribute(mesh.geometry.attributes.skinWeight,index);skin.elements.fill(0);
    for(let i=0;i<4;i++){bone.fromArray(mesh.skeleton.boneMatrices,skinIndex.getComponent(i)*16);const weight=skinWeight.getComponent(i);for(let k=0;k<16;k++)skin.elements[k]+=bone.elements[k]*weight;}
    skin.premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);
    out.fromBufferAttribute(mesh.geometry.attributes.normal,index).applyMatrix3(new THREE.Matrix3().setFromMatrix4(skin));
    return out.applyMatrix3(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).normalize();
  }
  for(const entry of entries){
    const bytes=readFileSync(new URL('../public/assets/geometric/'+entry.file,import.meta.url));
    const decoded=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    prepareApprovedMotionTemplate(decoded.scene,entry);const actor=cloneDefenderTemplate(decoded.scene),controller=bindApprovedMotion(actor),stats=controller.skinnedBatching;
    try{
      before+=stats.before;after+=stats.after;assert.ok(stats.before>stats.after*3,entry.id+' material batching materially reduces draw submissions');
      actor.position.set(3,.85,-4);actor.rotation.y=.37;actor.scale.setScalar(.704);
      for(const phase of [0,.2,.43,.8]){
        sampleApprovedAttack(controller,phase);actor.updateWorldMatrix(true,true);
        for(const batch of stats.batches){
          batch.skeleton.update();assert.equal(batch.frustumCulled,false,'moving equipment cannot be clipped by a rest-only sphere');
          for(const {mesh,start,count}of stats.parts.get(batch)){
            assert.equal(mesh.layers.mask,0,'original surfaces stay available for semantic anchors without a second GPU submission');
            assert.equal(batch.material,mesh.material,'exact original material object');assert.equal(mesh.visible,batch.visible);
            assert.equal(batch.skeleton,mesh.skeleton,'same private skin, weights and bones');assert.deepEqual(batch.bindMatrix.elements,mesh.bindMatrix.elements);
            for(let i=0;i<count;i++){
              mesh.getVertexPosition(i,pointA).applyMatrix4(mesh.matrixWorld);batch.getVertexPosition(start+i,pointB).applyMatrix4(batch.matrixWorld);
              assert.ok(pointA.distanceToSquared(pointB)<1e-20,entry.id+' rendered world surface at phase '+phase);
              posedNormal(mesh,i,normalA);posedNormal(batch,start+i,normalB);assert.ok(normalA.distanceToSquared(normalB)<1e-20,entry.id+' actual skinned shader normal at phase '+phase);
              for(const [key,attribute]of Object.entries(mesh.geometry.attributes))for(let c=0;c<attribute.itemSize;c++)assert.equal(batch.geometry.attributes[key].getComponent(start+i,c),attribute.getComponent(i,c),entry.id+' exact original '+key);
            }
          }
        }
      }
    }finally{disposeDefenderInstance(actor);disposeDecodedGeometricAsset(decoded);}
  }
  assert.ok(after<before*.2,'all ranks retain under 20% of the literal skeletal draw submissions');
});

test('all54 actual enemy sources and structural variants reuse only matching gait poses with private surfaces',async()=>{
  const entries=JSON.parse(readFileSync(new URL('../public/assets/geometric/geometric-enemies.json',import.meta.url))).entries;
  for(const entry of entries){
    const bytes=readFileSync(new URL('../public/assets/geometric/'+entry.file,import.meta.url)),decoded=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    prepareApprovedMotionTemplate(decoded.scene,entry);const state={id:1,type:entry.id.split('-')[0],visualAsset:entry.id,statuses:{},speed:1},templates=new Map([[entry.id,decoded.scene]]);
    const first=enemyFigure(state,templates),peer=enemyFigure({...state,id:2},templates),a=approvedMotionController(first.userData.body),b=approvedMotionController(peer.userData.body);
    try{
      for(const [clock,options,extra]of [[.19,{},{}],[.38,{moving:false},{}],[.57,{}, {statuses:{freeze:1}}],[.76,{}, {flying:true}],[.95,{}, {rush:true}]]){
        const enemy={...state,...extra};animateEnemyMotion(first,enemy,clock,options);animateEnemyMotion(peer,enemy,clock,options);
        assert.equal(rigPose(a.runtimeRig),rigPose(b.runtimeRig),entry.id+' identical actual surface/joint/visibility pose');
      }
      assert.equal(a.runtimeRig.evaluations,5,entry.id+' current owner computes each exact source-clock-state');
      assert.equal(b.runtimeRig.evaluations,0,entry.id+' matching peer avoids all redundant field evaluation');
      assert.equal(b.runtimeRig.copies,5,entry.id+' copies retain independent ownership');
      for(let i=0;i<a.runtimeRig.deformers.length;i++)for(let k=0;k<a.runtimeRig.deformers[i].meshes.length;k++)assert.notEqual(a.runtimeRig.deformers[i].meshes[k].position.array,b.runtimeRig.deformers[i].meshes[k].position.array,entry.id+' no shared mutable pose buffer');
    }finally{disposeEnemyFigure(first);disposeEnemyFigure(peer);disposeDecodedGeometricAsset(decoded);}
  }
});

test('all92 actual enemy/champion motion fields retain byte-identical posed positions, normals, visibility and world transforms',async()=>{
  for(const kind of ['champions','enemies']){
    const manifest=JSON.parse(readFileSync(new URL(`../public/assets/geometric/geometric-${kind}.json`,import.meta.url)));
    for(const entry of manifest.entries){
      const bytes=readFileSync(new URL('../public/assets/geometric/'+entry.file,import.meta.url));
      const decoded=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
      const left=cloneDefenderTemplate(decoded.scene),right=cloneDefenderTemplate(decoded.scene),factory=kind==='champions'?createChampionMotion:createEnemyMotion;
      const profile={id:entry.id,height:entry.motion.height,family:entry.family,rank:entry.tier};let optimized;
      const baseline=factory(THREE,left,profile,{createRig:originalRig});
      const candidate=factory(THREE,right,profile,{createRig(...args){return optimized=optimizedRig(...args);}});
      try{
        for(const [time,mode]of [[0,'attack'],[.13,'attack'],[.4,'attack'],[.72,'attack'],[.99,'attack'],[1.1,'idle'],[1.35,'run'],[1.5,'rest']]){
          baseline.update(time,{mode});optimized.beginUpdate();try{candidate.update(time,{mode});}finally{optimized.endUpdate();}
          assert.equal(pose(right),pose(left),entry.id+' '+time+' '+mode+' exact motion equivalence');
        }
        bounded(right);baseline.reset();candidate.reset();assert.equal(pose(right),pose(left),entry.id+' exact reset');
      }finally{baseline.dispose?.();candidate.dispose?.();disposeDefenderInstance(left);disposeDefenderInstance(right);disposeDecodedGeometricAsset(decoded);}
    }
  }
});
