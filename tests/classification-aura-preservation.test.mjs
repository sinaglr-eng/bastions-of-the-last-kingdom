import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {registerHooks} from 'node:module';
import * as THREE from 'three';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {towerStats,supportBonuses,damageAfterDefense} from '../game/core/math.js';
import {CHAMPION_CLASSIFICATIONS,championClassification} from '../game/render/champion-classification.js';
import {CHAMPION_AURA_COLORS,createChampionAura,animateChampionAura,disposeChampionAura} from '../game/render/champion-aura.js';
import {applyDefenderClassificationScale,defenderClassificationMultiplier} from '../game/render/defender-classification-scale.js';
import {BATTLEFIELD_UNIT_SCALE,scaleBattlefieldUnit,animateBattlefieldIdleScale} from '../game/render/battlefield-scale.js';
import {rankAdornment,rankColor,animateRank,disposeRankAdornment} from '../game/render/ranks.js';
import {WALL_DECK_HEIGHT} from '../game/render/walls.js';
import {disposeGeometricResources} from '../game/render/geometric-resources.js';
import {cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {disposeAttack} from '../game/render/battle-animation.js';

const jsonHooks=registerHooks({load(url,context,nextLoad){
  if(url.startsWith('file:')&&url.endsWith('.json'))return {format:'module',source:`export default JSON.parse(${JSON.stringify(readFileSync(new URL(url),'utf8'))});`,shortCircuit:true};
  return nextLoad(url,context);
}});
const {Battlefield}=await import('../game/render/world.js');jsonHooks.deregister();
const historical=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...historical,towers:campaignTowers(historical.towers),recipes:campaignRecipes(historical.recipes),enemies:campaignEnemies(historical.enemies),waves:campaignWaves(historical.waves)};
const expectedColors={Basic:'#247cff',Intermediate:'#24cd63',Advanced:'#a743f5',TOP:'#ffcf36',Secret:'#ffcf36'};
const levels={Basic:0,Intermediate:1,Advanced:2,TOP:3,Secret:4};
const cases=[],observations=[];
const verify=(name,run)=>test(name,async()=>{try{await run();cases.push({name,passed:true});}catch(error){cases.push({name,passed:false,error:error.message});throw error;}});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-10,`${message||'value'}: ${actual} vs ${expected}`);
function buffers(root){const values=[];root.traverse(node=>{if(node.geometry)values.push([...node.geometry.attributes.position.array]);});return values;}
function monitor(root){const resources=new Set(),events=new Map();root.traverse(node=>{if(node.geometry&&!node.isSprite)resources.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])if(material)resources.add(material);});for(const resource of resources){events.set(resource,0);resource.addEventListener('dispose',()=>events.set(resource,events.get(resource)+1));}return events;}
function ensureColors(aura,color){
  const hex=new THREE.Color(color).getHexString();assert.equal(aura.userData.color,color);assert.equal(aura.userData.ground.material.uniforms.tint.value.getHexString(),hex);
  for(const ring of aura.userData.rings)assert.equal(ring.material.color.getHexString(),hex);
  for(const wisp of aura.userData.wisps)assert.equal(wisp.material.uniforms.tint.value.getHexString(),hex);
  aura.traverse(node=>{if(node.material){assert.equal(node.material.depthWrite,false);assert.equal(node.raycast(),undefined);}});
}
function withCanvas(run){
  const original=globalThis.document;globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
  try{return run();}finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
}
function fixture(units){
  const game=new Game(data,{seed:42});game.phase='ready';game.towers=units;
  const source=new THREE.Group();source.add(new THREE.Mesh(new THREE.BoxGeometry(.5,1,.5),new THREE.MeshBasicMaterial()));
  const field=Object.create(Battlefield.prototype);
  Object.assign(field,{game,scene:new THREE.Scene(),models:new Map(),enemies:new Map(),templates:new Map(),imported:new Map(),template:()=>source,updateCampPreview(){},rebuildPath(){},draftMarkers:{sync(){}},commandMoveEffects:{sync(){}},reservedDefenderEffects:{sync(){}},supportEffects:{sync(){}},selectionRing:new THREE.Group(),enemySelectionRing:new THREE.Group(),range:new THREE.Group(),grid:new THREE.Group(),pathGroup:new THREE.Group(),rangeGroup:new THREE.Group(),ghost:new THREE.Group(),maze:{editing:false,sync(){}},showGrid:false,showPath:false,showRanges:false});
  const close=()=>{for(const value of field.models.values()){disposeAttack(value.attack);disposeChampionAura(value.aura);disposeRankAdornment(value.actor);disposeDefenderInstance(value.actor);}disposeGeometricResources([source,...field.templates.values()]);};
  return {field,game,source,close};
}

