import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {geometricMetadata,createGeometricMotionRig,animateGeometricEnemyMotion} from '../game/render/geometric-motion.js';
import {attackRig,attackMuzzle,triggerAttack,animateAttack,disposeAttack,previewGeometricAttack,updateGeometricPreview} from '../game/render/battle-animation.js';
import {CombatEffects,attackVisualKind} from '../game/render/combat-effects.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
import {measureGeometricContacts} from '../game/render/geometric-contacts.js';
import {scaleBattlefieldUnit} from '../game/render/battlefield-scale.js';

async function load(id){
  const bytes=readFileSync(`public/assets/geometric/champions/${id}.glb`);
  return new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
function localPosition(actor,node){actor.updateMatrixWorld(true);return actor.worldToLocal(node.getWorldPosition(new THREE.Vector3()));}
function transforms(root){const result=[];root.traverse(node=>result.push([node.name,...node.position.toArray(),...node.quaternion.toArray(),...node.scale.toArray()].map(value=>typeof value==='number'&&value===0?0:value)));return result;}

test('actual crouched dragon and bear front/hind knees retain their authored bend branch and planted paws',async()=>{
  for(const id of ['embercrown','worldfire','thunderheart','phoenix','rangermentor']){
    const gltf=await load(id),source=transforms(gltf.scene),actor=cloneDefenderTemplate(gltf.scene),figure=new THREE.Group();figure.add(actor);figure.userData.body=actor;
    geometricMetadata(actor).strideLength=.15;
    const rig=createGeometricMotionRig(figure);figure.userData.geometricMotion=rig;rig.phase=.31*Math.PI*2;
    assert.equal(rig.legs.length,4);assert.ok(rig.legs.every(leg=>leg.ik),`${id} actual steep crouched shins must remain eligible for support IK`);
    const front=rig.legs.find(leg=>leg.side==='FL'),rear=rig.legs.find(leg=>leg.side==='BR');
    actor.updateWorldMatrix(true,true);
    for(const leg of [front,rear]){
      const hip=actor.worldToLocal(leg.hip.node.getWorldPosition(new THREE.Vector3())),knee=actor.worldToLocal(leg.knee.node.getWorldPosition(new THREE.Vector3())),ankle=actor.worldToLocal(leg.foot.node.getWorldPosition(new THREE.Vector3()));
      const nativeBranch=Math.sign(knee.clone().sub(hip).cross(ankle.clone().sub(knee)).x);
      assert.equal(leg.bendSign,nativeBranch,'IK retains the measured native knee/hock branch; new dragon anatomy may differ from the bear');
    }
    const enemy={id:0,flying:false,traveled:0,speed:1,statuses:{}};animateGeometricEnemyMotion(figure,enemy,0);
    for(const leg of [front,rear]){
      // The bear front paw needs 1.5 mm of hip clearance at the widest end
      // of this stride. All four dragon support legs reach without that drop.
      const adjustment=id==='rangermentor'? .03 : 1e-6;
      assert.ok(Math.abs(leg.hip.node.rotation.x-leg.hip.rotation.x)<adjustment,'stance centre retains the authored crouch instead of straightening its knee');assert.ok(Math.abs(leg.knee.node.rotation.x-leg.knee.rotation.x)<adjustment);
      assert.ok(leg.hip.node.position.distanceTo(leg.hip.position)<.04,'compensating the actual moving torso remains a small joint adjustment rather than straightening the animal anatomy');
    }
    figure.updateMatrixWorld(true);const planted=front.foot.node.getWorldPosition(new THREE.Vector3());
    enemy.traveled=.02;figure.position.z=-.02;animateGeometricEnemyMotion(figure,enemy,.02);figure.updateMatrixWorld(true);
    assert.ok(front.foot.node.getWorldPosition(new THREE.Vector3()).distanceTo(planted)<1e-7,`${id} real support paw cannot skate during world travel`);
    assert.deepEqual(measureGeometricContacts(actor).failures.filter(f=>['shoe-to-shin','knee-link'].includes(f.kind)),[],`${id} actual knee and hock surfaces stay joined`);
    scaleBattlefieldUnit(figure);rig.phase=.31*Math.PI*2;enemy.traveled=.02;animateGeometricEnemyMotion(figure,enemy,.02);figure.updateMatrixWorld(true);const scaledFoot=front.foot.node.getWorldPosition(new THREE.Vector3());
    enemy.traveled=.03;figure.position.z=-.03;animateGeometricEnemyMotion(figure,enemy,.03);figure.updateMatrixWorld(true);assert.ok(front.foot.node.getWorldPosition(new THREE.Vector3()).distanceTo(scaledFoot)<1e-7,`${id} the .88 battlefield figure keeps its real support foot planted in world metres`);
    assert.deepEqual(transforms(gltf.scene),source,'private IK does not change the cached native model');
    disposeDefenderInstance(actor);disposeDecodedGeometricAsset(gltf);
  }
});

test('all six actual Archer ranks and three champion bows draw their physical string onto the right hand and release at the world muzzle',async()=>{
  const files=[...Array.from({length:6},(_,i)=>`defenders/archer-${i+1}.glb`),...['thornwarden','verdantguard','elvenking'].map(id=>`champions/${id}.glb`)];
  for(const file of files){
    const bytes=readFileSync('public/assets/geometric/'+file),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),source=transforms(gltf.scene),actor=cloneDefenderTemplate(gltf.scene),peer=cloneDefenderTemplate(gltf.scene),peerBefore=transforms(peer);
    actor.position.set(3,.8,5);actor.rotation.y=.9;actor.scale.setScalar(.7);scaleBattlefieldUnit(actor);
    const family=file.includes('defenders/')?'archer':file.split('/').at(-1).replace('.glb',''),stats=JSON.parse(readFileSync('data/towers.json'))[family],rig=attackRig(actor,family,stats),rest=transforms(actor),hand=actor.getObjectByName('hand_R');
    assert.ok(rig.bowArms,`${file} actual shoulder/elbow/hand chains bind to the draw`);assert.equal(rig.string.nock,hand);assert.ok(rig.authoredStrings.length);assert.ok(rig.authoredStrings.every(entry=>entry.node.visible===false),'private animated string replaces the frozen mesh instead of drawing two strings');
    assert.equal(rig.geometric.bowPlane,'forward-vertical',`${file} all production bows carry the corrected authored plane`);
    if(rig.geometric.bowPlane==='forward-vertical'){
      const curve=[];actor.traverse(n=>{if(n.isMesh&&/recurve_bow|open_bow_stave/i.test(n.name)){const p=n.geometry.attributes.position;for(let i=0;i<p.count;i++)curve.push(actor.worldToLocal(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld)));}});
      assert.ok(curve.length>0,'inspect actual authored bow geometry');const box=new THREE.Box3().setFromPoints(curve),size=box.getSize(new THREE.Vector3()),nock=localPosition(actor,rig.string.authoredNock);
      assert.ok(size.x<size.z*.45&&size.z>.10,`${file} physical rest bow lies in the forward/vertical YZ plane`);assert.ok(box.min.z<nock.z-.05,'curve is ahead of the string along the actual -Z firing direction');
    }
    previewGeometricAttack(rig,{duration:1});updateGeometricPreview(rig,.42);
    if(rig.geometric.bowPlane==='forward-vertical'){const pivot=rig.joints.get('bow_pivot')||rig.joints.get('weapon_L');assert.equal(pivot.node.rotation.y,pivot.rotation.y,'already rotated physical bow must not receive another runtime quarter turn');}
    const handPosition=localPosition(actor,hand),nockPosition=localPosition(actor,rig.string.authoredNock),positions=rig.string.object.geometry.attributes.position;
    for(const index of [1,3])assert.ok(new THREE.Vector3().fromBufferAttribute(positions,index).distanceTo(handPosition)<1e-7,'both actual string segments meet the right drawing hand');
    assert.ok(handPosition.z-nockPosition.z>=.0649,'the hand pulls the string back along the actor axis');assert.ok(Math.abs(handPosition.x-nockPosition.x)<1e-7&&Math.abs(handPosition.y-nockPosition.y)<1e-7,'draw hand catches the same nock plane rather than moving on the opposite side of the body');
    const fx=new CombatEffects(new THREE.Scene(),{getMuzzle:(_source,out)=>attackMuzzle(rig,out)}),shot={id:1,source:{family,x:3,z:5},target:{id:2,x:3,z:1},stats,progress:0,duration:.3,start:{x:3,z:5}},packet=structuredClone(shot);fx.event('shot',shot);assert.ok(fx.projectiles.get(1).origin.distanceTo(attackMuzzle(rig))<1e-8,'entity arrow originates at the real articulated world muzzle');assert.deepEqual(shot,packet);
    updateGeometricPreview(rig,2);assert.deepEqual(transforms(actor),rest,'all physical arm, wrist and bow transforms return exactly to the frozen pose');assert.deepEqual(transforms(gltf.scene),source);assert.deepEqual(transforms(peer),peerBefore);
    fx.dispose();disposeAttack(rig);assert.ok(rig.authoredStrings.every(entry=>entry.node.visible===entry.visible),'disposing the instance restores authored string visibility');disposeDefenderInstance(actor);disposeDefenderInstance(peer);disposeDecodedGeometricAsset(gltf);
  }
});

