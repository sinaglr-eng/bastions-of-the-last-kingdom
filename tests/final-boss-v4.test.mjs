import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {enemyFigure,disposeEnemyFigure,installEnemyTemplate} from '../game/render/enemy-assets.js';
import {animateEnemyMotion} from '../game/render/enemy-motion.js';
import {Game} from '../game/core/game.js';

const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,json(`../data/${key}.json`)]));
const manifest=json('../public/assets/enemies/manifest.json');
const variants=['host_50','host_50-tyrant','host_50-devourer'];
const skins=root=>{const result=[];root.traverse(node=>{if(node.isSkinnedMesh)result.push(node);});return result;};
const pose=root=>skins(root)[0].skeleton.bones.map(bone=>[bone.name,...bone.position.toArray(),...bone.quaternion.toArray(),...bone.scale.toArray()]);
async function load(id){const bytes=readFileSync(new URL('../public/assets/enemies/'+manifest.find(entry=>entry.id===id).file,import.meta.url)),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');gltf.scene.animations=gltf.animations;gltf.scene.updateMatrixWorld(true);return gltf.scene;}
function disposeSource(source){const resources=new Set();source.traverse(node=>{if(node.geometry)resources.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])if(material){resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);}});for(const resource of resources)resource.dispose();}
function vertex(mesh,index){return mesh.getVertexPosition(index,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);}

