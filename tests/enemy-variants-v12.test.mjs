import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {seededRandom} from '../game/core/math.js';
import {currentWarbandInfo,configuredWarbandInfo} from '../game/core/warband-info.js';
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL('../data/'+key+'.json',import.meta.url)))]));
function arena(type,count=19){const game=new Game(data,{seed:420});game.phase='combat';game.round=Number(type.slice(5));const wave={hp:1.25,groups:[{type,count,interval:.01,speed:.75,armor:3,resists:{fire:.2}}]};return {game,wave};}
const selectedNames=game=>game.combat.spawnQueue.map(row=>row.modifiers.variant?.name||data.enemies[row.type].name);

test('every active multi-variant type rolls independently for every queued enemy and actual spawn keeps that choice',()=>{
  const before=JSON.stringify(data),types=Object.entries(data.enemies).filter(([,base])=>base.variants?.length>1);
  assert.equal(types.length,11);
  for(const [type,base]of types){
    const {game,wave}=arena(type),rolls=Array.from({length:19},(_,i)=>(i%base.variants.length+.25)/base.variants.length);let calls=0;game.rng=()=>rolls[calls++];game.combat.start(wave);
    assert.equal(calls,19,type+' consumes one independent roll per enemy');
    const queue=[...game.combat.spawnQueue];assert.deepEqual(selectedNames(game),rolls.map(r=>base.variants[Math.floor(r*base.variants.length)].name));
    const chosen=queue.map(row=>configuredWarbandInfo({...base,type},row.modifiers));game.combat.update(.5);
    assert.equal(game.combat.spawnQueue.length,0);assert.equal(game.combat.enemies.length,19);assert.equal(calls,19,'Spawning never rolls a second time');
    game.combat.enemies.forEach((enemy,i)=>{assert.equal(enemy.name,chosen[i].name);assert.equal(enemy.maxHp,chosen[i].maxHp);assert.equal(enemy.armor,chosen[i].armor);assert.equal(enemy.speed,chosen[i].speed);assert.equal(enemy.resists.fire,.2);assert.equal(enemy.visualAsset,queue[i].modifiers.variant.visualAsset);});
  }
  assert.equal(JSON.stringify(data),before,'Wave rolls, overrides and spawning leave shared definitions untouched');
});

test('seeded per-enemy composition is repeatable without forcing a fixed mixed ratio',()=>{
  const run=seed=>{const {game,wave}=arena('host_31',41);game.rng=seededRandom(seed);game.combat.start(wave);return selectedNames(game);};
  assert.deepEqual(run(77),run(77));assert.notDeepEqual(run(77),run(78));
  const {game,wave}=arena('host_31',23);let calls=0;game.rng=()=>{calls++;return .999;};game.combat.start(wave);assert.equal(calls,23);assert.ok(selectedNames(game).every(name=>name===data.enemies.host_31.variants[1].name),'A legitimate all-one-variant random outcome stays all-one-variant');
});

test('explicit scenario and debug variants stay exact and every queued snapshot and live actor is independent',()=>{
  const base=data.enemies.host_28,manual={...base.variants[1],resists:{holy:.4}},before=JSON.stringify(manual),{game,wave}=arena('host_28',3);wave.groups[0].variant=manual;game.rng=()=>assert.fail('Explicit manual variants consume no random roll');game.combat.start(wave);
  const queue=game.combat.spawnQueue;assert.notEqual(queue[0].modifiers.variant,manual);assert.notEqual(queue[0].modifiers.variant,queue[1].modifiers.variant);queue[0].modifiers.variant.resists.holy=.9;assert.equal(queue[1].modifiers.variant.resists.holy,.4);assert.equal(JSON.stringify(manual),before);
  const enemy=game.combat.spawn('host_28',{variant:manual,hp:2});assert.equal(enemy.name,manual.name);assert.equal(enemy.color,'#667e91');assert.equal(enemy.hp,base.hp*2);assert.equal(enemy.maxHp,enemy.hp);assert.equal(enemy.reactiveArmor,0);assert.equal(enemy.stealth,true);assert.equal(enemy.cloaked,true);assert.deepEqual(enemy.traits,['stealth']);
  enemy.traits.push('local-only');enemy.resists.holy=0;assert.equal(JSON.stringify(manual),before);assert.deepEqual(base.traits,['reactiveArmor']);
  const normal=game.combat.spawn('host_28',{variant:base.variants[0]});assert.equal(normal.reactiveArmor,8);assert.equal(normal.stealth,undefined);assert.equal(normal.cloaked,false);assert.equal(normal.color,base.color);
});

