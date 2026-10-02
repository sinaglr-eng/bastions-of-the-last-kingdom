import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {cloneDefenderTemplate,disposeDefenderInstance,installDefenderTemplate} from '../game/render/defender-assets.js';
import {attackRig,triggerAttack,animateAttack,attackMuzzle,disposeAttack} from '../game/render/battle-animation.js';
import {createSecretAnimation,updateSecretAnimation,releaseSecretAttack,previewSecretAttack,updateSecretPreview,disposeSecretAnimation,SECRET_ATTACK_RELEASE,secretAttackContext} from '../game/render/secret-animation.js';
import {CombatEffects} from '../game/render/combat-effects.js';
import {animateSecretChampion} from '../game/render/secret-champions.js';
import {Game} from '../game/core/game.js';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const quaternions=angles=>angles.flatMap(angle=>new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),angle).toArray());
function assetFixture(){
  const source=new THREE.Group(),root=new THREE.Bone(),hand=new THREE.Bone();root.name='rig_root';hand.name='hand_R';hand.position.y=.7;root.add(hand);source.add(root);
  for(const name of ['staff_tip','sword_tip','attack_muzzle']){const tip=new THREE.Object3D();tip.name=name;tip.position.set(.08,.65,-.4);hand.add(tip);}
  const geometry=new THREE.BoxGeometry(.2,.6,.2),weights=[],indices=[];
  for(let i=0;i<geometry.attributes.position.count;i++){weights.push(1,0,0,0);indices.push(1,0,0,0);}
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshStandardMaterial({color:'#ede2be'}));mesh.name='Continuous skinned body';source.add(mesh);source.updateMatrixWorld(true);mesh.bind(new THREE.Skeleton([root,hand]));
  source.animations=[new THREE.AnimationClip('Idle',2.4,[new THREE.QuaternionKeyframeTrack('hand_R.quaternion',[0,1.2,2.4],quaternions([0,.025,0]))]),new THREE.AnimationClip('Attack',1,[new THREE.QuaternionKeyframeTrack('hand_R.quaternion',[0,.2,.36,.65,1],quaternions([0,-.2,-.45,.25,0]))])];
  return source;
}
const bonePose=actor=>actor.getObjectByName('hand_R').quaternion.toArray();
function cleanup(source,...actors){for(const actor of actors)disposeDefenderInstance(actor);source.traverse(node=>{node.geometry?.dispose();node.material?.dispose();});}

test('cached GLTF clips and independently cloned skeletons survive template installation and private animation',()=>{
  const source=assetFixture(),clips=source.animations,field={disposed:false,game:{towers:[],data:{towers:data.towers}},imported:new Map(),models:new Map()};
  installDefenderTemplate(field,{family:'ladyclaire',tier:1},source,clips);
  const a=cloneDefenderTemplate(source),b=cloneDefenderTemplate(source),ra=createSecretAnimation(a,'ladyclaire'),rb=createSecretAnimation(b,'ladyclaire'),original=bonePose(source),peer=bonePose(b);
  assert.ok(ra&&rb);assert.notEqual(a.getObjectByName('Continuous skinned body').skeleton,b.getObjectByName('Continuous skinned body').skeleton);assert.notEqual(a.getObjectByName('hand_R'),b.getObjectByName('hand_R'));assert.equal(a.animations[1],source.animations[1]);
  releaseSecretAttack(ra,{interval:.5,stamp:1});updateSecretAnimation(ra,.06,{stamp:2});
  assert.notDeepEqual(bonePose(a),original);assert.deepEqual(bonePose(source),original);assert.deepEqual(bonePose(b),peer);
  assert.equal(a.getObjectByName('Continuous skinned body').geometry,b.getObjectByName('Continuous skinned body').geometry);
  disposeSecretAnimation(ra);disposeSecretAnimation(rb);cleanup(source,a,b);
});

