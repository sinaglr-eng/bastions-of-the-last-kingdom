import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../game/core/game.js';
import {RunStatistics} from '../game/core/run-statistics.js';
import {currentFactionData} from '../game/core/current-data.js';
import {serializeRun} from '../game/core/run-state.js';
import {restoreVerifiedRun} from '../backend/verified-run-state.js';

const data=currentFactionData('crown');
const verifiedRecord=g=>({faction_id:g.factionId,ruleset:g.data.rulesetRevision,loadout_json:JSON.stringify(g.general.loadout),snapshot_json:JSON.stringify(serializeRun(g))});

test('verified saved state binds the frozen loadout and refuses a changed maximum health',()=>{
 const g=new Game(data,{seed:42,loadout:{'war-horn':1}}),record=verifiedRecord(g);
 assert.equal(restoreVerifiedRun(data,record).general.level('war-horn'),1);
 assert.throws(()=>restoreVerifiedRun(data,{...record,loadout_json:JSON.stringify({'war-horn':3})}),/frozen Commander loadout/);
 const bad=serializeRun(g),root=bad.graph.nodes[bad.graph.root.r].value,fields=bad.graph.nodes[root.game.r].value;fields.maxLives=45;fields.lives=45;
 assert.throws(()=>restoreVerifiedRun(data,{...record,snapshot_json:JSON.stringify(bad)}),/keep health/);
});

test('Fortified Keep verified health is derived from the frozen rank, not a universal cap of 45',()=>{
 for(let level=1;level<=3;level++){
  const g=new Game(data,{seed:42,loadout:{'fortified-keep':level}}),maximum=30+level*5;
  assert.equal(g.lives,maximum);assert.equal(g.maxLives,maximum);
  const record=verifiedRecord(g),restored=restoreVerifiedRun(data,record);assert.equal(restored.maxLives,maximum);assert.equal(restored.lives,maximum);
  const invalid=serializeRun(g),root=invalid.graph.nodes[invalid.graph.root.r].value,fields=invalid.graph.nodes[root.game.r].value;fields.lives=maximum+1;
  assert.throws(()=>restoreVerifiedRun(data,{...record,snapshot_json:JSON.stringify(invalid)}),/keep health/);
 }
});

test('Commander finishing damage and kills never inherit the previous tower source in statistics',()=>{
 const g=new Game(data,{seed:42}),stats=new RunStatistics(g),tower={id:1,family:'soldier',tier:1,x:18,z:18,state:'active'};g.towers.push(tower);g.phase='combat';g.emit('wave');
 const enemy={id:99,type:'host_01',hp:10,maxHp:25,boss:false};g.emit('spawn',{enemy});
 g.emit('hit',{source:tower,enemy,effectiveDamage:10});
 g.emit('hit',{source:{kind:'commander',skill:'decisive-strike'},commanderSkill:'decisive-strike',enemy,effectiveDamage:15});
 g.emit('death',{enemy});g.emit('general-strike',{targets:[{enemy,visible:false}]});
 const s=stats.snapshot(),w=s.waves[0];assert.equal(w.towers[0].damage,10);assert.equal(w.towers[0].hits,1);assert.equal(w.towers[0].kills,0);
 assert.deepEqual(w.commander,{damage:15,hits:1,kills:1,bossKills:0,activations:1});assert.equal(w.kills,1);assert.equal(s.commander.actions[0].skill,'decisive-strike');assert.equal(s.commander.actions[0].targets[0].visible,false);stats.dispose();
});

test('promotion statistics preserve birth ranks and record all five placed draw identities',()=>{
 const g=new Game(data,{seed:42}),stats=new RunStatistics(g);for(const[x,z]of[[18,18],[17,18],[19,18],[18,17],[18,19]])assert.equal(g.place(x,z),true);
 const upgrades=g.roundCandidates.map(({tower})=>{const from=tower.tier;tower.tier++;return{tower,towerId:tower.id,from,to:tower.tier,x:tower.x,z:tower.z};});
 g.emit('general-promoted',{upgrades,cost:3});const s=stats.snapshot(),a=s.commander.actions[0];
 assert.equal(a.phase,'select');assert.equal(a.cost,3);assert.equal(a.drawIds.length,5);assert.equal(a.upgrades.length,5);assert.ok(a.upgrades.every(u=>u.from===1&&u.to===2));assert.ok(s.draws.every(d=>d.tier===1));
 s.commander.loadout['war-horn']=3;assert.deepEqual(stats.snapshot().commander.loadout,{});stats.dispose();
});

test('a promoted reserve and merged survivor retain the once-per-unit marker across drafts and server restoration',()=>{
 const d=currentFactionData('forge'),g=new Game(d,{seed:42,loadout:{'field-promotion':3,'field-logistics':3}});g.draft.roundForced={family:'dw_shieldguard',tier:1};
 for(const[x,z]of [[18,18],[17,18],[19,18],[18,17],[18,19]])assert.equal(g.place(x,z),true);
 assert.equal(g.activateGeneral('field-promotion'),true);const reserved=g.roundCandidates[0].tower,merged=g.roundCandidates[1].tower;
 g.select(reserved.id);assert.equal(g.reserve(),true);g.select(merged.id);assert.equal(g.merge(),true);assert.equal(merged.tier,3);assert.equal(merged.fieldPromoted,true);
 g.phase='combat';g.completeWave();for(const[x,z]of [[20,18],[21,18],[20,17],[21,17]])assert.equal(g.place(x,z),true);
 assert.equal(g.roundCandidates.find(c=>c.tower.id===reserved.id).tower.fieldPromoted,true);assert.equal(g.activateGeneral('field-promotion'),true);assert.equal(reserved.tier,2);
 assert.equal(g.general.promotionState().preview.find(p=>p.towerId===reserved.id).eligible,false);
 const restored=restoreVerifiedRun(d,verifiedRecord(g));assert.equal(restored.towers.find(t=>t.id===reserved.id).tier,2);assert.equal(restored.towers.find(t=>t.id===reserved.id).fieldPromoted,true);assert.equal(restored.towers.find(t=>t.id===merged.id).fieldPromoted,true);assert.equal(restored.general.remainingUses('field-promotion'),0);
});