test('live sidebar counts each actual immunity variant across living and queued enemies without concealed locations',()=>{
  const {game,wave}=arena('host_31',6);game.rng=(()=>{let n=0;return ()=>n++%2?.9:.1;})();game.combat.start(wave);
  // The live game getter refers to its real wave31, whose enemy type matches
  // this bounded six-invader schedule. Counts come from actual queue/actors.
  let info=currentWarbandInfo(game);assert.equal(info.length,2);assert.deepEqual(info.map(row=>row.count).sort(),[3,3]);assert.ok(info.every(row=>row.liveCount===0&&row.queuedCount===3));
  const first=game.combat.spawnQueue.shift(),enemy=game.combat.spawn(first.type,first.modifiers);info=currentWarbandInfo(game);const row=info.find(row=>row.name===enemy.name);assert.equal(row.count,3);assert.equal(row.liveCount,1);assert.equal(row.queuedCount,2);
  enemy.dead=true;info=currentWarbandInfo(game);assert.equal(info.find(row=>row.name===enemy.name).count,2);assert.equal(info.reduce((n,row)=>n+row.count,0),5);
  assert.ok(info.every(row=>!('x' in row)&&!('z' in row)&&!('enemy' in row)&&!('route' in row)),'Only composition metadata is public');
  const magic=info.find(row=>row.traits.includes('Immune to magic and magical effects')),physical=info.find(row=>row.traits.includes('Immune to physical and piercing damage'));assert.ok(magic&&physical);assert.ok(!magic.traits.includes('Immune to physical and piercing damage')&&!physical.traits.includes('Immune to magic and magical effects'));
  game.combat.spawnQueue=[];game.combat.enemies.forEach(enemy=>enemy.dead=true);assert.deepEqual(currentWarbandInfo(game),[],'An exhausted actual combat group never invents a surviving variant');
});

test('repeated groups and same-name enemies with different effective stats retain exact separate remaining counts',()=>{
  const {game,wave}=arena('host_15',2);wave.groups.push({...wave.groups[0],count:3,hp:2});game.rng=()=>.1;game.combat.start(wave);
  const info=currentWarbandInfo(game);assert.equal(info.length,2);assert.deepEqual(info.map(row=>row.count).sort(),[2,3]);assert.ok(info.every(row=>row.name===data.enemies.host_15.name));assert.deepEqual(info.map(row=>row.maxHp).sort((a,b)=>a-b),[data.enemies.host_15.hp*1.25,data.enemies.host_15.hp*2]);assert.equal(info.reduce((sum,row)=>sum+row.count,0),5,'Repeated type groups are counted once per actual enemy');
});

test('Zaruun only spawns the active normal boss and consumes no variant randomness',()=>{
  assert.equal(data.enemies.host_30.variants,undefined);const {game,wave}=arena('host_30',1);game.rng=()=>assert.fail('Single-form Zaruun has no random variant');game.combat.start(wave);const pending=game.combat.spawnQueue[0];const enemy=game.combat.spawn(pending.type,pending.modifiers);assert.equal(enemy.name,data.enemies.host_30.name);assert.equal(enemy.visualAsset,'host_30');assert.equal(enemy.color,data.enemies.host_30.color);assert.equal(enemy.boss,true);assert.equal(enemy.maxHp,data.enemies.host_30.hp*1.25);
});
