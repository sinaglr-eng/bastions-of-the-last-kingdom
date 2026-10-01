import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {defenderModel} from '../game/render/models.js';
import {rankColor} from '../game/render/ranks.js';
import {attackRig, triggerAttack, animateAttack, resetAttack, disposeAttack} from '../game/render/battle-animation.js';

const towers = JSON.parse(readFileSync(new URL('../data/towers.json', import.meta.url)));
const folder = new URL('../public/assets/models/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', folder)));
const sources = [];
function meshes(root) {
  const list = [];
  root.traverse(node => {if (node.isMesh) list.push(node);});
  return list;
}
function signature(root) {
  root.updateMatrixWorld(true);
  const triangles = [], point = new THREE.Vector3();
  for (const mesh of meshes(root)) {
    const {position} = mesh.geometry.attributes, index = mesh.geometry.index;
    const keys = Array.from({length: position.count}, (_, vertex) => {
      point.fromBufferAttribute(position, vertex).applyMatrix4(mesh.matrixWorld);
      return point.toArray().map(value => Math.round(value*100000)).join(',');
    });
    const count = index?.count || position.count;
    for (let vertex = 0; vertex < count; vertex += 3) {
      triangles.push([0, 1, 2].map(offset => keys[index ? index.getX(vertex+offset) : vertex+offset]).sort().join('|'));
    }
  }
  return createHash('sha256').update(triangles.sort().join('\n')).digest('hex');
}
function palette(root) {
  const colors = new Map();
  for (const mesh of meshes(root)) {
    const material = mesh.material;
    colors.set(material.name.replace(/\.\d+$/, ''), material.color.getHexString());
  }
  return colors;
}

test('all six native Kushek ranks retain the same human model and change only the undershirt/inlay material', async () => {
  assert.equal(towers.runebreaker.name, 'Kushek');
  assert.equal(towers.runebreaker.short, 'Kushek');
  assert.equal(towers.runebreaker.unitCode, 'R');
  let reference, fixedColors;
  for (let tier = 1; tier <= 6; tier++) {
    const entry = manifest.find(item => item.kind === 'tower' && item.family === 'runebreaker' && item.tier === tier);
    assert.ok(entry);
    const bytes = readFileSync(new URL(entry.file, folder));
    const source = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength), '')).scene;
    sources.push(source);
    const current = signature(source), colors = palette(source);
    if (reference) assert.equal(current, reference, `rank ${tier} changed Kushek's geometry`);
    reference = current;
    const clothName = `Rank_${tier}_Kushek cotton undershirt`;
    assert.equal(colors.get(clothName), rankColor(tier).slice(1));
    colors.delete(clothName);
    const unchanged = Object.fromEntries([...colors].sort(([a], [b]) => a.localeCompare(b)));
    if (fixedColors) assert.deepEqual(unchanged, fixedColors, `rank ${tier} recolored hair, eyes, overalls or equipment`);
    fixedColors = unchanged;
    assert.equal(colors.get('Kushek black canvas overalls'), '202326');
    assert.equal(colors.get('Kushek black rubber wellingtons'), '242b2b');
    assert.equal(colors.get('Kushek blonde hair'), 'd8b865');
    assert.equal(colors.get('Kushek green eyes'), '388956');
    const names = [];source.traverse(node => names.push(node.name));
    assert.ok(names.some(name => name.toLowerCase().includes('ponytail')));
    assert.ok(names.every(name => !/spectacle|goggle|beard|engineer/i.test(name)));
    const bounds = new THREE.Box3().setFromObject(source, true).getSize(new THREE.Vector3());
    assert.ok(bounds.y > 1.8 && bounds.y < 2.1, `rank ${tier} retained dwarf proportions`);
    const triangles = meshes(source).reduce((total, mesh) => total+(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3, 0);
    assert.equal(triangles, entry.triangles);
    assert.ok(triangles < 10000);
  }
});

test('Kushek carries her actual hammer and ruler on independent animated hands', async () => {
  const source = sources[0], actor = source.clone(true);
  const left = actor.getObjectByName('weapon_L'), right = actor.getObjectByName('weapon_R');
  assert.ok(left && right);
  assert.ok(meshes(left).some(mesh => /carpenter ruler/i.test(mesh.material.name)));
  assert.ok(meshes(right).some(mesh => /hammer steel/i.test(mesh.material.name)));
  assert.ok(meshes(right).some(mesh => /hammer ash handle/i.test(mesh.material.name)));
  const rest = signature(actor), original = signature(source), rig = attackRig(actor, 'runebreaker', towers.runebreaker);
  triggerAttack(rig);animateAttack(rig, .14);
  assert.notEqual(signature(actor), rest);
  assert.equal(signature(source), original);
  resetAttack(rig);assert.equal(signature(actor), rest);disposeAttack(rig);
});

test('the playable offline stand-in retains Kushek colors and human proportions for every rank', () => {
  let shape;
  for (let tier = 1; tier <= 6; tier++) {
    const actor = defenderModel('runebreaker', tier), colors = new Set(meshes(actor).map(mesh => mesh.material.color.getHexString()));
    for (const color of ['202326', '242b2b', 'd8b865', '388956', rankColor(tier).slice(1)]) assert.ok(colors.has(color));
    const current = signature(actor);
    if (shape) assert.equal(current, shape);
    shape = current;
    assert.ok(new THREE.Box3().setFromObject(actor, true).getSize(new THREE.Vector3()).y > 1.8);
    meshes(actor).forEach(mesh => mesh.geometry.dispose());
  }
});

after(() => {
  const resources = new Set();
  for (const source of sources) for (const mesh of meshes(source)) {resources.add(mesh.geometry);resources.add(mesh.material);}
  for (const resource of resources) resource.dispose();
});
