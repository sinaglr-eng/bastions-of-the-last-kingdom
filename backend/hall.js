import {artifactBonuses} from '../game/core/artifacts.js';
import {FR010_RULESET} from '../game/core/current-data.js';
import {FIRST_SEASON,currentSeason,seasonWindow,seasonRankedSQL} from '../game/core/seasons.js';
import {settleCompletedSeasons} from './season-rewards.js';

export async function seasonalHall(db, {season = 'current', offset = 0, view = 'top', user = null, now = Date.now()} = {}) {
 const current = currentSeason(now);
 const key = season === 'current' ? current : season;
 if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key) || key < FIRST_SEASON || key > current) {
  throw Object.assign(new Error('Select a season between the first season and the current month.'), {status:400});
 }
 const window = seasonWindow(key);
 await settleCompletedSeasons(db, now);
 const fields = 'r.id,u.name,r.faction_id AS factionId,r.score_text AS score,r.highest_wave AS highestWave,r.rank,r.finished_at AS finishedAt';
 const rows = `${seasonRankedSQL} SELECT ${fields} FROM ranked r JOIN user u ON r.user_id=u.id`;
 const query = (sql,...args) => db.prepare(sql).bind(window.start,window.end,...args);
 const own = user ? await query(rows+' WHERE r.user_id=?',user).first() : null;
 if (view === 'own' && own) offset = Math.max(0,own.rank - 3);
 const {results:top} = await query(rows+' ORDER BY r.rank LIMIT 25 OFFSET ?',offset).all();
 const {total} = await query(seasonRankedSQL+' SELECT COUNT(*) AS total FROM ranked').first();
 const next = own?.rank > 1 ? await query(rows+' WHERE r.rank=?',own.rank-1).first() : null;
 const settlement = key < current ? await db.prepare('SELECT settled_at FROM season_settlements WHERE season=?').bind(key).first() : null;
 return {season:{...window,settledAt:settlement?.settled_at??null}, currentSeason:current, factionId:'all', offset,total,top,own,next,
  gap:next ? (BigInt(next.score)-BigInt(own.score)).toString() : null};
}

// The order deliberately matches the existing exact-score competition.
export async function hallRecords(db,{faction='all',offset=0,view='top',user=null}={}){
 const args=[FR010_RULESET],filter="outcome='lost' AND ruleset=?"+(faction==='all'?'':' AND faction_id=?');
 if(faction!=='all')args.push(faction);
 const ranked=`WITH ranked AS (SELECT *,ROW_NUMBER() OVER(ORDER BY score_digits DESC,score_text DESC,highest_wave DESC,finished_at,id) AS rank FROM fr010_runs WHERE ${filter})`;
 const publicRow=r=>r?{id:r.id,name:r.name,factionId:r.faction_id,score:r.score_text,highestWave:r.highest_wave,rank:r.rank,loadout:JSON.parse(r.loadout_json),artifactEquipment:JSON.parse(r.artifact_loadout_json||'{}'),artifactVersion:JSON.parse(r.snapshot_json||'{}').artifactVersion||'fr011-v1',artifactSets:artifactBonuses(JSON.parse(r.artifact_loadout_json||'{}')).sets,finishedAt:r.finished_at}:null;
 const select='SELECT r.*,u.name FROM ranked r JOIN user u ON u.id=r.user_id';
 const own=user?await db.prepare(`${ranked} ${select} WHERE r.user_id=? ORDER BY rank LIMIT 1`).bind(...args,user).first():null;
 if(view==='own'&&own)offset=Math.max(0,own.rank-3);
 const rows=(await db.prepare(`${ranked} ${select} ORDER BY rank LIMIT 25 OFFSET ?`).bind(...args,offset).all()).results;
 const podium=(await db.prepare(`${ranked} ${select} ORDER BY rank LIMIT 3`).bind(...args).all()).results;
 const count=await db.prepare(`SELECT COUNT(*) AS total FROM fr010_runs WHERE ${filter}`).bind(...args).first();
 const next=own?.rank>1?await db.prepare(`${ranked} ${select} WHERE rank=?`).bind(...args,own.rank-1).first():null;
 return {ruleset:FR010_RULESET,factionId:faction,offset,total:count.total,top:rows.map(publicRow),podium:podium.map(publicRow),own:publicRow(own),next:publicRow(next),gap:next?(BigInt(next.score_text)-BigInt(own.score_text)).toString():null};
}
