import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {Game} from '../game/core/game.js';
import {RunStatistics} from '../game/core/run-statistics.js';
import {StatisticsClient} from '../game/core/statistics-client.js';
import {loadProfile,saveProfile,recordRunResult} from '../game/core/save.js';
import {GAME_VERSION} from '../game/release.js';
import worker from '../backend/worker.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const uuid=n=>`9c231b20-9024-4240-8240-${String(n).padStart(12,'0')}`,token='d'.repeat(64);
const memoryStorage=()=>{const values=new Map();return {values,getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};};
function complete(game){
  let cell=0;
  while(game.phase!=='won'){
    game.draft.forced={family:'archer',tier:1};
    while(game.phase==='build'){assert.ok(cell<37*37);game.place(cell%37,Math.floor(cell++/37));}
    assert.equal(game.keep(),true);assert.equal(game.startCombat(),true);
    for(const queued of game.combat.spawnQueue.splice(0))game.combat.spawn(queued.type,queued.modifiers);
    for(const enemy of game.combat.enemies)game.combat.damage(enemy,1e9,'pure',{},game.towers.find(t=>t.state==='active'));
    game.tick(.01);
  }
}
function database(){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../backend/migrations/0000_statistics.sql',import.meta.url),'utf8'));
  const prepare=(sql,parameters=[])=>({bind(...values){return prepare(sql,values);},async first(){return sqlite.prepare(sql).get(...parameters)||null;},async all(){return {results:sqlite.prepare(sql).all(...parameters)};},async run(){return {success:true,meta:{changes:Number(sqlite.prepare(sql).run(...parameters).changes)}};},execute(){return sqlite.prepare(sql).run(...parameters);}});
  return {sqlite,DB:{prepare,async batch(statements){sqlite.exec('BEGIN');try{const rows=statements.map(statement=>statement.execute());sqlite.exec('COMMIT');return rows;}catch(error){sqlite.exec('ROLLBACK');throw error;}}}};
}
const request=(store,path,body)=>worker.fetch(new Request('https://scores.example'+path,{method:body?'POST':'GET',...(body?{body:JSON.stringify(body),headers:{'Content-Type':'application/json'}}:{})}),{DB:store.DB});
async function saveOnline(store,id,version,mode=10){
  const game=new Game(data,{seed:41,waveLimit:mode}),tracker=new RunStatistics(game,{id,version});complete(game);
  try{assert.equal((await request(store,'/api/runs',{id,version,mode,seed:41,writeToken:token})).status,201);assert.equal((await request(store,`/api/runs/${id}/checkpoint`,{writeToken:token,snapshot:tracker.snapshot()})).status,200);const response=await request(store,`/api/runs/${id}/score`,{writeToken:token,name:'Commander '+id.slice(-2)});assert.equal(response.status,200);return response.json();}finally{tracker.dispose();}
}

test('a pre-version local best survives actual newer completed runs, stale saves and an older tab rewriting the profile',()=>{
  const previous=globalThis.localStorage,storage=memoryStorage();globalThis.localStorage=storage;
  storage.setItem('bastions.profile.v1',JSON.stringify({bestScore:900000,discoveries:['ladyclaire'],muted:true,futurePreference:{keep:true}}));
  try{
    const profile=loadProfile();assert.equal(profile.bestScore,900000);assert.deepEqual(profile.bestScores,[{version:null,mode:null,score:900000}]);assert.deepEqual(profile.futurePreference,{keep:true});
    for(const [id,version,mode] of [[uuid(1),'0.2.7',10],[uuid(2),GAME_VERSION,50]]){
      const game=new Game(data,{seed:45,waveLimit:mode});complete(game);const recorded=recordRunResult(profile,game,{id,version});assert.equal(recorded.version,version);assert.equal(recorded.score,game.score);assert.equal(recorded.wavesSurvived,mode);assert.equal(recorded.outcome,'won');assert.equal(saveProfile(profile),true);
    }
    const history=structuredClone(loadProfile().runHistory);assert.equal(history.length,2);assert.ok(loadProfile().bestScores.some(row=>row.version==='0.2.7'&&row.mode===10));
    storage.setItem('bastions.profile.v1',JSON.stringify({bestScore:2,discoveries:[],muted:false}));const afterOldTab=loadProfile();assert.deepEqual(afterOldTab.runHistory,history);assert.equal(afterOldTab.bestScore,900000);
    assert.equal(saveProfile({bestScore:0,discoveries:[]}),true);assert.deepEqual(loadProfile().runHistory,history);assert.equal(loadProfile().bestScore,900000);assert.ok(loadProfile().bestScores.some(row=>row.version===null&&row.score===900000));
  }finally{globalThis.localStorage=previous;}
});

