import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {authoredWeaponPhase} from '../game/render/faction-attack-visuals.js';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {createFactionData} from '../game/core/factions.js';
import {towerStats,supportBonuses} from '../game/core/math.js';
import {championClassification} from '../game/render/champion-classification.js';
import {attachChampionAura,CHAMPION_AURA_COLORS,disposeChampionAura} from '../game/render/champion-aura.js';
import {applyDefenderClassificationScale} from '../game/render/defender-classification-scale.js';
import {CombatEffects,attackVisualKind} from '../game/render/combat-effects.js';
import {installDefenderTemplate,cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {attackRig,attackMuzzle,triggerAttack,disposeAttack} from '../game/render/battle-animation.js';
import {SupportEffects,towerSupportState} from '../game/render/support-effects.js';
const read=f=>JSON.parse(fs.readFileSync(new URL('../'+f,import.meta.url))),registry=read('data/factions-v060.json');
const raw=Object.fromEntries(['balance','towers','recipes','waves','enemies'].map(k=>[k,read('data/'+k+'.json')]));
const current={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
const datasets=Object.fromEntries(['crown','forge','grove'].map(id=>[id,createFactionData(current,registry,id)]));
const canonical=c=>({BASIC:'Basic',INTERMEDIATE:'Intermediate',ADVANCED:'Advanced',TOP:'TOP',SECRET:'Secret'}[c.toUpperCase()]);
test('every faction champion uses the same canonical classification and saturated color; basic recruits have none',()=>{
 for(const f of registry.factions)for(const u of f.units){const actor=new THREE.Group();actor.userData.factionAttackEntry={factionId:f.id};applyDefenderClassificationScale(actor,u.id);const aura=attachChampionAura(actor,u.id);
  if(u.kind==='basic'){assert.equal(aura,null);continue;}
  assert.equal(championClassification(u.id),canonical(u.classification));assert.equal(aura.userData.classification,canonical(u.classification));
  assert.equal(aura.userData.color,u.id==='archangel'?'#ffe5a3':CHAMPION_AURA_COLORS[canonical(u.classification)]);
  for(const r of aura.userData.rings)assert.equal(r.material.color.getHexString(),aura.userData.color.slice(1));
  const size=aura.userData.rings[0].geometry.boundingSphere||aura.userData.rings[0].geometry.computeBoundingSphere();actor.updateMatrixWorld(true);
  const scale=aura.getWorldScale(new THREE.Vector3()).x;assert.ok(Math.abs(scale-1.1**aura.userData.level)<1e-6||f.id==='crown','Dwarf enlargement does not enlarge its classification aura');disposeChampionAura(aura);
 }
});
test('all 258 profiles expose finite weapon-specific VFX, while every actual external support bonus has a visible attributed glyph',()=>{
 const seen=new Set();for(const f of registry.factions){const d=datasets[f.id],basic=Object.keys(d.towers).find(k=>!d.towers[k].advanced);
  for(const entry of f.assets){const t={id:1,family:entry.family,tier:entry.tier,state:'active',x:10,z:10};const s=towerStats(t,d),kind=attackVisualKind(t.family,s);assert.ok(kind);seen.add(kind);
   const source={...t,id:2},target={id:1,family:basic,tier:1,state:'active',x:11,z:10};const state=towerSupportState(target,[target,source],d);assert.deepEqual(state.bonuses,supportBonuses(target,[target,source],d));
   for(const e of state.effects){assert.ok(e.sources.some(x=>x.id===source.id)||e.sources.some(x=>x.id===target.id));}
   if(s.aura){const fx=new SupportEffects(new THREE.Scene());fx.sync([target,source],d);for(const e of state.effects){const batch=fx.batches.get(e.key);assert.ok(batch.visible&&batch.count>0);assert.ok(batch.material.opacity>.7);assert.ok(batch.geometry.boundingSphere||batch.geometry.attributes.position.count>0);}fx.dispose();}
  }
 }
 for(const kind of ['bullet','bulletRapid','cannon','shell','grenade','axe','pick','drum','web','treeSlam','stormSpear','moon','flame'])assert.ok(seen.has(kind),kind);
});
test('actual native weapon surfaces follow posed bones for rifles, cannon, barrels, bows, spell hands, fangs, trees and dragons',async()=>{
 const examples=['dw_musketeer','dw_ironstorm','dw_repeatercrew','dw_cinderhowitzer','dw_grapeshotcart','dw_flamewarden','dw_emberanvil','dw_bombardking','el_baby_fire_dragon','el_mother_fire_dragon','el_elven_archmage','el_drow_cinder','el_stormblade_warden','el_spark_adept','el_drow_eclipse_duelist','archer','stormcaller'];
 for(const family of examples){const f=registry.factions.find(f=>f.assets.some(a=>a.family===family)),entry=f.assets.find(a=>a.family===family&&a.tier===1);const b=gunzipSync(fs.readFileSync(new URL('../public/'+entry.packedFile,import.meta.url))),g=await new NativeTestGLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
  const field={imported:new Map(),game:{towers:[]}};installDefenderTemplate(field,entry,g.scene,g.animations);assert.ok(g.scene.userData.factionVfxAnchor, family);const actor=cloneDefenderTemplate(g.scene),stats=towerStats({family,tier:1},datasets[f.id]);const rig=attackRig(actor,family,stats),before=attackMuzzle(rig);
  assert.ok(before?.toArray().every(Number.isFinite));assert.notDeepEqual(before.toArray(),actor.getWorldPosition(new THREE.Vector3()).toArray());
  const nativeBone=actor.getObjectByName(actor.userData.factionVfxAnchor.bone),old=before.clone();nativeBone.position.x+=.125;actor.updateMatrixWorld(true);const shifted=attackMuzzle(rig,new THREE.Vector3());assert.ok(shifted.distanceTo(old)>.01,family+' follows its emitting joint');nativeBone.position.x-=.125;
  if(stats.weaponCycle){assert.equal(rig.faction.state.weaponCycle.reloadSeconds,stats.weaponCycle.reload);}
  disposeAttack(rig);disposeDefenderInstance(actor);
 }
});
test('continuous attacks coalesce per source, remain visible while refreshed, and overflow uses bounded fallback paths',()=>{
 let time=0;const scene=new THREE.Scene(),fx=new CombatEffects(scene,{maxBreaths:2,getSimulationTime:()=>time});const target={id:9,x:4,z:5};
 for(let n=0;n<20;n++){time=n*.02;for(let id=1;id<=4;id++)fx.event('aura-attack',{source:{id,family:'el_baby_fire_dragon',x:id,z:1},target,stats:{type:'magical',continuousAttack:{dps:1}}});fx.update(.02,time);fx.syncProjectiles([],time);}
 assert.equal(fx.effects.filter(e=>e.breath).length,2);assert.equal(fx.channels.size,4);assert.ok(fx.effects.every(e=>e.object.children[0].material.opacity>0));assert.equal(fx.paths.records.length,2);
 fx.clear();assert.equal(fx.channels.size,0);fx.dispose();
});

test('native magazine poses respect current reload values and haste without speeding reload itself',()=>{const authored={weaponCycle:{magazine:3,fixedInterval:.4,reload:2.4}},actual={weaponCycle:{magazine:3,fixedInterval:.4,reload:1.2}};for(const haste of [1,1.5,2]){const firing=1.2/haste,total=firing+1.2;assert.ok(Math.abs(authoredWeaponPhase(actual,authored,firing/total,haste)-1/3)<1e-8);assert.ok(Math.abs(authoredWeaponPhase(actual,authored,(firing+.6)/total,haste)-2/3)<1e-8);}});

test('every real attacking profile constructs finite visible effects, including paired continuous weapons',()=>{for(const f of registry.factions)for(const a of f.assets){const source={id:1,family:a.family,tier:a.tier,state:'active',x:1,z:1},stats=towerStats(source,datasets[f.id]),target={id:2,x:4,z:4},scene=new THREE.Scene(),fx=new CombatEffects(scene);if(stats.damage>0){assert.ok(fx.shot({id:1,source,target,stats,progress:.5}));fx.impact({source,target,stats});}else if(stats.continuousAttack||stats.burnAura){fx.event('aura-attack',{source,target,stats});assert.equal(fx.channels.size,1);}for(const o of scene.children){o.traverse(n=>{for(const v of [...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray()])assert.ok(Number.isFinite(v));if(n.geometry?.attributes.position)for(const v of n.geometry.attributes.position.array)assert.ok(Number.isFinite(v));});}fx.dispose();}});
