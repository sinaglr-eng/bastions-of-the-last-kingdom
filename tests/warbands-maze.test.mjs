import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Box3,Vector3} from 'three';
import {Game} from '../game/core/game.js';
import {DraftManager} from '../game/core/draft.js';
import {GridManager} from '../game/core/grid.js';
import {mazeSnapshot,searchMazeVariants,describeMaze} from '../game/core/maze-search.js';
import {damageAfterDefense} from '../game/core/math.js';
import {enemyModel} from '../game/render/models.js';
import {meadowTerrain,interiorGrid} from '../game/render/terrain.js';
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
const make=()=>new Game(data,{seed:123});
function fight(){const g=make();g.phase='combat';g.combat.spawnQueue=[{time:1e6,type:'grunt'}];return g;}

test('rounds hold no rolled identities and invalid placement consumes no randomness',()=>{
  let calls=0;const d=new DraftManager(data,()=>{calls++;return .4;});d.roll(0);assert.equal(calls,0);
  assert.ok(d.draws.every(r=>!r.family&&!r.tier));d.reveal(2);assert.equal(calls,2);assert.ok(d.draws[2].family);d.reveal(2);assert.equal(calls,2);
  const a=make(),b=make();a.activeDraw=4;assert.equal(a.place(0,4),false);assert.equal(a.place(-1,18),false);
  assert.ok(a.draft.draws.every(r=>!r.family));a.place(18,18);b.place(15,15);
  assert.deepEqual([a.towers[0].family,a.towers[0].tier],[b.towers[0].family,b.towers[0].tier]);
  a.economy.reward(0,90);a.place(19,18);assert.equal(a.towers[1].tier,1,'quality odds fixed for current round');
});

test('50 waves preserve reference movement classes, five bosses, and selected variant per wave',()=>{
  assert.equal(make().waveLimit,50);
  const air=[5,15,25,27,28,29,30,34,35,39,40,42,45,48,50];
  for(const [i,w]of data.waves.entries()){const e=data.enemies[w.groups[0].type];assert.equal(e.flying,air.includes(i+1));assert.equal(e.boss,(i+1)%10===0);assert.equal(w.reference.wave,i+1);}
  const a=make(),b=make();a.combat.start(data.waves[30]);b.combat.start(data.waves[30]);
  assert.deepEqual(a.combat.spawnQueue,b.combat.spawnQueue);
  assert.ok(a.combat.spawnQueue.every(q=>q.modifiers.variant===a.combat.spawnQueue[0].modifiers.variant));
  const q=a.combat.spawnQueue[0],e=a.combat.spawn(q.type,q.modifiers);assert.notEqual(!!e.magicImmune,!!e.physicalImmune);
});

test('damage immunities have physical, magical and pure counters; magic immunity rejects magical statuses',()=>{
  assert.equal(damageAfterDefense(50,'fire',{magicImmune:true},{},data.balance),0);
  assert.equal(damageAfterDefense(50,'physical',{physicalImmune:true},{},data.balance),0);
  assert.equal(damageAfterDefense(50,'pure',{physicalImmune:true,magicImmune:true},{},data.balance),50);
  const g=fight(),e=g.combat.spawn('host_26');g.combat.applyEffects(e,{damage:20,slow:.4,freeze:1,burn:1,poisonDps:10,shredMagic:.2,shred:2});
  assert.deepEqual(Object.keys(e.statuses),['shred']);
});

test('refraction absorbs direct impacts, damage over time bypasses it, and shields recharge',()=>{
  const g=fight(),e=g.combat.spawn('host_14');e.speed=0;const hp=e.hp;
  for(let i=0;i<3;i++)assert.equal(g.combat.damage(e,20,'fire',{directHit:true}),0);
  assert.equal(e.hp,hp);assert.equal(e.shields,0);assert.equal(g.combat.damage(e,20,'fire',{}),20);
  g.combat.update(8);assert.equal(e.shields,3);assert.equal(g.combat.damage(e,10,'poison',{}),10);assert.equal(e.shields,3);
});

test('evasion, shell and reactive armor alter hits without inflating damage or blocking pure damage',()=>{
  const g=fight(),e=g.combat.spawn('host_09');g.rng=()=>0;
  assert.equal(g.combat.damage(e,40,'physical',{directHit:true}),0);assert.equal(g.combat.damage(e,40,'fire',{directHit:true}),40);
  const shell=g.combat.spawn('host_49');assert.equal(g.combat.damage(shell,10,'fire',{directHit:true}),0);assert.equal(g.combat.damage(shell,10,'pure',{directHit:true}),10);
  const reactive=g.combat.spawn('host_24');const first=g.combat.damage(reactive,40,'physical',{directHit:true}),second=g.combat.damage(reactive,40,'physical',{directHit:true});assert.ok(second<first);assert.equal(reactive.reactiveStacks,2);
});

test('veiled enemies are detected by proximity, checkpoints and Clerics',()=>{
  const g=fight(),e=g.combat.spawn('host_08');e.x=18;e.z=18;
  const t={x:12,z:18};assert.equal(g.combat.canSee(e,t),false);assert.equal(g.combat.canSee(e,{x:17,z:18}),true);
  g.towers.push({family:'cleric',state:'active',x:18,z:13});assert.equal(g.combat.canSee(e,t),true);
  g.towers=[];e.x=4;e.z=18;assert.equal(g.combat.canSee(e,t),true);
});

