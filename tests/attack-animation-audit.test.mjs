import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
import {attackRig,attackMuzzle,triggerAttack,animateAttack,disposeAttack,resetAttack,previewGeometricAttack,updateGeometricPreview} from '../game/render/battle-animation.js';
import {geometricMetadata,createGeometricMotionRig,animateGeometricEnemyMotion} from '../game/render/geometric-motion.js';
import {measureGeometricContacts} from '../game/render/geometric-contacts.js';
import {CombatEffects} from '../game/render/combat-effects.js';
import {scaleBattlefieldUnit} from '../game/render/battlefield-scale.js';
import {runAttackAudit,weaponHeadContact} from '../tools/audit-geometric-attacks.mjs';
const stats=JSON.parse(readFileSync('data/towers.json'));
async function load(path){const bytes=readFileSync('public/assets/geometric/'+path+'.glb'),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');gltf.scene.animations=gltf.animations;return gltf;}
const cleanup=(gltf,actor,rig)=>{disposeAttack(rig);disposeDefenderInstance(actor);disposeDecodedGeometricAsset(gltf);};

test('all 86 actual production defender attacks and all 50 production enemy motion/effect models pass the byte-bound native audit',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'actual-geometric-attacks-'));
 try{const report=await runAttackAudit({output:join(folder,'audit.json'),quiet:true});assert.equal(report.models,136);assert.equal(report.productionAttacks,86);assert.equal(report.productionEnemies,50);assert.equal(report.enemyVariants,300);assert.equal(report.failures,0,JSON.stringify(report.results.filter(r=>r.failures.length).map(r=>({id:r.id,failures:r.failures}))));assert.ok(report.checks>10000);assert.ok(report.results.every(r=>/^[a-f0-9]{64}$/.test(r.assetSha256)));assert.ok(report.results.filter(r=>r.variants).every(r=>r.scope.includes('no unused synthetic enemy attackRig')));}finally{rmSync(folder,{recursive:true,force:true});}
});

test('actual Archer hood clearance rejects a deliberately displaced physical bow and retains exact authored source rest',async()=>{
 const gltf=await load('defenders/archer-2'),actor=cloneDefenderTemplate(gltf.scene),rig=attackRig(actor,'archer',stats.archer);previewGeometricAttack(rig,{duration:1});updateGeometricPreview(rig,.42);assert.equal(weaponHeadContact(actor,rig).intersecting,false);actor.getObjectByName('weapon_L').position.z+=.28;assert.equal(weaponHeadContact(actor,rig).intersecting,true,'moving actual stave triangles into the hood must be rejected without widening tolerance');resetAttack(rig);assert.equal(weaponHeadContact(actor,rig).intersecting,false);cleanup(gltf,actor,rig);
});

test('Highking keeps both actual palms on the moving hilt with real wrist/elbow surfaces joined throughout the cut',async()=>{
 const gltf=await load('champions/highking'),actor=cloneDefenderTemplate(gltf.scene),rig=attackRig(actor,'highking',stats.highking);assert.ok(rig.greatswordArms);let travel=0;const sourceTip=attackMuzzle(rig);
 for(const p of [.10,.21,.30,.42,.48,.58,.70,.85,1]){previewGeometricAttack(rig,{duration:1});updateGeometricPreview(rig,p);for(const side of ['right','left']){const hand=actor.getObjectByName('hand_'+(side==='right'?'R':'L')),grip=actor.getObjectByName('greatsword_'+side+'_grip');assert.ok(hand.getWorldPosition(new THREE.Vector3()).distanceTo(grip.getWorldPosition(new THREE.Vector3()))<.004);}assert.deepEqual(measureGeometricContacts(actor).failures,[]);assert.equal(weaponHeadContact(actor,rig).intersecting,false);travel=Math.max(travel,attackMuzzle(rig).distanceTo(sourceTip));}
 assert.ok(travel>.4,'actual long blade performs a substantial forward cut');cleanup(gltf,actor,rig);
});

test('integrated Nature face keeps crown branches rigid to the torso while ordinary authored heads still articulate',async()=>{
 for(const [path,family,integrated] of [['champions/mothernature','mothernature',true],['defenders/mage-3','mage',false]]){const gltf=await load(path),actor=cloneDefenderTemplate(gltf.scene),rig=attackRig(actor,family,stats[family]),head=actor.getObjectByName('head_pivot'),rest=head.quaternion.clone();assert.equal(!!geometricMetadata(actor).integratedHeadInTorso,integrated);previewGeometricAttack(rig,{duration:1});updateGeometricPreview(rig,.42);assert.equal(head.quaternion.angleTo(rest)<1e-7,integrated,'only an explicitly integrated body-face retains its branch-head local orientation');resetAttack(rig);const figure=new THREE.Group();figure.add(actor);figure.userData.body=actor;figure.userData.geometricMotion=createGeometricMotionRig(figure);figure.userData.geometricMotion.phase=.25*Math.PI*2;animateGeometricEnemyMotion(figure,{id:0,traveled:0,flying:false,statuses:{}},0);assert.equal(head.quaternion.angleTo(rest)<1e-7,integrated,'shared grounded idle/gait keeps integrated branches rooted without suppressing ordinary head movement');cleanup(gltf,actor,rig);}
});

