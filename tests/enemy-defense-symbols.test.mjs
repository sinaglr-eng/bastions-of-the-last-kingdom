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

test('actual wave14 spawn shows three shield panels despite existing model shards, deflects3→0 and restores3 two seconds after depletion',async()=>{
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
    game.tick(1.999);sync(0);game.tick(.001);assert.equal(enemy.shields,3);sync(3);
    enemy.shields=0;game.combat.damage(enemy,1,'physical',{});sync(0);
  }finally{fx.dispose();disposeEnemyFigure(loaded.figure);disposeDecodedGeometricAsset(loaded.decoded);disposeFallback(fallback);}
});

test('actual Magical immunity remains visible while obsolete resistance/ward/shred fields cannot invent a defense',()=>{
  const game=arena(),enemy=spawn(game,'host_16'),fx=new EnemyAbilityEffects(new THREE.Scene(),{balance:data.balance});
  try{
    assert.deepEqual(kinds(enemy),['magicImmune']);assert.equal(enemy.resists,undefined);assert.deepEqual(enemyDefenseDescriptions(data.enemies.host_16).map(row=>row.kind),['magicImmune']);
    Object.assign(enemy,{resists:{magic:.9,fire:.7},ward:.9,magicShred:.2});fx.sync([enemy]);assert.equal(fx.batches.get('magicImmune').glyph.count,3);assert.equal(fx.batches.has('magic'),false);
    const source=tower('griffinbomber');game.towers=[source];game.tick(.01);
    assert.deepEqual(kinds(enemy),['magicImmune']);fx.sync([enemy]);assert.equal(fx.batches.get('magicImmune').glyph.count,3);assert.equal(fx.batches.has('magic'),false);
    assert.equal(game.combat.damage(enemy,40,'magical',{}),0);assert.ok(game.combat.damage(enemy,40,'holy',{})>0,'Holy bypasses immunity while armor still applies');
    source.x=17.001;game.tick(.01);assert.deepEqual(kinds(enemy),['magicImmune']);
  }finally{fx.dispose();}
});

test('real fixed armor aura reductions suppress effective reactive protection, then restore it outside range or after resume',()=>{
  const game=arena();
  const reactive=spawn(game,'host_24');game.combat.damage(reactive,10,'physical',{directHit:true});
  assert.ok(kinds(reactive).includes('reactive'));
  const breaker=tower('mechanicalgolem');game.towers=[breaker];game.tick(.01);assert.equal(reactive.armorShred,30);assert.equal(kinds(reactive).includes('reactive'),false);
  breaker.x=22.001;game.tick(.01);assert.equal(reactive.armorShred,0);assert.ok(kinds(reactive).includes('reactive'));
  breaker.x=10;breaker.attackPaused=true;game.tick(.01);assert.equal(reactive.armorShred,0);assert.ok(kinds(reactive).includes('reactive'));
  breaker.attackPaused=false;game.tick(.01);assert.equal(reactive.armorShred,30);assert.equal(kinds(reactive).includes('reactive'),false);
  game.towers=[];reactive.statuses.shred={amount:1e5,time:.01};game.tick(.02);game.combat.prepareArmor(reactive);assert.ok(kinds(reactive).includes('reactive'),'the symbol returns after real fixed-shred expiry');
  reactive.mvpArmorReduction=1;assert.equal(kinds(reactive).includes('reactive'),true,'An obsolete MVP field cannot suppress actual reactive armor');reactive.mvpArmorReduction=0;
  reactive.reactiveStacks=0;assert.equal(kinds(reactive).includes('reactive'),false,'ordinary armor cannot retain a reactive shield');
});

