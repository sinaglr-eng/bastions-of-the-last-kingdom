import {canonicalAchievementId,eligibleChampion,isSharedAchievement} from '../game/core/account-progression.js';
import {achievementCatalog,streakAchievement,BOSS_TYPES} from '../game/core/achievements.js';
import {currentFactionData} from '../game/core/current-data.js';
import {verifiedRunProgress} from './verified-run-progress.js';

const factions=['crown','forge','grove'];
const shared=isSharedAchievement;
const validPositive=n=>Number.isSafeInteger(n)&&n>0;

// Historical rows remain exact in the database. Current account presentation
// exposes one entitlement per canonical identity, including already paid aliases.
export function mergeAchievementRows(rows){
 const result=new Map();
 for(const row of rows){const id=canonicalAchievementId(row.id),previous=result.get(id),normalized={...row,id,...(shared(id)?{factionId:null}:{})};
  if(!previous||row.id===id)result.set(id,normalized);
 }
 return [...result.values()];
}

function definition(id){
 const f=id.split(':')[1],data=currentFactionData(factions.includes(f)?f:'crown');
 let row=achievementCatalog(data).find(a=>a.id===id);
 if(!row&&/^streak:global:[1-9]\d*$/.test(id)){const n=Number(id.split(':')[2]);if(validPositive(n)&&n%10===0)row=streakAchievement('global',n/10);}
 return row;
}

// Reconciliation is additive and guarded by the existing profile revision.
// No wallet, XP, purchase, receipt, reset or score row is rewritten. A retry or
// a concurrent request sees the canonical rows and performs no second grant.
export async function reconcileAchievementEntitlements(db,user,reset){
 for(let attempt=0;attempt<7;attempt++){
  const profile=await db.prepare('SELECT revision FROM fr010_profiles WHERE user_id=?').bind(user).first();
  const rawGrants=(await db.prepare('SELECT achievement_id AS id,faction_id AS factionId,reward,created_at AS createdAt FROM fr010_grants WHERE user_id=? ORDER BY created_at,achievement_id').bind(user).all()).results;
  const rawEligible=(await db.prepare('SELECT achievement_id AS id,faction_id AS factionId,reward,verified_at AS verifiedAt,run_id AS runId FROM fr010_eligible WHERE user_id=? ORDER BY verified_at,achievement_id').bind(user).all()).results;
  const grants=mergeAchievementRows(rawGrants),eligible=mergeAchievementRows(rawEligible),owned=new Set(grants.map(g=>g.id)),knownGrants=new Set(rawGrants.map(g=>g.id)),knownEligible=new Set(rawEligible.map(g=>g.id));
  const pendingGrants=[],pendingEligible=new Map(),now=Date.now();
  for(const row of grants)if(shared(row.id)&&!knownGrants.has(row.id))pendingGrants.push(row);
  const remember=(id,{runId=null,at=now}={})=>{id=canonicalAchievementId(id);const d=definition(id);if(!d||owned.has(id)||knownEligible.has(id)||pendingEligible.has(id))return;pendingEligible.set(id,{id,factionId:d.factionId??null,reward:d.reward,runId,at});};
  for(const row of eligible)remember(row.id,{runId:row.runId,at:row.verifiedAt});
  const champions=Object.fromEntries(factions.map(f=>[f,new Set()])),bosses=new Set();let best=0;
  const evidence=id=>{
   const canonical=canonicalAchievementId(id),[kind,f,value]=canonical.split(':');
   if(kind==='champion'&&factions.includes(f)&&eligibleChampion(currentFactionData(f).towers[value]))champions[f].add(value);
   if(kind==='boss'&&f==='global'&&BOSS_TYPES.includes(value))bosses.add(value);
   if(kind==='streak'&&f==='global'&&validPositive(+value)&&+value%10===0)best=Math.max(best,+value);
  };
  [...grants,...eligible].forEach(row=>evidence(row.id));
  // Do not materialize every saved object graph in one .all() result. A long
  // account history may contain many large snapshots; inspect one legacy graph
  // at a time and retain only its small verified achievement evidence.
  const runs=(await db.prepare("SELECT id,faction_id,ruleset,outcome,started_at,highest_wave,progress_json FROM fr010_runs WHERE user_id=? AND outcome NOT IN ('developer','reset') AND started_at>=? ORDER BY started_at,id").bind(user,reset.resetAt).all()).results;
  for(const run of runs){const f=run.faction_id;if(!factions.includes(f)||run.ruleset!==currentFactionData(f).rulesetRevision)continue;
   const saved=await db.prepare('SELECT snapshot_json FROM fr010_runs WHERE user_id=? AND id=?').bind(user,run.id).first();
   const progress=verifiedRunProgress({...run,snapshot_json:saved?.snapshot_json});if(progress.excluded||progress.epoch!==reset.epoch)continue;
   for(const id of progress.champions){if(!eligibleChampion(currentFactionData(f).towers[id]))continue;champions[f].add(id);remember(`champion:${f}:${id}`,{runId:run.id});}
   for(const type of progress.bosses){bosses.add(type);remember(`boss:global:${type}`,{runId:run.id});}
   best=Math.max(best,progress.streakBest);
  }
  for(const f of factions)for(const target of [5,15,30])if(champions[f].size>=target)remember(`collection:${f}:${target}`);
  if(BOSS_TYPES.every(id=>bosses.has(id)))remember('boss-collection:global');
  for(let n=10;n<=best;n+=10)remember(`streak:global:${n}`);
  if(!pendingGrants.length&&!pendingEligible.size)return false;
  const guard='EXISTS(SELECT 1 FROM fr010_profiles WHERE user_id=? AND revision=?)',statements=[];
  for(const row of pendingGrants)statements.push(db.prepare(`INSERT OR IGNORE INTO fr010_grants(user_id,achievement_id,faction_id,reward,created_at) SELECT ?,?,NULL,?,? WHERE ${guard}`).bind(user,row.id,row.reward,row.createdAt,user,profile.revision));
  for(const row of pendingEligible.values())statements.push(db.prepare(`INSERT OR IGNORE INTO fr010_eligible(user_id,achievement_id,faction_id,reward,verified_at,run_id) SELECT ?,?,?,?,?,? WHERE ${guard} AND NOT EXISTS(SELECT 1 FROM fr010_grants WHERE user_id=? AND achievement_id=?)`).bind(user,row.id,row.factionId,row.reward,row.at,row.runId,user,profile.revision,user,row.id));
  statements.push(db.prepare('UPDATE fr010_profiles SET revision=revision+1 WHERE user_id=? AND revision=?').bind(user,profile.revision));
  await db.batch(statements);
  const currentGrants=new Set((await db.prepare('SELECT achievement_id FROM fr010_grants WHERE user_id=?').bind(user).all()).results.map(r=>r.achievement_id)),currentEligible=new Set((await db.prepare('SELECT achievement_id FROM fr010_eligible WHERE user_id=?').bind(user).all()).results.map(r=>r.achievement_id));
  if(pendingGrants.every(row=>currentGrants.has(row.id))&&[...pendingEligible.values()].every(row=>currentGrants.has(row.id)||currentEligible.has(row.id)))return true;
 }
 throw Object.assign(Error('Achievement reconciliation is busy. Please retry.'),{status:409});
}
