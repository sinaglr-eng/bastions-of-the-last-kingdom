import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../game/core/game.js';
import {currentFactionData} from '../game/core/current-data.js';
import {serializeRun,restoreRun} from '../game/core/run-state.js';
import {replayCommands} from '../game/core/run-journal.js';
import {GENERAL_SKILLS} from '../game/core/general.js';
import {RunStatistics} from '../game/core/run-statistics.js';
import {fr002Impact} from '../game/core/fr002-combat.js';
import {towerStats} from '../game/core/math.js';

const data=currentFactionData('crown');
const positions=[[18,18],[17,18],[19,18],[18,17],[18,19]],nextPositions=[[16,18],[20,18],[18,16],[18,20]];
const same=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));
function recruit(rank=1,level=1){const g=new Game(data,{seed:42,loadout:{'field-promotion':level}});g.draft.forced={family:'archer',tier:rank};g.draft.roll(0);g.commandPoints.value=100;for(const[x,z]of positions)assert.equal(g.place(x,z),true);return g;}
function enemy(g,props={}){return Object.assign(g.combat.spawn('host_01',{}),{x:2,z:2,hp:1000,maxHp:1000,armor:0,physicalImmune:false,magicImmune:false,evasion:0,shields:0,krakenShell:0,statuses:{},boss:false,regen:0,...props});}

