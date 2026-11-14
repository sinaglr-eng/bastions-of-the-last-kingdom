import {hallRecords} from './hall.js';
import {authenticatedPlayer,playerAuth} from './auth.js';
import {currentFactionData,FR010_RULESET} from '../game/core/current-data.js';
import {Game} from '../game/core/game.js';
import {serializeRun,restoreRun} from '../game/core/run-state.js';
import {replayCommands} from '../game/core/run-journal.js';
import {GENERAL_SKILLS,SKILL_COSTS,generalLoadout} from '../game/core/general.js';
import {validId} from './validation.js';
import {playerName} from './validation.js';
import {authCapabilities} from './social-auth.js';

const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const digest=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');
async function readBody(request){
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))fail('Send JSON.');
 const reader=request.body?.getReader();if(!reader)fail('Missing request body.');let size=0,text='';const decoder=new TextDecoder();for(;;){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>500000){await reader.cancel();fail('Request too large.',413);}text+=decoder.decode(value,{stream:true});}try{return JSON.parse(text+decoder.decode());}catch{fail('Invalid JSON.');}
}
async function ensureProfile(db,id){await db.prepare('INSERT OR IGNORE INTO fr010_profiles (user_id) VALUES (?)').bind(id).run();}
async function profile(db,id){
 await ensureProfile(db,id);
 const row=await db.prepare('SELECT * FROM fr010_profiles WHERE user_id = ?').bind(id).first();
 const grants=(await db.prepare('SELECT achievement_id AS id, faction_id AS factionId, reward, created_at AS createdAt FROM fr010_grants WHERE user_id = ? ORDER BY created_at, achievement_id').bind(id).all()).results;
 const eligible=(await db.prepare('SELECT achievement_id AS id, faction_id AS factionId, reward, verified_at AS verifiedAt, run_id AS runId FROM fr010_eligible WHERE user_id = ? ORDER BY verified_at, achievement_id').bind(id).all()).results;
 const progress=(await db.prepare("SELECT faction_id AS factionId,MAX(highest_wave) AS highestWave,MAX(COALESCE(json_extract(progress_json,'$.streakBest'),0)) AS streakBest FROM fr010_runs WHERE user_id=? AND outcome!='developer' GROUP BY faction_id").bind(id).all()).results;
 return {revision:row.revision,balance:row.balance,skills:JSON.parse(row.skills_json),equipped:JSON.parse(row.equipped_json),grants,eligible,progress:Object.fromEntries(progress.map(p=>[p.factionId,p]))};
}
async function ownRun(db,id,user){if(!validId(id))fail('Invalid run.');const run=await db.prepare('SELECT * FROM fr010_runs WHERE id = ? AND user_id = ?').bind(id,user).first();if(!run)fail('Run not found.',404);return run;}
const publicRun=row=>({id:row.id,sequence:row.sequence,lastBatch:row.last_batch,factionId:row.faction_id,ruleset:row.ruleset,outcome:row.outcome,snapshot:JSON.parse(row.snapshot_json),updatedAt:row.updated_at,round:row.highest_wave+1});

