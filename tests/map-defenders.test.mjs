import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Box3,Vector3} from 'three';
import {GridManager,SIZE,CHECKPOINTS,cellKey} from '../game/core/grid.js';
import {Game} from '../game/core/game.js';
import {towerStats} from '../game/core/math.js';
import {defenderModel,DEFENDER_FAMILIES} from '../game/render/models.js';
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));

test('37-square field is completely open except for seven reserved route markers',()=>{
  const grid=new GridManager();assert.equal(SIZE,37);assert.equal(grid.size,37);
  assert.deepEqual(CHECKPOINTS,[{x:0,z:4},{x:4,z:18},{x:32,z:18},{x:32,z:4},{x:18,z:4},{x:18,z:32},{x:36,z:32}]);
  let buildable=0;
  for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++){assert.ok(grid.walkable(x,z));if(grid.type(x,z)==='buildable')buildable++;}
  assert.equal(buildable,37*37-7);
  for(const p of CHECKPOINTS.slice(1,-1))assert.equal(Math.min(p.x,p.z,SIZE-1-p.x,SIZE-1-p.z),4);
  assert.equal(grid.canPlace(36,36).ok,true);assert.equal(grid.canPlace(37,18).ok,false);
  for(const p of CHECKPOINTS)assert.equal(grid.canPlace(p.x,p.z).ok,false);
});

test('ground invader completes the loop in order, revisits its crossing, and leaks only at the keep',()=>{
  const g=new Game(data,{seed:1});g.phase='combat';g.combat.spawnQueue=[{time:9999,type:'grunt'}];
  const e=g.combat.spawn('grunt');e.speed=1;const startingLives=g.lives;let cursor=0;
  assert.equal(e.route.filter(p=>p.x===18&&p.z===18).length,2);
  for(const checkpoint of CHECKPOINTS.slice(1)){
    const next=e.route.findIndex((p,i)=>i>cursor&&cellKey(p.x,p.z)===cellKey(checkpoint.x,checkpoint.z));
    assert.ok(next>cursor);g.tick(next-cursor);cursor=next;
    assert.deepEqual({x:e.x,z:e.z},checkpoint);
    if(checkpoint!==CHECKPOINTS.at(-1)){assert.equal(g.lives,startingLives);assert.equal(g.leaks,0);}
  }
  assert.equal(g.lives,startingLives-(e.leak||1));assert.equal(g.leaks,1);g.tick(.1);assert.equal(g.leaks,1);
});

test('soldier windup strikes ground enemies without hitting flying enemies',()=>{
  const g=new Game(data,{seed:2});g.phase='combat';g.combat.spawnQueue=[{time:9999,type:'grunt'}];
  const soldier={id:1,family:'soldier',tier:1,state:'active',x:10,z:10,kills:0,cooldown:0};g.towers.push(soldier);
  const enemies=['grunt','grunt','wyvern'].map((type,i)=>{const e=g.combat.spawn(type);Object.assign(e,{x:11,z:10+i*.1,speed:0});return e;});
  const hp=enemies.map(e=>e.hp);const stats=towerStats(soldier,data);
  assert.equal(g.combat.targetList(soldier,stats).length,2);g.tick(.01);
  assert.deepEqual(enemies.map(e=>e.hp),hp);assert.ok(g.combat.projectiles[0].stats.melee);
  g.tick(.14);assert.ok(enemies[0].hp<hp[0]);assert.equal(enemies[1].hp,hp[1]);assert.equal(enemies[2].hp,hp[2]);
});

test('eight defender families have distinct models with finite single-cell footprints at every tier',()=>{
  const signatures=new Set();
  for(const family of DEFENDER_FAMILIES)for(let tier=1;tier<=6;tier++){
    const model=defenderModel(family,tier),bounds=new Box3().setFromObject(model),size=bounds.getSize(new Vector3());
    assert.ok([size.x,size.y,size.z].every(Number.isFinite));assert.ok(size.x<=1.01&&size.z<=1.01,`${family} stays in its tile`);assert.ok(size.y>1.3&&size.y<2.2);
    if(tier===1)signatures.add(JSON.stringify(model.children.map(o=>[o.material.color.getHex(),o.geometry.attributes.position.count])));
    model.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
  }
  assert.equal(signatures.size,8);
});
