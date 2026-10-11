import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {Game} from '../game/core/game.js';
import {RunStatistics} from '../game/core/run-statistics.js';
import {StatisticsClient} from '../game/core/statistics-client.js';
import {loadProfile,saveProfile,recordRunResult,excludeRunResult} from '../game/core/save.js';
import worker from '../backend/worker.js';
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),values};};
const id=n=>`848a3230-f991-4195-99bf-${String(n).padStart(12,'0')}`,writeToken='a'.repeat(64);
function database(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../backend/migrations/0000_statistics.sql',import.meta.url),'utf8'));
 const prepare=(sql,values=[])=>({bind(...next){return prepare(sql,next);},async first(){return sqlite.prepare(sql).get(...values)||null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){return sqlite.prepare(sql).run(...values);},execute(){return sqlite.prepare(sql).run(...values);}});
 return {sqlite,DB:{prepare,async batch(rows){sqlite.exec('BEGIN');try{const result=rows.map(row=>row.execute());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}}};
}
const env=store=>({DB:store.DB,ADMIN_TOKEN:'owner'});
const request=(store,path,body,headers={})=>worker.fetch(new Request('https://statistics.example'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})}),env(store));
function played(runId,version='0.3.26'){
 const game=new Game(data,{seed:42,waveLimit:10}),tracker=new RunStatistics(game,{id:runId,version});game.place(12,18);
 return {game,tracker,identity:{id:runId,version,mode:10,seed:42,writeToken},snapshot:()=>tracker.snapshot()};
}
test('activating console withdraws an already uploaded run from every statistics query without touching historical runs',async()=>{
 const store=database(),older=played(id(1),'0.3.25'),current=played(id(2));
 try{
  for(const run of [older,current]){assert.equal((await request(store,'/api/runs',run.identity)).status,201);assert.equal((await request(store,`/api/runs/${run.identity.id}/checkpoint`,{writeToken,snapshot:run.snapshot()})).status,200);}
  const before=store.sqlite.prepare('SELECT * FROM runs WHERE id=?').get(id(1));
  assert.equal((await request(store,`/api/runs/${id(2)}/developer-mode`,{...current.identity,writeToken:'b'.repeat(64)})).status,403);
  assert.equal((await request(store,`/api/runs/${id(2)}/developer-mode`,current.identity)).status,200);
  assert.equal((await request(store,`/api/runs/${id(2)}/checkpoint`,{writeToken,snapshot:current.snapshot()})).status,409);
  assert.equal((await request(store,`/api/runs/${id(2)}/score`,{writeToken,name:'Sandbox'})).status,409);
  const report=await (await request(store,'/api/admin/statistics',null,{Authorization:'Bearer owner'})).json();
  assert.equal(report.runDurations.length,1);assert.equal(report.runDurations[0].runId,id(1));assert.equal(report.runs.reduce((n,row)=>n+row.runs,0),1);
  assert.ok(report.draws.every(row=>row.version==='0.3.25'));assert.deepEqual(store.sqlite.prepare('SELECT * FROM runs WHERE id=?').get(id(1)),before);
  const tombstone=store.sqlite.prepare('SELECT * FROM runs WHERE id=?').get(id(2));assert.equal(tombstone.outcome,'developer');assert.equal(tombstone.summary_json,'{}');assert.equal(tombstone.score,0);assert.equal(tombstone.name,null);
 }finally{older.tracker.dispose();current.tracker.dispose();store.sqlite.close();}
});
test('a run excluded before registration cannot be resurrected by a delayed registration/checkpoint',async()=>{
 const store=database(),run=played(id(3));try{
  assert.equal((await request(store,`/api/runs/${id(3)}/developer-mode`,run.identity)).status,200);
  assert.equal((await request(store,'/api/runs',run.identity)).status,201);
  assert.equal((await request(store,`/api/runs/${id(3)}/checkpoint`,{writeToken,snapshot:run.snapshot()})).status,409);
  const report=await (await request(store,'/api/admin/statistics',null,{Authorization:'Bearer owner'})).json();assert.deepEqual(report.runs,[]);assert.deepEqual(report.runDurations,[]);
 }finally{run.tracker.dispose();store.sqlite.close();}
});
test('an exclusion arriving after a checkpoint owner read wins over its delayed SQL batch',async()=>{
 const store=database(),run=played(id(6));try{
  await request(store,'/api/runs',run.identity);const execute=store.DB.batch;let armed=true;
  store.DB.batch=async rows=>{if(armed){armed=false;assert.equal((await request(store,`/api/runs/${id(6)}/developer-mode`,run.identity)).status,200);}return execute(rows);};
  await request(store,`/api/runs/${id(6)}/checkpoint`,{writeToken,snapshot:run.snapshot()});
  const persisted=store.sqlite.prepare('SELECT * FROM runs WHERE id=?').get(id(6));assert.equal(persisted.outcome,'developer');assert.equal(persisted.summary_json,'{}');assert.equal(persisted.score,0);
  assert.equal(store.sqlite.prepare('SELECT COUNT(*) AS n FROM run_waves WHERE run_id=?').get(id(6)).n,0);
 }finally{run.tracker.dispose();store.sqlite.close();}
});
test('offline client permanently purges only its console run and retries withdrawal after reload',async()=>{
 const store=database(),storage=memory(),previous=globalThis.window;globalThis.window={addEventListener(){},removeEventListener(){}};let client,next;let online=false;
 const fetcher=(url,options)=>{if(!online)return Promise.reject(new Error('offline'));return worker.fetch(new Request(url,options),env(store));};
 try{
  const game=new Game(data,{seed:42,waveLimit:10});client=new StatisticsClient(game,{endpoint:'https://statistics.example',storage,fetcher});game.place(12,18);await client.flush();
  const own=client.tracker.id;assert.ok(JSON.parse(storage.getItem('bastions.statistics.outbox.v1')).some(row=>row.snapshot.id===own));
  client.disableForDeveloper();await client.flushExclusions();assert.equal(client.enabled,false);assert.equal(game.developerMode,true);assert.deepEqual(JSON.parse(storage.getItem('bastions.statistics.outbox.v1')),[]);
  assert.ok(JSON.parse(storage.getItem('bastions.statistics.exclusions.v1')).some(row=>row.id===own));game.place(13,18);assert.equal(client.tracker.draws.length,1);await assert.rejects(client.saveScore('Test'),/statistics disabled/);
  client.dispose();online=true;next=new StatisticsClient(new Game(data,{seed:43,waveLimit:10}),{endpoint:'https://statistics.example',storage,fetcher});await next.flush();
  assert.equal(store.sqlite.prepare('SELECT outcome FROM runs WHERE id=?').get(own).outcome,'developer');assert.deepEqual(JSON.parse(storage.getItem('bastions.statistics.exclusions.v1')),[]);assert.equal(next.enabled,true);
 }finally{client?.dispose();next?.dispose();store.sqlite.close();globalThis.window=previous;}
});
test('run-scoped local withdrawal preserves old best/history/preferences and prevents a stale tab restoring the excluded score',()=>{
 const prior=globalThis.localStorage;globalThis.localStorage=memory();try{
  const profile=loadProfile(),game=new Game(data,{seed:42,waveLimit:10});game.score=88;game.round=2;recordRunResult(profile,game,{id:id(4),version:'0.3.25'});saveProfile(profile);const baseline=structuredClone(profile);
  game.score=999;game.round=5;recordRunResult(profile,game,{id:id(5),version:'0.3.26'});profile.bestWave=5;profile.discoveries=['test'];saveProfile(profile);const stale=structuredClone(profile);
  game.developerMode=true;excludeRunResult(profile,id(5),{baseline});assert.equal(recordRunResult(profile,game,{id:id(5)}),null);
  assert.equal(loadProfile().bestScore,88);assert.deepEqual(loadProfile().runHistory.map(row=>row.id),[id(4)]);assert.deepEqual(profile.discoveries,baseline.discoveries);
  saveProfile(stale);assert.equal(loadProfile().bestScore,88);assert.deepEqual(loadProfile().runHistory.map(row=>row.id),[id(4)]);
 }finally{globalThis.localStorage=prior;}
});
test('a stale client with excluded pending memory finishes flushing without re-uploading or spinning',async()=>{
 const previous=globalThis.window;globalThis.window={addEventListener(){},removeEventListener(){}};const storage=memory();let client;const calls=[];
 try{
  const game=new Game(data,{seed:42,waveLimit:10});client=new StatisticsClient(game,{endpoint:'https://statistics.example',storage,fetcher:async url=>{calls.push(url);return Response.json({});}});await client.flush();
  game.place(12,18);await client.flush();calls.length=0;
  client.pendingMemory={endpoint:client.endpoint,writeToken:client.writeToken,snapshot:client.tracker.snapshot()};storage.setItem('bastions.statistics.excluded-ids.v1',JSON.stringify([client.tracker.id]));
  assert.equal(await client.flush(),true);assert.equal(client.pendingMemory,null);assert.deepEqual(calls,[]);
 }finally{client?.dispose();globalThis.window=previous;}
});
test('two tabs retain legitimate wins, independently earned discoveries and latest preferences when one run is excluded',()=>{
 const prior=globalThis.localStorage;globalThis.localStorage=memory();try{
  localStorage.setItem('bastions.profile.v1',JSON.stringify({wins:2,bestWave:3,discoveries:['historical'],muted:false,tutorialDecision:'skipped'}));
  const first=loadProfile(),baseline=structuredClone(first),a=new Game(data,{seed:42,waveLimit:10});a.phase='won';a.round=10;a.score=120;first.wins++;
  first.discoveries=['historical','only-excluded','shared'];recordRunResult(first,a,{id:id(7),discoveryAwards:['only-excluded','shared']});saveProfile(first);const stale=structuredClone(first);
  const second=loadProfile(),b=new Game(data,{seed:43,waveLimit:10});b.phase='won';b.round=10;b.score=220;second.wins++;
  second.discoveries.push('other-legitimate');second.muted=true;second.tutorialDecision='complete';recordRunResult(second,b,{id:id(8),discoveryAwards:['shared','other-legitimate']});saveProfile(second);
  a.developerMode=true;excludeRunResult(first,id(7),{baseline});
  for(const action of [()=>{},()=>saveProfile(stale)]){
   action();const saved=loadProfile();assert.equal(saved.wins,3);assert.equal(saved.bestScore,220);assert.equal(saved.bestWave,10);assert.deepEqual(saved.runHistory.map(row=>row.id),[id(8)]);
   assert.deepEqual(new Set(saved.discoveries),new Set(['historical','shared','other-legitimate']));assert.equal(saved.muted,true);assert.equal(saved.tutorialDecision,'complete');
  }
 }finally{globalThis.localStorage=prior;}
});