test('real frost/stone construct fists extend toward -Z and launch their own effect without mutating damage or cached actors',async()=>{
  for(const [id,kind] of [['winterhold','frost'],['emeraldgolem','stone']]){
    const gltf=await load(id),actor=cloneDefenderTemplate(gltf.scene),peer=cloneDefenderTemplate(gltf.scene);
    const sourceBefore=transforms(gltf.scene),peerBefore=transforms(peer),stats=JSON.parse(readFileSync('data/towers.json'))[id];
    assert.equal(geometricMetadata(actor).attackStyle,'punch',`${id} must carry the actual fist attack contract`);
    const hand=actor.getObjectByName('hand_R'),restHand=localPosition(actor,hand),rig=attackRig(actor,id,stats),rest=transforms(actor);
    actor.rotation.y=.7;actor.position.set(2,.3,5);const aim=actor.rotation.y;
    triggerAttack(rig,{combatTime:4,stats});
    assert.equal(rig.elapsed,rig.duration*.42);assert.ok(localPosition(actor,hand).z<restHand.z-.12,`${id} real release fist extends in front of the body`);
    const releaseTip=localPosition(actor,rig.muzzle),releaseHand=localPosition(actor,hand);
    assert.ok(releaseTip.z<releaseHand.z-.2,'the punch muzzle stays on the front knuckles rather than rotating upwards');
    assert.ok(Math.abs(releaseTip.y-releaseHand.y)<.06,'wrist counterrotation keeps the actual fist level');
    assert.equal(actor.rotation.y,aim);assert.equal(actor.getObjectByName('weapon_R').rotation.y,rig.joints.get('weapon_R').rotation.y,'no sword sweep on a fist');
    assert.equal(attackVisualKind(id,stats),kind);
    const scene=new THREE.Scene(),fx=new CombatEffects(scene,{getMuzzle:(_source,out)=>attackMuzzle(rig,out)});
    const shot={id:4,source:{family:id,x:2,z:5},target:{id:1,x:6,z:1},stats:structuredClone(stats),duration:.3,progress:0,start:{x:2,z:5}},before=structuredClone(shot);
    fx.event('shot',shot);const record=fx.projectiles.get(4);
    assert.ok(record.origin.distanceTo(attackMuzzle(rig))<1e-8,'projectile starts at the actual release fist');
    assert.equal(record.kind,kind);assert.equal(record.object.getObjectByName('Arrow shaft'),undefined);assert.equal(record.object.getObjectByName('Blade cut arc'),undefined);
    assert.deepEqual(shot,before,'physical damage, frost, shred and interval remain unchanged');
    animateAttack(rig,2,6,{combat:true,stamp:6});actor.rotation.y=0;actor.position.set(0,0,0);assert.deepEqual(transforms(actor),rest);
    triggerAttack(rig,{combatTime:7,stats,reducedMotion:true});assert.equal(localPosition(actor,hand).z,restHand.z,'reduced motion retains the authored fist pose');
    assert.deepEqual(transforms(gltf.scene),sourceBefore);assert.deepEqual(transforms(peer),peerBefore);
    fx.dispose();disposeAttack(rig);disposeDefenderInstance(actor);disposeDefenderInstance(peer);disposeDecodedGeometricAsset(gltf);
  }
});

