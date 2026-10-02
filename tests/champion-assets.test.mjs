import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {NativeTestGLTFLoader as GLTFLoader} from './helpers/native-gltf.mjs';
import {attackRig,disposeAttack} from '../game/render/battle-animation.js';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {previewDefenderAttack,updateDefenderPreview,resetDefenderAnimation} from '../game/render/defender-animation.js';

const models = new URL('../public/assets/models/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', models)));
const towers = JSON.parse(readFileSync(new URL('../data/towers.json', import.meta.url)));
const champions = Object.keys(towers).filter(family => towers[family].advanced);
const basics = Object.keys(towers).filter(family => !towers[family].advanced);
const championEntries = manifest.filter(entry => entry.kind === 'tower' && towers[entry.family]?.advanced);
const defenderEntries = manifest.filter(entry => entry.kind === 'tower');
const creatures=new Set(['embercrown','worldfire','starfall','thunderheart','phoenix','rangermentor','griffinbomber']);
const engines=new Set(['kingsreach','stonewarden','royalarsenal','fireballista','winterhold','emeraldgolem','mechanicalgolem']);
const budget=entry=>['ladyclaire','lordbernhard'].includes(entry.family)||creatures.has(entry.family)?60000:basics.includes(entry.family)?30000:engines.has(entry.family)?35000:45000;
let loaded;

async function loadDefenders() {
  if (!loaded) {
    loaded = Promise.all(defenderEntries.map(async entry => {
      const file = readFileSync(new URL(entry.file, models));
      const array = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
      const gltf = await new GLTFLoader().parseAsync(array, '');
      gltf.scene.animations=gltf.animations;
      gltf.scene.updateMatrixWorld(true);
      return {entry, scene: gltf.scene};
    }));
  }
  return loaded;
}

async function loadChampions() {
  return (await loadDefenders()).filter(({entry}) => towers[entry.family].advanced);
}

function meshList(scene) {
  const meshes = [];
  scene.traverse(object => {if (object.isMesh) meshes.push(object);});
  return meshes;
}

function vectorKey(vector) {
  // Quantization absorbs exporter float noise while preserving small modeled details.
  return [vector.x, vector.y, vector.z].map(value => Math.round(value * 100000)).join(',');
}

function geometrySignature(scene) {
  // Hash canonical world-space triangle geometry. Names, material colors, file
  // bytes, mesh order and vertex numbering cannot make a recolor pass this test.
  const triangles = [];
  const point = new THREE.Vector3();
  for (const mesh of meshList(scene)) {
    const geometry = mesh.geometry;
    const position = geometry.getAttribute('position');
    const keys = Array.from({length: position.count}, (_, index) =>
      vectorKey(mesh.getVertexPosition(index,point).applyMatrix4(mesh.matrixWorld)));
    const index = geometry.getIndex();
    const count = index ? index.count : position.count;
    for (let vertex = 0; vertex < count; vertex += 3) {
      const face = [0, 1, 2].map(offset => keys[index ? index.getX(vertex + offset) : vertex + offset]);
      triangles.push(face.sort().join('|'));
    }
  }
  triangles.sort();
  const hash = createHash('sha256');
  for (const triangle of triangles) hash.update(triangle + '\n');
  return hash.digest('hex');
}

test('the release includes 37 regular champions, Lady Claire, the retained hidden Bernhard archive and all six ranks of the eight basic defenders', () => {
  assert.equal(champions.length, 39);
  assert.equal(championEntries.length, 39);
  assert.deepEqual(championEntries.map(entry => entry.family).sort(), [...champions].sort());
  assert.equal(new Set(championEntries.map(entry => entry.file)).size, 39);
  for (const entry of championEntries) {
    const secret = ['ladyclaire', 'lordbernhard'].includes(entry.family);
    assert.equal(entry.style, entry.family==='lordbernhard'?'champions-v7.10':'designed-defenders-v8', entry.family);
    assert.equal(entry.designRevision, entry.family==='lordbernhard'?10:11, entry.family);
    if (secret) assert.equal(entry.secret, true, entry.family);
    assert.equal(entry.authoring, 'Blender', entry.family);
    assert.equal(entry.name, towers[entry.family].name, entry.family);
    assert.equal(entry.tier, 1, entry.family);
    assert.ok(existsSync(new URL(entry.file, models)), entry.file);
    const portrait = new URL(`../public/assets/army/${entry.family}-t1.png`, import.meta.url);
    const source = new URL(`../${entry.source || `blender/scenes/${entry.family}_design_v1.blend`}`, import.meta.url);
    assert.ok(existsSync(portrait), `${entry.family}: portrait`);
    assert.ok(existsSync(source), `${entry.family}: editable Blender source`);
    const png = readFileSync(portrait);
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok(png.readUInt32BE(16) >= 300 && png.readUInt32BE(20) >= 300, entry.family);
    // Both plain and Blender 5's Zstandard-compressed .blend files are valid.
    assert.ok(readFileSync(source).length > 10000, `${entry.family}: source is empty`);
  }
  const basicEntries = manifest.filter(entry => entry.kind === 'tower' && basics.includes(entry.family));
  assert.equal(basicEntries.length, 48);
  assert.equal(basicEntries.filter(entry => entry.style === 'designed-defenders-v8'&&entry.designRevision===11).length, 48);
  assert.equal(champions.filter(family=>!towers[family].hidden).length,38);
  assert.equal(towers.lordbernhard.hidden,true);
  for (const family of basics) {
    assert.deepEqual(basicEntries.filter(entry => entry.family === family).map(entry => entry.tier).sort(), [1, 2, 3, 4, 5, 6]);
  }
});