async function walletMutation(db,user,b,kind){
 if(!validId(b.requestId)||!Number.isSafeInteger(b.revision))fail('Invalid wallet request.');
 const key='request:'+b.requestId,detail=JSON.stringify({kind,skill:b.skill??null,equipped:b.equipped??null});
 const prior=await db.prepare('SELECT kind, detail FROM fr010_ledger WHERE user_id = ? AND entry_id = ?').bind(user,key).first();
 if(prior){if(prior.kind!==kind||prior.detail!==detail)fail('Request identity cannot change.',409);return profile(db,user);}
 const p=await profile(db,user);if(p.revision!==b.revision)fail('Profile changed. Refresh before trying again.',409);
 let amount=0,skills={...p.skills},equipped=[...p.equipped];
 if(kind==='purchase'){
  if(!Object.hasOwn(GENERAL_SKILLS,b.skill))fail('Unknown skill.');const level=skills[b.skill]||0;if(level>=3)fail('This skill is fully upgraded.');amount=-SKILL_COSTS[level];if(p.balance+amount<0)fail('Not enough medals.');skills[b.skill]=level+1;
 }else if(kind==='reset'){
  const row=await db.prepare("SELECT COALESCE(-SUM(amount),0) AS spent FROM fr010_ledger WHERE user_id = ? AND kind IN ('purchase','reset')").bind(user).first();amount=row.spent;skills={};equipped=[];
 }else if(kind==='equip'){try{generalLoadout(skills,b.equipped);}catch(error){fail(error.message);}equipped=b.equipped;}else fail('Invalid profile action.');
 await db.batch([
  db.prepare('INSERT INTO fr010_ledger (user_id,entry_id,amount,kind,detail,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM fr010_profiles WHERE user_id = ? AND revision = ?)').bind(user,key,amount,kind,detail,Date.now(),user,p.revision),
  db.prepare('UPDATE fr010_profiles SET balance = balance + ?, skills_json = ?, equipped_json = ?, revision = revision + 1 WHERE user_id = ? AND revision = ? AND EXISTS (SELECT 1 FROM fr010_ledger WHERE user_id = ? AND entry_id = ?)').bind(amount,JSON.stringify(skills),JSON.stringify(equipped),user,p.revision,user,key),
 ]);
 const committed=await db.prepare('SELECT kind FROM fr010_ledger WHERE user_id = ? AND entry_id = ?').bind(user,key).first();if(!committed)fail('Profile changed. Refresh before trying again.',409);return profile(db,user);
}

function earnedGrants(game,existing){
 const rows=game.progress.grants(),ids=new Set([...existing.map(x=>x.id),...rows.map(x=>x.id)]),f=game.factionId;
 const champions=[...ids].filter(x=>x.startsWith(`champion:${f}:`)).length,bosses=[...ids].filter(x=>x.startsWith(`boss:${f}:`)).length;
 for(const [target,reward]of [[5,2],[15,4],[30,8]])if(champions>=target)rows.push({id:`collection:${f}:${target}`,factionId:f,reward});
 if(bosses>=5)rows.push({id:`boss-collection:${f}`,factionId:f,reward:5});const owned=new Set(existing.map(x=>x.id));return rows.filter(x=>!owned.has(x.id));
}
async function claimAchievement(db,user,b){
 if(!validId(b.requestId)||!Number.isSafeInteger(b.revision)||typeof b.achievementId!=='string'||b.achievementId.length>200)fail('Invalid claim request.');
 const key='request:'+b.requestId,detail=b.achievementId;
 const prior=await db.prepare('SELECT kind,detail FROM fr010_ledger WHERE user_id=? AND entry_id=?').bind(user,key).first();
 if(prior){if(prior.kind!=='claim'||prior.detail!==detail)fail('Request identity cannot change.',409);return profile(db,user);}
 const p=await profile(db,user);
 if(p.grants.some(g=>g.id===detail))return p;
 const earned=p.eligible.find(g=>g.id===detail);if(!earned)fail('This achievement has not been verified.',409);
 if(p.revision!==b.revision)fail('Profile changed. Refresh before trying again.',409);
 const now=Date.now(),guard='EXISTS (SELECT 1 FROM fr010_profiles WHERE user_id=? AND revision=?)',requestGuard='EXISTS (SELECT 1 FROM fr010_ledger WHERE user_id=? AND entry_id=? AND kind=\'claim\')';
 await db.batch([
  db.prepare(`INSERT INTO fr010_ledger(user_id,entry_id,amount,kind,detail,created_at) SELECT ?,?,0,'claim',?,? WHERE ${guard} AND NOT EXISTS(SELECT 1 FROM fr010_grants WHERE user_id=? AND achievement_id=?)`).bind(user,key,detail,now,user,p.revision,user,detail),
  db.prepare(`INSERT INTO fr010_grants(user_id,achievement_id,faction_id,reward,created_at) SELECT ?,?,?,?,? WHERE ${guard} AND ${requestGuard}`).bind(user,detail,earned.factionId,earned.reward,now,user,p.revision,user,key),
  db.prepare(`INSERT INTO fr010_ledger(user_id,entry_id,amount,kind,detail,created_at) SELECT ?,?,?,'achievement',?,? WHERE ${guard} AND ${requestGuard}`).bind(user,'achievement:'+detail,earned.reward,detail,now,user,p.revision,user,key),
  db.prepare(`UPDATE fr010_profiles SET balance=balance+?,revision=revision+1 WHERE user_id=? AND revision=? AND ${requestGuard}`).bind(earned.reward,user,p.revision,user,key),
 ]);
 const committed=await db.prepare('SELECT entry_id FROM fr010_ledger WHERE user_id=? AND entry_id=?').bind(user,key).first();
 if(!committed)fail('Profile changed. Refresh before trying again.',409);
 return profile(db,user);
}
const progressSummary=g=>({kills:g.progress.kills,bossKills:g.progress.bossKills,highestWave:g.progress.highestWave,streak:g.progress.streak,streakBest:g.progress.streakBest,campaign:g.progress.campaign,champions:[...g.progress.champions]});

