import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {optimizeGeometricSiblings,retiredGeometricBuffers} from '../game/render/geometric-batching.js';
import {disposeGeometricResources} from '../game/render/geometric-resources.js';
import {cloneDefenderTemplate} from '../game/render/defender-assets.js';
import {enemyFigure} from '../game/render/enemy-assets.js';
import {animateEnemyMotion} from '../game/render/enemy-motion.js';
import {attackRig,attackMuzzle,previewGeometricAttack,updateGeometricPreview,disposeAttack,beginDeath,animateDeath} from '../game/render/battle-animation.js';
import {geometricMetadata} from '../game/render/geometric-motion.js';
import {prepareReconstructedDefender} from '../game/render/reconstruction-adapter.js';
import {currentReconstructionEntry} from '../tools/audit-reconstructed-roster.mjs';

const towers=JSON.parse(readFileSync('data/towers.json'));
const descendant=(node,parent)=>{for(let n=node;n;n=n.parent)if(n===parent)return true;return false;};
function worldVertices(root,excluded=[]){
  root.updateMatrixWorld(true);const result=[],point=new THREE.Vector3(),normal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3();
  root.traverse(node=>{
    if(!node.isMesh||excluded.some(parent=>descendant(node,parent)))return;
    const geometry=node.geometry,attributes=Object.entries(geometry.attributes).sort(([a],[b])=>a.localeCompare(b));normalMatrix.getNormalMatrix(node.matrixWorld);
    const count=geometry.index?.count??geometry.attributes.position.count;
    // Enemy cue materials are intentionally private clones on each instance.
    // The optimizer excludes them; compare their identical shader parameters
    // rather than requiring those independent clones to share a UUID.
    const materialKey=node.userData.visualCue?JSON.stringify([node.userData.visualCue,node.material.type,node.material.name,node.material.color?.getHex(),node.material.emissive?.getHex(),node.material.emissiveIntensity,node.material.metalness,node.material.roughness,node.material.opacity,node.material.side,node.material.map?.uuid]):node.material.uuid;
    const key=[materialKey,attributes.map(([name,a])=>name+':'+a.itemSize).join(','),node.visible,node.castShadow,node.receiveShadow,node.renderOrder,node.layers.mask].join('|');
    for(let i=0;i<count;i++){
      const index=geometry.index?geometry.index.getX(i):i,values=[];
      point.fromBufferAttribute(geometry.attributes.position,index).applyMatrix4(node.matrixWorld);values.push(...point.toArray());
      for(const [name,attribute] of attributes){
        if(name==='position')continue;
        if(name==='normal'||name==='tangent'){
          normal.fromBufferAttribute(attribute,index).applyMatrix3(normalMatrix).normalize();values.push(...normal.toArray());if(attribute.itemSize===4)values.push(attribute.getComponent(index,3));
        }else for(let n=0;n<attribute.itemSize;n++)values.push(attribute.getComponent(index,n));
      }
      result.push({key,values});
    }
  });return result;
}
function equalGeometry(expected,actual,label){
  assert.equal(actual.length,expected.length,label+' expanded physical vertex count');
  const buckets=new Map(),key=(entry,x,y,z)=>entry.key+';'+x+','+y+','+z,quant=value=>Math.round(value*1e4);
  for(const entry of expected){const token=key(entry,...entry.values.slice(0,3).map(quant));if(!buckets.has(token))buckets.set(token,[]);buckets.get(token).push(entry.values);}
  for(const entry of actual){
    const xyz=entry.values.slice(0,3).map(quant);let matched=false;
    const consume=(x,y,z)=>{
      const token=key(entry,x,y,z),bucket=buckets.get(token);if(!bucket)return false;
      const index=bucket.findIndex(values=>values.length===entry.values.length&&values.every((value,n)=>Math.abs(value-entry.values[n])<1e-5));
      if(index<0)return false;bucket.splice(index,1);if(!bucket.length)buckets.delete(token);return true;
    };
    matched=consume(...xyz);
    if(!matched)for(let x=-1;x<=1&&!matched;x++)for(let y=-1;y<=1&&!matched;y++)for(let z=-1;z<=1&&!matched;z++)matched=consume(xyz[0]+x,xyz[1]+y,xyz[2]+z);
    assert.ok(matched,label+' every world vertex, normal/UV/color and exact material/render contract is preserved');
  }
  assert.equal(buckets.size,0,label+' no original vertex lost');
}
const transforms=root=>{root.updateMatrixWorld(true);const values=[];root.traverse(node=>values.push([node.name,...node.matrixWorld.elements]));return JSON.stringify(values);};

