import {currentSeason,FIRST_SEASON,seasonWindow} from '../game/core/seasons.js';
import {RunProgress} from '../game/core/achievements.js';
import {killTargetFromId,nextKillTarget} from '../game/core/kill-milestones.js';

const marker='achievement-season:';
const monthIndex=key=>Number(key.slice(0,4))*12+Number(key.slice(5));

// The existing wallet journal has a unique (account, entry) key and is
// committed atomically with profile revisions. Keep all currency receipts.
export async function advanceAchievementSeason(db,user,now=Date.now()){
  const season=currentSeason(now);
  if(season<=FIRST_SEASON)return season;
  for(let attempt=0;attempt<6;attempt++){
    const state=await db.prepare(`SELECT p.revision,p.skills_json,a.xp_total,a.permanent_json,
      (SELECT MAX(entry_id) FROM fr010_ledger WHERE user_id=p.user_id AND entry_id GLOB 'achievement-season:????-??') AS last
      FROM fr010_profiles p JOIN account_progression a USING(user_id) WHERE p.user_id=?`).bind(user).first();
    if(!state)throw Error('Missing account for season change.');
    const previous=state.last?.slice(marker.length)??FIRST_SEASON;
    if(previous>=season)return previous;
    const retained=Math.floor(state.xp_total/5**(monthIndex(season)-monthIndex(previous)));
    const permanent=JSON.parse(state.permanent_json);
    for(const [skill,rank] of Object.entries(JSON.parse(state.skills_json)))permanent[skill]=Math.max(permanent[skill]||0,rank);
    const guard='EXISTS(SELECT 1 FROM fr010_profiles WHERE user_id=? AND revision=?)';
    const bind=[user,state.revision],entry=marker+season;
    const results=await db.batch([
      db.prepare(`INSERT INTO fr010_ledger(user_id,entry_id,amount,kind,detail,created_at) SELECT ?,?,0,'season',?,? WHERE ${guard}`).bind(user,entry,JSON.stringify({previous,xpBefore:state.xp_total,xpAfter:retained}),now,...bind),
      db.prepare(`DELETE FROM fr010_eligible WHERE user_id=? AND ${guard}`).bind(user,...bind),
      db.prepare(`DELETE FROM fr010_grants WHERE user_id=? AND ${guard}`).bind(user,...bind),
      db.prepare(`UPDATE account_progression SET xp_total=?,permanent_json=? WHERE user_id=? AND ${guard}`).bind(retained,JSON.stringify(permanent),user,...bind),
      db.prepare('UPDATE fr010_profiles SET revision=revision+1 WHERE user_id=? AND revision=?').bind(...bind)
    ]);
    if(results.at(-1)?.meta?.changes)return season;
  }
  throw Object.assign(Error('Profile changed. Refresh before trying again.'),{status:409});
}

export function seasonalRunTracker(game,run,season){
  if(run.started_at>=seasonWindow(season).start)return game.progress;
  const tracker=new RunProgress(game),saved=JSON.parse(run.progress_json||'{}').seasonActivity;
  if(saved?.season===season){
    for(const key of ['kills','streak','streakBest','highestWave','mythic','campaign','waveDamaged'])tracker[key]=saved[key];
    tracker.champions=new Set(saved.champions);tracker.bosses=new Set(saved.bosses);
  }else tracker.waveDamaged=game.progress.waveDamaged;
  return tracker;
}

export function seasonalRunSummary(p,season){
  return {season,kills:p.kills,streak:p.streak,streakBest:p.streakBest,highestWave:p.highestWave,
    mythic:p.mythic,campaign:p.campaign,waveDamaged:p.waveDamaged,champions:[...p.champions],bosses:[...p.bosses]};
}

export async function seasonAlbumProgress(db,user,season,start,grants){
  const rows=(await db.prepare(`SELECT faction_id,highest_wave,started_at,progress_json FROM fr010_runs
    WHERE user_id=? AND outcome NOT IN ('developer','reset') AND (started_at>=? OR json_extract(progress_json,'$.seasonActivity.season')=?)`).bind(user,start,season).all()).results;
  let total=0,claimedTarget=0;
  const progress={},discovered={};
  for(const row of rows){
    const summary=JSON.parse(row.progress_json||'{}');
    const data=row.started_at>=start?summary:summary.seasonActivity;
    total+=data.kills||0;
    const f=row.faction_id,current=progress[f]??={highestWave:0,streakBest:0,factionId:f};
    current.highestWave=Math.max(current.highestWave,row.started_at>=start?row.highest_wave:data.highestWave||0);
    current.streakBest=Math.max(current.streakBest,data.streakBest||0);
    const ids=discovered[f]??=new Set();for(const id of data.champions||[])ids.add(id);
  }
  for(const {id} of grants)claimedTarget=Math.max(claimedTarget,killTargetFromId(id)||0);
  return {progress,discoveries:Object.fromEntries(Object.entries(discovered).map(([key,values])=>[key,[...values]])),
    seasonalKills:{total,claimedTarget,nextTarget:nextKillTarget(claimedTarget)}};
}
