import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCheckpointGround,createCheckpointGroundGeometry,createCheckpointGroundTextures} from '../game/render/checkpoint-ground.js';
import {createCheckpointMarker,takeCheckpointEffects,disposeCheckpointEffects} from '../game/render/checkpoint-marker.js';
import {CHECKPOINT_MARKER_SCALE} from '../game/render/route-overlay.js';
import {optimize} from '../game/render/models.js';

function opaqueEarth(material){
  const map=material.map;
  return material.transparent===false&&material.opacity===1&&material.depthWrite===true&&map?.isDataTexture&&map.image.data.every((value,index)=>index%4!==3||value===255);
}
function textureMeasures(texture){
  const {data,width,height}=texture.image,values=[],blocks=[];let differences=0,samples=0;
  for(let row=40;row<height-40;row++)for(let column=40;column<width-40;column++){
    const i=(row*width+column)*4;values.push(data[i]);differences+=Math.abs(data[i]-data[i+4]);samples++;
  }
  for(let row=60;row<height-60;row+=16)for(let column=60;column<width-60;column+=16){
    let sum=0;for(let dy=0;dy<16;dy++)for(let dx=0;dx<16;dx++)sum+=data[((row+dy)*width+column+dx)*4];blocks.push(sum/256);
  }
  return {range:Math.max(...values)-Math.min(...values),levels:new Set(values).size,grain:differences/samples,coarse:Math.max(...blocks)-Math.min(...blocks)};
}
function rawGroundHits(mesh,x,z){
  mesh.updateMatrixWorld(true);const hits=[];
  THREE.Mesh.prototype.raycast.call(mesh,new THREE.Raycaster(new THREE.Vector3(x,1,z),new THREE.Vector3(0,-1,0)),hits);
  return hits;
}

test('earth texture is fully opaque, repeatable, DOM-free and has real coarse soil, fine grain and relief',()=>{
  assert.equal(typeof document,'undefined');
  const first=createCheckpointGroundTextures(),second=createCheckpointGroundTextures();
  for(const key of ['map','bumpMap']){
    assert.ok(first[key].isDataTexture);assert.deepEqual(first[key].image.data,second[key].image.data,'Independent construction preserves exact pixels without game RNG');
    const {data,width,height}=first[key].image;assert.ok(width>=128&&width<=256&&height===width);assert.equal(data.length,width*height*4);
    for(let i=3;i<data.length;i+=4)assert.equal(data[i],255,'Neither the interior nor rim reveals grass through transparency');
  }
  assert.equal(first.map.colorSpace,THREE.SRGBColorSpace);assert.equal(first.bumpMap.colorSpace,THREE.NoColorSpace);
  const color=textureMeasures(first.map),relief=textureMeasures(first.bumpMap);
  assert.ok(color.range>70&&color.levels>70&&color.grain>4&&color.coarse>12,'Actual pixels contain stones, grain and large soil variations');
  assert.ok(relief.range>80&&relief.levels>80&&relief.grain>4&&relief.coarse>12,'A real independent relief map supplies scuffs and small stones');
  assert.notDeepEqual(first.map.image.data,first.bumpMap.image.data,'Color bytes are not reused as a fake bump map');
  const flat=first.map.clone();flat.image={...first.map.image,data:new Uint8Array(first.map.image.data.length).fill(128)};
  assert.equal(textureMeasures(flat).grain,0,'Flattening actual texture pixels removes the measured grain');
  for(const pair of [first,second])for(const texture of Object.values(pair))texture.dispose();flat.dispose();
});

