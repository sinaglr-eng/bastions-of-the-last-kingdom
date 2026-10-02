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
const meshList = root => {const result=[]; root.traverse(node => {if(node.isMesh) result.push(node);}); return result;};

test('Engineer keeps his stable identity and historical native scene while shipping all six new faceted ranks', () => {
  assert.equal(towers.runebreaker.name, 'Engineer');
  assert.equal(towers.runebreaker.short, 'Engineer');
  assert.equal(towers.runebreaker.unitCode, 'R');
  assert.ok(!/Kushek|blonde human/i.test(towers.runebreaker.description));
  for (let tier=1; tier<=6; tier++) {
    const entry=manifest.find(item=>item.kind==='tower'&&item.family==='runebreaker'&&item.tier===tier);
    assert.equal(entry.style,'hooded-ranks-v2');
    assert.equal(entry.file,`human_runebreaker_t${tier}.glb`);
    assert.equal(entry.source,'blender/scenes/hooded-ranks-v2/runebreaker_ranks.blend');
    const png=readFileSync(new URL(`../public/assets/army/runebreaker-t${tier}.png`,import.meta.url));
    assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  }
  assert.equal(digest(readFileSync(new URL('../blender/scenes/runebreaker_design_v1.blend', import.meta.url))), '2736b9db7c41ee8cd9385d456464d70b2f8c1ef26c532564a06b2aefada6e43e');
});

test('the faceted dwarf carpenter keeps his beard and moving tools while goggles appear from rank III', async () => {
  for (let tier=1; tier<=6; tier++) {
    const entry=manifest.find(item => item.kind==='tower' && item.family==='runebreaker' && item.tier===tier);
    const bytes=readFileSync(new URL(`../public/assets/models/${entry.file}`, import.meta.url));
    const source=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength), '')).scene;
    const names=[]; source.traverse(node=>names.push(node.name));
    assert.ok(names.some(name=>/beard/i.test(name)));
    assert.equal(names.some(name=>/goggle/i.test(name)),tier>=3);
    assert.ok(names.some(name=>/hammer|mallet/i.test(name)));
    assert.ok(names.some(name=>/ruler/i.test(name)));
    assert.ok(names.every(name=>!name.includes('Kushek')));
    const size=new THREE.Box3().setFromObject(source,true).getSize(new THREE.Vector3());
    assert.ok(size.y>1.5 && size.y<2.2);
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

test('the temporary Engineer fallback keeps dwarf identity and rank colors while its GLB loads', () => {
  for (let tier=1; tier<=6; tier++) {
    const actor=defenderModel('runebreaker',tier), meshes=meshList(actor);
    const colors=new Set(meshes.map(mesh=>mesh.material.color.getHexString()));
    for(const color of ['725340','c07643','bcc3ce','e8dfb4',rankColor(tier).slice(1)])assert.ok(colors.has(color));
    assert.ok(!colors.has('d8b865') && !colors.has('202326'));
    assert.ok(new THREE.Box3().setFromObject(actor,true).getSize(new THREE.Vector3()).y<1.8);
    meshes.forEach(mesh=>mesh.geometry.dispose());
  }
});