test('the real mechanical cannon preserves its forward barrel axis, recoils after release and emits a physical toxic dart',async()=>{
  const gltf=await load('mechanicalgolem'),actor=cloneDefenderTemplate(gltf.scene),stats=JSON.parse(readFileSync('data/towers.json')).mechanicalgolem;
  assert.equal(geometricMetadata(actor).attackStyle,'dartCannon');
  const rig=attackRig(actor,'mechanicalgolem',stats),weapon=actor.getObjectByName('weapon_R'),rest=transforms(actor),restMuzzle=localPosition(actor,rig.muzzle),restWeapon=weapon.position.clone();
  triggerAttack(rig,{combatTime:1,stats});const releaseMuzzle=localPosition(actor,rig.muzzle);
  assert.ok(releaseMuzzle.z<localPosition(actor,actor.getObjectByName('hand_R')).z-.1,'the authored muzzle stays in front of its cannon hand');
  assert.ok(Math.abs(releaseMuzzle.y-restMuzzle.y)<.05,'cannon release does not rotate the barrel vertically');
  assert.equal(actor.getObjectByName('upper_arm_R').rotation.x,rig.joints.get('upper_arm_R').rotation.x,'no bow draw or sword swing on the cannon arm');
  animateAttack(rig,rig.duration*.16,2,{stamp:2});assert.ok(weapon.position.z>restWeapon.z+.075,'real cannon group kicks backwards after releasing');
  const fx=new CombatEffects(new THREE.Scene(),{getMuzzle:(_source,out)=>attackMuzzle(rig,out)}),shot={id:2,source:{family:'mechanicalgolem',x:0,z:0},target:{id:2,x:5,z:0},stats,progress:0,duration:.4,start:{x:0,z:0}},before=structuredClone(shot);
  fx.event('shot',shot);const record=fx.projectiles.get(2);assert.equal(record.kind,'dart');assert.equal(record.object.name,'Mechanical cannon toxic dart');assert.ok(record.object.getObjectByName('Cannon dart venom channel'));assert.equal(record.object.getObjectByName('Arrow fletching'),undefined);assert.deepEqual(shot,before);
  animateAttack(rig,2,4,{stamp:4});assert.deepEqual(transforms(actor),rest);
  fx.dispose();disposeAttack(rig);disposeDefenderInstance(actor);disposeDecodedGeometricAsset(gltf);
});