test('actual attack callback samples the exact native release pose before golden projectiles obtain their bone-following origin',()=>{
  for(const family of ['ladyclaire','lordbernhard']){
    const source=assetFixture(),actor=cloneDefenderTemplate(source);actor.position.set(7,.85,3);actor.rotation.y=.8;actor.scale.setScalar(.7);
    const rig=attackRig(actor,family,data.towers[family]),stats=data.towers[family],scene=new THREE.Scene(),fx=new CombatEffects(scene,{getMuzzle:(_source,out)=>attackMuzzle(rig,out)}),shot={id:1,source:{id:4,family,x:7,z:3},target:{id:8,x:2,z:4},progress:0,stats};
    const original={position:actor.position.toArray(),rotation:actor.rotation.y,scale:actor.scale.toArray()},before=attackMuzzle(rig).clone();
    triggerAttack(rig,{...shot,combatTime:1,visualRate:2});assert.equal(rig.native.phase,SECRET_ATTACK_RELEASE);
    const release=attackMuzzle(rig).clone();assert.ok(release.distanceTo(before)>.05);fx.event('shot',shot);
    const visual=fx.projectiles.get(1);assert.ok(visual.origin.distanceTo(release)<1e-12);assert.equal(visual.color,'#ffda72');assert.match(visual.object.name,/golden/);
    triggerAttack(rig,{...shot,id:2,combatTime:1});assert.equal(rig.native.phase,SECRET_ATTACK_RELEASE,'one volley emitted multiple animation strokes');
    animateAttack(rig,.1,1,{stamp:1});assert.equal(rig.native.phase,SECRET_ATTACK_RELEASE,'release frame drifted before it could be displayed');
    animateSecretChampion(actor,900);assert.equal(rig.native.phase,SECRET_ATTACK_RELEASE);
    assert.deepEqual(actor.position.toArray(),original.position);assert.equal(actor.rotation.y,original.rotation);assert.deepEqual(actor.scale.toArray(),original.scale);
    fx.dispose();disposeAttack(rig);cleanup(source,actor);
  }
});

test('predictive preparation responds to cooldown and haste; target loss and disarm cancel it without releasing an attack',()=>{
  const source=assetFixture(),actor=cloneDefenderTemplate(source),rig=createSecretAnimation(actor,'ladyclaire'),target={id:8};
  updateSecretAnimation(rig,.05,{combat:true,target,cooldown:.10,interval:.5,rate:1});assert.equal(rig.stage,'preparation');assert.ok(rig.phase>0&&rig.phase<SECRET_ATTACK_RELEASE);
  const phase=rig.phase;updateSecretAnimation(rig,0,{combat:true,target,cooldown:.05,interval:.5,rate:3});assert.equal(rig.phase,phase,'paused pose changed');
  updateSecretAnimation(rig,.03,{combat:true,target,cooldown:.03,interval:.5,rate:3});assert.equal(rig.stage,'preparation');assert.ok(rig.phase<SECRET_ATTACK_RELEASE);
  updateSecretAnimation(rig,.01,{combat:true,target:null,cooldown:.02,interval:.5,rate:3});assert.equal(rig.stage,'idle');assert.equal(rig.lastRelease,null);
  updateSecretAnimation(rig,.01,{combat:true,target,blocked:true,cooldown:.01,interval:.5,rate:3});assert.equal(rig.stage,'idle');assert.equal(rig.lastRelease,null);
  disposeSecretAnimation(rig);cleanup(source,actor);
});

test('recovery retains its released cadence without context and adapts immediately to changed attack speed without an artificial slow-motion floor',()=>{
  const source=assetFixture(),actor=cloneDefenderTemplate(source),rig=createSecretAnimation(actor,'ladyclaire');
  releaseSecretAttack(rig,{interval:.5,rate:2,stamp:1});const duration=rig.cycleDuration;updateSecretAnimation(rig,.01,{stamp:2});assert.equal(rig.cycleDuration,duration);
  updateSecretAnimation(rig,.01,{interval:.5,rate:4,stamp:3});assert.ok(Math.abs(rig.cycleDuration-.1125)<1e-12);
  releaseSecretAttack(rig,{interval:.5,rate:40,stamp:4});assert.ok(rig.cycleDuration<.5/40);assert.equal(rig.phase,SECRET_ATTACK_RELEASE);
  const phase=rig.phase;updateSecretAnimation(rig,0,{interval:.5,rate:1,stamp:5});assert.equal(rig.phase,phase);assert.equal(rig.rate,40,'paused pose/cadence changed');
  disposeSecretAnimation(rig);cleanup(source,actor);
});

