import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {rankColor} from '../game/render/ranks.js';

const families=['soldier','archer','druid','mage','cleric','runebreaker','frostwarden','stormcaller'];
const folder=new URL('../public/assets/models/',import.meta.url);
const entries=JSON.parse(readFileSync(new URL('manifest.json',folder))).filter(entry=>entry.kind==='tower'&&families.includes(entry.family));
const equipment=JSON.parse(readFileSync(new URL('../blender/scripts/defender_ranks_v2/equipment.json',import.meta.url)));
const loaded=new Map();
async function load(entry){
  if(!loaded.has(entry.file))loaded.set(entry.file,(async()=>{
    const bytes=readFileSync(new URL(entry.file,folder));
    const gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    gltf.scene.updateMatrixWorld(true);return gltf.scene;
  })());
  return loaded.get(entry.file);
}
function meshList(root){const result=[];root.traverse(node=>{if(node.isMesh)result.push(node);});return result;}
function unitRoot(scene,entry){
  const units=[];scene.traverse(node=>{if(node.userData.assetRevision==='hooded-ranks-v2'&&node.userData.family===entry.family&&node.userData.tier===entry.tier)units.push(node);});
  assert.equal(units.length,1,`${entry.family}/${entry.tier}: missing or duplicate authored unit root`);return units[0];
}
function geometrySignature(root){
  root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),point=new THREE.Vector3(),triangles=[];
  for(const mesh of meshList(root)){
    const positions=mesh.geometry.attributes.position,index=mesh.geometry.index;
    const keys=Array.from({length:positions.count},(_,i)=>point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse).toArray().map(v=>Math.round(v*100000)).join(','));
    const count=index?.count||positions.count;
    for(let i=0;i<count;i+=3)triangles.push([0,1,2].map(offset=>keys[index?index.getX(i+offset):i+offset]).sort().join('|'));
  }
  return createHash('sha256').update(triangles.sort().join('\n')).digest('hex');
}

test('all eight basic classes ship six faceted ranks with matching native scenes, portraits and actual cloth colors',async()=>{
  assert.equal(entries.length,48);
  const sources=new Set();
  for(const family of families)assert.deepEqual(entries.filter(e=>e.family===family).map(e=>e.tier).sort(),[1,2,3,4,5,6],family);
  for(const entry of entries){
    const key=`${entry.family}/${entry.tier}`;
    assert.equal(entry.style,'hooded-ranks-v2',key);assert.equal(entry.authoring,'Blender',key);
    assert.equal(entry.file,`human_${entry.family}_t${entry.tier}.glb`,key);
    assert.equal(entry.source,`blender/scenes/hooded-ranks-v2/${entry.family}_ranks.blend`,key);
    sources.add(entry.source);assert.ok(existsSync(new URL('../'+entry.source,import.meta.url)),`${key}: editable scene`);
    const png=readFileSync(new URL(`../public/assets/army/${entry.family}-t${entry.tier}.png`,import.meta.url));
    assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10],key);
    assert.ok(png.readUInt32BE(16)>=300&&png.readUInt32BE(20)>=300,`${key}: portrait resolution`);
    const scene=await load(entry),root=unitRoot(scene,entry);
    assert.equal(root.userData.rankColor,rankColor(entry.tier),key);
    assert.ok(Array.isArray(root.userData.equipment)&&root.userData.equipment.length>0,`${key}: equipment metadata`);
    assert.ok(root.userData.equipment.every(item=>typeof item==='string'),key);
    assert.deepEqual(root.userData.equipment,equipment[entry.family][entry.tier-1],`${key}: GLB equipment identity`);
    assert.deepEqual(entry.equipment,root.userData.equipment,`${key}: manifest and GLB equipment differ`);
    const materials=meshList(root).flatMap(mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material]);
    assert.ok(materials.some(material=>material.color.getHexString()===rankColor(entry.tier).slice(1)),`${key}: real cloth material must match rank palette`);
    assert.ok(!scene.getObjectByName('Mythic aura')&&!scene.getObjectByName('Orbiting radiance')&&!scene.getObjectByName('Rank signal'),`${key}: rank effects belong to runtime`);
  }
  assert.equal(sources.size,8);
});

test('each basic rank changes real equipment geometry rather than exporting six recolors',async()=>{
  for(const family of families){
    const signatures=new Set();
    for(const entry of entries.filter(e=>e.family===family))signatures.add(geometrySignature(unitRoot(await load(entry),entry)));
    assert.equal(signatures.size,6,`${family}: duplicate rank geometry`);
  }
});