test('the imported mounted lance thrust moves its actual hand forwards rather than behind the mount',async()=>{
  for(const id of ['frostblade','roseguard']){
  const gltf=await load(id),actor=cloneDefenderTemplate(gltf.scene),peer=cloneDefenderTemplate(gltf.scene),sourceBefore=transforms(gltf.scene),peerBefore=transforms(peer),stats=JSON.parse(readFileSync('data/towers.json'))[id];scaleBattlefieldUnit(actor);
  const rig=attackRig(actor,id,stats),hand=actor.getObjectByName('hand_R'),before=localPosition(actor,hand);
  assert.deepEqual(measureGeometricContacts(actor).failures.filter(f=>f.kind.startsWith('thrust-')),[],id+' actual forearm/wrist and shoulder surfaces connect at rest');
  assert.ok(['spear','lance'].includes(rig.attackStyle));triggerAttack(rig,{combatTime:1,stats});
  assert.ok(localPosition(actor,hand).z<before.z-.10,'mounted right hand physically thrusts towards the imported -Z front');
  assert.ok(before.z-localPosition(actor,hand).z>.114,'the actual mounted hand delivers at least 114 mm of forward travel in native metres at every battlefield scale');
  assert.deepEqual(measureGeometricContacts(actor).failures.filter(f=>f.kind.startsWith('thrust-')),[],id+' actual forearm/wrist and shoulder surfaces connect at release');
  assert.equal(rig.muzzle.parent,actor.getObjectByName('weapon_R'),'mounted lance uses the weapon tip rather than the mount mouth');
  assert.ok(localPosition(actor,rig.muzzle).z<localPosition(actor,hand).z-.5,'held lance point reaches forwards from the actual release hand');
  const fx=new CombatEffects(new THREE.Scene(),{getMuzzle:(_source,out)=>attackMuzzle(rig,out)}),shot={id:7,source:{family:id,x:0,z:0},target:{id:8,x:3,z:-2},stats,progress:.42,duration:.3,start:{x:0,z:0}},packet=structuredClone(shot);
  fx.event('shot',shot);const effect=fx.projectiles.get(7);assert.equal(effect.kind,'thrust');assert.ok(effect.object.getObjectByName('Pointed spear impact'));assert.equal(effect.object.getObjectByName('Blade cut arc'),undefined);assert.deepEqual(shot,packet,'narrow lance impact does not change the physical packet');
  const direction=new THREE.Vector3(0,0,1).applyQuaternion(effect.object.quaternion),towards=fx.point(shot.target,fx.targetHeight(shot.target)).sub(effect.origin).normalize();assert.ok(direction.distanceTo(towards)<1e-8,'the short impact streak points along the actual lance-to-target direction');
  fx.dispose();
  assert.deepEqual(transforms(gltf.scene),sourceBefore,'thrust cannot move shared source rig or geometry');assert.deepEqual(transforms(peer),peerBefore,'thrust cannot move a private peer');
  disposeAttack(rig);disposeDefenderInstance(actor);disposeDefenderInstance(peer);disposeDecodedGeometricAsset(gltf);
  }
});

