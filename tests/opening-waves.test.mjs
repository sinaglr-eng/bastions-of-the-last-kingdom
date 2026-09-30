import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {Game} from '../game/core/game.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
const basicFamilies=Object.keys(data.towers).filter(id=>!data.towers[id].advanced);
const formations={
  crossing:[{x:17,z:18},{x:18,z:17},{x:19,z:18}],
  checkpoint:[{x:5,z:19},{x:6,z:19},{x:5,z:20}]
};

function keepBasic(game,family,position){
  game.draft.forced={family,tier:1};game.draft.roll(0);
  assert.ok(game.place(position.x,position.z));const keeper=game.selection;
  for(let i=0;i<4;i++)assert.ok(game.place(30+i,26+game.round));
  game.select(keeper.id);assert.ok(game.keep());assert.ok(game.startCombat());
  let steps=0;
  while(game.phase==='combat'&&steps++<5000)game.tick(.05);
  assert.notEqual(game.phase,'combat','opening patrol must finish');
}

test('each opening patrol is manageable with one new Tier I defender per round at a crossing or checkpoint',()=>{
  for(const family of basicFamilies)for(const [layout,positions] of Object.entries(formations)){
    const game=new Game(data,{seed:4});
    for(let round=1;round<=3;round++){
      keepBasic(game,family,positions[round-1]);
      assert.equal(game.leaks,0,`${family} I, ${layout}, wave ${round}`);
      assert.equal(game.lives,data.balance.startingLives);
      assert.equal(game.towers.filter(t=>t.state==='active').length,round);
      assert.equal(game.grid.occupied.size,round*5);
    }
    assert.equal(game.kills,25);
  }
});

test('opening patrols still punish placing the keeper away from the route',()=>{
  const game=new Game(data,{seed:4});
  keepBasic(game,'cleric',{x:0,z:36});
  assert.equal(game.kills,0);assert.equal(game.leaks,8);
  assert.equal(game.lives,data.balance.startingLives-8);
});

test('introductory tuning preserves campaign income, count, movement and increasing pressure',()=>{
  const patrols=data.waves.slice(0,3).map(w=>data.enemies[w.groups[0].type]);
  assert.deepEqual(data.waves.slice(0,3).map(w=>w.groups[0].count),[8,8,9]);
  assert.deepEqual(data.waves.slice(0,3).map(w=>w.reward),[29,36,43]);
  for(const e of patrols){
    assert.equal(e.gold,3);assert.equal(e.xp,3);assert.equal(e.leak,1);
    assert.equal(e.flying,false);assert.equal(e.armor,0);assert.deepEqual(e.traits,[]);
    assert.ok(!e.resists||Object.values(e.resists).every(r=>r===0));
  }
  for(let i=1;i<3;i++){
    assert.ok(patrols[i].hp>patrols[i-1].hp);assert.ok(patrols[i].speed>patrols[i-1].speed);
    assert.ok(data.waves[i].groups[0].interval<data.waves[i-1].groups[0].interval);
  }
  assert.ok(patrols[2].hp<data.enemies.host_04.hp);
});

test('campaign authoring reproduces checked-in enemy and wave tuning without reverting the opening patrols',()=>{
  const writes=new Map(),source=readFileSync(new URL('../tools/author-campaign.mjs',import.meta.url),'utf8').replace(/^import[^\n]*\n/,'');
  runInNewContext(source,{
    readFileSync:path=>{assert.equal(path,'data/enemies.json');return JSON.stringify(data.enemies);},
    writeFileSync:(path,content)=>writes.set(path,content),console:{log(){}}
  });
  assert.deepEqual(JSON.parse(writes.get('data/enemies.json')),data.enemies);
  assert.deepEqual(JSON.parse(writes.get('data/waves.json')),data.waves);
});
