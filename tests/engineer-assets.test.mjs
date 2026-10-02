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

test('Engineer keeps his stable identity and historical native scene while using all six turnaround ranks', () => {
  assert.equal(towers.runebreaker.name, 'Engineer');
  assert.equal(towers.runebreaker.short, 'Engineer');
  assert.equal(towers.runebreaker.unitCode, 'R');
  assert.ok(!/Kushek|blonde human/i.test(towers.runebreaker.description));
  for (let tier=1; tier<=6; tier++) {
    const entry=manifest.find(item=>item.kind==='tower'&&item.family==='runebreaker'&&item.tier===tier);
    assert.equal(entry.style,'hooded-turnarounds-v3');
    assert.equal(entry.file,`human_runebreaker_t${tier}.glb`);
    assert.equal(entry.source,'blender/scenes/hooded-turnarounds-v3/runebreaker_ranks.blend');
    const png=readFileSync(new URL(`../public/assets/army/runebreaker-t${tier}.png`,import.meta.url));
    assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  }
  assert.equal(digest(readFileSync(new URL('../blender/scenes/runebreaker_design_v1.blend', import.meta.url))), '2736b9db7c41ee8cd9385d456464d70b2f8c1ef26c532564a06b2aefada6e43e');
});

test('the turnaround dwarf keeps his moving tools and gains physical apron, goggles, claw and armor at the intended ranks', async () => {
  for (let tier=1; tier<=6; tier++) {
    const entry=manifest.find(item => item.kind==='tower' && item.family==='runebreaker' && item.tier===tier);
    const bytes=readFileSync(new URL(`../public/assets/models/${entry.file}`, import.meta.url));
    const source=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength), '')).scene;
    source.updateMatrixWorld(true);
    const names=[]; source.traverse(node=>names.push(node.name));
    const meshes=meshList(source),part=mesh=>mesh.userData.part||mesh.name;
    const parts=pattern=>meshes.filter(mesh=>pattern.test(part(mesh)));
    const torso=source.getObjectByName('torso_pivot'),weapon=source.getObjectByName('weapon_R');
    const movingTools=new Set(meshList(weapon));
    const beard=parts(/^engineer_one_copper_beard_wedge$/i);
    assert.equal(beard.length,1,`Engineer ${tier}: one copper beard`);
    assert.equal(beard[0].material.color.getHexString(),'a36236');
    assert.ok(names.some(name=>/beard/i.test(name)));
    assert.equal(names.some(name=>/goggle/i.test(name)),tier>=3);
    assert.ok(names.some(name=>/hammer|mallet/i.test(name)));
    assert.ok(names.some(name=>/ruler/i.test(name)));
    assert.ok(names.every(name=>!name.includes('Kushek')));
    const goggles=parts(/^engineer_(left|right)_cap_top_goggle_lens$/i);
    assert.equal(goggles.length,tier>=3?2:0,`Engineer ${tier}: two cap-top lenses from III`);
    for(const lens of goggles){
      const eyeTop=Math.max(...parts(/^Dark_Eye_/).map(mesh=>new THREE.Box3().setFromObject(mesh,true).max.y));
      assert.ok(new THREE.Box3().setFromObject(lens,true).min.y>eyeTop+.04,`Engineer ${tier}: goggles stay on cap, above eyes`);
    }
    const aprons=parts(/^engineer_(plain|long_wide)_leather_apron$/i);
    assert.equal(aprons.length,tier>=2?1:0,`Engineer ${tier}: one front apron from II`);
    assert.equal(parts(/^engineer_long_wide_leather_apron$/i).length,tier>=4?1:0,`Engineer ${tier}: longer apron from IV`);
    assert.equal(parts(/^engineer_(left|right)_front_apron_shoulder_strap$/i).length,tier>=2?2:0);
    const backStraps=parts(/^engineer_(left|right)_back_apron_shoulder_strap$/i);
    assert.equal(backStraps.length,tier>=2?2:0);
    const torsoZ=torso.getWorldPosition(new THREE.Vector3()).z;
    for(const apron of aprons)assert.ok(new THREE.Box3().setFromObject(apron,true).getCenter(new THREE.Vector3()).z<torsoZ-.05,`Engineer ${tier}: apron belongs on front`);
    for(const strap of backStraps)assert.ok(new THREE.Box3().setFromObject(strap,true).getCenter(new THREE.Vector3()).z>torsoZ+.05,`Engineer ${tier}: straps attach on back`);
    assert.equal(parts(/^engineer_right_working_forearm_wide_leather_bracer$/i).length,tier===3||tier===4?1:0,`Engineer ${tier}: dedicated leather tool bracer III/IV`);
    for(const side of ['left','right']){
      const bracer=parts(new RegExp(`^${side}_bracer$`));assert.equal(bracer.length,1);
      assert.equal(bracer[0].material.color.getHexString()==='9ea8b2',tier>=5,`Engineer ${tier}: ${side} steel forearm guard from V`);
    }
    assert.equal(parts(/^engineer_broad_grey_apron_reinforcement$/i).length,tier>=5?1:0,`Engineer ${tier}: gray apron reinforcement from V`);
    const chest=parts(/^engineer_single_front_protective_chest_panel$/i);
    assert.equal(chest.length,tier===6?1:0,`Engineer ${tier}: chest panel only VI`);
    for(const plate of chest){
      assert.equal(plate.material.color.getHexString(),'9ea8b2');
      assert.ok(new THREE.Box3().setFromObject(plate,true).getCenter(new THREE.Vector3()).z<torsoZ-.05,`Engineer ${tier}: chest panel is on front`);
    }
    const handles=parts(/^engineer_wooden_hammer_handle$/i);
    assert.equal(handles.length,1);assert.ok(movingTools.has(handles[0]),`Engineer ${tier}: hammer handle follows right hand`);
    assert.equal(handles[0].material.color.getHexString(),'775237');
    const headPattern=tier===1?/^engineer_whole_wooden_mallet_head$/i:tier<=3?/^engineer_plain_iron_hammer_head$/i:tier===6?/^engineer_master_hammer_striking_face$/i:/^engineer_carpenter_hammer_striking_face$/i;
    const heads=parts(headPattern);assert.equal(heads.length,1);assert.ok(movingTools.has(heads[0]));
    assert.equal(heads[0].material.color.getHexString(),tier===1?'775237':'9ea8b2',`Engineer ${tier}: correct hammer-head material`);
    const claws=parts(/^engineer_single_(broad|master)_carpenter_claw$/i);
    assert.equal(claws.length,tier>=4?1:0,`Engineer ${tier}: one real carpenter claw from IV`);
    for(const claw of claws){assert.ok(movingTools.has(claw));assert.equal(claw.material.color.getHexString(),'9ea8b2');}
    const size=new THREE.Box3().setFromObject(source,true).getSize(new THREE.Vector3());
    assert.ok(size.y>1.5 && size.y<2.2);
    assert.equal(meshList(source).reduce((sum,mesh)=>sum+(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3,0), entry.triangles);
    const actor=source.clone(true), rig=attackRig(actor,'runebreaker',towers.runebreaker);
    const movingWeapon=actor.getObjectByName('weapon_R'), rest=movingWeapon.getWorldQuaternion(new THREE.Quaternion());
    triggerAttack(rig); animateAttack(rig,.14);
    assert.ok(movingWeapon.getWorldQuaternion(new THREE.Quaternion()).angleTo(rest)>.01);
    assert.ok(source.getObjectByName('weapon_R').getWorldQuaternion(new THREE.Quaternion()).angleTo(rest)<.000001);
    resetAttack(rig); assert.ok(movingWeapon.getWorldQuaternion(new THREE.Quaternion()).angleTo(rest)<.000001); disposeAttack(rig);
    const resources=new Set();
    for(const mesh of meshList(source)){resources.add(mesh.geometry);for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])resources.add(material);}
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
