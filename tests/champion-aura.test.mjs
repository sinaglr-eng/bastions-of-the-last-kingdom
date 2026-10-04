import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CHAMPION_CLASSIFICATIONS,championClassification,championAuraLevel} from '../game/render/champion-classification.js';
import {CHAMPION_AURA_COLORS,CHAMPION_AURA_STYLE,SECRET_CHAMPION_AURA_STYLE,DIVINE_CHAMPION_AURA_STYLE,CHAMPION_AURA_TIERS,createChampionAura,animateChampionAura,disposeChampionAura} from '../game/render/champion-aura.js';
import {towerModel} from '../game/render/models.js';
import {animateSecretChampion} from '../game/render/secret-champions.js';

const examples=Object.fromEntries(['Basic','Intermediate','Advanced','TOP','Secret'].map(classification=>[
  classification,Object.keys(CHAMPION_CLASSIFICATIONS).find(family=>championClassification(family)===classification),
]));
const state=aura=>({
  opacity:aura.userData.ground.material.uniforms.opacity.value,
  rings:aura.userData.rings.map(ring=>[ring.rotation.z,ring.material.opacity]),
  particles:Array.from(aura.userData.particles.geometry.attributes.position.array),
  wisps:aura.userData.wisps.map(wisp=>[...wisp.position.toArray(),...wisp.rotation.toArray().slice(0,3),wisp.scale.y]),
});

test('ordinary basic defenders and unknown families create exactly no champion aura',()=>{
  for(const family of ['soldier','archer','druid','mage','cleric','runebreaker','frostwarden','stormcaller','unknown']){
    assert.equal(createChampionAura(family),null,family);
  }
  animateChampionAura(null,4);disposeChampionAura(null);
});

test('champion class colors use saturated thicker rings without changing bounded size or class hierarchy',()=>{
  let previousGeometry=null,previousAnimation=null;
  assert.deepEqual(CHAMPION_AURA_STYLE,{strength:.64,radius:.92,rings:3,particles:18,wisps:6,height:.94});
  assert.deepEqual(CHAMPION_AURA_COLORS,{Basic:'#247cff',Intermediate:'#24cd63',Advanced:'#a743f5',TOP:'#ffcf36',Secret:'#ffcf36'});
  for(const [classification,level] of [['Basic',0],['Intermediate',1],['Advanced',2],['TOP',3]]){
    const family=examples[classification],aura=createChampionAura(family),tier=aura.userData.tier;
    assert.equal(aura.userData.classification,classification);assert.equal(aura.userData.level,level);
    assert.equal(tier,CHAMPION_AURA_STYLE);assert.equal(CHAMPION_AURA_TIERS[level],tier);
    assert.equal(aura.userData.rings.length,3);assert.equal(aura.userData.wisps.length,6);
    assert.equal(aura.userData.ground.geometry.parameters.width,1.84);
    aura.userData.rings.forEach((ring,i)=>{
      assert.equal(ring.geometry.parameters.innerRadius,.445+i*.15);
      assert.equal(ring.geometry.parameters.outerRadius,.445+i*.15+.033);
      assert.equal(ring.material.blending,THREE.NormalBlending,'Colored rings retain hue instead of washing out to additive white');
    });
    assert.equal(aura.userData.particles.geometry.attributes.position.count,tier.particles);
    const color=new THREE.Color(CHAMPION_AURA_COLORS[classification]);
    assert.equal(aura.userData.ground.material.uniforms.tint.value.getHexString(),color.getHexString());
    for(const ring of aura.userData.rings)assert.equal(ring.material.color.getHexString(),color.getHexString());
    for(const wisp of aura.userData.wisps)assert.equal(wisp.material.uniforms.tint.value.getHexString(),color.getHexString());
    assert.equal(aura.userData.wisps[0].material.uniforms.opacity.value,.64*.88);
    assert.equal(aura.userData.particles.material.uniforms.opacity.value,.83);
    assert.equal(aura.userData.particles.material.uniforms.pointScale.value,.115);
    assert.equal(aura.userData.particles.material.uniforms.minPointSize.value,1.6);
    assert.equal(aura.userData.particles.material.uniforms.maxPointSize.value,8);
    assert.equal(aura.children.length,11,'Bounded render objects for all classifications');
    aura.traverse(object=>{assert.equal(!!object.isLight,false);if(object.material){assert.equal(object.material.depthWrite,false);assert.equal(object.raycast(),undefined);}});
    const geometries=[];aura.traverse(object=>{if(object.geometry)geometries.push(Array.from(object.geometry.attributes.position.array));});
    animateChampionAura(aura,7.25);const animated=state(aura);
    if(previousGeometry){assert.deepEqual(geometries,previousGeometry);assert.deepEqual(animated,previousAnimation);}
    previousGeometry=geometries;previousAnimation=animated;disposeChampionAura(aura);
  }
});