test('exported preview crosses preparation, release and recovery once; pause freezes all bones and reduced motion uses authored rest',()=>{
  const source=assetFixture(),actor=cloneDefenderTemplate(source),rig=createSecretAnimation(actor,'lordbernhard'),rest=bonePose(actor);let releases=0;
  previewSecretAttack(rig);updateSecretPreview(rig,.2);assert.equal(rig.stage,'preview');assert.equal(rig.phase,.2);assert.notDeepEqual(bonePose(actor),rest);
  const phase=rig.phase,pose=bonePose(actor);updateSecretPreview(rig,0,{onRelease:()=>releases++});assert.equal(rig.phase,phase);assert.deepEqual(bonePose(actor),pose);
  updateSecretPreview(rig,.22,{onRelease:()=>{releases++;assert.equal(rig.phase,SECRET_ATTACK_RELEASE);}});assert.equal(releases,1);
  updateSecretPreview(rig,2,{onRelease:()=>releases++});assert.equal(releases,1);assert.equal(rig.stage,'idle');
  previewSecretAttack(rig);updateSecretPreview(rig,.25,{reducedMotion:true});assert.deepEqual(bonePose(actor),rest);
  disposeSecretAnimation(rig);cleanup(source,actor);
});

test('disposing one rig and its skeleton texture does not dispose shared meshes or stop a peer',()=>{
  const source=assetFixture(),a=cloneDefenderTemplate(source),b=cloneDefenderTemplate(source),ra=attackRig(a,'ladyclaire',data.towers.ladyclaire),rb=attackRig(b,'ladyclaire',data.towers.ladyclaire),mesh=a.getObjectByName('Continuous skinned body');
  mesh.skeleton.computeBoneTexture();let textures=0,geometries=0,materials=0;mesh.skeleton.boneTexture.addEventListener('dispose',()=>textures++);mesh.geometry.addEventListener('dispose',()=>geometries++);mesh.material.addEventListener('dispose',()=>materials++);
  disposeAttack(ra);disposeAttack(ra);disposeDefenderInstance(a);disposeDefenderInstance(a);assert.equal(textures,1);assert.equal(geometries,0);assert.equal(materials,0);
  triggerAttack(rb,{stats:data.towers.ladyclaire,combatTime:2});animateAttack(rb,.05,0,{stamp:3});assert.equal(rb.native.stage,'recovery');assert.equal(rb.native.disposed,false);
  disposeAttack(rb);cleanup(source,b);
});

test('native rig precedence allows private decorative orbits while preserving authored horse bones and frozen simulation time',()=>{
  const source=assetFixture();for(let i=0;i<3;i++){const orb=new THREE.Group();orb.name='secret_orb_'+i;orb.position.set(.43*Math.cos(i*Math.PI*2/3),1.6+i*.08,.43*Math.sin(i*Math.PI*2/3));orb.userData.orbitRadius=.43;source.add(orb);}
  const leg=new THREE.Group();leg.name='leg_horse_L_front';leg.rotation.x=.12;source.add(leg);
  const actor=cloneDefenderTemplate(source),peer=cloneDefenderTemplate(source),rig=createSecretAnimation(actor,'ladyclaire'),orb=actor.getObjectByName('secret_orb_0'),rest=orb.position.clone(),bones=bonePose(actor);
  animateSecretChampion(actor,0);animateSecretChampion(actor,.2);const moved=orb.position.clone();assert.ok(moved.distanceTo(rest)>.03);assert.ok(Math.abs(actor.getObjectByName('leg_horse_L_front').rotation.x-.12)<1e-12);assert.deepEqual(bonePose(actor),bones);
  animateSecretChampion(actor,.2);assert.ok(orb.position.equals(moved),'paused simulation moved an orb');assert.ok(peer.getObjectByName('secret_orb_0').position.equals(rest));
  animateSecretChampion(actor,.4,{reducedMotion:true});assert.ok(orb.position.equals(rest));disposeSecretAnimation(rig);cleanup(source,actor,peer);
});

test('Secret projectile spin and emitted chains freeze with simulation time while ordinary defender presentation keeps its existing clock',()=>{
  let simulationTime=1;const fx=new CombatEffects(new THREE.Scene(),{getSimulationTime:()=>simulationTime}),makeShot=(family,id)=>({id,source:{id:10,family,x:0,z:0},target:{id:20,x:5,z:0},stats:{type:'arcane'},progress:.4}),shots=[makeShot('ladyclaire',1),makeShot('lordbernhard',2),makeShot('mage',3)];
  fx.syncProjectiles(shots,1);const rotations=shots.map(shot=>fx.projectiles.get(shot.id).object.quaternion.toArray());fx.syncProjectiles(shots,2);
  assert.deepEqual(fx.projectiles.get(1).object.quaternion.toArray(),rotations[0]);assert.deepEqual(fx.projectiles.get(2).object.quaternion.toArray(),rotations[1]);assert.notDeepEqual(fx.projectiles.get(3).object.quaternion.toArray(),rotations[2]);
  fx.chain({from:{id:9,x:2,z:0},to:shots[0].target,color:'#ffd969'});const chain=fx.effects.at(-1);fx.update(.01,2);const vertices=Array.from(chain.object.geometry.attributes.position.array);fx.update(0,50);assert.deepEqual(Array.from(chain.object.geometry.attributes.position.array),vertices);
  simulationTime+=.2;fx.syncProjectiles(shots,51);assert.notDeepEqual(fx.projectiles.get(1).object.quaternion.toArray(),rotations[0]);fx.dispose();
});

