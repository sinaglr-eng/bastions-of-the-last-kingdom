import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import * as THREE from 'three';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {recipeFamily,expandRecipeToBasics} from '../game/core/recipes.js';
import {geometricEntries,geometricEntryUrl,loadModelEntries,fetchGeometricEntries} from '../game/render/geometric-assets.js';
import {EnemyAbilityEffects} from '../game/render/geometric-enemy-effects.js';
import {animateDeath,attackRig,animateAttack,disposeAttack} from '../game/render/battle-animation.js';
import {installDefenderTemplate,cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {installEnemyTemplate} from '../game/render/enemy-assets.js';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
import {towerStats} from '../game/core/math.js';

// Browser/Vite JSON imports are loaded as read-only modules in this test process
// so the actual Battlefield methods can run without constructing WebGL or DOM.
const jsonHooks=registerHooks({load(url,context,nextLoad){
  if(url.startsWith('file:')&&url.endsWith('.json'))return {format:'module',source:`export default JSON.parse(${JSON.stringify(readFileSync(new URL(url),'utf8'))});`,shortCircuit:true};
  return nextLoad(url,context);
}});
const {Battlefield}=await import('../game/render/world.js');jsonHooks.deregister();

const historical=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...historical,towers:campaignTowers(historical.towers),recipes:campaignRecipes(historical.recipes),enemies:campaignEnemies(historical.enemies),waves:campaignWaves(historical.waves)};
function fighting(){const game=new Game(data,{seed:42,waveLimit:50});game.phase='combat';game.combat.spawnQueue=[{time:1e6,type:'grunt'}];return game;}
function blinkFixture(game,{stealth=false,petrified=false,freeze=false,clock=.01}={}){
  const enemy=game.combat.spawn('host_33');Object.assign(enemy,{x:20,z:20,route:[{x:20,z:20},{x:20,z:22},{x:23,z:22},{x:23,z:27}],pathIndex:1,pathLength:10,traveled:0,speed:2,blink:4,blinkClock:clock,stealth,cloaked:stealth,statuses:{...(petrified?{petrify:{time:2}}:{}),...(freeze?{freeze:{time:2}}:{})}});return enemy;
}
function corpseField(game){
  const field=Object.create(Battlefield.prototype);Object.assign(field,{game,scene:new THREE.Scene(),enemies:new Map(),enemyTemplates:new Map(),corpses:new Map(),models:new Map(),effects:[],combatEffects:{event(){}},pathGroup:new THREE.Group(),maze:{sync(){}},updateRouteLegend(){},sync(){},burst(){}});
  field.enemyAbilityEffects=new EnemyAbilityEffects(field.scene,{isVisible:e=>game.combat.isRevealed(e)});
  const off=game.on((type,payload)=>field.event(type,payload));return {field,off};
}
function liveFigure(field,enemy){
  const root=new THREE.Group(),body=new THREE.Group(),material=new THREE.MeshBasicMaterial(),mesh=new THREE.Mesh(new THREE.BoxGeometry(.4,1.8,.4),material);mesh.position.y=.9;body.add(mesh);root.add(body);root.userData.body=body;root.userData.ownedMaterials=[material];root.position.set(enemy.x-18,0,enemy.z-18);field.scene.add(root);field.enemies.set(enemy.id,root);return root;
}

test('current campaign has exactly eight basic families and 38 obtainable champions while historical Bernhard remains archived',()=>{
  assert.equal(Object.keys(data.towers).filter(id=>!data.towers[id].advanced).length,8);assert.equal(Object.keys(data.towers).filter(id=>data.towers[id].advanced).length,38);assert.equal(data.recipes.length,38);
  assert.ok(historical.towers.lordbernhard);assert.ok(historical.recipes.some(recipe=>recipeFamily(recipe)==='lordbernhard'));assert.equal(data.towers.lordbernhard,undefined);assert.ok(data.towers.ladyclaire);
  for(const recipe of data.recipes){assert.notEqual(recipeFamily(recipe),'lordbernhard');assert.ok(data.towers[recipeFamily(recipe)]);for(const piece of expandRecipeToBasics(recipe,data))assert.ok(data.towers[piece.family]&&!data.towers[piece.family].advanced);}
  const game=new Game(data,{seed:9});assert.equal(game.recipes.length,38);assert.equal(game.recipes.some(recipe=>recipeFamily(recipe)==='lordbernhard'),false);
});

