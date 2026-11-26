import test from 'node:test';
import assert from 'node:assert/strict';
import {sqliteDatabase} from '../backend/sqlite-adapter.js';
import {migrateFr010} from '../backend/migrate-fr010.js';
import {artifactMutation,artifactProfile} from '../backend/artifact-store.js';
import {settleCompletedSeasons} from '../backend/season-rewards.js';
import {seasonWindow} from '../game/core/seasons.js';

const november=seasonWindow('2026-11'),december=seasonWindow('2026-12');
function seasonFixture(t){
 const db=sqliteDatabase();
 t.after(()=>db.sqlite.close());migrateFr010(db);
 const insertUser=db.sqlite.prepare('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,0,0)');
 const insertRun=db.sqlite.prepare(`INSERT INTO fr010_runs
  (id,user_id,faction_id,ruleset,seed,outcome,snapshot_json,loadout_json,score_text,score_digits,started_at,updated_at,finished_at)
  VALUES(?,?,'crown','fr010-v1',1,?,'{}','{}',?,?,0,?,?)`);
 for(let n=1;n<=12;n++)insertUser.run('u'+n,'Commander '+n,n+'@example.test');
 const run=(user,score,finish=november.end-1,outcome='lost',storedFinish=finish)=>{
  insertRun.run(crypto.randomUUID(),user,outcome,String(score),String(score).length,finish,storedFinish);
 };
 return {db,run};
}

test('month-close pays the top ten once into their existing vaults and the usual chest opening flow',async t=>{
 const {db,run}=seasonFixture(t);
 for(let n=1;n<=11;n++)run('u'+n,200-n);
 run('u1',198); // A second run must not earn a second prize.
 run('u12',9999,november.end-1,'developer');
 run('u12',7777,november.end); // Belongs to December.
 run('u1',200,november.start,'won',null); // Historic victories only have updated_at.
 db.sqlite.prepare("INSERT INTO artifact_accounts(user_id,dust,gems_json) VALUES('u4',13,'{\"emerald\":8,\"other\":2}')").run();
 await settleCompletedSeasons(db,november.end-1);
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM season_rewards').get().n,0);
 t.mock.method(Date,'now',()=>november.end);
 await Promise.all([settleCompletedSeasons(db,november.end),artifactProfile(db,'u12'),settleCompletedSeasons(db,november.end)]);
 const winners=db.sqlite.prepare('SELECT * FROM season_rewards ORDER BY rank').all();
 assert.deepEqual(winners.map(row=>row.user_id),Array.from({length:10},(_,i)=>'u'+(i+1)));
 assert.deepEqual(winners.map(row=>row.dust),[0,0,0,150,130,110,90,70,50,30]);
 assert.deepEqual(winners.map(row=>row.aquamarine+row.emerald),[1,1,1,0,0,0,0,0,0,0]);
 assert.equal(db.sqlite.prepare("SELECT outcome FROM fr010_runs WHERE id=?").get(winners[0].run_id).outcome,'won');
 const fourth=await artifactProfile(db,'u4');
 assert.equal(fourth.dust,163);assert.equal(fourth.gems.emerald,8);assert.equal(fourth.gems.other,2);
 assert.deepEqual(winners.slice(0,3).map(w=>[w.legendary,w.epic]),[[3,0],[1,2],[0,3]]);
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM season_chests').get().n,9);
 const chestCounts=(await artifactProfile(db,'u2')).counts;
 assert.deepEqual(chestCounts.map(r=>[r.tier,r.count]),[[4,2],[5,1]]);
 const first=await artifactProfile(db,'u1');
 assert.equal(first.chests.length,3);assert(first.chests.every(c=>c.season===november.key&&c.tier===5));
 assert.deepEqual(first.gems,{aquamarine:winners[0].aquamarine,emerald:winners[0].emerald});
 const request={requestId:crypto.randomUUID(),tier:5,count:1,revision:first.revision};
 const opened=await artifactMutation(db,'u1','open',request);
 const retry=await artifactMutation(db,'u1','open',request);
 assert.deepEqual(opened.receipt,retry.receipt);assert.equal(retry.artifacts.chests.length,2);
 assert.deepEqual(retry.receipt.gemsGained,{aquamarine:0,emerald:0});
 await assert.rejects(artifactMutation(db,'u1','open',{...request,requestId:crypto.randomUUID()}),/vault changed/);
 await settleCompletedSeasons(db,december.end);
 assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM season_rewards WHERE season='2026-12'").get().n,1);
 assert.equal((await artifactProfile(db,'u12')).chests.length,3);
 assert.equal((await artifactProfile(db,'u1')).chests.length,2);
});

test('failed settlement rolls back prizes, then a non-winner profile settles all elapsed months',async t=>{
 const {db,run}=seasonFixture(t);run('u1',42);
 db.sqlite.exec("CREATE TRIGGER fail_award BEFORE INSERT ON season_chests BEGIN SELECT RAISE(ABORT,'injected'); END");
 await assert.rejects(settleCompletedSeasons(db,december.end),/injected/);
 for(const table of ['season_settlements','season_rewards','artifact_accounts','season_chests']){
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM '+table).get().n,0);
 }
 db.sqlite.exec('DROP TRIGGER fail_award');
 t.mock.method(Date,'now',()=>december.end);
 await artifactProfile(db,'u12');
 const closed=db.sqlite.prepare('SELECT season FROM season_settlements ORDER BY season').all();
 assert.deepEqual(closed.map(r=>r.season),['2026-11','2026-12']);
 assert.equal((await artifactProfile(db,'u1')).chests.length,3);
});
