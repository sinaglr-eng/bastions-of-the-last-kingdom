import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {LANDMARK_SITES,LANDMARK_CLEARINGS,WARCAMP_PREVIEW_LOCAL,createLandmarkScenery} from '../game/render/scenery-landmarks.js';
import {createValleyRelief,valleyGroundHeight,townRiverDistance,valleyRiverDistance} from '../game/render/valley-relief.js';
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
    assert.ok(triangles>40000&&triangles<(name==='keep'?110000:150000),name+' complete settlement within its current bounded geometry budget');
    assert.ok(meshes<=(name==='keep'?41:36),name+' material batches bound draw calls for the whole settlement');
    scene.position.set(site.x,site.y,site.z);
    const bounds=new THREE.Box3().setFromObject(scene,true);
    const point=new THREE.Vector3();scene.updateMatrixWorld(true);
    scene.traverse(object=>{if(!object.isMesh)return;const positions=object.geometry.attributes.position;for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld);assert.ok(Math.abs(point.x)>=18.5||Math.abs(point.z)>=18.5,name+' geometry clears every playable tile');}});
    assert.ok(bounds.max.y>3.5);
    if(name==='keep'){
      assert.ok(bounds.max.y>18,'The alpine palace has a tall spired silhouette');assert.ok(bounds.max.x-bounds.min.x>40,'The complete town fills the eastern shoulder');
      assert.ok(bounds.min.x>24,'The southern frontier wall stops on the dry eastern river bank');
      for(const building of roleNodes(scene,'townBuilding'))assert.ok(building.userData.worldMinX>27,'Town houses remain beyond the main river eastern bank');
    }else{assert.ok(bounds.max.x-bounds.min.x>30,'The inhabited military camp extends into the clan territory');assert.ok(bounds.max.y>8,'Caves and the elevated camp create a second inhabited level');}
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
    if(crosses(18.5,29.2,13,15))assert.ok(bounds.max[1]<1,'The extended bridge approach remains open');
  }
  dispose(valley.staticGroup);dispose(valley.water);dispose(valley.clouds);
});

function roleNodes(scene,role){const nodes=[];scene.traverse(object=>{if(object.userData.sceneryRole===role)nodes.push(object);});return nodes;}
function pointsNear(scene,position,radius){
  let count=0;const point=new THREE.Vector3();scene.updateMatrixWorld(true);
  scene.traverse(object=>{
    if(!object.isMesh)return;const vertices=object.geometry.attributes.position;
    for(let i=0;i<vertices.count;i++){
      point.fromBufferAttribute(vertices,i).applyMatrix4(object.matrixWorld);
      if(Math.abs(point.x-position.x)<radius&&Math.abs(point.z-position.z)<radius&&point.y>=position.y-.1&&point.y<position.y+2.5)count++;
    }
  });return count;
}

test('the royal town has real residents, enclosed sheep and cattle, farms and a working canal waterwheel',async()=>{
  const scenery=createLandmarkScenery();
  const loader={async loadAsync(url){return loadModel(Object.values(LANDMARK_SITES).find(site=>url.includes(site.file)).file);}};
  await scenery.load(loader);scenery.group.updateMatrixWorld(true);
  const city=scenery.keep;
  for(const [role,min]of [['townBuilding',20],['resident',24],['farmPlot',5],['street',6],['watermill',1],['quarry',1],['canalBridge',3]])assert.ok(roleNodes(city,role).length>=min,role);
  const pens=roleNodes(city,'animalPen');assert.equal(pens.length,2);
  for(const [role,count]of [['sheep',9],['cow',6]]){
    const animals=roleNodes(city,role);assert.equal(animals.length,count);
    for(const animal of animals){
      const p=animal.getWorldPosition(new THREE.Vector3());
      assert.ok(pens.some(pen=>{const c=pen.getWorldPosition(new THREE.Vector3());return Math.abs(p.x-c.x)<pen.userData.width/2&&Math.abs(p.z-c.z)<pen.userData.depth/2;}),'Every '+role+' is inside a fenced pasture');
    }
    assert.ok(pointsNear(city,animals[0].getWorldPosition(new THREE.Vector3()),.85)>60,role+' includes visible body geometry');
  }
  assert.ok(pointsNear(city,roleNodes(city,'resident')[0].getWorldPosition(new THREE.Vector3()),.31)>60,'Residents have visible heads, bodies and limbs');
  const wheel=city.getObjectByName('MillWaterwheel');assert.ok(wheel&&wheel.children.some(child=>child.isMesh));
  const p=wheel.getWorldPosition(new THREE.Vector3());assert.ok(townRiverDistance(p.x,p.z)<.05,'The rotating paddles sit in the mill stream');
  const initial=wheel.rotation.x;scenery.update(.016,2);assert.notEqual(wheel.rotation.x,initial);
  assert.ok(pointsNear(city,p,1.15)>200,'The wheel is real geometric rims, spokes and paddles');
  assert.ok(valleyRiverDistance(LANDMARK_SITES.keep.x,LANDMARK_SITES.keep.z)>10,'The palace center is safely on the dry eastern shoulder');
  scenery.dispose();
});

test('orc territory includes contained wolves, guarded caves and a raised troll and ogre settlement',async()=>{
  const {scene}=await loadModel(LANDMARK_SITES.camp.file);scene.position.set(-25,0,-14);scene.updateMatrixWorld(true);
  const wolves=roleNodes(scene,'wolf'),pens=[...roleNodes(scene,'wolfPen'),...roleNodes(scene,'wolfCage')];
  assert.equal(wolves.length,11);assert.equal(pens.length,4);
  for(const wolf of wolves){
    const p=wolf.getWorldPosition(new THREE.Vector3());
    assert.ok(pens.some(pen=>{const c=pen.getWorldPosition(new THREE.Vector3());return Math.abs(p.x-c.x)<pen.userData.width/2&&Math.abs(p.z-c.z)<pen.userData.depth/2;}),'Every wolf is in a pen or holding cage');
  }
  assert.ok(pointsNear(scene,wolves[0].getWorldPosition(new THREE.Vector3()),.9)>80,'Wolves have real body geometry');
  assert.equal(roleNodes(scene,'cave').length,1);assert.equal(roleNodes(scene,'caveGuard').length,2);
  for(const role of ['troll','ogre']){
    const residents=roleNodes(scene,role);assert.equal(residents.length,role==='troll'?4:2);
    for(const resident of residents)assert.ok(resident.getWorldPosition(new THREE.Vector3()).y>=4,'Mountain residents stand on the elevated rock ledge');
    assert.ok(pointsNear(scene,residents[0].getWorldPosition(new THREE.Vector3()),.7)>80,role+' has real body geometry');
  }
  assert.ok(roleNodes(scene,'tent').length>=14);assert.ok(roleNodes(scene,'seatedOrc').length>=12);
  assert.ok(roleNodes(scene,'mountainCamp').length===1);dispose(scene);
});