test('Phoenix staff and simultaneous mount fire use distinct actual endpoints and preserve the ongoing rider cast',async()=>{
 const gltf=await load('champions/phoenix'),actor=cloneDefenderTemplate(gltf.scene),rig=attackRig(actor,'phoenix',stats.phoenix),jaw=actor.getObjectByName('mouth_pivot'),restJaw=jaw.rotation.x;triggerAttack(rig,{combatTime:1,stats:stats.phoenix});assert.equal(rig.muzzle.parent,actor.getObjectByName('weapon_R'));assert.equal(jaw.rotation.x,restJaw,'a staff cast alone does not open the mount jaw');const hand=actor.getObjectByName('hand_R'),pose=hand.quaternion.clone(),elapsed=rig.elapsed;triggerAttack(rig,{combatTime:1,stats:stats.phoenix,breath:true});assert.equal(rig.elapsed,elapsed);assert.ok(hand.quaternion.angleTo(pose)<1e-7);assert.ok(jaw.rotation.x<restJaw-.2);assert.ok(attackMuzzle(rig).distanceTo(attackMuzzle(rig,new THREE.Vector3(),{breath:true}))>.5);animateAttack(rig,.1,0,{stamp:2});cleanup(gltf,actor,rig);
});

test('Claire charge and release follow its native moving staff tip while the cached source remains untouched',async()=>{
 const gltf=await load('champions/ladyclaire'),actor=cloneDefenderTemplate(gltf.scene),rig=attackRig(actor,'ladyclaire',stats.ladyclaire),authored=actor.getObjectByName('staff_tip'),fixed=authored.getWorldPosition(new THREE.Vector3()),weapon=actor.getObjectByName('weapon_R');assert.equal(rig.muzzle.parent,weapon);assert.ok(attackMuzzle(rig).distanceTo(fixed)<1e-7);triggerAttack(rig,{combatTime:1,stats:stats.ladyclaire});assert.ok(attackMuzzle(rig).distanceTo(fixed)>.1,'actual animated weapon moves its release focus');assert.equal(authored.parent,weapon);assert.ok(authored.getWorldPosition(new THREE.Vector3()).distanceTo(fixed)>.1,'the actual native staff endpoint moves with its physical weapon');assert.ok(gltf.scene.getObjectByName('staff_tip').getWorldPosition(new THREE.Vector3()).distanceTo(fixed)<1e-7,'cached native source endpoint remains untouched');assert.equal(rig.glow.parent,rig.muzzle);const released=[];rig.glow.traverse(n=>{for(const resource of [n.geometry,n.material])if(resource){const record={count:0};resource.addEventListener('dispose',()=>record.count++);released.push(record);}});cleanup(gltf,actor,rig);assert.ok(released.every(r=>r.count===1),'nested owned charge resources release exactly once');
});

test('frost crossbow uses a physical shaft/head and stays pointed at its target without changing frost damage or packets',()=>{
 const scene=new THREE.Scene(),fx=new CombatEffects(scene),shot={id:1,source:{id:1,family:'rimewatch',x:0,z:0},target:{id:2,x:3,z:-4},stats:structuredClone(stats.rimewatch),progress:.4,duration:.3,start:{x:0,z:0}},before=structuredClone(shot);fx.event('shot',shot);const bolt=fx.projectiles.get(1);assert.equal(bolt.kind,'frost');assert.ok(bolt.physicalBolt);assert.ok(bolt.object.getObjectByName('Arrow shaft'));assert.ok(bolt.object.getObjectByName('Steel arrowhead'));assert.ok(bolt.object.getObjectByName('Ice-lined bolt shaft'));fx.poseProjectile(bolt,0);const orientation=bolt.object.quaternion.clone();fx.poseProjectile(bolt,.7);assert.ok(bolt.object.quaternion.angleTo(orientation)<1e-7,'elapsed decorative time cannot roll a physical bolt');assert.deepEqual(shot,before);fx.dispose();
});

test('actual grounded support foot stays fixed in all three world axes when production applies returned root height',async()=>{
 const gltf=await load('enemies/host_01'),actor=cloneDefenderTemplate(gltf.scene),figure=new THREE.Group();figure.add(actor);figure.userData.body=actor;scaleBattlefieldUnit(figure);const rig=createGeometricMotionRig(figure);figure.userData.geometricMotion=rig;rig.phase=.31*Math.PI*2;const enemy={id:0,traveled:0,speed:1,flying:false,statuses:{}};figure.position.y=animateGeometricEnemyMotion(figure,enemy,0);figure.updateMatrixWorld(true);const leg=rig.legs.find(l=>l.side==='L'),before=leg.foot.node.getWorldPosition(new THREE.Vector3());enemy.traveled=.01;figure.position.z=-.01;figure.position.y=animateGeometricEnemyMotion(figure,enemy,.02);figure.updateMatrixWorld(true);assert.ok(leg.foot.node.getWorldPosition(new THREE.Vector3()).distanceTo(before)<1e-7,'whole-root vertical bob must not lift the actual planted ankle');cleanup(gltf,actor,null);
});
