import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {campaignEnemies,campaignWaves,campaignTowers} from '../game/core/campaign-roster.js';
import {atelierEnemyRoster,atelierSelection,atelierSelectionQuery,atelierEnemyProperties} from '../game/core/atelier-roster.js';
import {scaleBattlefieldUnit,BATTLEFIELD_UNIT_SCALE,animateBattlefieldIdleScale} from '../game/render/battlefield-scale.js';
const data=Object.fromEntries(['enemies','waves','towers'].map(id=>[id,JSON.parse(readFileSync(new URL(`../data/${id}.json`,import.meta.url)))]));
const towers=campaignTowers(data.towers),rows=atelierEnemyRoster(campaignEnemies(data.enemies),campaignWaves(data.waves)),enemies=Object.fromEntries(rows.map(row=>[row.id,row]));

test('Atelier includes each of the 50 actual campaign visuals once, in wave order, with the hostile final boss',()=>{
  assert.equal(rows.length,50);assert.equal(new Set(rows.map(row=>row.id)).size,50);
  assert.deepEqual(rows.map(row=>row.wave),Array.from({length:50},(_,i)=>i+1));
  assert.equal(rows[49].id,'host_50');assert.match(rows[49].name,/Lord Bernhard/);assert.equal(rows[49].flying,true);assert.equal(rows[49].boss,true);
  const manifest=JSON.parse(readFileSync(new URL('../public/assets/geometric/geometric-enemies.json',import.meta.url)));
  assert.deepEqual(new Set(rows.map(row=>row.id)),new Set(manifest.entries.map(row=>row.id)));
  assert.ok(!rows.some(row=>row.id==='lordbernhard'));
});

test('gallery URLs preserve the exact defender rank or enemy for subsequent appearance comments',()=>{
  for(const selection of [{roster:'defenders',id:'archer',tier:6},{roster:'defenders',id:'ladyclaire',tier:1},{roster:'enemies',id:'host_33',tier:1},{roster:'enemies',id:'host_50',tier:1}])assert.deepEqual(atelierSelection(atelierSelectionQuery(selection),towers,enemies),selection);
  assert.deepEqual(atelierSelection('?family=archer',towers,enemies),{roster:'defenders',id:'archer',tier:1});
  assert.deepEqual(atelierSelection('?roster=enemies&enemy=unknown',towers,enemies),{roster:'enemies',id:'host_01',tier:1});
  assert.equal(atelierSelection('?family=archer&tier=999',towers,enemies).tier,6);
});

test('battlefield reduction applies once to private actors while preserving source geometry, position, aim and platform height',()=>{
  const template=new THREE.Group();template.scale.set(1,.9,1.1);
  const actor=template.clone(),peer=template.clone(),platform=new THREE.Group();platform.position.y=.7;platform.add(actor);actor.rotation.y=1.3;actor.position.y=.4;
  const source=template.scale.clone(),position=actor.position.clone(),rotation=actor.quaternion.clone();
  scaleBattlefieldUnit(actor);scaleBattlefieldUnit(actor);
  assert.ok(actor.scale.distanceTo(source.clone().multiplyScalar(BATTLEFIELD_UNIT_SCALE))<1e-12);
  for(const stretch of [.018,-.018,.01,0])animateBattlefieldIdleScale(actor,stretch);
  assert.ok(actor.scale.distanceTo(source.clone().multiplyScalar(BATTLEFIELD_UNIT_SCALE))<1e-12);
  assert.deepEqual(template.scale,source);assert.deepEqual(peer.scale,source);assert.deepEqual(actor.position,position);assert.ok(actor.quaternion.equals(rotation));assert.equal(platform.position.y,.7);
});

test('Atelier describes actual cloak/disarm and reactive armor rather than claiming no abilities',()=>{
  assert.deepEqual(atelierEnemyProperties(enemies.host_38),['Maskování','Odzbrojení']);
  assert.ok(atelierEnemyProperties(enemies.host_24).includes('Reaktivní zbroj'));
  assert.deepEqual(atelierEnemyProperties({cloakDaggers:true,stealth:true,recharge:.12,hasteAura:1.18,evasion:.25}),['Maskování','Obnova zdraví','Zrychlení spojenců','Úhyb: 25 %']);
  assert.deepEqual(atelierEnemyProperties(enemies.host_01),[]);
});
