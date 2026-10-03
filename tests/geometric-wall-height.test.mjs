import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Box3,Vector3} from 'three';
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
 for(const file of ['defenders/archer-1.glb','champions/worldfire.glb']){
  const actor=scaleBattlefieldUnit(await nativeModel(file));actor.position.y=WALL_DECK_HEIGHT;
  const bottom=new Box3().setFromObject(actor,true).min.y;
  assert.ok(Math.abs(bottom-WALL_DECK_HEIGHT)<1e-5,file+' has fitted feet on top of the masonry');
 }
});
