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
const equipment=JSON.parse(readFileSync(new URL('../blender/scripts/defender_turnarounds_v3/equipment.json',import.meta.url)));
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
function materialsOf(mesh){return Array.isArray(mesh.material)?mesh.material:[mesh.material];}
function assertClosedConnectedMesh(mesh,label){
  // glTF duplicates positions at hard normal seams. Weld only identical
  // positions for topology checks; distinct physical pieces stay distinct.
  const positions=mesh.geometry.attributes.position,index=mesh.geometry.index;
  const points=Array.from({length:positions.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(positions,i));
  const keys=points.map(p=>p.toArray().map(v=>Math.round(v*1e6)).join(','));
  const parent=new Map(),edges=new Map();
  const find=key=>{if(!parent.has(key))parent.set(key,key);const p=parent.get(key);if(p!==key)parent.set(key,find(p));return parent.get(key);};
  const join=(a,b)=>{parent.set(find(a),find(b));};
  const count=index?.count||positions.count;assert.equal(count%3,0,`${label}: complete triangle indices`);
  for(let i=0;i<count;i+=3){
    const ids=[0,1,2].map(offset=>index?index.getX(i+offset):i+offset),tri=ids.map(id=>keys[id]);
    assert.equal(new Set(tri).size,3,`${label}: collapsed triangle`);
    const area=points[ids[1]].clone().sub(points[ids[0]]).cross(points[ids[2]].clone().sub(points[ids[0]])).lengthSq();
    assert.ok(area>1e-16,`${label}: zero-area triangle`);
    join(tri[0],tri[1]);join(tri[1],tri[2]);
    for(let side=0;side<3;side++){
      const edge=[tri[side],tri[(side+1)%3]].sort().join('|');edges.set(edge,(edges.get(edge)||0)+1);
    }
  }
  assert.equal(new Set([...parent.keys()].map(find)).size,1,`${label}: detached geometry components`);
  assert.ok(edges.size>0,`${label}: actual solid geometry`);
  for(const count of edges.values())assert.equal(count,2,`${label}: open or nonmanifold edge`);
}
function unitRoot(scene,entry){
  const units=[];scene.traverse(node=>{if(node.userData.assetRevision==='hooded-turnarounds-v3'&&node.userData.family===entry.family&&node.userData.tier===entry.tier)units.push(node);});
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
    assert.equal(entry.style,'hooded-turnarounds-v3',key);assert.equal(entry.authoring,'Blender',key);
    assert.equal(entry.file,`human_${entry.family}_t${entry.tier}.glb`,key);
    assert.equal(entry.source,`blender/scenes/hooded-turnarounds-v3/${entry.family}_ranks.blend`,key);
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
    druid:[[/One_Connected_Green_Leaf_Mantle/i,2],[/Two_End_Antler_Main/i,3],[/Druid_Long_Three_Leaf_Tip_Cape/i,4],[/One_Green_Seed_Stone/i,5]],
    mage:[[/Mage_One_Broad_Thin_Wizard_Brim/i,2],[/Spellbook/i,4],[/Single_Broad_Crystal_Prongs/i,5],[/One_Open_Page_Block/i,6]],
    cleric:[[/Cleric_Plain_Deep_Mitre/i,2],[/Devotional_Book/i,4],[/One_Open_Page_Block/i,6]],
    runebreaker:[[/Apron/i,2],[/Goggle/i,3],[/engineer_single_(broad|master)_carpenter_claw/i,4],[/engineer_single_front_protective_chest_panel/i,6]],
    frostwarden:[[/frost_one_connected_ivory_winter_collar/i,2],[/frost_(small|large)_hexagonal_ice_shield/i,3],[/frost_large_hexagonal_ice_shield/i,5],[/Shoulder_Plate/i,6]],
    stormcaller:[[/Circlet/i,2],[/storm_one_three_prong_lightning/i,5],[/storm_right_small_silver_hand_back_plate/i,6]],
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
    const meshes=meshList(await load(entry)),robe=meshes.find(mesh=>mesh.userData.part==='Caster_Continuous_Long_Robe');
    assert.ok(robe,`${entry.family}/${entry.tier}: continuous robe shell`);
    const trousers=meshes.filter(mesh=>/Trouser/i.test(mesh.userData.part||mesh.name));
    for(const x of [-.13,.13]){
      const hit=new THREE.Raycaster(new THREE.Vector3(x,.8,-2),new THREE.Vector3(0,0,1)).intersectObjects([robe,...trousers],false)[0];
      assert.equal(hit?.object,robe,`${entry.family}/${entry.tier}: trousers pierce robe front`);
    }
  }
});

