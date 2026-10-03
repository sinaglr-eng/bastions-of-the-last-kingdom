import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {animateEnemyMotion} from '../game/render/enemy-motion.js';
import {createGeometricMotionRig} from '../game/render/geometric-motion.js';
import {attackRig,triggerAttack,animateAttack,beginDeath,animateDeath,disposeAttack,previewGeometricAttack,updateGeometricPreview} from '../game/render/battle-animation.js';
import {EnemyAbilityEffects,enemyDefenseVisualState} from '../game/render/geometric-enemy-effects.js';
import {CombatEffects,attackVisualKind} from '../game/render/combat-effects.js';

function joint(parent,name,position=[0,0,0]){const node=new THREE.Group();node.name=name;node.position.set(...position);parent.add(node);return node;}
function actor(style='sword',locomotion='biped'){
  const root=new THREE.Group();root.userData.geometricRig=true;root.userData.attackStyle=style;root.userData.locomotion=locomotion;root.userData.bodyHeight=1.8;
  const torso=joint(root,'torso_pivot',[0,1,0]),head=joint(torso,'head_pivot',[0,.5,0]);
  const geometry=new THREE.BoxGeometry(.3,.38,.26),material=new THREE.MeshBasicMaterial({color:'#d9b78f'}),face=new THREE.Mesh(geometry,material),helmet=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#9babb2'}));
  helmet.scale.set(1.15,1.15,1.15);head.add(face,helmet);
  for(const side of ['R','L']){const arm=joint(torso,'upper_arm_'+side,[side==='R'?.3:-.3,.26,0]),forearm=joint(arm,'forearm_'+side,[0,-.22,0]),hand=joint(forearm,'hand_'+side,[0,-.2,0]);joint(hand,'weapon_'+side);}
  const weapon=root.getObjectByName('weapon_R'),muzzle=joint(weapon,'attack_muzzle',[0,.6,0]);weapon.add(new THREE.Mesh(new THREE.BoxGeometry(.04,.7,.04),new THREE.MeshBasicMaterial()));
  for(const side of locomotion==='quadruped'?['FL','FR','BL','BR']:['L','R']){const hip=joint(root,'upper_leg_'+side,[side.endsWith('R')?.15:-.15,1,side.startsWith('F')?-.32:side.startsWith('B')?.32:0]),knee=joint(hip,'shin_'+side,[0,-.5,0]),foot=joint(knee,'foot_'+side,[0,-.45,0]);const boot=new THREE.Mesh(new THREE.BoxGeometry(.15,.10,.25),new THREE.MeshBasicMaterial());boot.position.y=-.015;foot.add(boot);}
  if(locomotion==='flying')for(const side of ['L','R']){const wing=joint(torso,'wing_'+side,[side==='L'?-.2:.2,0,0]);const mesh=new THREE.Mesh(new THREE.BoxGeometry(.7,.06,.3),new THREE.MeshBasicMaterial());mesh.position.x=side==='L'?-.35:.35;wing.add(mesh);}
  root.updateMatrixWorld(true);return {root,face,helmet,muzzle};
}
function figure(style='sword',locomotion='biped'){const a=actor(style,locomotion),root=new THREE.Group();root.add(a.root);root.userData.body=a.root;return {...a,actor:a.root,root};}
const pose=root=>{root.updateMatrixWorld(true);const result=[];root.traverse(node=>result.push([node.name,...node.position.toArray(),...node.rotation.toArray(),...node.scale.toArray()]));return result;};
const finiteScene=root=>root.traverse(node=>{for(const value of [...node.position.toArray(),...node.scale.toArray(),...node.quaternion.toArray()])assert.ok(Number.isFinite(value),node.name);});
function cleanup(root){const resources=new Set();root.traverse(node=>{if(node.geometry)resources.add(node.geometry);for(const m of Array.isArray(node.material)?node.material:[node.material])if(m)resources.add(m);});for(const resource of resources)resource.dispose();}

