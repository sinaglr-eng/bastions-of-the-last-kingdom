import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));

test('completed ordinary, boss and final waves pay exactly once, with no dependence on kills',()=>{
 for(const [round,reward]of [[1,50],[9,50],[10,200],[50,200]]){
   const game=new Game(data,{seed:4});game.round=round;game.phase='ready';game.startCombat();
   const gold=game.economy.gold;game.completeWave();
   assert.equal(game.economy.gold,gold+reward);assert.equal(game.lastReward,reward);
   assert.equal(game.economy.xp,15);game.completeWave();assert.equal(game.economy.gold,gold+reward);
   assert.equal(game.phase,round===50?'won':'build');
 }
 for(const wave of data.waves)assert.equal(wave.reward,wave.boss?200:50);
});

test('kills grant XP and score once without adding gold; champion procs cannot mint gold',()=>{
 const game=new Game(data,{seed:4});game.phase='ready';game.startCombat();
 const enemy=game.combat.spawn('host_01'),gold=game.economy.gold,xp=game.economy.xp;
 game.combat.damage(enemy,enemy.hp+1,'pure',{},null);
 assert.equal(game.economy.gold,gold);assert.equal(game.economy.xp,xp+enemy.xp);assert.equal(game.kills,1);assert.equal(game.score,10);
 game.combat.damage(enemy,1e9,'pure',{},null);assert.equal(game.economy.xp,xp+enemy.xp);
 game.rng=()=>0;game.combat.landedProcs({goldChance:1,goldMin:500,goldMax:500},{id:99});assert.equal(game.economy.gold,gold);
});

test('Kingdom-based mastery jumps and caps automatically while spending gold cannot alter it',()=>{
 const game=new Game(data),eco=game.economy;
 eco.reward(0,90*8+89);assert.equal(eco.level,9);assert.equal(eco.mastery,8);
 eco.spend(eco.gold);assert.equal(eco.mastery,8);assert.equal(eco.gold,0);
 eco.reward(0,1);assert.equal(eco.level,10);assert.equal(eco.mastery,9);
 eco.reward(0,90*100);assert.equal(eco.mastery,15);assert.equal(eco.nextMastery(),null);
 assert.equal(eco.upgradeMastery(),false);
});
