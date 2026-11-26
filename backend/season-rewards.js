import {FIRST_SEASON,seasonRankedSQL,seasonReward,seasonWindow} from '../game/core/seasons.js';

function drawPrizes(){
 const prizes={};
 for(let rank=1;rank<=10;rank++){
  const {legendary,epic,dust,gems}=seasonReward(rank);
  const coins=crypto.getRandomValues(new Uint8Array(gems));
  const aquamarine=coins.reduce((sum,coin)=>sum+(coin%2),0);
  const chests=[];
  for(const [tier,count] of [[5,legendary],[4,epic]]){
   for(const seed of crypto.getRandomValues(new Uint32Array(count))){
    chests.push({id:crypto.randomUUID(),tier,seed});
   }
  }
  prizes[rank]={legendary,epic,dust,aquamarine,emerald:gems-aquamarine,chests};
 }
 return JSON.stringify(prizes);
}

async function settleMonth(db,month,now){
 const {key,start,end}=month,token=crypto.randomUUID(),prizes=drawPrizes();
 // Only the transaction that inserts this token can issue prizes. Ranking,
 // receipts, wallet credits and chest creation all share that transaction.
 const ownsSeason='EXISTS(SELECT 1 FROM season_settlements WHERE season=? AND token=?)';
 await db.batch([
  db.prepare('INSERT INTO season_settlements(season,token,settled_at) VALUES(?,?,?) ON CONFLICT(season) DO NOTHING').bind(key,token,now),
  db.prepare(`${seasonRankedSQL}
   INSERT INTO season_rewards(season,user_id,rank,run_id,legendary,epic,aquamarine,emerald,dust)
   SELECT ?,r.user_id,r.rank,r.id,
    json_extract(p.value,'$.legendary'),json_extract(p.value,'$.epic'),
    json_extract(p.value,'$.aquamarine'),json_extract(p.value,'$.emerald'),json_extract(p.value,'$.dust')
   FROM ranked r JOIN json_each(?) p ON r.rank=CAST(p.key AS INTEGER)
   WHERE r.rank<=10 AND ${ownsSeason}`).bind(start,end,key,prizes,key,token),
  db.prepare(`INSERT INTO artifact_accounts(user_id,revision,dust,gems_json)
   SELECT user_id,1,dust,json_object('aquamarine',aquamarine,'emerald',emerald) FROM season_rewards
   WHERE season=? AND ${ownsSeason}
   ON CONFLICT(user_id) DO UPDATE SET
    revision=artifact_accounts.revision+1,dust=artifact_accounts.dust+excluded.dust,
    gems_json=json_set(artifact_accounts.gems_json,
      '$.aquamarine',COALESCE(json_extract(artifact_accounts.gems_json,'$.aquamarine'),0)+json_extract(excluded.gems_json,'$.aquamarine'),
      '$.emerald',COALESCE(json_extract(artifact_accounts.gems_json,'$.emerald'),0)+json_extract(excluded.gems_json,'$.emerald'))`).bind(key,key,token),
  db.prepare(`INSERT INTO season_chests(id,season,user_id,tier,seed,earned_at)
   SELECT json_extract(c.value,'$.id'),s.season,s.user_id,json_extract(c.value,'$.tier'),json_extract(c.value,'$.seed'),?
   FROM season_rewards s JOIN json_each(?) p ON s.rank=CAST(p.key AS INTEGER)
   JOIN json_each(p.value,'$.chests') c
   WHERE s.season=? AND ${ownsSeason}`).bind(end,prizes,key,key,token),
 ]);
}

export async function settleCompletedSeasons(db,now=Date.now()){
 let month=seasonWindow(FIRST_SEASON);
 if(month.end>now)return;
 const latest=await db.prepare('SELECT MAX(season) AS season FROM season_settlements').first();
 if(latest?.season)month=seasonWindow(new Date(seasonWindow(latest.season).end).toISOString().slice(0,7));
 while(month.end<=now){
  await settleMonth(db,month,now);
  month=seasonWindow(new Date(month.end).toISOString().slice(0,7));
 }
}
