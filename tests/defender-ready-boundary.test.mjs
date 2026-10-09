import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {DefenderModelLoader,defenderTemplateKey} from '../game/render/defender-model-loader.js';
import {installDefenderTemplate,disposeDefenderInstance,pointedTower} from '../game/render/defender-assets.js';
import {geometricEntries,geometricEntryUrl} from '../game/render/geometric-assets.js';
import {geometricMetadata} from '../game/render/geometric-motion.js';
import {disposeGeometricResources} from '../game/render/geometric-resources.js';
import {disposeAttack} from '../game/render/battle-animation.js';
import {disposeRankAdornment} from '../game/render/ranks.js';
import {disposeChampionAura} from '../game/render/champion-aura.js';
import {defenderClassificationMultiplier,defenderPresentationMultiplier} from '../game/render/defender-classification-scale.js';
import {BATTLEFIELD_UNIT_SCALE} from '../game/render/battlefield-scale.js';
import {WALL_DECK_HEIGHT} from '../game/render/walls.js';

const hooks=registerHooks({load(url,context,next){
  if(url.startsWith('file:')&&url.endsWith('.json'))return {format:'module',source:`export default JSON.parse(${JSON.stringify(readFileSync(new URL(url),'utf8'))});`,shortCircuit:true};
  return next(url,context);
}});
const {Battlefield}=await import('../game/render/world.js');hooks.deregister();
const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,read(`data/${key}.json`)]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
const roster=['geometric-defenders.json','geometric-champions.json'].flatMap(name=>geometricEntries(read('public/assets/geometric/'+name)));
const unit=(entry,id=1,state='active')=>({id,family:entry.family,tier:entry.tier,state,x:10,z:10,kills:0,cooldown:0});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const fakeAsset=()=>({scene:new THREE.Group()});
function fixture(game=new Game(data,{seed:627})){
  const field=Object.create(Battlefield.prototype);
  Object.assign(field,{disposed:false,game,scene:new THREE.Scene(),models:new Map(),enemies:new Map(),templates:new Map(),imported:new Map(),updateCampPreview(){},rebuildPath(){},draftMarkers:{sync(){}},commandMoveEffects:{sync(){}},reservedDefenderEffects:{sync(){}},supportEffects:{sync(){}},selectionRing:new THREE.Group(),enemySelectionRing:new THREE.Group(),range:new THREE.Group(),grid:new THREE.Group(),pathGroup:new THREE.Group(),rangeGroup:new THREE.Group(),ghost:new THREE.Group(),maze:{editing:false,sync(){}},showGrid:false,showPath:false,showRanges:false,defenderManifestRetryAt:Infinity});
  field.game.phase='ready';
  return field;
}
function close(field){
  field.disposed=true;field.defenderLoader?.dispose();
  for(const model of field.models.values()){disposeAttack(model.attack);disposeChampionAura(model.aura);disposeRankAdornment(model.actor);disposeDefenderInstance(model.actor);}
  disposeGeometricResources([...field.templates.values(),...field.imported.values()]);
}
async function withCanvas(run){
  const original=globalThis.document;
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
  try{return await run();}finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
}
function pendingAssertion(field,id,key){
  const model=field.models.get(id);assert.equal(model.modelKey,key);assert.equal(model.modelStatus,'loading');
  assert.equal(model.actor.userData.defenderModelStatus,'loading');assert.equal(model.attack,null);assert.equal(model.siege,null);assert.equal(model.aura,null);assert.equal(model.hero,false);
  assert.equal(geometricMetadata(model.actor),null);assert.equal(model.actor.children.length,3,'only the low dial, never a procedural body or previous source');
  assert.equal(model.actor.getObjectByName('Rank signal'),undefined);assert.equal(model.actor.getObjectByName('Mythic aura'),undefined);
}

