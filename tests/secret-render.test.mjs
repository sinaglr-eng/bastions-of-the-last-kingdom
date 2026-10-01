import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {animateSecretChampion} from '../game/render/secret-champions.js';
import {createChampionAura,disposeChampionAura} from '../game/render/champion-aura.js';
import {towerSupportState} from '../game/render/support-effects.js';
import {supportEffectsMarkup} from '../ui/support-guide.js';
const data=Object.fromEntries(['balance','towers'].map(name=>[name,JSON.parse(readFileSync(new URL(`../data/${name}.json`,import.meta.url)))]));
async function model(family){const b=readFileSync(new URL(`../public/assets/models/advanced_${family}.glb`,import.meta.url));return(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;}
const pose=root=>{const states=[];root.updateMatrixWorld(true);root.traverse(n=>{if(n.isMesh)states.push([...n.matrixWorld.elements]);});return states;};

test('three native Claire orbs orbit the body independently; motion never moves the template or another imported clone',async()=>{
 const source=await model('ladyclaire'),actor=source.clone(true),other=source.clone(true),original=pose(source),untouched=pose(other);
 const orbs=[0,1,2].map(i=>actor.getObjectByName(`secret_orb_${i}`));assert.ok(orbs.every(Boolean));
 const originalOrbs=orbs.map(n=>[n.position.clone(),n.rotation.clone(),n.scale.clone()]);
 animateSecretChampion(actor,1);const first=pose(actor);animateSecretChampion(actor,1.2);assert.notDeepEqual(pose(actor),first);
 const restBody=actor.getObjectByName('head_pivot');assert.ok(restBody);assert.ok(Math.abs(restBody.rotation.x-source.getObjectByName('head_pivot').rotation.x)<1e-9);
 for(const orb of orbs)assert.ok(Math.abs(Math.hypot(orb.position.x,orb.position.z)-.46)<1e-7);
 assert.deepEqual(pose(source),original);assert.deepEqual(pose(other),untouched);
 animateSecretChampion(actor,7,{reducedMotion:true});orbs.forEach((n,i)=>{assert.deepEqual(n.position.toArray(),originalOrbs[i][0].toArray());assert.deepEqual(n.rotation.toArray(),originalOrbs[i][1].toArray());assert.deepEqual(n.scale.toArray(),originalOrbs[i][2].toArray());});
 const still=pose(actor);animateSecretChampion(actor,100,{reducedMotion:true});assert.deepEqual(pose(actor),still);
});
test('the white horse shifts its weight with the authored diagonal phases and both secrets have gold auras',async()=>{
 const source=await model('lordbernhard'),actor=source.clone(true),original=pose(source),legs=[];actor.traverse(n=>{if(n.name.startsWith('leg_horse_'))legs.push(n);});assert.equal(legs.length,4);
 animateSecretChampion(actor,2);assert.notDeepEqual(pose(actor),original);
 for(const a of legs)for(const b of legs)if(a.userData.gaitPhase===b.userData.gaitPhase)assert.equal(a.rotation.x,b.rotation.x);
 assert.deepEqual(pose(source),original);animateSecretChampion(actor,8,{reducedMotion:true});assert.deepEqual(pose(actor),original);
 for(const family of ['ladyclaire','lordbernhard']){const aura=createChampionAura(family);assert.equal(aura.userData.classification,'Secret');assert.equal(aura.userData.color,'#ffd969');disposeChampionAura(aura);}
});
test('Melancholy has its own moon, actual combat-time countdown and disappears exactly at recovery or outside combat',()=>{
 const claire={id:1,family:'ladyclaire',tier:1,state:'active',x:10,z:10,melancholyUntil:10},combat={elapsed:7.5,enemies:[]};
 const state=towerSupportState(claire,[claire],data,{combat,phase:'combat'});
 assert.equal(state.byKey.melancholy.value,2.5);assert.equal(state.byKey.melancholy.glyph,'moon');assert.deepEqual(state.byKey.melancholy.sourceIds,[1]);
 const html=supportEffectsMarkup(claire,[claire],data,{combat,phase:'combat'});assert.match(html,/data-effect="melancholy"/);assert.match(html,/2.5s remaining/);assert.match(html,/class="negative"/);
 combat.elapsed=10;assert.equal(towerSupportState(claire,[claire],data,{combat,phase:'combat'}).byKey.melancholy,undefined);
 combat.elapsed=7.5;assert.equal(towerSupportState(claire,[claire],data,{combat,phase:'ready'}).byKey.melancholy,undefined);
});
