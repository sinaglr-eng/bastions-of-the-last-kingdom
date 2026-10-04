import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Box3,Vector3,Raycaster} from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {castleWallModel,WALL_DECK_HEIGHT} from '../game/render/walls.js';
import {scaleBattlefieldUnit} from '../game/render/battlefield-scale.js';

async function nativeModel(relative){
 const bytes=readFileSync(new URL('../public/assets/geometric/'+relative,import.meta.url));
 return (await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}
test('fighting deck matches the real wave-two goblin height, excluding its spear',async()=>{
 const waves=JSON.parse(readFileSync(new URL('../data/waves.json',import.meta.url)));
 assert.equal(waves[1].groups[0].type,'host_02');
 const enemy=scaleBattlefieldUnit(await nativeModel('enemies/host_02.glb'));
 const feet=new Box3().setFromObject(enemy,true).min.y;
 const headTop=new Box3().setFromObject(enemy.getObjectByName('head_pivot'),true).max.y;
 assert.ok(Math.abs(WALL_DECK_HEIGHT-(headTop-feet))<1e-5);
 const spearTop=new Box3().setFromObject(enemy.getObjectByName('weapon_R'),true).max.y;
 assert.ok(spearTop>headTop,'the actual spear extends above the creature');
 assert.ok(new Box3().setFromObject(enemy,true).max.y>WALL_DECK_HEIGHT,'weapon tip must not set wall height');
 for(const mask of [0,1,3,10,16,255]){
  const platform=castleWallModel(mask,true),bounds=new Box3().setFromObject(platform,true);
  assert.ok(Math.abs(bounds.max.y-WALL_DECK_HEIGHT)<1e-6,`platform ${mask} has an unobstructed fighting deck`);
  assert.ok(Math.abs(bounds.min.y)<1e-6,`platform ${mask} foundation rests on terrain`);
  const wall=castleWallModel(mask),wallBounds=new Box3().setFromObject(wall,true);
  assert.ok(Math.abs(wallBounds.max.y-WALL_DECK_HEIGHT-.07)<1e-6,`wall ${mask} has shallow crenellations above deck`);
  assert.ok(wallBounds.getSize(new Vector3()).x<=1.01,'tile width stays intact');
  for(const root of [platform,wall])root.traverse(node=>node.geometry?.dispose());
 }
});
test('native small defender and large champion stand one goblin-height level above terrain',async()=>{
 const platform=castleWallModel(0,true);platform.updateMatrixWorld(true);
 for(const file of ['defenders/archer-1.glb','champions/worldfire.glb']){
  const actor=scaleBattlefieldUnit(await nativeModel(file));actor.position.y=WALL_DECK_HEIGHT;
  const bottom=new Box3().setFromObject(actor,true).min.y;
  assert.ok(Math.abs(bottom-WALL_DECK_HEIGHT)<1e-5,file+' has fitted feet on top of the masonry');
  const support=new Set();actor.updateMatrixWorld(true);
  actor.traverse(node=>{
   const geometry=node.geometry,position=geometry?.attributes.position;if(!position)return;
   const index=geometry.index;
   for(let offset=0;offset<(index?.count??position.count);offset+=3){
    const vertices=[0,1,2].map(i=>new Vector3().fromBufferAttribute(position,index?index.getX(offset+i):offset+i).applyMatrix4(node.matrixWorld));
    if(vertices.some(p=>Math.abs(p.y-bottom)>1e-5))continue;
    const centre=vertices.reduce((sum,p)=>sum.add(p),new Vector3()).multiplyScalar(1/3);
    const hit=new Raycaster(centre.clone().add(new Vector3(0,.05,0)),new Vector3(0,-1,0)).intersectObject(platform,true)[0];
    if(hit&&Math.abs(hit.point.y-bottom)<1e-5)support.add(centre.x<0?'left':'right');
   }
  });
  assert.deepEqual([...support].sort(),['left','right'],file+' has actual sole surfaces in contact with level paving on both sides');
 }
 platform.traverse(node=>node.geometry?.dispose());
});

test('fighting platform has separate level stone surfaces with recessed joints and the existing batch budget',()=>{
 const root=castleWallModel(0,true),links=new Map(),topColors=new Set();let area=0;
 const find=key=>{if(!links.has(key))links.set(key,key);const parent=links.get(key);if(parent!==key)links.set(key,find(parent));return links.get(key);};
 root.traverse(node=>{
  const geometry=node.geometry;if(!geometry)return;const position=geometry.attributes.position,index=geometry.index;
  for(let offset=0;offset<(index?.count??position.count);offset+=3){
   const vertices=[0,1,2].map(i=>new Vector3().fromBufferAttribute(position,index?index.getX(offset+i):offset+i));
   if(vertices.some(p=>Math.abs(p.y-WALL_DECK_HEIGHT)>1e-6))continue;
   const cross=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0]));if(cross.y<=1e-8)continue;
   area+=cross.y/2;topColors.add(node.material.color.getHex());
   const keys=vertices.map(p=>p.x.toFixed(6)+','+p.z.toFixed(6));for(const key of keys)links.set(find(key),find(keys[0]));
  }
 });
 assert.ok(new Set([...links.keys()].map(find)).size>=6,'the top contains genuinely separated paving slabs rather than painted seams on one cap');
 assert.ok(area>.75,'the dressed stones support most of the fighting deck');assert.ok(topColors.size>=2,'upper paving has modest stone variation');
 assert.ok(root.children.length<=5,'paving shares the existing material batches');
 const bounds=new Box3().setFromObject(root,true),stoneExtent=Math.max(...[...links.keys()].flatMap(key=>key.split(',').map(value=>Math.abs(Number(value)))));
 assert.ok(Math.abs(bounds.max.y-WALL_DECK_HEIGHT)<1e-6);assert.ok(stoneExtent<=.47+1e-6,'upper slabs stay inside the original cornice');assert.ok(bounds.max.x<=.473+1e-6&&bounds.max.z<=.473+1e-6,'the existing narrow cornice joints retain their footprint');
 root.traverse(node=>node.geometry?.dispose());
});
