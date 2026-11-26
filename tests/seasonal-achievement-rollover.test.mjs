import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sqliteDatabase} from '../backend/sqlite-adapter.js';
import {migrateFr010} from '../backend/migrate-fr010.js';
import {advanceAchievementSeason,seasonAlbumProgress,seasonalRunSummary,seasonalRunTracker} from '../backend/achievement-seasons.js';
import {seasonWindow} from '../game/core/seasons.js';
import {Game} from '../game/core/game.js';
import {currentFactionData} from '../game/core/current-data.js';
import {BOSS_TYPES} from '../game/core/achievements.js';
import {skillGate} from '../game/core/account-progression.js';

const november=seasonWindow('2026-11'),december=seasonWindow('2026-12'),january=seasonWindow('2027-01');
const commander='defender',skill='extended-range';

function account(t){
  // Independent connections expose races between devices sharing one wallet.
  const dir=mkdtempSync(join(tmpdir(),'alliance-season-')),file=join(dir,'accounts.sqlite');
  const db=sqliteDatabase(file),other=sqliteDatabase(file);
  t.after(()=>{other.sqlite.close();db.sqlite.close();rmSync(dir,{recursive:true});});
  migrateFr010(db);
  db.sqlite.prepare('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,?,?)')
    .run(commander,'Commander','commander@example.test',november.start,november.start);
  db.sqlite.prepare('INSERT INTO fr010_profiles(user_id,revision,balance,skills_json,equipped_json) VALUES(?,9,23,?,?)')
    .run(commander,JSON.stringify({[skill]:2}),JSON.stringify([skill]));
  db.sqlite.prepare('INSERT INTO account_progression(user_id,xp_total,migrated,permanent_json) VALUES(?,779,1,?)')
    .run(commander,JSON.stringify({'deep-refit':1}));
  const claim=db.sqlite.prepare('INSERT INTO fr010_grants(user_id,achievement_id,reward,created_at) VALUES(?,?,1,?)');
  claim.run(commander,'kills:global:100',november.end-1);
  db.sqlite.prepare('INSERT INTO fr010_eligible(user_id,achievement_id,reward,verified_at) VALUES(?,?,1,?)')
    .run(commander,'kills:global:1000',november.end-1);
  db.sqlite.prepare('INSERT INTO fr010_ledger(user_id,entry_id,amount,kind,detail,created_at) VALUES(?,?,?,?,?,?)')
    .run(commander,'achievement:kills:global:100',1,'achievement','kills:global:100',november.end-1);
  const read=()=>{
    const s=db.sqlite.prepare('SELECT p.*,a.xp_total,a.permanent_json FROM fr010_profiles p JOIN account_progression a USING(user_id) WHERE p.user_id=?').get(commander);
    const idList=table=>db.sqlite.prepare('SELECT achievement_id FROM '+table+' WHERE user_id=?').all(commander).map(r=>r.achievement_id);
    return {revision:s.revision,balance:s.balance,xp:s.xp_total,owned:JSON.parse(s.skills_json),equipped:JSON.parse(s.equipped_json),
      permanent:JSON.parse(s.permanent_json),grants:idList('fr010_grants'),eligible:idList('fr010_eligible')};
  };
  return {db,other,read,claim};
}

test('UTC rollover clears the album, preserves medals and usable skills, and applies XP carry only once per month across devices',async t=>{
  const {db,other,read,claim}=account(t);
  const before=read();
  await advanceAchievementSeason(db,commander,december.start-1);
  assert.deepEqual(read(),before);
  await Promise.all([advanceAchievementSeason(db,commander,december.start),advanceAchievementSeason(other,commander,december.start)]);
  const fresh=read();
  assert.equal(fresh.xp,155);
  assert.equal(fresh.revision,before.revision+1);
  assert.deepEqual([fresh.grants,fresh.eligible],[[],[]]);
  assert.equal(fresh.balance,before.balance);
  assert.deepEqual(fresh.owned,before.owned);assert.deepEqual(fresh.equipped,before.equipped);
  assert.equal(fresh.permanent['deep-refit'],1);
  assert.ok(skillGate(skill,2,{xpTotal:fresh.xp,permanentUnlocks:fresh.permanent}).allowed);
  assert.equal(db.sqlite.prepare("SELECT amount FROM fr010_ledger WHERE user_id=? AND kind='achievement'").get(commander).amount,1);
  // The same canonical achievement can exist in December and must survive retries.
  claim.run(commander,'kills:global:100',december.start+1);
  await advanceAchievementSeason(other,commander,december.end-1);
  assert.deepEqual(read().grants,['kills:global:100']);
  db.sqlite.prepare('UPDATE account_progression SET xp_total=xp_total+9 WHERE user_id=?').run(commander);
  await advanceAchievementSeason(db,commander,january.start);
  const januaryState=read();
  assert.equal(januaryState.xp,32);assert.deepEqual(januaryState.grants,[]);
  await advanceAchievementSeason(other,commander,december.end-1);
  assert.deepEqual(read(),januaryState);
});

