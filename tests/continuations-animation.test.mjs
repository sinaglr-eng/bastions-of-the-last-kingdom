import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {Game} from '../game/core/game.js';
import {allRecipes,recipesUsing,matchingIngredients,ascensionRecipe,recipeFamily,rankLabel} from '../game/core/recipes.js';
import {towerStats} from '../game/core/math.js';
import {beginDeath,animateDeath,bossAura,animateBossAura,siegeRig,animateSiege} from '../game/render/battle-animation.js';
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
const unit=(family,tier,id)=>({id,family,tier,state:'active',x:10+id,z:10,kills:id,cooldown:0});

test('every basic rank and every champion rank has a three-unit path forward',()=>{
 for(const [family,stats]of Object.entries(data.towers))for(const tier of stats.advanced?[1,5,9,23]:[1,2,3,4,5,6]){
  const t=unit(family,tier,1),options=recipesUsing(t,allRecipes(data,[t]));
  assert.ok(options.length,`${family} ${tier}`);
  for(const recipe of options){assert.equal(recipe.ingredients.length,3);assert.ok(data.towers[recipeFamily(recipe)]);}
 }
 assert.equal(rankLabel(14),'XIV');
});
test('ascension consumes three distinct exact-rank champions and continues beyond six',()=>{
 for(const tier of [1,6,12])for(let anchor=1;anchor<=3;anchor++){
  const g=new Game(data,{seed:1});g.phase='ready';g.towers=[1,2,3].map(id=>unit('dawnspire',tier,id));g.selected=anchor;
  for(const t of g.towers)g.grid.occupy(t.x,t.z,t.id);
  const before=towerStats(g.selection,data),recipe=ascensionRecipe('dawnspire',tier);
  assert.ok(g.craft(recipe.id));assert.equal(g.selection.tier,tier+1);assert.equal(g.selection.family,'dawnspire');
  assert.equal(g.selection.kills,6);assert.equal(g.grid.occupied.size,3);assert.equal(g.towers.filter(t=>t.state==='active').length,1);
  assert.ok(towerStats(g.selection,data).damage>before.damage);assert.ok(recipesUsing(g.selection,g.recipes).length);
  assert.ok(g.discoveries.has('dawnspire'));
 }
 const recipe=ascensionRecipe('dawnspire',2),two=[unit('dawnspire',2,1),unit('dawnspire',2,2)];
 assert.equal(matchingIngredients(recipe,two),null);
 assert.equal(matchingIngredients(recipe,[...two,unit('dawnspire',1,3)]),null);
});
test('kill and survived-wave score are awarded once and leaks never count',()=>{
 const g=new Game(data,{seed:1});g.phase='combat';const e=g.combat.spawn('grunt');
 g.combat.damage(e,1e6,'pure',{});assert.equal(g.score,10);g.combat.damage(e,1e6,'pure',{});assert.equal(g.score,10);
 g.completeWave();assert.equal(g.score,110);g.completeWave();assert.equal(g.score,110);
 const boss=new Game(data,{seed:1});boss.round=10;boss.phase='combat';const b=boss.combat.spawn('host_10');boss.combat.damage(b,1e9,'pure',{});
 assert.equal(boss.score,5000);boss.completeWave();assert.equal(boss.score,8000);
 const leaker=new Game(data,{seed:1});leaker.phase='combat';leaker.combat.spawnQueue=[{time:9999,type:'grunt'}];const l=leaker.combat.spawn('grunt');l.pathIndex=l.route.length;leaker.tick(.01);assert.equal(leaker.leaks,1);assert.equal(leaker.score,0);
});
test('death animation falls onto the ground and retains the detailed corpse without fading',()=>{
 const root=new THREE.Group(),body=new THREE.Group();root.add(body);root.userData.body=body;
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(.4,1.8,.35),new THREE.MeshBasicMaterial());mesh.position.y=.9;body.add(mesh);
 const bar=new THREE.Group();root.add(bar);root.userData.bar=bar;root.position.y=.8;
 beginDeath(root,{flying:true});animateDeath(root,.2);assert.ok(body.rotation.x<0&&body.rotation.x>-Math.PI/2);assert.equal(bar.visible,false);
 animateDeath(root,2);root.updateMatrixWorld(true);assert.equal(body.rotation.x,-Math.PI/2);
 assert.ok(new THREE.Box3().setFromObject(body,true).min.y>=.024);assert.equal(root.visible,true);assert.equal(mesh.material.opacity,1);
 const settled=root.position.y;animateDeath(root,300);assert.equal(root.position.y,settled);assert.equal(root.children.includes(body),true);
 mesh.geometry.dispose();mesh.material.dispose();
});
test('warlord aura animates and catapult release resets the articulated arm',()=>{
 const aura=bossAura(3);animateBossAura(aura,2);assert.equal(aura.children[0].material.uniforms.time.value,2);
 assert.equal(aura.getObjectByName('Warlord embers').children.length,12);
 const actor=new THREE.Group(),arm=new THREE.Group();arm.name='siege_arm';arm.rotation.x=.1;actor.add(arm);const rig=siegeRig(actor);rig.elapsed=0;
 animateSiege(rig,.13);assert.ok(arm.rotation.x<-.7);animateSiege(rig,1);assert.equal(arm.rotation.x,.1);
 aura.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});
