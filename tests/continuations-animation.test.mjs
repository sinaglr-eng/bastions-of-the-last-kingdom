import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {Game} from '../game/core/game.js';
import {allRecipes,recipesUsing,recipeFamily,recipeTier,rankLabel} from '../game/core/recipes.js';
import {towerStats} from '../game/core/math.js';
import {beginDeath,animateDeath,bossAura,animateBossAura,siegeRig,animateSiege} from '../game/render/battle-animation.js';
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
const unit=(family,tier,id)=>({id,family,tier,state:'active',x:10+id,z:10,kills:id,cooldown:0});

test('the 39 stored recipes preserve original lineages without extra rank recipes while only 38 are available',()=>{
 const original=['rimewatch','frostblade','roseguard','highking','crownofages','thornwarden','verdantguard','tempest','stormcitadel','embercrown','worldfire','starfall','thunderheart','phoenix','greenheart','eldergrove','kingsreach','sunward','winterhold','dawnspire'];
 assert.deepEqual(Object.keys(data.towers).filter(f=>data.towers[f].advanced).slice(0,20),original);
 assert.deepEqual(data.recipes.slice(0,20).map(r=>recipeFamily(r)),original);
 for(const tier of [1,2,6]){
  const towers=original.map((family,id)=>unit(family,tier,id)),recipes=allRecipes(data,towers);
  assert.equal(data.recipes.length,39);assert.equal(recipes.length,38);assert.deepEqual(recipes,data.recipes.filter(recipe=>!data.towers[recipeFamily(recipe)].hidden));
  for(const recipe of recipes){assert.equal(recipe.ingredients.length,3);assert.equal(recipeTier(recipe),1);assert.ok(data.towers[recipeFamily(recipe)]);}
  if(tier>1)for(const tower of towers)assert.deepEqual(recipesUsing(tower,recipes),[]);
 }
 assert.equal(rankLabel(14),'XIV');
});
test('the approved fixed recipes cover every basic rank',()=>{
 const unused=Object.fromEntries(Object.entries(data.towers).filter(([,t])=>!t.advanced).map(([family])=>[family,[1,2,3,4,5,6].filter(tier=>!recipesUsing(unit(family,tier,1),data.recipes).length)]));
 assert.deepEqual(unused,{soldier:[],archer:[],druid:[],mage:[],cleric:[],runebreaker:[],frostwarden:[],stormcaller:[]});
});
test('three identical champions cannot create another rank or mutate the battlefield',()=>{
 for(const tier of [1,2,6])for(let anchor=1;anchor<=3;anchor++){
  const g=new Game(data,{seed:1});g.phase='ready';g.towers=[1,2,3].map(id=>unit('dawnspire',tier,id));g.selected=anchor;
  for(const t of g.towers)g.grid.occupy(t.x,t.z,t.id);
  const before=structuredClone(g.towers),gold=g.economy.gold;
  assert.equal(g.recipes.length,38);assert.deepEqual(g.availableRecipes(),[]);
  assert.equal(g.craft(`ascend-dawnspire-${tier}`),false);assert.equal(g.merge(),false);
  assert.deepEqual(g.towers,before);assert.equal(g.economy.gold,gold);
  assert.equal(g.grid.occupied.size,3);assert.equal(g.discoveries.size,0);
 }
});
test('champion stats ignore obsolete ranks and enhancements',()=>{
 for(const [family,spec]of Object.entries(data.towers).filter(([,spec])=>spec.advanced)){
  for(const upgrades of [0,1,2,3]){
   const baseline=towerStats({...unit(family,1,1),upgrades},data);
   for(const tier of [2,6,12])assert.deepEqual(towerStats({...unit(family,tier,1),upgrades},data),baseline,family);
   assert.equal(baseline.damage,spec.damage);
   if(spec.aura)assert.deepEqual(baseline.aura,spec.aura);
  }
 }
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
