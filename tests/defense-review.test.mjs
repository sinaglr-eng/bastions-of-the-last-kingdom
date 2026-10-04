import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {towerStats} from '../game/core/math.js';
import {prepareDefenseReview} from '../game/core/debug-review.js';
import {enemyDefenseVisualState} from '../game/render/enemy-defense-symbols.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL('../data/'+key+'.json',import.meta.url)))]));
const kinds=enemy=>enemyDefenseVisualState(enemy,{balance:data.balance}).map(row=>row.kind);

test('development defense lineup preserves real wave14, guard stats and spawned defenses, including the physical-immune wraith and three initial charges',()=>{
  const game=new Game(data,{seed:7}),before=JSON.stringify(data);
  game.round=1;game.lives=2;game.speed=3;game.selected=999;
  assert.equal(prepareDefenseReview(game),true);
  assert.equal(game.round,14);assert.equal(game.phase,'combat');assert.equal(game.paused,true);assert.equal(game.speed,1);assert.equal(game.lives,30);assert.equal(game.selected,null);
  assert.deepEqual(game.wave.groups,[{type:'host_14',count:14,interval:.6}]);
  assert.deepEqual(game.towers.map(t=>[t.family,t.x,t.z,t.tier,t.state]),[['soldier',12,17,1,'active'],['soldier',17,17,1,'active'],['griffinbomber',22,17,1,'active'],['rimewatch',27,17,1,'active']]);
  assert.equal(game.grid.occupied.size,4);assert.equal(game.nextId,5);assert.equal(game.combat.spawnQueue.length,0);assert.equal(game.combat.total,4);
  const enemies=game.combat.enemies;
  assert.deepEqual(enemies.map(e=>[e.type,e.x,e.z,e.shields]),[['host_14',12,20,3],['host_14',17,20,3],['host_31',22,20,3],['host_16',27,20,0]]);
  const wraith=data.enemies.host_31.variants.find(variant=>variant.physicalImmune&&!variant.magicImmune);
  for(const enemy of enemies){
    const original={...data.enemies[enemy.type],...(enemy.type==='host_31'?wraith:{})};
    for(const [key,value] of Object.entries(original))if(!['hp','speed'].includes(key))assert.deepEqual(enemy[key],value,enemy.type+' actual source '+key+' is unchanged');
    assert.equal(enemy.hp,1e8);assert.equal(enemy.maxHp,1e8);assert.equal(enemy.speed,0);assert.deepEqual(enemy.route,[{x:enemy.x,z:20},{x:enemy.x,z:19}]);assert.equal(enemy.pathLength,1);
  }
  assert.equal(enemies[2].physicalImmune,true);assert.equal(enemies[2].magicImmune,false);assert.equal(enemies[2].visualAsset,'host_31-wraith');
  for(const guard of game.towers)assert.deepEqual(towerStats(guard,game.data),towerStats({family:guard.family,tier:1},data));
  game.tick(10);assert.equal(game.combat.elapsed,0);assert.deepEqual(enemies.map(e=>e.shields),[3,3,3,0],'paused review retains the real spawn charge state');
  assert.equal(JSON.stringify(data),before,'fixture does not mutate waves, enemy sources or tower definitions');
});

test('unpaused review naturally depletes the reachable mirror, retains the first comparison and suppresses/restores real resistance by the griffin aura',()=>{
  const game=new Game(data,{seed:7}),before=JSON.stringify(data);prepareDefenseReview(game);
  const [comparison,reachable,wraith,pickpocket]=game.combat.enemies,griffin=game.towers.find(t=>t.family==='griffinbomber');
  assert.ok(kinds(pickpocket).includes('magicImmune'));
  const magicAmount=()=>enemyDefenseVisualState(wraith,{balance:data.balance}).find(row=>row.kind==='magic')?.amount;
  assert.equal(magicAmount(),.213);
  assert.equal(game.combat.targetList(game.towers[0],towerStats(game.towers[0],data)).length,0,'first soldier uses actual2.5 range, not an invented reach');
  assert.equal(game.combat.targetList(griffin,towerStats(griffin,data))[0],reachable);
  const deflected=[];game.on((kind,payload)=>{if(kind==='deflect'&&payload.enemy===reachable)deflected.push(payload.enemy.shields);});
  game.paused=false;for(let i=0;i<60;i++)game.tick(.05);
  assert.deepEqual(deflected.slice(0,3),[2,1,0]);assert.equal(reachable.shields,0);assert.equal(comparison.shields,3);assert.equal(comparison.hp,comparison.maxHp);
  assert.equal(pickpocket.magicShred,.2);assert.ok(kinds(pickpocket).includes('magicImmune'),'real magic immunity persists even when an aura applies shred');
  assert.ok(Math.abs(magicAmount()-.013)<1e-12,'the actual .213 ward is reduced by .2, leaving genuine positive protection');
  assert.ok(kinds(wraith).includes('physicalImmune'),'shred never cosmetically suppresses real immunity');
  griffin.state='ruin';game.tick(.05);assert.equal(wraith.magicShred,0);assert.equal(magicAmount(),.213);
  griffin.state='active';game.tick(.05);assert.ok(Math.abs(magicAmount()-.013)<1e-12);
  assert.equal(JSON.stringify(data),before,'inspection continues to use unchanged production combat data');
});
