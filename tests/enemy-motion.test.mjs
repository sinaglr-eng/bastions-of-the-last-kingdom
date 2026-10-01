import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Box3,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {enemyFigure} from '../game/render/enemy-assets.js';
import {animateEnemyMotion} from '../game/render/enemy-motion.js';
const enemies=JSON.parse(readFileSync(new URL('../data/enemies.json',import.meta.url))),loader=new GLTFLoader();
async function template(id){const b=readFileSync(new URL(`../public/assets/enemies/${id}.glb`,import.meta.url));return(await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;}
const positions=root=>{const a=[];root.updateMatrixWorld(true);root.traverse(n=>{if(n.isMesh)a.push(...n.matrixWorld.elements);});return a;};

test('real bat, armored bat, manta and wyvern wings move strongly in opposed strokes without changing a cached model or another clone',async()=>{
 for(const [id,frequency]of [['host_05',9],['host_25',5.2],['host_39',4.1],['host_50',3.4]]){
  const scene=await template(id),enemy={...enemies[id],type:id,id:1},map=new Map([[id,scene]]);
  const one=enemyFigure(enemy,map),two=enemyFigure({...enemy,id:2},map),cached=positions(scene),untouched=positions(two);
  assert.equal(one.userData.wings.length,2,id);
  const peak=(Math.PI/2-1.618+20*Math.PI)/frequency,trough=peak+Math.PI/frequency;
  animateEnemyMotion(one,enemy,peak);one.updateMatrixWorld(true);
  const first=new Box3().setFromObject(one.userData.wings[0],true).getCenter(new Vector3()).y;
  const [left,right]=one.userData.wings.map(n=>n.rotation.z-n.userData.restRotation);
  assert.ok(Math.abs(left+right)<1e-6);assert.ok(Math.abs(left)>.28);
  animateEnemyMotion(one,enemy,trough);one.updateMatrixWorld(true);
  const second=new Box3().setFromObject(one.userData.wings[0],true).getCenter(new Vector3()).y;
  assert.ok(Math.abs(second-first)>.20,`${id} visible wing displacement ${second-first}`);
  assert.deepEqual(positions(scene),cached);assert.deepEqual(positions(two),untouched);
 }
});
test('ground walking and exhibition breathing preserve native scale; reduced motion settles every decorative pose',async()=>{
 const id='host_02',scene=await template(id),enemy={...enemies[id],type:id,id:2},figure=enemyFigure(enemy,new Map([[id,scene]]));
 assert.ok(figure.userData.limbs.length>=2);
 animateEnemyMotion(figure,enemy,1);const walking=positions(figure);
 animateEnemyMotion(figure,enemy,1.3);assert.notDeepEqual(positions(figure),walking);
 animateEnemyMotion(figure,enemy,2,{moving:false});const breathing=positions(figure);
 animateEnemyMotion(figure,enemy,2.4,{moving:false});assert.notDeepEqual(positions(figure),breathing);
 animateEnemyMotion(figure,enemy,3,{reducedMotion:true});const still=positions(figure);
 assert.equal(animateEnemyMotion(figure,enemy,200,{reducedMotion:true}),0);assert.deepEqual(positions(figure),still);
 for(const time of [NaN,Infinity,-5]){animateEnemyMotion(figure,enemy,time);assert.ok(positions(figure).every(Number.isFinite));}
});
