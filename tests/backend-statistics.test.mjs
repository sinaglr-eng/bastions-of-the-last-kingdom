import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, readdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname, resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import worker from '../backend/worker.js';
import {playerName, validateSnapshot} from '../backend/validation.js';
import {Game} from '../game/core/game.js';
import {RunStatistics} from '../game/core/run-statistics.js';
import {towerStats} from '../game/core/math.js';
import {StatisticsClient} from '../game/core/statistics-client.js';
import {report, csvRows} from '../tools/statistics-report.mjs';

const data = Object.fromEntries(['balance', 'towers', 'enemies', 'waves', 'recipes'].map(name =>
  [name, JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url)))]));
const access = 'a'.repeat(64), version = '0.2.8';
const uuid = number => `12345678-1234-4234-8234-${String(number).padStart(12, '0')}`;

function storage() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../backend/migrations/0000_statistics.sql', import.meta.url), 'utf8'));
  const prepare = (sql, values = []) => ({
    bind(...bound) {return prepare(sql, bound);},
    async first() {return sqlite.prepare(sql).get(...values) || null;},
    async all() {return {results: sqlite.prepare(sql).all(...values)};},
    async run() {const result = sqlite.prepare(sql).run(...values);return {success: true, meta: {changes: Number(result.changes)}};},
    execute() {const result = sqlite.prepare(sql).run(...values);return {success: true, meta: {changes: Number(result.changes)}};},
  });
  return {
    sqlite,
    DB: {prepare, async batch(statements) {
      sqlite.exec('BEGIN');
      try {const result = statements.map(statement => statement.execute());sqlite.exec('COMMIT');return result;}
      catch (error) {sqlite.exec('ROLLBACK');throw error;}
    }},
    close() {sqlite.close();},
  };
}
const request = (store, path, body, options = {}) => worker.fetch(new Request(`https://statistics.example${path}`, {
  method: body ? 'POST' : 'GET', headers: {'Content-Type': 'application/json', ...options.headers},
  ...(body ? {body: JSON.stringify(body)} : {}),
}), {DB: store.DB, GAME_ORIGINS: 'https://sinaglr-eng.github.io', ADMIN_TOKEN: 'test-owner-access'});

function run(mode, id, edition=version) {
  const game = new Game(data, {seed: 42, waveLimit: mode});
  const statistics = new RunStatistics(game, {id, version: edition, clock: () => 1000});
  let cell = 0;
  function build() {
    game.draft.forced = {family: 'archer', tier: 1};
    while (game.phase === 'build') {
      assert.ok(cell < 37*37, 'Test ran out of valid placement cells');
      const x = cell%37, z = Math.floor(cell++/37);
      game.place(x, z);
    }
    assert.equal(game.phase, 'select');assert.equal(game.keep(), true);
  }
  function assault({kill = true} = {}) {
    build();assert.equal(game.startCombat(), true);
    for (const item of game.combat.spawnQueue.splice(0)) game.combat.spawn(item.type, item.modifiers);
    if (kill) {
      const source = game.towers.find(tower => tower.state === 'active');
      for (const enemy of game.combat.enemies) game.combat.damage(enemy, 1e9, 'pure', {}, source);
    } else {
      for (const enemy of game.combat.enemies) enemy.pathIndex = enemy.route.length;
    }
    game.tick(.01);
    return statistics.snapshot();
  }
  return {game, statistics, assault};
}

