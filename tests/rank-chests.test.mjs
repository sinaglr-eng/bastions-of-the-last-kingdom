import test from 'node:test';
import assert from 'node:assert/strict';
import {sqliteDatabase} from '../backend/sqlite-adapter.js';
import {migrateFr010} from '../backend/migrate-fr010.js';
import {artifactProfile,artifactMutation} from '../backend/artifact-store.js';
import {MILITARY_RANKS,rankChestReward} from '../game/core/account-progression.js';

test('verified promotions grant all intervening chest rewards once, including after opening and reconnecting',async()=>{
 const db=sqliteDatabase();
 try{
  migrateFr010(db);
  const user='rank-chest-fixture',now=Date.now();
  db.sqlite.prepare('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,?,?,?)').run(user,'Rank fixture','rank-fixture@example.test',1,now,now);
  db.sqlite.prepare('INSERT INTO fr010_profiles(user_id) VALUES(?)').run(user);
  db.sqlite.prepare('INSERT INTO account_progression(user_id,xp_total,migrated) VALUES(?,0,1)').run(user);
  const promote=level=>db.sqlite.prepare('UPDATE account_progression SET xp_total=? WHERE user_id=?').run(MILITARY_RANKS[level-1].xp,user);
  assert.equal((await artifactProfile(db,user)).chests.length,0);
  promote(7);
  const [first,second]=await Promise.all([artifactProfile(db,user),artifactProfile(db,user)]);
  assert.equal(first.chests.length,8);
  assert.deepEqual(first.chests,second.chests);
  assert.ok(first.chests.every(chest=>chest.status==='ready'&&chest.runId===null));
  assert.deepEqual(first.counts.map(row=>({...row})),[{tier:1,status:'ready',count:4},{tier:2,status:'ready',count:4}]);
  const request={tier:2,count:1,requestId:crypto.randomUUID(),revision:first.revision};
  const opened=await artifactMutation(db,user,'open',request);
  assert.equal(opened.artifacts.chests.length,7);
  assert.equal(opened.receipt.chestIds.length,1);
  assert.deepEqual((await artifactMutation(db,user,'open',request)).receipt,opened.receipt);
  promote(15);
  const gained=MILITARY_RANKS.reduce((sum,{level})=>sum+(rankChestReward(level)?.count||0),0);
  const final=await artifactProfile(db,user);
  assert.equal(final.chests.length,gained-1);
  assert.equal(final.chests.filter(chest=>chest.rankLevel===15&&chest.tier===5).length,3);
 }finally{db.sqlite.close();}
});