test('every Cleric holds one solid gold Latin cross and has no old sun geometry',async()=>{
  for(const entry of entries.filter(e=>e.family==='cleric')){
    const root=unitRoot(await load(entry),entry),key=`Cleric ${entry.tier}`,meshes=meshList(root);
    const crosses=meshes.filter(mesh=>mesh.userData.part==='Cleric_Exactly_One_Plain_Gold_Latin_Cross');
    assert.equal(crosses.length,1,`${key}: exactly one cross`);
    assert.ok(!meshes.some(mesh=>/sun|ray/i.test(mesh.userData.part||mesh.name)),`${key}: obsolete sun disc or rays`);
    const cross=crosses[0],right=root.getObjectByName('weapon_R'),left=root.getObjectByName('weapon_L');
    assert.ok(meshList(right).includes(cross),`${key}: cross moves with anatomical right staff hand`);
    assert.ok(!meshList(left).includes(cross),`${key}: no left-hand cross copy`);
    assert.ok(materialsOf(cross).every(material=>/^MAT_gold/.test(material.name)&&material.color.getHexString()==='d8ad4f'),`${key}: real gold material`);
    assertClosedConnectedMesh(cross,`${key}: cross`);
    const box=new THREE.Box3().setFromObject(cross,true),size=box.getSize(new THREE.Vector3()),centre=box.getCenter(new THREE.Vector3());
    assert.ok(size.x>.2&&size.y>.3&&size.z>.04&&size.z<size.x/3,`${key}: cross has real narrow profile depth`);
    const points=Array.from({length:cross.geometry.attributes.position.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(cross.geometry.attributes.position,i).applyMatrix4(cross.matrixWorld));
    const arms=points.filter(p=>Math.abs(p.x-centre.x)>size.x*.35);
    assert.ok(arms.length>=4,`${key}: two real horizontal arms`);
    const lower=Math.min(...arms.map(p=>p.y))-box.min.y,upper=box.max.y-Math.max(...arms.map(p=>p.y));
    assert.ok(lower>upper*2&&upper>0,`${key}: Latin cross lower stem must be longer than its upper stem`);
    assert.ok(root.userData.equipment.includes('latin_cross_staff'),`${key}: current equipment metadata`);
    assert.ok(!root.userData.equipment.some(item=>/sun/i.test(item)),`${key}: obsolete sun metadata`);
  }
});

test('every Frost Warden spear is one connected all-ice solid including its shaft and grip',async()=>{
  for(const entry of entries.filter(e=>e.family==='frostwarden')){
    const root=unitRoot(await load(entry),entry),key=`Frost Warden ${entry.tier}`,right=root.getObjectByName('weapon_R'),left=root.getObjectByName('weapon_L');
    const held=meshList(right),spears=held.filter(mesh=>mesh.userData.part==='frost_entire_continuous_ice_spear');
    assert.equal(spears.length,1,`${key}: one entire spear`);
    assert.equal(held.length,1,`${key}: shaft, grip and head must share one mesh, without socket or wraps`);
    assert.ok(!meshList(left).some(mesh=>/spear/i.test(mesh.userData.part||mesh.name)),`${key}: no left-hand spear copy`);
    const spear=spears[0];
    assert.ok(materialsOf(spear).every(material=>/^MAT_ice/.test(material.name)&&material.color.getHexString()==='9bd9ee'),`${key}: every spear surface is ice`);
    assertClosedConnectedMesh(spear,`${key}: spear`);
    const size=new THREE.Box3().setFromObject(spear,true).getSize(new THREE.Vector3());
    assert.ok(size.y>1.7&&size.x>=.149&&size.z>.04,`${key}: full-length shaft and faceted head, not a floating ice tip`);
    assert.ok(root.userData.equipment.some(item=>/^(master_)?all_ice_spear$/.test(item)),`${key}: current all-ice equipment metadata`);
    assert.ok(!root.userData.equipment.some(item=>/ice_staff/.test(item)),`${key}: obsolete separate-head staff metadata`);
  }
});

after(async()=>{
  const resources=new Set();for(const scene of await Promise.all(loaded.values()))scene.traverse(node=>{if(node.geometry)resources.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])if(material)resources.add(material);});
  for(const resource of resources)resource.dispose();
});