test('Secret Champions defaults to edition 0.2.8 while preserving separate Dark Host results', async () => {
  const store=storage(), playedRuns=[];
  try {
    const health=await request(store,'/api/health');
    assert.equal(health.status,200);
    assert.deepEqual(await health.json(),{ok:true,storage:'SQLite',edition:version,releaseName:'Secret Champions'});
    const page=await request(store,'/');
    assert.equal(page.status,200);
    const html=await page.text();
    assert.ok(html.includes('/api/leaderboard?version=0.2.8&mode='));
    assert.ok(html.includes('0.2.8 · Secret Champions. Finish a campaign'));
    assert.ok(!html.includes('/api/leaderboard?version=0.2.7&mode='));
    for(const [index,edition] of ['0.2.7',version].entries()) {
      const id=uuid(index+2), played=run(10,id,edition); playedRuns.push(played);
      assert.equal((await request(store,'/api/runs',{id,writeToken:access,mode:10,seed:42,version:edition})).status,201);
      let final;
      for(let wave=0;wave<10;wave++)final=played.assault();
      assert.equal((await request(store,`/api/runs/${id}/checkpoint`,{writeToken:access,snapshot:final})).status,200);
      assert.equal((await request(store,`/api/runs/${id}/score`,{writeToken:access,name:index?'Secret Champions':'Dark Host'})).status,200);
      const own=await request(store,`/api/leaderboard?mode=10&version=${edition}&id=${id}`);
      const result=await own.json();
      assert.equal(result.version,edition);assert.equal(result.current.rank,1);
      assert.equal(result.top.length,1);assert.equal(result.top[0].id,id);
    }
    assert.equal(store.sqlite.prepare('SELECT COUNT(*) AS n FROM runs').get().n,2);
    const current=await request(store,`/api/leaderboard?mode=10&version=${version}&id=${uuid(2)}`);
    const result=await current.json();
    assert.equal(result.current,null);assert.equal(result.top.length,1);assert.equal(result.top[0].name,'Secret Champions');
    const older=await request(store,'/api/leaderboard?mode=10&version=0.2.7');
    assert.equal((await older.json()).top[0].name,'Dark Host');
  } finally {for(const played of playedRuns)played.statistics.dispose();store.close();}
});

test('native SQLite supports the D1 schema, transactions, JSON analytics and name normalization safely', async () => {
  const store = storage();
  try {
    assert.equal(playerName('  Žluťoučký   Kushek  '), 'Žluťoučký Kushek');
    for (const name of ['<img src=x onerror=alert(1)>', "x'); DROP TABLE runs; --", 'a'.repeat(25), '\u202eabc']) assert.throws(() => playerName(name));
    const create = {id: uuid(1), writeToken: access, mode: 10, seed: 42, version};
    assert.equal((await request(store, '/api/runs', create)).status, 201);
    assert.equal((await request(store, '/api/runs', create)).status, 201);
    assert.equal(store.sqlite.prepare('SELECT COUNT(*) AS n FROM runs').get().n, 1);
    assert.equal((await request(store, '/api/runs', {...create, writeToken: 'b'.repeat(64)})).status, 403);
    assert.equal((await request(store, `/api/runs/${uuid(1)}/score`, {writeToken: access, name: 'Kushek'})).status, 409);
    assert.equal((await request(store, '/api/admin/statistics')).status, 401);
  } finally {store.close();}
});

