import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';

async function load(family) {
  const bytes=readFileSync(new URL(`../public/assets/models/advanced_${family}.glb`,import.meta.url));
  const gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  gltf.scene.updateMatrixWorld(true);return gltf;
}
function meshes(root){const list=[];root.traverse(node=>{if(node.isMesh)list.push(node);});return list;}
function materials(root){return [...new Set(meshes(root).flatMap(mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material]))];}
function dispose(root){for(const mesh of meshes(root))mesh.geometry.dispose();for(const material of materials(root))material.dispose();}
function point(root,name){const node=root.getObjectByName(name);assert.ok(node,`Missing ${name}`);return node.getWorldPosition(new THREE.Vector3());}
function nearestSurface(root,anchor){
  let distance=Infinity;const triangle=new THREE.Triangle(),closest=new THREE.Vector3();
  for(const mesh of meshes(root)){
    const positions=mesh.geometry.attributes.position,index=mesh.geometry.index;
    const vertices=Array.from({length:positions.count},(_,i)=>mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
    const count=index?index.count:positions.count;
    for(let i=0;i<count;i+=3){triangle.set(vertices[index?index.getX(i):i],vertices[index?index.getX(i+1):i+1],vertices[index?index.getX(i+2):i+2]);triangle.closestPointToPoint(anchor,closest);distance=Math.min(distance,closest.distanceTo(anchor));}
  }
  return distance;
}

test('Bernhard stays seated with boots supported by physical stirrups across both entire exported clips',async()=>{
  const {scene,animations}=await load('lordbernhard'),mixer=new THREE.AnimationMixer(scene);
  try{
    // Contact markers alone could hide floating geometry. Check each marker is
    // on the actual exported weighted surface before auditing its full motion.
    for(const name of ['rider_seat_contact','saddle_seat_surface','boot_L_sole','boot_R_sole','stirrup_L_tread','stirrup_R_tread'])assert.ok(nearestSurface(scene,point(scene,name))<.035,`${name} is not on the authored surface`);
    for(const clip of animations){
      mixer.stopAllAction();const action=mixer.clipAction(clip);action.play();action.paused=true;
      for(let frame=0;frame<=100;frame++){
        action.time=clip.duration*frame/100;mixer.update(0);scene.updateMatrixWorld(true);
        assert.ok(point(scene,'rider_seat_contact').distanceTo(point(scene,'saddle_seat_surface'))<.015,`${clip.name}/${frame}: pelvis lost saddle contact`);
        for(const side of ['L','R'])assert.ok(point(scene,`boot_${side}_sole`).distanceTo(point(scene,`stirrup_${side}_tread`))<.015,`${clip.name}/${frame}: unsupported foot`);
        assert.ok(point(scene,'sword_tip').toArray().every(Number.isFinite));
      }
    }
  }finally{mixer.stopAllAction();mixer.uncacheRoot(scene);dispose(scene);}
});

test('Bernhard has an enclosed helmet, five physically grounded digits on each gauntlet and no blue equipment',async()=>{
  const {scene}=await load('lordbernhard');
  try{
    assert.equal(scene.getObjectByName('head_pivot').userData.fullyClosedHelmet,true);
    for(const side of ['L','R']){
      assert.equal(scene.getObjectByName(`hand_${side}_grasp`).userData.digitCount,5);
      for(let digit=1;digit<=5;digit++){
        const marker=scene.getObjectByName(`hand_${side}_digit_${digit}`);assert.equal(marker.userData.digit,digit);
        assert.ok(nearestSurface(scene,marker.getWorldPosition(new THREE.Vector3()))<.022,'Digit marker has no actual glove surface');
      }
    }
    for(const material of materials(scene)){
      assert.doesNotMatch(material.name,/human skin|iris|pupil|blue/i);
      const {r,g,b}=material.color;assert.ok(!(b>.2&&b>r*1.35&&b>g*1.15),`Blue material ${material.name}`);
    }
    assert.ok(materials(scene).some(material=>material.emissive?.r>0&&/gold/i.test(material.name)));
    assert.ok(materials(scene).some(material=>material.roughnessMap),'Authored PBR surface textures must survive export');
  }finally{dispose(scene);}
});

test('Claire exports fresh sculpted anatomy, ten weighted finger joints, warm silk/gold materials and three drawable orbs',async()=>{
  const {scene,animations}=await load('ladyclaire');
  try{
    const rig=scene.getObjectByName('Lady_Claire_Rig');assert.match(rig.userData.anatomy,/five digits/);
    assert.equal(rig.userData.designRevision,11);assert.match(rig.userData.grip,/physical staff/);
    const skinned=meshes(scene).filter(mesh=>mesh.isSkinnedMesh);assert.ok(skinned.length>0);
    const bones=skinned[0].skeleton.bones;
    for(const side of ['L','R'])for(let digit=0;digit<5;digit++){
      const bone=bones.find(b=>b.name===`finger_${side}_${digit}`);assert.ok(bone,'Missing independently weighted digit');
      const index=bones.indexOf(bone);let influenced=0;
      for(const mesh of skinned)for(let i=0;i<mesh.geometry.attributes.skinWeight.count;i++)for(let slot=0;slot<4;slot++)if(mesh.geometry.attributes.skinIndex.getComponent(i,slot)===index&&mesh.geometry.attributes.skinWeight.getComponent(i,slot)>.01)influenced++;
      assert.ok(influenced>10,`${bone.name} has no real skin weights`);
    }
    for(let index=0;index<3;index++){const orb=scene.getObjectByName(`secret_orb_${index}`);assert.equal(orb.userData.secretOrbIndex,index);assert.equal(meshes(orb).length,2);}
    assert.ok(materials(scene).some(material=>/silk/i.test(material.name)));
    assert.ok(materials(scene).some(material=>/gold/i.test(material.name)));
    assert.ok(materials(scene).some(material=>/blond/i.test(material.name)));
    assert.deepEqual(animations.map(clip=>clip.name).sort(),['Attack','Idle']);
  }finally{dispose(scene);}
});
