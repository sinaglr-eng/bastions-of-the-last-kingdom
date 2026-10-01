import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {towerStats,damageAfterDefense} from '../game/core/math.js';
import {upcomingInvader} from '../game/render/warcamp-preview.js';
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
const unit=(family,id=1,x=10,z=10)=>({id,family,tier:1,state:'active',x,z,kills:0,cooldown:999});
function arena(){const game=new Game(data,{seed:42});game.phase='combat';game.combat.spawnQueue=[{time:9999,type:'grunt'}];return game;}
function hidden(game){const enemy=game.combat.spawn('host_08');Object.assign(enemy,{x:12,z:12,speed:0,hp:1e6,maxHp:1e6,armor:0,resists:{}});return enemy;}

test('render visibility and all defenders share active detection, lost when the detector leaves',()=>{
  const game=arena(),enemy=hidden(game),far=unit('mage',1,18,12),cleric=unit('cleric',2,12,17);game.towers=[far];
  assert.equal(game.combat.isRevealed(enemy),false);assert.equal(game.combat.targetList(far,{range:20}).length,0);
  cleric.state='draft';game.towers.push(cleric);assert.equal(game.combat.isRevealed(enemy),false);
  cleric.state='active';assert.equal(game.combat.isRevealed(enemy),true);assert.equal(game.combat.canSee(enemy,far),true);
  cleric.state='ruin';assert.equal(game.combat.isRevealed(enemy),false);
  far.x=13;assert.equal(game.combat.isRevealed(enemy),true);
  enemy.cloaked=false;far.x=30;assert.equal(game.combat.isRevealed(enemy),true);
});

test('recloaked target rejects an in-flight hit and its positional impact event',()=>{
  const game=arena(),enemy=hidden(game),mage=unit('mage',1,18,12);game.towers=[mage];let impacts=0;game.on(type=>{if(type==='impact')impacts++;});
  game.combat.impact({source:mage,target:enemy,stats:towerStats(mage,data)});
  assert.equal(enemy.hp,1e6);assert.equal(impacts,0);
  enemy.cloaked=false;game.combat.impact({source:mage,target:enemy,stats:towerStats(mage,data)});assert.ok(enemy.hp<1e6);assert.equal(impacts,1);
});

test('splash and burning area damage cannot newly strike an unrevealed invader',()=>{
  const game=arena(),enemy=hidden(game),dragon=unit('embercrown',1,16,12);game.towers=[dragon];
  const visible=game.combat.spawn('grunt');Object.assign(visible,{x:12.5,z:12,speed:0,hp:1e6,maxHp:1e6,armor:0,resists:{}});
  game.combat.impact({source:dragon,target:visible,stats:{damage:100,type:'fire',splash:2,color:'#fff'}});
  assert.equal(enemy.hp,1e6);assert.equal(visible.hp,1e6-100);
  game.combat.update(.1);assert.equal(enemy.hp,1e6);assert.ok(visible.hp<1e6-100);
});

test('damage categories independently apply armor, typed magic resistance and pure bypass',()=>{
  const foe={armor:30,resists:{magic:.2,fire:.3},ward:.1,magicShred:.15,armorShred:10};
  assert.equal(damageAfterDefense(100,'physical',foe,{},data.balance),60);
  assert.equal(damageAfterDefense(100,'piercing',foe,{penetration:.5},data.balance),75);
  assert.ok(Math.abs(damageAfterDefense(100,'fire',foe,{},data.balance)-55)<1e-8);
  assert.ok(Math.abs(damageAfterDefense(100,'arcane',foe,{},data.balance)-85)<1e-8);
  assert.equal(damageAfterDefense(100,'pure',{...foe,magicImmune:true,physicalImmune:true}, {},data.balance),100);
});

test('camp previews construction wave and subsequent combat wave without consuming random draws',()=>{
  const game=new Game(data,{seed:42});let calls=0;game.rng=()=>{calls++;return .5;};
  const initial=upcomingInvader(game);assert.equal(initial.type,game.wave.groups[0].type);assert.equal(initial.previewRound,1);
  game.phase='combat';assert.equal(upcomingInvader(game).type,data.waves[1].groups[0].type);assert.equal(calls,0);
  game.round=game.waveLimit;assert.equal(upcomingInvader(game),null);game.phase='won';assert.equal(upcomingInvader(game),null);
});