test('real secret crafting retains ingredient draws, result families, combat performance and effect uptime in the existing SQLite schema',async()=>{
  const store=storage(),playedRuns=[];
  try{
    const originalTables=store.sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all();
    for(const [index,family] of ['ladyclaire','lordbernhard'].entries()){
      const played=run(10,uuid(160+index)),g=played.game;playedRuns.push(played);
      const recipe=data.recipes.find(r=>r.id===family);assert.equal(recipe.currentRoundOnly,true);
      const draws=[...recipe.ingredients,{family:'archer',tier:1},{family:'cleric',tier:1}];
      for(let i=0;i<draws.length;i++){Object.assign(g.draft.draws[i],draws[i]);assert.equal(g.place(8+i,19),true);}
      g.select(g.towers[0].id);assert.equal(g.craft(family),true);assert.equal(g.phase,'ready');
      const champion=g.selection;assert.equal(champion.family,family);assert.equal(g.startCombat(),true);
      g.combat.spawnQueue.length=0;
      const enemy=g.combat.spawn('host_01');Object.assign(enemy,{x:champion.x+.5,z:champion.z});
      g.combat.damage(enemy,1,'pure',{},champion);
      if(family==='ladyclaire'){
        g.rng=()=>0;g.tick(.01);
        assert.ok(champion.melancholy>0,'The actual attack-start penalty fires');
        g.tick(.25);
      }else{
        g.combat.applyEffects(enemy,towerStats(champion,data),champion);
      }
      played.statistics.sample(.25);
      const snapshot=played.statistics.snapshot();
      assert.deepEqual(snapshot.draws.slice(0,3).map(t=>({family:t.family,tier:t.tier})),recipe.ingredients);
      assert.deepEqual(snapshot.decisions.map(t=>[t.family,t.action,t.tier]),[[family,'combine',1]],'Crafting records the new secret family instead of its consumed anchor');
      const unit=snapshot.waves[0].towers.find(t=>t.family===family);assert.ok(unit.damage>0);assert.equal(unit.hits,1);
      if(family==='ladyclaire'){
        assert.ok(snapshot.waves[0].effects.melancholy>0,'The penalty duration is retained as an existing effect value');
        assert.equal(snapshot.waves[0].effects.melancholyTriggers,1);
        assert.equal(unit.controlSeconds,0,'Self-disarm is not reported as control of an enemy');
      }else assert.equal(snapshot.waves[0].effects.poison,.25);
      const canonical=validateSnapshot(snapshot,{families:data.towers,waveDefinitions:data.waves,enemyDefinitions:data.enemies});
      const create={id:snapshot.id,writeToken:access,mode:snapshot.mode,seed:snapshot.seed,version};
      assert.equal((await request(store,'/api/runs',create)).status,201);
      assert.equal((await request(store,`/api/runs/${snapshot.id}/checkpoint`,{writeToken:access,snapshot})).status,200);
      const saved=store.sqlite.prepare('SELECT summary_json FROM runs WHERE id = ?').get(snapshot.id);
      assert.deepEqual(JSON.parse(saved.summary_json).decisions,canonical.decisions);
      const wave=JSON.parse(store.sqlite.prepare('SELECT snapshot_json FROM run_waves WHERE run_id = ? AND wave = 1').get(snapshot.id).snapshot_json);
      assert.deepEqual(wave.effects,snapshot.waves[0].effects);assert.deepEqual(wave.towers,snapshot.waves[0].towers);
      const unknown=structuredClone(snapshot);unknown.sequence++;unknown.decisions[0].family='unknownSecret';
      assert.equal((await request(store,`/api/runs/${snapshot.id}/checkpoint`,{writeToken:access,snapshot:unknown})).status,400,'New legitimate families do not permit arbitrary family IDs');
    }
    const report=await request(store,'/api/admin/statistics',null,{headers:{Authorization:'Bearer test-owner-access'}});
    assert.equal(report.status,200);const analytics=await report.json();
    for(const family of ['ladyclaire','lordbernhard']){
      const decision=analytics.decisions.find(row=>row.family===family);assert.equal(decision.action,'combine');assert.equal(decision.chosen,1);assert.equal(decision.version,version);
      const defender=analytics.defenders.find(row=>row.family===family);assert.equal(defender.waveDeployments,1);assert.ok(defender.damage>0);assert.equal(defender.hits,1);
    }
    assert.deepEqual(store.sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all(),originalTables,'Secret statistics need no new table or schema migration');
  }finally{for(const played of playedRuns)played.statistics.dispose();store.close();}
});

test('real Game and RunStatistics produce accepted 10-wave and 50-wave wins below the request size limit', async t => {
  for (const mode of [10, 50]) {
    const played = run(mode, uuid(mode)), store = storage();
    try {
      assert.equal((await request(store, '/api/runs', {id: uuid(mode), writeToken: access, mode, seed: 42, version})).status, 201);
      let snapshot;
      for (let index = 0; index < mode; index++) {
        snapshot = played.assault();
        validateSnapshot(snapshot, {families: data.towers, waveDefinitions: data.waves, enemyDefinitions: data.enemies});
        assert.equal((await request(store, `/api/runs/${uuid(mode)}/checkpoint`, {writeToken: access, snapshot})).status, 200);
      }
      assert.equal(snapshot.outcome, 'won');assert.equal(snapshot.wavesSurvived, mode);assert.equal(snapshot.score, played.game.score);
      const size = Buffer.byteLength(JSON.stringify({writeToken: access, snapshot}));
      assert.ok(size < 500000);t.diagnostic(`${mode}-wave full checkpoint: ${size} bytes`);
      const score = await request(store, `/api/runs/${uuid(mode)}/score`, {writeToken: access, name: 'Kushek'});
      assert.equal(score.status, 200);assert.equal((await score.json()).current.score, played.game.score);
      const repeated = await request(store, `/api/runs/${uuid(mode)}/score`, {writeToken: access, name: 'Kushek'});
      assert.equal(repeated.status, 200);
      assert.equal((await request(store, `/api/runs/${uuid(mode)}/score`, {writeToken: access, name: 'Different'})).status, 409);
      const analytics = await request(store, '/api/admin/statistics', null, {headers: {Authorization: 'Bearer test-owner-access'}});
      assert.equal(analytics.status, 200);
      const stats = await analytics.json();assert.equal(stats.waves.length, mode);
      assert.equal(stats.runs[0].runs, 1);assert.equal(stats.runs[0].outcome, 'won');
    } finally {played.statistics.dispose();store.close();}
  }
});