test('a run ID retains its played version and one immutable completed result across repeated end-screen or unload saves',()=>{
  const profile={bestScore:0,bestScores:[],runHistory:[]},game=new Game(data,{seed:44,waveLimit:10});game.place(12,18);game.score=12;
  recordRunResult(profile,game,{id:uuid(3),version:'0.3.22'});game.score=20;recordRunResult(profile,game,{id:uuid(3),version:'0.3.22'});assert.equal(profile.runHistory.length,1);assert.equal(profile.runHistory[0].score,20);
  assert.equal(recordRunResult(profile,game,{id:uuid(3),version:GAME_VERSION}),null);assert.equal(profile.runHistory[0].version,'0.3.22');
  game.phase='lost';game.score=30;const final=structuredClone(recordRunResult(profile,game,{id:uuid(3),version:'0.3.22'}));game.score=999;game.elapsedSeconds+=100;
  recordRunResult(profile,game,{id:uuid(3),version:'0.3.22'});assert.deepEqual(profile.runHistory[0],final);assert.equal(profile.bestScore,30);assert.equal(profile.bestScores[0].score,30);
});

test('the actual main reward and result hooks attribute every saved score before profile persistence',()=>{
  const source=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
  const block=source.match(/if\(\['reward','won','lost'\]\.includes\(type\)\)\{([\s\S]*?)\}if\(type==='combine'\)/)?.[1];
  assert.ok(block,'The production result persistence block must be inspected.');
  const previous=globalThis.localStorage,storage=memoryStorage();globalThis.localStorage=storage;
  const game=new Game(data,{seed:46,waveLimit:10}),profile=loadProfile(),statistics={tracker:{id:uuid(4),version:'0.3.23'}};let saves=0;
  const persist=current=>{saves++;assert.ok(current.bestScores.some(row=>row.version==='0.3.23'&&row.score===current.bestScore));assert.ok(current.runHistory.some(row=>row.id===uuid(4)&&row.version==='0.3.23'));assert.equal(saveProfile(current),true);};
  const handler=new Function('profile','game','statistics','recordRunResult','saveProfile',`return (type,payload)=>{${block}}`)(profile,game,statistics,recordRunResult,persist);
  const stop=game.on((type,payload)=>{if(['reward','won','lost'].includes(type))handler(type,payload);});
  try{complete(game);assert.equal(saves,10);assert.equal(profile.runHistory.length,1);assert.equal(profile.runHistory[0].outcome,'won');assert.equal(profile.runHistory[0].wavesSurvived,10);assert.equal(profile.wins,1);assert.equal(loadProfile().runHistory[0].version,'0.3.23');}
  finally{stop();globalThis.localStorage=previous;}
});