test('distance-driven geometric gait plants soles, bends knees and cannot mutate another clone or cached mesh',()=>{
  const f=figure(),source=f.actor.clone(true),peer=source.clone(true),before=pose(source),peerBefore=pose(peer),vertices=Array.from(f.face.geometry.attributes.position.array);
  const enemy={id:0,speed:1,traveled:0,statuses:{}};animateEnemyMotion(f.root,enemy,0);
  const rig=f.root.userData.geometricMotion;assert.ok(rig.legs.every(leg=>leg.ik));
  const foot=f.actor.getObjectByName('foot_L'),position=new THREE.Vector3();
  f.root.updateMatrixWorld(true);const initial=foot.getWorldPosition(position).clone();
  enemy.traveled=.04;f.root.position.z=-enemy.traveled;animateEnemyMotion(f.root,enemy,.04);f.root.updateMatrixWorld(true);
  assert.ok(foot.getWorldPosition(position).distanceTo(initial)<1e-7,'support foot stays at the same actual world position during forward travel');
  assert.ok(f.actor.getObjectByName('shin_L').rotation.x>.02);
  enemy.traveled=.32;animateEnemyMotion(f.root,enemy,.32);assert.notDeepEqual(pose(f.actor),before);
  const phase=rig.phase;enemy.traveled+=7;animateEnemyMotion(f.root,enemy,.36);assert.equal(rig.phase,phase,'teleport travel is not a stride');
  const frozen=pose(f.root);animateEnemyMotion(f.root,enemy,.36);assert.deepEqual(pose(f.root),frozen,'paused clock never advances walking');
  assert.deepEqual(pose(source),before);assert.deepEqual(pose(peer),peerBefore);assert.deepEqual(Array.from(f.face.geometry.attributes.position.array),vertices);
  animateEnemyMotion(f.root,enemy,1,{reducedMotion:true});const still=pose(f.root);animateEnemyMotion(f.root,enemy,40,{reducedMotion:true});assert.deepEqual(pose(f.root),still);
  for(const t of [NaN,Infinity,-50]){animateEnemyMotion(f.root,enemy,t);finiteScene(f.root);}
  cleanup(f.root);
});

test('quadruped diagonal pairs trot together while flying joints flap in opposite directions and frozen legs settle',()=>{
  const q=figure('sword','quadruped'),e={id:0,speed:1,traveled:0,statuses:{}};animateEnemyMotion(q.root,e,0);e.traveled=.2;animateEnemyMotion(q.root,e,.2);
  assert.equal(q.actor.getObjectByName('upper_leg_FL').rotation.x,q.actor.getObjectByName('upper_leg_BR').rotation.x);
  assert.equal(q.actor.getObjectByName('upper_leg_FR').rotation.x,q.actor.getObjectByName('upper_leg_BL').rotation.x);
  assert.notEqual(q.actor.getObjectByName('upper_leg_FL').rotation.x,q.actor.getObjectByName('upper_leg_FR').rotation.x);
  e.statuses.freeze={time:1};animateEnemyMotion(q.root,e,.3);assert.equal(q.actor.getObjectByName('upper_leg_FL').rotation.x,0);
  const f=figure('breath','flying'),bird={id:3,flying:true,model:'dragon',speed:1,statuses:{}};animateEnemyMotion(f.root,bird,(Math.PI/2-bird.id*1.618+20*Math.PI)/3.4);
  const left=f.actor.getObjectByName('wing_L').rotation.z,right=f.actor.getObjectByName('wing_R').rotation.z;assert.ok(Math.abs(left)>.1);assert.ok(Math.abs(left+right)<1e-10);
  bird.statuses.petrify={time:2};assert.equal(animateEnemyMotion(f.root,bird,20),0);assert.equal(f.actor.getObjectByName('wing_L').rotation.z,0);assert.equal(f.actor.getObjectByName('wing_R').rotation.z,0,'petrified flight cannot continue flapping');
  cleanup(q.root);cleanup(f.root);
});

test('a grounded actual combat variant overrides flying source metadata instead of visibly flapping and levitating',()=>{
  const f=figure('staff','flying'),enemy={id:1,flying:false,speed:1,traveled:0,statuses:{}};animateEnemyMotion(f.root,enemy,0);enemy.traveled=.1;const bob=animateEnemyMotion(f.root,enemy,.1);
  assert.equal(f.actor.getObjectByName('wing_L').rotation.z,0);assert.equal(f.actor.getObjectByName('wing_R').rotation.z,0);assert.ok(bob<.02);assert.notEqual(f.actor.getObjectByName('upper_leg_L').rotation.x,f.actor.getObjectByName('upper_leg_R').rotation.x);cleanup(f.root);
});

