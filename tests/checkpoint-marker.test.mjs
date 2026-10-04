import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCheckpointMarker,CHECKPOINT_ROMAN_LABELS} from '../game/render/checkpoint-marker.js';
import {checkpointVignetteGeometries} from '../game/render/checkpoint-vignettes.js';
import {CHECKPOINT_MARKER_SCALE} from '../game/render/route-overlay.js';
import {optimize} from '../game/render/models.js';

const dispose=root=>root.traverse(node=>node.geometry?.dispose());
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
test('decorative markers retain the old footprint, shallow passage plate and non-picking behavior',()=>{
  for(const options of [{kind:'spawn'},...CHECKPOINT_ROMAN_LABELS.map(label=>({kind:'checkpoint',label})),{kind:'keep'}]){
    const marker=createCheckpointMarker(options);marker.scale.setScalar(CHECKPOINT_MARKER_SCALE);marker.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(marker,true);assert.ok(bounds.min.x>=-.55*CHECKPOINT_MARKER_SCALE&&bounds.max.x<=.60*CHECKPOINT_MARKER_SCALE);assert.ok(bounds.min.z>=-.55*CHECKPOINT_MARKER_SCALE&&bounds.max.z<=.55*CHECKPOINT_MARKER_SCALE);assert.ok(bounds.max.y<1.70*CHECKPOINT_MARKER_SCALE);
    marker.traverse(node=>{if(node.isMesh){
      const position=node.geometry.attributes.position,index=node.geometry.index;assert.ok(position.array.every(Number.isFinite));assert.equal(node.raycast(),undefined);assert.ok(node.material.depthWrite);
      for(let offset=0;offset<(index?.count??position.count);offset+=3){const vertices=[0,1,2].map(i=>new THREE.Vector3().fromBufferAttribute(position,index?index.getX(offset+i):offset+i));assert.ok(vertices[1].sub(vertices[0]).cross(vertices[2].sub(vertices[0])).length()>2e-11,'Merged fittings and embroidery contain real nondegenerate triangles');}
    }});
    const ray=new THREE.Raycaster(new THREE.Vector3(.39*CHECKPOINT_MARKER_SCALE,1.17*CHECKPOINT_MARKER_SCALE,2),new THREE.Vector3(0,0,-1));assert.deepEqual(ray.intersectObject(marker,true),[],'Flags cannot intercept defender or terrain selection');
    // Read the physical deck directly while keeping runtime picking disabled.
    const down=new THREE.Raycaster(new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0)),hits=[];marker.traverse(node=>{if(node.isMesh)THREE.Mesh.prototype.raycast.call(node,down,hits);});hits.sort((a,b)=>a.distance-b.distance);assert.ok(hits.length&&hits[0].point.y<.18*CHECKPOINT_MARKER_SCALE,'The central passage remains a low plate');
    assert.ok(marker.children.length<=11,'Scenery, stone, poles and trims share material batches');dispose(marker);
  }
  assert.throws(()=>createCheckpointMarker({label:'VI'}),RangeError);assert.throws(()=>createCheckpointMarker({kind:'enemy'}),RangeError);
});
test('Roman embroidery survives the production scenery merge without new textures or excessive batches',()=>{
  const group=new THREE.Group();for(const [i,label] of CHECKPOINT_ROMAN_LABELS.entries()){const marker=createCheckpointMarker({label});marker.position.x=i*2;group.add(marker);}
  group.add(createCheckpointMarker({kind:'spawn'}),createCheckpointMarker({kind:'keep'}));
  const merged=optimize(group);assert.ok(merged.children.length<=12,'Five scenes and both endpoints share twelve scenery materials');let triangles=0;merged.traverse(node=>{if(node.isMesh){node.raycast=()=>{};assert.equal(node.material.map,null);assert.ok(node.geometry.attributes.position.array.every(Number.isFinite));triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;}});assert.ok(triangles<9500,'The complete seven-marker decoration remains a small static scenery batch');
  const ink=merged.children.find(node=>node.material.color.getHexString()==='f1e6c7');assert.ok(ink);assert.ok(new THREE.Box3().setFromObject(ink,true).getSize(new THREE.Vector3()).x>8,'The final material batch retains every physical label');dispose(merged);
});

function rawHits(root,origin,direction){
  root.updateMatrixWorld(true);const ray=new THREE.Raycaster(origin,direction),hits=[];
  root.traverse(node=>{if(node.isMesh)THREE.Mesh.prototype.raycast.call(node,ray,hits);});return hits.sort((a,b)=>a.distance-b.distance);
}
function passageClear(root){
  for(const x of [-.075,0,.075])for(const z of [-.075,0,.075]){
    const hits=rawHits(root,new THREE.Vector3(x,1,z),new THREE.Vector3(0,-1,0));
    if(!hits.length||hits[0].point.y>.18)return false;
  }
  return true;
}
test('all five merged scenes leave a real central walking patch open, and displaced scenery is detected',()=>{
  const profiles=new Set();
  for(const label of CHECKPOINT_ROMAN_LABELS){
    const marker=createCheckpointMarker({label}),merged=optimize(marker);assert.ok(passageClear(merged),label+' has no raised prop in the centre');
    // Actual off-centre surface heights distinguish the five scenes; labels or
    // part names alone do not make a checkpoint visually distinct.
    const heights=[];for(const x of [-.34,-.24,-.14,.04])for(const z of [-.24,-.12,.04,.20])heights.push(rawHits(merged,new THREE.Vector3(x,.85,z),new THREE.Vector3(0,-1,0))[0]?.point.y.toFixed(3)||'empty');
    profiles.add(heights.join(','));dispose(merged);
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
    const hits=rawHits(floor,new THREE.Vector3(positions.getX(i),.30,positions.getZ(i)),new THREE.Vector3(0,-1,0));
    if(hits.length&&Math.abs(bottom-hits[0].point.y)<.004)return true;
  }
  return false;
}
test('load-bearing vignette props meet the actual stone deck instead of floating',()=>{
  const floor=createCheckpointMarker({kind:'spawn'}),names={I:['Soldier supporting rock','Grounded boot -1','Grounded boot 1'],II:['Left powder barrel end -1','Right powder barrel end -1'],III:[0,1,2,3,4].map(i=>'Crate '+i+' dark core'),IV:['Firepit stone 0','Firepit stone 3','Rolled campsite blanket'],V:['Broken wall foundation 0','Broken wall foundation 1','Broken wall foundation 2','Scattered rubble left']};
  for(const [label,required] of Object.entries(names)){
    const parts=checkpointVignetteGeometries(label);for(const name of required){const part=parts.find(candidate=>candidate.name===name);assert.ok(part&&floorSupported(part,floor),name+' has physical floor support');}
    if(label==='III'){
      const crate=parts.find(part=>part.name==='Crate 2 dark core');crate.geometry.translate(0,.04,0);assert.equal(floorSupported(crate,floor),false,'A raised actual crate is rejected without changing its identity');
    }
    for(const part of parts)part.geometry.dispose();
  }
  dispose(floor);
});