async function verifyBatch(db,user,id,b){
 if(!validId(b.batchId)||!Number.isSafeInteger(b.sequence)||b.sequence<0)fail('Invalid batch identity.');
 const hash=await digest(JSON.stringify(b.commands));
 const seen=await db.prepare('SELECT sequence,digest FROM fr010_batches WHERE run_id = ? AND batch_id = ?').bind(id,b.batchId).first();
 const run=await ownRun(db,id,user);
 if(seen){if(seen.digest!==hash)fail('Batch identity cannot change.',409);if(run.sequence!==seen.sequence)fail('Run advanced on another device. Reload the cloud save.',409);return {sequence:seen.sequence,batchId:b.batchId,profile:await profile(db,user),outcome:run.outcome};}
 if(run.outcome!=='playing')fail('This run no longer accepts commands.',409);
 if(run.sequence!==b.sequence)fail('Run changed on another device. Reload the cloud save.',409);
 if(run.ruleset!==FR010_RULESET)fail('Unsupported saved rules.');
 const game=restoreRun(currentFactionData(run.faction_id),JSON.parse(run.snapshot_json));
 try{replayCommands(game,b.commands);}catch{fail('Invalid player command stream.');}game.journal=[];
 if(Number.isFinite(b.elapsedSeconds)&&b.elapsedSeconds>=0)game.elapsedSeconds=Math.max(game.elapsedSeconds,Math.min(b.elapsedSeconds,(Date.now()-run.started_at)/1000+60));
 const next=run.sequence+1,snapshot=JSON.stringify(serializeRun(game)),score=game.scoreExact,outcome=game.phase==='lost'?'lost':'playing',summary=JSON.stringify(progressSummary(game)),now=Date.now();
 for(let attempt=0;attempt<5;attempt++){
  const p=await profile(db,user),grants=earnedGrants(game,[...p.grants,...p.eligible]),guard='EXISTS (SELECT 1 FROM fr010_runs WHERE id = ? AND sequence = ? AND last_batch = ?)';
  const statements=[db.prepare('UPDATE fr010_runs SET sequence = ?, last_batch = ?, snapshot_json = ?, score_text = ?, score_digits = ?, highest_wave = ?, progress_json = ?, outcome = ?, updated_at = ?, finished_at = ? WHERE id = ? AND user_id = ? AND sequence = ? AND outcome = ? AND EXISTS (SELECT 1 FROM fr010_profiles WHERE user_id = ? AND revision = ?)').bind(next,b.batchId,snapshot,score,score.length,game.progress.highestWave,summary,outcome,now,outcome==='lost'?now:null,id,user,b.sequence,'playing',user,p.revision)];
  statements.push(db.prepare(`INSERT OR IGNORE INTO fr010_batches (run_id,sequence,batch_id,digest,commands_json,created_at) SELECT ?,?,?,?,?,? WHERE ${guard}`).bind(id,next,b.batchId,hash,JSON.stringify(b.commands),now,id,next,b.batchId));
  for(const grant of grants)statements.push(db.prepare(`INSERT OR IGNORE INTO fr010_eligible (user_id,achievement_id,faction_id,reward,verified_at,run_id) SELECT ?,?,?,?,?,? WHERE ${guard}`).bind(user,grant.id,grant.factionId,grant.reward,now,id,id,next,b.batchId));
  statements.push(db.prepare(`UPDATE fr010_profiles SET revision = revision + 1 WHERE user_id = ? AND revision = ? AND ${guard}`).bind(user,p.revision,id,next,b.batchId));
  await db.batch(statements);
  const saved=await ownRun(db,id,user);if(saved.sequence===next&&saved.last_batch===b.batchId)return {sequence:next,batchId:b.batchId,profile:await profile(db,user),outcome,score,highestWave:game.progress.highestWave};
  if(saved.sequence!==b.sequence)fail('Run changed on another device. Reload the cloud save.',409);
 }
 fail('Profile is busy. Please retry.',409);
}