test('hostile Bernhard and each actually spawned final-boss variant use the current identity while every combat stat remains archived-equivalent',()=>{
  assert.match(data.enemies.host_50.name,/^Lord Bernhard/);
  const withoutNames=entry=>({...entry,name:undefined,variants:entry.variants?.map(v=>({...v,name:undefined}))});assert.deepEqual(withoutNames(data.enemies.host_50),withoutNames(historical.enemies.host_50));
  const game=fighting();for(const variant of data.enemies.host_50.variants){const enemy=game.combat.spawn('host_50',{variant});assert.match(enemy.name,/^Lord Bernhard/);assert.equal(enemy.flying,true);assert.equal(enemy.hp,historical.enemies.host_50.hp);assert.equal(enemy.armor,historical.enemies.host_50.armor);}
  assert.match(historical.enemies.host_50.name,/^Ghorun/);assert.ok(historical.enemies.host_50.variants.every(v=>v.name.startsWith('Ghorun')));
});

test('the actual final-wave heading uses the hostile Bernhard identity without changing any archived wave composition or combat modifier',()=>{
  const before=JSON.stringify(historical.waves),heading=data.enemies.host_50.name;
  assert.equal(data.waves.length,historical.waves.length);assert.equal(data.waves[49].name,heading);
  for(let i=0;i<data.waves.length;i++){
    assert.deepEqual({...data.waves[i],name:undefined},{...historical.waves[i],name:undefined});
    if(i!==49)assert.equal(data.waves[i].name,historical.waves[i].name);
  }
  assert.equal(JSON.stringify(historical.waves),before,'campaign heading must not edit archived data');
  const game=new Game(data,{seed:23,waveLimit:50});game.round=50;game.phase='ready';assert.equal(game.wave.name,heading);assert.equal(game.startCombat(),true);
  assert.ok(game.combat.spawnQueue.length>0);assert.ok(game.combat.spawnQueue.every(spawn=>spawn.type==='host_50'));
  assert.equal(game.combat.spawnQueue.length,historical.waves[49].groups.reduce((sum,group)=>sum+group.count,0));
});

test('blink events describe the actual checkpoint-preserving teleport separately from ordinary residual frame movement',()=>{
  const game=fighting(),enemy=blinkFixture(game),events=[];game.on((type,payload)=>{if(type==='teleport')events.push(payload);});
  game.combat.update(.02);assert.equal(events.length,1);assert.deepEqual(events[0].from,{x:20,z:20});assert.deepEqual(events[0].to,{x:22,z:22});assert.equal(events[0].enemy,enemy);assert.equal(events[0].visible,true);
  assert.ok(Math.abs(enemy.x-22.04)<1e-12);assert.equal(enemy.z,22);assert.ok(Math.abs(enemy.traveled-4.04)<1e-12);assert.equal(enemy.pathIndex,2);
  game.combat.update(.1);assert.equal(events.length,1,'ordinary movement emits no extra teleport');assert.ok(Math.abs(enemy.x-22.24)<1e-12);
});

test('pause and petrification suppress displacement, hidden teleport stays hidden, and existing blink-through-freeze semantics remain unchanged',()=>{
  const game=fighting(),enemy=blinkFixture(game,{petrified:true}),events=[];game.on((type,payload)=>{if(type==='teleport')events.push(payload);});game.combat.update(.02);assert.equal(events.length,0);assert.equal(enemy.traveled,0);
  const paused=fighting(),p=blinkFixture(paused);paused.paused=true;const before={x:p.x,z:p.z,clock:p.blinkClock,elapsed:paused.combat.elapsed};paused.tick(1);assert.deepEqual({x:p.x,z:p.z,clock:p.blinkClock,elapsed:paused.combat.elapsed},before);
  const hidden=fighting(),h=blinkFixture(hidden,{stealth:true}),hiddenEvents=[];hidden.on((type,payload)=>{if(type==='teleport')hiddenEvents.push(payload);});hidden.combat.update(.02);assert.equal(hiddenEvents.length,1);assert.equal(hiddenEvents[0].visible,false);assert.equal(h.cloaked,true);
  const frozen=fighting(),f=blinkFixture(frozen,{freeze:true}),frozenEvents=[];frozen.on((type,payload)=>{if(type==='teleport')frozenEvents.push(payload);});frozen.combat.update(.02);assert.equal(frozenEvents.length,1);assert.equal(f.traveled,4);assert.equal(f.x,22);
});

