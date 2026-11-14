import test from 'node:test';import assert from 'node:assert/strict';
import {Game} from '../game/core/game.js';import {RunStatistics} from '../game/core/run-statistics.js';import {loadCurrentDatasets} from '../tools/current-datasets.mjs';import {validateSnapshot,validateFactionIdentity} from '../backend/validation.js';import {GAME_VERSION} from '../game/release.js';
const datasets=loadCurrentDatasets(),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function scene(faction='crown',lives=30,variant=0,{data=datasets[faction],waveLimit=50,round=50}={}){
 const g=new Game(data,{seed:42,waveLimit}),events=[];g.round=round;g.lives=lives;g.phase='combat';g.score=1230;g.on((k,p)=>events.push({k,p}));
 const tracker=new RunStatistics(g);g.emit('wave');const c=g.combat,e=c.spawn('host_50',{variant:data.enemies.host_50.variants[variant]});Object.assign(e,{route:[{x:0,z:0},{x:.01,z:0}],x:0,z:0,pathIndex:1,speed:10,blink:0,statuses:{}});
 return {g,c,e,events,tracker};
}
for(const faction of ['crown','forge','grove'])for(let variant=0;variant<3;variant++)for(const lives of [1,10,20,30])test(`FR-006 final boss escape: ${faction}, form ${variant}, ${lives} lives`,()=>{
 const {g,c,e,events,tracker}=scene(faction,lives,variant),startScore=g.score;
 const healer={id:1,family:'royalranger',tier:1,state:'active',x:0,z:0,kills:0,cooldown:0};
 c.projectiles.push({target:e,source:healer,stats:{damage:1e12,type:'holy',recoverChance:1,recoverLives:30},progress:0});
 c.update(.01);assert.equal(g.phase,'lost');assert.equal(g.lives,0);assert.equal(g.score,startScore);assert.equal(g.kills,0);assert.equal(g.leaks,1);
 assert.equal(events.filter(v=>v.k==='lost').length,1);assert.ok(!events.some(v=>['won','wave-complete','mvp-award','death'].includes(v.k)));assert.equal(c.projectiles.length,0);
 const leak=events.find(v=>v.k==='leak').p;assert.equal(leak.healthLost,lives);assert.equal(leak.terminal,true);assert.equal(e.leak,10,'Nominal authoring value remains unchanged');
 const w=tracker.snapshot().waves[0];assert.equal(w.healthLost,lives);assert.equal(w.completed,false);assert.equal(w.endHealth,0);assert.equal(w.enemyTypes.host_50.kills,0);
 for(let i=0;i<3;i++){c.update(5);c.damage(e,1e12,'holy',{},healer);c.landedProcs({recoverChance:1,recoverLives:30},healer);g.end(true);g.completeWave();}
 assert.deepEqual([g.phase,g.lives,g.score,g.kills,g.leaks],['lost',0,startScore,0,1]);assert.equal(events.filter(v=>v.k==='lost').length,1);
});
test('FR-006 final crossing consumes the health present after a last-moment heal; a kill before movement wins instead',()=>{
 const h=scene('forge',10);h.g.rng=()=>0;h.c.landedProcs({recoverChance:1,recoverLives:10},{});assert.equal(h.g.lives,20);h.c.update(.01);assert.equal(h.events.find(v=>v.k==='leak').p.healthLost,20);
 const k=scene('grove');k.c.damage(k.e,1e12,'holy');k.c.update(.01);assert.equal(k.g.phase,'won');assert.equal(k.g.kills,1);assert.equal(k.g.leaks,0);assert.equal(k.g.score,1230+25000+15000);
});
test('FR-006 preserves prior-edition nominal final leakage, other bosses and the 10-wave campaign',()=>{
 const old=scene('crown',30,0,{data:loadCurrentDatasets({revision:'fr005'}).crown});old.c.update(.01);assert.equal(old.g.lives,20);assert.equal(old.g.phase,'won');
 const short=scene('forge',30,0,{waveLimit:10,round:10});short.c.update(.01);assert.equal(short.g.lives,20);assert.equal(short.g.phase,'won');
 const h=scene();h.g.round=40;h.c.update(.01);assert.equal(h.g.lives,20);assert.notEqual(h.g.phase,'lost');
});
test('FR-006 recharge uses 15% of missing HP every four simulation seconds, with speed, pause, block and reduction semantics intact',()=>{
 for(const [f,data]of Object.entries(datasets))for(const variant of [null,...(data.enemies.host_49.variants||[])]){
  const g=new Game(data,{seed:1}),c=g.combat,e=c.spawn('host_49',{variant});Object.assign(e,{hp:20,maxHp:100,speed:0,regen:0});g.phase='combat';c.spawnQueue=[{time:1e9}];
  assert.equal(e.recharge,.15);c.update(4);near(e.hp,32);c.update(4);near(e.hp,42.2);
  e.hp=20;e.rechargeClock=4;c.update(8);near(e.hp,42.2);
  e.hp=20;e.rechargeClock=4;e.statuses.healBlock={time:4.01};c.update(4);near(e.hp,20);c.update(4);near(e.hp,32);
  e.hp=20;e.rechargeClock=4;e.statuses.regenReduction={time:4.01,amount:.5};c.update(4);near(e.hp,26);delete e.statuses.regenReduction;
  e.hp=100;e.rechargeClock=4;c.update(4);near(e.hp,100);
  for(const speed of [1,2,3,5]){e.hp=20;e.rechargeClock=4;g.speed=speed;g.paused=true;g.tick(4/speed);near(e.hp,20);g.paused=false;g.tick(4/speed);near(e.hp,32);}
 }
 const old=loadCurrentDatasets({revision:'fr005'}).crown;assert.equal(old.enemies.host_49.recharge,.1);
 for(const [id,e]of Object.entries(datasets.crown.enemies))if(id!=='host_49')assert.deepEqual(e,old.enemies[id],id+' other enemy remains exact');
});
// This fixture describes the retained pre-account FR-008 statistics contract.
function history({version='0.6.12',rulesetRevision=datasets.crown.rulesetRevision,leak=true,health=30}={}){
 const g=new Game(datasets.crown),s=new RunStatistics(g,{version}).snapshot();Object.assign(s,{rulesetRevision,outcome:leak?'lost':'won',health:leak?0:health,gold:0,wavesSurvived:leak?49:50,score:0});
 s.waves=datasets.crown.waves.map((w,i)=>{const count=w.groups.reduce((n,g)=>n+g.count,0),last=i===49,leaks=last&&leak?1:0,kills=count-leaks,bossKills=w.boss?kills:0,completed=!last||!leak;const row={index:i+1,boss:!!w.boss,completed,startHealth:i?health:30,endHealth:last&&leak?0:health,healthLost:last&&leak?health:i?0:30-health,kills,bossKills,leaks,spawned:count,durationMs:1,routeLength:10,kingdomLevel:1,mastery:0,towers:[],effects:{},enemyTypes:Object.fromEntries(w.groups.map(g=>[g.type,{spawned:g.count,kills:g.count-(last&&leak?1:0),leaks:last&&leak?1:0}]))};s.score+=(i+1)*((kills-bossKills)*10+bossKills*500+(completed?100+(w.boss?200:0):0));return row;});return s;
}
test('FR-006 backend enforces terminal final-boss checkpoints only for the new edition, retaining old cohorts without migration',()=>{
 const context={families:datasets.crown.towers,waveDefinitions:datasets.crown.waves,enemyDefinitions:datasets.crown.enemies};
 for(const health of [1,10,20,30]){const s=history({health});assert.doesNotThrow(()=>validateSnapshot(s,context));const won=history({health,leak:false});assert.doesNotThrow(()=>validateSnapshot(won,context));}
 const bad=history();bad.outcome='won';bad.health=20;Object.assign(bad.waves[49],{completed:true,endHealth:20,healthLost:10});bad.score+=15000;bad.wavesSurvived=50;assert.throws(()=>validateSnapshot(bad,context),/Final boss/);
 const old=structuredClone(bad);old.version='0.6.9';old.rulesetRevision='fr005-r2-dwarf-air-20261102';assert.doesNotThrow(()=>validateSnapshot(old,context));
 for(const factionId of ['crown','forge','grove']){assert.equal(validateFactionIdentity({...bad,factionId}),factionId);assert.throws(()=>validateFactionIdentity({...bad,factionId,rulesetRevision:old.rulesetRevision}));}
});
