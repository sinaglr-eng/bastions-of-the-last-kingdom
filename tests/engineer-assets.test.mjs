import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {NativeTestGLTFLoader as GLTFLoader} from './helpers/native-gltf.mjs';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {previewDefenderAttack,updateDefenderPreview,resetDefenderAnimation} from '../game/render/defender-animation.js';
import {defenderModel} from '../game/render/models.js';
import {rankColor} from '../game/render/ranks.js';
import {attackRig,disposeAttack} from '../game/render/battle-animation.js';

const towers = JSON.parse(readFileSync(new URL('../data/towers.json', import.meta.url)));
const manifest = JSON.parse(readFileSync(new URL('../public/assets/models/manifest.json', import.meta.url)));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const originalModels = [
  '09c6261e5716c72e62aa23f816fe998be3c167555b3369c5abaf6e4d3a9e63ad',
  'cad0ff793cb686cba45d2a42377c476346cde5e14f4bc214ae0ae994eff8cc77',
  '15cbf925e8b175f940fb5407c119d4432d4f91f3fb86d23594ff621520265ddf',
  'd6e44b96e811d20a8225ddd8e4cc35cbc36cee27827b7d1699cd66d289cb889b',
  '451a8b5b575d65ad3322c23888238ff04ccb6a394da113de35dcf65207bc9625',
  'ade3ebd5bbfffaf5079f33b781950f1cd8382bdd6e17b8404cb7f34c3e4382fc',
];
const meshList = root => {const result=[]; root.traverse(node => {if(node.isMesh) result.push(node);}); return result;};

test('Engineer keeps his restored identity, all six redesigned native ranks and the exact editable original archive', () => {
  assert.equal(towers.runebreaker.name, 'Engineer');
  assert.equal(towers.runebreaker.short, 'Engineer');
  assert.equal(towers.runebreaker.unitCode, 'R');
  assert.ok(!/Kushek|blonde human/i.test(towers.runebreaker.description));
  for (let tier=1; tier<=6; tier++) {
    const entry=manifest.find(row=>row.kind==='tower'&&row.family==='runebreaker'&&row.tier===tier);
    assert.equal(entry.style,'designed-defenders-v8');assert.equal(entry.designRevision,11);assert.equal(entry.source,'blender/scenes/runebreaker_design_v8.blend');
    assert.notEqual(digest(readFileSync(new URL(`../public/assets/models/human_runebreaker_t${tier}.glb`, import.meta.url))),originalModels[tier-1],'Production rank must contain the new native rig');
    const portrait=readFileSync(new URL(`../public/assets/army/runebreaker-t${tier}.png`,import.meta.url));assert.deepEqual([...portrait.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  }
  assert.equal(digest(readFileSync(new URL('../blender/scenes/runebreaker_design_v1.blend', import.meta.url))), '2736b9db7c41ee8cd9385d456464d70b2f8c1ef26c532564a06b2aefada6e43e');
});

test('the redesigned short Engineer exports ten independently weighted digits and tools carried by genuine wrist/weapon animation', async () => {
  for (let tier=1; tier<=6; tier++) {
    const entry=manifest.find(item => item.kind==='tower' && item.family==='runebreaker' && item.tier===tier);
    const bytes=readFileSync(new URL(`../public/assets/models/${entry.file}`, import.meta.url));
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength), ''),source=gltf.scene;source.animations=gltf.animations;source.updateMatrixWorld(true);
    const names=[]; source.traverse(node=>names.push(node.name));
    assert.equal(source.getObjectByName('runebreaker_Rig').userData.identity,'Engineer');
    assert.ok(names.every(name=>!name.includes('Kushek')));
    const size=new THREE.Box3().setFromObject(source,true).getSize(new THREE.Vector3());
    assert.ok(size.y>1.5 && size.y<1.8);
    assert.equal(meshList(source).reduce((sum,mesh)=>sum+(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3,0), entry.triangles);
    const actor=cloneDefenderTemplate(source),rig=attackRig(actor,'runebreaker',towers.runebreaker);assert.ok(rig.native);
    const skin=actor.getObjectByProperty('isSkinnedMesh',true),skeleton=skin.skeleton,used=new Set();
    actor.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;for(let vertex=0;vertex<weights.count;vertex++)for(let i=0;i<4;i++)if(weights.getComponent(vertex,i)>.001)used.add(skeleton.bones[indices.getComponent(vertex,i)].name);});
    for(const side of ['L','R'])for(let digit=0;digit<5;digit++)assert.ok(used.has(`finger_${side}_${digit}`),'Named fingers must weight actual hand vertices');
    const weapon=actor.getObjectByName('weapon'),rest=weapon.getWorldQuaternion(new THREE.Quaternion());
    previewDefenderAttack(rig.native);updateDefenderPreview(rig.native,.36);
    assert.ok(weapon.getWorldQuaternion(new THREE.Quaternion()).angleTo(rest)>.01);
    assert.ok(source.getObjectByName('weapon').getWorldQuaternion(new THREE.Quaternion()).angleTo(rest)<.000001);
    resetDefenderAnimation(rig.native,{reducedMotion:true});assert.ok(weapon.getWorldQuaternion(new THREE.Quaternion()).angleTo(rest)<.000001);disposeAttack(rig);disposeDefenderInstance(actor);
    const resources=new Set();
    for(const mesh of meshList(source)){resources.add(mesh.geometry); resources.add(mesh.material);}
    for(const resource of resources)resource.dispose();
  }
});