export async function handlePlayer(request,env){
 const url=new URL(request.url),path=url.pathname,db=env.DB;
 if(path.startsWith('/api/auth/'))return playerAuth(env).handler(request);
 if(!path.startsWith('/api/player/'))return null;
 if(path==='/api/player/session'&&request.method==='GET'){
  if(!env.AUTH_SECRET)return json({user:null,configured:false,auth:{providers:[],emailPassword:false}});const user=await authenticatedPlayer(request,env);return json({user:user?{id:user.id,name:user.name,email:user.email}:null,configured:true,auth:authCapabilities(env),mailMode:env.AUTH_MAIL_MODE==='local'?'local':'email',profile:user?await profile(db,user.id):null});
 }
 if(path==='/api/player/hall'&&request.method==='GET'){
  const faction=url.searchParams.get('faction')||'all',offset=Number(url.searchParams.get('offset')||0),view=url.searchParams.get('view')||'top';
  if(!['all','crown','forge','grove'].includes(faction)||!Number.isSafeInteger(offset)||offset<0||!['top','own'].includes(view))fail('Invalid standings page.');
  const user=env.AUTH_SECRET?await authenticatedPlayer(request,env):null;
  return json(await hallRecords(db,{faction,offset,view,user:user?.id}));
 }
 const user=await authenticatedPlayer(request,env);if(!user)fail('Sign in to your verified account.',401);
 if(path==='/api/player/profile'&&request.method==='GET')return json(await profile(db,user.id));
 if(path==='/api/player/statistics'&&request.method==='GET'){
  const rows=(await db.prepare("SELECT faction_id AS factionId,outcome,score_text AS score,highest_wave AS highestWave,progress_json FROM fr010_runs WHERE user_id = ? AND outcome != 'developer' ORDER BY score_digits DESC,score_text DESC,highest_wave DESC LIMIT 1000").bind(user.id).all()).results;
  const totals=await db.prepare("SELECT COUNT(*) AS played,SUM(CASE WHEN outcome='lost' THEN 1 ELSE 0 END) AS finished,MAX(highest_wave) AS highestWave,SUM(COALESCE(json_extract(progress_json,'$.kills'),0)) AS kills,SUM(COALESCE(json_extract(progress_json,'$.bossKills'),0)) AS bossKills,SUM(COALESCE(json_extract(progress_json,'$.campaign'),0)) AS campaignClears FROM fr010_runs WHERE user_id=? AND outcome!='developer'").bind(user.id).first();return json({...totals,bestScore:rows[0]?.score||'0',records:rows.slice(0,25).map(({progress_json,...r})=>r)});
 }
 if(path==='/api/player/active'&&request.method==='GET'){const row=await db.prepare('SELECT r.* FROM fr010_active a JOIN fr010_runs r ON r.id=a.run_id WHERE a.user_id=? AND r.outcome=?').bind(user.id,'playing').first();return json({run:row?publicRun(row):null});}
 if(request.method!=='POST')return json({error:'Not found.'},404);
 const b=await readBody(request);
 if(path==='/api/player/nickname'){
  let name;try{name=playerName(b.name);}catch(error){fail(error.message);}await db.prepare('UPDATE user SET name=?,updatedAt=? WHERE id=?').bind(name,new Date().toISOString(),user.id).run();return json({name});
 }
 if(path==='/api/player/delete-account'){
  if(b.confirmation!=='DELETE')fail('Type DELETE to confirm account removal.');
  const session=await playerAuth(env).api.getSession({headers:request.headers});if(!session||Date.now()-new Date(session.session.createdAt).getTime()>30*60*1000)fail('Sign in again before deleting your account.',401);
  await db.batch([
   db.prepare('DELETE FROM fr010_active WHERE user_id=?').bind(user.id),
   db.prepare('DELETE FROM fr010_batches WHERE run_id IN (SELECT id FROM fr010_runs WHERE user_id=?)').bind(user.id),
   ...['fr010_runs','fr010_eligible','fr010_grants','fr010_ledger','fr010_profiles'].map(table=>db.prepare(`DELETE FROM ${table} WHERE user_id=?`).bind(user.id)),
   db.prepare('DELETE FROM account WHERE userId=?').bind(user.id),db.prepare('DELETE FROM session WHERE userId=?').bind(user.id),db.prepare('DELETE FROM user WHERE id=?').bind(user.id),
  ]);return json({deleted:true});
 }
 if(['/api/player/purchase','/api/player/reset','/api/player/equip'].includes(path))return json(await walletMutation(db,user.id,b,path.split('/').at(-1)));
 if(path==='/api/player/achievements/claim')return json(await claimAchievement(db,user.id,b));
 if(path==='/api/player/runs'){
  if(!['crown','forge','grove'].includes(b.factionId))fail('Choose a faction.');const p=await profile(db,user.id),prior=await db.prepare('SELECT r.id,r.outcome FROM fr010_active a JOIN fr010_runs r ON r.id=a.run_id WHERE a.user_id=?').bind(user.id).first();if(prior?.outcome==='playing'&&!b.replace)fail('Confirm replacing your active run.',409);
  const id=crypto.randomUUID(),seed=crypto.getRandomValues(new Uint32Array(1))[0],loadout=generalLoadout(p.skills,p.equipped),discoveries=[...p.grants,...p.eligible].filter(g=>g.id.startsWith(`champion:${b.factionId}:`)).map(g=>g.id.split(':').at(-1)),game=new Game(currentFactionData(b.factionId),{seed,mode:'endless',loadout,discoveries:[...new Set(discoveries)],runId:id,accountId:user.id}),now=Date.now();
  const statements=[];if(prior?.outcome==='playing')statements.push(db.prepare("UPDATE fr010_runs SET outcome='abandoned',finished_at=?,updated_at=? WHERE id=? AND user_id=? AND outcome='playing'").bind(now,now,prior.id,user.id));statements.push(db.prepare('INSERT INTO fr010_runs (id,user_id,faction_id,ruleset,seed,snapshot_json,loadout_json,started_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,user.id,b.factionId,FR010_RULESET,seed,JSON.stringify(serializeRun(game)),JSON.stringify(loadout),now,now));statements.push(db.prepare('INSERT INTO fr010_active (user_id,run_id) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET run_id=excluded.run_id').bind(user.id,id));await db.batch(statements);return json({run:publicRun(await ownRun(db,id,user.id))},201);
 }
 const match=path.match(/^\/api\/player\/runs\/([a-f\d-]{36})\/(commands|developer)$/i);
 if(match){const run=await ownRun(db,match[1],user.id);if(match[2]==='developer')fail('Developer tools require a separate Guest test run.',409);return json(await verifyBatch(db,user.id,run.id,b));}
 return json({error:'Not found.'},404);
}
export async function playerResponse(request,env){try{return await handlePlayer(request,env);}catch(error){return json({error:error.status?error.message:'Account service unavailable. Please try again.'},error.status||503);}}
