import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CHAMPIONS} from '../game/render/champion-catalog.js';
import {CHAMPION_CLASSIFICATIONS,championClassification,championAuraLevel} from '../game/render/champion-classification.js';
import {CHAMPION_AURA_TIERS,createChampionAura,animateChampionAura,disposeChampionAura} from '../game/render/champion-aura.js';

const examples=Object.fromEntries(['Basic','Intermediate','Advanced','TOP'].map(classification=>[
  classification,Object.keys(CHAMPION_CLASSIFICATIONS).find(family=>championClassification(family)===classification),
]));
const state=aura=>({
  opacity:aura.userData.ground.material.uniforms.opacity.value,
  rings:aura.userData.rings.map(ring=>[ring.rotation.z,ring.material.opacity]),
  particles:Array.from(aura.userData.particles.geometry.attributes.position.array),
  wisps:aura.userData.wisps.map(wisp=>[...wisp.position.toArray(),...wisp.rotation.toArray().slice(0,3),wisp.scale.y]),
});

test('Basic champions and basic defenders create exactly no classification aura',()=>{
  for(const [family,classification] of Object.entries(CHAMPION_CLASSIFICATIONS)){
    if(classification==='Basic'){assert.equal(championAuraLevel(family),0);assert.equal(createChampionAura(family),null);}
  }
  for(const family of ['soldier','archer','druid','mage','cleric','runebreaker','frostwarden','stormcaller','unknown']){
    assert.equal(createChampionAura(family),null,family);
  }
  animateChampionAura(null,4);disposeChampionAura(null);
});

test('Intermediate, Advanced and TOP have visibly increasing cosmetic intensity',()=>{
  let previous=CHAMPION_AURA_TIERS[0];
  for(const [classification,level] of [['Intermediate',1],['Advanced',2],['TOP',3]]){
    const family=examples[classification],aura=createChampionAura(family),tier=aura.userData.tier;
    assert.equal(aura.userData.classification,classification);assert.equal(aura.userData.level,level);
    assert.ok(tier.strength>previous.strength);assert.ok(tier.radius>previous.radius);
    assert.ok(tier.particles>previous.particles);assert.ok(tier.height>previous.height);
    assert.equal(aura.userData.rings.length,level);assert.equal(aura.userData.wisps.length,tier.wisps);
    assert.equal(aura.userData.particles.geometry.attributes.position.count,tier.particles);
    assert.equal(aura.userData.ground.material.uniforms.tint.value.getHexString(),new THREE.Color(CHAMPIONS[family].accent).getHexString());
    assert.ok(aura.children.length<=11,'Few render objects even for TOP');
    aura.traverse(object=>{assert.equal(!!object.isLight,false);if(object.material){assert.equal(object.material.depthWrite,false);assert.equal(object.raycast(),undefined);}});
    disposeChampionAura(aura);previous=tier;
  }
});

test('all 37 champions keep their family classification independent of ascension',()=>{
  assert.equal(Object.keys(CHAMPION_CLASSIFICATIONS).length,37);
  for(const family of Object.keys(CHAMPION_CLASSIFICATIONS)){
    const classification=championClassification(family),level=championAuraLevel(family);
    for(const rank of [1,2,6,14]){
      const aura=createChampionAura(family,{phase:rank});
      assert.equal(aura?.userData.classification||'Basic',classification);
      assert.equal(aura?.userData.level||0,level);disposeChampionAura(aura);
    }
  }
});

test('animation stays finite and reduced motion freezes the complete visual aura',()=>{
  for(const classification of ['Intermediate','Advanced','TOP']){
    const aura=createChampionAura(examples[classification],{phase:7.1});
    const first=state(aura);animateChampionAura(aura,9);assert.notDeepEqual(state(aura),first);
    for(const time of [0,-40,100000,NaN,Infinity,Number.MAX_VALUE]){
      animateChampionAura(aura,time);
      aura.traverse(object=>{
        for(const value of [...object.position.toArray(),...object.scale.toArray(),...object.rotation.toArray().slice(0,3)])assert.ok(Number.isFinite(value));
        if(object.geometry)for(const value of object.geometry.attributes.position.array)assert.ok(Number.isFinite(value));
      });
      assert.ok(Number.isFinite(aura.userData.ground.material.uniforms.opacity.value));
    }
    animateChampionAura(aura,3,{reducedMotion:true});const still=state(aura);
    animateChampionAura(aura,300,{reducedMotion:true});assert.deepEqual(state(aura),still);
    disposeChampionAura(aura);
  }
});

test('removal releases each generated material and geometry exactly once',()=>{
  const aura=createChampionAura(examples.TOP),parent=new THREE.Group();parent.add(aura);
  const resources=new Set(),disposed=new Map();
  aura.traverse(object=>{if(object.geometry)resources.add(object.geometry);if(object.material)resources.add(object.material);});
  for(const resource of resources){disposed.set(resource,0);resource.addEventListener('dispose',()=>disposed.set(resource,disposed.get(resource)+1));}
  disposeChampionAura(aura);assert.equal(parent.children.length,0);assert.equal(aura.userData.disposed,true);
  for(const count of disposed.values())assert.equal(count,1);
  const settled=state(aura);animateChampionAura(aura,100);assert.deepEqual(state(aura),settled);
  disposeChampionAura(aura);for(const count of disposed.values())assert.equal(count,1);
});