test('Three.js loads all 87 defender variants with finite geometry, normals, bounds and the recorded triangle budget', async () => {
  assert.equal(defenderEntries.length, 87);
  for (const {entry, scene} of await loadDefenders()) {
    const meshes = meshList(scene);
    assert.ok(meshes.length > 0, `${entry.family}: no renderable meshes`);
    let triangles = 0;
    for (const mesh of meshes) {
      const geometry = mesh.geometry;
      const position = geometry.getAttribute('position');
      const normal = geometry.getAttribute('normal');
      assert.ok(position && position.itemSize === 3 && position.count >= 3, entry.family);
      assert.ok(normal && normal.itemSize === 3 && normal.count === position.count, `${entry.family}: normals`);
      for (const attribute of [position, normal]) {
        for (const value of attribute.array) assert.ok(Number.isFinite(value), `${entry.family}: non-finite vertex attribute`);
      }
      const index = geometry.getIndex();
      const count = index ? index.count : position.count;
      assert.equal(count % 3, 0, `${entry.family}: incomplete triangle`);
      if (index) for (const value of index.array) assert.ok(value >= 0 && value < position.count, `${entry.family}: invalid index`);
      triangles += count / 3;
    }
    assert.equal(triangles, entry.triangles, `${entry.family}: manifest triangle count`);
    const mountedSecret = entry.family === 'lordbernhard';
    assert.ok(triangles > 0 && triangles < budget(entry), `${entry.family}: ${triangles} triangles`);
    const bounds = new THREE.Box3().setFromObject(scene, true);
    for (const vector of [bounds.min, bounds.max]) {
      assert.ok([vector.x, vector.y, vector.z].every(Number.isFinite), `${entry.family}: invalid bounds`);
    }
    const size = bounds.getSize(new THREE.Vector3());
    assert.ok(size.x > .1 && size.x < 3.5, `${entry.family}: width ${size.x}`);
    // Mounted adult rider plus raised blade is taller than a standing defender.
    assert.ok(size.y > .1 && size.y < (mountedSecret ? 3.3 : 3), `${entry.family}: height ${size.y}`);
    assert.ok(size.z > .1 && size.z < 3.5, `${entry.family}: depth ${size.z}`);
  }
});

test('all 39 champions have distinct actual geometry, independent of their names and materials', async () => {
  const signatures = new Map();
  for (const {entry, scene} of await loadChampions()) {
    const signature = geometrySignature(scene);
    assert.ok(!signatures.has(signature), `${entry.family} duplicates the geometry of ${signatures.get(signature)}`);
    signatures.set(signature, entry.family);
  }
  assert.equal(signatures.size, 39);
});

test('secret champions preserve native bounds and editable Blender authoring metadata', async () => {
  for (const family of ['ladyclaire', 'lordbernhard']) {
    const {entry, scene} = (await loadChampions()).find(item => item.entry.family === family);
    const authored = scene.getObjectByName('secret_champion_' + family);
    assert.equal(authored?.userData.secret, true, family);
    assert.equal(authored.userData.assetRevision, family==='ladyclaire'?'designed-defenders-v8':'champions-v7.10', family);
    assert.equal(authored.userData.designName, towers[family].name, family);
    assert.equal(entry.source, `blender/scenes/${family}_design_v3.blend`);
    const size = new THREE.Box3().setFromObject(scene, true).getSize(new THREE.Vector3());
    const expected = [entry.bounds.size[0], entry.bounds.size[2], entry.bounds.size[1]];
    size.toArray().forEach((value, axis) => assert.ok(Math.abs(value - expected[axis]) < .001, `${family}: native axis ${axis}`));
  }
});

test('the exported Catapult native arm deforms actual weighted mesh vertices, releases from that arm and returns to rest independently of the cache', async () => {
  const source = (await loadChampions()).find(({entry}) => entry.family === 'stonewarden').scene;
  const actor = cloneDefenderTemplate(source);
  actor.updateMatrixWorld(true);
  const rig = attackRig(actor,'stonewarden',towers.stonewarden);
  assert.ok(rig.native, 'Catapult GLB lost its genuine weighted armature/clips');
  let muzzleBone=rig.muzzle;while(muzzleBone&&!muzzleBone.isBone)muzzleBone=muzzleBone.parent;
  assert.ok(muzzleBone, 'The catapult projectile origin must follow its authored deform bone');
  const rest = geometrySignature(actor);
  const original = geometrySignature(source);
  previewDefenderAttack(rig.native);updateDefenderPreview(rig.native,.36);
  actor.updateMatrixWorld(true);
  assert.notEqual(geometrySignature(actor), rest, 'The exported armature did not move actual geometry');
  assert.equal(geometrySignature(source), original, 'Animating a clone altered the cached source model');
  resetDefenderAnimation(rig.native,{reducedMotion:true});
  actor.updateMatrixWorld(true);
  assert.equal(geometrySignature(actor), rest, 'The loaded arm did not return its geometry to rest');
  disposeAttack(rig);disposeDefenderInstance(actor);
});

after(async () => {
  if (!loaded) return;
  const geometries = new Set(), materials = new Set();
  for (const {scene} of await loaded) {
    scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
        if (material) materials.add(material);
      }
    });
  }
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
});
