import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {DeveloperConsoleSession,DEVELOPER_SETUP_VERSION} from '../game/core/developer-console.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {seededRandom,combatTowerStats} from '../game/core/math.js';
import {ENEMY_RULES,enemyDisarmActive} from '../game/core/enemy-rules.js';

const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const approved={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
const approvedBytes=JSON.stringify(approved);
const variantRound=approved.waves.findIndex(wave=>wave.groups.every(group=>!approved.enemies[group.type].variants?.length||approved.enemies[group.type].variants.length>=2)&&wave.groups.some(group=>approved.enemies[group.type].variants?.length))+1;
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
async function session(options={}){const game=new Game(approved,{seed:42}),console=new DeveloperConsoleSession(game,{onReset:replacement=>replacement,...options});await console.activate();return console;}
const add=console=>console.addDefender({family:'soldier',tier:2,x:18,z:17});
const state=game=>JSON.stringify({data:game.data,towers:game.towers,round:game.round,phase:game.phase,grid:[...game.grid.occupied],gold:game.economy.gold,lives:game.lives,cp:game.commandPoints.value,seed:game.seed});

test('activation flags the real run synchronously and waits for durable invalidation before permitting mutations',async()=>{
  const gate=defer(),game=new Game(approved,{seed:42}),calls=[];
  const console=new DeveloperConsoleSession(game,{onActivate:g=>{calls.push(g);return gate.promise;}});
  const pending=console.activate();assert.equal(game.developerMode,true);assert.equal(console.ready,false);assert.throws(()=>add(console),/disable statistics/);
  await Promise.resolve();assert.deepEqual(calls,[game]);gate.resolve();await pending;assert.equal(console.ready,true);await console.activate();assert.equal(calls.length,1);
  console.dispose();assert.equal(game.developerMode,true);assert.throws(()=>console.setPaused(false),/disable statistics/);
});

test('failed invalidation remains permanently flagged and can be retried without admitting test commands early',async()=>{
  let tries=0;const game=new Game(approved),console=new DeveloperConsoleSession(game,{onActivate:()=>{if(!tries++)throw new Error('durable storage failed');}});
  await assert.rejects(console.activate(),/durable storage/);assert.equal(game.developerMode,true);assert.throws(()=>console.setResources({gold:500}),/disable statistics/);
  await console.activate();assert.equal(console.ready,true);assert.equal(tries,2);
});

test('disposing during asynchronous activation prevents a late ready state and preserves the exclusion',async()=>{
  const gate=defer(),game=new Game(approved),console=new DeveloperConsoleSession(game,{onActivate:()=>gate.promise});const pending=console.activate();console.dispose();gate.resolve();
  await assert.rejects(pending,/ended/);assert.equal(console.ready,false);assert.equal(game.developerMode,true);
});

test('activated rules are isolated from approved data, unrelated games and immutable global defaults',async()=>{
  const console=await session(),other=new Game(approved);console.setEnemyRules('host_01',{armor:999});console.setTimingRules('disarm',{duration:9});
  assert.notEqual(console.game.data,approved);assert.equal(console.game.draft.data,console.game.data);assert.equal(console.game.economy.balance,console.game.data.balance);
  assert.equal(other.data.enemies.host_01.armor,approved.enemies.host_01.armor);assert.equal(ENEMY_RULES.disarm.duration,5);assert.equal(JSON.stringify(approved),approvedBytes);
});

test('Campaign Test reset installs a fresh excluded Game using approved rules, real resources and five latent drafts',async()=>{
  let installed,invalidated=0;const console=await session({onActivate:()=>invalidated++,onReset:replacement=>{assert.equal(replacement.developerMode,true);installed=replacement;return replacement;}});
  console.setEnemyRules('host_01',{armor:999});add(console);console.current={wave:22};console.lastWaveSetup={wave:22};
  const game=await console.resetTest({mode:'campaign',seed:7});assert.equal(game,installed);assert.equal(console.game,installed);assert.equal(invalidated,2);
  assert.equal(game.round,1);assert.equal(game.phase,'build');assert.equal(game.economy.gold,approved.balance.startingGold);assert.equal(game.towers.length,0);assert.equal(game.draft.draws.length,5);
  assert.ok(game.draft.draws.every(draw=>!draw.placed&&!draw.family));assert.equal(game.data.enemies.host_01.armor,approved.enemies.host_01.armor);assert.equal(console.current,null);assert.equal(console.lastWaveSetup,null);
});

test('Campaign Test refuses Sandbox interventions and follows real placement, keep and sequential combat',async()=>{
  const console=await session();await console.resetTest({mode:'campaign',seed:7});const game=console.game;
  for(const command of [()=>add(console),()=>console.setResources({gold:500}),()=>console.setEnemyRules('host_01',{armor:0}),()=>console.setTimingRules('rush',{period:3}),()=>console.setMvp(1,10),()=>console.setSeed(8),()=>console.setVariant(1),()=>console.importSetup({}),()=>console.restartWave()])assert.throws(command,/Sandbox/);
  assert.throws(()=>console.runWave(2),/normal draft/);for(let x=15;x<20;x++)assert.equal(game.place(x,17),true);assert.equal(game.phase,'select');assert.equal(game.keep(),true);
  assert.equal(console.runWave(1),true);assert.equal(game.phase,'combat');game.combat.spawnQueue=[];game.tick(.01);assert.equal(game.round,2);assert.equal(game.phase,'build');
  assert.equal(console.results.length,1);assert.equal(console.results[0].mode,'campaign');assert.equal(console.results[0].wave,1);assert.equal(console.results[0].completed,true);
});

test('Sandbox supports authored basic rank VI and champions without ordinary placement or committed voice events',async()=>{
  const console=await session(),events=[];console.game.on(type=>events.push(type));const basic=console.addDefender({family:'archer',tier:6,x:18,z:17,mvpLevel:10});
  const family=Object.keys(console.game.data.towers).find(key=>console.game.data.towers[key].advanced),champion=console.addDefender({family,tier:1,x:19,z:17});
  assert.equal(basic.tier,6);assert.equal(basic.mvpLevel,10);assert.equal(champion.state,'active');assert.equal(console.game.grid.occupied.get('18,17'),basic.id);
  assert.throws(()=>console.addDefender({family,tier:2,x:20,z:17}),/Rank/);assert.ok(!events.includes('place')&&!events.includes('defender-committed'));
});

test('Sandbox placement still rejects occupied, checkpoint, invalid coordinates and unknown families atomically',async()=>{
  const console=await session();add(console);const before=state(console.game);
  for(const values of [{family:'soldier',x:18,z:17},{family:'soldier',x:4,z:18},{family:'soldier',x:37,z:2},{family:'__proto__',x:19,z:17},{family:'soldier',x:19.5,z:17},{family:'soldier',x:19,z:17,mvpLevel:11}])assert.throws(()=>console.addDefender(values));
  assert.equal(state(console.game),before);
});

test('manual MVP and attack pause use real active defenders and leave approved combat stats unchanged',async()=>{
  const console=await session(),tower=add(console),original=JSON.stringify(console.game.data.towers.soldier);
  console.setMvp(tower.id,10);console.setAttackPaused(tower.id,true);assert.equal(tower.mvpLevel,10);assert.equal(tower.attackPaused,true);
  assert.equal(combatTowerStats(tower,console.game.towers,console.game.data).stats.damage,combatTowerStats({...tower,mvpLevel:0},[],console.game.data).stats.damage*1.5);
  tower.state='ruin';assert.throws(()=>console.setMvp(tower.id,5),/active/);assert.throws(()=>console.setAttackPaused(tower.id,false),/active/);assert.equal(JSON.stringify(console.game.data.towers.soldier),original);
});

test('Sandbox resources, simulation speed and pause validate values without coupling speed to the seed',async()=>{
  const console=await session(),seed=console.game.seed;console.setResources({gold:'1000',lives:'99',cp:'25'});console.setSpeed('3');console.setPaused(true);
  assert.deepEqual([console.game.economy.gold,console.game.lives,console.game.commandPoints.value,console.game.speed,console.game.paused],[1000,99,25,3,true]);assert.equal(console.game.seed,seed);
  const before=state(console.game);for(const values of [{gold:-1},{gold:Infinity},{lives:0},{cp:NaN},{gold:null},{gold:''}])assert.throws(()=>console.setResources(values));assert.equal(state(console.game),before);
  for(const value of [0,4,1.5,null])assert.throws(()=>console.setSpeed(value));
});

test('forced variants use actual authored queue profiles and reproducible per-invader random variants stay separate',async()=>{
  const console=await session();console.setVariant(1);console.runWave(variantRound);const game=console.game;
  for(const queued of game.combat.spawnQueue){const variants=game.data.enemies[queued.type].variants||[];if(variants.length)assert.deepEqual(queued.modifiers.variant,variants[1]);}
  assert.equal(game.rng(),seededRandom(game.seed)(),'forcing profiles consumes no variant RNG');
  const first=await session(),second=await session();first.runWave(variantRound);second.runWave(variantRound);
  assert.deepEqual(first.game.combat.spawnQueue,second.game.combat.spawnQueue);assert.ok(first.game.combat.spawnQueue.every(q=>!q.modifiers.variant||approved.enemies[q.type].variants.some(variant=>JSON.stringify(variant)===JSON.stringify(q.modifiers.variant))));
});

test('invalid variant/wave commands do not clear current drafts or mutate the battlefield',async()=>{
  const console=await session();console.setVariant(50);const before=state(console.game),draws=JSON.stringify(console.game.draft.draws);
  assert.throws(()=>console.runWave(variantRound),/variant/);assert.equal(state(console.game),before);assert.equal(JSON.stringify(console.game.draft.draws),draws);
  for(const value of [0,51,2.5])assert.throws(()=>console.runWave(value));
});

test('Sandbox starting at a chosen wave clears draft/Move state and lowers construction mastery correctly when returning to wave one',async()=>{
  const console=await session();add(console);console.runWave(25);assert.equal(console.game.economy.mastery,15);assert.equal(console.game.draft.draws.length,0);
  console.runWave(1);assert.equal(console.game.economy.mastery,0);assert.equal(console.game.round,1);assert.equal(console.game.selected,null);assert.equal(console.game.selectedEnemy,null);assert.equal(console.game.commandMove.active,false);
});

test('restart restores the saved pre-wave lineup, resources, MVP levels, rules and seeded enemy queue',async()=>{
  const console=await session(),tower=add(console);console.setMvp(tower.id,3);console.setResources({gold:432,lives:27,cp:12});console.setTimingRules('recharge',{period:3});console.runWave(variantRound);
  const queued=JSON.stringify(console.game.combat.spawnQueue),start=structuredClone(console.lastWaveSetup);console.setResources({gold:9,lives:2,cp:0});console.setMvp(tower.id,8);console.game.combat.spawnQueue.shift();console.game.combat.elapsed=8;
  console.restartWave();assert.equal(JSON.stringify(console.game.combat.spawnQueue),queued);assert.deepEqual(console.game.towers.map(t=>[t.family,t.tier,t.x,t.z,t.mvpLevel]),start.towers.map(t=>[t.family,t.tier,t.x,t.z,t.mvpLevel]));
  assert.equal(console.game.lives,27);assert.equal(console.game.economy.gold,432);assert.equal(console.game.combat.elapsed,0);assert.equal(console.game.combat.rules.recharge.period,3);
});

test('temporary numeric enemy profiles reach future real variants without mutating already spawned enemies',async()=>{
  const console=await session();console.runWave(variantRound);const type=console.game.wave.groups.find(group=>console.game.data.enemies[group.type].variants?.length).type;
  const old=console.spawnEnemy(type,0);console.setEnemyRules(type,{armor:73,regen:.1,recharge:.2,evasion:.15,reactiveArmor:11});const current=console.spawnEnemy(type,1);
  assert.notEqual(old.armor,73);assert.equal(current.armor,73);assert.equal(current.regen,.1);assert.equal(current.recharge,.2);assert.equal(current.reactiveArmor,11);assert.equal(JSON.stringify(approved),approvedBytes);
});

test('timing overrides are read dynamically by actual combat, including legitimate zero defense settings',async()=>{
  const console=await session();console.setTimingRules('disarm',{duration:2,period:10,radius:0});console.setTimingRules('reactive',{maxStacks:0,decayPerSecond:0});
  assert.equal(console.game.combat.rules.disarm.duration,2);assert.equal(console.game.combat.rules.disarm.period,10);assert.equal(console.game.combat.rules.disarm.radius,0);assert.equal(console.game.combat.rules.reactive.maxStacks,0);
  assert.equal(ENEMY_RULES.disarm.period,8);assert.throws(()=>console.setTimingRules('disarm',{period:0}));assert.throws(()=>console.setTimingRules('disarm',{unknown:3}));assert.throws(()=>console.setEnemyRules('host_01',{script:'globalThis.pwned=1'}));assert.throws(()=>console.setEnemyRules('__proto__',{armor:5}));
});

test('spawn permits authored bosses/variants during combat and accounts for each additional actual invader',async()=>{
  const console=await session();assert.throws(()=>console.spawnEnemy('host_01'),/Start a wave/);console.runWave(1);const total=console.game.combat.total,bossType=Object.keys(console.game.data.enemies).find(key=>console.game.data.enemies[key].boss);
  const boss=console.spawnEnemy(bossType);assert.equal(boss.boss,true);assert.equal(console.game.combat.total,total+1);assert.ok(console.game.combat.enemies.includes(boss));
  const rng=console.game.rng;let rolls=0;console.game.rng=()=>{rolls++;return rng();};console.spawnEnemy('host_01');assert.equal(rolls,0,'profiles without alternatives consume no variant random draw');
  assert.throws(()=>console.spawnEnemy('host_01',0),/no alternate variants/);assert.throws(()=>console.spawnEnemy('__proto__'));
});

test('save/load round trip preserves approved variant differences, rank, MVP, attack pause and inactive walls',async()=>{
  const console=await session(),tower=add(console);console.setMvp(tower.id,8);console.setAttackPaused(tower.id,true);console.addDefender({family:'mage',tier:6,x:19,z:17}).state='ruin';console.setResources({gold:777,lives:40,cp:9});
  const variants=JSON.stringify(console.baseData.enemies);const saved=console.exportSetup();assert.equal(saved.schemaVersion,DEVELOPER_SETUP_VERSION);assert.deepEqual(saved.enemies,{});
  console.importSetup(JSON.stringify(saved));assert.deepEqual(console.exportSetup(),saved);assert.equal(JSON.stringify(console.game.data.enemies),variants);assert.equal(console.game.grid.occupied.size,2);
});

test('saved temporary profiles and timing are reapplied in an isolated validated import',async()=>{
  const console=await session();add(console);console.setEnemyRules('host_01',{armor:63,regen:.07});console.setTimingRules('rush',{duration:1,period:4});const saved=console.exportSetup();console.restoreRules();
  assert.equal(console.game.data.enemies.host_01.armor,approved.enemies.host_01.armor);console.importSetup(saved);assert.equal(console.game.data.enemies.host_01.armor,63);assert.equal(console.game.combat.rules.rush.period,4);assert.equal(JSON.stringify(approved),approvedBytes);
});

test('import clears obsolete live/projectile/queue selections and wave-local contribution after a completed test',async()=>{
  const console=await session();add(console);const saved=console.exportSetup();console.runWave(1);const enemy=console.spawnEnemy('host_01');console.game.combat.projectiles=[{target:enemy}];console.game.phase='lost';console.current={wave:1};console.game.selectedEnemy=enemy.id;
  console.importSetup(saved);assert.equal(console.game.phase,'ready');assert.deepEqual(console.game.combat.enemies,[]);assert.deepEqual(console.game.combat.projectiles,[]);assert.deepEqual(console.game.combat.spawnQueue,[]);assert.equal(console.current,null);assert.equal(console.game.selectedEnemy,null);assert.equal(console.game.mvp.damage.size,0);
});

test('invalid late placement, resource, variant, schema and executable fields are rejected before any import commit',async()=>{
  const console=await session();add(console);const saved=console.exportSetup(),before=state(console.game);
  const bad=[{...saved,schemaVersion:2},{...saved,towers:[...saved.towers,{family:'__proto__',tier:1,x:19,z:17}]},{...saved,towers:[...saved.towers,{...saved.towers[0]}]},{...saved,resources:{gold:-1}},{...saved,enemies:{host_01:{'__proto__':null,script:'alert(1)'}}},{...saved,enemyRules:{disarm:{period:0}}},{...saved,wave:variantRound,variant:50},{...saved,towers:Array(251).fill(saved.towers[0])}];
  for(const row of bad){assert.throws(()=>console.importSetup(row));assert.equal(state(console.game),before);}
  assert.throws(()=>console.importSetup('globalThis.executed = true'));assert.throws(()=>console.importSetup(' '.repeat(1000001)),/too large/);assert.equal(globalThis.executed,undefined);
});

test('actual armor→Shell→effective HP damage traces expose no private enemy positions or mutable references',async()=>{
  const console=await session(),tower=add(console);console.setEnemyRules('host_01',{armor:100,krakenShell:4});console.runWave(1);const enemy=console.spawnEnemy('host_01');enemy.hp=3;
  const result=console.game.combat.resolveDamage(enemy,100,'physical',{directHit:true},tower),trace=console.traces.at(-1);
  assert.equal(trace.beforeDefense,result.beforeDefense);assert.equal(trace.afterArmor,result.afterArmor);assert.equal(trace.shellBlock,4);assert.equal(trace.effectiveDamage,3);assert.equal(trace.sourceId,tower.id);assert.equal(trace.enemyType,'host_01');assert.equal(console.current.damage.get(tower.id),3);
  for(const key of ['enemy','source','x','z','hp','maxHp','route','statuses'])assert.equal(Object.hasOwn(trace,key),false);
  trace.beforeDefense=222;assert.equal(result.beforeDefense,100);assert.equal(enemy.dead,true);
});

test('blocked actual hits retain defense reason and contribute no effective damage or MVP score',async()=>{
  const console=await session(),tower=add(console);console.runWave(1);const enemy=console.spawnEnemy('host_01');enemy.physicalImmune=true;
  console.game.combat.resolveDamage(enemy,100,'physical',{directHit:true},tower);assert.equal(console.traces.at(-1).blockReason,'physical-immunity');assert.equal(console.current.damage.size,0);assert.equal(console.game.mvp.damageFor(tower),0);
  enemy.physicalImmune=false;enemy.shields=1;console.game.combat.resolveDamage(enemy,100,'physical',{directHit:true},tower);assert.equal(console.traces.at(-1).blockReason,'shield');assert.equal(console.traces.at(-1).effectiveDamage,0);
});

test('real completed waves produce one bounded test result with setup/rule provenance and damage excluding overkill',async()=>{
  const console=await session(),tower=add(console);console.runWave(1);const enemy=console.spawnEnemy('host_01');const hp=enemy.hp;console.game.combat.damage(enemy,hp*100,'holy',{},tower);console.game.combat.spawnQueue=[];console.game.tick(.01);
  assert.equal(console.results.length,1);const result=console.results[0];assert.equal(result.damage[0].damage,hp);assert.equal(result.setup.seed,42);assert.equal(result.setup.towers[0].family,'soldier');assert.equal(result.wave,1);assert.equal(result.mode,'sandbox');assert.equal(result.completed,true);
  console.game.emit('won');assert.equal(console.results.length,1);const snapshot=console.snapshot();snapshot.results[0].damage[0].damage=99999;assert.equal(console.results[0].damage[0].damage,hp);
});

test('trace and intervention buffers remain bounded across repeated real damage and simulation changes',async()=>{
  const console=await session(),tower=add(console);console.runWave(1);const enemy=console.spawnEnemy('host_01');enemy.hp=1e9;enemy.maxHp=1e9;
  for(let i=0;i<100;i++)console.game.combat.damage(enemy,1,'holy',{},tower);for(let i=0;i<220;i++)console.setPaused(!!(i%2));
  assert.equal(console.traces.length,40);assert.equal(console.log.length,200);const before=console.traces.length;console.dispose();console.game.combat.damage(enemy,1,'holy',{},tower);assert.equal(console.traces.length,before);
});

test('restoring approved rules is between-wave only and never restores statistics eligibility',async()=>{
  const console=await session();console.setEnemyRules('host_01',{armor:444});console.runWave(1);assert.throws(()=>console.restoreRules(),/Finish or restart/);console.game.phase='ready';console.restoreRules();
  assert.equal(console.game.data.enemies.host_01.armor,approved.enemies.host_01.armor);assert.equal(console.game.developerMode,true);assert.equal(console.ready,true);
});

test('missing or mismatched reset installation cannot silently detach the active console from its Game',async()=>{
  const first=await session({onReset:null}),game=first.game;await assert.rejects(first.resetTest(),/not connected/);assert.equal(first.game,game);
  const second=await session({onReset:()=>new Game(approved)}),old=second.game;await assert.rejects(second.resetTest(),/supplied test Game/);assert.equal(second.game,old);
});

test('normal timestamp seeds remain intact during invalidation and are exported/reset as the same unsigned seededRandom input',async()=>{
  const timestamp=Date.UTC(2026,9,11),game=new Game(approved,{seed:timestamp,waveLimit:10});let excluded;
  const console=new DeveloperConsoleSession(game,{onActivate:current=>{excluded={seed:current.seed,limit:current.waveLimit};},onReset:replacement=>replacement});await console.activate();
  assert.deepEqual(excluded,{seed:timestamp,limit:10});assert.equal(game.seed,timestamp);assert.equal(console.snapshot().seed,timestamp>>>0);assert.equal(console.exportSetup().seed,timestamp>>>0);
  const exported=console.exportSetup();console.importSetup(exported);assert.equal(game.seed,timestamp>>>0);assert.equal(game.rng(),seededRandom(timestamp)());
  await console.resetTest({mode:'campaign'});assert.equal(console.game.seed,timestamp>>>0);assert.equal(console.game.waveLimit,10);
});

test('Sandbox can test all fifty authored waves from a ten-wave campaign while Campaign Test preserves its original limit',async()=>{
  const game=new Game(approved,{seed:42,waveLimit:10}),console=new DeveloperConsoleSession(game,{onReset:replacement=>replacement});await console.activate();
  assert.equal(console.waveLimit,50);console.runWave(50);assert.equal(game.round,50);assert.equal(game.waveLimit,50);assert.ok(game.combat.spawnQueue.length>0);
  await console.resetTest({mode:'campaign'});assert.equal(console.waveLimit,10);assert.equal(console.game.waveLimit,10);assert.throws(()=>console.runWave(11),/Wave must/);
  await console.resetTest({mode:'sandbox'});assert.equal(console.waveLimit,50);console.importSetup({...console.exportSetup(),wave:50});console.runWave(50);assert.equal(console.game.round,50);
});

test('Sandbox replay restores native enemy/shot identities and the real ID-staggered disarm timeline; Campaign retains natural serial progression',async()=>{
  const console=await session(),round=console.game.data.waves.findIndex(wave=>wave.groups.some(group=>console.game.data.enemies[group.type].disarm))+1;assert.ok(round>0);
  console.runWave(round);let queued=console.game.combat.spawnQueue.shift(),enemy=console.game.combat.spawn(queued.type,queued.modifiers);assert.equal(enemy.disarm,true);
  const original={id:enemy.id,windows:Array.from({length:100},(_,n)=>enemyDisarmActive(enemy,n/10,0,console.game.combat.rules))};console.game.combat.shotSerial=731;
  console.restartWave();queued=console.game.combat.spawnQueue.shift();enemy=console.game.combat.spawn(queued.type,queued.modifiers);
  assert.equal(console.game.combat.shotSerial,0);assert.equal(enemy.id,original.id);assert.deepEqual(Array.from({length:100},(_,n)=>enemyDisarmActive(enemy,n/10,0,console.game.combat.rules)),original.windows);
  await console.resetTest({mode:'campaign'});const game=console.game;for(let x=15;x<20;x++)game.place(x,17);game.keep();game.combat.serial=71;console.runWave();assert.equal(game.combat.serial,71,'approved Campaign Test does not reset native combat identities');
});