test('all 48 approved basic ranks and 38 champions pass the actual battlefield pending-to-ready boundary with exact GLB identity',async()=>{
  assert.equal(roster.length,86);assert.equal(new Set(roster.map(e=>`${e.family}:${e.tier}`)).size,86);
  const native=new NativeTestGLTFLoader(),field=fixture(),control=new Game(data,{seed:627}),pending=new Map(),loads=[];
  field.defenderLoader=new DefenderModelLoader({
    load:entry=>{loads.push(entry);return new Promise(resolve=>pending.set(`${entry.family}:${entry.tier}`,resolve));},
    install:(entry,asset)=>installDefenderTemplate(field,entry,asset.scene,asset.animations),
    isDisposed:()=>field.disposed,
  });
  field.defenderLoader.index(roster);assert.equal(loads.length,0);
  const sourceData=JSON.stringify(data),sourceDraws=JSON.stringify(field.game.draft.draws);
  try{await withCanvas(async()=>{
    for(const [index,entry]of roster.entries()){
      const tower=unit(entry,index+1),key=`${entry.family}:${entry.tier}`;field.game.towers=[tower];field.sync();pendingAssertion(field,tower.id,key);
      const loading=field.models.get(tower.id).actor;
      assert.equal(loads.at(-1),entry);assert.ok(geometricEntryUrl(entry).includes(entry.file));
      const bytes=readFileSync(new URL('../public/assets/geometric/'+entry.file,import.meta.url));
      assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.assetSha256);
      const gltf=await native.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
      pending.get(key)(gltf);assert.equal(await field.defenderLoader.requestTower(tower,data.towers),true);
      const ready=field.models.get(tower.id),meta=geometricMetadata(ready.actor);
      assert.equal(ready.modelStatus,'ready');assert.equal(ready.modelKey,key);assert.equal(ready.actor.userData.defenderModelKey,key);
      assert.notEqual(ready.actor,loading);assert.equal(loading.parent.parent,null,'obsolete dial is off scene before the approved figure renders');
      assert.equal(meta.id,entry.id);assert.equal(meta.family,entry.family);assert.equal(meta.tier,entry.tier);assert.equal(meta.sourceGlbSha256,entry.assetSha256);
      assert.equal(ready.actor.position.y,WALL_DECK_HEIGHT);assert.ok(ready.attack?.geometric,'the real source rig is installed, not a decorative replacement');
      assert.ok(Math.abs(ready.actor.scale.x-BATTLEFIELD_UNIT_SCALE*defenderClassificationMultiplier(entry.family)*defenderPresentationMultiplier(entry.family))<1e-12);
      assert.equal(!!ready.aura,!!data.towers[entry.family].advanced);
      const source=field.imported.get(key),sourceParts=new Map();source.traverse(node=>{if(node.isMesh)sourceParts.set(node.geometry,node.material);});
      let borrowed=0;ready.actor.traverse(node=>{if(node.isMesh&&sourceParts.has(node.geometry)){borrowed++;assert.equal(node.material,sourceParts.get(node.geometry));}});assert.ok(borrowed>0);
      assert.equal(field.defenderLoader.statusFor(tower,data.towers),'ready');
    }
  });
    assert.equal(loads.length,86);assert.equal(JSON.stringify(data),sourceData);assert.equal(JSON.stringify(field.game.draft.draws),sourceDraws);assert.equal(field.game.rng(),control.rng());
  }finally{close(field);}
});

test('late old-rank and old-family downloads cannot flash or replace the currently selected approved variant',async()=>{
  const chosen=roster.filter(e=>['soldier-1','soldier-6','mage-1'].includes(e.id)),native=new NativeTestGLTFLoader(),field=fixture(),pending=new Map();
  field.defenderLoader=new DefenderModelLoader({load:entry=>new Promise(resolve=>pending.set(entry.id,resolve)),install:(entry,asset)=>installDefenderTemplate(field,entry,asset.scene,asset.animations)});field.defenderLoader.index(chosen);
  const tower=unit(chosen.find(e=>e.id==='soldier-1'));field.game.towers=[tower];
  try{await withCanvas(async()=>{
    field.sync();pendingAssertion(field,1,'soldier:1');tower.tier=6;field.sync();pendingAssertion(field,1,'soldier:6');tower.family='mage';tower.tier=1;field.sync();pendingAssertion(field,1,'mage:1');
    const mageMarker=field.models.get(1).actor;
    for(const id of ['soldier-6','soldier-1','mage-1']){
      const entry=chosen.find(e=>e.id===id),bytes=readFileSync(new URL('../public/assets/geometric/'+entry.file,import.meta.url)),gltf=await native.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
      pending.get(id)(gltf);await tick();
      if(id!=='mage-1'){pendingAssertion(field,1,'mage:1');assert.equal(field.models.get(1).actor,mageMarker);}
    }
    assert.equal(geometricMetadata(field.models.get(1).actor).id,'mage-1');
    tower.family='soldier';tower.tier=6;field.sync();assert.equal(geometricMetadata(field.models.get(1).actor).id,'soldier-6');assert.equal(field.models.get(1).modelStatus,'ready');
  });}finally{close(field);}
});

