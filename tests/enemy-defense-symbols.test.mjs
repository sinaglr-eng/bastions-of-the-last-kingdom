import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {WebGLRenderList} from 'three/src/renderers/webgl/WebGLRenderLists.js';
import {Game} from '../game/core/game.js';
import {damageAfterDefense} from '../game/core/math.js';
import {EnemyAbilityEffects} from '../game/render/geometric-enemy-effects.js';
import {ENEMY_DEFENSE_SYMBOLS,enemyDefenseVisualState,enemyDefenseDescriptions} from '../game/render/enemy-defense-symbols.js';
import {enemyFigure,disposeEnemyFigure} from '../game/render/enemy-assets.js';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL('../data/'+key+'.json',import.meta.url)))]));
const state=enemy=>enemyDefenseVisualState(enemy,{balance:data.balance});
const kinds=enemy=>state(enemy).map(row=>row.kind);
function arena(){const game=new Game(data,{seed:7});game.phase='combat';game.combat.spawnQueue=[{time:9999,type:'host_01'}];return game;}
function spawn(game,id,modifiers={}){const enemy=game.combat.spawn(id,modifiers);Object.assign(enemy,{x:10,z:10,speed:0});return enemy;}
const tower=(family,x=10,z=10)=>({id:1,family,tier:1,state:'active',x,z,cooldown:Infinity,kills:0});
async function model(enemy){const bytes=readFileSync(new URL('../public/assets/geometric/enemies/'+enemy.type+'.glb',import.meta.url)),decoded=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');return {decoded,figure:enemyFigure(enemy,new Map([[enemy.type,decoded.scene]]))};}
function disposeFallback(figure){const resources=new Set();figure.traverse(node=>{if(node.geometry)resources.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])if(material)resources.add(material);});disposeEnemyFigure(figure);resources.forEach(resource=>resource.dispose());}

test('actual wave14 spawn shows three shield panels despite existing model shards, deflects3→0 and restores3 on real8s recharge',async()=>{
  const game=arena(),enemy=spawn(game,'host_14'),loaded=await model(enemy),fallback=enemyFigure(enemy,new Map()),fx=new EnemyAbilityEffects(new THREE.Scene(),{balance:data.balance});
  assert.equal(enemy.shields,3);assert.equal(fallback.userData.shards.children.length,3,'the reported cosmetic skip is exercised');
  const events=[];game.on((kind,payload)=>{if(kind==='deflect')events.push(payload.enemy.shields);});
  try{
    const sync=expected=>{
      for(const figure of [loaded.figure,fallback]){
        const before=JSON.stringify(enemy);fx.sync([enemy],new Map([[enemy.id,figure]]),game.combat.elapsed);
        assert.equal(fx.batches.get('refraction').panels.count,expected,'one actual visible FX panel per remaining charge');
        assert.equal(fx.batches.get('refraction').glyph.count,expected?3:0);
        assert.equal(fx.batches.get('refraction').root.visible,expected>0);
        assert.equal(JSON.stringify(enemy),before,'visual synchronization does not replenish charges');
      }
    };
    sync(3);const hp=enemy.hp;
    for(const remaining of [2,1,0]){assert.equal(game.combat.damage(enemy,40,'physical',{directHit:true}),0);assert.equal(enemy.hp,hp);sync(remaining);}
    assert.deepEqual(events,[2,1,0]);assert.ok(game.combat.damage(enemy,40,'physical',{directHit:true})>0);
    game.tick(7.99);sync(0);game.tick(.02);assert.equal(enemy.shields,3);sync(3);
    enemy.shields=0;game.combat.damage(enemy,1,'physical',{});sync(0);
  }finally{fx.dispose();disposeEnemyFigure(loaded.figure);disposeDecodedGeometricAsset(loaded.decoded);disposeFallback(fallback);}
});

test('actual host16 shows immunity and its17% resistance independently, including real piercing-aura suppression and recovery',()=>{
  const game=arena(),enemy=spawn(game,'host_16'),fx=new EnemyAbilityEffects(new THREE.Scene(),{balance:data.balance});
  try{
    assert.deepEqual(kinds(enemy),['magicImmune','magic']);assert.equal(state(enemy).find(row=>row.kind==='magic').amount,.168);
    assert.deepEqual(enemyDefenseDescriptions(data.enemies.host_16).map(row=>row.kind),['magicImmune','magic']);
    fx.sync([enemy]);assert.equal(fx.batches.get('magicImmune').glyph.count,3);assert.equal(fx.batches.get('magic').glyph.count,3);
    const source=tower('griffinbomber');game.towers=[source];game.tick(.01);
    assert.equal(enemy.magicShred,.2);assert.deepEqual(kinds(enemy),['magicImmune']);
    fx.sync([enemy]);assert.equal(fx.batches.get('magic').glyph.count,0);assert.equal(fx.batches.get('magic').dots.count,0);assert.equal(fx.batches.get('magicImmune').glyph.count,3);
    assert.equal(game.combat.damage(enemy,40,'fire',{}),0,'aura suppression never removes actual immunity');
    source.x=17.001;game.tick(.01);assert.equal(enemy.magicShred,0);assert.deepEqual(kinds(enemy),['magicImmune','magic']);
    fx.sync([enemy]);assert.equal(fx.batches.get('magic').glyph.count,3);assert.equal(fx.batches.get('magic').dots.count,6);
  }finally{fx.dispose();}
});