test('real enemy leaks terminate a loss and checkpoint retries cannot rewrite newer wave rows', async () => {
  const played = run(10, uuid(20)), store = storage();
  try {
    await request(store, '/api/runs', {id: uuid(20), writeToken: access, mode: 10, seed: 42, version});
    const first = played.assault({kill: false});
    assert.equal((await request(store, `/api/runs/${uuid(20)}/checkpoint`, {writeToken: access, snapshot: first})).status, 200);
    let latest = first;
    while (played.game.phase !== 'lost') latest = played.assault({kill: false});
    assert.equal(latest.health, 0);assert.equal(latest.outcome, 'lost');
    assert.equal((await request(store, `/api/runs/${uuid(20)}/checkpoint`, {writeToken: access, snapshot: latest})).status, 200);
    const before = store.sqlite.prepare('SELECT * FROM runs').get();
    assert.equal((await request(store, `/api/runs/${uuid(20)}/checkpoint`, {writeToken: access, snapshot: first})).status, 200);
    assert.deepEqual(store.sqlite.prepare('SELECT * FROM runs').get(), before);
    assert.equal((await request(store, `/api/runs/${uuid(20)}/score`, {writeToken: access, name: 'Leaker'})).status, 200);
  } finally {played.statistics.dispose();store.close();}
});

test('snapshot validation rejects inconsistent warband totals and impossible zero-health victories', () => {
  const played = run(10, uuid(30));
  try {
    let completed;
    for (let index = 0; index < 10; index++) completed = played.assault();
    const wrong = structuredClone(completed);
    const type = Object.keys(wrong.waves[0].enemyTypes)[0];wrong.waves[0].enemyTypes[type].kills--;
    assert.throws(() => validateSnapshot(wrong, {families: data.towers, waveDefinitions: data.waves, enemyDefinitions: data.enemies}));
    const zero = structuredClone(completed);zero.health = 0;zero.waves.at(-1).endHealth = 0;
    assert.throws(() => validateSnapshot(zero, {families: data.towers, waveDefinitions: data.waves, enemyDefinitions: data.enemies}));
  } finally {played.statistics.dispose();}
});

test('newer checkpoint requests cannot delete or rewrite an already completed history prefix', async () => {
  const played = run(10, uuid(40)), store = storage();
  try {
    await request(store, '/api/runs', {id: uuid(40), writeToken: access, mode: 10, seed: 42, version});
    const first = played.assault();
    assert.equal((await request(store, `/api/runs/${uuid(40)}/checkpoint`, {writeToken: access, snapshot: first})).status, 200);
    const before = store.sqlite.prepare('SELECT score, waves_survived, sequence FROM runs').get();
    const regression = {...first, sequence: first.sequence+1, waves: [], wavesSurvived: 0, score: 0};
    const reply = await request(store, `/api/runs/${uuid(40)}/checkpoint`, {writeToken: access, snapshot: regression});
    assert.ok([400, 409].includes(reply.status));
    assert.deepEqual(store.sqlite.prepare('SELECT score, waves_survived, sequence FROM runs').get(), before);
  } finally {played.statistics.dispose();store.close();}
});

test('CORS accepts the game origin, rejects other browsers and never publishes admin credentials', async () => {
  const store = storage();
  try {
    const valid = await request(store, '/api/health', null, {headers: {Origin: 'https://sinaglr-eng.github.io'}});
    assert.equal(valid.status, 200);assert.equal(valid.headers.get('Access-Control-Allow-Origin'), 'https://sinaglr-eng.github.io');
    const invalid = await request(store, '/api/health', null, {headers: {Origin: 'https://malicious.example'}});
    assert.equal(invalid.status, 403);assert.equal(invalid.headers.get('Access-Control-Allow-Origin'), null);
    assert.ok(!(await valid.text()).includes('test-owner-access'));
  } finally {store.close();}
});