verify('all champion aura classes retain existing hues under the separate multiplicative class scale',()=>{
  assert.deepEqual(CHAMPION_AURA_COLORS,expectedColors);
  for(const [family,classification]of Object.entries(CHAMPION_CLASSIFICATIONS)){
    const actor=new THREE.Group(),reference=new THREE.Group();actor.scale.set(1,.9,1.1);reference.scale.copy(actor.scale);actor.position.set(4,WALL_DECK_HEIGHT,-3);reference.position.copy(actor.position);actor.rotation.y=.7;reference.rotation.copy(actor.rotation);
    applyDefenderClassificationScale(actor,family);scaleBattlefieldUnit(actor);scaleBattlefieldUnit(reference);
    const aura=createChampionAura(family,{phase:.25}),base=createChampionAura(family,{phase:.25});actor.add(aura);reference.add(base);animateChampionAura(aura,5.25);animateChampionAura(base,5.25);
    try{
      const factor=1.1**levels[classification],color=family==='archangel'?'#ffe5a3':expectedColors[classification];near(defenderClassificationMultiplier(family),factor);ensureColors(aura,color);assert.deepEqual(buffers(aura),buffers(base));assert.equal(aura.children.length,base.children.length);
      actor.updateMatrixWorld(true);reference.updateMatrixWorld(true);
      const point=new THREE.Vector3().fromBufferAttribute(aura.userData.rings[0].geometry.attributes.position,0),world=aura.userData.rings[0].localToWorld(point.clone()).sub(actor.position),ordinary=base.userData.rings[0].localToWorld(point.clone()).sub(reference.position);
      assert.ok(world.distanceTo(ordinary.multiplyScalar(factor))<1e-8,family+' actual ring vertices retain the scaled world transform');
      const wisp=aura.userData.wisps[0],baseWisp=base.userData.wisps[0],tip=new THREE.Vector3().fromBufferAttribute(wisp.geometry.attributes.position,wisp.geometry.attributes.position.count-1);
      assert.ok(wisp.localToWorld(tip.clone()).sub(actor.position).distanceTo(baseWisp.localToWorld(tip.clone()).sub(reference.position).multiplyScalar(factor))<1e-8,family+' actual wisp tip follows the same scale');
      observations.push({family,classification,color,multiplier:factor,actorScale:actor.scale.toArray(),rings:aura.userData.rings.length,wisps:aura.userData.wisps.length,actualRingWorldOffset:world.toArray(),localGeometryPreserved:true});
    }finally{disposeChampionAura(aura);disposeChampionAura(base);}
  }
});

verify('the Advanced Angel keeps its ivory/gold exception and Secret aura retains its stronger bounded presentation',()=>{
  const angel=createChampionAura('archangel'),top=createChampionAura('crownofages'),secret=createChampionAura('ladyclaire');
  try{
    assert.equal(championClassification('archangel'),'Advanced');ensureColors(angel,'#ffe5a3');near(defenderClassificationMultiplier('archangel'),1.21);assert.equal(angel.userData.tier.height,1.85);
    assert.equal(secret.userData.rings.length,4);assert.equal(secret.userData.wisps.length,8);assert.equal(secret.userData.particles.geometry.attributes.position.count,30);assert.ok(secret.userData.ground.material.uniforms.opacity.value>top.userData.ground.material.uniforms.opacity.value);ensureColors(secret,expectedColors.Secret);
  }finally{[angel,top,secret].forEach(disposeChampionAura);}
});

