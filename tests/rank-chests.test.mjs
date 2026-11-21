import test from 'node:test';
import assert from 'node:assert/strict';
import {sqliteDatabase} from '../backend/sqlite-adapter.js';
import {migrateFr010} from '../backend/migrate-fr010.js';
import {artifactProfile,artifactMutation} from '../backend/artifact-store.js';
import {MILITARY_RANKS,promotionChestTier} from '../game/core/account-progression.js';
import {rollArtifactChest} from '../game/core/artifacts.js';

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
  assert.equal(first.chests.length,6);
  assert.deepEqual(first.chests,second.chests);
  assert.ok(first.chests.every(chest=>chest.status==='ready'&&chest.runId===null));
  assert.deepEqual(first.counts.map(row=>({...row})),[{tier:1,status:'ready',count:3},{tier:2,status:'ready',count:3}]);
  const emptySeed=Array.from({length:1000},(_,seed)=>seed).find(seed=>!rollArtifactChest({},2,seed).items.length);
  db.sqlite.prepare('UPDATE rank_chests SET seed=? WHERE user_id=? AND tier=2').run(emptySeed,user);
  const request={tier:2,count:1,requestId:crypto.randomUUID(),revision:first.revision};
  const opened=await artifactMutation(db,user,'open',request);
  assert.equal(opened.artifacts.chests.length,5);
  assert.equal(opened.receipt.chestIds.length,1);
  assert.deepEqual(opened.receipt.items,[]);
  assert.equal(opened.receipt.dustGained,20);
  assert.equal(opened.artifacts.dust,20);
  const retry=await artifactMutation(db,user,'open',request);
  assert.deepEqual(retry.receipt,opened.receipt);
  assert.equal(retry.artifacts.dust,20);
  const existing=crypto.randomUUID();
  db.sqlite.prepare('INSERT INTO rank_chests(id,user_id,rank_level,ordinal,tier,seed,earned_at) VALUES(?,?,4,2,1,7,?)').run(existing,user,now);
  promote(15);
  const final=await artifactProfile(db,user);
  assert.equal(final.chests.length,14); // One opened and one retained from the previous schedule.
  assert.ok(final.chests.some(chest=>chest.id===existing));
  const granted=db.sqlite.prepare('SELECT rank_level AS level,tier FROM rank_chests WHERE user_id=? AND ordinal=1 ORDER BY rank_level').all(user);
  assert.deepEqual(granted.map(row=>row.level),MILITARY_RANKS.slice(1).map(rank=>rank.level));
  assert.deepEqual(granted.map(row=>row.tier),[1,1,1,2,2,2,2,3,3,3,4,4,4,5]);
  assert.ok(granted.every(row=>row.tier===promotionChestTier(row.level)));
 }finally{db.sqlite.close();}
});