test('canonical snapshots discard untrusted fields and validate every retained analytics value', () => {
  const played = run(10, uuid(50));
  try {
    const snapshot = played.assault();
    snapshot.untrusted = 'outside';snapshot.waves[0].untrusted = 'inside';
    snapshot.waves[0].towers[0].untrusted = 'defender';snapshot.decisions[0].untrusted = 'decision';
    const clean = validateSnapshot(snapshot, {families: data.towers, waveDefinitions: data.waves, enemyDefinitions: data.enemies});
    assert.ok(!('untrusted' in clean));assert.ok(!('untrusted' in clean.waves[0]));
    assert.ok(!('untrusted' in clean.waves[0].towers[0]));assert.ok(!('untrusted' in clean.decisions[0]));
    snapshot.waves[0].towers[0].supportSeconds = {large: 'unexpected object'};
    assert.throws(() => validateSnapshot(snapshot, {families: data.towers, waveDefinitions: data.waves, enemyDefinitions: data.enemies}));
  } finally {played.statistics.dispose();}
});

test('oversized chunked requests cancel the incoming stream before parsing or inserting a run', async () => {
  const store = storage();let cancelled = false;
  try {
    let chunk = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (chunk++ < 4) controller.enqueue(new Uint8Array(200000).fill(32));
        else controller.close();
      }, cancel() {cancelled = true;},
    });
    const incoming = new Request('https://statistics.example/api/runs', {method: 'POST', body: stream, duplex: 'half'});
    const reply = await worker.fetch(incoming, {DB: store.DB});
    assert.ok([400, 413].includes(reply.status));assert.equal(cancelled, true);
    assert.equal(store.sqlite.prepare('SELECT COUNT(*) AS n FROM runs').get().n, 0);
  } finally {store.close();}
});

test('final results stay frozen and their harmless higher-sequence retry still permits naming the score', async () => {
  const played = run(10, uuid(60)), store = storage();
  let now = 1000;
  played.statistics.clock = () => now;
  try {
    await request(store, '/api/runs', {id: uuid(60), writeToken: access, mode: 10, seed: 42, version});
    let final;
    for (let index = 0; index < 10; index++) {now += 500;final = played.assault();}
    assert.equal((await request(store, `/api/runs/${uuid(60)}/checkpoint`, {writeToken: access, snapshot: final})).status, 200);
    const stored = store.sqlite.prepare('SELECT * FROM runs').get();
    now += 60000;const retry = played.statistics.snapshot();
    assert.equal(retry.durationMs, final.durationMs, 'The results screen must not extend the played duration');
    assert.ok(retry.sequence > final.sequence);
    assert.equal((await request(store, `/api/runs/${uuid(60)}/checkpoint`, {writeToken: access, snapshot: retry})).status, 200);
    assert.deepEqual(store.sqlite.prepare('SELECT * FROM runs').get(), stored, 'Final retries never modify the accepted result');
    assert.equal((await request(store, `/api/runs/${uuid(60)}/score`, {writeToken: access, name: 'Final retry'})).status, 200);
  } finally {played.statistics.dispose();store.close();}
});

test('the real StatisticsClient drains newer checkpoints queued during its first upload and saves a previously uploaded final score', async () => {
  const store = storage(), played = run(10, uuid(70)), previousWindow = globalThis.window;
  const values = new Map();const storageApi = {getItem: key => values.get(key)||null, setItem: (key, value) => values.set(key, value)};
  globalThis.window = {addEventListener() {}, removeEventListener() {}};
  let releaseFirst, observeFirst, first = true;
  const gate = new Promise(resolve => {releaseFirst = resolve;});
  const observed = new Promise(resolve => {observeFirst = resolve;});
  const client = new StatisticsClient(played.game, {endpoint: 'https://statistics.example', storage: storageApi,
    fetcher: async (url, options) => {
      if (first) {first = false;observeFirst();await gate;}
      return worker.fetch(new Request(url, options), {DB: store.DB});
    }});
  try {
    played.assault();await observed;
    // Hold the real first registration request while nine newer waves finish.
    for (let index = 1; index < 10; index++) played.assault();
    releaseFirst();
    assert.equal(await client.flush(), true);
    assert.ok(client.pendingMemory === null, 'The existing flush must drain the newest queued result before resolving');
    assert.equal(store.sqlite.prepare('SELECT outcome FROM runs').get().outcome, 'won');
    const result = await client.saveScore('Client final');
    assert.equal(result.current.name, 'Client final');assert.equal(result.current.score, played.game.score);
    assert.equal(result.current.outcome, 'won');assert.ok(client.pendingMemory === null);
    assert.deepEqual(client.readQueue(), []);
  } finally {releaseFirst();client.dispose();played.statistics.dispose();store.close();globalThis.window = previousWindow;}
});

