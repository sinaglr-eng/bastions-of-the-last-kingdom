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
import {attackRig, triggerAttack, animateAttack, resetAttack, disposeAttack} from '../game/render/battle-animation.js';

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
const originalPortraits = [
  '2847dec5fba5e6e87855a92be7e75beb2ed7b78b936e5376bafe3cbc7054e824',
  '152c8dbd66881eab53da05d88195777d83578fefdceacf1d32e85cb8d025c76c',
  '229191c8969abb5b79b21f5c2066a7db1361b2a47ae6577db4c53da2cacf0561',
  '2153e0ce0caaddaae30b80586f1ac8d2a8313eb35b19955ec38c585a77a546c1',
  '85656bef4ca162fb5c1673d37c94cc1272e6c94784252d36e4eaaad898ab6a86',
  '1ffd797dbee00ddca6541aab28282de8c4720431a284fddc7f5504e94114b117',
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
