import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createRig} from '../game/render/optimized-motion-rig.js';

function fixture(memoizeCoordinates){
  const scene=new THREE.Group(),geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([1,2,3,2,4,5,1,2,3,2,4,5,3,1,4,1,2,3],3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,.2,.3,.4,.5,.8,.9],2));
  geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());mesh.name='Native tissue';scene.add(mesh);mesh.position.set(.1,.3,-.2);
  const rig=createRig(THREE,scene,{memoizeCoordinates}),field=rig.deformer('legs',[mesh.name]);return{rig,field,mesh};
}
test('coordinate-only approved fields reuse exact positions without joining UV seams or changing normals/bounds',()=>{
  const a=fixture(false),b=fixture(true);let callsA=0,callsB=0;
  try{for(const time of[0,.17,1.2]){
    const deform=(p,name)=>{assert.equal(name,'Native tissue');p.x+=Math.sin(p.y+time)*.3;p.z*=Math.cos(time);};
    a.field.apply((p,name)=>{callsA++;deform(p,name);});b.field.apply((p,name)=>{callsB++;deform(p,name);});
    for(const key of['position','normal','uv'])assert.deepEqual(b.mesh.geometry.attributes[key].array,a.mesh.geometry.attributes[key].array);
    assert.deepEqual(b.mesh.geometry.boundingBox,a.mesh.geometry.boundingBox);assert.deepEqual(b.mesh.geometry.boundingSphere,a.mesh.geometry.boundingSphere);
  }assert.equal(callsA,18);assert.equal(callsB,9);a.field.reset();b.field.reset();assert.deepEqual(b.mesh.geometry.attributes.position.array,a.mesh.geometry.attributes.position.array);
  }finally{a.rig.dispose();b.rig.dispose();}
});
test('index-dependent fields retain per-vertex evaluation even when coordinate sharing is enabled',()=>{
  const a=fixture(false),b=fixture(true);let calls=0;
  try{a.field.apply((p,name,index)=>{p.y+=index;});b.field.apply((p,name,index)=>{calls++;p.y+=index;});assert.equal(calls,6);assert.deepEqual(b.mesh.geometry.attributes.position.array,a.mesh.geometry.attributes.position.array);}
  finally{a.rig.dispose();b.rig.dispose();}
});