test('both Secret champions have visibly stronger gold ground, rings, wisps and motes with bounded private resources',()=>{
  const ordinary=createChampionAura(examples.TOP),secrets=['ladyclaire','lordbernhard'].map(family=>createChampionAura(family));
  try{
    for(const aura of secrets){
      const d=aura.userData,base=ordinary.userData;
      assert.equal(d.tier,SECRET_CHAMPION_AURA_STYLE);assert.equal(CHAMPION_AURA_TIERS[4],d.tier);
      assert.equal(d.color,CHAMPION_AURA_COLORS.TOP);
      assert.ok(d.ground.material.uniforms.opacity.value>base.ground.material.uniforms.opacity.value*1.4);
      assert.ok(d.ground.geometry.parameters.width>base.ground.geometry.parameters.width);
      assert.ok(d.rings[0].material.opacity>base.rings[0].material.opacity);
      assert.ok(d.wisps[0].material.uniforms.opacity.value>base.wisps[0].material.uniforms.opacity.value*1.4);
      assert.ok(d.wisps[0].geometry.boundingSphere.radius>base.wisps[0].geometry.boundingSphere.radius);
      for(const uniform of ['opacity','pointScale','minPointSize','maxPointSize'])assert.ok(d.particles.material.uniforms[uniform].value>base.particles.material.uniforms[uniform].value);
      assert.equal(d.particles.geometry.attributes.position.count,30);assert.equal(d.rings.length,4);assert.equal(d.wisps.length,8);
      assert.equal(aura.children.length,14);let triangles=0;
      aura.traverse(o=>{assert.equal(!!o.isLight,false);if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;if(o.material){assert.equal(o.material.blending,d.rings.includes(o)?THREE.NormalBlending:THREE.AdditiveBlending);assert.equal(o.material.depthWrite,false);assert.equal(o.raycast(),undefined);}});
      assert.ok(triangles<500,'The brighter style uses a small local mesh budget');
    }
    const resources=aura=>{const found=new Set();aura.traverse(o=>{if(o.geometry)found.add(o.geometry);if(o.material)found.add(o.material);});return found;};
    const first=resources(secrets[0]);for(const resource of resources(secrets[1]))assert.ok(!first.has(resource),'Both champions own their aura resources');
    assert.deepEqual(state(secrets[0]),state(secrets[1]));
  }finally{disposeChampionAura(ordinary);secrets.forEach(disposeChampionAura);}
});

test('all 39 champions keep their family classification independent of ascension',()=>{
  assert.equal(Object.keys(CHAMPION_CLASSIFICATIONS).length,39);
  for(const family of Object.keys(CHAMPION_CLASSIFICATIONS)){
    const classification=championClassification(family),level=championAuraLevel(family);
    for(const rank of [1,2,6,14]){
      const aura=createChampionAura(family,{phase:rank});
      assert.ok(aura,`${family} has its classification aura at rank ${rank}`);
      assert.equal(aura.userData.classification,classification);
      assert.equal(aura.userData.level,level);assert.equal(aura.userData.tier,family==='archangel'?DIVINE_CHAMPION_AURA_STYLE:classification==='Secret'?SECRET_CHAMPION_AURA_STYLE:CHAMPION_AURA_STYLE);disposeChampionAura(aura);
    }
  }
});

test('animation stays finite and reduced motion freezes the complete visual aura',()=>{
  for(const classification of ['Basic','Intermediate','Advanced','TOP','Secret']){
    const aura=createChampionAura(examples[classification],{phase:7.1});
    const first=state(aura);animateChampionAura(aura,9);assert.notDeepEqual(state(aura),first);
    for(const time of [0,-40,100000,NaN,Infinity,Number.MAX_VALUE]){
      animateChampionAura(aura,time);
      aura.traverse(object=>{
        for(const value of [...object.position.toArray(),...object.scale.toArray(),...object.rotation.toArray().slice(0,3)])assert.ok(Number.isFinite(value));
        if(object.geometry)for(const value of object.geometry.attributes.position.array)assert.ok(Number.isFinite(value));
      });
      assert.ok(Number.isFinite(aura.userData.ground.material.uniforms.opacity.value));
      assert.ok(aura.userData.ground.material.uniforms.opacity.value<=1);
      assert.ok(aura.userData.rings.every(ring=>ring.material.opacity>0&&ring.material.opacity<=1));
    }
    animateChampionAura(aura,3,{reducedMotion:true});const still=state(aura);
    animateChampionAura(aura,300,{reducedMotion:true});assert.deepEqual(state(aura),still);
    disposeChampionAura(aura);
  }
});