verify('repeated class and battlefield transforms preserve animated aura colors and do not compound scaling',()=>{
  const actor=new THREE.Group(),aura=createChampionAura('highking');applyDefenderClassificationScale(actor,'highking');scaleBattlefieldUnit(actor);actor.add(aura);const expected=actor.scale.clone();
  try{for(const stretch of [.018,-.018,.01,0]){animateBattlefieldIdleScale(actor,stretch);applyDefenderClassificationScale(actor,'highking');scaleBattlefieldUnit(actor);animateChampionAura(aura,7);ensureColors(aura,expectedColors.Advanced);}assert.ok(actor.scale.distanceTo(expected)<1e-12);animateChampionAura(aura,3,{reducedMotion:true});const frozen=buffers(aura);animateChampionAura(aura,999,{reducedMotion:true});assert.deepEqual(buffers(aura),frozen);}
  finally{disposeChampionAura(aura);}
});

verify('ordinary ranks I–VI keep their existing colored rank signals and unscaled Mythic orbiting radiance',()=>withCanvas(()=>{
  for(const family of Object.keys(data.towers).filter(id=>!data.towers[id].advanced))for(let tier=1;tier<=6;tier++){
    const actor=new THREE.Group(),adornment=rankAdornment(tier),before=buffers(adornment);actor.add(adornment);applyDefenderClassificationScale(actor,family);scaleBattlefieldUnit(actor);
    try{near(actor.scale.x,BATTLEFIELD_UNIT_SCALE);assert.equal(createChampionAura(family),null);assert.deepEqual(buffers(adornment),before);assert.equal(adornment.children[0].material.color.getHexString(),new THREE.Color(rankColor(tier)).getHexString());
      if(tier===6){assert.equal(adornment.name,'Mythic aura');const stars=adornment.getObjectByName('Orbiting radiance');assert.equal(stars.children.length,8);animateRank(actor,2);near(stars.rotation.y,1.3);near(stars.position.y,Math.sin(4)*.04);assert.ok(adornment.children.some(node=>node.isSprite&&node.material.map.isTexture));}
    }finally{disposeRankAdornment(actor);}
  }
}));

verify('actual Battlefield sync creates classification aura only for active champions and keeps the wall deck fixed',()=>{
  const units=['active','draft','reserved','ruin'].map((state,index)=>({id:index+1,family:'highking',tier:1,state,x:8+index*2,z:10,kills:0,cooldown:0})),f=fixture(units);
  try{f.field.sync();for(const unit of units){const model=f.field.models.get(unit.id);assert.equal(!!model.aura,unit.state==='active');assert.equal(model.actor.position.y,['active','reserved'].includes(unit.state)?WALL_DECK_HEIGHT:0);if(unit.state==='ruin'){assert.equal(model.actor.userData.classificationScale,undefined);near(model.actor.scale.x,1);}else near(model.actor.scale.x,BATTLEFIELD_UNIT_SCALE*1.21);if(unit.state==='reserved')assert.equal(model.attack,null);if(model.aura)ensureColors(model.aura,expectedColors.Advanced);}}
  finally{f.close();}
});

verify('actual active-to-reserved-to-active-to-ruin lifecycle disposes each classification aura exactly once',()=>{
  const unit={id:7,family:'ladyclaire',tier:1,state:'active',x:10,z:10,kills:0,cooldown:0},f=fixture([unit]);
  try{f.field.sync();const first=f.field.models.get(7).aura,firstEvents=monitor(first);unit.state='reserved';f.field.sync();assert.equal(f.field.models.get(7).aura,null);assert.equal(first.parent,null);for(const count of firstEvents.values())assert.equal(count,1);
    unit.state='draft';f.field.sync();assert.equal(f.field.models.get(7).aura,null);unit.state='active';f.field.sync();const second=f.field.models.get(7).aura,secondEvents=monitor(second);assert.notEqual(second,first);ensureColors(second,expectedColors.Secret);unit.state='ruin';f.field.sync();assert.equal(f.field.models.get(7).aura,null);for(const count of secondEvents.values())assert.equal(count,1);disposeChampionAura(first);disposeChampionAura(second);for(const count of [...firstEvents.values(),...secondEvents.values()])assert.equal(count,1);
  }finally{f.close();}
});