test('the real irregular earth surface is flush, has valid UVs and leaves the central walking area flat and unpickable',()=>{
  const mesh=createCheckpointGround();mesh.scale.setScalar(CHECKPOINT_MARKER_SCALE);mesh.updateMatrixWorld(true);
  assert.ok(opaqueEarth(mesh.material));assert.ok(mesh.material.bumpMap?.isDataTexture&&mesh.material.bumpScale>0&&mesh.material.bumpScale<=.01);
  assert.ok(mesh.material.polygonOffset&&mesh.material.polygonOffsetFactor<0,'Coplanar meadow is hidden without raising the soil');
  const positions=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv,normals=mesh.geometry.attributes.normal,radii=[];
  assert.ok(positions.array.every(Number.isFinite)&&uv.array.every(Number.isFinite));
  assert.ok(uv.array.every(value=>value>=0&&value<=1));
  for(let i=0;i<positions.count;i++){
    assert.ok(Math.abs(positions.getY(i)*CHECKPOINT_MARKER_SCALE-.031)<1e-8,'Every physical soil vertex is actual meadow height');
    assert.ok(normals.getY(i)>.9999);const r=Math.hypot(positions.getX(i),positions.getZ(i));if(r>.1)radii.push(r);
  }
  assert.ok(Math.max(...radii)/Math.min(...radii)>1.20,'The actual boundary is eroded and asymmetric, rather than a circle');
  assert.ok(Math.max(...radii)<.55,'Soil stays within the existing marker footprint');
  for(let i=0;i<positions.count;i+=3){
    const a=new THREE.Vector3().fromBufferAttribute(positions,i),b=new THREE.Vector3().fromBufferAttribute(positions,i+1),c=new THREE.Vector3().fromBufferAttribute(positions,i+2);
    assert.ok(b.sub(a).cross(c.sub(a)).length()>1e-7);
  }
  for(const x of [-.15,0,.15])for(const z of [-.15,0,.15]){
    const hits=rawGroundHits(mesh,x,z);assert.ok(hits.length);assert.ok(hits.every(hit=>Math.abs(hit.point.y-.031)<1e-8));
    assert.deepEqual(new THREE.Raycaster(new THREE.Vector3(x,1,z),new THREE.Vector3(0,-1,0)).intersectObject(mesh),[],'Soil cannot steal terrain or defender selection');
  }
  const corruptMaterial=mesh.material.clone();corruptMaterial.transparent=true;corruptMaterial.opacity=.42;
  assert.equal(opaqueEarth(corruptMaterial),false,'The original transparent-core regression fails on actual material state');
  corruptMaterial.dispose();mesh.geometry.dispose();
});

test('production scenery merge retains UVs and both shared soil maps in a single opaque material batch',()=>{
  const group=new THREE.Group(),effects=[];let shared,sourceSoilVertices=0;
  for(const [i,label] of ['', 'I','II','III','IV','V'].entries()){
    const marker=createCheckpointMarker({kind:label?'checkpoint':'spawn',label}),soil=marker.getObjectByName('Flush trampled ground');
    marker.scale.setScalar(CHECKPOINT_MARKER_SCALE);marker.position.x=i*2;group.add(marker);
    if(shared)assert.equal(soil.material,shared);shared=soil.material;sourceSoilVertices+=soil.geometry.attributes.position.count;
    const effect=takeCheckpointEffects(marker);if(effect)effects.push(effect);
  }
  group.add(createCheckpointMarker({kind:'keep'}));
  const map=shared.map,bumpMap=shared.bumpMap,merged=optimize(group),soilBatches=merged.children.filter(mesh=>mesh.material===shared);
  assert.equal(soilBatches.length,1,'All six dirt patches share one production draw batch');
  assert.equal(soilBatches[0].material.map,map);assert.equal(soilBatches[0].material.bumpMap,bumpMap);assert.ok(opaqueEarth(soilBatches[0].material));
  assert.equal(soilBatches[0].geometry.attributes.uv.count,sourceSoilVertices);assert.ok(soilBatches[0].geometry.attributes.uv.array.every(Number.isFinite));
  assert.ok(merged.children.length<=12,'Textured dirt does not introduce per-marker materials or draw calls');
  for(let i=0;i<6;i++){
    const hits=rawGroundHits(soilBatches[0],i*2,0);assert.ok(hits.length&&Math.abs(hits[0].point.y-.031)<1e-8,'The final batch still has a flush physical centre for every marker');
  }
  merged.traverse(node=>node.geometry?.dispose());effects.forEach(disposeCheckpointEffects);
});

test('world material disposal releases its shared color and bump textures once and a new world gets fresh usable resources',()=>{
  const first=createCheckpointGround(),second=createCheckpointGround();assert.equal(first.material,second.material);
  let colors=0,bumps=0;first.material.map.addEventListener('dispose',()=>colors++);first.material.bumpMap.addEventListener('dispose',()=>bumps++);
  first.geometry.dispose();assert.equal(colors,0);assert.equal(bumps,0,'Source geometry disposal during optimize never releases transferred maps');
  first.material.dispose();first.material.dispose();assert.equal(colors,1);assert.equal(bumps,1);
  const next=createCheckpointGround();assert.notEqual(next.material,first.material);assert.notEqual(next.material.map,first.material.map);
  assert.ok(opaqueEarth(next.material));assert.deepEqual(next.material.map.image.data,first.material.map.image.data);
  second.geometry.dispose();next.geometry.dispose();next.material.dispose();
  const geometry=createCheckpointGroundGeometry();geometry.dispose();
});
