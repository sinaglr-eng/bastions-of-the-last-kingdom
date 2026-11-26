import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {cutaway,valleyOutline} from '../game/render/meadow-terrain.js';

function surface(positions,water=false){
  const vertices=positions.map(p=>new THREE.Vector3(...p)),geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions.flat(),3));
  geometry.setIndex([0,1,2,2,3,0]);
  return {vertices,mesh:new THREE.Mesh(geometry),water};
}

test('the terrain cut follows both shores, two wet outlets and the western forest extension and closes underneath',()=>{
  const strip=(left,leftY,right,rightY,water)=>surface([[left,leftY,-3],[right,rightY,-3],[right,rightY,3],[left,leftY,3]],water);
  const sections=[strip(-4,0,1,0),strip(1,0,1.7,-1),strip(1.7,-1,2.3,-1,true),strip(2.3,-1,3.2,0),strip(3.2,0,4,0)];
  const forest=surface([[-4.3,0,-1],[-3.6,0,-1],[-3.6,0,2],[-5.2,.03,1]]);
  const outline=valleyOutline(sections,forest.mesh);
  assert.ok(outline.some(p=>p.x< -5&&p.z===1));
  for(const z of [-3,3]){
    assert.ok(outline.some(p=>p.z===z&&p.wet&&p.y===-1));
    assert.ok(outline.some(p=>p.z===z&&p.x===-4&&p.y===0));
  }
  const shell=cutaway(outline),verts=shell.geometry.getAttribute('position');
  const bottom=new Map();
  for(let i=0;i<verts.count;i+=3){
    const keys=[0,1,2].map(j=>[verts.getX(i+j),verts.getY(i+j),verts.getZ(i+j)]);
    for(let j=0;j<3;j++){
      const a=keys[j],b=keys[(j+1)%3];
      if(a[1]>-3.79||b[1]>-3.79)continue;
      const key=[a.join(','),b.join(',')].sort().join('|');bottom.set(key,(bottom.get(key)||0)+1);
    }
  }
  assert.ok(bottom.size>=outline.length);
  assert.ok([...bottom.values()].every(n=>n===2),'the underside shares its entire perimeter with the cut faces');
});
