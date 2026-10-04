import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCheckpointMarker,CHECKPOINT_ROMAN_LABELS,takeCheckpointEffects,disposeCheckpointEffects} from '../game/render/checkpoint-marker.js';
import {checkpointVignetteGeometries,CHECKPOINT_GROUND_Y} from '../game/render/checkpoint-vignettes.js';
import {CHECKPOINT_MARKER_SCALE} from '../game/render/route-overlay.js';
import {optimize} from '../game/render/models.js';
import {meadowTerrain} from '../game/render/terrain.js';

const dispose=root=>{disposeCheckpointEffects(root);root.traverse(node=>node.geometry?.dispose());};
function glyphMask(mesh,side){
  // A camera behind the flag reverses world X. Ray samples compare actual ink
  // from both viewpoints, including IV, whose character order is asymmetric.
  mesh.updateMatrixWorld(true);const values=[];
  for(let row=0;row<31;row++)for(let column=0;column<39;column++){
    const u=-.155+column*.31/38,y=1.025+row*.29/30;
    const ray=new THREE.Raycaster(new THREE.Vector3(.39+side*u,y,side===1?1:-1),new THREE.Vector3(0,0,-side)),hits=[];
    THREE.Mesh.prototype.raycast.call(mesh,ray,hits);values.push(hits.length>0?1:0);
  }
  return values;
}
test('all five Roman numerals are physical readable embroidery on both actual cloth faces',()=>{
  const distinct=new Set();
  for(const label of CHECKPOINT_ROMAN_LABELS){
    const marker=createCheckpointMarker({label}),cloth=marker.getObjectByName('Faceted checkpoint cloth'),front=marker.getObjectByName(`Checkpoint ${label} front embroidery`),back=marker.getObjectByName(`Checkpoint ${label} back embroidery`);
    assert.ok(front?.isMesh&&back?.isMesh&&cloth?.isMesh);
    assert.equal(front.material.transparent,false);assert.equal(back.material.side,THREE.FrontSide);
    const visible=glyphMask(front,1),reverse=glyphMask(back,-1);assert.ok(visible.reduce((sum,n)=>sum+n,0)>35,'The numeral occupies a legible physical area');assert.deepEqual(reverse,visible,`${label} reads in the same order from behind`);distinct.add(visible.join(''));
    for(const [mesh,side] of [[front,1],[back,-1]]){
      const positions=mesh.geometry.attributes.position,normal=mesh.geometry.attributes.normal;assert.ok(positions.array.every(Number.isFinite));
      for(let offset=0;offset<positions.count;offset+=3){
        const centre=new THREE.Vector3();for(let i=0;i<3;i++)centre.add(new THREE.Vector3().fromBufferAttribute(positions,offset+i));centre.multiplyScalar(1/3);
        assert.ok(normal.getZ(offset)*side>0,'Each face is oriented toward its own viewer');
        const ray=new THREE.Raycaster(centre.clone().add(new THREE.Vector3(0,0,side*.05)),new THREE.Vector3(0,0,-side)),hits=[];
        THREE.Mesh.prototype.raycast.call(mesh,ray,hits);assert.ok(hits.length,'The actual stitched surface faces the camera');
        const clothHits=[];cloth.updateMatrixWorld(true);THREE.Mesh.prototype.raycast.call(cloth,ray,clothHits);assert.ok(clothHits.length&&hits[0].distance<clothHits[0].distance,'Ink remains outside its own cloth face');
        assert.ok(Math.abs(hits[0].distance-clothHits[0].distance)<.002,'Embroidery follows the real folded cloth, without floating away');
      }
    }
    dispose(marker);
  }
  assert.equal(distinct.size,5,'Actual triangle silhouettes distinguish I through V');
});
test('grounded decorations retain safe footprints and cannot intercept terrain or defender selection',()=>{
  for(const options of [{kind:'spawn'},...CHECKPOINT_ROMAN_LABELS.map(label=>({kind:'checkpoint',label})),{kind:'keep'}]){
    const marker=createCheckpointMarker(options);marker.scale.setScalar(CHECKPOINT_MARKER_SCALE);marker.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(marker,true);assert.ok(bounds.min.x>=-.55*CHECKPOINT_MARKER_SCALE&&bounds.max.x<=.60*CHECKPOINT_MARKER_SCALE);const depth=options.kind==='keep'?1.01:.55;assert.ok(bounds.min.z>=-depth*CHECKPOINT_MARKER_SCALE&&bounds.max.z<=depth*CHECKPOINT_MARKER_SCALE);assert.ok(bounds.max.y<(options.label==='V'?1.90:1.70)*CHECKPOINT_MARKER_SCALE);
    marker.traverse(node=>{if(node.isMesh){
      const position=node.geometry.attributes.position,index=node.geometry.index;assert.ok(position.array.every(Number.isFinite));assert.equal(node.raycast(),undefined);if(!node.material.transparent)assert.ok(node.material.depthWrite);
      for(let offset=0;offset<(index?.count??position.count);offset+=3){const vertices=[0,1,2].map(i=>new THREE.Vector3().fromBufferAttribute(position,index?index.getX(offset+i):offset+i));assert.ok(vertices[1].sub(vertices[0]).cross(vertices[2].sub(vertices[0])).length()>2e-11,'Merged fittings and embroidery contain real nondegenerate triangles');}
    }});
    const ray=new THREE.Raycaster(new THREE.Vector3(.39*CHECKPOINT_MARKER_SCALE,1.17*CHECKPOINT_MARKER_SCALE,2),new THREE.Vector3(0,0,-1));assert.deepEqual(ray.intersectObject(marker,true),[],'Flags cannot intercept defender or terrain selection');
    const hits=rawHits(marker,new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0));assert.ok(!hits.length||Math.abs(hits[0].point.y-.031)<1e-5,'The centre is actual terrain, with no raised stone plate');
    assert.ok(marker.children.length<=11,'Scenery, stone, poles and trims share material batches');dispose(marker);
  }
  assert.throws(()=>createCheckpointMarker({label:'VI'}),RangeError);assert.throws(()=>createCheckpointMarker({kind:'enemy'}),RangeError);
});
test('Roman embroidery and textured earth survive the production scenery merge within bounded batches',()=>{
  const group=new THREE.Group(),effects=[];for(const [i,label] of CHECKPOINT_ROMAN_LABELS.entries()){const marker=createCheckpointMarker({label});marker.position.x=i*2;group.add(marker);const effect=takeCheckpointEffects(marker);if(effect)effects.push(effect);}
  group.add(createCheckpointMarker({kind:'spawn'}),createCheckpointMarker({kind:'keep'}));
  const merged=optimize(group);assert.ok(merged.children.length<=12,'Five scenes and both endpoints share a bounded scenery palette');let triangles=0,texturedBatches=0;merged.traverse(node=>{if(node.isMesh){node.raycast=()=>{};if(node.material.map){texturedBatches++;assert.ok(node.material.map.isDataTexture&&node.material.bumpMap?.isDataTexture,'Only shared soil uses actual color and grain maps');assert.ok(node.geometry.attributes.uv);assert.equal(node.material.transparent,false);}else assert.equal(node.material.bumpMap,null);assert.ok(node.geometry.attributes.position.array.every(Number.isFinite));triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;}});assert.equal(texturedBatches,1,'Every soil patch shares one textured scenery batch');assert.ok(triangles<9500,'The complete seven-marker decoration remains a small static scenery batch');
  const ink=merged.children.find(node=>node.material.color.getHexString()==='f1e6c7');assert.ok(ink);assert.ok(new THREE.Box3().setFromObject(ink,true).getSize(new THREE.Vector3()).x>8,'The final material batch retains every physical label');dispose(merged);effects.forEach(disposeCheckpointEffects);
});

