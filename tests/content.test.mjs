import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {DraftManager} from '../game/core/draft.js';
import {seededRandom,towerStats} from '../game/core/math.js';
import {matchingIngredients,recipeFamily} from '../game/core/recipes.js';
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
test('campaign content references valid types and every three-defender recipe is achievable',()=>{
 assert.equal(Object.values(data.towers).filter(t=>!t.advanced).length,8);assert.equal(Object.values(data.towers).filter(t=>t.advanced).length,39);assert.equal(data.recipes.length,39);assert.equal(Object.keys(data.enemies).filter(id=>id.startsWith('host_')).length,50);assert.equal(data.waves.length,50);
 for(const w of data.waves){assert.ok(w.reward>=0);for(const g of w.groups){assert.ok(data.enemies[g.type]);assert.ok(g.count>0&&g.interval>0);}}
 for(const r of data.recipes){assert.equal(r.ingredients.length,3);assert.ok(data.towers[recipeFamily(r)]?.advanced);assert.ok(r.ingredients.every(i=>data.towers[i.family]&&i.tier>=1&&i.tier<=(data.towers[i.family].advanced?1:6)));
   if(r.currentRoundOnly){const pieces=[...r.ingredients,{family:'archer',tier:1},{family:'cleric',tier:1}].map((i,id)=>({...i,id,state:'draft',round:1}));assert.equal(matchingIngredients(r,pieces,pieces[0],{phase:'select',round:1}).length,3);for(const t of pieces.slice(0,3))assert.ok(matchingIngredients(r,pieces,t,{phase:'select',round:1}));}
   else{const pieces=r.ingredients.map((i,id)=>({...i,id,state:'active'}));assert.equal(matchingIngredients(r,pieces).length,r.ingredients.length);for(const t of pieces)assert.ok(matchingIngredients(r,pieces,t));}}
});
test('family weighting matches eight equal probabilities over 100,000 draws',()=>{
 const draft=new DraftManager(data,seededRandom(85)),counts={};for(let i=0;i<20000;i++)for(const hidden of draft.roll(0)){const d=draft.reveal(hidden.index);counts[d.family]=(counts[d.family]||0)+1;}
 assert.equal(Object.keys(counts).length,8);for(const n of Object.values(counts))assert.ok(Math.abs(n/100000-.125)<.006);
});
test('flying enemies use checkpoint route independently of blocked grid cells',()=>{
 const g=new Game(data,{seed:1});g.grid.occupy(2,4,1);const flying=g.combat.spawn('wyvern'),ground=g.combat.spawn('grunt');assert.deepEqual(flying.route,g.grid.checkpoints);assert.ok(ground.route.length>flying.route.length);assert.ok(!ground.route.some(p=>p.x===2&&p.z===4));
});
test('all six target priorities choose by their documented metric',()=>{
 const g=new Game(data,{seed:1});const t={x:10,z:10,priority:'first'};
 g.combat.enemies=[{id:1,x:10,z:11,hp:30,speed:1,traveled:50,pathLength:100},{id:2,x:11,z:10,hp:80,speed:3,traveled:70,pathLength:100}];
 for(const [priority,expected]of Object.entries({first:2,last:1,strongest:2,weakest:1,fastest:2,slowest:1})){t.priority=priority;assert.equal(g.combat.targetList(t,{range:4})[0].id,expected);}
});
test('damage-over-time is finite, refreshes instead of stacking, and retains kill ownership',()=>{
 const g=new Game(data,{seed:2});g.phase='combat';g.combat.spawnQueue=[{time:999,type:'grunt'}];const owner={id:1,kills:0};const e=g.combat.spawn('grunt');e.speed=0;
 g.combat.applyEffects(e,{damage:20,poison:.5,dotDuration:2},owner);g.combat.applyEffects(e,{damage:10,poison:.5,dotDuration:3},owner);assert.equal(e.statuses.poison.dps,10);assert.equal(e.statuses.poison.time,3);
 for(let i=0;i<31;i++)g.tick(.1);assert.ok(!e.statuses.poison);assert.ok(Math.abs(e.hp-35)<1e-7);g.combat.damage(e,100,'holy',{},owner);assert.equal(owner.kills,1);
});
test('game freezes combat updates while paused; wave starts once',()=>{
 const g=new Game(data,{seed:2});g.phase='ready';assert.equal(g.startCombat(),true);assert.equal(g.startCombat(),false);g.paused=true;g.tick(2);assert.equal(g.combat.elapsed,0);g.paused=false;g.tick(.1);assert.equal(g.combat.elapsed,.1);
});
test('paid champion improvements are unavailable and cannot spend gold or change damage',()=>{
 const g=new Game(data,{seed:2});const t={id:1,family:'rimewatch',tier:1,state:'active',x:3,z:3};g.towers.push(t);g.selected=1;g.economy.gold=2000;const damage=towerStats(t,data).damage;assert.equal(g.upgradeSpecial(),false);assert.equal(g.economy.gold,2000);assert.equal(towerStats(t,data).damage,damage);
});
test('every exported GLB has a valid header and finite footprint metadata',()=>{
 const base=new URL('../public/assets/models/',import.meta.url);const manifest=JSON.parse(readFileSync(new URL('manifest.json',base)));assert.equal(manifest.length,107);
 for(const entry of manifest){assert.ok(existsSync(new URL(entry.file,base)));const b=readFileSync(new URL(entry.file,base));assert.equal(b.toString('ascii',0,4),'glTF');assert.equal(b.readUInt32LE(4),2);assert.equal(b.readUInt32LE(8),b.length);assert.ok(entry.triangles>0&&entry.triangles<(entry.family==='lordbernhard'?13500:10000));}
 assert.equal(manifest.filter(x=>x.kind==='tower').length,87);
 assert.equal(manifest.filter(x=>x.style==='hero-v5').length,42);
 assert.equal(manifest.filter(x=>x.style==='archer-v2').length,6);
 assert.equal(manifest.filter(x=>x.style==='champion-v6').length,37);
 assert.equal(manifest.filter(x=>x.secret===true&&x.style==='champions-v7.9').length,2);
});
