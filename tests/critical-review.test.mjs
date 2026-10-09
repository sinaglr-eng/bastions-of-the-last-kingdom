import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {prepareCriticalReview} from '../game/core/debug-review.js';
import {towerStats,seededRandom} from '../game/core/math.js';

const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};

test('native critical review uses one actual Lionheart and one visible stationary campaign invader with unchanged defenses',()=>{
  const before=JSON.stringify(data),game=new Game(data,{seed:114}),{tower,enemy}=prepareCriticalReview(game),stats=towerStats(tower,data);
  assert.equal(game.phase,'combat');assert.equal(game.paused,false);assert.equal(game.speed,1);assert.equal(game.towers.length,1);assert.equal(tower.state,'active');
  assert.equal(data.towers[tower.family].name,'Lionheart Champion');assert.equal(stats.critChance,.1);assert.equal(stats.critMultiplier,5);assert.deepEqual([tower.x,tower.z],[18,17]);
  assert.equal(enemy.type,'host_06');assert.deepEqual([enemy.x,enemy.z],[18,18]);assert.equal(enemy.hp,1e7);assert.equal(enemy.maxHp,1e7);assert.equal(enemy.speed,0);assert.equal(game.combat.isRevealed(enemy),true);
  assert.equal(enemy.armor,data.enemies.host_06.armor);assert.deepEqual(enemy.resists,data.enemies.host_06.resists);assert.deepEqual(game.combat.spawnQueue,[]);assert.equal(game.combat.total,1);assert.equal(game.combat.enemies.length,1);
  assert.equal(game.selection,null);assert.equal(game.enemySelection,null);assert.equal(JSON.stringify(data),before);
});

test('the first real seeded attack emits a visible critical impact and damage without changing its authored chance or multiplier',()=>{
  const game=new Game(data,{seed:42}),{tower,enemy}=prepareCriticalReview(game),events=[];
  assert.ok(seededRandom(7)()<data.towers.roseguard.critChance);
  game.on((type,payload)=>{if(type==='critical-hit')events.push(payload);});
  game.tick(.01);assert.equal(events.length,0);assert.equal(game.combat.projectiles.length,1);
  // The adjacent target retains the normal minimum .08-second shot travel.
  assert.equal(game.combat.projectiles[0].duration,.08);
  game.tick(.1);assert.equal(events.length,1);const impact=events[0];
  assert.equal(impact.source,tower);assert.equal(impact.enemy,enemy);assert.equal(impact.visible,true);assert.equal(impact.multiplier,5);assert.equal(impact.directHit,true);assert.ok(impact.amount>0);
  assert.equal(enemy.hp,enemy.maxHp-impact.amount);assert.deepEqual([enemy.x,enemy.z],[18,18]);assert.equal(enemy.dead,false);assert.equal(game.phase,'combat');
  game.paused=true;const hp=enemy.hp,clock=game.combat.elapsed;game.tick(.3);assert.equal(enemy.hp,hp);assert.equal(game.combat.elapsed,clock);assert.equal(events.length,1);
});