test('the mechanical fixed-wing enemy banks its entire vehicle while keeping rigid metal wings at their authored angles',()=>{
  const f=figure('crossbow','flying'),enemy={id:28,flying:true,designArchetype:'wing-scrapper',speed:1,statuses:{}};
  for(const time of [0,.1,.3,1]){const bob=animateEnemyMotion(f.root,enemy,time);assert.equal(f.actor.getObjectByName('wing_L').rotation.z,0);assert.equal(f.actor.getObjectByName('wing_R').rotation.z,0);assert.ok(Math.abs(bob)<=.045);}
  assert.notEqual(f.actor.rotation.z,0,'the complete rigid vehicle visibly banks');const frozen=pose(f.root);animateEnemyMotion(f.root,enemy,1);assert.deepEqual(pose(f.root),frozen,'paused flight stays still');cleanup(f.root);
});

test('atelier samples the actual geometric release once before obtaining its moving muzzle and restores the authored pose',()=>{
  const a=actor('spear'),rig=attackRig(a.root,'soldier',{melee:true}),before=pose(a.root);assert.equal(previewGeometricAttack(rig,{duration:1}),true);let releases=0;
  updateGeometricPreview(rig,.2);const paused=pose(a.root);updateGeometricPreview(rig,0);assert.deepEqual(pose(a.root),paused);
  updateGeometricPreview(rig,.5,{onRelease:({elapsedAfterRelease})=>{releases++;assert.equal(rig.elapsed,.42);assert.ok(Math.abs(elapsedAfterRelease-.28)<1e-12);assert.ok(a.root.getObjectByName('upper_arm_R').rotation.x>1);}});
  updateGeometricPreview(rig,1);updateGeometricPreview(rig,1);assert.equal(releases,1);assert.equal(rig.active,false);assert.deepEqual(pose(a.root),before);disposeAttack(rig);cleanup(a.root);
});

test('geometric spear, sword and crossbow releases use distinct real held-weapon motion, preserving aim and helmet cover',()=>{
  const poses=[];
  for(const style of ['spear','sword','crossbow']){
    const a=actor(style);a.root.position.set(3,.6,8);a.root.rotation.y=1.3;a.root.scale.setScalar(.7);
    const faceRelative=a.face.matrix.clone(),rig=attackRig(a.root,style==='crossbow'?'runebreaker':'soldier',{type:'physical',melee:style!=='crossbow'}),before=pose(a.root),vertices=Array.from(a.face.geometry.attributes.position.array);
    animateAttack(rig,.02,0,{combat:true,target:{id:2},cooldown:.04,interval:1,rate:1});assert.equal(rig.stage,'preparation');assert.ok(rig.active);
    triggerAttack(rig,{stats:{interval:1},combatTime:4});assert.equal(rig.stage,'recovery');assert.equal(rig.elapsed,rig.duration*.42);
    poses.push(a.root.getObjectByName('upper_arm_R').rotation.x);
    const release=pose(a.root);triggerAttack(rig,{stats:{interval:1},combatTime:4});assert.deepEqual(pose(a.root),release,'multishot shares one release');
    animateAttack(rig,.08,4,{combat:true,stamp:4});assert.deepEqual(pose(a.root),release,'same combat frame retains exact release pose');
    assert.deepEqual(a.root.position.toArray(),[3,.6,8]);assert.equal(a.root.rotation.y,1.3);assert.deepEqual(a.root.scale.toArray(),[.7,.7,.7]);
    assert.deepEqual(a.face.matrix.elements,faceRelative.elements);assert.equal(a.face.parent,a.helmet.parent,'head and helmet articulate together');
    assert.deepEqual(Array.from(a.face.geometry.attributes.position.array),vertices);
    animateAttack(rig,2,6,{combat:true,stamp:6});assert.equal(rig.active,false);assert.deepEqual(pose(a.root),before);
    triggerAttack(rig,{stats:{interval:.04},combatTime:7});assert.ok(rig.duration<=.03601,'rapid attacks fit actual cadence');
    animateAttack(rig,.01,7,{reducedMotion:true,stamp:8});assert.equal(a.root.getObjectByName('upper_arm_R').rotation.x,0);
    disposeAttack(rig);disposeAttack(rig);cleanup(a.root);
  }
  assert.equal(new Set(poses).size,3);
});

