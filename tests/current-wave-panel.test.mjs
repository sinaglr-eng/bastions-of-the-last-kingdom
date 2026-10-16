import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {currentWarbandInfo} from '../game/core/warband-info.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {currentWavePanelMarkup,updateCurrentWavePanel} from '../ui/current-wave-panel.js';
import {combatStatusModel,combatBossMarkup,updateCombatStatus} from '../ui/phase-ui.js';
import {selectedEnemyMarkup} from '../ui/selected-enemy.js';

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
  game.combat.damage(enemy,enemy.maxHp*100,'holy',{});assert.equal(enemy.dead,true);
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

test('effective queued modifiers and the actual selected variant drive regeneration and armor while obsolete resistances remain absent',()=>{
  const roster=structuredClone(data);roster.waves[0]={name:'Modified assault',boss:false,groups:[{type:'host_01',count:2,interval:1,hp:2,armor:7,resists:{fire:.35},variant:{name:'Moon profile',regen:.05,physicalImmune:true}}]};
  const game=combat(1,17,roster),row=currentWarbandInfo(game)[0],html=currentWavePanelMarkup(game);
  assert.equal(row.maxHp,roster.enemies.host_01.hp*2);assert.equal(row.armor,roster.enemies.host_01.armor+7);
  assert.match(html,/Moon profile/);assert.doesNotMatch(html,/fire resistance|data-defense="fire"/);assert.match(html,/Regenerates 5% maximum health\/s/);assert.match(html,/Immune to Physical damage, slowing and freezing; only Holy damage bypasses this immunity/);
  assert.ok(html.includes('2 remaining · 0 on field · 2 approaching'));
  const enemy=spawnQueued(game);assert.equal(enemy.maxHp,row.maxHp);assert.equal(enemy.armor,row.armor);assert.equal(enemy.resists,undefined);assert.equal(enemy.physicalImmune,true);assert.ok(row.traitDetails.every(trait=>!trait.text.includes('resistance')));
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


const bossHeader=game=>combatBossMarkup(combatStatusModel(game));
function assertBossHealth(game,hp,maxHp){
  const header=bossHeader(game);assert.match(header,/role="progressbar"/);
  assert.ok(header.includes(`aria-valuenow="${hp}"`));assert.ok(header.includes(`aria-valuemax="${maxHp}"`));
  assert.ok(header.includes(`width:${Math.max(0,Math.min(100,hp/maxHp*100))}%`));
  assert.doesNotMatch(currentWavePanelMarkup(game),/role="progressbar"|aria-valuenow|current-wave-boss-health/,'The side inspector must not duplicate aggregate live HP');
}

test('all five actual campaign bosses keep one persistent HP bar, counts and static side profiles through damage and pause',()=>{
  for(const round of [10,20,30,40,50]){
    const game=combat(round),control=combat(round),before=snapshot(game),body={scrollTop:93,scrollLeft:0},panel={closest:()=>body,innerHTML:''},banner={hidden:true,innerHTML:''};
    for(let pass=0;pass<10;pass++){assert.match(bossHeader(game),/Boss approaching/);assert.doesNotMatch(bossHeader(game),/progressbar|aria-valuenow/);assert.match(currentWavePanelMarkup(game),/invaders remaining/);}
    assert.equal(snapshot(game),before);assert.equal(game.rng(),control.rng());assert.equal(updateCurrentWavePanel(panel,game),true);
    game.tick(.25);const enemy=game.combat.enemies.find(enemy=>enemy.boss);assert.ok(enemy);assert.equal(enemy.hp,enemy.maxHp);assert.equal(updateCurrentWavePanel(panel,game),true);assertBossHealth(game,enemy.hp,enemy.maxHp);
    assert.match(panel.innerHTML,/1 on the field · 0 approaching/);const staticMarkup=panel.innerHTML;updateCombatStatus(null,banner,game);const undamaged=banner.innerHTML;
    assert.ok(game.combat.damage(enemy,enemy.maxHp*.2,'holy',{})>0);assert.equal(updateCurrentWavePanel(panel,game),false,'Individual damage does not rewrite unchanged stat profiles');assert.equal(panel.innerHTML,staticMarkup);
    updateCombatStatus(null,banner,game);assert.notEqual(banner.innerHTML,undamaged);assertBossHealth(game,enemy.hp,enemy.maxHp);assert.equal(body.scrollTop,93);
    const hp=enemy.hp;game.paused=true;game.tick(3);assert.equal(enemy.hp,hp);assertBossHealth(game,hp,enemy.maxHp);
    game.combat.damage(enemy,enemy.maxHp*100,'holy',{});assert.equal(enemy.dead,true);assert.equal(updateCurrentWavePanel(panel,game),true);assert.match(bossHeader(game),/No boss on the field/);assert.doesNotMatch(bossHeader(game),/progressbar|aria-valuenow|defeated/);
  }
});

test('actual boss regeneration and healing-block expiry update only the persistent bar and freeze during pause',()=>{
  const roster=structuredClone(data);roster.waves[9].groups[0].variant={regen:.05};const game=combat(10,42,roster);game.tick(.25);const enemy=game.combat.enemies.find(enemy=>enemy.boss);
  game.combat.damage(enemy,enemy.maxHp*.5,'holy',{});const injured=enemy.hp;game.combat.applyEffects(enemy,{healingBlockDuration:.2});game.tick(.5);
  assert.ok(Math.abs(enemy.hp-(injured+enemy.maxHp*.05*.3))<1e-9);assertBossHealth(game,enemy.hp,enemy.maxHp);const side=currentWavePanelMarkup(game);
  game.paused=true;const paused=enemy.hp;game.tick(1);assert.equal(enemy.hp,paused);assert.equal(currentWavePanelMarkup(game),side);
  game.paused=false;game.tick(.5);assert.ok(enemy.hp>paused);assertBossHealth(game,enemy.hp,enemy.maxHp);assert.equal(currentWavePanelMarkup(game),side);
});

test('multiple bosses sum only revealed living HP with actual modifier maxima, excluding queued bosses and minions',()=>{
  const roster=structuredClone(data);roster.waves[9]={name:'Combined assault',boss:true,groups:[{type:'host_10',count:3,interval:1,hp:2,variant:{hp:roster.enemies.host_10.hp*1.5}},{type:'host_01',count:1,interval:1}]};
  const game=combat(10,9,roster),first=spawnQueued(game),second=spawnQueued(game);assert.equal(first.maxHp,roster.enemies.host_10.hp*3);assert.equal(second.maxHp,first.maxHp);
  const minion=game.combat.spawn('host_01',{hp:7});game.combat.damage(first,first.maxHp*.25,'holy',{});assertBossHealth(game,first.hp+second.hp,first.maxHp+second.maxHp);assert.match(bossHeader(game),/1 approaching/);assert.match(currentWavePanelMarkup(game),/3 on the field · 2 approaching/);
  game.combat.damage(minion,minion.maxHp*.5,'holy',{});assertBossHealth(game,first.hp+second.hp,first.maxHp+second.maxHp);game.combat.damage(first,first.maxHp*100,'holy',{});assertBossHealth(game,second.hp,second.maxHp);
});

test('concealed boss HP is never read and individual revealed boss health remains inspectable separately',()=>{
  const game=combat(10),enemy=spawnQueued(game),storedHp=enemy.maxHp*.731;Object.assign(enemy,{cloaked:true,x:18,z:18});assert.equal(game.combat.isRevealed(enemy),false);
  Object.defineProperty(enemy,'hp',{configurable:true,get:()=>{throw Error('Concealed boss HP must not be read');}});assert.match(bossHeader(game),/Boss concealed/);assert.doesNotMatch(currentWavePanelMarkup(game),/aria-valuenow|role="progressbar"/);assert.equal(selectedEnemyMarkup(enemy,{data:game.data,combat:game.combat}),'');
  Object.defineProperty(enemy,'hp',{configurable:true,writable:true,value:storedHp});game.towers.push({id:91,family:'soldier',tier:1,state:'active',x:18,z:19});assert.equal(game.combat.isRevealed(enemy),true);assertBossHealth(game,storedHp,enemy.maxHp);assert.match(selectedEnemyMarkup(enemy,{data:game.data,combat:game.combat}),/role="progressbar"/);
  game.towers[0].x=25;game.towers[0].z=25;assert.equal(game.combat.isRevealed(enemy),false);assert.doesNotMatch(bossHeader(game),/progressbar|aria-valuenow/);assert.equal(selectedEnemyMarkup(enemy,{data:game.data,combat:game.combat}),'');
});

test('a concealed boss among revealed and queued bosses cannot enter the aggregate or expose individual state',()=>{
  const roster=structuredClone(data);roster.waves[9].groups[0].count=3;const game=combat(10,23,roster),visible=spawnQueued(game),hidden=spawnQueued(game);Object.assign(hidden,{cloaked:true,x:18,z:18,id:982313,statuses:{poison:{time:8.123,dps:72.987}}});
  Object.defineProperty(hidden,'hp',{configurable:true,get:()=>{throw Error('Hidden health leaked into an aggregate');}});assertBossHealth(game,visible.hp,visible.maxHp);assert.match(bossHeader(game),/1 concealed · 1 approaching/);assert.doesNotMatch(currentWavePanelMarkup(game)+bossHeader(game),/982313|8\.123|72\.987|data-inspected-enemy|Poisoned/);
});

test('persistent bars clamp invalid health and boss departure never invents a defeated outcome',()=>{
  const game=combat(10),enemy=spawnQueued(game);enemy.hp=enemy.maxHp*4;assertBossHealth(game,enemy.maxHp,enemy.maxHp);enemy.hp=-7;assertBossHealth(game,0,enemy.maxHp);
  for(const invalid of [NaN,Infinity,-Infinity]){enemy.hp=invalid;assertBossHealth(game,0,enemy.maxHp);assert.doesNotMatch(bossHeader(game),/NaN|Infinity/);}
  enemy.maxHp=Infinity;assert.match(bossHeader(game),/Boss health unavailable/);assert.doesNotMatch(bossHeader(game),/progressbar|NaN|Infinity|aria-valuemax="0"/);
  game.combat.enemies=[];assert.match(bossHeader(game),/No boss on the field/);assert.doesNotMatch(bossHeader(game),/defeated/);
});
