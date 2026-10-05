import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {RunStatistics} from '../game/core/run-statistics.js';
import {validateSnapshot} from '../backend/validation.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const makeRun=(waveLimit=50)=>{
  const game=new Game(data,{seed:42,waveLimit}),statistics=new RunStatistics(game,{id:'00000000-0000-4000-8000-000000000016',clock:()=>1000});
  return {game,statistics};
};
const cleanSnapshot=statistics=>validateSnapshot(statistics.snapshot(),{families:data.towers,waveDefinitions:data.waves,enemyDefinitions:data.enemies});
const unit=tower=>({id:tower.id,family:tower.family,tier:tower.tier,x:tower.x,z:tower.z});
function placeFive(game,choices=null){
  const remaining=game.draft.draws.filter(draw=>!draw.placed).length;let placed=0;
  for(let z=8;z<37&&game.phase==='build';z++)for(let x=8;x<37&&game.phase==='build';x++){
    if(choices)game.draft.roundForced=choices[game.activeDraw];
    if(game.place(x,z))placed++;
  }
  game.draft.roundForced=null;assert.equal(placed,remaining);assert.equal(game.phase,'select');assert.equal(game.draft.draws.length,5);return game.roundCandidates.map(({tower})=>tower);
}
function completeActualWave(game){
  assert.equal(game.startCombat(),true);
  // Exercise every real queued spawn and death so the unmodified backend's
  // complete-wave enemy, score, health and boss-count checks remain applicable.
  while(game.combat.spawnQueue.length){
    const spawn=game.combat.spawnQueue.shift(),enemy=game.combat.spawn(spawn.type,spawn.modifiers);
    game.combat.damage(enemy,1e12,'pure',{},null);assert.equal(enemy.dead,true);
  }
  game.completeWave();
}

test('Reserve return and repeated renewal keep one birth row, omit inactive performance, and validate through ordinary ignored-wall resolution',()=>{
  const {game,statistics}=makeRun();
  const first=placeFive(game,[{family:'soldier',tier:1},{family:'cleric',tier:3},{family:'archer',tier:1},{family:'mage',tier:1},{family:'druid',tier:1}]),saved=first[1];
  const originalTile={x:saved.x,z:saved.z},route=game.grid.route;let placeEvents=0;const unsubscribe=game.on(type=>{if(type==='place')placeEvents++;});
  game.select(saved.id);assert.equal(game.reserve(),true);assert.equal(game.towers.find(tower=>tower.id===saved.id),saved);assert.equal(saved.state,'reserved');assert.deepEqual({x:saved.x,z:saved.z},originalTile);assert.equal(game.grid.route,route);game.select(first[0].id);assert.equal(game.keep(),true);
  const birth=structuredClone(statistics.draws.find(draw=>draw.id===saved.id));assert.equal(statistics.draws.length,5);
  assert.equal(game.startCombat(),true);assert.equal(statistics.current.towers.some(tower=>tower.id===saved.id),false);
  while(game.combat.spawnQueue.length){const spawn=game.combat.spawnQueue.shift(),enemy=game.combat.spawn(spawn.type,spawn.modifiers);game.combat.damage(enemy,1e12,'pure',{},null);}game.completeWave();
  assert.equal(cleanSnapshot(statistics).wavesSurvived,1);
  assert.equal(placeEvents,0);assert.equal(game.draft.draws[0].placed,true);assert.equal(game.draft.draws[0].fixedPosition,true);assert.equal(game.towers.find(tower=>tower.id===saved.id),saved);assert.equal(saved.state,'draft');assert.deepEqual({x:saved.x,z:saved.z},originalTile);
  const second=placeFive(game);assert.equal(placeEvents,4);assert.equal(second[0],saved);assert.equal(statistics.draws.length,9);assert.deepEqual(statistics.draws.find(draw=>draw.id===saved.id),birth);
  game.select(saved.id);assert.equal(game.reserve(),true);game.select(second[1].id);game.keep();completeActualWave(game);assert.equal(cleanSnapshot(statistics).wavesSurvived,2);
  const third=placeFive(game);assert.equal(placeEvents,8);assert.equal(third[0],saved);assert.deepEqual({x:saved.x,z:saved.z},originalTile);assert.equal(statistics.draws.length,13);assert.equal(statistics.draws.filter(draw=>draw.id===saved.id).length,1);
  game.select(third[1].id);game.keep();assert.equal(game.towers.find(tower=>tower.id===saved.id).state,'ruin');assert.equal(game.draft.reservedDefender,null);
  completeActualWave(game);const snapshot=cleanSnapshot(statistics);assert.equal(snapshot.wavesSurvived,3);assert.equal(snapshot.waves.some(wave=>wave.towers.some(tower=>tower.id===saved.id)),false);
  assert.equal(game.draft.draws.some(draw=>draw.origin==='reserve'),false);assert.equal(new Set(snapshot.draws.map(draw=>draw.id)).size,snapshot.draws.length);unsubscribe();statistics.dispose();
});