test('default browser fetch is invoked with its permitted receiver and first-wave analytics reach SQLite', async()=>{
  const store=storage(),previousWindow=globalThis.window,previousFetch=globalThis.fetch;
  const game=new Game(data,{seed:42,waveLimit:10});
  const values=new Map(),storageApi={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  globalThis.window={addEventListener(){},removeEventListener(){}};
  let requests=0;
  globalThis.fetch=async function(url,options){
    if(this!==undefined&&this!==globalThis)throw new TypeError('Illegal invocation');
    requests++;return worker.fetch(new Request(url,options),{DB:store.DB});
  };
  // Exercise the default global fetch, rather than injecting an arrow function
  // that would conceal a bad Window method receiver in the client.
  const client=new StatisticsClient(game,{endpoint:'https://statistics.example',storage:storageApi});
  client.tracker.id=uuid(153);client.tracker.version=version;
  try{
    game.draft.forced={family:'archer',tier:1};assert.equal(game.place(8,19),true);
    assert.equal(await client.flush(),true);assert.equal(requests,2);
    let row=store.sqlite.prepare('SELECT summary_json, waves_survived FROM runs WHERE id = ?').get(uuid(153));
    assert.equal(JSON.parse(row.summary_json).draws.length,1);assert.equal(row.waves_survived,0);
    for(let x=9;x<13;x++)assert.equal(game.place(x,19),true);
    assert.equal(game.keep(),true);assert.equal(game.startCombat(),true);
    for(let i=0;i<10;i++){client.sample(.05);game.tick(.05);}
    client.checkpoint();assert.equal(await client.flush(),true);
    let wave=JSON.parse(store.sqlite.prepare('SELECT snapshot_json FROM run_waves WHERE run_id = ? AND wave = 1').get(uuid(153)).snapshot_json);
    assert.equal(wave.completed,false);assert.ok(wave.spawned>0);assert.equal(wave.towers.length,1);
    let steps=0;while(game.phase==='combat'&&steps++<10000){client.sample(.05);game.tick(.05);}
    assert.equal(game.phase,'build');assert.equal(game.round,2);assert.equal(await client.flush(),true);
    row=store.sqlite.prepare('SELECT summary_json, waves_survived, score, gold FROM runs WHERE id = ?').get(uuid(153));
    const summary=JSON.parse(row.summary_json);assert.equal(summary.draws.length,5);assert.equal(summary.decisions.length,1);
    assert.equal(summary.decisions[0].action,'keep');assert.equal(row.waves_survived,1);assert.equal(row.score,game.score);assert.equal(row.gold,140);
    wave=JSON.parse(store.sqlite.prepare('SELECT snapshot_json FROM run_waves WHERE run_id = ? AND wave = 1').get(uuid(153)).snapshot_json);
    assert.equal(wave.completed,true);assert.equal(wave.kills+wave.leaks,data.waves[0].groups.reduce((n,g)=>n+g.count,0));
    assert.ok(wave.towers[0].damage>0);assert.ok(wave.towers[0].shots>0);assert.ok(wave.towers[0].hits>0);
    assert.equal(wave.startHealth,30);assert.equal(wave.endHealth,game.lives);assert.deepEqual(client.readQueue(),[]);
  }finally{client.dispose();store.close();globalThis.window=previousWindow;globalThis.fetch=previousFetch;}
});

test('a persisted outbox drains once after storage writes fail and preserves newer checkpoints in memory', async()=>{
  const store=storage(),previousWindow=globalThis.window,old=run(10,uuid(150)),current=run(10,uuid(151));
  const oldSnapshot=old.assault(),endpoint='https://statistics.example';
  const persisted=JSON.stringify([{endpoint,writeToken:access,snapshot:oldSnapshot}]);
  const storageApi={getItem:()=>persisted,setItem:()=>{throw new Error('Quota exceeded');}};
  globalThis.window={addEventListener(){},removeEventListener(){}};
  let releaseFirst,observeFirst,first=true,requests=0;
  const gate=new Promise(resolve=>{releaseFirst=resolve;}),observed=new Promise(resolve=>{observeFirst=resolve;});
  const client=new StatisticsClient(current.game,{endpoint,storage:storageApi,fetcher:async(url,options)=>{
    if(++requests>8)throw new Error('Persisted row was uploaded repeatedly');
    if(first){first=false;observeFirst();await gate;}
    return worker.fetch(new Request(url,options),{DB:store.DB});
  }});
  client.tracker.id=uuid(151);client.tracker.version=version;
  try{
    await observed;
    current.game.draft.forced={family:'archer',tier:1};assert.equal(current.game.place(10,10),true);
    assert.equal(current.game.place(10,11),true);client.checkpoint();
    const latestSequence=client.pendingMemory.snapshot.sequence;
    releaseFirst();assert.equal(await client.flush(),true);
    assert.equal(requests,4,'Old run and latest new run need one registration and checkpoint each');
    assert.deepEqual(client.readQueue(),[]);assert.equal(client.pendingMemory,null);
    const row=store.sqlite.prepare('SELECT sequence, summary_json FROM runs WHERE id = ?').get(uuid(151));
    assert.equal(row.sequence,latestSequence);assert.equal(JSON.parse(row.summary_json).draws.length,2);
    assert.equal(await client.flush(),true);assert.equal(requests,4,'Acknowledged stale disk rows cannot be resent while storage remains full');
    assert.equal(storageApi.getItem(),persisted,'The test really leaves the older persisted row untouched');
  }finally{releaseFirst();client.dispose();old.statistics.dispose();current.statistics.dispose();store.close();globalThis.window=previousWindow;}
});

test('blocking localStorage access cannot prevent starting the game or uploading its in-memory checkpoint', async()=>{
  const store=storage(),played=run(10,uuid(152)),previousWindow=globalThis.window;
  const previousStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  globalThis.window={addEventListener(){},removeEventListener(){}};
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('Storage access denied');}});
  let client;
  try{
    assert.doesNotThrow(()=>{client=new StatisticsClient(played.game,{endpoint:'https://statistics.example',fetcher:(url,options)=>worker.fetch(new Request(url,options),{DB:store.DB})});});
    client.tracker.id=uuid(152);client.tracker.version=version;
    played.game.draft.forced={family:'archer',tier:1};assert.equal(played.game.place(10,10),true);
    assert.equal(await client.flush(),true);assert.deepEqual(client.readQueue(),[]);
    const row=store.sqlite.prepare('SELECT summary_json FROM runs WHERE id = ?').get(uuid(152));
    assert.equal(JSON.parse(row.summary_json).draws.length,1);
  }finally{
    client?.dispose();played.statistics.dispose();store.close();globalThis.window=previousWindow;
    if(previousStorage)Object.defineProperty(globalThis,'localStorage',previousStorage);else delete globalThis.localStorage;
  }
});