test('all 48 basic ranks retain the exact moving weapon hierarchy required by combat animation',async()=>{
  for(const entry of entries){
    const root=unitRoot(await load(entry),entry),key=`${entry.family}/${entry.tier}`;
    assert.equal(root.name,`basic_defender_${entry.family}_t${entry.tier}`,key);
    const torso=root.getObjectByName('torso_pivot'),head=root.getObjectByName('head_pivot');
    assert.equal(torso?.parent,root,`${key}: torso joint`);assert.equal(head?.parent,torso,`${key}: head joint`);
    for(const suffix of ['L','R']){
      const upper=root.getObjectByName(`upper_arm_${suffix}`),forearm=root.getObjectByName(`forearm_${suffix}`),hand=root.getObjectByName(`hand_${suffix}`);
      const weaponName=entry.family==='archer'&&suffix==='L'?'bow_pivot':`weapon_${suffix}`,weapon=root.getObjectByName(weaponName);
      assert.equal(upper?.parent,torso,`${key}: ${suffix} upper arm`);assert.equal(forearm?.parent,upper,`${key}: ${suffix} forearm`);
      assert.equal(hand?.parent,forearm,`${key}: ${suffix} wrist`);assert.equal(weapon?.parent,hand,`${key}: ${weaponName}`);
      assert.ok(meshList(upper).length&&meshList(forearm).length&&meshList(hand).length,`${key}: ${suffix} joints must move real meshes`);
    }
    for(const name of entry.attackJoints)assert.ok(root.getObjectByName(name),`${key}: recorded joint ${name} does not exist`);
    const muzzle=root.getObjectByName('attack_muzzle');assert.ok(muzzle,`${key}: projectile origin`);
    if(entry.family==='archer'){
      const bow=root.getObjectByName('bow_pivot');assert.ok(meshList(bow).length,`${key}: moving bow`);
      for(const name of ['bow_tip_upper','bow_tip_lower','authored_bowstring'])assert.equal(root.getObjectByName(name)?.parent,bow,`${key}: ${name}`);
      assert.equal(root.getObjectByName('bow_nock')?.parent,root.getObjectByName('hand_R'),`${key}: string follows drawing hand`);
      assert.equal(muzzle.parent,bow,`${key}: bow release origin`);
    }else{
      const weapon=root.getObjectByName('weapon_R');assert.ok(meshList(weapon).length,`${key}: held weapon`);
      assert.equal(muzzle.parent,weapon,`${key}: muzzle follows weapon`);
      if(!['soldier','runebreaker'].includes(entry.family))assert.equal(root.getObjectByName('staff_tip')?.parent,weapon,`${key}: moving casting focus`);
    }
  }
});

test('Soldier geometry follows the requested unarmored spear to full knight sequence',async()=>{
  for(const entry of entries.filter(e=>e.family==='soldier')){
    const root=unitRoot(await load(entry),entry),meshes=meshList(root),names=meshes.map(mesh=>mesh.userData.part||mesh.name);
    const has=pattern=>names.some(name=>pattern.test(name)),rank=entry.tier;
    assert.equal(has(/wooden_spear/i),rank===1,`Soldier ${rank}: wooden spear`);
    assert.equal(has(/sword_blade/i),rank>=2,`Soldier ${rank}: sword`);
    assert.equal(has(/helmet|closed_helm/i),rank>=2,`Soldier ${rank}: helmet`);
    assert.equal(has(/wooden_shield/i),rank===3||rank===4,`Soldier ${rank}: wooden shield`);
    assert.equal(has(/iron_shield/i),rank>=5,`Soldier ${rank}: iron shield`);
    assert.equal(has(/^breastplate/i),rank>=4,`Soldier ${rank}: breastplate`);
    assert.equal(has(/armored_knee/i),rank>=5,`Soldier ${rank}: plate armor`);
    assert.equal(has(/closed_helm/i),rank===6,`Soldier ${rank}: closed knight helmet`);
    assert.equal(has(/shoulder_plate/i),rank>=5,`Soldier ${rank}: plate shoulders`);
    for(const side of ['left','right']){
      const bracer=meshes.find(mesh=>(mesh.userData.part||mesh.name)===`${side}_bracer`);
      assert.ok(bracer,`Soldier ${rank}: missing ${side} forearm`);
      assert.equal(bracer.material.color.getHexString()==='9ea8b2',rank>=5,`Soldier ${rank}: metal forearm armor`);
    }
  }
});

