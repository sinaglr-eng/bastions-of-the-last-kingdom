import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CombatEffects,attackVisualKind} from '../game/render/combat-effects.js';
import {attackRig,triggerAttack,animateAttack,resetAttack} from '../game/render/battle-animation.js';

const shot=(family,id=1,stats={type:'physical'})=>({id,source:{id:10,family,x:1,z:2},start:{x:1,z:2},target:{id:20,x:7,z:8},x:1,z:2,progress:.5,duration:.4,stats});
const resources=object=>{const result=new Set();object.traverse(o=>{if(o.isInstancedMesh)result.add(o);if(o.geometry)result.add(o.geometry);if(o.material)result.add(o.material);});return result;};
const finiteScene=scene=>scene.traverse(o=>{
  for(const value of [...o.position.toArray(),...o.scale.toArray(),...o.quaternion.toArray()])assert.ok(Number.isFinite(value),o.name);
  if(o.geometry)for(const value of o.geometry.attributes.position.array)assert.ok(Number.isFinite(value),o.name);
  if(o.material){assert.equal(o.material.depthWrite,false);assert.equal(o.raycast(),undefined);}
});

test('different families receive mechanisms matching roots, breath, lightning, blades, siege and magic',()=>{
  for(const family of ['druid','greenheart','eldergrove','mothernature'])assert.equal(attackVisualKind(family,{type:'poison'}),'roots');
  for(const family of ['embercrown','worldfire','thunderheart','phoenix'])assert.equal(attackVisualKind(family,{type:'arcane'}),'flame');
  assert.equal(attackVisualKind('stormcaller',{type:'arcane'}),'lightning');assert.equal(attackVisualKind('frostblade'),'melee');
  assert.equal(attackVisualKind('stonewarden'),'siege');assert.equal(attackVisualKind('cleric',{type:'holy'}),'holy');
  assert.equal(attackVisualKind('frostwarden',{type:'frost'}),'frost');assert.equal(attackVisualKind('mage',{type:'arcane'}),'arcane');assert.equal(attackVisualKind('archer'),'arrow');
});

test('druid shots grow roots at enemy feet, never fly a generic bullet from the tower',()=>{
  const scene=new THREE.Scene(),fx=new CombatEffects(scene,{position:(x,y,z)=>new THREE.Vector3(x-18,y,z-18)}),s=shot('druid');
  const original=structuredClone(s);fx.syncProjectiles([s],1);const visual=fx.projectiles.get(s.id);
  assert.equal(visual.kind,'roots');assert.equal(visual.object.name,'Living roots under target');
  assert.deepEqual(visual.object.position.toArray(),[-11,.03,-10]);assert.equal(visual.object.getObjectByName('Rising poisonous thorns').count,7);
  assert.deepEqual(s,original,'Visuals do not mutate timing, stats, position or targets');fx.dispose();assert.equal(scene.children.length,0);
});

test('lobbed bombs arc above their path while ballista bolts remain direct and flame streams connect source and target',()=>{
  const scene=new THREE.Scene(),fx=new CombatEffects(scene),catapult=shot('stonewarden',1),ballista=shot('kingsreach',2),dragon=shot('worldfire',3);
  fx.syncProjectiles([catapult,ballista,dragon],1);
  assert.ok(fx.projectiles.get(1).object.position.y>fx.projectiles.get(2).object.position.y+1);
  assert.equal(fx.projectiles.get(1).object.name,'Lobbed siege charge');assert.equal(fx.projectiles.get(2).object.name,'Crafted arrow');
  assert.equal(fx.projectiles.get(3).object.name,'Dragon fire breath');assert.ok(fx.projectiles.get(3).object.scale.y>8);
  finiteScene(scene);fx.dispose();
});

test('hidden enemies leave no projectiles, trails, impact effects or chain endpoints',()=>{
  const scene=new THREE.Scene(),fx=new CombatEffects(scene,{isVisible:enemy=>!enemy.hidden}),s=shot('mage',1,{type:'arcane'});
  fx.syncProjectiles([s],1);assert.equal(fx.projectiles.size,1);s.target.hidden=true;
  fx.syncProjectiles([s],2);assert.equal(fx.projectiles.size,0);
  fx.event('shot',s);fx.event('impact',{x:7,z:8,source:s.source,target:s.target,stats:s.stats});fx.event('chain',{from:s.source,to:s.target});fx.event('aura-attack',{...s,source:{...s.source,family:'worldfire'}});
  assert.equal(scene.children.length,0);assert.equal(fx.effects.length,0);fx.dispose();
});