test('the real renderer death event retains grounded corpses until the single wave-complete event before reward or final victory',()=>{
  for(const final of [false,true]){
    const game=fighting();if(final)game.round=50;
    const {field,off}=corpseField(game),one=game.combat.spawn('grunt'),two=game.combat.spawn('grunt');liveFigure(field,one);liveFigure(field,two);const order=[];
    game.on((type,payload)=>{if(['wave-complete','reward','won'].includes(type)){order.push(type);if(type==='wave-complete'){assert.equal(payload.round,final?50:1);assert.equal(field.corpses.size,0,'renderer clears only at completed wave');}}});
    game.combat.damage(one,1e9,'pure',{});assert.equal(field.corpses.size,1);assert.equal(field.enemies.has(one.id),false);const corpse=field.corpses.get(one.id);animateDeath(corpse,1);
    const resting=corpse.position.toArray();game.combat.update(.02);assert.equal(field.corpses.get(one.id),corpse);animateDeath(corpse,10);assert.deepEqual(corpse.position.toArray(),resting);assert.equal(corpse.visible,true);assert.ok(new THREE.Box3().setFromObject(corpse.userData.body,true).min.y>=.0249);
    game.combat.damage(two,1e9,'pure',{});assert.equal(field.corpses.size,2);game.combat.spawnQueue=[];game.combat.update(.02);
    assert.deepEqual(order,final?['wave-complete','won']:['wave-complete','reward']);assert.equal(field.corpses.size,0);assert.equal(corpse.parent,null);const score=game.score;game.completeWave();assert.equal(game.score,score);assert.equal(order.filter(type=>type==='wave-complete').length,1);
    field.enemyAbilityEffects.dispose();off();
  }
});

test('the real battlefield keeps the mounted lightning cast aim and arm progress while its fire aura attacks another target',async()=>{
  const bytes=readFileSync('public/assets/geometric/champions/thunderheart.glb'),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),actor=cloneDefenderTemplate(gltf.scene);
  const game=fighting(),source={id:70,family:'thunderheart',tier:1,state:'active',x:15,z:15,cooldown:.05};game.towers=[source];
  const {field,off}=corpseField(game),stats=towerStats(source,data),rig=attackRig(actor,source.family,stats),hand=actor.getObjectByName('hand_R');field.models.set(source.id,{actor,attack:rig,tower:source});
  const castTarget={id:1,x:17,z:15},auraTarget={id:2,x:15,z:18};
  field.event('shot',{source,target:castTarget,stats});const aim=actor.rotation.y,mainDuration=rig.duration;
  assert.ok(rig.active);const releaseArm=hand.rotation.toArray(),releaseElapsed=rig.elapsed;
  field.event('aura-attack',{source,target:auraTarget,stats});assert.equal(actor.rotation.y,aim,'a fire target cannot redirect the running rider weapon');assert.deepEqual(hand.rotation.toArray(),releaseArm);assert.equal(rig.elapsed,releaseElapsed);assert.equal(rig.duration,mainDuration);assert.ok(rig.breathTrack.active);
  animateAttack(rig,.04,1,{combat:true,stamp:1});const recoveringHand=hand.rotation.toArray(),recoveringElapsed=rig.elapsed;assert.ok(recoveringElapsed>releaseElapsed);
  game.combat.elapsed=1;field.event('aura-attack',{source,target:auraTarget,stats});assert.equal(actor.rotation.y,aim);assert.deepEqual(hand.rotation.toArray(),recoveringHand);assert.equal(rig.elapsed,recoveringElapsed,'subsequent aura does not restart lightning recovery');
  animateAttack(rig,2,3,{combat:true,stamp:3});assert.equal(rig.active,false);assert.equal(rig.breathTrack.active,false);
  // Opening the jaw while the next weapon cast is preparing must also keep
  // that preparation available for the independent projectile release.
  animateAttack(rig,.01,4,{combat:true,target:castTarget,cooldown:.03,interval:stats.interval,rate:1,stamp:4});assert.equal(rig.stage,'preparation');const prepared=hand.rotation.toArray(),preparedElapsed=rig.elapsed;
  game.combat.elapsed=4;field.event('aura-attack',{source,target:auraTarget,stats});assert.equal(rig.stage,'preparation');assert.equal(rig.elapsed,preparedElapsed);assert.deepEqual(hand.rotation.toArray(),prepared);
  field.enemyAbilityEffects.dispose();off();disposeAttack(rig);disposeDefenderInstance(actor);disposeDecodedGeometricAsset(gltf);
});