test('the spear in Soldier I uses a narrow thrust while the higher sword ranks retain their cut',async()=>{
  const bytes=readFileSync('public/assets/geometric/defenders/soldier-1.glb'),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),actor=cloneDefenderTemplate(gltf.scene),stats=JSON.parse(readFileSync('data/towers.json')).soldier,rig=attackRig(actor,'soldier',stats),fx=new CombatEffects(new THREE.Scene(),{getMuzzle:(_source,out)=>attackMuzzle(rig,out)});
  assert.equal(rig.attackStyle,'spear');triggerAttack(rig,{combatTime:1,stats});
  const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(`data/${key}.json`))]));
  for(const tier of [1,2,6]){
    const game=new Game(data,{seed:42});game.draft.roundForced={family:'soldier',tier};assert.equal(game.place(10,10),true);
    const source=game.selection;assert.equal(source.tier,tier);assert.equal(source.level,undefined,'actual placed towers expose tier, not level');
    const shot={id:tier,source,target:{id:20,x:0,z:-2},stats,progress:0,duration:.2,start:{x:10,z:10}},packet=structuredClone(shot);fx.event('shot',shot);const record=fx.projectiles.get(tier);
    assert.equal(record.kind,tier===1?'thrust':'melee');assert.equal(!!record.object.getObjectByName('Blade cut arc'),tier!==1);assert.deepEqual(shot,packet);
  }
  fx.dispose();disposeAttack(rig);disposeDefenderInstance(actor);disposeDecodedGeometricAsset(gltf);
});