function rawHits(root,origin,direction){
  root.updateMatrixWorld(true);const ray=new THREE.Raycaster(origin,direction),hits=[];
  root.traverse(node=>{if(node.isMesh)THREE.Mesh.prototype.raycast.call(node,ray,hits);});return hits.sort((a,b)=>a.distance-b.distance);
}
function passageClear(root){
  for(const x of [-.075,0,.075])for(const z of [-.075,0,.075]){
    const hits=rawHits(root,new THREE.Vector3(x,1,z),new THREE.Vector3(0,-1,0));
    if(hits.length&&hits[0].point.y>CHECKPOINT_GROUND_Y+1e-5)return false;
  }
  return true;
}
test('all five merged scenes leave a real central walking patch open, and displaced scenery is detected',()=>{
  const profiles=new Set();
  for(const label of CHECKPOINT_ROMAN_LABELS){
    const marker=createCheckpointMarker({label}),effect=takeCheckpointEffects(marker),merged=optimize(marker);assert.ok(passageClear(merged),label+' has no raised prop in the centre');
    // Actual off-centre surface heights distinguish the five scenes; labels or
    // part names alone do not make a checkpoint visually distinct.
    const heights=[];for(const x of [-.34,-.24,-.14,.04])for(const z of [-.24,-.12,.04,.20])heights.push(rawHits(merged,new THREE.Vector3(x,.85,z),new THREE.Vector3(0,-1,0))[0]?.point.y.toFixed(3)||'empty');
    profiles.add(heights.join(','));dispose(merged);disposeCheckpointEffects(effect);
  }
  assert.equal(profiles.size,5);
  const marker=createCheckpointMarker({label:'II'}),obstructionMaterial=new THREE.MeshStandardMaterial();
  for(const part of checkpointVignetteGeometries('II')){
    if(part.name.startsWith('Left powder barrel')){part.geometry.translate(.30,0,.19);const obstruction=new THREE.Mesh(part.geometry,obstructionMaterial);obstruction.raycast=()=>{};marker.add(obstruction);}else part.geometry.dispose();
  }
  assert.equal(passageClear(marker),false,'A physically misplaced barrel fails even with picking still disabled');dispose(marker);obstructionMaterial.dispose();
});