test('projectile limits stay stable under large volleys and effect resources release once on cap, expiry and disposal',()=>{
  const scene=new THREE.Scene(),fx=new CombatEffects(scene,{maxProjectiles:2,maxEffects:1});
  const volley=[shot('archer',1),shot('mage',2,{type:'arcane'}),shot('frostwarden',3,{type:'frost'})];
  fx.syncProjectiles(volley,0);assert.equal(fx.projectiles.size,2);const first=fx.projectiles.get(1).object;
  fx.syncProjectiles(volley,1);assert.equal(fx.projectiles.get(1).object,first,'Oversubscribed volleys do not rebuild every frame');
  fx.impact({x:3,z:4,source:{family:'druid'}});const old=fx.effects[0].object,disposed=new Map();
  for(const resource of resources(old)){disposed.set(resource,0);resource.addEventListener('dispose',()=>disposed.set(resource,disposed.get(resource)+1));}
  fx.impact({x:3,z:4,stats:{type:'frost'}});assert.equal(fx.effects.length,1);for(const count of disposed.values())assert.equal(count,1);
  fx.update(2,2);assert.equal(fx.effects.length,0);fx.syncProjectiles([],3);assert.equal(fx.projectiles.size,0);assert.equal(scene.children.length,0);
  fx.dispose();fx.dispose();for(const count of disposed.values())assert.equal(count,1);
});

test('all effect styles stay finite and reduced motion removes decorative movement',()=>{
  const scene=new THREE.Scene(),fx=new CombatEffects(scene,{reducedMotion:true});
  const styles=[['druid','poison'],['worldfire','fire'],['stormcaller','arcane'],['soldier','physical'],['stonewarden','physical'],['cleric','holy'],['frostwarden','frost'],['mage','arcane'],['archer','physical']];
  const shots=styles.map(([family,type],i)=>shot(family,i+1,{type}));fx.syncProjectiles(shots,0);
  const flame=Array.from(fx.projectiles.get(2).object.children[2].instanceMatrix.array);fx.syncProjectiles(shots,999);assert.deepEqual(Array.from(fx.projectiles.get(2).object.children[2].instanceMatrix.array),flame);
  for(const s of shots)fx.impact({source:s.source,target:s.target,stats:s.stats,x:s.target.x,z:s.target.z});
  fx.event('chain',{from:shots[0].source,to:shots[0].target});fx.update(.1,Number.MAX_VALUE);finiteScene(scene);fx.dispose();assert.equal(scene.children.length,0);
});

test('attack poses articulate only local X/Z and explicit pivots, preserving world position, aim, scale and shared geometry',()=>{
  const actor=new THREE.Group();actor.position.set(4,.85,7);actor.rotation.set(.1,1.5,.02);actor.scale.setScalar(.8);
  const geo=new THREE.BoxGeometry(1,1,1),mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial());actor.add(mesh);
  const jaw=new THREE.Group();jaw.name='dragon_jaw';jaw.rotation.x=.11;actor.add(jaw);
  const before={position:actor.position.toArray(),aim:actor.rotation.y,scale:actor.scale.toArray(),vertices:Array.from(geo.attributes.position.array)};
  const rig=attackRig(actor,'worldfire',{type:'fire'});triggerAttack(rig,{stats:{interval:1}});animateAttack(rig,.12);
  assert.notEqual(actor.rotation.x,.1);assert.notEqual(jaw.rotation.x,.11);
  assert.deepEqual(actor.position.toArray(),before.position);assert.equal(actor.rotation.y,before.aim);assert.deepEqual(actor.scale.toArray(),before.scale);assert.deepEqual(Array.from(geo.attributes.position.array),before.vertices);
  animateAttack(rig,4);assert.equal(actor.rotation.x,.1);assert.equal(actor.rotation.z,.02);assert.equal(jaw.rotation.x,.11);
  triggerAttack(rig);animateAttack(rig,.1,0,{reducedMotion:true});assert.equal(actor.rotation.x,.1);resetAttack(rig);assert.equal(rig.active,false);
  geo.dispose();mesh.material.dispose();
});