test('network failures retry only after bounded cooldowns, exhaust after three batches, and recover on an explicit Retry',async()=>{
  let now=0,loads=0,online=false;const model=roster[0],tower=unit(model),states=[];
  const loader=new DefenderModelLoader({now:()=>now,load:async()=>{loads++;if(!online)throw new Error('offline');return fakeAsset();},install:()=>true,onStateChange:(key,status)=>states.push({key,status})});loader.index([model]);
  try{
    let request=loader.requestTower(tower,data.towers);assert.equal(await request,false);assert.equal(loads,2);assert.equal(loader.statusFor(tower,data.towers),'unavailable');
    for(let i=0;i<100;i++)assert.equal(loader.requestTower(tower,data.towers),request);assert.equal(loads,2);
    now=9999;assert.equal(loader.requestTower(tower,data.towers),request);now=10000;request=loader.requestTower(tower,data.towers);assert.equal(await request,false);assert.equal(loads,4);
    now=29999;assert.equal(loader.requestTower(tower,data.towers),request);now=30000;request=loader.requestTower(tower,data.towers);assert.equal(await request,false);assert.equal(loads,6);
    now=1000000;online=true;assert.equal(loader.requestTower(tower,data.towers),request);assert.equal(loads,6,'automatic retries are finite');
    assert.equal(await loader.retryTower(tower,data.towers),true);assert.equal(loads,7);assert.equal(loader.statusFor(tower,data.towers),'ready');assert.ok(states.some(e=>e.status==='loaded'));
  }finally{loader.dispose();}
});

test('a missing key from a partial manifest recovers immediately when a later index supplies it',async()=>{
  const model=roster.find(e=>e.id==='ladyclaire'),tower=unit(model);let loads=0;
  const loader=new DefenderModelLoader({load:async()=>{loads++;return fakeAsset();},install:()=>true});
  try{
    const first=loader.requestTower(tower,data.towers);loader.index([]);assert.equal(await first,false);assert.equal(loads,0);
    loader.index([model]);assert.equal(await loader.requestTower(tower,data.towers),true);assert.equal(loads,1);assert.equal(loader.statusFor(tower,data.towers),'ready');
  }finally{loader.dispose();}
});

test('removed placed identities cannot start queued loads or missing-entry retries; returning placed identities resume immediately',async()=>{
  const entries=roster.filter(e=>['soldier-1','soldier-2','soldier-3'].includes(e.id)),needed=new Set(entries.map(e=>`${e.family}:${e.tier}`)),started=[];let release;
  const loader=new DefenderModelLoader({concurrency:1,isNeeded:key=>needed.has(key),load:entry=>{started.push(entry.tier);return new Promise(resolve=>{release=()=>resolve(fakeAsset());});},install:()=>true});
  try{
    loader.index(entries.slice(0,2));const requests=entries.map(e=>loader.requestTower(unit(e),data.towers));
    needed.delete('soldier:2');needed.delete('soldier:3');assert.equal(await requests[2],false);
    loader.index([entries[2]]);assert.deepEqual(started,[1]);release();await tick();assert.equal(await requests[0],true);assert.equal(await requests[1],false);assert.deepEqual(started,[1]);
    needed.add('soldier:3');const resumed=loader.requestTower(unit(entries[2]),data.towers);assert.deepEqual(started,[1,3]);release();assert.equal(await resumed,true);
    needed.add('soldier:2');const skipped=loader.requestTower(unit(entries[1]),data.towers);assert.deepEqual(started,[1,3,2]);release();assert.equal(await skipped,true);
  }finally{loader.dispose();}
});

