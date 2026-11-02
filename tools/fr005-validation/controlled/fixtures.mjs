import fs from 'node:fs';
import assert from 'node:assert/strict';
import {loadCurrentDatasets} from '../../../tools/current-datasets.mjs';
import {Game} from '../../../game/core/game.js';
import {preparedBlueprints} from '../../../game/core/blueprints.js';
import {towerStats,combatTowerStats} from '../../../game/core/math.js';
export const datasets=loadCurrentDatasets({revision:process.env.FR005_BASELINE==='1'?'fr004':'current'});
export const diamond=preparedBlueprints(JSON.parse(fs.readFileSync(new URL('../../../data/maze-blueprints.json',import.meta.url)))).find(p=>p.id==='diamond-spiral');
export const weight=(d,id,t=1)=>d.towers[id].advanced?d.recipes.find(r=>r.id===id).ingredients.reduce((n,i)=>n+weight(d,i.family,i.tier),0):2**(t-1);
export const expand=(...entries)=>entries.flatMap(([family,n=1,tier=1])=>Array.from({length:n},()=>({family,tier})));
export function makeGame(faction,army,{seed=42,wave=50,positions=diamond.core,patch,life=30,variant}={}){
 const d=patch||variant!==undefined?structuredClone(datasets[faction]):datasets[faction];if(patch)patch(d);
 if(variant!==undefined)for(const group of d.waves[wave-1].groups){const variants=d.enemies[group.type].variants;assert.ok(variants?.[variant]);group.variant=variants[variant];}
 const g=new Game(d,{seed,waveLimit:wave});g.round=wave;g.lives=life;
 const ids=new Map();
 for(const [i,p]of diamond.walls.entries()){assert.ok(g.grid.occupy(p.x,p.z,i+1).ok);ids.set(`${p.x},${p.z}`,i+1);}
 assert.equal(g.grid.route.length,diamond.route.length);
 g.towers=diamond.walls.map((p,i)=>({id:i+1,state:'ruin',family:Object.keys(d.towers).find(id=>!d.towers[id].advanced),tier:1,...p,kills:0,cooldown:0,mvpLevel:0}));
 assert.ok(army.length<=positions.length);
 for(const[a,i]of army.map((a,i)=>[a,i])){
  assert.ok(a.family!=='ladyclaire');assert.notEqual(d.towers[a.family].classification?.toLowerCase(),'top');
  const p=positions[i];assert.ok(ids.has(`${p.x},${p.z}`));
  Object.assign(g.towers[ids.get(`${p.x},${p.z}`)-1],a,p,{state:'active',mvpLevel:a.mvpLevel||0});
 }
 g.phase='ready';return g;
}
export function fight(faction,army,options={}){
 const g=makeGame(faction,army,options),dt=options.dt||.1;
 const damage={},effects={},blocks={},spawn=[],leaks=[],kills=[],bossKills=[],healing={},procs={};let recover=0,steps=0;
 g.on((type,p)=>{
  if(type==='hit'){damage[p.source?.family]=(damage[p.source?.family]||0)+p.effectiveDamage;effects[p.effect]=(effects[p.effect]||0)+p.effectiveDamage;}
  if(type==='damage-trace'&&p.blockReason)blocks[p.blockReason]=(blocks[p.blockReason]||0)+1;
  if(type==='spawn')spawn.push({id:p.enemy.id,type:p.enemy.type,name:p.enemy.name,hp:p.enemy.maxHp,flying:!!p.enemy.flying,armor:p.enemy.armor,magicImmune:!!p.enemy.magicImmune,physicalImmune:!!p.enemy.physicalImmune,regen:p.enemy.regen||0,variant:p.enemy.variant||null,boss:!!p.enemy.boss});
  if(type==='leak')leaks.push({id:p.enemy.id,type:p.enemy.type,name:p.enemy.name,hp:p.enemy.hp,maxHp:p.enemy.maxHp,leak:p.enemy.leak||1,time:g.combat.elapsed,boss:!!p.enemy.boss});
  if(type==='death'){kills.push(p.enemy.id);if(p.enemy.boss)bossKills.push({id:p.enemy.id,type:p.enemy.type,name:p.enemy.name,time:g.combat.elapsed});}
  if(type==='recover')recover+=p.amount;
  if(type==='enemy-heal')healing[p.cause]=(healing[p.cause]||0)+p.amount;
  if(type==='ability-proc')procs[p.familyId||p.effect||p.type]=(procs[p.familyId||p.effect||p.type]||0)+1;
 });
 const effective=g.towers.filter(t=>t.state==='active').map(t=>({family:t.family,tier:t.tier,mvpLevel:t.mvpLevel,x:t.x,z:t.z,stats:combatTowerStats(t,g.towers,g.data).stats,bonuses:combatTowerStats(t,g.towers,g.data).bonuses}));
 g.startCombat();while(g.phase==='combat'&&steps++<Math.ceil((options.maxSeconds||2000)/dt))g.tick(dt);
 return {faction,seed:options.seed||42,wave:options.wave||50,dt,method:'CONTROLLED injected army and complete Diamond foundations; no acquisition or full-campaign claim',phase:g.phase,allKilled:kills.length===g.combat.total&&g.leaks===0,seconds:+g.combat.elapsed.toFixed(2),lives:g.lives,bossKills,bossKillCount:bossKills.length,timedOut:g.phase==='combat',leakCount:g.leaks,recover,killCount:kills.length,total:g.combat.total,spawned:spawn.length,weight:army.reduce((n,t)=>n+weight(g.data,t.family,t.tier),0),active:army.length,army:effective,spawn,leaks,damage,effects,blocks,healing,procs,survivors:g.combat.enemies.map(e=>({id:e.id,hp:e.hp,maxHp:e.maxHp,name:e.name,traveled:e.traveled,pathLength:e.pathLength}))};
}
export const compact=r=>({faction:r.faction,wave:r.wave,seed:r.seed,phase:r.phase,leaks:r.leakCount,kills:r.killCount,total:r.total,lives:r.lives,seconds:r.seconds,weight:r.weight,active:r.active,recover:r.recover,escapedHp:r.leaks.reduce((n,e)=>n+e.hp,0),effects:r.effects,damage:r.damage,healing:r.healing});
