import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {cutaway,finishMeadowTerrain,valleyOutline} from '../game/render/meadow-terrain.js';
import {campWoodcutting,reservedClearing} from '../game/render/meadow-logging.js';

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

test('trampling repaints on a new route and spray has a static reduced-motion pose',t=>{
  const paths=[];
  function canvas(){
    let path=[];
    const context={
      fillRect(){},drawImage(){},closePath(){},fill(){},save(){},restore(){},clip(){},beginPath(){path=[];},
      moveTo(x,y){path.push([x,y]);},lineTo(x,y){path.push([x,y]);},
      stroke(){if(this.lineCap==='round')paths.push(path.slice());}
    };
    return {getContext:()=>context};
  }
  const previous=globalThis.document;
  globalThis.document={createElement:canvas};
  t.after(()=>{if(previous)globalThis.document=previous;else delete globalThis.document;});
  const model=new THREE.Group(),floor=new THREE.Group();
  const ground=surface([[-42,0,-28],[-42,0,28],[42,0,28],[42,0,-28]]).mesh;
  ground.material=new THREE.MeshStandardMaterial();ground.material.name='Meadow turf';
  floor.userData.name='Meadow, banks and river';floor.add(ground);model.add(floor);
  const cascade=new THREE.Group();cascade.name='Waterfall.002';model.add(cascade);
  const terrain=finishMeadowTerrain(model,{size:37});
  const route=[{x:0,z:4},{x:2,z:4},{x:2,z:7}];
  terrain.paintRoute(route);const first=paths.at(-1),version=ground.material.map.version;
  terrain.paintRoute(route.map(p=>({...p})));
  assert.equal(ground.material.map.version,version);
  terrain.paintRoute([{x:0,z:4},{x:0,z:7},{x:2,z:7}]);
  assert.notDeepEqual(paths.at(-1),first);
  assert.equal(ground.material.map.version,version+1);
  const {instanceMatrix}=cascade.getObjectByName('Whitewater / impact plumes');
  const still=instanceMatrix.array.slice();
  terrain.animateSpray(0);
  assert.deepEqual(still,instanceMatrix.array);
  terrain.animateSpray(.2);
  assert.notDeepEqual(still,instanceMatrix.array);
});

test('the shipped ramp meets the bank and timber deck, and ground plants have cell footprints',()=>{
  const bytes=readFileSync(new URL('../public/assets/scenery/borderland-meadow.glb',import.meta.url));
  const doc=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  const ramp=doc.nodes.find(n=>n.name==='Timber bridge approach');
  const primitive=doc.meshes[ramp.mesh].primitives[0];
  const {min,max}=doc.accessors[primitive.attributes.POSITION];
  assert.equal(min[0],18.5);
  assert.ok(min[1]<-1.08&&max[1]>.52&&max[1]<.55);
  assert.ok(max[0]>22.13&&max[2]-min[2]>1.7);
  for(const species of ['Meadow wildflowers','Grass Tufts','Low Fern']){
    const drifts=doc.nodes.filter(n=>n.name.startsWith(species+' drift'));
    assert.ok(drifts.length>8,species);
    assert.ok(drifts.every(n=>n.extras.meadowCells.length>=1&&n.extras.meadowCell.length===2));
  }
});

test('the logging yard faces the sawyers and the standalone boulder stays outside the playable grid and gate',()=>{
  const [yard,rock]=campWoodcutting();
  const y=new THREE.Box3().setFromObject(yard),b=new THREE.Box3().setFromObject(rock);
  assert.ok(y.min.z>=5&&y.max.z<16&&y.max.x< -18.5);
  assert.ok(b.min.y<-.03&&b.max.y>1&&b.max.x< -18.5&&Math.abs(b.getCenter(new THREE.Vector3()).z)<1);
  assert.ok(b.min.z> -12); // Spawn is at z=-14.
  assert.ok(reservedClearing(-20.27,-.22)&&reservedClearing(-21.21,10.5));
  assert.equal(reservedClearing(-14,0),false); // The first checkpoint.
});
