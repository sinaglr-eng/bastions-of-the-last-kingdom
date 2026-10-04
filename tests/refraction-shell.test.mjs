import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {EnemyAbilityEffects} from '../game/render/geometric-enemy-effects.js';

test('three-hit protection envelops the measured unit, loses a sector each hit and shatters on depletion',()=>{
 const scene=new THREE.Scene(),fx=new EnemyAbilityEffects(scene),figure=new THREE.Group();
 const body=new THREE.Mesh(new THREE.BoxGeometry(.8,2.4,1.3),new THREE.MeshBasicMaterial());body.position.y=1.2;figure.add(body);figure.userData.body=body;figure.position.set(4,.3,7);figure.scale.setScalar(.7);
 const enemy={id:1,x:4,z:7,refraction:3,shields:3,statuses:{}},before=body.geometry.attributes.position.array.slice(),figures=new Map([[1,figure]]);
 fx.sync([enemy],figures,1);const batch=fx.batches.get('refraction'),matrix=new THREE.Matrix4();assert.equal(batch.shell.count,3);
 batch.shell.getMatrixAt(0,matrix);const shellSize=new THREE.Vector3().setFromMatrixScale(matrix);assert.ok(shellSize.y*2>2.4*.7);assert.ok(shellSize.x*2>.8*.7);assert.ok(shellSize.z*2>1.3*.7);
 assert.ok(batch.shell.material.opacity>0&&batch.shell.material.opacity<.3);assert.equal(batch.shell.material.depthTest,true);const shared=batch.shell.geometry;
 for(const remaining of [2,1,0]){
  enemy.shields=remaining;fx.event('deflect',{enemy});fx.sync([enemy],figures,2);
  assert.equal(batch.shell.count,remaining);assert.equal(batch.crystals.count,remaining);assert.equal(batch.shell.geometry,shared);
 }
 assert.ok(fx.effects.some(effect=>effect.object.name==='Magical shield breaks after its final blocked hit'));
 const frozen=fx.effects.map(effect=>effect.elapsed);fx.update(0);assert.deepEqual(fx.effects.map(effect=>effect.elapsed),frozen,'combat pause does not expire the break effect');
 fx.update(.51);assert.equal(fx.effects.length,0);assert.equal(batch.shell.count,0);
 enemy.shields=3;fx.sync([enemy],figures,9);assert.equal(batch.shell.count,3,'actual charge refresh restores all sectors');
 figure.visible=false;fx.sync([enemy],figures,10);assert.equal(batch.shell.count,0,'a shield cannot reveal a concealed model');
 assert.deepEqual(body.geometry.attributes.position.array,before);fx.dispose();fx.dispose();body.geometry.dispose();body.material.dispose();assert.equal(scene.children.length,0);
});

test('shield veil stays animated on cosmetic time and obeys reduced motion without changing charges',()=>{
 const scene=new THREE.Scene(),enemy={id:1,x:0,z:0,refraction:3,shields:3,statuses:{}},fx=new EnemyAbilityEffects(scene);
 fx.sync([enemy],new Map(),1);const shell=fx.batches.get('refraction').shell,first=Array.from(shell.instanceMatrix.array);
 fx.sync([enemy],new Map(),2);assert.notDeepEqual(Array.from(shell.instanceMatrix.array),first);assert.equal(enemy.shields,3);
 fx.reducedMotion=true;fx.sync([enemy],new Map(),3);const steady=Array.from(shell.instanceMatrix.array);fx.sync([enemy],new Map(),900);assert.deepEqual(Array.from(shell.instanceMatrix.array),steady);
 let released=0;for(const resource of [shell,shell.geometry,shell.material])resource.addEventListener('dispose',()=>released++);
 enemy.dead=true;fx.sync([enemy],new Map(),901);assert.equal(shell.count,0);assert.equal(fx.shieldBounds.size,0);fx.dispose();assert.equal(released,3);
});
