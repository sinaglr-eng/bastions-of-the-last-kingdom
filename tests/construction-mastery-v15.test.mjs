import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {EconomyManager,constructionMasteryForRound,CONSTRUCTION_MASTERY_TARGET_ROUND} from '../game/core/progression.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL('../data/'+key+'.json',import.meta.url)))]));
const expected=[0,0,1,1,2,3,3,4,5,5,6,6,7,8,8,9,10,10,11,11,12,13,13,14,15];

test('construction schedule starts at zero, reaches15 exactly at round25, stays capped and never rescales a short campaign',()=>{
  assert.equal(CONSTRUCTION_MASTERY_TARGET_ROUND,25);
  assert.deepEqual(expected.map((_,index)=>constructionMasteryForRound(index+1,data.balance)),expected);
  for(const round of [26,50,Number.MAX_SAFE_INTEGER])assert.equal(constructionMasteryForRound(round,data.balance),15);
  const short=new Game(data,{waveLimit:10});assert.equal(short.economy.mastery,0);
  for(let round=1;round<10;round++){short.phase='ready';short.startCombat();short.completeWave();}
  assert.equal(short.round,10);assert.equal(short.economy.mastery,5);assert.equal(short.draft.mastery,5,'Ten-wave mode retains the same wave25 target');
});

test('round advancement is monotonic and atomic; XP, gold and invalid inputs cannot change its schedule or weights',()=>{
  const before=JSON.stringify(data.balance),economy=new EconomyManager(data.balance);
  economy.reward(25,100000);assert.equal(economy.mastery,0);assert.equal(economy.level,1+Math.floor(100000/90));
  assert.equal(economy.setConstructionRound(20),11);assert.equal(economy.setConstructionRound(8),11);assert.equal(economy.constructionRound,20);
  const snapshot=JSON.stringify(economy);for(const round of [0,-1,1.5,NaN,Infinity,'25',null,undefined]){assert.throws(()=>economy.setConstructionRound(round),RangeError);assert.equal(JSON.stringify(economy),snapshot);}
  economy.spend(economy.gold);assert.equal(economy.mastery,11);assert.equal(economy.setConstructionRound(25),15);assert.equal(economy.nextMastery(),null);assert.equal(economy.upgradeMastery(),false);assert.equal(JSON.stringify(data.balance),before);
});

test('actual kill and leak outcomes yield the same five-draw odds before combat in round25, despite different Kingdom XP',()=>{
  const original=JSON.stringify(data),runs=[];
  for(const outcome of ['kill','leak']){
    const game=new Game(data,{seed:4});
    for(let round=1;round<=25;round++){
      assert.equal(game.phase,'build');assert.equal(game.round,round);assert.equal(game.economy.constructionRound,round);assert.equal(game.economy.mastery,expected[round-1]);assert.equal(game.draft.mastery,expected[round-1]);assert.equal(game.draft.draws.length,5);
      assert.ok(game.draft.draws.every(draw=>!draw.family&&!draw.tier));
      if(round===25)break;
      game.phase='ready';assert.equal(game.startCombat(),true);game.combat.spawnQueue=[];
      const enemy=game.combat.spawn('host_01');enemy.speed=0;
      if(outcome==='kill')game.combat.damage(enemy,enemy.hp+1,'pure',{},null);else enemy.pathIndex=enemy.route.length;
      game.tick(0);
    }
    assert.equal(game.phase,'build');assert.equal(game.combat.spawned,1,'Wave25 combat has not started');assert.equal(game.draft.mastery,15);assert.deepEqual(data.balance.mastery[game.draft.mastery].weights,[4,18,27,31,20,0]);
    runs.push(game);
  }
  assert.equal(runs[0].kills,24);assert.equal(runs[1].leaks,24);assert.ok(runs[1].lives>0);assert.notEqual(runs[0].economy.xp,runs[1].economy.xp);assert.equal(runs[0].economy.mastery,runs[1].economy.mastery);assert.equal(JSON.stringify(data),original);
});

test('recipe unlocks still use actual Kingdom level rather than round-based construction mastery',()=>{
  const recipe={...structuredClone(data.recipes[0]),level:3,currentRoundOnly:false},fixture={...data,recipes:[recipe]},game=new Game(fixture,{seed:4});
  game.towers=recipe.ingredients.map((piece,index)=>({...piece,id:index+1,x:index+4,z:10,state:'active',kills:0}));game.select(game.towers[0].id);
  game.economy.setConstructionRound(25);assert.equal(game.economy.mastery,15);assert.equal(game.economy.level,1);assert.deepEqual(game.availableRecipes(),[],'High construction odds cannot bypass a recipe Kingdom gate');
  game.economy.reward(0,180);assert.equal(game.economy.level,3);assert.equal(game.economy.mastery,15);assert.deepEqual(game.availableRecipes().map(row=>row.id),[recipe.id]);
});