test('sampled status uptime separates damage-over-time from actual crowd control and records received support', () => {
  const played = run(10, uuid(80));
  try {
    played.game.phase = 'ready';
    const druid = {id: 1, family: 'druid', tier: 1, x: 10, z: 10, state: 'active', kills: 0};
    const frost = {id: 2, family: 'frostwarden', tier: 1, x: 11, z: 10, state: 'active', kills: 0};
    const cleric = {id: 3, family: 'cleric', tier: 1, x: 10, z: 11, state: 'active', kills: 0};
    played.game.towers = [druid, frost, cleric];played.game.startCombat();
    const enemy = played.game.combat.spawn('host_01');Object.assign(enemy, {x: 11, z: 10});
    played.game.combat.applyEffects(enemy, {poisonDps: 5, dotDuration: 5}, druid);
    played.game.combat.applyEffects(enemy, {slow: .2, slowDuration: 3}, frost);
    played.statistics.sample(.25);
    const snapshot = played.statistics.snapshot(), rows = snapshot.waves[0].towers;
    assert.equal(rows.find(row => row.id === druid.id).controlSeconds, 0);
    assert.equal(rows.find(row => row.id === frost.id).controlSeconds, .25);
    assert.equal(snapshot.waves[0].effects.poison, .25);assert.equal(snapshot.waves[0].effects.slow, .25);
    assert.ok(rows.find(row => row.id === druid.id).supportSeconds > 0);
    const state = JSON.stringify(snapshot.waves[0]);played.game.paused = true;played.statistics.sample(1);
    assert.equal(JSON.stringify(played.statistics.snapshot().waves[0]), state);
  } finally {played.statistics.dispose();}
});

