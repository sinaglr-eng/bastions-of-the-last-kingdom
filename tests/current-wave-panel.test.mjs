import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {currentWarbandInfo} from '../game/core/warband-info.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {currentWavePanelMarkup,updateCurrentWavePanel} from '../ui/current-wave-panel.js';

const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
function combat(round=31,seed=42,roster=data){const game=new Game(roster,{seed});game.round=round;game.phase='combat';game.combat.start(game.wave);return game;}
const snapshot=game=>JSON.stringify({enemies:game.combat.enemies,queue:game.combat.spawnQueue,draws:game.draft.draws,towers:game.towers,cp:game.commandPoints.value,gold:game.economy.gold,kills:game.kills,serial:game.combat.serial});
function spawnQueued(game){const queued=game.combat.spawnQueue.shift();return game.combat.spawn(queued.type,queued.modifiers);}

test('current assault shows real per-enemy variant profiles, exact remaining totals and authored HP/armor/traits without consuming RNG',()=>{
  const game=combat(),control=combat(),rows=currentWarbandInfo(game),before=snapshot(game),images={'enemy:host_31':'host_31.png'};
  assert.equal(rows.length,2);assert.equal(rows.reduce((sum,row)=>sum+row.count,0),game.combat.total);
  for(let pass=0;pass<20;pass++){
    const html=currentWavePanelMarkup(game,{images});assert.match(html,/data-current-wave="31"/);
    assert.ok(html.includes(game.wave.name));assert.match(html,new RegExp(`<strong>${game.combat.total}</strong><span>invaders remaining`));
    assert.ok(html.includes(`0 on the field · ${game.combat.total} approaching`));
    assert.equal((html.match(/class="current-wave-profile"/g)||[]).length,2);
    for(const row of rows){assert.ok(html.includes(row.name));assert.ok(html.includes(`${row.count} remaining`));for(const trait of row.traits)assert.ok(html.includes(trait));}
    assert.match(html,/Maximum health/);assert.match(html,/Armor/);assert.match(html,/Base speed/);
  }
  assert.equal(snapshot(game),before);assert.equal(game.rng(),control.rng());assert.equal(game.combat.enemies.length,0);
});

test('queued→live transitions and defeated invaders immediately change the respective aggregate counts',()=>{
  const game=combat(),initial=game.combat.total,enemy=spawnQueued(game);
  let html=currentWavePanelMarkup(game);assert.ok(html.includes(`1 on the field · ${initial-1} approaching`));
  assert.match(html,new RegExp(`<strong>${initial}</strong><span>invaders remaining`));
  game.combat.damage(enemy,enemy.maxHp*100,'pure',{});assert.equal(enemy.dead,true);
  html=currentWavePanelMarkup(game);assert.ok(html.includes(`0 on the field · ${initial-1} approaching`));
  assert.match(html,new RegExp(`<strong>${initial-1}</strong><span>invaders remaining`));
  game.combat.spawnQueue=[];html=currentWavePanelMarkup(game);assert.match(html,/<strong>0<\/strong><span>invaders remaining/);assert.match(html,/No invaders remain/);assert.doesNotMatch(html,/<article/);
});

test('a concealed real invader contributes only its known aggregate profile, never individual health, ID, position or active status',()=>{
  const game=combat(18),enemy=spawnQueued(game);assert.equal(enemy.cloaked,true);
  Object.assign(enemy,{id:981237,x:17.4,z:18.4,hp:143.12345,traveled:812.345});enemy.statuses={poison:{time:6.987,dps:28.543}};
  game.combat.isRevealed=()=>{throw new Error('Aggregate composition must not inspect individual visibility');};
  const before=snapshot(game),html=currentWavePanelMarkup(game);
  assert.match(html,/Cloaked/);assert.match(html,/Disarms defenders/);assert.ok(html.includes(enemy.name));
  assert.doesNotMatch(html,/981237|143\.12345|17\.4|18\.4|812\.345|6\.987|28\.543|data-inspected-enemy|aria-valuenow|Remaining enemy health|Poisoned/);
  assert.equal(snapshot(game),before);
  for(const row of currentWarbandInfo(game))for(const forbidden of ['id','hp','x','z','traveled','statuses'])assert.equal(Object.hasOwn(row,forbidden),false);
});

test('effective queued modifiers and the actual selected variant drive regeneration, armor and resistance values',()=>{
  const roster=structuredClone(data);roster.waves[0]={name:'Modified assault',boss:false,groups:[{type:'host_01',count:2,interval:1,hp:2,armor:7,resists:{fire:.35},variant:{name:'Moon profile',regen:.05,physicalImmune:true}}]};
  const game=combat(1,17,roster),row=currentWarbandInfo(game)[0],html=currentWavePanelMarkup(game);
  assert.equal(row.maxHp,roster.enemies.host_01.hp*2);assert.equal(row.armor,roster.enemies.host_01.armor+7);
  assert.match(html,/Moon profile/);assert.match(html,/35% fire resistance/);assert.match(html,/Regenerates 5% maximum health\/s/);assert.match(html,/Immune to physical and piercing damage/);
  assert.ok(html.includes('2 remaining · 0 on field · 2 approaching'));
  const enemy=spawnQueued(game);assert.equal(enemy.maxHp,row.maxHp);assert.equal(enemy.armor,row.armor);assert.equal(enemy.resists.fire,.35);
  assert.equal(currentWarbandInfo(game).length,1,'The live and scheduled form of the same real profile share one count');
});

test('unknown portraits remain optional and authored labels/URLs are safely escaped',()=>{
  const game=combat(1),rows=[{type:'custom',name:'A <script> & "Moon"',count:1,liveCount:1,queuedCount:0,maxHp:200,armor:7,speed:2,traitDetails:[{text:'Resists <fire> & ice',kind:null}]}];
  const html=currentWavePanelMarkup(game,{rows,images:{'enemy:custom':'portrait.png?x=" onclick="bad'}});
  assert.match(html,/A &lt;script&gt; &amp; &quot;Moon&quot;/);assert.match(html,/Resists &lt;fire&gt; &amp; ice/);
  assert.match(html,/src="portrait.png\?x=&quot; onclick=&quot;bad"/);assert.doesNotMatch(html,/<script>|<fire>| onclick="bad/);
  assert.doesNotMatch(currentWavePanelMarkup(game,{rows}),/<img/);
});

test('noncombat phases expose no stale assault panel',()=>{
  const game=combat(10);for(const phase of ['build','select','ready','reward','won','lost']){game.phase=phase;assert.equal(currentWavePanelMarkup(game),'');}
  assert.equal(currentWavePanelMarkup(null),'');
});

test('periodic live updates preserve sidebar scroll and skip unchanged content',()=>{
  const game=combat(),body={scrollTop:147,scrollLeft:3},panel={writes:0,closest:()=>body};
  Object.defineProperty(panel,'innerHTML',{get:()=>panel.markup||'',set:markup=>{panel.writes++;panel.markup=markup;body.scrollTop=0;body.scrollLeft=0;}});
  assert.equal(updateCurrentWavePanel(panel,game),true);assert.equal(body.scrollTop,147);assert.equal(body.scrollLeft,3);
  for(let pass=0;pass<50;pass++)assert.equal(updateCurrentWavePanel(panel,game),false);assert.equal(panel.writes,1);
  const enemy=spawnQueued(game);assert.equal(updateCurrentWavePanel(panel,game),true);assert.equal(body.scrollTop,147);
  enemy.dead=true;assert.equal(updateCurrentWavePanel(panel,game),true);assert.equal(body.scrollTop,147);assert.equal(panel.writes,3);
});