verify('actual ordinary rank VI survives appearance scaling and is released on world rebuild or removal',()=>withCanvas(()=>{
  const unit={id:8,family:'soldier',tier:6,state:'active',x:10,z:10,kills:0,cooldown:0},f=fixture([unit]);
  try{f.field.sync();const original=f.field.models.get(8).actor.getObjectByName('Mythic aura'),events=monitor(original);assert.ok(original);unit.state='reserved';f.field.sync();for(const count of events.values())assert.equal(count,1);assert.equal(original.parent,null);const replacement=f.field.models.get(8).actor.getObjectByName('Mythic aura'),replacementEvents=monitor(replacement);assert.ok(replacement);assert.equal(f.field.models.get(8).aura,null);f.game.towers=[];f.field.sync();assert.equal(f.field.models.size,0);for(const count of replacementEvents.values())assert.equal(count,1);}
  finally{f.close();}
}));

verify('the actual Atelier effects switch hides and restores both aura systems without resetting scale',()=>withCanvas(()=>{
  const source=readFileSync(new URL('../game/archer-preview.js',import.meta.url),'utf8'),start=source.indexOf('function setEffectVisibility(){'),end=source.indexOf('async function showRank',start);assert.ok(start>=0&&end>start);
  const switchEffects=new Function('model','modelAura','effectsVisible','previewEffects','enemyPreview','reducedMotion','updateAtelierEnemyPreview',source.slice(start,end)+';setEffectVisibility();');
  const model=new THREE.Group(),aura=createChampionAura('ladyclaire'),rank=rankAdornment(6);applyDefenderClassificationScale(model,'ladyclaire');model.add(aura,rank);const scale=model.scale.clone(),effects={effects:[{object:new THREE.Group()}],projectiles:new Map([[1,{object:new THREE.Group()}]])};
  try{for(const visible of [false,true,false,true]){switchEffects(model,aura,visible,effects,null,{matches:false},()=>{});assert.equal(aura.visible,visible);assert.equal(rank.visible,visible);for(const {object}of [...effects.effects,...effects.projectiles.values()])assert.equal(object.visible,visible);applyDefenderClassificationScale(model,'ladyclaire');assert.deepEqual(model.scale,scale);ensureColors(aura,expectedColors.Secret);}}
  finally{disposeChampionAura(aura);disposeRankAdornment(model);}
}));

verify('rank cleanup owns only generated resources and never disposes a cached glow texture or borrowed GLB lookalike',()=>withCanvas(()=>{
  const actor=new THREE.Group(),first=rankAdornment(6),second=rankAdornment(6),borrowed=new THREE.Group();borrowed.name='Mythic aura';const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial();borrowed.add(new THREE.Mesh(geometry,material));actor.add(first,borrowed);const owned=monitor(first),borrowedEvents=monitor(borrowed),otherEvents=monitor(second),sprite=first.children.find(node=>node.isSprite),peerSprite=second.children.find(node=>node.isSprite),map=sprite.material.map;let textureDisposals=0,sharedQuadDisposals=0;map.addEventListener('dispose',()=>textureDisposals++);sprite.geometry.addEventListener('dispose',()=>sharedQuadDisposals++);
  assert.equal(peerSprite.material.map,map);assert.equal(peerSprite.geometry,sprite.geometry);
  disposeRankAdornment(actor);disposeRankAdornment(actor);disposeRankAdornment(first);assert.equal(first.parent,null);assert.equal(borrowed.parent,actor);for(const count of owned.values())assert.equal(count,1);for(const count of borrowedEvents.values())assert.equal(count,0);for(const count of otherEvents.values())assert.equal(count,0);assert.equal(textureDisposals,0);assert.equal(sharedQuadDisposals,0);assert.ok(peerSprite.geometry.attributes.position.count>0);assert.equal(peerSprite.visible,true);
  disposeRankAdornment(second);for(const count of otherEvents.values())assert.equal(count,1);assert.equal(textureDisposals,0);assert.equal(sharedQuadDisposals,0);geometry.dispose();material.dispose();
}));