test('effective control sampling credits only the strongest active source, including auras', () => {
  const played = run(10, uuid(90));
  try {
    played.game.phase = 'ready';
    const frost = {id: 1, family: 'frostwarden', tier: 1, x: 10, z: 10, state: 'active', kills: 0};
    const colossus = {id: 2, family: 'winterhold', tier: 1, x: 11, z: 10, state: 'active', kills: 0};
    played.game.towers = [frost, colossus];played.game.startCombat();
    const enemy = played.game.combat.spawn('host_01');Object.assign(enemy, {x: 10, z: 11});
    played.game.combat.applyEffects(enemy, {slow: .2, slowDuration: 3}, frost);
    played.statistics.sample(.25);
    let rows = played.statistics.snapshot().waves[0].towers;
    assert.equal(rows.find(row => row.id === frost.id).controlSeconds, 0);
    assert.equal(rows.find(row => row.id === colossus.id).controlSeconds, .25);
    // Immobilization overrides all movement slows, so one enemy-slice has one provider.
    enemy.statuses.freeze = {time: .5, source: frost};played.statistics.sample(.25);
    rows = played.statistics.snapshot().waves[0].towers;
    assert.equal(rows.find(row => row.id === frost.id).controlSeconds, .25);
    assert.equal(rows.find(row => row.id === colossus.id).controlSeconds, .25);
  } finally {played.statistics.dispose();}
});

test('new-run rate limiting allows existing-run registration retries throughout a full campaign', async () => {
  const store = storage(), headers = {'CF-Connecting-IP': '192.0.2.10'};
  const create = {id: uuid(100), writeToken: access, mode: 50, seed: 42, version};
  try {
    for (let index = 0; index < 55; index++) {
      assert.equal((await request(store, '/api/runs', create, {headers})).status, 201,
        'An idempotent registration retry must not consume the new-run allowance');
    }
    for (let index = 1; index < 30; index++) {
      assert.equal((await request(store, '/api/runs', {...create, id: uuid(100+index)}, {headers})).status, 201);
    }
    assert.equal((await request(store, '/api/runs', {...create, id: uuid(130)}, {headers})).status, 429);
    assert.equal(store.sqlite.prepare('SELECT COUNT(*) AS n FROM runs').get().n, 30);
  } finally {store.close();}
});

test('owner report exports a persisted SQLite run to JSON and five Excel-safe CSV files without tokens', async () => {
  const played = run(10, uuid(140)), store = storage();
  const directory = mkdtempSync(join(tmpdir(), 'bastions-statistics-report-'));
  try {
    await request(store, '/api/runs', {id: uuid(140), writeToken: access, mode: 10, seed: 42, version});
    const snapshot = played.assault();
    assert.equal((await request(store, `/api/runs/${uuid(140)}/checkpoint`, {writeToken: access, snapshot})).status, 200);
    store.sqlite.prepare('VACUUM INTO ?').run(join(directory, 'bastions.sqlite'));
    writeFileSync(join(directory, 'owner-token.txt'), 'private-report-token');
    const result = await report({apiUrl: '', dataDirectory: directory, outputDirectory: join(directory, 'reports')});
    assert.equal(result.counts.runs, 1);assert.equal(result.counts.waves, 1);
    const files = readdirSync(result.destination).sort();
    assert.deepEqual(files, ['decisions.csv', 'defenders.csv', 'draws.csv', 'runs.csv', 'statistics.json', 'waves.csv']);
    for (const filename of files) {
      const contents = readFileSync(join(result.destination, filename), 'utf8');
      assert.ok(!contents.includes('private-report-token') && !contents.includes(access));
      if (filename.endsWith('.csv')) assert.equal(contents[0], '\uFEFF');
    }
    const exported = JSON.parse(readFileSync(join(result.destination, 'statistics.json'), 'utf8'));
    assert.equal(exported.runs[0].runs, 1);assert.equal(exported.waves[0].completed, 1);
    const safe = csvRows([{label: '=2+2', note: 'line\n"quote"', score: -2}]);
    assert.ok(safe.includes("'=2+2"));assert.ok(safe.includes('"line\n""quote"""'));assert.ok(safe.includes(',-2'));
  } finally {
    played.statistics.dispose();store.close();
    // Delete only the fresh temporary directory verified directly under the OS temp root.
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));rmSync(directory, {recursive: true});
  }
});
