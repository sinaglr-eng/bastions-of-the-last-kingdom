import test from 'node:test';
import assert from 'node:assert/strict';
import {sqliteDatabase} from '../backend/sqlite-adapter.js';
import {migrateFr010} from '../backend/migrate-fr010.js';
import {seasonalHall} from '../backend/hall.js';
import {seasonPage} from '../backend/service-page.js';
import {seasonWindow,currentSeason} from '../game/core/seasons.js';

test('monthly tables rank the best exact finish per account across factions at the UTC boundary',async t=>{
 const db=sqliteDatabase();
 t.after(()=>db.sqlite.close());migrateFr010(db);
 const {start,end}=seasonWindow('2026-11');
 assert.equal(currentSeason(end-1),'2026-11');assert.equal(currentSeason(end),'2026-12');
 for(const id of ['a','b','c'])db.sqlite.prepare('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,0,0)').run(id,'<'+id+'>',id+'@example.test');
 const add=(id,user,faction,score,wave,finish)=>db.sqlite.prepare(`INSERT INTO fr010_runs
  (id,user_id,faction_id,ruleset,seed,outcome,snapshot_json,loadout_json,score_text,score_digits,highest_wave,started_at,updated_at,finished_at)
  VALUES(?,?,?,'fr010-v1',1,'lost','{}','{}',?,?,?,0,?,?)`).run(id,user,faction,score,score.length,wave,finish,finish);
 add('1','a','forge','999999999999999999',20,start);
 add('2','a','grove','1000000000000000000',30,end-1);
 add('3','b','crown','1000000000000000000',31,end-1);
 add('4','c','forge','99999999999999999999999',2,end);
 const nov=await seasonalHall(db,{user:'a',now:end-1});
 assert.deepEqual(nov.top.map(r=>[r.id,r.rank]),[['3',1],['2',2]]);
 assert.equal(nov.total,2);assert.equal(nov.own.factionId,'grove');assert.equal(nov.gap,'0');
 assert.match(seasonPage(nov),/&lt;a&gt;/);assert.match(seasonPage(nov),/December|Dec/);
 const dec=await seasonalHall(db,{now:end});
 assert.deepEqual(dec.top.map(r=>r.id),['4']);assert.equal(dec.season.key,'2026-12');
 const old=await seasonalHall(db,{now:end,season:'2026-11'});
 assert.deepEqual(old.top,nov.top);
 await assert.rejects(seasonalHall(db,{now:end,season:'2027-01'}),{status:400});
});