test('batching keeps protected meshes, exact parent/material boundaries, semantic transforms and original vertex buffers',()=>{
  const root=new THREE.Group();root.userData.geometricRig=true;const material=new THREE.MeshStandardMaterial(),geometry=new THREE.BoxGeometry(),parent=new THREE.Group();root.add(parent);
  const first=new THREE.Mesh(geometry,material),second=new THREE.Mesh(geometry,material);first.name='physical_a';second.name='physical_b';first.position.set(.2,.3,.4);second.rotation.x=.31;second.position.x=-.3;parent.add(first,second);
  const protectedNodes=[];
  for(const name of ['authored_bowstring','Crossbow_cocked_twoSegment_physical_string','bow_tip_upper','bow_tip_lower','bow_nock','attack_muzzle','attack_muzzle001','staff_tip','sword_tip','wing_R','head_pivot','animated']){const mesh=new THREE.Mesh(geometry,material);mesh.name=name;parent.add(mesh);protectedNodes.push(mesh);}
  for(const name of ['refraction_shards','cue_parent']){const group=new THREE.Group();group.name=name;if(name==='cue_parent')group.userData.visualCue='recharge';parent.add(group);for(let i=0;i<2;i++){const mesh=new THREE.Mesh(geometry,material);group.add(mesh);protectedNodes.push(mesh);}}
  const transparent=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({transparent:true})),custom=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());custom.material.onBeforeCompile=()=>{};parent.add(transparent,custom);protectedNodes.push(transparent,custom);
  const otherParent=new THREE.Group();root.add(otherParent);const isolated=new THREE.Mesh(geometry,material);otherParent.add(isolated);protectedNodes.push(isolated);
  const vertices=geometry.attributes.position.array.slice(),before=worldVertices(root),matrix=first.matrixWorld.clone();
  const clip=new THREE.AnimationClip('move',1,[new THREE.VectorKeyframeTrack('animated.position',[0,1],[0,0,0,1,0,0])]);
  const stats=optimizeGeometricSiblings(root,{animations:[clip]});assert.equal(stats.mergedGroups,1);assert.equal(stats.before-stats.after,1);
  for(const node of protectedNodes)assert.equal(node.parent?.children.includes(node),true,'protected mesh remains original object');
  const semantic=root.getObjectByName('physical_a');assert.equal(semantic.isGroup,true);assert.deepEqual(semantic.matrixWorld.elements,matrix.elements);assert.deepEqual(geometry.attributes.position.array,vertices);
  equalGeometry(before,worldVertices(root),'fixture rest');assert.equal(retiredGeometricBuffers(root).has(geometry),true);assert.equal(optimizeGeometricSiblings(root),stats,'optimization is idempotent');disposeGeometricResources(root);
});

for(const [folder,expected] of [['defenders',48],['champions',38],['enemies',50]])test(`all ${expected} actual ${folder} retain ${folder==='enemies'?'rest, gait, grounded corpse':'rest and attack/muzzle'} geometry and owned resources after sibling batching`,async()=>{
  const directory=resolve('public/assets/geometric',folder),files=readdirSync(directory).filter(file=>file.endsWith('.glb')).sort();assert.equal(files.length,expected);let saved=0;
  for(const file of files){
    const bytes=readFileSync(resolve(directory,file)),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    const source=gltf.scene,reconstruction=folder==='enemies'?null:currentReconstructionEntry(file.replace('.glb',''));source.animations=gltf.animations;
    if(reconstruction)prepareReconstructedDefender(source,reconstruction);
    const raw=source.clone(true),metadata=geometricMetadata(source),family=metadata.family||file.replace('.glb','').replace(/-\d$/,'');
    const originalVertices=new Map(),disposals=new Map();source.traverse(node=>{if(node.geometry&&!originalVertices.has(node.geometry)){originalVertices.set(node.geometry,node.geometry.attributes.position.array.slice());disposals.set(node.geometry,0);node.geometry.addEventListener('dispose',()=>disposals.set(node.geometry,disposals.get(node.geometry)+1));}});
    const before=worldVertices(raw),stats=optimizeGeometricSiblings(source,{animations:gltf.animations});saved+=stats.before-stats.after;
    source.traverse(node=>{if(node.userData.geometricBatch){disposals.set(node.geometry,0);node.geometry.addEventListener('dispose',()=>disposals.set(node.geometry,disposals.get(node.geometry)+1));}});
    equalGeometry(before,worldVertices(source),file+' rest');const sourcePose=transforms(source),peer=cloneDefenderTemplate(source),peerPose=transforms(peer),originalActor=cloneDefenderTemplate(raw),batchedActor=cloneDefenderTemplate(source);
    if(folder!=='enemies'){
      const a=attackRig(originalActor,family,towers[family]||{type:'physical'}),b=attackRig(batchedActor,family,towers[family]||{type:'physical'});
      previewGeometricAttack(a,{duration:1});previewGeometricAttack(b,{duration:1});
      for(const dt of [.42,.16,.5]){updateGeometricPreview(a,dt);updateGeometricPreview(b,dt);equalGeometry(worldVertices(originalActor,a.owned),worldVertices(batchedActor,b.owned),file+' attack');const muzzleA=attackMuzzle(a),muzzleB=attackMuzzle(b);assert.equal(!!muzzleA,!!muzzleB);if(muzzleA)assert.ok(muzzleA.distanceTo(muzzleB)<1e-5,file+' moving muzzle');}
      disposeAttack(a);disposeAttack(b);
    }
    if(!reconstruction){
    const enemy={id:0,type:'actual',speed:1,traveled:0,statuses:{},flying:metadata.locomotion==='flying'},a=enemyFigure(enemy,new Map([['actual',raw]])),b=enemyFigure(enemy,new Map([['actual',source]]));
    for(const time of [0,.04,.15]){enemy.traveled=time;animateEnemyMotion(a,enemy,time);animateEnemyMotion(b,enemy,time);equalGeometry(worldVertices(a),worldVertices(b),file+' gait');}
    beginDeath(a,enemy);beginDeath(b,enemy);for(const dt of [.2,.3,.6]){animateDeath(a,dt);animateDeath(b,dt);equalGeometry(worldVertices(a),worldVertices(b),file+' grounded corpse');assert.ok(new THREE.Box3().setFromObject(b.userData.body,true).min.y>=.02499);}
    }
    assert.equal(transforms(source),sourcePose,file+' cached source unchanged');assert.equal(transforms(peer),peerPose,file+' private peer unchanged');for(const [geometry,vertices] of originalVertices)assert.deepEqual(geometry.attributes.position.array,vertices);
    disposeGeometricResources([source,raw]);disposeGeometricResources([source,raw]);assert.ok([...disposals.values()].every(count=>count===1),file+' every original/merged buffer releases exactly once');
  }
  assert.ok(saved>0,'actual files reduce draw submissions');
});