test('all three Morvath exports contain a native two-legged wyvern, a seated rider, complete flight/flourish clips and bounded actual geometry',async()=>{
  assert.equal(data.enemies.host_50.name,'Morvath, the Dread Sovereign');
  assert.deepEqual(data.enemies.host_50.variants.map(variant=>variant.name),['Morvath the Ashen','Morvath the Gold-Cursed','Morvath the Bone-Crowned']);
  for(const id of variants){
    const source=await load(id),entry=manifest.find(entry=>entry.id===id);
    try{
      assert.equal(entry.revision,'final-boss-v4');assert.equal(entry.nativeScale,1);
      assert.ok(existsSync(new URL('../'+entry.source,import.meta.url)),'editable boss source missing');
      assert.deepEqual(source.animations.map(clip=>clip.name).sort(),['Attack','Idle']);
      const meshes=skins(source);assert.ok(meshes.length>0);assert.ok(meshes.length<=12,'boss material batching regressed');
      const bones=meshes[0].skeleton.bones.map(bone=>bone.name);
      for(const name of ['hind_upper_L','hind_upper_R','hind_lower_L','hind_lower_R','hind_paw_L','hind_paw_R','wing_upper_L','wing_upper_R','wing_wrist_L','wing_wrist_R','rider_hips','rider_torso','rider_hand_R','rider_weapon'])assert.ok(bones.includes(name),id+' missing weighted anatomy '+name);
      assert.equal(bones.filter(name=>name.startsWith('hind_upper_')).length,2,'wyvern acquired four walking legs');
      assert.ok(!bones.some(name=>/^(foreleg|front_leg|fore_upper)/.test(name)));
      const triangles=meshes.reduce((sum,mesh)=>sum+(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3,0);
      assert.equal(triangles,entry.triangles);assert.ok(triangles>50000&&triangles<95000,'boss actual production budget');
      const size=new THREE.Box3().setFromObject(source,true).getSize(new THREE.Vector3());
      assert.ok(size.x>9&&size.x<11&&size.y>3.5&&size.y<4.5,'large boss silhouette must retain native scene dimensions');
      const expected=[entry.bounds.size[0],entry.bounds.size[2],entry.bounds.size[1]];
      size.toArray().forEach((value,axis)=>assert.ok(Math.abs(value-expected[axis])<.003,id+' recorded native bounds'));
      for(const mesh of meshes){
        const weights=mesh.geometry.attributes.skinWeight,indices=mesh.geometry.attributes.skinIndex;
        assert.ok(weights&&indices&&weights.count===mesh.geometry.attributes.position.count);
        for(let index=0;index<weights.count;index++){
          let sum=0;for(let influence=0;influence<4;influence++){const w=weights.getComponent(index,influence),bone=indices.getComponent(index,influence);assert.ok(Number.isFinite(w)&&w>=0&&w<=1);assert.ok(Number.isInteger(bone)&&bone>=0&&bone<mesh.skeleton.bones.length);sum+=w;}
          assert.ok(Math.abs(sum-1)<.001,id+' unnormalised native skin');
        }
      }
    }finally{disposeSource(source);}
  }
});

test('Morvath flies with private weighted bones, keeps the rider seated through the full Idle cycle and freezes on the simulation clock',async()=>{
  const source=await load('host_50'),templates=new Map([['host_50',source]]),enemy={...data.enemies.host_50,type:'host_50',id:12,speed:1.2},a=enemyFigure(enemy,templates),b=enemyFigure({...enemy,id:13},templates);
  try{
    assert.ok(a.userData.nativeFlight&&b.userData.nativeFlight);assert.notEqual(skins(a)[0].skeleton,skins(b)[0].skeleton);
    assert.equal(skins(a)[0].geometry,skins(b)[0].geometry,'clones should share immutable geometry');
    const cached=pose(source),peer=pose(b),body=a.userData.body,base=body.scale.toArray(),wingSamples=[];
    body.updateMatrixWorld(true);
    for(const mesh of skins(body))for(let index=0;index<mesh.geometry.attributes.position.count;index+=Math.max(1,Math.floor(mesh.geometry.attributes.position.count/100)))wingSamples.push({mesh,index,point:vertex(mesh,index)});
    for(let frame=0;frame<=120;frame++){
      animateEnemyMotion(a,enemy,frame/50);
      const seat=body.getObjectByName('rider_seat_contact'),saddle=body.getObjectByName('saddle_seat');assert.ok(seat&&saddle);
      assert.ok(seat.getWorldPosition(new THREE.Vector3()).distanceTo(saddle.getWorldPosition(new THREE.Vector3()))<.015,'rider detached from native saddle on frame '+frame);
      assert.deepEqual(body.scale.toArray(),base,'flight substituted whole-body breathing/scale');
      assert.ok(pose(a).flat().filter(value=>typeof value==='number').every(Number.isFinite));
    }
    animateEnemyMotion(a,enemy,.35);assert.ok(wingSamples.filter(({mesh,index,point})=>vertex(mesh,index).distanceTo(point)>.01).length>10,'flight moved empty nodes without wing/body surfaces');
    const frozen=pose(a);animateEnemyMotion(a,enemy,.35);assert.deepEqual(pose(a),frozen,'pause moved boss bones');
    assert.deepEqual(pose(source),cached,'flight changed cached asset');assert.deepEqual(pose(b),peer,'flight changed another boss');
    animateEnemyMotion(a,enemy,999,{reducedMotion:true});const reduced=pose(a);animateEnemyMotion(a,enemy,1000,{reducedMotion:true});assert.deepEqual(pose(a),reduced);
  }finally{disposeEnemyFigure(a);disposeEnemyFigure(b);disposeSource(source);}
});

test('boss native asset installation preserves clips and disposing one figure releases only its private bone texture',async()=>{
  const source=await load('host_50'),view={disposed:false,enemyTemplates:new Map(),game:{combat:{enemies:[]}},enemies:new Map(),updateCampPreview(){this.previews=(this.previews||0)+1;}};
  try{
    assert.equal(installEnemyTemplate(view,{id:'host_50'},source,source.animations),true);assert.deepEqual(view.enemyTemplates.get('host_50').animations.map(clip=>clip.name).sort(),['Attack','Idle']);
    const enemy={...data.enemies.host_50,type:'host_50',id:8},a=enemyFigure(enemy,view.enemyTemplates),b=enemyFigure({...enemy,id:9},view.enemyTemplates),mesh=skins(a)[0];
    mesh.skeleton.computeBoneTexture();let textures=0,geometry=0,materials=0;mesh.skeleton.boneTexture.addEventListener('dispose',()=>textures++);mesh.geometry.addEventListener('dispose',()=>geometry++);mesh.material.addEventListener('dispose',()=>materials++);
    disposeEnemyFigure(a);disposeEnemyFigure(a);assert.equal(textures,1);assert.equal(geometry,0);assert.equal(materials,0);
    const before=pose(b);animateEnemyMotion(b,enemy,.35);assert.notDeepEqual(pose(b),before,'disposed peer stopped remaining flight');disposeEnemyFigure(b);
  }finally{disposeSource(source);}
});

test('Morvath visual flight cannot introduce attacks or change actual boss progression, hit points, statuses, leaks or simulation speed',async()=>{
  const source=await load('host_50'),templates=new Map([['host_50',source]]),games=[new Game(data,{seed:83}),new Game(data,{seed:83})],events=[[],[]];let figure;
  try{
    for(let index=0;index<2;index++){
      const game=games[index];game.phase='combat';game.combat.spawnQueue=[{time:9999,type:'grunt'}];const enemy=game.combat.spawn('host_50');
      game.on((type,payload)=>events[index].push([type,payload.enemy?.id??payload.source?.id??null,game.combat.elapsed]));
      if(index===1)figure=enemyFigure(enemy,templates);
    }
    for(let step=0;step<120;step++)for(let index=0;index<2;index++){
      const game=games[index];game.speed=step<40?1:step<80?3:2;game.paused=step>=50&&step<70;game.tick(.025);
      if(index===1)animateEnemyMotion(figure,game.combat.enemies[0],game.combat.elapsed);
    }
    assert.deepEqual(games[1].combat.enemies,games[0].combat.enemies);assert.deepEqual(events[1],events[0]);
    assert.ok(!events[1].some(([type])=>type==='shot'||type==='aura-attack'),'a locomotion clip added a combat mechanic');
    assert.equal(games[1].lives,games[0].lives);assert.equal(games[1].score,games[0].score);assert.equal(games[1].leaks,games[0].leaks);
  }finally{if(figure)disposeEnemyFigure(figure);disposeSource(source);}
});