function floorSupported(part,floor){
  part.geometry.computeBoundingBox();const bottom=part.geometry.boundingBox.min.y,positions=part.geometry.attributes.position;
  for(let i=0;i<positions.count;i++)if(Math.abs(positions.getY(i)-bottom)<1e-5){
    const hits=rawHits(floor,new THREE.Vector3(positions.getX(i)*CHECKPOINT_MARKER_SCALE,.30,positions.getZ(i)*CHECKPOINT_MARKER_SCALE),new THREE.Vector3(0,-1,0));
    if(hits.length&&Math.abs(bottom*CHECKPOINT_MARKER_SCALE-hits[0].point.y)<.004)return true;
  }
  return false;
}
test('load-bearing vignette props meet the actual meadow instead of floating',()=>{
  const floor=meadowTerrain(),names={I:['Soldier supporting rock','Grounded boot -1','Grounded boot 1'],II:['Left powder barrel end -1','Right powder barrel end -1'],III:[0,1,2,3,4].map(i=>'Crate '+i+' dark core'),IV:['Firepit stone 0','Firepit stone 3','Rolled campsite blanket'],V:['Tower rear course 0 stone 0','Tower left course 0 stone 0','Tower return course 0 stone 0','Scattered rubble left','Scattered rubble rear']};
  for(const [label,required] of Object.entries(names)){
    const parts=checkpointVignetteGeometries(label);for(const name of required){const part=parts.find(candidate=>candidate.name===name);assert.ok(part&&floorSupported(part,floor),name+' has physical floor support');}
    if(label==='III'){
      const crate=parts.find(part=>part.name==='Crate 2 dark core');crate.geometry.translate(0,.04,0);assert.equal(floorSupported(crate,floor),false,'A raised actual crate is rejected without changing its identity');
    }
    for(const part of parts)part.geometry.dispose();
  }
  dispose(floor);floor.material.dispose();
});

test('crates stack in several supported tiers and the ruined wall is at least as tall as its real flag',()=>{
  const parts=checkpointVignetteGeometries('III'),cores=parts.filter(part=>part.name.endsWith('dark core'));
  for(const i of [1,2,3]){
    const upper=cores.find(part=>part.name===`Crate ${i} tier 1 dark core`),lid=parts.find(part=>part.name===`Crate ${i} plank lid`);assert.ok(upper&&lid);upper.geometry.computeBoundingBox();lid.geometry.computeBoundingBox();assert.ok(Math.abs(upper.geometry.boundingBox.min.y-lid.geometry.boundingBox.max.y)<1e-5,'The upper box rests on the actual lower lid');
  }
  const highest=cores.map(part=>{part.geometry.computeBoundingBox();return part.geometry.boundingBox.max.y;});assert.ok(Math.max(...highest)-CHECKPOINT_GROUND_Y>.49,'The semicircle has a visibly three-tier pile');
  const marker=createCheckpointMarker({label:'V'}),cloth=marker.getObjectByName('Faceted checkpoint cloth');marker.updateMatrixWorld(true);const clothTop=new THREE.Box3().setFromObject(cloth,true).max.y;
  const masonry=checkpointVignetteGeometries('V');const top=Math.max(...masonry.map(part=>{part.geometry.computeBoundingBox();return part.geometry.boundingBox.max.y;}));assert.ok(top>=1.675&&top>clothTop,'Actual stone geometry exceeds the flag finial, rather than just a metadata height');assert.ok(passageClear(marker));
  for(const part of [...parts,...masonry])part.geometry.dispose();dispose(marker);
});

