import {FR010_RULESET} from '../game/core/current-data.js';

// The order deliberately matches the existing exact-score competition.
export async function hallRecords(db,{faction='all',offset=0,view='top',user=null}={}){
 const args=[FR010_RULESET],filter="outcome='lost' AND ruleset=?"+(faction==='all'?'':' AND faction_id=?');
 if(faction!=='all')args.push(faction);
 const ranked=`WITH ranked AS (SELECT *,ROW_NUMBER() OVER(ORDER BY score_digits DESC,score_text DESC,highest_wave DESC,finished_at,id) AS rank FROM fr010_runs WHERE ${filter})`;
 const publicRow=r=>r?{id:r.id,name:r.name,factionId:r.faction_id,score:r.score_text,highestWave:r.highest_wave,rank:r.rank,loadout:JSON.parse(r.loadout_json),finishedAt:r.finished_at}:null;
 const select='SELECT r.*,u.name FROM ranked r JOIN user u ON u.id=r.user_id';
 const own=user?await db.prepare(`${ranked} ${select} WHERE r.user_id=? ORDER BY rank LIMIT 1`).bind(...args,user).first():null;
 if(view==='own'&&own)offset=Math.max(0,own.rank-3);
 const rows=(await db.prepare(`${ranked} ${select} ORDER BY rank LIMIT 25 OFFSET ?`).bind(...args,offset).all()).results;
 const podium=(await db.prepare(`${ranked} ${select} ORDER BY rank LIMIT 3`).bind(...args).all()).results;
 const count=await db.prepare(`SELECT COUNT(*) AS total FROM fr010_runs WHERE ${filter}`).bind(...args).first();
 const next=own?.rank>1?await db.prepare(`${ranked} ${select} WHERE rank=?`).bind(...args,own.rank-1).first():null;
 return {ruleset:FR010_RULESET,factionId:faction,offset,total:count.total,top:rows.map(publicRow),podium:podium.map(publicRow),own:publicRow(own),next:publicRow(next),gap:next?(BigInt(next.score_text)-BigInt(own.score_text)).toString():null};
}