test('first visit after two missed month boundaries applies both reductions',async t=>{
  const {db,read}=account(t);
  await advanceAchievementSeason(db,commander,january.start+10);
  assert.equal(read().xp,Math.floor(Math.floor(779/5)/5));
  assert.deepEqual(read().eligible,[]);
});

test('a continuing run can defeat the same boss and earn the first kill milestone anew without importing earlier-season kills',async t=>{
  const {db}=account(t);
  const encounter=()=>new Game(currentFactionData('crown'),{seed:31});
  const death=(game,boss=false)=>game.emit('death',{enemy:{boss,type:boss?BOSS_TYPES[0]:'ordinary'}});
  const run={started_at:november.end-1000,progress_json:'{}'};
  const historical=encounter();
  for(let i=0;i<240;i++)death(historical,i===0);
  const current=seasonalRunTracker(historical,run,december.key);
  assert.equal(current.kills,0);assert.equal(current.bosses.size,0);
  for(let i=0;i<99;i++)death(historical,i===0);
  assert.equal(current.kills,99);
  assert.ok(current.grants().some(g=>g.id==='boss:global:'+BOSS_TYPES[0]));
  const summary={kills:historical.progress.kills,seasonActivity:seasonalRunSummary(current,december.key)};
  const resumed=encounter(),next=seasonalRunTracker(resumed,{...run,progress_json:JSON.stringify(summary)},december.key);
  death(resumed);assert.equal(next.kills,100);assert.ok(next.bosses.has(BOSS_TYPES[0]));
  const insert=db.sqlite.prepare("INSERT INTO fr010_runs(id,user_id,faction_id,ruleset,seed,outcome,snapshot_json,loadout_json,started_at,updated_at,progress_json) VALUES(?,?,?,'fr010-v1',7,?,'{}','{}',?,?,?)");
  insert.run('cross-month',commander,'crown','playing',run.started_at,december.start+2,JSON.stringify({...summary,kills:340,seasonActivity:seasonalRunSummary(next,december.key)}));
  insert.run('second-faction',commander,'forge','lost',december.start,december.start+2,'{"kills":5}');
  insert.run('excluded-test',commander,'grove','developer',december.start,december.start+2,'{"kills":1500}');
  insert.run('closed-november',commander,'grove','lost',november.start,november.end-1,'{"kills":1700}');
  const album=async grants=>(await seasonAlbumProgress(db,commander,december.key,december.start,grants)).seasonalKills;
  assert.deepEqual(await album([]),{total:105,claimedTarget:0,nextTarget:100});
  assert.deepEqual(await album([{id:'kills:global:100'}]),{total:105,claimedTarget:100,nextTarget:1000});
  // The rolling ten-thousand tier continues after the fixed early rewards.
  db.sqlite.prepare("UPDATE fr010_runs SET progress_json=? WHERE id='second-faction'").run('{"kills":19900}');
  assert.deepEqual(await album([{id:'kills:global:10000'}]),{total:20000,claimedTarget:10000,nextTarget:20000});
  assert.deepEqual(await album([{id:'kills:global:20000'}]),{total:20000,claimedTarget:20000,nextTarget:30000});
  const again=seasonalRunTracker(encounter(),{...run,progress_json:JSON.stringify(summary)},january.key);
  assert.equal(again.kills,0);assert.equal(again.bosses.size,0);
});