test('native presentation preserves real combat cadence, damage, targets, poison, lightning procs, Melancholy, pause and simulation speed',()=>{
  const games=[new Game(data,{seed:730}),new Game(data,{seed:730})],events=[[],[]],source=assetFixture(),models=new Map(),fx=new CombatEffects(new THREE.Scene(),{getMuzzle:(tower,out)=>attackMuzzle(models.get(tower.id),out)});
  for(let index=0;index<games.length;index++){
    const game=games[index];game.phase='combat';game.combat.spawnQueue=[{time:9999,type:'grunt'}];
    game.towers=[{id:1,family:'ladyclaire',tier:1,state:'active',x:17,z:17,cooldown:0,kills:0},{id:2,family:'lordbernhard',tier:1,state:'active',x:18,z:17,cooldown:0,kills:0},{id:3,family:'cleric',tier:4,state:'active',x:17,z:18,cooldown:0,kills:0}];
    for(let id=0;id<8;id++){const enemy=game.combat.spawn('grunt');enemy.x=17+id*.2;enemy.z=13+id*.2;enemy.speed=0;enemy.hp=enemy.maxHp=1e9;enemy.untouchable=id===0?.12:0;}
    if(index===1)for(const tower of game.towers.slice(0,2)){const actor=cloneDefenderTemplate(source);models.set(tower.id,attackRig(actor,tower.family,data.towers[tower.family]));}
    game.on((type,payload)=>{
      if(['shot','impact','chain','melancholy'].includes(type))events[index].push([type,payload.id??null,payload.source?.id??payload.from?.id??null,payload.target?.id??payload.to?.id??null,game.combat.elapsed]);
      if(index===1){if(type==='shot'&&models.has(payload.source.id))triggerAttack(models.get(payload.source.id),{...payload,combatTime:game.combat.elapsed,visualRate:secretAttackContext(payload.source,game).rate});fx.event(type,payload);}
    });
  }
  for(let step=0;step<240;step++)for(let index=0;index<games.length;index++){
    const game=games[index];game.speed=step<80?1:step<160?3:2;game.paused=step>=100&&step<120;game.tick(.025);
    if(index===1){const dt=game.paused?0:.025*game.speed;for(const tower of game.towers.slice(0,2))animateAttack(models.get(tower.id),dt,game.combat.elapsed,secretAttackContext(tower,game));fx.syncProjectiles(game.combat.projectiles,game.combat.elapsed);fx.update(dt,game.combat.elapsed);}
  }
  assert.deepEqual(events[1],events[0]);assert.ok(events[0].filter(event=>event[0]==='shot').length>15);assert.ok(events[0].some(event=>event[0]==='chain'));assert.ok(events[0].some(event=>event[0]==='melancholy'));
  assert.deepEqual(games[1].towers,games[0].towers);assert.deepEqual(games[1].combat.enemies,games[0].combat.enemies);assert.equal(games[1].score,games[0].score);assert.equal(games[1].lives,games[0].lives);
  for(const rig of models.values()){disposeAttack(rig);disposeDefenderInstance(rig.actor);}fx.dispose();cleanup(source);
});