test('Engineer actually grips the ruler without digit penetration throughout both exported clips at every rank',async()=>{
  for(let tier=1;tier<=6;tier++){
    const entry=manifest.find(item=>item.kind==='tower'&&item.family==='runebreaker'&&item.tier===tier);
    const bytes=readFileSync(new URL(`../public/assets/models/${entry.file}`,import.meta.url));
    const {scene,animations}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    scene.updateMatrixWorld(true);
    const skins=meshList(scene).filter(mesh=>mesh.isSkinnedMesh),bones=skins[0].skeleton.bones;
    const hand=bones.find(bone=>bone.name==='hand_L'),handIndex=bones.indexOf(hand),digitIndices=Array.from({length:5},(_,d)=>bones.findIndex(bone=>bone.name===`finger_L_${d}`));
    const weight=(mesh,vertex,bone)=>{let result=0;for(let slot=0;slot<4;slot++)if(mesh.geometry.attributes.skinIndex.getComponent(vertex,slot)===bone)result+=mesh.geometry.attributes.skinWeight.getComponent(vertex,slot);return result;};
    const ruler=[],digits=Array.from({length:5},()=>[]);
    for(const mesh of skins)for(let vertex=0;vertex<mesh.geometry.attributes.position.count;vertex++){
      if(/woven linen and eye white/.test(mesh.material.name)&&weight(mesh,vertex,handIndex)>.999)ruler.push({mesh,vertex});
      if(/living skin/.test(mesh.material.name))for(let d=0;d<5;d++)if(weight(mesh,vertex,digitIndices[d])>.30)digits[d].push({mesh,vertex});
    }
    const position=({mesh,vertex})=>mesh.getVertexPosition(vertex,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
    // Identify the real exported tool, not a contact marker or authored claim.
    assert.ok(ruler.length>=8);for(const vertices of digits)assert.ok(vertices.length>20,'Each curved digit needs actual weighted skin');
    const rulerBounds=new THREE.Box3().setFromPoints(ruler.map(position)),size=rulerBounds.getSize(new THREE.Vector3());
    assert.ok(size.x>.025&&size.x<.04&&size.y>.20&&size.y<.23&&size.z>.005&&size.z<.008,'Rigid left-hand ivory surface must be the thin rectangular ruler');
    const restHand=hand.matrixWorld.clone(),interior=rulerBounds.clone();interior.min.addScalar(.0008);interior.max.addScalar(-.0008);
    const mixer=new THREE.AnimationMixer(scene);
    try{
      for(const clip of animations){
        mixer.stopAllAction();const action=mixer.clipAction(clip);action.play();action.paused=true;
        for(let frame=0;frame<=120;frame++){
          action.time=clip.duration*frame/120;mixer.update(0);scene.updateMatrixWorld(true);
          const toRest=restHand.clone().multiply(hand.matrixWorld.clone().invert());
          const surfaces=digits.map(vertices=>vertices.map(vertex=>position(vertex).applyMatrix4(toRest)));
          const near=surfaces.map(vertices=>Math.min(...vertices.map(vertex=>rulerBounds.distanceToPoint(vertex))));
          const label=`rank ${tier}/${clip.name}/${frame}`;
          assert.ok(near[4]<.004,`${label}: opposed thumb does not hold the ruler`);
          assert.ok(near.slice(0,4).filter(distance=>distance<.004).length>=2,`${label}: ruler lacks a real multi-finger grasp`);
          for(let digit=0;digit<5;digit++)assert.equal(surfaces[digit].filter(vertex=>interior.containsPoint(vertex)).length,0,`${label}: finger ${digit} penetrates the ruler by more than 0.8 mm`);
        }
      }
    }finally{
      mixer.stopAllAction();mixer.uncacheRoot(scene);
      const resources=new Set();for(const mesh of meshList(scene)){resources.add(mesh.geometry);resources.add(mesh.material);}for(const resource of resources)resource.dispose();
    }
  }
});

test('the offline Engineer fallback keeps the original brown cap, beard, tools and rank-colored clothing', () => {
  for (let tier=1; tier<=6; tier++) {
    const actor=defenderModel('runebreaker',tier), meshes=meshList(actor);
    const colors=new Set(meshes.map(mesh=>mesh.material.color.getHexString()));
    for(const color of ['725340','c07643','bcc3ce','e8dfb4',rankColor(tier).slice(1)])assert.ok(colors.has(color));
    assert.ok(!colors.has('d8b865') && !colors.has('202326'));
    assert.ok(new THREE.Box3().setFromObject(actor,true).getSize(new THREE.Vector3()).y<1.8);
    meshes.forEach(mesh=>mesh.geometry.dispose());
  }
});
