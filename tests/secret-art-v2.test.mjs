import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

async function load(family) {
  const bytes=readFileSync(new URL(`../public/assets/models/advanced_${family}.glb`,import.meta.url));
  const scene=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
  scene.updateMatrixWorld(true);return scene;
}
function meshes(root) {const list=[];root.traverse(node=>{if(node.isMesh)list.push(node);});return list;}
function actualBounds(root) {assert.ok(root,'Missing authored geometry group');assert.ok(meshes(root).length);return new THREE.Box3().setFromObject(root,true);}
function materials(root) {return [...new Set(meshes(root).flatMap(mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material]))];}
function dispose(root) {for(const mesh of meshes(root))mesh.geometry.dispose();for(const material of materials(root))material.dispose();}

test('Bernhard’s actual seated pelvis contacts the saddle cushion and is supported by the horse',async()=>{
  const scene=await load('lordbernhard');
  try {
    const seat=actualBounds(scene.getObjectByName('rider_seat'));
    const saddle=actualBounds(scene.getObjectByName('saddle_seat'));
    // A small intersection keeps contact after export float precision; the old
    // model had a visible ~0.2-metre vertical gap above its saddle.
    assert.ok(Math.abs(seat.min.y-saddle.max.y)<.025,`Seat/saddle gap ${seat.min.y-saddle.max.y}`);
    assert.ok(seat.min.x<saddle.max.x&&seat.max.x>saddle.min.x,'Seat must overlap saddle laterally');
    assert.ok(seat.min.z<saddle.max.z&&seat.max.z>saddle.min.z,'Seat must overlap saddle longitudinally');
    const horse=actualBounds(scene.getObjectByName('horse_body'));
    assert.ok(saddle.min.y<horse.max.y+.08,'Saddle must rest on horse body');
    const size=horse.getSize(new THREE.Vector3());
    assert.ok(size.z>size.x*2,'Horse must have an elongated equine body, rather than a compact toy barrel');
    const legs=[];scene.traverse(node=>{if(node.name.startsWith('leg_horse_'))legs.push(node);});
    assert.equal(legs.length,4);
    for(const leg of legs){const bounds=actualBounds(leg);assert.ok(bounds.max.y-bounds.min.y>.55,'Full leg must extend below body');assert.ok(Math.abs(bounds.min.y-.16)<.015,'Hoof must stand on the authored footing');}
  }finally{dispose(scene);}
});

test('Bernhard exports a fully covered helmet and radiant gold equipment without blue accessories',async()=>{
  const scene=await load('lordbernhard');
  try {
    const helmet=scene.getObjectByName('head_pivot');actualBounds(helmet);
    for(const material of materials(scene)){
      assert.doesNotMatch(material.name,/skin|eye|iris|pupil|blue/i,'Closed armor must not expose a human face or blue equipment');
      const color=material.color;
      assert.ok(!(color.b>.2&&color.b>color.r*1.35&&color.b>color.g*1.15),`Blue material ${material.name}`);
    }
    assert.ok(materials(helmet).some(material=>/gold/i.test(material.name)),'Helmet needs its modeled gold ornament');
    assert.ok(materials(scene).some(material=>material.emissive?.r>0&&/gold/i.test(material.name)),'Gold equipment should be softly radiant');
  }finally{dispose(scene);}
});

test('Claire has an independent adult face, a real crown and continuous low blonde hairline',async()=>{
  const scene=await load('ladyclaire');
  try {
    const head=scene.getObjectByName('head_pivot');
    assert.match(head.userData.identitySource,/Original Claire V2 adult face/);
    const face=new THREE.Box3();
    for(const mesh of meshes(head))if(/skin/i.test(mesh.material.name))face.union(actualBounds(mesh));
    assert.ok(!face.isEmpty(),'New face must have actual skin geometry');
    const crown=actualBounds(scene.getObjectByName('royal_crown'));
    assert.ok(crown.max.y>face.max.y+.075,'Crown must rise visibly above her head');
    assert.ok(crown.min.y<face.max.y+.01,'Crown must sit on her scalp rather than float above it');
    const hair=scene.getObjectByName('natural_hairline');actualBounds(hair);
    const front=[];const point=new THREE.Vector3();
    for(const mesh of meshes(hair)){
      const position=mesh.geometry.attributes.position;
      for(let i=0;i<position.count;i++){
        point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
        if(Math.abs(point.x)<.035&&point.z<-.055)front.push(point.y);
      }
    }
    assert.ok(front.length>0,'Scalp must cover the central front of the forehead');
    assert.ok(Math.min(...front)<face.max.y-.06,'Hairline must start well below the top of the skull');
    assert.ok(actualBounds(hair).min.y<face.min.y-.2,'Loose hair must reach below the shoulders');
    assert.ok(!materials(head).some(material=>/Kushek/i.test(material.name)),'Rebuilt face must not reuse Kushek geometry/materials');
  }finally{dispose(scene);}
});