test('the actual dragon rider separates its lightning weapon shot from its burning dragon-mouth aura',async()=>{
  const gltf=await load('thunderheart'),actor=cloneDefenderTemplate(gltf.scene),stats=JSON.parse(readFileSync('data/towers.json')).thunderheart,rig=attackRig(actor,'thunderheart',stats);
  assert.equal(stats.type,'arcane');assert.ok(stats.burnAura>0);assert.equal(rig.kind,'lightning');
  assert.equal(rig.muzzle.parent,actor.getObjectByName('weapon_R'));assert.equal(rig.breathMuzzle.parent,actor.getObjectByName('mouth_pivot'));
  triggerAttack(rig,{combatTime:1,stats});const hand=actor.getObjectByName('hand_R'),weaponRelease=hand.rotation.x;assert.notEqual(weaponRelease,rig.joints.get('hand_R').rotation.x);
  const calls=[],fx=new CombatEffects(new THREE.Scene(),{getMuzzle:(_source,out,options)=>{calls.push(!!options?.breath);return attackMuzzle(rig,out,options);}}),source={family:'thunderheart',x:0,z:0},target={id:4,x:4,z:0};
  const shot={id:9,source,target,stats,progress:0,duration:.4,start:{x:0,z:0}},before=structuredClone(shot);fx.event('shot',shot);
  assert.equal(fx.projectiles.get(9).kind,'lightning');assert.ok(fx.projectiles.get(9).object.isLine);assert.deepEqual(shot,before);
  const mainElapsed=rig.elapsed,mainStage=rig.stage,mainHand=hand.rotation.clone();
  triggerAttack(rig,{combatTime:1,stats,breath:true});assert.equal(rig.breathTrack.active,true,'distinct aura event at same stamp is not mistaken for multishot');assert.equal(rig.elapsed,mainElapsed);assert.equal(rig.stage,mainStage);assert.deepEqual(hand.rotation.toArray(),mainHand.toArray(),'fire aura preserves the running lightning arm pose');
  assert.ok(actor.getObjectByName('mouth_pivot').rotation.x<-.2,'independent dragon jaw opens while the rider casts');
  animateAttack(rig,rig.duration*.08,2,{combat:true,stamp:2});const recoveryHand=hand.rotation.clone(),recoveryElapsed=rig.elapsed;
  triggerAttack(rig,{combatTime:2,stats,breath:true});assert.equal(rig.elapsed,recoveryElapsed);assert.deepEqual(hand.rotation.toArray(),recoveryHand.toArray(),'a later aura pulse does not restart or cancel weapon recovery');
  fx.event('aura-attack',{source,target,stats});assert.equal(fx.effects.at(-1).object.name,'Dragon fire breath');assert.ok(calls.includes(true),'fire origin explicitly requests the actual mount mouth');
  assert.ok(attackMuzzle(rig).distanceTo(attackMuzzle(rig,new THREE.Vector3(),{breath:true}))>.5,'weapon tip and mouth are distinct actual endpoints');
  fx.dispose();disposeAttack(rig);disposeDefenderInstance(actor);disposeDecodedGeometricAsset(gltf);
});

test('the imported royal bow emits a poison arrow and the paladin hammer produces an impact instead of a blade slash',async()=>{
  for(const [id,kind,name] of [['royalranger','venomArrow','Venom-coated royal arrow'],['kingdomprotector','hammer','Concussive physical hammer blow']]){
    const gltf=await load(id),actor=cloneDefenderTemplate(gltf.scene),stats=JSON.parse(readFileSync('data/towers.json'))[id],rig=attackRig(actor,id,stats),fx=new CombatEffects(new THREE.Scene(),{getMuzzle:(_source,out)=>attackMuzzle(rig,out)});
    triggerAttack(rig,{combatTime:2,stats});const shot={id:1,source:{family:id,x:0,z:0},target:{id:2,x:4,z:2},stats,progress:.5,duration:.3,start:{x:0,z:0}},before=structuredClone(shot);fx.event('shot',shot);const record=fx.projectiles.get(1);
    assert.equal(record.kind,kind);assert.equal(record.object.name,name);assert.equal(record.object.getObjectByName('Blade cut arc'),undefined);assert.deepEqual(shot,before);
    if(id==='royalranger'){assert.equal(stats.type,'poison');assert.ok(record.object.getObjectByName('Arrow shaft'));assert.ok(record.object.getObjectByName('Green venom arrow coating'));}
    else{assert.equal(stats.type,'physical');assert.equal(rig.attackStyle,'hammer');assert.ok(record.object.getObjectByName('Hammer impact stone fragment'));}
    fx.dispose();disposeAttack(rig);disposeDefenderInstance(actor);disposeDecodedGeometricAsset(gltf);
  }
});
