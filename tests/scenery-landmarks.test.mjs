import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {LANDMARK_SITES,LANDMARK_CLEARINGS,WARCAMP_PREVIEW_LOCAL,createLandmarkScenery} from '../game/render/scenery-landmarks.js';
import {createValleyRelief,valleyGroundHeight} from '../game/render/valley-relief.js';
import {valleyEnvironment} from '../game/render/environment.js';

async function loadModel(file){
  const bytes=readFileSync(new URL(`../public/assets/scenery/${file}`,import.meta.url));
  assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
function dispose(root){
  const resources=new Set();root.traverse(object=>{if(object.geometry)resources.add(object.geometry);if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])resources.add(material);});
  resources.forEach(resource=>resource.dispose());
}

test('both detailed Blender landmarks load within their triangle budget and remain outside the build field',async()=>{
  for(const [name,site]of Object.entries(LANDMARK_SITES)){
    const {scene}=await loadModel(site.file);let triangles=0,meshes=0;
    scene.traverse(object=>{if(!object.isMesh)return;meshes++;
      const position=object.geometry.attributes.position;
      for(const value of position.array)assert.ok(Number.isFinite(value));
      triangles+=(object.geometry.index?.count??position.count)/3;
    });
    assert.ok(triangles>15000&&triangles<(name==='keep'?25000:36000),name+' complete settlement within a bounded geometry budget');
    assert.ok(meshes<=24,name+' material batches bound draw calls for the whole settlement');
    scene.position.set(site.x,site.y,site.z);
    const bounds=new THREE.Box3().setFromObject(scene,true);
    assert.ok(bounds.max.x<=-18.5||bounds.min.x>=18.5||bounds.max.z<=-18.5||bounds.min.z>=18.5,name);
    assert.ok(bounds.max.y>3.5);
    if(name==='keep'){assert.ok(bounds.max.y>13,'The enlarged castle is monumental');assert.ok(bounds.max.x-bounds.min.x>26,'The castle town fills the eastern shoulder');}
    else assert.ok(bounds.max.x-bounds.min.x>18,'The inhabited military camp extends beyond the first palisade');
    const source=new URL(`../blender/scenes/${site.file.replace('.glb','.blend')}`,import.meta.url);
    assert.ok(statSync(source).size>10000,'Native editable source is retained');
    dispose(scene);
  }
});

test('loading both landmarks preserves the single upcoming-invader anchor behind the camp gate',async()=>{
  const scenery=createLandmarkScenery(),anchor=scenery.previewAnchor;
  const figure=new THREE.Group();anchor.add(figure);let calls=0;
  const loader={async loadAsync(url){calls++;const site=Object.values(LANDMARK_SITES).find(site=>url.includes(site.file));assert.ok(site);return loadModel(site.file);}};
  const first=scenery.load(loader);assert.equal(scenery.load(loader),first);
  assert.deepEqual(await first,{camp:true,keep:true});assert.equal(calls,2);
  assert.equal(scenery.previewAnchor,anchor);assert.equal(anchor.parent,scenery.camp);assert.equal(anchor.children[0],figure);
  assert.deepEqual(anchor.position.toArray(),[WARCAMP_PREVIEW_LOCAL.x,WARCAMP_PREVIEW_LOCAL.y,WARCAMP_PREVIEW_LOCAL.z]);
  const position=anchor.getWorldPosition(new THREE.Vector3());
  assert.deepEqual(position.toArray(),[-22.75,.595,-14]);assert.ok(position.x<-18.5);
  assert.ok(scenery.camp.children.some(child=>child.userData.importedLandmark));
  assert.ok(scenery.keep.children.some(child=>child.userData.importedLandmark));
  scenery.dispose();scenery.dispose();assert.deepEqual(await scenery.load(loader),{camp:false,keep:false});
});

test('unavailable landmark assets keep a visible fallback and the preview anchor',async()=>{
  const scenery=createLandmarkScenery(),anchor=scenery.previewAnchor;
  const loader={async loadAsync(){throw new Error('Unavailable mirror');}};
  assert.deepEqual(await scenery.load(loader),{camp:false,keep:false});
  for(const root of [scenery.camp,scenery.keep])assert.ok(root.children.some(child=>child.isGroup&&child.children.some(part=>part.isMesh)));
  assert.equal(anchor.parent,scenery.camp);scenery.dispose();
});

test('continuous relief has upward faces, deterministic layered slopes and no geometry inside the map',()=>{
  const a=createValleyRelief(),b=createValleyRelief(),positions=a.geometry.attributes.position,normals=a.geometry.attributes.normal;
  assert.deepEqual(Array.from(positions.array),Array.from(b.geometry.attributes.position.array));
  let high=0;
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    assert.ok(Number.isFinite(x+y+z));assert.ok(Math.abs(x)>=20.34||Math.abs(z)>=20.34);
    assert.ok(normals.getY(i)>0,'Terrain top faces point upward');if(y>2)high++;
  }
  assert.ok(high>100,'Broad surrounding slopes extend beyond the near tree line');
  for(const site of [...Object.values(LANDMARK_SITES),...LANDMARK_CLEARINGS])assert.ok(Math.abs(valleyGroundHeight(site.x,site.z)+.04)<1e-8);
  dispose(a);dispose(b);
});

test('dense scenery fills every outer shoulder while entrance and bridge corridors stay open',()=>{
  const valley=valleyEnvironment();
  assert.ok(valley.sceneryCounts.trees>600);assert.ok(valley.sceneryCounts.mountains>50);
  assert.ok(valley.sceneryCounts.rocks>100);assert.ok(valley.sceneryCounts.undergrowth>350);
  let staticBatches=0;valley.staticGroup.traverse(object=>{if(object.isMesh)staticBatches++;});
  assert.ok(staticBatches<=30,'Shared mountain and foliage materials bound the dense landscape draw calls');
  for(const bounds of valley.bounds){
    const crosses=(minX,maxX,minZ,maxZ)=>bounds.max[0]>minX&&bounds.min[0]<maxX&&bounds.max[2]>minZ&&bounds.min[2]<maxZ;
    // Check the physical approaches; distant mountain layers may sit beyond the settlements.
    if(crosses(-22,-18.5,-15,-13))assert.ok(bounds.max[1]<1,'The orc gate approach remains open');
    if(crosses(18.5,25.2,13,15))assert.ok(bounds.max[1]<1,'The bridge approach remains open');
  }
  dispose(valley.staticGroup);dispose(valley.water);dispose(valley.clouds);
});