test('class-defining upgrades exist as visible meshes at their intended ranks',async()=>{
  const upgrades={
    archer:[[/leather_jerkin/i,3],[/shoulder_plate/i,5],[/silver_chest_edging/i,6]],
    druid:[[/Connected_Leaf_Shoulder_Mantle/i,2],[/Antler_Main/i,3],[/Long_Three_Tip_Leaf_Cape/i,4],[/One_Green_Seed_Stone/i,5]],
    mage:[[/Wide_Wizard_Hat_Brim/i,2],[/Spellbook/i,4],[/Broad_Crystal_Prongs/i,5],[/Plain_Open_Pages/i,6]],
    cleric:[[/Plain_(Low|Two_Point)_Mitre/i,2],[/Devotional_Book/i,4],[/Sun_Head_8_Broad_Rays/i,6]],
    runebreaker:[[/Apron/i,2],[/Goggle/i,3],[/Angular_Claw/i,4],[/Single_Protective_Breast_Panel/i,6]],
    frostwarden:[[/Winter_One_Piece_Ivory_Collar/i,2],[/Faceted_Ice_Shield/i,3],[/Large_Faceted_Ice_Shield/i,5],[/Shoulder_Plate/i,6]],
    stormcaller:[[/Circlet/i,2],[/Master_Three_Prong_Lightning/i,5],[/Master_Casting_Hand_Guard/i,6]],
  };
  for(const entry of entries){
    const root=unitRoot(await load(entry),entry),parts=meshList(root).map(mesh=>mesh.userData.part||mesh.name);
    for(const [pattern,firstRank]of upgrades[entry.family]||[])assert.equal(parts.some(part=>pattern.test(part)),entry.tier>=firstRank,`${entry.family}/${entry.tier}: ${pattern}`);
  }
});

test('Soldier spear stays connected and its final helmet encloses the face',async()=>{
  const recruit=await load(entries.find(e=>e.family==='soldier'&&e.tier===1));
  const parts=meshList(recruit),shaft=parts.find(mesh=>mesh.userData.part==='wooden_spear_shaft'),point=parts.find(mesh=>mesh.userData.part==='wooden_spear_point');
  assert.ok(shaft&&point);
  assert.ok(new THREE.Box3().setFromObject(shaft,true).max.y>=new THREE.Box3().setFromObject(point,true).min.y,'Spear point is detached from its shaft');
  const knight=await load(entries.find(e=>e.family==='soldier'&&e.tier===6)),knightParts=meshList(knight);
  const helmet=knightParts.find(mesh=>mesh.userData.part==='closed_helm'),face=knightParts.find(mesh=>mesh.userData.part==='Angular_Face');
  assert.ok(helmet);
  if(face){
    const origin=new THREE.Box3().setFromObject(face,true).getCenter(new THREE.Vector3());origin.z-=2;
    const hit=new THREE.Raycaster(origin,new THREE.Vector3(0,0,1)).intersectObjects([helmet,face],false)[0];
    assert.equal(hit?.object,helmet,'Face protrudes through the closed knight helmet');
  }
});

test('long Mage and Cleric robe fronts enclose their upper trousers',async()=>{
  for(const entry of entries.filter(e=>['mage','cleric'].includes(e.family))){
    const meshes=meshList(await load(entry)),robe=meshes.find(mesh=>mesh.userData.part==='continuous_long_robe');
    assert.ok(robe,`${entry.family}/${entry.tier}: continuous robe shell`);
    const trousers=meshes.filter(mesh=>/Trouser/i.test(mesh.userData.part||mesh.name));
    for(const x of [-.13,.13]){
      const hit=new THREE.Raycaster(new THREE.Vector3(x,.8,-2),new THREE.Vector3(0,0,1)).intersectObjects([robe,...trousers],false)[0];
      assert.equal(hit?.object,robe,`${entry.family}/${entry.tier}: trousers pierce robe front`);
    }
  }
});

after(async()=>{
  const resources=new Set();for(const scene of await Promise.all(loaded.values()))scene.traverse(node=>{if(node.geometry)resources.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])if(material)resources.add(material);});
  for(const resource of resources)resource.dispose();
});
