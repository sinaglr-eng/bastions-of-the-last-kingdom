import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {attackRig,triggerAttack,animateAttack,attackMuzzle,disposeAttack} from '../game/render/battle-animation.js';
import {previewDefenderAttack,updateDefenderPreview,defenderAttackContext} from '../game/render/defender-animation.js';
import {Game} from '../game/core/game.js';

const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,json(`../data/${key}.json`)]));
const manifest=json('../public/assets/models/manifest.json');
const active=Object.keys(data.towers).filter(family=>!data.towers[family].hidden);
const entries=active.map(family=>manifest.find(entry=>entry.kind==='tower'&&entry.family===family&&entry.tier===1));
async function load(entry){
  const bytes=readFileSync(new URL('../public/assets/models/'+entry.file,import.meta.url));
  const gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  gltf.scene.animations=gltf.animations;gltf.scene.updateMatrixWorld(true);return gltf.scene;
}
const skins=root=>{const result=[];root.traverse(node=>{if(node.isSkinnedMesh)result.push(node);});return result;};
const bonePose=root=>skins(root)[0].skeleton.bones.map(bone=>[bone.name,...bone.position.toArray(),...bone.quaternion.toArray(),...bone.scale.toArray()]);
function worldVertex(mesh,index){return mesh.getVertexPosition(index,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);}
function samples(root){
  root.updateMatrixWorld(true);const result=[];
  for(const mesh of skins(root))for(let index=0;index<mesh.geometry.attributes.position.count;index+=Math.max(1,Math.floor(mesh.geometry.attributes.position.count/100)))result.push({mesh,index,point:worldVertex(mesh,index)});
  return result;
}
function disposeSource(source){
  const resources=new Set();source.traverse(node=>{if(node.geometry)resources.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])if(material){resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);}});
  for(const resource of resources)resource.dispose();
}

test('every available family loads a real weighted GLB armature, two complete clips and a bone-attached release socket',async()=>{
  assert.equal(active.length,46);assert.ok(entries.every(Boolean));
  for(const entry of entries){
    const source=await load(entry),actor=cloneDefenderTemplate(source),peer=cloneDefenderTemplate(source),rig=attackRig(actor,entry.family,data.towers[entry.family]);
    try{
      assert.ok(rig.native,entry.family+' silently fell back to rigid posing');
      assert.deepEqual(source.animations.map(clip=>clip.name).sort(),['Attack','Idle'],entry.family);
      assert.ok(Math.abs(rig.native.attackClip.duration-1)<.001,entry.family+' complete Attack duration');
      assert.ok(Math.abs(rig.native.idleClip.duration-2.4)<.001,entry.family+' complete Idle duration');
      const meshes=skins(actor);assert.ok(meshes.length>0,entry.family+' has no weighted renderable surface');
      assert.equal(new Set(meshes.map(mesh=>mesh.skeleton)).size,1,entry.family+' duplicated bone textures per material batch');
      const used=new Set();
      for(const mesh of meshes){
        const weights=mesh.geometry.attributes.skinWeight,indices=mesh.geometry.attributes.skinIndex;
        assert.equal(weights.count,mesh.geometry.attributes.position.count);assert.equal(indices.count,weights.count);
        for(let vertex=0;vertex<weights.count;vertex++){
          let total=0;
          for(let influence=0;influence<4;influence++){
            const weight=weights.getComponent(vertex,influence),bone=indices.getComponent(vertex,influence);
            assert.ok(Number.isFinite(weight)&&weight>=0&&weight<=1,entry.family+' invalid skin weight');
            assert.ok(Number.isInteger(bone)&&bone>=0&&bone<mesh.skeleton.bones.length,entry.family+' invalid deform bone');
            total+=weight;if(weight>.001)used.add(bone);
          }
          assert.ok(Math.abs(total-1)<.001,entry.family+' unnormalised skin weights');
        }
      }
      assert.ok(used.size>=3,entry.family+' assigned the whole model to a single bone');
      let socketBone=rig.muzzle;while(socketBone&&!socketBone.isBone)socketBone=socketBone.parent;
      assert.ok(socketBone,entry.family+' effect origin is a detached empty');
      const original=bonePose(source),other=bonePose(peer),rest=samples(actor),tip=attackMuzzle(rig).clone();
      previewDefenderAttack(rig.native);updateDefenderPreview(rig.native,.36);
      assert.ok(rest.filter(({mesh,index,point})=>worldVertex(mesh,index).distanceTo(point)>.001).length>5,entry.family+' clip moved names but not the actual weighted surface');
      assert.ok(attackMuzzle(rig).distanceTo(tip)>1e-5,entry.family+' release socket did not follow anatomy/equipment');
      assert.deepEqual(bonePose(source),original,entry.family+' changed cached skeleton');assert.deepEqual(bonePose(peer),other,entry.family+' changed a peer skeleton');
      assert.ok(skins(actor).every((mesh,index)=>mesh.geometry===skins(peer)[index].geometry),entry.family+' copied shared immutable geometry');
    }finally{disposeAttack(rig);disposeDefenderInstance(actor);disposeDefenderInstance(peer);disposeSource(source);}
  }
});

