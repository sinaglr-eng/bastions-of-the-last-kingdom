import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {Game} from '../game/core/game.js';
import {applyEnemyDesigns} from '../tools/enemy-designs.mjs';

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

test('only the first patrol is introductory and manageable with any Tier I keeper near the route',()=>{
  for(const family of basicFamilies)for(const [layout,positions] of Object.entries(formations)){
    const game=new Game(data,{seed:4});
    keepBasic(game,family,positions[0]);
    assert.equal(game.leaks,0,`${family} I, ${layout}, wave 1`);
    assert.equal(game.lives,data.balance.startingLives);
    assert.equal(game.towers.filter(t=>t.state==='active').length,1);
    assert.equal(game.grid.occupied.size,5);
    assert.equal(game.kills,8);
  }
});

test('opening patrols still punish placing the keeper away from the route',()=>{
  const game=new Game(data,{seed:4});
  keepBasic(game,'cleric',{x:0,z:36});
  assert.equal(game.kills,0);assert.equal(game.leaks,8);
  assert.equal(game.lives,data.balance.startingLives-8);
});

test('waves two and three ease durability while wave one and all movement/count/timing tuning stay unchanged',()=>{
  const patrols=data.waves.slice(0,3).map(w=>data.enemies[w.groups[0].type]);
  assert.deepEqual(data.waves.slice(0,3).map(w=>w.groups[0].count),[8,8,9]);
  assert.deepEqual(data.waves.slice(0,3).map(w=>w.reward),[50,50,50]);
  for(const e of patrols){
    assert.equal(e.gold,3);assert.equal(e.xp,3);assert.equal(e.leak,1);
    assert.equal(e.flying,false);assert.deepEqual(e.traits,[]);
    assert.ok(!e.resists||Object.values(e.resists).every(r=>r===0));
  }
  assert.deepEqual(patrols.map(e=>[e.hp,e.armor,e.speed]),[[9,0,1.3],[52,1,2.21],[68,8,2.05+2*.16]]);
  assert.deepEqual(data.waves.slice(0,3).map(w=>w.groups[0].interval),[2.4,.6,.6]);
  assert.match(patrols[0].threat,/Opening patrol/);
  assert.equal(patrols[1].threat,'Ground warband · shape the route');
  assert.equal(patrols[2].threat,'Ground warband · shape the route');
  assert.match(patrols[2].counter,/Plated armor/);
  assert.ok(patrols[2].hp<data.enemies.host_04.hp);
});

test('campaign authoring reproduces checked-in enemy and wave tuning without reverting the opening patrols',()=>{
  const writes=new Map(),source=readFileSync(new URL('../tools/author-campaign.mjs',import.meta.url),'utf8').replace(/^import[^\n]*\n/gm,'');
  runInNewContext(source,{
    readFileSync:path=>{assert.equal(path,'data/enemies.json');return JSON.stringify(data.enemies);},
    writeFileSync:(path,content)=>writes.set(path,content),applyEnemyDesigns,console:{log(){}}
  });
  assert.deepEqual(JSON.parse(writes.get('data/enemies.json')),data.enemies);
  assert.deepEqual(JSON.parse(writes.get('data/waves.json')),data.waves);
});