test('neutral loading/unavailable models preserve real Reserved occupancy, foundation, selection, map visibility and mystery RNG',async()=>{
  const field=fixture(),game=field.game,control=new Game(data,{seed:627});game.phase='build';assert.equal(game.place(10,10),true);assert.equal(control.place(10,10),true);
  const tower=game.towers[0];tower.state='reserved';const key=defenderTemplateKey(tower,data.towers),entry=roster.find(e=>`${e.family}:${e.tier}`===key);let loads=0,now=0;
  field.defenderLoadingStatus={hidden:true};field.defenderLoadingLabel={textContent:''};field.defenderRetryButton={hidden:true};
  field.defenderLoader=new DefenderModelLoader({now:()=>now,load:async()=>{loads++;throw new Error('offline');},install:()=>true,onStateChange:()=>field.queueDefenderRefresh()});field.defenderLoader.index([entry]);
  const occupied=[...game.grid.occupied],route=game.grid.route,draws=JSON.stringify(game.draft.draws);
  try{
    field.sync();pendingAssertion(field,tower.id,key);assert.equal(field.defenderLoadingStatus.hidden,false);assert.equal(field.defenderLoadingLabel.textContent,'Loading defenders…');assert.equal(field.defenderRetryButton.hidden,true);
    const object=field.models.get(tower.id).object;assert.equal(object.children.length,2);assert.equal(field.models.get(tower.id).actor.position.y,WALL_DECK_HEIGHT);
    object.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(tower.x-18,4,tower.z-18),new THREE.Vector3(0,-1,0));assert.equal(pointedTower(ray,field.models),tower.id);
    await field.defenderLoader.requestTower(tower,data.towers);await tick();assert.equal(field.models.get(tower.id).modelStatus,'unavailable');assert.equal(field.defenderLoadingLabel.textContent,'Defender appearance unavailable');assert.equal(field.defenderRetryButton.hidden,false);
    const failed=field.models.get(tower.id);assert.equal(failed.attack,null);assert.equal(failed.siege,null);assert.equal(failed.aura,null);assert.equal(failed.actor.visible,true);
    for(let i=0;i<100;i++)field.recoverDefenderModels(0);assert.equal(loads,2);
    game.towers=[];now=10000;field.recoverDefenderModels(10000);field.sync();assert.equal(loads,2,'removed identities do not retry');assert.equal(field.models.size,0);assert.equal(field.defenderLoadingStatus.hidden,true);
    assert.deepEqual([...game.grid.occupied],occupied);assert.equal(game.grid.route,route);assert.equal(JSON.stringify(game.draft.draws),draws);assert.equal(game.rng(),control.rng());
  }finally{close(field);}
});

test('failed roster fetches have finite cooldown recovery and never request hidden cards or overlapping manifest downloads',async()=>{
  const field=fixture(),model=roster.find(e=>e.id==='soldier-1');field.game.towers=[unit(model)];let loads=0,fetches=0,online=false;const releases=[];
  field.defenderLoader=new DefenderModelLoader({load:async()=>{loads++;return fakeAsset();},install:()=>true});
  const priorFetch=globalThis.fetch,priorWarn=console.warn,priorNow=Date.now;let now=0;
  globalThis.fetch=async()=>{fetches++;if(!online)throw new Error('offline');return new Promise(resolve=>{releases.push(()=>resolve({ok:true,json:async()=>({entries:[model]})}));});};console.warn=()=>{};Date.now=()=>now;
  try{
    await field.loadDefenders();assert.equal(fetches,2);assert.equal(loads,0);assert.equal(field.defenderManifestRetryAt,15000);
    field.recoverDefenderModels(14999);assert.equal(fetches,2);now=15000;await field.loadDefenders();assert.equal(fetches,4);assert.equal(field.defenderManifestRetryAt,45000);
    now=45000;await field.loadDefenders();assert.equal(fetches,6);assert.equal(field.defenderManifestRetryAt,Infinity);field.recoverDefenderModels(1000000);assert.equal(fetches,6);
    // A manual refresh reopens the finite manifest retry budget. Each roster
    // still has one fetch, with no second in-flight loadDefenders invocation.
    online=true;field.defenderManifestAttempts=0;
    const pending=field.loadDefenders();assert.equal(fetches,8);await field.loadDefenders();assert.equal(fetches,8);
    releases.forEach(release=>release());await pending;await tick();assert.equal(loads,1);assert.equal(field.defenderManifestRetryAt,Infinity);
  }finally{globalThis.fetch=priorFetch;console.warn=priorWarn;Date.now=priorNow;close(field);}
});
