// Explicitly authorized by the operator on 2026-11-15: all achievements,
// medals, XP, skills and active defenses reset; identities/scores preserved.
// Never change this identity without a new, explicit reset instruction.
import {verifiedRunProgress} from './verified-run-progress.js';
export const PROGRESSION_RESET_ID='20261115-approved-fresh-start';
export async function currentRunEpoch(db,run){const marker=await db.prepare('SELECT completed_at FROM progression_resets WHERE id=?').bind(PROGRESSION_RESET_ID).first();return !marker?.completed_at||run.started_at>=marker.completed_at&&verifiedRunProgress(run).epoch===PROGRESSION_RESET_ID;}
export async function ensureProgressionReset(db){
 const read=()=>db.prepare('SELECT completed_at FROM progression_resets WHERE id=?').bind(PROGRESSION_RESET_ID).first();
 const prior=await read();if(prior?.completed_at)return {epoch:PROGRESSION_RESET_ID,resetAt:prior.completed_at};
 const now=Date.now(),guard='EXISTS(SELECT 1 FROM progression_resets WHERE id=? AND completed_at=0)',scope=JSON.stringify({achievements:true,medals:true,xp:true,skills:true,activeDefenses:'closed',identities:'preserved',scores:'preserved'});
 const historical=(await db.prepare('SELECT id,user_id,highest_wave,progress_json,snapshot_json,outcome FROM fr010_runs').all()).results;
 const statements=[db.prepare('INSERT OR IGNORE INTO progression_resets(id,completed_at,scope_json) VALUES(?,0,?)').bind(PROGRESSION_RESET_ID,scope)];
 for(const table of ['account_xp_receipts','account_xp_ledger','account_run_progression','fr010_eligible','fr010_grants','fr010_ledger'])statements.push(db.prepare(`DELETE FROM ${table} WHERE ${guard}`).bind(PROGRESSION_RESET_ID));
 // Paid-prefix tombstones prevent even a request from the previous Worker
 // revision from re-crediting historical XP while deployment is switching.
 for(const run of historical){const v=verifiedRunProgress(run);statements.push(db.prepare(`INSERT OR IGNORE INTO account_run_progression(user_id,run_id,paid_waves,paid_bosses_json) SELECT ?,?,?,? WHERE ${guard}`).bind(run.user_id,run.id,v.waves,JSON.stringify(v.bosses),PROGRESSION_RESET_ID));}
 statements.push(db.prepare(`UPDATE fr010_profiles SET balance=0,skills_json='{}',equipped_json='[]',revision=revision+1 WHERE ${guard}`).bind(PROGRESSION_RESET_ID));
 statements.push(db.prepare(`INSERT INTO account_progression(user_id,xp_total,credited_waves,permanent_json,migrated,diagnostics_json) SELECT user_id,0,0,'{}',1,'[]' FROM fr010_profiles WHERE ${guard} ON CONFLICT(user_id) DO UPDATE SET xp_total=0,credited_waves=0,permanent_json='{}',migrated=1,diagnostics_json='[]'`).bind(PROGRESSION_RESET_ID));
 statements.push(db.prepare(`UPDATE fr010_runs SET outcome='reset',finished_at=COALESCE(finished_at,?),updated_at=? WHERE outcome='playing' AND ${guard}`).bind(now,now,PROGRESSION_RESET_ID));
 statements.push(db.prepare(`DELETE FROM fr010_active WHERE ${guard}`).bind(PROGRESSION_RESET_ID));
 statements.push(db.prepare('UPDATE progression_resets SET completed_at=? WHERE id=? AND completed_at=0').bind(now,PROGRESSION_RESET_ID));
 await db.batch(statements);
 const saved=await read();if(!saved?.completed_at)throw Error('Progress reset is pending. Please retry.');
 return {epoch:PROGRESSION_RESET_ID,resetAt:saved.completed_at};
}