test('Commander metadata keeps ten shared skill IDs and the approved costs, caps and fractions',()=>{
 assert.equal(Object.keys(GENERAL_SKILLS).length,10);assert.deepEqual(GENERAL_SKILLS['field-promotion'].values,[1,2,2]);assert.deepEqual(GENERAL_SKILLS['field-promotion'].caps,[5,5,6]);assert.equal(GENERAL_SKILLS['field-promotion'].cost,3);assert.deepEqual(GENERAL_SKILLS['decisive-strike'].values,[.3,.4,.5]);assert.deepEqual(GENERAL_SKILLS['decisive-strike'].bossValues,[.05,.07,.1]);assert.equal(GENERAL_SKILLS['decisive-strike'].cost,0);
});
test('Field Promotion atomically promotes the five current recruits once, charges once and consumes no RNG',()=>{
 const g=recruit(1,2),rng=g.rng.getState(),ids=g.towers.map(t=>t.id);g.towers.push({id:999,family:'soldier',tier:1,state:'active',round:0,x:3,z:3,mvpLevel:4});g.select(999);
 let event;g.on((type,p)=>{if(type==='general-promoted')event=p;});assert.equal(g.general.promotionState().preview.length,5);assert.equal(g.activateGeneral('field-promotion'),true);assert.equal(g.commandPoints.value,97);assert.equal(g.general.remainingUses('field-promotion'),1);assert.equal(g.rng.getState(),rng);assert.equal(g.towers.at(-1).tier,1);assert.deepEqual(event.upgrades.map(x=>x.towerId),ids);
 for(const draw of g.draft.draws){assert.equal(draw.tier,2);assert.equal(draw.rolledTier,1);assert.equal(draw.promotionApplied,true);assert.equal(g.towers.find(t=>t.id===draw.towerId).fieldPromoted,true);}
 assert.equal(g.activateGeneral('field-promotion'),false);assert.equal(g.commandPoints.value,97);
});
test('Field Promotion rejects incomplete/early drafts and all-capped candidates without spending anything',()=>{
 const g=new Game(data,{loadout:{'field-promotion':1}});for(const[x,z]of positions.slice(0,4))g.place(x,z);g.phase='select';g.draft.closedEarly=true;assert.equal(g.activateGeneral('field-promotion'),false);assert.equal(g.commandPoints.value,3);assert.equal(g.general.uses['field-promotion'],0);
 const capped=recruit(5,2),state=capped.general.promotionState();assert.equal(state.preview.length,5);assert.ok(state.preview.every(r=>!r.eligible&&r.from===5&&r.to===5));assert.equal(capped.activateGeneral('field-promotion'),false);assert.equal(capped.commandPoints.value,100);assert.equal(capped.general.uses['field-promotion'],0);
});
test('Only Field Promotion III can directly promote V to VI and does not forge the fresh-merge achievement',()=>{
 for(const level of [1,2]){const g=recruit(5,level);assert.equal(g.activateGeneral('field-promotion'),false);assert.ok(g.towers.every(t=>t.tier===5));}
 const g=recruit(5,3);assert.equal(g.activateGeneral('field-promotion'),true);assert.ok(g.towers.every(t=>t.tier===6));assert.equal(g.progress.mythic,false);assert.equal(g.mergePartner(g.towers[0]),null);
});
test('Promotion-created V cannot bypass the two genuine fresh V rule, while genuine V still merge',()=>{
 const promoted=recruit(4,2);promoted.activateGeneral('field-promotion');assert.ok(promoted.towers.every(t=>t.tier===5));assert.equal(promoted.mergePartner(promoted.towers[0]),null);
 const g=recruit(5,2);for(let i=2;i<5;i++){g.towers[i].tier=4;g.draft.draws[i].tier=4;}g.activateGeneral('field-promotion');g.select(g.towers[0].id);assert.equal(g.mergePartner().id,g.towers[1].id);assert.equal(g.merge(),true);assert.equal(g.selection.tier,6);assert.equal(g.progress.mythic,true);
});
test('Reroll uses new raw ranks plus one draft bonus, never stacks promotions and never spends another use',()=>{
 const g=recruit(1,2);g.activateGeneral('field-promotion');g.draft.roundForced.tier=3;const uses=g.general.uses['field-promotion'];assert.equal(g.reroll(),true);assert.equal(g.general.uses['field-promotion'],uses);assert.ok(g.towers.every(t=>t.tier===4));assert.ok(g.draft.draws.every(d=>d.rolledTier===3&&d.tier===4&&d.promotionApplied));assert.equal(g.commandPoints.value,100-3-g.commandPoints.cost('reroll'));
});
test('Committed reserve copies update atomically; its returned identity cannot be promoted again',()=>{
 const g=recruit(1,2),reserved=g.towers[0];g.select(reserved.id);assert.equal(g.reserve(),true);assert.equal(g.activateGeneral('field-promotion'),true);assert.equal(reserved.tier,2);assert.equal(g.draft.reserveSelection.defender.tier,2);assert.equal(g.draft.reserveSelection.defender.fieldPromoted,true);
 g.select(g.towers[1].id);g.keep();assert.equal(g.draft.reservedDefender.tier,2);g.phase='reward';g.nextRound();assert.equal(g.draft.draws[0].origin,'reserve');assert.equal(reserved.tier,2);
 for(const[x,z]of nextPositions)g.place(x,z);const preview=g.general.promotionState().preview;assert.equal(preview[0].eligible,false);assert.match(preview[0].reason,/Already promoted/);assert.equal(g.activateGeneral('field-promotion'),true);assert.equal(reserved.tier,2);assert.equal(g.general.remainingUses('field-promotion'),0);
});
test('Promotion provenance survives a normal merge even when the unpromoted piece is the anchor',()=>{
 const g=recruit(2,2);g.towers[1].fieldPromoted=true;for(let i=2;i<5;i++){g.towers[i].family='soldier';g.draft.draws[i].family='soldier';}g.select(g.towers[0].id);assert.equal(g.merge(),true);assert.equal(g.selection.fieldPromoted,true);assert.equal(g.selection.tier,3);
});
test('A promoted unresolved draft restores its modifier and rerolls deterministically without another charge',()=>{
 const g=recruit(1,3);g.activateGeneral('field-promotion');const snapshot=serializeRun(g),h=restoreRun(data,JSON.parse(JSON.stringify(snapshot)));same(serializeRun(h),snapshot);const uses=h.general.uses['field-promotion'];assert.equal(h.draft.promotionRankCap,6);assert.equal(g.reroll(),true);assert.equal(h.reroll(),true);same(serializeRun(h),serializeRun(g));assert.equal(h.general.uses['field-promotion'],uses);assert.ok(h.draft.draws.every(d=>d.tier===d.rolledTier+1));
});
test('A returning unpromoted Reserve receives one bonus and remains protected through that draft reroll',()=>{
 const g=recruit(1,2),reserve=g.towers[0];g.select(reserve.id);g.reserve();g.select(g.towers[1].id);g.keep();g.phase='reward';g.nextRound();for(const[x,z]of nextPositions)g.place(x,z);assert.equal(g.activateGeneral('field-promotion'),true);assert.equal(reserve.tier,2);assert.equal(g.draft.draws[0].identity.tier,2);assert.equal(g.reroll(),true);assert.equal(reserve.tier,2);assert.equal(g.draft.draws[0].identity.fieldPromoted,true);assert.equal(g.draft.draws[0].origin,'reserve');
});
test('Fortified Keep changes starting and maximum run health without mutating shared balance or double applying on restore',()=>{
 for(const [rank,cap]of [[1,35],[2,40],[3,45]]){const g=new Game(data,{loadout:{'fortified-keep':rank}});assert.equal(g.lives,cap);assert.equal(g.maxLives,cap);assert.equal(data.balance.startingLives,30);g.lives=cap-3;let h=restoreRun(data,JSON.parse(JSON.stringify(serializeRun(g))));h=restoreRun(data,JSON.parse(JSON.stringify(serializeRun(h))));assert.equal(h.lives,cap-3);assert.equal(h.maxLives,cap);h.recoverLives(100);assert.equal(h.lives,cap);assert.equal(h.recoverLives(1),0);assert.equal(h.lives,cap);}
});
test('Both legacy recovery and faction Keep Recovery use the fortified maximum and never remove health',()=>{
 const g=new Game(data,{loadout:{'fortified-keep':3}});g.phase='combat';g.rng=()=>0;g.lives=44;g.combat.landedProcs({recoverChance:1,recoverLives:5},{});assert.equal(g.lives,45);g.combat.landedProcs({recoverChance:1,recoverLives:1},{});assert.equal(g.lives,45);
 const d=currentFactionData('forge'),f=new Game(d,{loadout:{'fortified-keep':2}}),t={id:1,family:'dw_warcaller',tier:1,x:10,z:10,state:'active',kills:0,mvpLevel:0};f.phase='combat';f.towers.push(t);f.rng=()=>0;f.lives=39;const e=enemy(f,{x:11,z:10,hp:1e9,maxHp:1e9});fr002Impact(f.combat,{source:t,target:e,stats:towerStats(t,d),firstPrimary:true,directTargets:[e],release:{},releaseCount:1});assert.equal(f.lives,40);
});
test('Decisive Strike snapshots current hidden/air enemies, bypasses all mitigation and uses no CP or RNG',()=>{
 const g=new Game(data,{loadout:{'decisive-strike':2,'blood-wrath':3}});g.phase='combat';g.commandPoints.value=0;g.general.active['blood-wrath']=20;
 const a=enemy(g,{armor:1e9,physicalImmune:true,magicImmune:true,evasion:1,shields:99,krakenShell:1e9,flying:true,stealth:true,cloaked:true,healthScaleLog:900,statuses:{freeze:{time:20}}}),b=enemy(g,{boss:true,hp:2000,maxHp:2000});g.combat.spawnQueue=[{time:1,type:'host_01'}];
 const rng=g.rng.getState();let event;g.on((type,p)=>{if(type==='general-strike')event=p;});assert.equal(g.general.prepareStrike(),true);assert.equal(g.activateGeneral('decisive-strike'),true);assert.equal(a.hp,600);assert.equal(b.hp,1860);assert.equal(a.shields,99);assert.equal(g.commandPoints.value,0);assert.equal(g.rng.getState(),rng);assert.equal(g.mvp.damage.size,0);assert.equal(event.targets.length,2);assert.equal(event.targets[0].visible,false);assert.equal(event.targets[0].flying,true);assert.equal(event.source.kind,'commander');assert.equal(g.combat.spawnQueue.length,1);assert.equal(g.activateGeneral('decisive-strike'),false);
});
test('Strike kills use normal rewards exactly once and clear stale tower attribution without MVP or procs',()=>{
 const g=new Game(data,{loadout:{'decisive-strike':3}});g.phase='combat';const tower={id:888,family:'archer',tier:1,state:'active',x:18,z:18,kills:0,mvpLevel:0};g.towers.push(tower);const statistics=new RunStatistics(g,{id:'strike-audit',clock:()=>1});g.emit('wave');
 const e=enemy(g,{boss:true,hp:2,maxHp:1000});g.emit('hit',{enemy:e,source:tower,damage:1,effectiveDamage:1});g.mvp.damage.clear();const before=g.commandPoints.value;let deaths=0;g.on(type=>{if(type==='death')deaths++;});g.activateGeneral('decisive-strike');assert.equal(deaths,1);assert.equal(e.dead,true);assert.equal(g.kills,1);assert.equal(g.commandPoints.value,before+g.commandPoints.config.bossReward);assert.equal(g.mvp.damage.size,0);assert.equal(tower.kills,0);assert.equal(statistics.current.towers[0].kills,0);assert.equal(statistics.current.towers[0].damage,1);g.combat.resolveCommanderDamage(e,500);assert.equal(deaths,1);statistics.dispose();
});
test('Strike is unavailable without live targets and transient preparation is neither saved nor required for replay',()=>{
 const g=new Game(data,{loadout:{'decisive-strike':1}});g.phase='combat';assert.equal(g.activateGeneral('decisive-strike'),false);assert.equal(g.general.remainingUses('decisive-strike'),1);enemy(g);const before=serializeRun(g);assert.equal(g.general.prepareStrike(),true);same(serializeRun(g),before);assert.equal(g.general.cancelStrike(),true);assert.equal(g.activateGeneral('decisive-strike'),true);
 const h=restoreRun(data,JSON.parse(JSON.stringify(serializeRun(g))));assert.equal(h.general.strikePrepared,false);assert.equal(h.general.remainingUses('decisive-strike'),0);h.phase='reward';h.nextRound();assert.equal(h.general.remainingUses('decisive-strike'),0);
});
test('Commander usages survive the campaign-to-Endless checkpoint rather than resetting with a wave',()=>{
 const g=new Game(data,{loadout:{'field-promotion':2,'decisive-strike':1}});g.general.uses['field-promotion']=1;g.phase='combat';enemy(g);g.activateGeneral('decisive-strike');g.round=50;g.completeWave();assert.equal(g.round,51);assert.equal(g.general.remainingUses('decisive-strike'),0);assert.equal(g.general.remainingUses('field-promotion'),1);const h=restoreRun(data,serializeRun(g));assert.equal(h.general.remainingUses('decisive-strike'),0);assert.equal(h.general.remainingUses('field-promotion'),1);
});
test('Promotion, reroll and reserved identities round-trip and reproduce through the existing command journal',()=>{
 const g=new Game(data,{seed:42,loadout:{'field-promotion':3,'field-logistics':3,'fortified-keep':3}}),initial=serializeRun(g);for(const[x,z]of positions)g.place(x,z);g.activateGeneral('field-promotion');g.reroll();g.reserve();g.select(g.roundCandidates[0].tower.id);g.keep();const snapshot=serializeRun(g),restored=restoreRun(data,JSON.parse(JSON.stringify(snapshot)));same(serializeRun(restored),snapshot);
 const replay=restoreRun(data,initial);replayCommands(replay,g.journal);same(serializeRun(replay),snapshot);
});
test('Natural combat Strike activation replays without a journaled preparation command',()=>{
 const g=new Game(data,{seed:17,loadout:{'decisive-strike':1,'fortified-keep':1}}),initial=serializeRun(g);for(const[x,z]of positions)g.place(x,z);g.keep();g.startCombat();g.advanceTicks(60,{record:true});assert.ok(g.general.strikeState().count>0);g.general.prepareStrike();assert.equal(g.activateGeneral('decisive-strike'),true);
 const replay=restoreRun(data,initial);replayCommands(replay,g.journal);same(serializeRun(replay),serializeRun(g));
});
test('Legacy snapshots without max-health/usage fields restore once with derived capacity and preserved current health',()=>{
 const g=new Game(data,{loadout:{'fortified-keep':1}});g.lives=32;const snapshot=serializeRun(g);for(const node of snapshot.graph.nodes)if(node.type==='object'){if(node.value.maxLives!==undefined){delete node.value.maxLives;delete node.value.fortifiedKeepBonus;}if(node.value.uses!==undefined&&node.value.pendingFocus!==undefined){delete node.value.uses;delete node.value.promotedDraft;}}
 const h=restoreRun(data,snapshot);assert.equal(h.maxLives,35);assert.equal(h.lives,32);assert.equal(h.general.strikePrepared,false);
});
test('Terminal wave-50 boss still removes every fortified life',()=>{
 const g=new Game(data,{mode:'campaign',waveLimit:50,loadout:{'fortified-keep':3}});g.round=50;g.phase='combat';g.combat.spawnQueue=[{time:1e9,type:'host_01'}];const e=Object.assign(g.combat.spawn('host_50'),{x:10,z:10,hp:1e9,maxHp:1e9,speed:1,boss:true,route:[{x:10.01,z:10}],pathIndex:0,blink:0,regen:0});g.combat.update(.1);assert.equal(e.escaped,true);assert.equal(g.lives,0);assert.equal(g.phase,'lost');
});