function distanceToStone(geometry,point){
  const positions=geometry.attributes.position,index=geometry.index,triangle=new THREE.Triangle(),closest=new THREE.Vector3();let distance=Infinity;
  for(let offset=0;offset<(index?.count??positions.count);offset+=3){
    [triangle.a,triangle.b,triangle.c].forEach((vertex,i)=>vertex.fromBufferAttribute(positions,index?index.getX(offset+i):offset+i));triangle.closestPointToPoint(point,closest);distance=Math.min(distance,point.distanceTo(closest));
  }
  return distance;
}
function chamberHasThreeFaces(root){
  // Probe the actual open chamber, rather than accepting three labelled parts.
  const origin=new THREE.Vector3(-.265,.49,-.20),probes=[
    {direction:[0,0,-1],normal:[0,0,1]},
    {direction:[-1,0,0],normal:[1,0,0]},
    {direction:[1,0,0],normal:[-1,0,0]},
  ];
  return probes.every(({direction,normal})=>{
    const hit=rawHits(root,origin,new THREE.Vector3(...direction))[0];return hit&&hit.distance<.115&&hit.face.normal.dot(new THREE.Vector3(...normal))>.99;
  })&&!rawHits(root,origin,new THREE.Vector3(0,0,1)).length;
}
test('the tower ruin has three real joined faces, staggered joints, a broken skyline and an open chamber',()=>{
  const parts=checkpointVignetteGeometries('V'),group=new THREE.Group(),material=new THREE.MeshStandardMaterial();
  for(const part of parts)group.add(new THREE.Mesh(part.geometry,material));
  assert.ok(chamberHasThreeFaces(group),'Two opposing stone faces and a rear face enclose the open tower chamber');
  const at=name=>parts.find(part=>part.name===name).geometry;
  const rear=at('Tower rear course 3 stone 0'),rearCourse=parts.filter(part=>part.name.startsWith('Tower rear course 3 stone ')),left=at('Tower left course 3 stone 0'),right=at('Tower return course 3 stone 0');
  for(const geometry of [rear,left,right])geometry.computeBoundingBox();
  for(const [side,x] of [[left,left.boundingBox.max.x],[right,right.boundingBox.min.x]]){
    const joint=new THREE.Vector3(x,rear.boundingBox.getCenter(new THREE.Vector3()).y,rear.boundingBox.max.z);
    assert.ok(Math.min(...rearCourse.map(part=>distanceToStone(part.geometry,joint)))<.004&&distanceToStone(side,joint)<.004,'Actual masonry surfaces meet at both tower corners');
  }
  const base=at('Tower rear course 0 stone 0'),next=at('Tower rear course 1 stone 0');base.computeBoundingBox();next.computeBoundingBox();
  assert.ok(Math.abs(base.boundingBox.max.x-next.boundingBox.max.x)>.045,'Neighbouring courses visibly offset their vertical mortar joints');
  const heights=[-.36,-.25,-.17].map(x=>rawHits(group,new THREE.Vector3(x,2,-.31),new THREE.Vector3(0,-1,0))[0]?.point.y);
  assert.ok(heights.every(Number.isFinite)&&heights[0]-heights[2]>.40,'The actual rear skyline breaks down toward the collapsed side');
  const crown=parts.filter(part=>part.name.includes('fractured crown'));assert.ok(crown.length);
  assert.ok(crown.every(part=>{part.geometry.computeBoundingBox();const position=part.geometry.attributes.position,top=part.geometry.boundingBox.max.y;return Array.from({length:position.count},(_,i)=>position.getY(i)).some(y=>y>top-.05&&y<top-.015);}), 'Surviving crown stones have fractured peaks rather than flat box tops');
  assert.ok(passageClear(group),'The logical route centre stays open through the full ruined tower footprint');
  // Move real stone while preserving every name and all other geometry. A
  // detached third face must fail the same physical chamber probe.
  for(const part of parts)if(part.name.startsWith('Tower return'))part.geometry.translate(.24,0,0);
  assert.equal(chamberHasThreeFaces(group),false,'A physically detached return is rejected despite unchanged part identities');
  dispose(group);material.dispose();
});

test('the keep has exactly two flanking lookouts and a completely clear bridge approach',()=>{
  const marker=createCheckpointMarker({kind:'keep'});marker.scale.setScalar(CHECKPOINT_MARKER_SCALE);marker.updateMatrixWorld(true);assert.equal(marker.getObjectByName('Faceted checkpoint cloth'),undefined);assert.equal(marker.getObjectByName('Flush trampled ground'),undefined);
  for(const x of [-.1,.1,.31,.5,.7])for(const z of [-.55,0,.55])assert.equal(rawHits(marker,new THREE.Vector3(x*CHECKPOINT_MARKER_SCALE,2,z*CHECKPOINT_MARKER_SCALE),new THREE.Vector3(0,-1,0)).length,0,'Full-height approach corridor remains clear');
  const height=[];for(const z of [-.8,.8]){const hits=rawHits(marker,new THREE.Vector3(.31*CHECKPOINT_MARKER_SCALE,2,z*CHECKPOINT_MARKER_SCALE),new THREE.Vector3(0,-1,0));assert.ok(hits.length);height.push(hits[0].point.y);}assert.ok(height.every(y=>y>1.4&&y<1.7),'Two real peaked watchtowers stand on opposite sides');dispose(marker);
});