test('real ranged shred auras and status expiry remove effective protections and return them at out-of-range or recovery',()=>{
  const game=arena(),enemy=spawn(game,'host_06',{resists:{fire:.05}}),source=tower('griffinbomber');
  assert.ok(kinds(enemy).includes('magic')&&kinds(enemy).includes('fire'));
  game.towers=[source];game.tick(.01);
  assert.equal(enemy.magicShred,.2);assert.ok(damageAfterDefense(1,'fire',enemy,{},data.balance)>=1);assert.deepEqual(kinds(enemy),[]);
  source.x=17.001;game.tick(.01);assert.equal(enemy.magicShred,0);assert.ok(kinds(enemy).includes('magic')&&kinds(enemy).includes('fire'));
  source.x=17;game.tick(.01);assert.deepEqual(kinds(enemy),[],'exact seven-tile aura boundary still suppresses resistance');
  game.towers=[];game.combat.applyEffects(enemy,{shredMagic:1});game.tick(.01);assert.deepEqual(kinds(enemy),[]);
  game.tick(4.01);
  // Combat's live magicShred cache is also the damage input in this expiry
  // frame. Never cosmetically restore the symbol ahead of effective recovery.
  for(const kind of ['fire','frost','poison','holy','arcane'])assert.equal(kinds(enemy).includes(kind),!!enemy.resists[kind]&&damageAfterDefense(1,kind,enemy,{},data.balance)<1);
  game.tick(.01);assert.ok(kinds(enemy).includes('magic')&&kinds(enemy).includes('fire'));

  const reactive=spawn(game,'host_24');game.combat.damage(reactive,10,'physical',{directHit:true});
  assert.ok(kinds(reactive).includes('reactive'));
  const breaker=tower('mechanicalgolem');game.towers=[breaker];game.tick(.01);assert.equal(reactive.armorShred,30);assert.equal(kinds(reactive).includes('reactive'),false);
  breaker.x=22.001;game.tick(.01);assert.equal(reactive.armorShred,0);assert.ok(kinds(reactive).includes('reactive'));
  reactive.reactiveStacks=0;assert.equal(kinds(reactive).includes('reactive'),false,'ordinary armor cannot retain a reactive shield');
});

test('ward, blocked regeneration and periodic healing follow actual combat damage/healing availability',()=>{
  const game=arena(),enemy=spawn(game,'host_02'),warlock=spawn(game,'warlock');
  warlock.x=12;game.tick(.01);assert.equal(enemy.ward,.18);assert.ok(kinds(enemy).includes('magic'));
  assert.ok(Math.abs(state(enemy).find(row=>row.kind==='magic').amount-(1-damageAfterDefense(1,'arcane',enemy,{},data.balance)))<1e-12);
  warlock.x=13.5;game.tick(.01);assert.equal(enemy.ward,0);assert.deepEqual(kinds(enemy),[],'ward uses combat strict <3.5 range');
  warlock.x=12;game.tick(.01);assert.ok(kinds(enemy).includes('magic'));

  const regen=spawn(game,'host_15'),recharge=spawn(game,'host_32');regen.hp-=50;recharge.hp-=50;
  for(const e of [regen,recharge])game.combat.applyEffects(e,{healingBlockDuration:.2});
  recharge.rechargeClock=.01;const oldHp=[regen.hp,recharge.hp];game.tick(.02);
  assert.equal(kinds(regen).includes('regen'),false);assert.equal(kinds(recharge).includes('recharge'),false);assert.deepEqual([regen.hp,recharge.hp],oldHp);
  game.tick(.3);assert.ok(kinds(regen).includes('regen'));assert.ok(regen.hp>oldHp[0]);
  assert.ok(kinds(recharge).includes('recharge'),'available periodic healing stays readable between recharge ticks');
  const before=recharge.hp;game.tick(8);assert.ok(recharge.hp>before,'actual periodic healing resumes on its next tick');
});

