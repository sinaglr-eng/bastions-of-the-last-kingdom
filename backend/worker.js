import {playerName,validId,validateSnapshot} from './validation.js';
import families from '../data/towers.json' with {type:'json'};
import waveDefinitions from '../data/waves.json' with {type:'json'};
import enemyDefinitions from '../data/enemies.json' with {type:'json'};
import {servicePage,STATISTICS_EDITION,STATISTICS_RELEASE_NAME} from './service-page.js';

const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const response=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const validToken=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
async function body(request){
  const limit=500000;if(Number(request.headers.get('Content-Length'))>limit)throw new Error('Request too large.');
  const reader=request.body?.getReader();if(!reader)throw new Error('Invalid request body.');let size=0,text='';const decoder=new TextDecoder('utf-8',{fatal:true});
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new Error('Request too large.');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();return JSON.parse(text);
}
async function owner(db,id,token){if(!validId(id)||!validToken(token))return null;return db.prepare('SELECT * FROM runs WHERE id = ? AND token_hash = ?').bind(id,await hash(token)).first();}
async function rateLimit(request,env,kind,max,windowMs){
  const ip=request.headers.get('CF-Connecting-IP');if(!ip)return true;
  const key=await hash(`${env.ADMIN_TOKEN||'bastions'}:${kind}:${ip}`),period=Math.floor(Date.now()/windowMs)*windowMs;
  await env.DB.prepare('INSERT INTO request_limits (key, period, hits) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET hits = CASE WHEN request_limits.period = excluded.period THEN request_limits.hits + 1 ELSE 1 END, period = excluded.period').bind(key,period).run();
  return (await env.DB.prepare('SELECT hits FROM request_limits WHERE key = ?').bind(key).first()).hits<=max;
}
async function standings(db,mode,version,id=null){
  const scope=version==='all'?'mode = ?':'mode = ? AND version = ?',parameters=version==='all'?[mode]:[mode,version];
  const top=await db.prepare(`SELECT id, name, version, score, waves_survived AS wavesSurvived, outcome FROM runs WHERE ${scope} AND name IS NOT NULL ORDER BY score DESC, finished_at ASC, id ASC LIMIT 10`).bind(...parameters).all();
  let current=null;if(id){const own=await db.prepare(`SELECT id, name, version, score, waves_survived AS wavesSurvived, outcome, finished_at FROM runs WHERE id = ? AND ${scope} AND name IS NOT NULL`).bind(id,...parameters).first();if(own){const row=await db.prepare(`SELECT COUNT(*) + 1 AS rank FROM runs WHERE ${scope} AND name IS NOT NULL AND (score > ? OR (score = ? AND (finished_at < ? OR (finished_at = ? AND id < ?))))`).bind(...parameters,own.score,own.score,own.finished_at,own.finished_at,own.id).first();current={...own,rank:row.rank};delete current.finished_at;}}
  const versions=await db.prepare('SELECT DISTINCT version FROM runs WHERE mode = ? AND name IS NOT NULL ORDER BY version').bind(mode).all();
  return {top:top.results.map((x,i)=>({...x,rank:i+1})),current,mode,version,versions:versions.results.map(row=>row.version)};
}
export async function handle(request,env){
  const url=new URL(request.url),db=env.DB,path=url.pathname;
  if(request.method==='GET'&&(path==='/'||path==='/owner'))return new Response(servicePage(path==='/owner'),{headers:{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
  if(!db)return response({error:'Statistics storage is unavailable.'},503);
  if(path==='/api/health'){await db.prepare('SELECT COUNT(*) AS tables FROM sqlite_schema WHERE name = ?').bind('runs').first();return response({ok:true,storage:'SQLite',edition:STATISTICS_EDITION,releaseName:STATISTICS_RELEASE_NAME});}
  if(request.method==='POST'&&path==='/api/runs'){
    const b=await body(request);if(!validId(b.id)||!validToken(b.writeToken)||!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(b.version)||![10,50].includes(b.mode)||!Number.isFinite(b.seed))return response({error:'Invalid new run.'},400);
    if(await owner(db,b.id,b.writeToken))return response({id:b.id},201);
    if(!await rateLimit(request,env,'start',30,3600000))return response({error:'Too many new runs. Please try again later.'},429);
    await db.prepare('DELETE FROM request_limits WHERE period < ?').bind(Date.now()-86400000).run();
    await db.prepare("INSERT OR IGNORE INTO runs (id, token_hash, version, mode, seed, started_at, updated_at, outcome) VALUES (?, ?, ?, ?, ?, ?, ?, 'playing')").bind(b.id,await hash(b.writeToken),b.version,b.mode,String(b.seed),Date.now(),Date.now()).run();
    if(!await owner(db,b.id,b.writeToken))return response({error:'This run belongs to a different session.'},403);
    return response({id:b.id},201);
  }
  const runPath=path.match(/^\/api\/runs\/([a-f0-9-]{36})\/(checkpoint|score)$/i);
  if(request.method==='POST'&&runPath){
    if(!await rateLimit(request,env,runPath[2],runPath[2]==='score'?15:240,60000))return response({error:'Too many requests. Please try again shortly.'},429);
    const b=await body(request),id=runPath[1],run=await owner(db,id,b.writeToken);if(!run)return response({error:'Invalid run access.'},403);
    if(runPath[2]==='checkpoint'){
      const s=validateSnapshot(b.snapshot,{families,waveDefinitions,enemyDefinitions});if(s.id!==id||s.mode!==run.mode||s.version!==run.version||String(s.seed)!==run.seed)return response({error:'Run identity cannot change.'},400);
      if(s.sequence<=run.sequence)return response({saved:true,sequence:run.sequence});
      if(s.score<run.score||s.wavesSurvived<run.waves_survived)return response({error:'Invalid progress regression.'},409);
      const priorDuration=JSON.parse(run.summary_json).durationSeconds;
      if(Number.isFinite(priorDuration)&&(!Object.hasOwn(s,'durationSeconds')||s.durationSeconds<priorDuration))return response({error:'Invalid playing duration regression.'},409);
      const prior=await db.prepare("SELECT wave, snapshot_json FROM run_waves WHERE run_id = ? AND json_extract(snapshot_json, '$.completed') = 1").bind(id).all();
      if(prior.results.some(w=>JSON.stringify(s.waves[w.wave-1])!==w.snapshot_json))return response({error:'Invalid change to a completed wave.'},409);
      if(['won','lost'].includes(run.outcome)){
        if(s.outcome!==run.outcome||s.score!==run.score||s.wavesSurvived!==run.waves_survived)return response({error:'The result is already final.'},409);
        if(Number.isFinite(priorDuration)&&s.durationSeconds!==priorDuration)return response({error:'The result duration is already final.'},409);
        return response({saved:true,sequence:run.sequence});
      }
      const finished=['won','lost'].includes(s.outcome);
      const summary={draws:s.draws,decisions:s.decisions,...(Object.hasOwn(s,'durationSeconds')?{durationSeconds:s.durationSeconds}:{})};
      const statements=[db.prepare('UPDATE runs SET sequence = ?, updated_at = ?, outcome = ?, score = ?, waves_survived = ?, duration_ms = ?, health = ?, kingdom_level = ?, gold = ?, summary_json = ?, finished_at = ? WHERE id = ? AND sequence < ? AND outcome NOT IN (?, ?)').bind(s.sequence,Date.now(),s.outcome,s.score,s.wavesSurvived,s.durationMs,s.health,s.kingdomLevel,s.gold,JSON.stringify(summary),finished?Date.now():null,id,s.sequence,'won','lost')];
      // One guarded statement per checkpoint: older retries cannot overwrite newer waves.
      for(const w of s.waves)statements.push(db.prepare('INSERT INTO run_waves (run_id, wave, snapshot_json, sequence) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM runs WHERE id = ? AND sequence = ?) ON CONFLICT(run_id, wave) DO UPDATE SET snapshot_json = excluded.snapshot_json, sequence = excluded.sequence WHERE run_waves.sequence < excluded.sequence').bind(id,w.index,JSON.stringify(w),s.sequence,id,s.sequence));
      await db.batch(statements);return response({saved:true,sequence:s.sequence});
    }
    if(!['won','lost'].includes(run.outcome))return response({error:'Finish the run before saving a score.'},409);
    const name=playerName(b.name);if(run.name&&run.name!==name)return response({error:'This score has already been saved.'},409);
    await db.prepare('UPDATE runs SET name = ? WHERE id = ? AND name IS NULL').bind(name,id).run();return response(await standings(db,run.mode,b.leaderboardVersion==='all'?'all':run.version,id));
  }
  if(request.method==='GET'&&path==='/api/leaderboard'){
    const mode=Number(url.searchParams.get('mode')),version=url.searchParams.get('version');if(![10,50].includes(mode)||!(version==='all'||/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(version||'')))return response({error:'Choose a valid campaign and edition.'},400);
    return response(await standings(db,mode,version,url.searchParams.get('id')));
  }
  if(request.method==='GET'&&path==='/api/admin/statistics'){
    if(!env.ADMIN_TOKEN||request.headers.get('Authorization')!==`Bearer ${env.ADMIN_TOKEN}`)return response({error:'Owner access required.'},401);
    const runs=await db.prepare("SELECT version, mode, outcome, COUNT(*) AS runs, AVG(waves_survived) AS averageWaves, AVG(score) AS averageScore, COUNT(json_extract(summary_json, '$.durationSeconds')) AS timedRuns, SUM(json_extract(summary_json, '$.durationSeconds')) AS totalDurationSeconds, AVG(json_extract(summary_json, '$.durationSeconds')) AS averageDurationSeconds FROM runs GROUP BY version, mode, outcome").all();
    const runDurations=await db.prepare("SELECT id AS runId, version, mode, outcome, json_extract(summary_json, '$.durationSeconds') AS durationSeconds, duration_ms AS durationMs FROM runs ORDER BY started_at DESC, id ASC").all();
    const waves=await db.prepare("SELECT r.version, r.mode, w.wave, COUNT(*) AS attempts, SUM(json_extract(snapshot_json, '$.completed')) AS completed, AVG(json_extract(snapshot_json, '$.leaks')) AS averageLeaks, AVG(json_extract(snapshot_json, '$.healthLost')) AS averageHealthLost, AVG(json_extract(snapshot_json, '$.durationMs')) AS averageDurationMs, AVG(json_extract(snapshot_json, '$.routeLength')) AS averageRoute FROM run_waves w JOIN runs r ON r.id=w.run_id GROUP BY r.version, r.mode, w.wave").all();
    const defenders=await db.prepare("SELECT r.version, r.mode, json_extract(t.value, '$.family') AS family, json_extract(t.value, '$.tier') AS tier, COUNT(*) AS waveDeployments, COUNT(DISTINCT w.run_id) AS runsUsing, SUM(json_extract(t.value, '$.damage')) AS damage, SUM(json_extract(t.value, '$.kills')) AS kills, SUM(json_extract(t.value, '$.shots')) AS shots, SUM(json_extract(t.value, '$.hits')) AS hits, SUM(json_extract(t.value, '$.controlSeconds')) AS controlSeconds, SUM(json_extract(t.value, '$.supportSeconds')) AS receivedSupportSeconds FROM run_waves w JOIN runs r ON r.id=w.run_id, json_each(w.snapshot_json, '$.towers') t GROUP BY r.version, r.mode, family, tier").all();
    const draws=await db.prepare("SELECT r.version, r.mode, json_extract(t.value, '$.family') AS family, json_extract(t.value, '$.tier') AS tier, COUNT(*) AS drawn FROM runs r, json_each(r.summary_json, '$.draws') t GROUP BY r.version, r.mode, family, tier").all();
    const decisions=await db.prepare("SELECT r.version, r.mode, json_extract(t.value, '$.family') AS family, json_extract(t.value, '$.tier') AS tier, json_extract(t.value, '$.action') AS action, COUNT(*) AS chosen FROM runs r, json_each(r.summary_json, '$.decisions') t GROUP BY r.version, r.mode, family, tier, action").all();
    return response({generatedAt:new Date().toISOString(),runs:runs.results,runDurations:runDurations.results,waves:waves.results,defenders:defenders.results,draws:draws.results,decisions:decisions.results});
  }
  return response({error:'Not found.'},404);
}
export default {async fetch(request,env){
  const origin=request.headers.get('Origin'),allowed=(env.GAME_ORIGINS||'https://sinaglr-eng.github.io').split(',').map(s=>s.trim());
  if(origin&&!allowed.includes(origin)&&origin!==new URL(request.url).origin)return response({error:'Origin not allowed.'},403);
  let result;
  if(request.method==='OPTIONS')result=new Response(null,{status:204});
  else try{result=await handle(request,env);}catch(error){const invalid=error instanceof SyntaxError||/^(Invalid|Result|Incomplete|Use |Enter |Request too large)/.test(error.message);console.error('Statistics request failed:',error.message);result=response({error:invalid?error.message:'Unable to save statistics. Please try again.'},invalid?400:503);}
  const headers=new Headers(result.headers);if(origin&&allowed.includes(origin)){headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');}headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');headers.set('Access-Control-Allow-Headers','Content-Type, Authorization');headers.set('Access-Control-Max-Age','86400');return new Response(result.body,{status:result.status,headers});
}};