verify('the actual Atelier model cleanup releases owned rank and classification effects while retaining cached GLB resources',()=>withCanvas(()=>{
  const source=readFileSync(new URL('../game/archer-preview.js',import.meta.url),'utf8'),start=source.indexOf('function clearModel(){'),end=source.indexOf('function setEffectVisibility()',start);assert.ok(start>=0&&end>start);
  const clear=new Function('model','modelAttack','modelAura','enemyPreview','disposeAtelierEnemyPreview','disposeAttack','disposeDefenderInstance','disposeChampionAura','disposeRankAdornment','clearShot',source.slice(start,end)+';clearModel();return {model,modelAura};');
  const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial(),model=new THREE.Group(),borrowed=new THREE.Mesh(geometry,material),aura=createChampionAura('ladyclaire'),rank=rankAdornment(6),parent=new THREE.Group();model.add(borrowed,aura,rank);parent.add(model);const owned=monitor(rank),classification=monitor(aura),shared=monitor(borrowed);let shotsCleared=0;
  const result=clear(model,null,aura,null,()=>{},disposeAttack,disposeDefenderInstance,disposeChampionAura,disposeRankAdornment,()=>shotsCleared++);
  assert.equal(result.model,null);assert.equal(result.modelAura,null);assert.equal(model.parent,null);assert.equal(shotsCleared,1);for(const count of [...owned.values(),...classification.values()])assert.equal(count,1);for(const count of shared.values())assert.equal(count,0);geometry.dispose();material.dispose();
}));

verify('actual Battlefield disposal releases both private aura systems before the cached model resources',()=>withCanvas(()=>{
  const units=[{id:8,family:'soldier',tier:6,state:'active',x:10,z:10,kills:0,cooldown:0},{id:9,family:'ladyclaire',tier:1,state:'active',x:12,z:10,kills:0,cooldown:0}],f=fixture(units),previousWindow=globalThis.window;
  const noop={dispose(){}};globalThis.window={removeEventListener(){}};document.removeEventListener=()=>{};
  try{
    f.field.sync();const mythic=f.field.models.get(8).actor.getObjectByName('Mythic aura'),classification=f.field.models.get(9).aura,rankEvents=monitor(mythic),auraEvents=monitor(classification);let textureDisposals=0;mythic.children.find(node=>node.isSprite).material.map.addEventListener('dispose',()=>textureDisposals++);
    Object.assign(f.field,{disposed:false,defenderLoader:noop,combatEffects:noop,enemyAbilityEffects:noop,enemyConcealmentEffects:noop,clearCorpses(){},landmarks:noop,enemyTemplates:new Map(),effects:[],unsubscribe(){},resizeObserver:{disconnect(){}},controls:noop,renderer:noop});for(const name of ['supportEffects','commandMoveEffects','reservedDefenderEffects','draftMarkers','maze'])f.field[name].dispose=()=>{};
    f.field.enemySelectionRing=new THREE.Mesh(new THREE.RingGeometry(.3,.4,4),new THREE.MeshBasicMaterial());f.field.imported.set('fixture',f.source);
    const geometry=f.source.children[0].geometry;let sourceDisposals=0;geometry.addEventListener('dispose',()=>{sourceDisposals++;for(const count of [...rankEvents.values(),...auraEvents.values()])assert.equal(count,1);});
    f.field.dispose();assert.equal(f.field.disposed,true);assert.equal(f.field.models.size,0);assert.equal(sourceDisposals,1);for(const count of [...rankEvents.values(),...auraEvents.values()])assert.equal(count,1);assert.equal(textureDisposals,0);
  }finally{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;f.close();}
}));

verify('scaled classification aura resources remain private and cleanup releases each geometry and material once',()=>{
  for(const family of Object.keys(CHAMPION_CLASSIFICATIONS)){
    const actor=new THREE.Group(),aura=createChampionAura(family),peer=createChampionAura(family);applyDefenderClassificationScale(actor,family);actor.add(aura);const events=monitor(aura),peerEvents=monitor(peer);disposeChampionAura(aura);disposeChampionAura(aura);assert.equal(aura.parent,null);for(const count of events.values())assert.equal(count,1);for(const count of peerEvents.values())assert.equal(count,0);disposeChampionAura(peer);
  }
});