test('obsolete ward never creates a symbol while healing-block, regeneration and periodic healing follow actual availability',()=>{
  const game=arena(),enemy=spawn(game,'host_02'),warlock=spawn(game,'warlock');
  warlock.x=12;game.tick(.01);assert.equal(enemy.ward,undefined);assert.deepEqual(kinds(enemy),[]);enemy.ward=.9;enemy.resists={magic:.9};assert.deepEqual(kinds(enemy),[]);

  const regen=spawn(game,'host_15'),recharge=spawn(game,'host_32');regen.hp-=50;recharge.hp-=50;
  for(const e of [regen,recharge])game.combat.applyEffects(e,{healingBlockDuration:.2});
  recharge.rechargeClock=.01;const oldHp=[regen.hp,recharge.hp];game.tick(.02);
  assert.equal(kinds(regen).includes('regen'),false);assert.equal(kinds(recharge).includes('recharge'),false);assert.deepEqual([regen.hp,recharge.hp],oldHp);
  game.tick(.3);assert.ok(kinds(regen).includes('regen'));assert.ok(regen.hp>oldHp[0]);
  assert.ok(kinds(recharge).includes('recharge'),'available periodic healing stays readable between recharge ticks');
  const before=recharge.hp;game.tick(8);assert.ok(recharge.hp>before,'actual periodic healing resumes on its next tick');
});

test('the live Dread symbol describes the real on-hit modifier independently of each target range',()=>{
  const game=arena(),enemy=spawn(game,'host_17'),guard={...tower('soldier'),cooldown:10};game.towers=[guard];
  assert.ok(kinds(enemy).includes('untouchable'));assert.equal(state(enemy).find(row=>row.kind==='untouchable').amount,enemy.untouchable);
  assert.equal(enemyDefenseDescriptions(data.enemies.host_17).filter(row=>row.kind==='untouchable').length,1);
  game.tick(.1);assert.ok(Math.abs(guard.cooldown-9.9)<1e-12,'Proximity alone does not slow a guard');
  game.combat.damage(enemy,1,'holy',{},guard);enemy.x=30;guard.cooldown=10;game.tick(.1);assert.ok(Math.abs(guard.cooldown-(10-.1*(1-enemy.untouchable)))<1e-12,'Actual damaging hit slows the guard after the enemy moves far away');
  assert.ok(kinds(enemy).includes('untouchable'),'available enemy ability does not depend on one target being in range');
  assert.equal(kinds({...enemy,untouchable:0}).includes('untouchable'),false);
});

test('all three real direct-hit classes face shields, evasion and armor-then-Shell; Holy bypasses only the two damage immunities',()=>{
  const game=arena(),enemy=spawn(game,'host_01');Object.assign(enemy,{hp:1e6,maxHp:1e6,armor:60,shields:3,refraction:3,evasion:0,krakenShell:20});
  for(const type of ['physical','magical','holy']){
    const result=game.combat.resolveDamage(enemy,100,type,{directHit:true});assert.equal(result.blockReason,'shield');assert.equal(result.appliedDamage,0);
  }
  assert.equal(enemy.shields,0);assert.ok(!kinds(enemy).includes('refraction'),'The depleted native shield marker matches actual hits');
  enemy.evasion=1;game.rng=()=>0;
  for(const type of ['physical','magical','holy'])assert.equal(game.combat.resolveDamage(enemy,100,type,{directHit:true}).blockReason,'evasion');
  assert.ok(kinds(enemy).includes('evasion'));
  for(const type of ['physical','magical','holy']){
    const result=game.combat.resolveDamage(enemy,100,type,{directHit:true,trueStrike:true});
    assert.equal(result.blockReason,null);assert.equal(result.effectiveArmor,60);assert.ok(Math.abs(result.afterArmor-100*30/90)<1e-10);assert.equal(result.shellBlock,20);assert.ok(Math.abs(result.appliedDamage-(100*30/90-20))<1e-10);
  }
  enemy.physicalImmune=true;enemy.magicImmune=true;
  assert.equal(game.combat.resolveDamage(enemy,100,'physical',{directHit:true,trueStrike:true}).blockReason,'physical-immunity');assert.equal(game.combat.resolveDamage(enemy,100,'magical',{directHit:true,trueStrike:true}).blockReason,'magic-immunity');
  const holy=game.combat.resolveDamage(enemy,100,'holy',{directHit:true,trueStrike:true});assert.ok(Math.abs(holy.afterArmor-100*30/90)<1e-10);assert.equal(holy.shellBlock,20);assert.ok(Math.abs(holy.appliedDamage-(100*30/90-20))<1e-10);
  const descriptions=enemyDefenseDescriptions(enemy,{balance:data.balance});assert.match(descriptions.find(row=>row.kind==='evasion').detail,/Physical, Magical and Holy direct hits/);assert.match(descriptions.find(row=>row.kind==='krakenShell').detail,/after armor.*Physical, Magical and Holy direct hit/);
  assert.ok(game.combat.damage(enemy,100,'holy',{})>holy.appliedDamage,'Actual DOT/aura damage does not consume direct-hit Shell');
});

