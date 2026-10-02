import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
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

test('Engineer restores the original 0.2.5 name, six models, portraits and editable Blender scene exactly', () => {
  assert.equal(towers.runebreaker.name, 'Engineer');
  assert.equal(towers.runebreaker.short, 'Engineer');
  assert.equal(towers.runebreaker.unitCode, 'R');
  assert.ok(!/Kushek|blonde human/i.test(towers.runebreaker.description));
  for (let tier=1; tier<=6; tier++) {
    assert.equal(digest(readFileSync(new URL(`../public/assets/models/human_runebreaker_t${tier}.glb`, import.meta.url))), originalModels[tier-1]);
    assert.equal(digest(readFileSync(new URL(`../public/assets/army/runebreaker-t${tier}.png`, import.meta.url))), originalPortraits[tier-1]);
  }
  assert.equal(digest(readFileSync(new URL('../blender/scenes/runebreaker_design_v1.blend', import.meta.url))), '2736b9db7c41ee8cd9385d456464d70b2f8c1ef26c532564a06b2aefada6e43e');
});

test('the restored short, bearded Engineer wears spectacles and carries his animated original tools', async () => {
  for (let tier=1; tier<=6; tier++) {
    const entry=manifest.find(item => item.kind==='tower' && item.family==='runebreaker' && item.tier===tier);
    const bytes=readFileSync(new URL(`../public/assets/models/${entry.file}`, import.meta.url));
    const source=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength), '')).scene;
    const names=[]; source.traverse(node=>names.push(node.name));
    assert.ok(names.some(name=>/Engineer.*beard/i.test(name)));
    assert.ok(names.some(name=>/Engineer.*spectacle/i.test(name)));
    assert.ok(names.some(name=>/Engineer.*hammer/i.test(name)));
    assert.ok(names.some(name=>/Engineer.*ruler/i.test(name)));
    assert.ok(names.every(name=>!name.includes('Kushek')));
    const size=new THREE.Box3().setFromObject(source,true).getSize(new THREE.Vector3());
    assert.ok(size.y>1.5 && size.y<1.7);
    assert.equal(meshList(source).reduce((sum,mesh)=>sum+(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3,0), entry.triangles);
    const actor=source.clone(true), rig=attackRig(actor,'runebreaker',towers.runebreaker);
    const weapon=actor.getObjectByName('weapon_R'), rest=weapon.getWorldQuaternion(new THREE.Quaternion());
    triggerAttack(rig); animateAttack(rig,.14);
    assert.ok(weapon.getWorldQuaternion(new THREE.Quaternion()).angleTo(rest)>.01);
    assert.ok(source.getObjectByName('weapon_R').getWorldQuaternion(new THREE.Quaternion()).angleTo(rest)<.000001);
    resetAttack(rig); assert.ok(weapon.getWorldQuaternion(new THREE.Quaternion()).angleTo(rest)<.000001); disposeAttack(rig);
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