test('the live slowing-aura symbol describes the real enemy modifier independently of each target range',()=>{
  const game=arena(),enemy=spawn(game,'host_17'),guard={...tower('soldier'),cooldown:10};game.towers=[guard];
  assert.ok(kinds(enemy).includes('untouchable'));assert.equal(state(enemy).find(row=>row.kind==='untouchable').amount,enemy.untouchable);
  assert.equal(enemyDefenseDescriptions(data.enemies.host_17).filter(row=>row.kind==='untouchable').length,1);
  game.tick(.1);assert.ok(Math.abs(guard.cooldown-(10-.1*(1-enemy.untouchable)))<1e-12,'actual nearby guard cooldown receives the slowing modifier');
  enemy.x=14;guard.cooldown=10;game.tick(.1);assert.ok(Math.abs(guard.cooldown-9.9)<1e-12,'actual four-tile boundary is outside the aura');
  assert.ok(kinds(enemy).includes('untouchable'),'available enemy aura does not depend on one target being in range');
  assert.equal(kinds({...enemy,untouchable:0}).includes('untouchable'),false);
});

test('every resistance state agrees with real damage across caps, shred, immunity and fractional direct-hit charge inputs',()=>{
  const base={armor:30,reactiveArmor:2,reactiveStacks:4,resists:{magic:.3,fire:.2,frost:.1,poison:.08,holy:.07,arcane:.06},ward:.18,magicShred:0,statuses:{},regen:5,recharge:.12,evasion:.25,krakenShell:66,shields:.5};
  for(const rules of [data.balance,{...data.balance,maxResistance:.40}])for(const magicShred of [0,.2,.5,.7,1]){
    const enemy={...base,magicShred},before=structuredClone(enemy),states=enemyDefenseVisualState(enemy,{balance:rules});
    for(const kind of ['fire','frost','poison','holy','arcane']){
      const row=states.find(row=>row.kind===kind),effective=1-damageAfterDefense(1,kind,enemy,{},rules);
      assert.equal(!!row,effective>0);if(row)assert.ok(Math.abs(row.amount-effective)<1e-12);
    }
    assert.deepEqual(enemy,before);assert.equal(states.find(row=>row.kind==='refraction').count,1,'a fractional positive charge still absorbs one direct hit');
  }
  const immune={...base,magicImmune:true,physicalImmune:true,statuses:{healBlock:{time:1}},shields:0};
  const states=enemyDefenseVisualState(immune);
  assert.ok(states.some(row=>row.kind==='physicalImmune')&&states.some(row=>row.kind==='magicImmune'));
  assert.ok(['reactive','magic','fire','frost','poison','holy','arcane'].every(kind=>states.some(row=>row.kind===kind)),'configured positive layers remain independently readable under immunity');
  assert.ok(!states.some(row=>['regen','recharge'].includes(row.kind)),'real healing block still hides both healing defenses');
  for(const kind of ['fire','frost','poison','holy','arcane'])assert.ok(Math.abs(states.find(row=>row.kind===kind).amount-(1-damageAfterDefense(1,kind,{...immune,magicImmune:false},{},data.balance)))<1e-12);
  assert.equal(damageAfterDefense(1,'physical',immune,{},data.balance),0);assert.equal(damageAfterDefense(1,'fire',immune,{},data.balance),0);assert.equal(damageAfterDefense(1,'pure',immune,{},data.balance),1);
  assert.deepEqual(enemyDefenseVisualState({...base,dead:true}),[]);
});

