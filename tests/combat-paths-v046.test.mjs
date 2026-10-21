import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CombatEffects,attackVisualKind} from '../game/render/combat-effects.js';
import {EnemyModelLoader} from '../game/render/enemy-model-loader.js';

test('coarse combat steps do not consume pre-creation time of actual links, impacts or overflow branches',()=>{
  let clock=0;const fx=new CombatEffects(new THREE.Scene(),{getSimulationTime:()=>clock,maxEffects:1});
  clock=.3;const from={id:1,x:0,z:0},to={id:2,x:2,z:1},packet={from,to,effect:'lightning',visible:true};
  fx.chain(packet);fx.chain({...packet,to:{id:3,x:4,z:1}});fx.syncProjectiles([],.3);fx.update(.3,.3);
  assert.equal(fx.effects.length,1);assert.equal(fx.effects[0].elapsed,0);assert.equal(fx.paths.records.length,1);
  assert.deepEqual(fx.paths.records[0].from.toArray(),[0,1,0]);assert.deepEqual(fx.paths.records[0].to.toArray(),[4,1,1]);
  clock=.4;fx.syncProjectiles([],.4);fx.update(.1,.4);assert.ok(fx.effects[0].elapsed<.11);
  const positions=Array.from(fx.effects[0].object.geometry.attributes.position.array);fx.update(0,999);assert.deepEqual(Array.from(fx.effects[0].object.geometry.attributes.position.array),positions);
  clock=.6;fx.syncProjectiles([],.6);fx.update(.2,.6);assert.equal(fx.effects.length,0);assert.equal(fx.paths.records.length,0);fx.dispose();
});

test('actual frost bounce remains a bead, forks keep source origin, and concealed endpoints clear paths',()=>{
  const fx=new CombatEffects(new THREE.Scene(),{isVisible:e=>!e.hidden}),a={id:2,x:1,z:1},b={id:3,x:3,z:1};
  fx.chain({from:a,to:b,effect:'frost'});assert.equal(fx.effects[0].object.isLine,undefined);assert.match(fx.effects[0].object.name,/frost/);
  fx.chain({from:{id:1,family:'thunderheart',x:0,z:0},to:b,effect:'lightning'});assert.equal(fx.effects[1].object.name,'Actual source fork branch');
  a.hidden=true;fx.update(0,0);assert.equal(fx.effects.length,1);fx.dispose();
});

test('detailed capacity preserves a lightweight path for each real overflow shot without inventing targets',()=>{
  const fx=new CombatEffects(new THREE.Scene(),{maxDetailed:2,maxProjectiles:2}),shots=Array.from({length:6},(_,id)=>({id,source:{id:20,family:'archer',x:0,z:0},target:{id:id+30,x:id+1,z:2},stats:{type:'physical'},progress:.5}));
  const before=structuredClone(shots);fx.syncProjectiles(shots,0);assert.equal(fx.projectiles.size,2);assert.equal(fx.paths.records.length,4);assert.deepEqual(shots,before);
  fx.clear();assert.equal(fx.paths.records.length,0);fx.dispose();
});

test('caster lightning and the Elven King keep their requested visual mechanisms independently of siege classification',()=>{
  for(const family of ['tempest','stormcitadel'])assert.equal(attackVisualKind(family,{unitKind:'siege'}),'lightning');
  assert.equal(attackVisualKind('royalarsenal',{unitKind:'siege'}),'arcane');
  const fx=new CombatEffects(new THREE.Scene());
  for(let tier=1;tier<=6;tier++){const shot={id:tier,source:{id:tier,family:'soldier',tier,x:0,z:0},target:{id:20,x:1,z:1},stats:{melee:true,type:'physical'},progress:.5};assert.equal(fx.shot(shot).kind,'thrust');}
  fx.dispose();
});

test('enemy loading decodes only requested identities with bounded concurrency, safe eviction and late-disposal ownership',async()=>{
  const pending=new Map(),installed=[],released=[];let active=0,peak=0;
  const loader=new EnemyModelLoader({load:entry=>new Promise(resolve=>{active++;peak=Math.max(peak,active);pending.set(entry.id,()=>{active--;resolve({id:entry.id});});}),install:(entry)=>{installed.push(entry.id);return true;},release:(key)=>released.push(key),cacheSize:1,concurrency:2,protectedKeys:()=>new Set(['b'])});
  loader.index(['a','b','c','d'].map(id=>({id})));loader.request(['a','b','c']);await new Promise(r=>setImmediate(r));assert.equal(pending.size,2);
  pending.get('a')();pending.get('b')();await new Promise(r=>setImmediate(r));pending.get('c')();await new Promise(r=>setImmediate(r));
  assert.equal(peak,2);assert.deepEqual(installed,['a','b','c']);assert.equal(installed.includes('d'),false);assert.deepEqual([...loader.loaded.keys()],['b']);
  loader.request(['d']);await new Promise(r=>setImmediate(r));loader.dispose();pending.get('d')();await new Promise(r=>setImmediate(r));assert.ok(released.includes('d'));assert.equal(installed.includes('d'),false);
});