test('death preserves imported scale and all physical parts, contacts terrain throughout falling, then rests indefinitely',()=>{
  for(const locomotion of ['biped','quadruped','flying']){
    const f=figure('sword',locomotion);f.root.scale.setScalar(.7);f.actor.scale.set(1.1,.85,.9);f.root.position.y=locomotion==='flying'?4:.025;f.root.userData.groundY=.12;
    f.root.userData.geometricMotion=createGeometricMotionRig(f.root);const bodyScale=f.actor.scale.toArray(),rootScale=f.root.scale.toArray(),before=f.face.geometry.attributes.position.array.slice();
    const bar=new THREE.Group(),aura=new THREE.Group();f.root.add(bar,aura);f.root.userData.bar=bar;f.root.userData.aura=aura;beginDeath(f.root,{id:1,flying:locomotion==='flying'});
    for(let i=0;i<30;i++){animateDeath(f.root,.04);f.root.updateMatrixWorld(true);assert.ok(new THREE.Box3().setFromObject(f.actor,true).min.y>=.1449,'physical corpse cannot penetrate ground');}
    assert.equal(bar.visible,false);assert.equal(aura.visible,false);assert.equal(f.root.visible,true);assert.equal(f.face.material.opacity,1);
    assert.deepEqual(f.actor.scale.toArray(),bodyScale);assert.deepEqual(f.root.scale.toArray(),rootScale);assert.deepEqual(f.face.geometry.attributes.position.array,before);
    const settled=pose(f.root);animateDeath(f.root,400);animateEnemyMotion(f.root,{dead:true},800);assert.deepEqual(pose(f.root),settled);assert.equal(f.root.userData.death.settled,true);
    for(const dt of [NaN,Infinity,-1]){animateDeath(f.root,dt);finiteScene(f.root);}
    cleanup(f.root);
  }
});

test('defense symbols reflect real immunity, typed resistance, shield charges, reactive armor, regeneration and heal blocking',()=>{
  const enemy={id:1,armor:10,reactiveArmor:2,reactiveStacks:3,armorShred:4,resists:{magic:.3,fire:.2,poison:.1},ward:.1,magicShred:.15,refraction:3,shields:2,regen:5,recharge:.2,rechargeClock:7.6,statuses:{}};
  const before=structuredClone(enemy),states=enemyDefenseVisualState(enemy);assert.deepEqual(states.map(s=>s.kind),['reactive','magic','fire','poison','refraction','regen','recharge']);assert.equal(states.find(s=>s.kind==='magic').amount,.25);assert.equal(states.find(s=>s.kind==='refraction').count,2);assert.deepEqual(enemy,before);
  assert.ok(Math.abs(states.find(s=>s.kind==='fire').amount-.45)<1e-12);assert.ok(Math.abs(states.find(s=>s.kind==='poison').amount-.35)<1e-12);
  assert.deepEqual(enemyDefenseVisualState({...enemy,magicShred:1}).map(s=>s.kind),['reactive','refraction','regen','recharge'],'fully shredded typed resistance cannot advertise positive protection');
  enemy.magicImmune=true;enemy.physicalImmune=true;enemy.statuses.healBlock={time:2};enemy.shields=0;
  assert.deepEqual(enemyDefenseVisualState(enemy).map(s=>s.kind),['physicalImmune','magicImmune']);enemy.dead=true;assert.deepEqual(enemyDefenseVisualState(enemy),[]);
});