test('disarm pauses nearby attacks, dread reduces cadence, recharge heals and thieves steal on leak',()=>{
  const g=fight(),e=g.combat.spawn('host_12');Object.assign(e,{x:12,z:12,speed:0});
  const t={id:1,family:'archer',tier:1,state:'active',x:11,z:12,cooldown:0,kills:0};g.towers=[t];g.combat.update(.01);assert.equal(t.disarmed,true);assert.equal(g.combat.projectiles.length,0);
  e.disarm=false;e.untouchable=.35;t.cooldown=1;g.combat.update(.1);assert.ok(Math.abs(t.cooldown-.935)<1e-8);
  g.towers=[];const r=g.combat.spawn('host_32');r.speed=0;r.hp=r.maxHp*.5;g.combat.update(8);assert.ok(Math.abs(r.hp-r.maxHp*.62)<1e-6);
  const thief=g.combat.spawn('host_16');thief.pathIndex=thief.route.length;const gold=g.economy.gold;g.combat.update(.01);assert.equal(g.economy.gold,gold-thief.thief);
});

test('blink follows ordered path cells without skipping a checkpoint or leaking early',()=>{
  const g=fight(),e=g.combat.spawn('host_37');e.speed=0;e.blink=25;e.blinkClock=0;
  g.combat.update(.01);assert.equal(e.traveled,25);assert.deepEqual({x:e.x,z:e.z},e.route[25]);assert.equal(g.leaks,0);
  e.blinkClock=0;e.blink=e.pathLength;g.combat.update(.01);assert.equal(g.leaks,1);assert.equal(e.pathIndex,e.route.length);
});

test('final campaign completes at wave 50 and all fifty warbands move, fight and resolve',()=>{
  // Exercise every authored group/variant with physical and magical defenders, including bosses.
  for(const [i,w]of data.waves.entries())for(const variant of data.enemies[w.groups[0].type].variants||[{}]){
    const g=fight();g.round=i+1;const e=g.combat.spawn(w.groups[0].type,{variant});
    g.combat.update(.1);assert.ok(Number.isFinite(e.x+e.z+e.hp));assert.ok(e.traveled>0);
    g.combat.damage(e,e.maxHp*2,'pure',{});g.combat.spawnQueue=[];g.combat.update(.1);assert.equal(g.phase,i===49?'won':'build');
  }
});

test('six maze variants, including the drawn spiral, count real BFS steps and central fire coverage',()=>{
  const grid=new GridManager(),snapshot=mazeSnapshot(grid),before=JSON.stringify(snapshot),result=searchMazeVariants(snapshot,250);
  assert.equal(JSON.stringify(mazeSnapshot(grid)),before);assert.equal(result.plans.length,6);assert.ok(result.evaluated>1000);assert.equal(result.provenOptimal,false);
  assert.ok(result.plans[0].plannedLength>=800);assert.ok(result.plans[1].coverage/result.plans[1].plannedLength>.6);
  const spiral=result.plans.find(p=>p.id==='spiral');assert.ok(spiral.plannedLength>=450);assert.ok(spiral.coverage/spiral.plannedLength>=.6);
  assert.ok(result.plans.find(p=>p.id==='spiral-long').plannedLength>spiral.plannedLength);
  for(const plan of result.plans){
    assert.ok(plan.missing.length<=250);assert.equal(plan.segments.reduce((a,b)=>a+b,0),plan.plannedLength);
    const built=new GridManager();for(const [id,p]of plan.walls.entries())assert.ok(built.occupy(p.x,p.z,id+1).ok);
    assert.deepEqual(built.route,plan.route);assert.equal(built.route.length-1,plan.plannedLength);
    assert.ok(plan.core.length);assert.ok(plan.core.every(p=>Math.hypot(p.x-18,p.z-18)<=6));
    const reach=plan.route.slice(1).filter(p=>plan.core.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<=6)).length;assert.equal(reach,plan.coverage);
    const p=plan.walls[0];grid.occupy(p.x,p.z,1);const rebuilt=describeMaze(mazeSnapshot(grid),249,plan.walls);assert.ok(rebuilt);grid.remove(p.x,p.z);
  }
  const refined=searchMazeVariants(snapshot,250,{effort:.2,initialPlans:result.plans});assert.ok(refined.plans[0].plannedLength>=result.plans[0].plannedLength);
});

test('small and exhausted budgets produce legal plans against existing barricades',()=>{
  const grid=new GridManager();for(let x=1;x<9;x++)grid.occupy(x,17,x);
  for(const budget of [0,15,50])for(const plan of searchMazeVariants(mazeSnapshot(grid),budget,{effort:.1}).plans){
    assert.ok(plan.missing.length<=budget);assert.ok(plan.route.every(p=>grid.walkable(p.x,p.z)));assert.ok(describeMaze(mazeSnapshot(grid),budget,plan.walls));
  }
});

test('continuous meadow has a flat playable field, no perimeter grid line, and finite enemy silhouettes',()=>{
  const terrain=meadowTerrain(),a=terrain.geometry.attributes.position;
  for(let i=0;i<a.count;i++)if(Math.abs(a.getX(i))<=18.5&&Math.abs(a.getZ(i))<=18.5)assert.ok(Math.abs(a.getY(i)-.031)<1e-7);
  const grid=interiorGrid(37),b=grid.geometry.attributes.position;
  for(let i=0;i<b.count;i+=2){assert.ok(!(Math.abs(b.getX(i))===18.5&&b.getX(i)===b.getX(i+1)));assert.ok(!(Math.abs(b.getZ(i))===18.5&&b.getZ(i)===b.getZ(i+1)));}
  for(const e of Object.values(data.enemies).filter(e=>e.model)){const m=enemyModel(e.model,e),size=new Box3().setFromObject(m).getSize(new Vector3());assert.ok([size.x,size.y,size.z].every(v=>v>0&&Number.isFinite(v)));m.traverse(o=>o.geometry?.dispose());}
  terrain.geometry.dispose();grid.geometry.dispose();
});