test('Claire imported GLTF axes preserve all authored orb start positions before their independent idle motion',async()=>{
  const bytes=readFileSync(new URL('../public/assets/models/advanced_ladyclaire.glb',import.meta.url)),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  gltf.scene.animations=gltf.animations;const actor=cloneDefenderTemplate(gltf.scene),peer=cloneDefenderTemplate(gltf.scene),rig=createSecretAnimation(actor,'ladyclaire'),orbs=[0,1,2].map(i=>actor.getObjectByName('secret_orb_'+i)),rest=orbs.map(orb=>orb.position.clone());
  assert.ok(rest[1].z<0&&rest[2].z>0,'fixture must contain actual Blender Y to GLTF Z conversion');
  animateSecretChampion(actor,0);
  for(let i=0;i<orbs.length;i++)assert.ok(orbs[i].position.distanceTo(rest[i])<1e-7,'first idle sample jumped orb '+i+' horizontally or vertically');
  animateSecretChampion(actor,.2);const moved=orbs.map(orb=>orb.position.clone());
  for(let i=0;i<orbs.length;i++){
    assert.ok(moved[i].distanceTo(rest[i])>.01,'decorative orb did not animate');
    assert.ok(Math.abs(Math.hypot(moved[i].x,moved[i].z)-.43)<1e-7,'orbit radius changed');
    assert.ok(peer.getObjectByName('secret_orb_'+i).position.equals(rest[i]),'peer orb moved');
  }
  animateSecretChampion(actor,.2);for(let i=0;i<orbs.length;i++)assert.ok(orbs[i].position.equals(moved[i]),'paused orb moved');
  animateSecretChampion(actor,.3,{reducedMotion:true});for(let i=0;i<orbs.length;i++)assert.ok(orbs[i].position.equals(rest[i]),'reduced motion failed to restore authored orb');
  const lateRig=createSecretAnimation(peer,'ladyclaire');animateSecretChampion(peer,42);
  for(let i=0;i<orbs.length;i++)assert.ok(peer.getObjectByName('secret_orb_'+i).position.distanceTo(rest[i])<1e-7,'model loaded during combat did not start at authored orb position');
  animateSecretChampion(peer,42.2);assert.ok(peer.getObjectByName('secret_orb_0').position.distanceTo(rest[0])>.01);
  disposeSecretAnimation(rig);disposeSecretAnimation(lateRig);cleanup(gltf.scene,actor,peer);
});

test('both production GLBs drive real weighted surfaces and weapon sockets through their own exported skeleton and clips',async()=>{
  for(const family of ['ladyclaire','lordbernhard']){
    const bytes=readFileSync(new URL(`../public/assets/models/advanced_${family}.glb`,import.meta.url)),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    gltf.scene.animations=gltf.animations;assert.deepEqual(gltf.animations.map(clip=>clip.name).sort(),['Attack','Idle']);
    const actor=cloneDefenderTemplate(gltf.scene),peer=cloneDefenderTemplate(gltf.scene),rig=attackRig(actor,family,data.towers[family]);assert.ok(rig.native,family+' did not obtain a real skeletal animation controller');
    assert.ok(Math.abs(rig.native.attackClip.duration-1)<.001);assert.ok(Math.abs(rig.native.idleClip.duration-2.4)<.001);
    const skinned=[],samples=[];actor.traverse(node=>{if(node.isSkinnedMesh)skinned.push(node);});assert.ok(skinned.length>0);assert.equal(new Set(skinned.map(mesh=>mesh.skeleton)).size,1,'material batches multiplied private bone textures');
    actor.updateMatrixWorld(true);
    for(const mesh of skinned)for(let i=0;i<mesh.geometry.attributes.position.count;i+=Math.max(1,Math.floor(mesh.geometry.attributes.position.count/80))){const vertex=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i);samples.push({mesh,i,rest:mesh.applyBoneTransform(i,vertex).applyMatrix4(mesh.matrixWorld)});}
    const cachedBones=gltf.scene.getObjectByProperty('isSkinnedMesh',true).skeleton.bones.map(bone=>bone.quaternion.toArray()),peerBones=peer.getObjectByProperty('isSkinnedMesh',true).skeleton.bones.map(bone=>bone.quaternion.toArray()),tip=attackMuzzle(rig).clone();
    previewSecretAttack(rig.native);updateSecretPreview(rig.native,.36);
    let moved=0;for(const {mesh,i,rest}of samples){const vertex=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i);if(mesh.applyBoneTransform(i,vertex).applyMatrix4(mesh.matrixWorld).distanceTo(rest)>.001)moved++;}
    assert.ok(moved>10,family+' clip only moved unweighted empties');assert.ok(attackMuzzle(rig).distanceTo(tip)>.01,family+' release socket does not follow the animated hand/weapon');
    assert.deepEqual(gltf.scene.getObjectByProperty('isSkinnedMesh',true).skeleton.bones.map(bone=>bone.quaternion.toArray()),cachedBones);assert.deepEqual(peer.getObjectByProperty('isSkinnedMesh',true).skeleton.bones.map(bone=>bone.quaternion.toArray()),peerBones);
    disposeAttack(rig);cleanup(gltf.scene,actor,peer);
  }
});