test('every family preserves the exact release frame, freezes on pause and completes compressed recovery at changing attack rates',async()=>{
  for(const entry of entries){
    const source=await load(entry),actor=cloneDefenderTemplate(source),rig=attackRig(actor,entry.family,data.towers[entry.family]);
    try{
      assert.ok(rig.native,entry.family);actor.position.set(4,.85,7);actor.rotation.y=.8;actor.scale.setScalar(.72);
      const transform=[actor.position.toArray(),actor.rotation.toArray(),actor.scale.toArray()];
      triggerAttack(rig,{stats:{interval:.5},visualRate:2,combatTime:1});
      assert.equal(rig.native.phase,rig.native.release);assert.ok(Math.abs(rig.native.cycleDuration-.225)<1e-9);
      const pose=bonePose(actor),phase=rig.native.phase,muzzle=attackMuzzle(rig).toArray();
      animateAttack(rig,0,500,{combat:true,interval:.5,rate:40,cooldown:0,target:{id:2},stamp:2});
      assert.equal(rig.native.phase,phase);assert.deepEqual(bonePose(actor),pose);assert.deepEqual(attackMuzzle(rig).toArray(),muzzle);
      triggerAttack(rig,{stats:{interval:.5},visualRate:2,combatTime:1});assert.equal(rig.native.phase,phase,'multishot restarted '+entry.family);
      animateAttack(rig,.01,1,{interval:.5,rate:4,stamp:2});assert.ok(Math.abs(rig.native.cycleDuration-.1125)<1e-9);
      animateAttack(rig,.12,1,{interval:.5,rate:4,stamp:3});assert.equal(rig.native.stage,'idle',entry.family+' recovery exceeds effective cadence');
      assert.deepEqual([actor.position.toArray(),actor.rotation.toArray(),actor.scale.toArray()],transform,entry.family+' substituted whole-actor rocking');
      let releases=0;previewDefenderAttack(rig.native);updateDefenderPreview(rig.native,.9,{onRelease:()=>{releases++;assert.equal(rig.native.phase,rig.native.release);}});updateDefenderPreview(rig.native,.3,{onRelease:()=>releases++});
      assert.equal(releases,1,entry.family+' large simulation step duplicated/missed the authored release');
      assert.equal(rig.native.stage,'idle');
    }finally{disposeAttack(rig);disposeDefenderInstance(actor);disposeSource(source);}
  }
});

test('native animation for every available family leaves actual combat events, damage, statuses and cadence unchanged at 1×/3×/2× with pause and target changes',async()=>{
  for(const entry of entries){
    const source=await load(entry),actor=cloneDefenderTemplate(source),rig=attackRig(actor,entry.family,data.towers[entry.family]),games=[new Game(data,{seed:390}),new Game(data,{seed:390})],events=[[],[]];
    try{
      for(let index=0;index<2;index++){
        const game=games[index];game.phase='combat';game.combat.spawnQueue=[{time:9999,type:'grunt'}];
        game.towers=[{id:1,family:entry.family,tier:1,state:'active',x:17,z:17,kills:0,cooldown:0},{id:2,family:'cleric',tier:4,state:'active',x:17,z:18,kills:0,cooldown:999}];
        for(let i=0;i<8;i++){const enemy=game.combat.spawn('grunt');Object.assign(enemy,{x:17.5+i*.1,z:17.2,hp:1e9,maxHp:1e9,speed:0,untouchable:i===0?.17:0});}
        game.on((type,payload)=>{
          if(['shot','aura-attack','impact','hit','chain','melancholy','recover','death'].includes(type))events[index].push([type,payload.id??null,payload.source?.id??payload.from?.id??null,payload.target?.id??payload.enemy?.id??payload.to?.id??null,payload.damage??null,game.combat.elapsed]);
          if(index===1&&['shot','aura-attack'].includes(type)&&payload.source.id===1){
            triggerAttack(rig,{...payload,combatTime:game.combat.elapsed,visualRate:defenderAttackContext(payload.source,game).rate});
            assert.equal(rig.native.phase,rig.native.release,entry.family+' failed to pose at actual effect');
          }
        });
      }
      for(let step=0;step<100;step++)for(let index=0;index<2;index++){
        const game=games[index];game.speed=step<30?1:step<70?3:2;game.paused=step>=50&&step<60;
        if(step===35)game.combat.enemies[0].dead=true;
        game.tick(.025);
        if(index===1)animateAttack(rig,game.paused?0:.025*game.speed,game.combat.elapsed,defenderAttackContext(game.towers[0],game));
      }
      assert.deepEqual(events[1],events[0],entry.family+' presentation changed combat events');
      assert.deepEqual(games[1].towers,games[0].towers,entry.family+' presentation changed tower state');
      assert.deepEqual(games[1].combat.enemies,games[0].combat.enemies,entry.family+' presentation changed enemy damage/statuses');
      assert.equal(games[1].score,games[0].score);assert.equal(games[1].lives,games[0].lives);
      assert.ok(events[0].some(([type])=>type==='shot'||type==='aura-attack'),entry.family+' test did not exercise an actual attack');
    }finally{disposeAttack(rig);disposeDefenderInstance(actor);disposeSource(source);}
  }
});