test('native defense descriptions use isolated console timings and stack limits, including valid zero decay',()=>{
  const balance={...data.balance,enemyRules:{refraction:{period:5},recharge:{period:3},reactive:{maxStacks:4,decayPerSecond:0},dread:{duration:7}}};
  const rows=enemyDefenseDescriptions({hp:100,armor:20,refraction:3,recharge:.5,reactiveArmor:8,untouchable:.75},{balance});
  assert.match(rows.find(row=>row.kind==='refraction').detail,/5s after the final charge is spent/);assert.match(rows.find(row=>row.kind==='recharge').detail,/50% missing HP every 3s/);assert.match(rows.find(row=>row.kind==='reactive').detail,/4 stacks \(32 armor\); decays 0 stacks\/s/);assert.match(rows.find(row=>row.kind==='untouchable').detail,/7s.*no range limit/);
  assert.match(enemyDefenseDescriptions(data.enemies.host_14).find(row=>row.kind==='refraction').detail,/2s after the final charge is spent/,'Global depletion delay remains unchanged');
});

test('only real defense layers remain across obsolete resistance caps, fixed shred, MVP reduction, immunity and fractional shield charges',()=>{
  const base={armor:30,reactiveArmor:2,reactiveStacks:4,resists:{magic:.3,fire:.2,frost:.1,poison:.08,holy:.07,arcane:.06},ward:.18,magicShred:0,statuses:{},regen:5,recharge:.12,evasion:.25,krakenShell:66,shields:.5};
  for(const rules of [data.balance,{...data.balance,maxResistance:.40}])for(const magicShred of [0,.2,.5,.7,1]){
    const enemy={...base,magicShred},before=structuredClone(enemy),states=enemyDefenseVisualState(enemy,{balance:rules});
    assert.ok(states.every(row=>!['magic','fire','frost','poison','holy','arcane'].includes(row.kind)));assert.equal(ENEMY_DEFENSE_SYMBOLS.magic,undefined);
    const armor=30+2*4;for(const kind of ['physical','magical','holy'])assert.ok(Math.abs(damageAfterDefense(1,kind,enemy,{},rules)-rules.armorConstant/(rules.armorConstant+armor))<1e-12);
    assert.deepEqual(enemy,before);assert.equal(states.find(row=>row.kind==='refraction').count,1,'a fractional positive charge still absorbs one direct hit');
  }
  const immune={...base,magicImmune:true,physicalImmune:true,statuses:{healBlock:{time:1}},shields:0};
  const states=enemyDefenseVisualState(immune);
  assert.ok(states.some(row=>row.kind==='physicalImmune')&&states.some(row=>row.kind==='magicImmune'));
  assert.ok(states.some(row=>row.kind==='reactive'),'actual armor remains independently readable under immunity');assert.ok(states.every(row=>!['magic','fire','frost','poison','holy','arcane'].includes(row.kind)));
  assert.ok(!states.some(row=>['regen','recharge'].includes(row.kind)),'real healing block still hides both healing defenses');
  assert.equal(damageAfterDefense(1,'physical',immune,{},data.balance),0);assert.equal(damageAfterDefense(1,'magical',immune,{},data.balance),0);assert.ok(damageAfterDefense(1,'holy',immune,{},data.balance)>0&&damageAfterDefense(1,'holy',immune,{},data.balance)<1);
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
  const reactiveDescription=enemyDefenseDescriptions(reactive).find(row=>row.kind==='reactive');
  assert.match(reactiveDescription.detail,/8 armor per direct hit, up to 15 stacks \(120 armor\)/);
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
    const glyph=fx.batches.get('refraction').glyph;glyph.material.transparent=false;assert.equal(coloredParticlesOnly(drawList()),false,'opaque strokes fail the actual renderer queue regression');glyph.material.transparent=true;
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
    const glyph=fx.batches.get('reactive').glyph,original=new THREE.Matrix4();glyph.getMatrixAt(0,original);glyph.setMatrixAt(0,original.clone().scale(new THREE.Vector3(5,5,5)));
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
