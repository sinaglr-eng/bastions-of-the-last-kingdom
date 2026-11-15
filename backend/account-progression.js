import {verifiedRunProgress} from './verified-run-progress.js';
export {verifiedRunProgress} from './verified-run-progress.js';
import {currentRunEpoch} from './progression-reset.js';
import {accountRank,achievementXP,BOSS_XP,newlyAvailableSkills} from '../game/core/account-progression.js';
import {achievementCatalog,streakAchievement} from '../game/core/achievements.js';
import {currentFactionData} from '../game/core/current-data.js';

const parse=(s,fallback)=>{try{return JSON.parse(s);}catch{return fallback;}};
const factions=['crown','forge','grove'];
export function activeAchievement(id){
 if(typeof id!=='string')return null;
 const f=id.split(':')[1],data=currentFactionData(factions.includes(f)?f:'crown');
 let row=achievementCatalog(data).find(a=>a.id===id);
 if(!row&&/^streak:(crown|forge|grove):[1-9]\d*$/.test(id)){const n=Number(id.split(':')[2]);if(Number.isSafeInteger(n)&&n%10===0)row=streakAchievement(f,n/10);}
 return row?{...row,xp:achievementXP(data,id)}:null;
}
export async function ensureAccountProgression(db,user){
 await db.prepare('INSERT OR IGNORE INTO account_progression(user_id) VALUES (?)').bind(user).run();
 for(let attempt=0;attempt<5;attempt++){
  const state=await db.prepare('SELECT * FROM account_progression WHERE user_id=?').bind(user).first();if(state.migrated)return state;
  const p=await db.prepare('SELECT revision,skills_json FROM fr010_profiles WHERE user_id=?').bind(user).first();
  const runs=(await db.prepare('SELECT * FROM fr010_runs WHERE user_id=?').bind(user).all()).results;
  const grants=(await db.prepare('SELECT achievement_id FROM fr010_grants WHERE user_id=?').bind(user).all()).results;
  let waves=0,bossXP=0;const diagnostics=[],now=Date.now(),guard='EXISTS(SELECT 1 FROM account_progression WHERE user_id=? AND migrated=0) AND EXISTS(SELECT 1 FROM fr010_profiles WHERE user_id=? AND revision=?)',args=[user,user,p.revision],statements=[];
  for(const run of runs){const v=verifiedRunProgress(run);if(v.excluded)continue;waves+=v.waves;bossXP+=v.bosses.reduce((sum,id)=>sum+BOSS_XP[id],0);if(v.missingBossEvidence)diagnostics.push({runId:run.id,reason:'Boss type evidence unavailable; no boss XP inferred.'});
   statements.push(db.prepare(`INSERT OR IGNORE INTO account_run_progression(user_id,run_id,paid_waves,paid_bosses_json) SELECT ?,?,?,? WHERE ${guard}`).bind(user,run.id,v.waves,JSON.stringify(v.bosses),...args));
  }
  const achievementTotal=grants.reduce((sum,g)=>sum+(activeAchievement(g.achievement_id)?.xp||0),0),total=Math.floor(waves/10)+bossXP+achievementTotal;
  statements.push(db.prepare(`INSERT OR IGNORE INTO account_xp_ledger(user_id,source_id,amount,created_at) SELECT ?,'migration:v1',?,? WHERE ${guard}`).bind(user,total,now,...args));
  statements.push(db.prepare(`UPDATE account_progression SET xp_total=?,credited_waves=?,permanent_json=?,migrated=1,diagnostics_json=? WHERE user_id=? AND ${guard}`).bind(total,waves,p.skills_json,JSON.stringify(diagnostics),user,...args));
  if(total||waves||p.skills_json!=='{}')statements.push(db.prepare("UPDATE fr010_profiles SET revision=revision+1 WHERE user_id=? AND revision=? AND EXISTS(SELECT 1 FROM account_progression WHERE user_id=? AND migrated=1)").bind(user,p.revision,user));
  await db.batch(statements);
 }
 throw Object.assign(Error('Progress migration is busy. Please retry.'),{status:409});
}
export async function accountProgression(db,user){await ensureAccountProgression(db,user);const s=await db.prepare('SELECT a.*,p.revision FROM account_progression a JOIN fr010_profiles p ON p.user_id=a.user_id WHERE a.user_id=?').bind(user).first();return {revision:s.revision,xpTotal:s.xp_total,waveCarry:s.credited_waves%10,creditedWaves:s.credited_waves,permanentUnlocks:parse(s.permanent_json,{}),rank:accountRank(s.xp_total),migrationDiagnostics:parse(s.diagnostics_json,[])};}
export async function settleRunExperience(db,user,runId,kind){
 const receiptId=`run:${runId}:${kind}`;
 for(let attempt=0;attempt<6;attempt++){
  const prior=await db.prepare('SELECT receipt_json,acknowledged FROM account_xp_receipts WHERE user_id=? AND receipt_id=?').bind(user,receiptId).first();if(prior)return {...parse(prior.receipt_json,{}),acknowledged:!!prior.acknowledged};
  const run=await db.prepare('SELECT * FROM fr010_runs WHERE user_id=? AND id=?').bind(user,runId).first();if(!run)throw Object.assign(Error('Run not found.'),{status:404});
  const v=verifiedRunProgress(run);if(!await currentRunEpoch(db,run))throw Object.assign(Error('Account progress reset. Start a new defense.'),{status:409});if(v.excluded)throw Object.assign(Error('Progression unavailable in this mode.'),{status:400});
  if(kind==='campaign'?v.waves<50:!['lost','won','abandoned'].includes(run.outcome))throw Object.assign(Error('The result has not been verified yet.'),{status:409});
  await ensureAccountProgression(db,user);
  const state=await db.prepare('SELECT a.*,p.revision FROM account_progression a JOIN fr010_profiles p ON p.user_id=a.user_id WHERE a.user_id=?').bind(user).first(),p={revision:state.revision};
  const paid=await db.prepare('SELECT * FROM account_run_progression WHERE user_id=? AND run_id=?').bind(user,runId).first();
  const targetWaves=kind==='campaign'?Math.min(50,v.waves):v.waves,eligibleBosses=v.bosses.filter(id=>kind!=='campaign'||(v.bossWaves[id]??50)<=50);
  const paidBosses=parse(paid?.paid_bosses_json||'[]',[]),delta=Math.max(0,targetWaves-(paid?.paid_waves||0)),bosses=eligibleBosses.filter(id=>!paidBosses.includes(id));
  const waveXP=Math.floor((state.credited_waves+delta)/10)-Math.floor(state.credited_waves/10),bossXP=bosses.reduce((sum,id)=>sum+BOSS_XP[id],0),amount=waveXP+bossXP;
  const receipt={receiptId,runId,kind,status:'confirmed',xpBefore:state.xp_total,xpAfter:state.xp_total+amount,levelBefore:accountRank(state.xp_total).level,levelAfter:accountRank(state.xp_total+amount).level,wavesDelta:delta,waveXP,bossXP,bosses,amount,carryBefore:state.credited_waves%10,carryAfter:(state.credited_waves+delta)%10,newLevels:Array.from({length:accountRank(state.xp_total+amount).level-accountRank(state.xp_total).level},(_,i)=>accountRank(state.xp_total).level+i+1),newSkills:newlyAvailableSkills(state.xp_total,state.xp_total+amount),revision:p.revision+1};
  const guard='EXISTS(SELECT 1 FROM fr010_profiles WHERE user_id=? AND revision=?)',args=[user,p.revision],now=Date.now();
  const statements=[db.prepare(`INSERT OR IGNORE INTO account_xp_receipts(user_id,receipt_id,run_id,receipt_json) SELECT ?,?,?,? WHERE ${guard}`).bind(user,receiptId,runId,JSON.stringify(receipt),...args)];
  const committedGuard=guard+' AND EXISTS(SELECT 1 FROM account_xp_receipts WHERE user_id=? AND receipt_id=?)',all=[...args,user,receiptId];
  statements.push(db.prepare(`INSERT INTO account_run_progression(user_id,run_id,paid_waves,paid_bosses_json) SELECT ?,?,?,? WHERE ${committedGuard} ON CONFLICT(user_id,run_id) DO UPDATE SET paid_waves=excluded.paid_waves,paid_bosses_json=excluded.paid_bosses_json`).bind(user,runId,Math.max(paid?.paid_waves||0,targetWaves),JSON.stringify([...new Set([...paidBosses,...eligibleBosses])]),...all));
  statements.push(db.prepare(`INSERT OR IGNORE INTO account_xp_ledger(user_id,source_id,amount,created_at) SELECT ?,?,?,? WHERE ${committedGuard}`).bind(user,receiptId+':waves',waveXP,now,...all));
  for(const id of bosses)statements.push(db.prepare(`INSERT OR IGNORE INTO account_xp_ledger(user_id,source_id,amount,created_at) SELECT ?,?,?,? WHERE ${committedGuard}`).bind(user,`run:${runId}:boss:${id}`,BOSS_XP[id],now,...all));
  statements.push(db.prepare(`UPDATE account_progression SET xp_total=xp_total+?,credited_waves=credited_waves+? WHERE user_id=? AND ${committedGuard}`).bind(amount,delta,user,...all));
  statements.push(db.prepare(`UPDATE fr010_profiles SET revision=revision+1 WHERE user_id=? AND revision=? AND EXISTS(SELECT 1 FROM account_xp_receipts WHERE user_id=? AND receipt_id=?)`).bind(user,p.revision,user,receiptId));
  await db.batch(statements);
 }
 throw Object.assign(Error('Profile is busy. Please retry.'),{status:409});
}