test('all three mounted champions keep real saddle and boot contacts throughout complete native Idle and Attack clips',async()=>{
  for(const family of ['thunderheart','phoenix','griffinbomber']){
    const source=await load(entries.find(entry=>entry.family===family)),actor=cloneDefenderTemplate(source),mixer=new THREE.AnimationMixer(actor);
    try{
      const pairs=[['rider_seat_contact','saddle_contact'],['boot_sole_L','stirrup_tread_L'],['boot_sole_R','stirrup_tread_R']];
      for(const pair of pairs)assert.ok(pair.every(name=>actor.getObjectByName(name)),family+' missing authored physical contact');
      const meshes=skins(actor),bones=meshes[0].skeleton.bones,seatSurface=[],riderSurface=[];
      for(const mesh of meshes)for(let vertex=0;vertex<mesh.geometry.attributes.position.count;vertex++){
        let saddle=false,rider=false;
        for(let slot=0;slot<4;slot++)if(mesh.geometry.attributes.skinWeight.getComponent(vertex,slot)>.5){
          const bone=bones[mesh.geometry.attributes.skinIndex.getComponent(vertex,slot)];saddle||=bone.name==='spine'&&/leather/i.test(mesh.material.name);
          let parent=bone;while(parent){rider||=parent.name==='rider_pelvis';parent=parent.parent;}
        }
        if(saddle)seatSurface.push({mesh,vertex});if(rider)riderSurface.push({mesh,vertex});
      }
      assert.ok(seatSurface.length>30&&riderSurface.length>30,family+' contact markers have no actual weighted saddle/rider surfaces');
      const nearestSurface=(surface,contact)=>{
        const allowed=new Map();for(const {mesh,vertex}of surface){if(!allowed.has(mesh))allowed.set(mesh,new Set());allowed.get(mesh).add(vertex);}
        let nearest=Infinity;const triangle=new THREE.Triangle(),closest=new THREE.Vector3();
        for(const [mesh,vertices]of allowed){
          const index=mesh.geometry.index,count=index?.count??mesh.geometry.attributes.position.count;
          for(let face=0;face<count;face+=3){
            const ids=[0,1,2].map(offset=>index?index.getX(face+offset):face+offset);if(!ids.every(id=>vertices.has(id)))continue;
            triangle.set(...ids.map(id=>worldVertex(mesh,id)));if(triangle.getArea()<1e-12)continue;triangle.closestPointToPoint(contact,closest);nearest=Math.min(nearest,closest.distanceTo(contact));
          }
        }return nearest;
      };
      for(const clip of actor.animations){
        mixer.stopAllAction();const action=mixer.clipAction(clip);action.play();action.paused=true;
        for(let frame=0;frame<=120;frame++){
          action.time=frame/120*clip.duration;mixer.update(0);actor.updateMatrixWorld(true);
          for(const [rider,saddle]of pairs)assert.ok(actor.getObjectByName(rider).getWorldPosition(new THREE.Vector3()).distanceTo(actor.getObjectByName(saddle).getWorldPosition(new THREE.Vector3()))<.01,family+' '+clip.name+' detached '+rider+' on frame '+frame);
          if([0,24,43,72,120].includes(frame)){
            const contact=actor.getObjectByName('saddle_contact').getWorldPosition(new THREE.Vector3());
            for(const [label,surface]of [['seat',seatSurface],['rider',riderSurface]]){const gap=nearestSurface(surface,contact);assert.ok(gap<.035,family+' '+clip.name+' frame '+frame+' actual '+label+' surface gap '+gap);}
          }
        }
      }
    }finally{mixer.stopAllAction();mixer.uncacheRoot(actor);disposeDefenderInstance(actor);disposeSource(source);}
  }
});