test('Engineer emits a forged physical runic bolt from its moving hammer without changing armor-shred timing or damage type',()=>{
  const a=actor('hammer'),rig=attackRig(a.root,'runebreaker',{type:'physical'}),scene=new THREE.Scene(),fx=new CombatEffects(scene,{getMuzzle:(_source,out)=>a.muzzle.getWorldPosition(out)});
  assert.equal(attackVisualKind('runebreaker',{type:'physical'}),'runic');assert.equal(rig.kind,'runic');triggerAttack(rig,{combatTime:1,stats:{interval:.6}});assert.ok(a.root.getObjectByName('upper_arm_R').rotation.x<-.7);
  const shot={id:1,source:{family:'runebreaker',id:9,x:0,z:0},target:{id:2,x:4,z:-2},stats:{type:'physical',shred:4,damage:12,interval:.6},duration:.3,progress:0,start:{x:0,z:0}},before=structuredClone(shot);fx.event('shot',shot);
  const record=fx.projectiles.get(1);assert.equal(record.object.name,'Physical armor-breaking rune bolt');assert.ok(record.origin.distanceTo(a.muzzle.getWorldPosition(new THREE.Vector3()))<1e-12);assert.equal(record.object.getObjectByName('Arrow shaft'),undefined);assert.deepEqual(shot,before);
  fx.dispose();disposeAttack(rig);cleanup(a.root);
});

test('bounded enemy effects preserve concealment, expire teleport endpoints together, release resources once and never mutate game rules',()=>{
  const scene=new THREE.Scene(),fx=new EnemyAbilityEffects(scene,{position:(x,y,z)=>new THREE.Vector3(x-18,y,z-18),isVisible:e=>!e?.hidden,maxEnemies:2,maxEffects:2}),enemy={id:1,x:3,z:4,armor:5,resists:{magic:.2},refraction:3,shields:2,statuses:{}},hidden={...enemy,id:2,hidden:true};
  const before=structuredClone(enemy);fx.sync([enemy,hidden,...Array.from({length:10},(_,i)=>({...enemy,id:i+3}))],new Map(),1);
  assert.equal(fx.batches.get('armor').ring.count,2);assert.equal(fx.batches.get('refraction').crystals.count,4);fx.event('teleport',{enemy:hidden,from:{x:0,z:0},to:{x:5,z:6},visible:false});assert.equal(fx.effects.length,0);
  fx.event('teleport',{enemy,from:{x:3,z:4},to:{x:8,z:9},visible:true});assert.deepEqual(fx.effects.map(e=>e.object.name),['Rift departure','Rift arrival']);assert.deepEqual(fx.effects[0].object.position.toArray(),[-15,0,-14]);assert.deepEqual(fx.effects[1].object.position.toArray(),[-10,0,-9]);
  const old=fx.effects[0].object,disposals=new Map();old.traverse(node=>{for(const resource of [node.geometry,node.material].filter(Boolean)){disposals.set(resource,0);resource.addEventListener('dispose',()=>disposals.set(resource,disposals.get(resource)+1));}});
  fx.event('deflect',{enemy});assert.equal(fx.effects.length,2);for(const n of disposals.values())assert.equal(n,1);
  fx.update(.7);assert.equal(fx.effects.length,0);assert.deepEqual(enemy,before);
  enemy.hidden=true;fx.sync([enemy],new Map(),2);assert.equal(fx.batches.get('armor').ring.count,0);assert.equal(fx.batches.get('refraction').crystals.count,0);
  finiteScene(scene);fx.dispose();fx.dispose();assert.equal(scene.children.length,0);for(const n of disposals.values())assert.equal(n,1);
});

test('reduced motion retains ability indications while pausing all decorative orbit and rift expansion',()=>{
  const scene=new THREE.Scene(),fx=new EnemyAbilityEffects(scene,{reducedMotion:true}),enemy={id:2,x:1,z:2,refraction:3,shields:3,statuses:{}};
  fx.sync([enemy],new Map(),1);const first=Array.from(fx.batches.get('refraction').crystals.instanceMatrix.array);fx.sync([enemy],new Map(),900);assert.deepEqual(Array.from(fx.batches.get('refraction').crystals.instanceMatrix.array),first);
  fx.event('teleport',{enemy,from:{x:0,z:0},to:{x:1,z:2}});fx.update(.1);assert.ok(fx.effects.every(e=>e.object.scale.x===1));const poseBefore=fx.effects.map(e=>pose(e.object));fx.update(0);assert.deepEqual(fx.effects.map(e=>pose(e.object)),poseBefore);fx.clear();assert.equal(fx.effects.length,0);fx.dispose();
});