test('A rerolled keeper records its actual identity while the separately reserved choice cannot enter performance',()=>{
  const {game,statistics}=makeRun();placeFive(game);const births=structuredClone(statistics.draws);assert.equal(game.reroll(),true);
  const keeper=game.roundCandidates.find(({tower})=>tower.family!==births.find(draw=>draw.id===tower.id).family)?.tower;assert.ok(keeper,'The seeded reroll must change a visible candidate');
  const reserve=game.roundCandidates.find(({tower})=>tower.id!==keeper.id).tower;game.select(reserve.id);assert.equal(game.reserve(),true);game.select(keeper.id);assert.equal(game.keep(),true);
  assert.deepEqual(unit(statistics.decisions.at(-1)),unit(keeper));assert.equal(statistics.decisions.at(-1).family,keeper.family);assert.deepEqual(statistics.draws,births);
  completeActualWave(game);const snapshot=cleanSnapshot(statistics),performance=snapshot.waves[0].towers;
  assert.equal(performance.some(tower=>tower.id===reserve.id),false);assert.deepEqual(unit(performance.find(tower=>tower.id===keeper.id)),unit(keeper));statistics.dispose();
});

test('Reserve survives a rank merge and its returned keeper validates with the original identity in the next actual wave',()=>{
  const {game,statistics}=makeRun(),choices=placeFive(game,[{family:'soldier',tier:2},{family:'soldier',tier:2},{family:'cleric',tier:3},{family:'mage',tier:1},{family:'druid',tier:1}]),saved=choices[2];
  game.select(saved.id);assert.equal(game.reserve(),true);game.select(choices[0].id);assert.equal(game.merge(),true);
  assert.equal(game.phase,'ready');assert.equal(game.draft.finalDefender.tier,3);assert.equal(game.draft.reservedDefender.id,saved.id);assert.equal(game.towers.filter(tower=>tower.state==='ruin').length,3);
  completeActualWave(game);assert.equal(cleanSnapshot(statistics).decisions.at(-1).action,'combine');const second=placeFive(game);assert.equal(second[0].id,saved.id);
  game.select(saved.id);assert.equal(game.keep(),true);completeActualWave(game);const snapshot=cleanSnapshot(statistics),returned=snapshot.waves[1].towers.find(tower=>tower.id===saved.id);
  assert.equal(returned.family,saved.family);assert.equal(returned.tier,saved.tier);assert.equal(snapshot.draws.filter(draw=>draw.id===saved.id).length,1);assert.equal(snapshot.decisions.at(-1).id,saved.id);assert.equal(snapshot.decisions.at(-1).action,'keep');statistics.dispose();
});

test('Move retains identity and its one birth record while wave performance records the new wall destination',()=>{
  const {game,statistics}=makeRun(),choices=placeFive(game),defender=choices[0];game.select(defender.id);game.keep();
  const wall=game.towers.find(tower=>tower.state==='ruin'),births=structuredClone(statistics.draws),destination={x:wall.x,z:wall.z};
  assert.equal(game.beginMove(),true);assert.equal(game.selectMove(defender.id),true);assert.equal(game.selectMove(wall.id),true);assert.equal(game.commandPoints.value,1);
  assert.deepEqual(statistics.draws,births);assert.deepEqual({x:defender.x,z:defender.z},destination);completeActualWave(game);
  const performance=cleanSnapshot(statistics).waves[0].towers.find(tower=>tower.id===defender.id);assert.deepEqual(unit(performance),unit(defender));statistics.dispose();
});

test('A complete 50-wave run with repeatedly carried identities keeps IDs within 250 and passes the unchanged final-run validator',()=>{
  const {game,statistics}=makeRun();let reserves=0,returned=0;
  while(!['won','lost'].includes(game.phase)){
    if(game.draft.draws[0].origin==='reserve')returned++;
    const choices=placeFive(game);
    if(game.commandPoints.canSpend('reserve')){game.select(choices[4].id);assert.equal(game.reserve(),true);reserves++;}
    game.select(choices[0].id);assert.equal(game.keep(),true);completeActualWave(game);
    const checkpoint=cleanSnapshot(statistics);assert.ok(checkpoint.draws.every(draw=>draw.id<=250));assert.equal(new Set(checkpoint.draws.map(draw=>draw.id)).size,checkpoint.draws.length);
  }
  const snapshot=cleanSnapshot(statistics);assert.equal(game.phase,'won');assert.equal(snapshot.outcome,'won');assert.equal(snapshot.wavesSurvived,50);assert.equal(snapshot.waves.length,50);
  assert.ok(reserves>3);assert.ok(returned>3);assert.equal(snapshot.draws.length,250-returned);assert.ok(game.nextId<=251);assert.equal(snapshot.waves.reduce((sum,wave)=>sum+wave.bossKills,0),5);
  assert.equal(game.commandPoints.value,data.balance.commandPoints.starting+5*data.balance.commandPoints.bossReward-reserves*data.balance.commandPoints.costs.reserve);assert.equal(game.draft.reservedDefender,null);statistics.dispose();
});