test('shared UI paths remain distinctive and configured wave descriptions never pretend depleted live defenses remain active',()=>{
  const signatures=new Set();
  for(const symbol of Object.values(ENEMY_DEFENSE_SYMBOLS)){
    assert.ok(symbol.label&&/^#[0-9a-f]{6}$/i.test(symbol.color));assert.equal(symbol.viewBox,'-24 -24 48 48');
    const signature=JSON.stringify(symbol.paths);assert.equal(signatures.has(signature),false,'each defense has a distinguishable silhouette');signatures.add(signature);
    assert.ok(symbol.svgPaths.every(path=>path.startsWith('M')));
  }
  const reactive=data.enemies.host_24;assert.deepEqual(enemyDefenseVisualState({...reactive,reactiveStacks:0}),[]);
  assert.ok(enemyDefenseDescriptions(reactive).some(row=>row.kind==='reactive'&&row.detail.includes('12 stacks')));
  const exhausted={...data.enemies.host_14,shields:0};assert.equal(enemyDefenseVisualState(exhausted).some(row=>row.kind==='refraction'),false);
  assert.equal(enemyDefenseDescriptions(exhausted).find(row=>row.kind==='refraction').count,3);
});

test('actual defense draw queues contain only colored small particles and charge panels, with no dark disk or floor ring',()=>{
  const fx=new EnemyAbilityEffects(new THREE.Scene()),enemy={id:1,x:0,z:0,resists:{magic:.2,fire:.1},refraction:3,shields:3,statuses:{}};
  try{
    fx.sync([enemy]);
    const drawList=()=>{
      const list=new WebGLRenderList();list.init();
      fx.group.traverse(node=>{if(node.isMesh)list.push(node,node.geometry,node.material,0,0,null);});
      list.sort();return list;
    };
    const coloredParticlesOnly=list=>list.opaque.length===0&&list.transparent.length>0&&list.transparent.every(({object,material})=>material.color.getHex()!==0x0a151c&&!['CircleGeometry','RingGeometry'].includes(object.geometry.type));
    const list=drawList();assert.ok(coloredParticlesOnly(list));
    for(const batch of fx.batches.values()){
      assert.equal(batch.root.children.length,batch.panels?4:2);assert.equal(batch.backing,undefined);assert.equal(batch.ring,undefined);
      if(batch.shell){assert.equal(batch.shell.geometry.type,'SphereGeometry');assert.equal(batch.shell.count,3);assert.ok(batch.shell.material.opacity<.3);}
      assert.equal(batch.glyph.material.opacity,1);assert.equal(batch.glyph.material.blending,THREE.NormalBlending);
      assert.equal(batch.dots.material.color.getHex(),batch.glyph.material.color.getHex());
    }
    const disk=new THREE.Mesh(new THREE.CircleGeometry(1,24),new THREE.MeshBasicMaterial({color:0x0a151c,transparent:true,opacity:.86}));fx.group.add(disk);
    assert.equal(coloredParticlesOnly(drawList()),false,'an actual reintroduced black disk fails the draw-content regression');
    disk.removeFromParent();disk.geometry.dispose();disk.material.dispose();
    const glyph=fx.batches.get('magic').glyph;glyph.material.transparent=false;assert.equal(coloredParticlesOnly(drawList()),false,'opaque strokes fail the actual renderer queue regression');glyph.material.transparent=true;
    list.finish();
  }finally{fx.dispose();}
});

test('several small camera-facing glyphs and matching dots rise/fall around measured actors, freeze under reduced motion and remain private and bounded',async()=>{
  const game=arena(),enemy=spawn(game,'host_14'),loaded=await model(enemy),figure=loaded.figure;
  Object.assign(enemy,{reactiveArmor:2,reactiveStacks:1,resists:{magic:.2,fire:.1,frost:.1,poison:.1,holy:.1,arcane:.1},regen:1,recharge:.12,evasion:.25,krakenShell:30});
  figure.position.set(-8,2,-8);figure.rotation.y=.8;figure.scale.setScalar(1.2);
  const camera=new THREE.PerspectiveCamera(50,1,1,100);camera.position.set(7,12,9);camera.lookAt(-8,3,-8);camera.updateMatrixWorld(true);
  const scene=new THREE.Scene(),fx=new EnemyAbilityEffects(scene,{camera:()=>camera,balance:()=>data.balance,maxEnemies:2,maxEffects:2});
  try{
    const before=JSON.stringify(enemy);fx.sync([enemy],new Map([[enemy.id,figure]]),1);
    const expected=state(enemy);assert.equal(fx.batches.size,expected.length);
    const bounds=fx.worldBounds.clone(),size=bounds.getSize(new THREE.Vector3()),centre=bounds.getCenter(new THREE.Vector3());
    const particlesFit=()=>{
      for(const batch of fx.batches.values())for(const [object,isDot] of [[batch.glyph,false],[batch.dots,true]])for(let n=0;n<object.count;n++){
        const matrix=new THREE.Matrix4(),point=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();object.getMatrixAt(n,matrix);matrix.decompose(point,rotation,scale);
        if(scale.x>(isDot?size.y*.03:size.y*.09)||point.y<bounds.min.y+size.y*.12||point.y>bounds.max.y-size.y*.12)return false;
        const rx=Math.max(.22,size.x*.5)+Math.min(.16,Math.max(.07,size.y*.065))*.8,rz=Math.max(.22,size.z*.5)+Math.min(.16,Math.max(.07,size.y*.065))*.8;
        if(Math.abs(((point.x-centre.x)/rx)**2+((point.z-centre.z)/rz)**2-1)>1e-4)return false;
      }
      return true;
    };
    for(const row of expected){
      const batch=fx.batches.get(row.kind),centres=[];
      for(let n=0;n<batch.glyph.count;n++){
        const matrix=new THREE.Matrix4(),point=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();batch.glyph.getMatrixAt(n,matrix);matrix.decompose(point,rotation,scale);centres.push(point);
        assert.ok(rotation.normalize().angleTo(camera.getWorldQuaternion(new THREE.Quaternion()))<1e-6,'real glyph plane faces the current camera');
        assert.ok(scale.x<=size.y*.09,'glyphs remain a small fraction of actual actor height');
      }
      for(let i=0;i<centres.length;i++)for(let j=i+1;j<centres.length;j++)assert.ok(centres[i].distanceTo(centres[j])>.15,'several real glyphs occupy separate body positions');
      assert.equal(batch.glyph.material.color.getHexString(),ENEMY_DEFENSE_SYMBOLS[row.kind].color.slice(1));assert.equal(batch.glyph.material.depthTest,false);
      assert.equal(batch.glyph.count,3);assert.equal(batch.dots.count,6);assert.equal(batch.dots.material.color.getHex(),batch.glyph.material.color.getHex());assert.ok(batch.glyph.geometry.attributes.position.count>=12);
    }
    assert.ok(particlesFit(),'actual instance matrices wrap measured body bounds rather than a large camera-plane circle');
    const glyph=fx.batches.get('magic').glyph,original=new THREE.Matrix4();glyph.getMatrixAt(0,original);glyph.setMatrixAt(0,original.clone().scale(new THREE.Vector3(5,5,5)));
    assert.equal(particlesFit(),false,'mutating the real glyph matrix back to a giant symbol fails');glyph.setMatrixAt(0,original);
    const matrices=()=>[...fx.batches.values()].flatMap(batch=>[...batch.glyph.instanceMatrix.array,...batch.dots.instanceMatrix.array,...(batch.panels?.instanceMatrix.array||[])]);
    const moving=matrices(),firstY=new THREE.Vector3().setFromMatrixPosition(original).y;fx.sync([enemy],new Map([[enemy.id,figure]]),3);assert.notDeepEqual(matrices(),moving,'actual glyph positions orbit');glyph.getMatrixAt(0,original);assert.notEqual(new THREE.Vector3().setFromMatrixPosition(original).y,firstY,'actual glyph height rises and falls');assert.ok(particlesFit());
    const regen=fx.batches.get('regen');assert.equal(regen.glyph.count,3);assert.equal(regen.glyph.material.color.getHexString(),ENEMY_DEFENSE_SYMBOLS.regen.color.slice(1));assert.equal(ENEMY_DEFENSE_SYMBOLS.regen.paths[0].length,13,'several real green cross outlines are rendered');
    fx.reducedMotion=true;fx.sync([enemy],new Map([[enemy.id,figure]]),4);const still=matrices();fx.sync([enemy],new Map([[enemy.id,figure]]),400);assert.deepEqual(matrices(),still);
    assert.equal(JSON.stringify(enemy),before);
    fx.sync(Array.from({length:20},(_,i)=>({...enemy,id:i})),new Map(),500);
    for(const batch of fx.batches.values()){assert.equal(batch.count,2);assert.equal(batch.glyph.count,6);assert.equal(batch.dots.count,12);assert.equal(batch.glyph.instanceMatrix.count,6);assert.equal(batch.dots.instanceMatrix.count,12);if(batch.panels)assert.equal(batch.panels.count,6);}
    fx.isVisible=e=>!e.hidden;fx.sync([{...enemy,hidden:true},{...enemy,dead:true}],new Map(),501);for(const batch of fx.batches.values()){assert.equal(batch.glyph.count,0);assert.equal(batch.dots.count,0);if(batch.panels)assert.equal(batch.panels.count,0);}
    figure.visible=false;fx.sync([enemy],new Map([[enemy.id,figure]]),502);for(const batch of fx.batches.values())assert.equal(batch.glyph.count,0,'invisible real figures cannot leak defense particles');figure.visible=true;
    const disposals=new Map();fx.group.traverse(node=>{for(const resource of [node.geometry,node.material].filter(Boolean)){disposals.set(resource,0);resource.addEventListener('dispose',()=>disposals.set(resource,disposals.get(resource)+1));}});
    fx.dispose();fx.dispose();assert.equal(scene.children.length,0);for(const count of disposals.values())assert.equal(count,1,'owned geometry/material released exactly once');
  }finally{fx.dispose();disposeEnemyFigure(figure);disposeDecodedGeometricAsset(loaded.decoded);}
});