test('all-version standings retain original SQLite rows and schema, exact-version ranks and separate campaign lengths',async()=>{
  const store=database();
  try{
    for(let i=1;i<=11;i++)await saveOnline(store,uuid(100+i),'0.2.7');
    const oldRows=store.sqlite.prepare('SELECT * FROM runs ORDER BY id').all(),schema=store.sqlite.prepare("SELECT name,sql FROM sqlite_schema WHERE type IN ('table','index') ORDER BY name").all();
    await saveOnline(store,uuid(112),GAME_VERSION);await saveOnline(store,uuid(113),GAME_VERSION,50);
    const result=await (await request(store,`/api/leaderboard?mode=10&version=all&id=${uuid(112)}`)).json();assert.equal(result.version,'all');assert.equal(result.top.length,10);assert.equal(result.current.rank,12);assert.equal(result.current.version,GAME_VERSION);assert.ok(result.top.every(row=>row.version==='0.2.7'));assert.deepEqual(new Set(result.versions),new Set(['0.2.7',GAME_VERSION]));
    const exact=await (await request(store,`/api/leaderboard?mode=10&version=${GAME_VERSION}&id=${uuid(112)}`)).json();assert.equal(exact.current.rank,1);assert.equal(exact.top.length,1);assert.equal(exact.top[0].version,GAME_VERSION);
    const long=await (await request(store,'/api/leaderboard?mode=50&version=all')).json();assert.equal(long.top.length,1);assert.equal(long.top[0].id,uuid(113));
    assert.equal((await request(store,'/api/leaderboard?mode=10&version=all%20OR%201%3D1')).status,400);assert.equal(store.sqlite.prepare('SELECT COUNT(*) AS n FROM runs').get().n,13);
    assert.deepEqual(store.sqlite.prepare("SELECT name,sql FROM sqlite_schema WHERE type IN ('table','index') ORDER BY name").all(),schema);
    assert.deepEqual(store.sqlite.prepare('SELECT * FROM runs WHERE version = ? ORDER BY id').all('0.2.7'),oldRows);
  }finally{store.sqlite.close();}
});

test('the real client saves and loads mixed historical versions without changing the current immutable run version',async()=>{
  const store=database(),previousWindow=globalThis.window;globalThis.window={addEventListener(){},removeEventListener(){}};
  let client;
  try{
    await saveOnline(store,uuid(201),'0.2.7');const game=new Game(data,{seed:41,waveLimit:10});client=new StatisticsClient(game,{endpoint:'https://scores.example',storage:memoryStorage(),fetcher:(url,options)=>worker.fetch(new Request(url,options),{DB:store.DB})});client.tracker.id=uuid(202);complete(game);
    assert.equal(await client.flush(),true);const result=await client.saveScore('New commander');assert.equal(result.version,'all');assert.equal(result.current.version,GAME_VERSION);assert.deepEqual(new Set(result.top.map(row=>row.version)),new Set(['0.2.7',GAME_VERSION]));
    const listed=await client.leaderboard();assert.equal(listed.current.id,uuid(202));assert.equal(client.tracker.version,GAME_VERSION);assert.equal(store.sqlite.prepare('SELECT version FROM runs WHERE id = ?').get(uuid(202)).version,GAME_VERSION);
  }finally{client?.dispose();store.sqlite.close();globalThis.window=previousWindow;}
});

test('an older deployed service gets a bounded explicit single-version fallback, while real network failures do not hide behind fallback',async()=>{
  const previousWindow=globalThis.window;globalThis.window={addEventListener(){},removeEventListener(){}};let client,allRequests=0,currentRequests=0;
  try{
    const game=new Game(data,{seed:42,waveLimit:10});client=new StatisticsClient(game,{endpoint:'https://legacy.example',storage:memoryStorage(),fetcher:async url=>{const version=new URL(url).searchParams.get('version');if(version==='all'){allRequests++;return Response.json({error:'Choose a valid campaign and edition.'},{status:400});}currentRequests++;return Response.json({version,mode:10,top:[],current:null});}});
    for(let i=0;i<3;i++){const result=await client.leaderboard();assert.equal(result.olderService,true);assert.equal(result.version,GAME_VERSION);}assert.equal(allRequests,1);assert.equal(currentRequests,3);
    client.dispose();client=new StatisticsClient(game,{endpoint:'https://offline.example',storage:memoryStorage(),fetcher:async()=>Response.json({error:'Server unavailable'},{status:503})});await assert.rejects(client.leaderboard(),/Server unavailable/);assert.notEqual(client.supportsAllVersions,false);
  }finally{client?.dispose();globalThis.window=previousWindow;}
});
