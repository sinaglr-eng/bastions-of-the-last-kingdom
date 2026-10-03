import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createChampionAura,animateChampionAura,disposeChampionAura} from '../game/render/champion-aura.js';
import {championClassification} from '../game/render/champion-classification.js';

test('Archangel has a gold divine aura around its taller figure while other Advanced champions retain their classification appearance',()=>{
 const before=readFileSync(new URL('../data/towers.json',import.meta.url)),divine=createChampionAura('archangel'),ordinary=createChampionAura('highking');
 try{
  assert.equal(championClassification('archangel'),'Advanced');assert.equal(divine.userData.classification,'Advanced');
  const gold=new THREE.Color('#ffe5a3');assert.equal(divine.userData.ground.material.uniforms.tint.value.getHex(),gold.getHex());
  for(const ring of divine.userData.rings)assert.equal(ring.material.color.getHex(),gold.getHex());
  assert.ok(divine.userData.wisps[0].geometry.boundingSphere.radius>ordinary.userData.wisps[0].geometry.boundingSphere.radius*1.5,'divine light reaches around the upper body');
  assert.equal(ordinary.userData.ground.material.uniforms.tint.value.getHex(),new THREE.Color('#9555d8').getHex());
  animateChampionAura(divine,3,{reducedMotion:true});const positions=Array.from(divine.userData.particles.geometry.attributes.position.array);
  animateChampionAura(divine,300,{reducedMotion:true});assert.deepEqual(Array.from(divine.userData.particles.geometry.attributes.position.array),positions);
  assert.deepEqual(readFileSync(new URL('../data/towers.json',import.meta.url)),before,'the requested appearance change does not change abilities or damage');
 }finally{disposeChampionAura(divine);disposeChampionAura(ordinary);}
});