verify('visual scaling preserves all combat statistics, defense calculations, support effects and gameplay RNG',()=>{
  const before=JSON.stringify(data),game=new Game(data,{seed:721}),control=new Game(data,{seed:721}),target={armor:18,resists:{magic:.22}},units=Object.keys(data.towers).map((family,index)=>({id:index+1,family,tier:data.towers[family].advanced?2:6,state:'active',x:10,z:10,kills:0,cooldown:0}));
  const stats=units.map(unit=>towerStats(unit,data)),bonuses=units.map(unit=>supportBonuses(unit,units,data)),hits=stats.map(value=>damageAfterDefense(value.damage,value.type,target,value,data.balance));
  for(const unit of units){const actor=new THREE.Group(),aura=createChampionAura(unit.family);applyDefenderClassificationScale(actor,unit.family);scaleBattlefieldUnit(actor);if(aura){actor.add(aura);animateChampionAura(aura,10);disposeChampionAura(aura);}}
  assert.deepEqual(units.map(unit=>towerStats(unit,data)),stats);assert.deepEqual(units.map(unit=>supportBonuses(unit,units,data)),bonuses);assert.deepEqual(stats.map(value=>damageAfterDefense(value.damage,value.type,target,value,data.balance)),hits);assert.equal(JSON.stringify(data),before);assert.equal(game.rng(),control.rng());
});

verify('private clone scaling and auras never change shared source model buffers or peer transforms',()=>{
  const source=new THREE.Group(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial({color:'#bf9571'});source.scale.set(1,.9,1.1);source.add(new THREE.Mesh(geometry,material));const bytes=Buffer.from(geometry.attributes.position.array.buffer).slice(),actor=cloneDefenderTemplate(source),peer=cloneDefenderTemplate(source),sourceScale=source.scale.clone();applyDefenderClassificationScale(actor,'ladyclaire');scaleBattlefieldUnit(actor);const aura=createChampionAura('ladyclaire');actor.add(aura);animateChampionAura(aura,12);assert.deepEqual(source.scale,sourceScale);assert.deepEqual(peer.scale,sourceScale);assert.deepEqual(Buffer.from(geometry.attributes.position.array.buffer),bytes);assert.equal(actor.children[0].geometry,source.children[0].geometry);disposeChampionAura(aura);disposeRankAdornment(actor);disposeDefenderInstance(actor);disposeDefenderInstance(peer);geometry.dispose();material.dispose();
});

after(()=>{
  if(!process.env.BASTIONS_AURA_PROOF)return;
  const output=resolve(process.env.BASTIONS_AURA_PROOF);assert.equal(existsSync(output),false,'Audit evidence must be fresh');
  const sourcePaths=['game/render/champion-aura.js','game/render/champion-classification.js','game/render/ranks.js','game/render/defender-classification-scale.js','game/render/world.js','game/archer-preview.js','tests/classification-aura-preservation.test.mjs'];
  const preserved=['game/render/champion-aura.js','game/render/champion-classification.js','public/assets/geometric','public/assets/audio','docs/audio/generated-allied-audio.json','data/towers.json','data/balance.json','data/recipes.json','game/core/combat.js'];
  const diff=spawnSync('git',['diff','--name-only','b801c5c7c568bde9d1f84fdd2b0b6fe771bd146d','--',...preserved],{encoding:'utf8'}),changed=diff.stdout.trim().split('\n').filter(Boolean);
  const report={revision:'independent-classification-aura-preservation-v20',checkedAtUtc:new Date().toISOString(),status:cases.every(row=>row.passed)&&diff.status===0&&!changed.length?'passed':'failed',summary:{tests:cases.length,passed:cases.filter(row=>row.passed).length,failed:cases.filter(row=>!row.passed).length,championClassifications:observations.length,liveChampions:38,ordinaryBasicFamilies:8,ordinaryBasicRanks:6},scope:'Actual Three.js aura ring/wisp vertices, material hues, separate cosmetic classification scale, real Battlefield sync lifecycle, generated rank resource ownership, actual module-local Atelier visibility function, combat statistics and seeded RNG.',limitations:['The Atelier toggle test executes its actual function body against real Three.js objects without DOM/WebGL startup; native browser button interaction and shaded-pixel review remain separate.','The cached radial glow canvas uses a minimal test canvas context; shader/material/mesh ownership and transforms are inspected, not its raster pixels.','Archived Lord Bernhard retains its historical classification aura in these checks; it is not introduced as a playable champion.'],sources:sourcePaths.map(file=>({file,sha256:hash(readFileSync(new URL('../'+file,import.meta.url)))})),preservation:{baseline:'b801c5c7c568bde9d1f84fdd2b0b6fe771bd146d',changedFiles:changed,passed:diff.status===0&&!changed.length},tests:cases,observations};
  mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');
});