test('geometric manifests normalize rank and category and loader limits decoding, collects failures and stops dispatch after disposal',async()=>{
  const entries=geometricEntries({subjects:[{id:'soldier-6',family:'soldier',rank:6,category:'towers',file:'defenders/soldier-6.glb'},{id:'host_50',category:'enemies',file:'assets/geometric/enemies/host_50.glb'}]});
  assert.equal(entries[0].tier,6);assert.equal(entries[0].kind,'tower');assert.equal(entries[1].kind,'enemy');assert.match(geometricEntryUrl(entries[0]),/assets\/geometric\/defenders\/soldier-6\.glb\?v=/);assert.match(geometricEntryUrl(entries[1]),/assets\/geometric\/enemies\/host_50\.glb\?v=/);assert.throws(()=>geometricEntries({}),/no model entries/);
  const inputs=Array.from({length:20},(_,id)=>({id,file:id+'.glb'}));let active=0,peak=0,finished=0;
  const failures=await loadModelEntries(inputs,async entry=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setImmediate(resolve));active--;finished++;if(entry.id%7===0)throw new Error('corrupt model '+entry.id);},{concurrency:3});assert.equal(peak,3);assert.equal(finished,20);assert.deepEqual(failures.map(f=>f.entry.id),[0,7,14]);assert.ok(failures.every(f=>f.error instanceof Error));
  let disposed=false,started=0;await loadModelEntries(inputs,async()=>{started++;await new Promise(resolve=>setImmediate(resolve));disposed=true;},{concurrency:3,isDisposed:()=>disposed});assert.equal(started,3,'already in-flight decodes finish but no new asset starts');
  await loadModelEntries(inputs,async()=>assert.fail('disposed field cannot start work'),{isDisposed:()=>true});
  assert.equal(installDefenderTemplate({disposed:true},{family:'soldier',tier:6},new THREE.Group()),false);assert.equal(installEnemyTemplate({disposed:true},{id:'host_50'},new THREE.Group()),false);
});

test('manifest fetch surfaces HTTP and malformed-content failures without claiming the geometric roster loaded',async()=>{
  const original=globalThis.fetch;try{
    globalThis.fetch=async()=>({ok:false,status:503});await assert.rejects(fetchGeometricEntries('geometric-enemies.json'),/HTTP 503/);
    globalThis.fetch=async()=>({ok:true,json:async()=>({unexpected:[]})});await assert.rejects(fetchGeometricEntries('geometric-enemies.json'),/no model entries/);
    globalThis.fetch=async()=>({ok:true,json:async()=>({entries:[{id:'host_01',category:'enemies',file:'enemies/host_01.glb'}]})});assert.equal((await fetchGeometricEntries('geometric-enemies.json'))[0].kind,'enemy');
  }finally{globalThis.fetch=original;}
});

test('the three actual production manifests decode all 136 generated identities and point at real GLBs',()=>{
  let count=0;for(const [manifest,expected] of [['geometric-defenders.json',48],['geometric-champions.json',38],['geometric-enemies.json',50]]){
    const raw=JSON.parse(readFileSync(new URL('../public/assets/geometric/'+manifest,import.meta.url))),entries=geometricEntries(raw);assert.equal(entries.length,expected,manifest);const ids=new Set(entries.map(entry=>entry.id));assert.equal(ids.size,expected,manifest);
    for(const entry of entries){const file=entry.file.startsWith('assets/')?entry.file.slice('assets/geometric/'.length):entry.file,bytes=readFileSync(new URL('../public/assets/geometric/'+file,import.meta.url));assert.equal(bytes.readUInt32LE(0),0x46546c67,entry.file);assert.equal(bytes.readUInt32LE(4),2,entry.file);assert.equal(bytes.readUInt32LE(8),bytes.length,entry.file);}
    count+=entries.length;
  }assert.equal(count,136);
});