test('removal releases each generated material and geometry exactly once',()=>{
  for(const family of [examples.TOP,'ladyclaire','lordbernhard','archangel']){
  const aura=createChampionAura(family),parent=new THREE.Group();parent.add(aura);
  const resources=new Set(),disposed=new Map();
  aura.traverse(object=>{if(object.geometry)resources.add(object.geometry);if(object.material)resources.add(object.material);});
  for(const resource of resources){disposed.set(resource,0);resource.addEventListener('dispose',()=>disposed.set(resource,disposed.get(resource)+1));}
  disposeChampionAura(aura);assert.equal(parent.children.length,0);assert.equal(aura.userData.disposed,true);
  for(const count of disposed.values())assert.equal(count,1);
  const settled=state(aura);animateChampionAura(aura,100);assert.deepEqual(state(aura),settled);
  disposeChampionAura(aura);for(const count of disposed.values())assert.equal(count,1);
  }
});

test('Secret fallback figures retain the corrected gown, adult eyes, closed helmet and seated horse rig before native assets arrive',()=>{
  const claire=towerModel('ladyclaire',1,true),bernhard=towerModel('lordbernhard',1,true),models=[claire,bernhard];
  const meshes=model=>{const found=[];model.traverse(o=>{if(o.isMesh)found.push(o);});return found;};
  const colors=model=>new Set(meshes(model).map(o=>o.material.color.getHexString()));
  try{
    assert.ok(colors(claire).has('f3e4c8')&&colors(claire).has('dfca9f'),'The gown is ivory and champagne');
    assert.ok(!colors(claire).has('5b81b7')&&!colors(claire).has('dbe8f0'),'The older blue cloth is absent');
    const eyes=meshes(claire).find(o=>o.material.color.getHexString()==='fbf6e4');
    const eyeBounds=new THREE.Box3().setFromObject(eyes);assert.ok(eyeBounds.getSize(new THREE.Vector3()).x<.15&&eyeBounds.getSize(new THREE.Vector3()).y<.035,'Adult eyes have a small, restrained proportion');
    const hair=meshes(claire).find(o=>o.material.color.getHexString()==='ddc07b'),hairBounds=new THREE.Box3().setFromObject(hair);
    assert.ok(hairBounds.min.y<1.15&&hairBounds.max.y>1.6,'Continuous blonde hair reaches below the temples');
    const orbs=[0,1,2].map(i=>claire.getObjectByName(`secret_orb_${i}`));assert.ok(orbs.every(Boolean));
    animateSecretChampion(claire,0);const orbPose=orbs.map(o=>o.position.toArray());animateSecretChampion(claire,2);assert.notDeepEqual(orbs.map(o=>o.position.toArray()),orbPose);
    animateSecretChampion(claire,3,{reducedMotion:true});const still=orbs.map(o=>o.position.toArray());animateSecretChampion(claire,30,{reducedMotion:true});assert.deepEqual(orbs.map(o=>o.position.toArray()),still);
    assert.ok(!colors(bernhard).has('edc5a4'),'The rider has a closed helmet with no exposed human face');
    assert.ok(colors(bernhard).has('f2f0e6')&&colors(bernhard).has('efc65f'),'The mount is white with gold accessories');
    for(const mesh of meshes(bernhard)){const c=mesh.material.color;assert.ok(c.b<=Math.max(c.r,c.g)*1.16,'No blue accessories are added');}
    const legs=[0,1,2,3].map(i=>bernhard.getObjectByName(`leg_horse_${i}`));assert.ok(legs.every(Boolean));
    animateSecretChampion(bernhard,0);animateSecretChampion(bernhard,2);assert.ok(legs.some(o=>Math.abs(o.rotation.x)>.001));
    assert.equal(legs[0].userData.gaitPhase,legs[3].userData.gaitPhase);assert.equal(legs[1].userData.gaitPhase,legs[2].userData.gaitPhase);
    for(const model of models){let triangles=0;for(const o of meshes(model))triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;assert.ok(triangles<12000);const b=new THREE.Box3().setFromObject(model);assert.ok(b.min.y>=0&&b.max.y<2.6);}
  }finally{for(const model of models){const geometries=new Set(meshes(model).map(o=>o.geometry));geometries.forEach(g=>g.dispose());}}
});
