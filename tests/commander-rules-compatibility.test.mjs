import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../game/core/game.js';
import {currentFactionData} from '../game/core/current-data.js';
import {serializeRun,restoreRun} from '../game/core/run-state.js';
import {replayCommands} from '../game/core/run-journal.js';

const data=currentFactionData('crown'),positions=[[18,18],[17,18],[19,18],[18,17],[18,19]];
function completeDraft(){const g=new Game(data,{seed:83,loadout:{'field-promotion':3}});g.draft.forced={family:'archer',tier:1};g.draft.roll(0);g.commandPoints.value=100;for(const [x,z]of positions)g.place(x,z);return g;}
function markerless(game){const snapshot=JSON.parse(JSON.stringify(serializeRun(game))),root=snapshot.graph.nodes[snapshot.graph.root.r].value,general=snapshot.graph.nodes[root.general.r].value;delete snapshot.commanderRulesVersion;delete general.commanderRulesVersion;delete general.waveRange;return snapshot;}
const command=(action,...args)=>({action,args});

test('New games reject untargeted promotion and cannot switch back to earlier rules',()=>{
 const g=completeDraft(),initial=serializeRun(g);assert.equal(g.general.commanderRulesVersion,3);assert.equal(initial.commanderRulesVersion,3);
 replayCommands(g,[command('activateGeneral','field-promotion'),command('adoptCommanderRules',2),command('adoptCommanderRules',1)]);assert.ok(g.towers.every(tower=>tower.tier===1));assert.equal(g.commandPoints.value,100);assert.equal(g.general.uses['field-promotion'],0);assert.equal(g.general.commanderRulesVersion,3);assert.equal(g.general.legacyCommanderReplay,false);
 const replay=restoreRun(data,initial);assert.equal(replay.activateGeneral('field-promotion'),false);assert.equal(replay.adoptCommanderRules(1),false);
});

test('only replay of a markerless server checkpoint preserves queued global promotion and raw-reroll bonus',()=>{
 const g=restoreRun(data,markerless(completeDraft()));assert.equal(g.general.commanderRulesVersion,1);assert.equal(g.activateGeneral('field-promotion'),false,'A live public action never gets the legacy global behavior');
 const rng=g.rng.getState();replayCommands(g,[command('activateGeneral','field-promotion')]);assert.ok(g.towers.every(tower=>tower.tier===2&&tower.fieldPromoted));assert.equal(g.commandPoints.value,97);assert.equal(g.general.uses['field-promotion'],1);assert.equal(g.draft.promotionRankCap,6);assert.equal(g.general.legacyCommanderReplay,false);
 const snapshot=serializeRun(g),resumed=restoreRun(data,JSON.parse(JSON.stringify(snapshot)));assert.equal(snapshot.commanderRulesVersion,1);assert.deepEqual(serializeRun(resumed),snapshot);
 replayCommands(g,[command('reroll')]);replayCommands(resumed,[command('reroll')]);assert.ok(g.towers.every(tower=>tower.tier===2&&tower.fieldPromoted));assert.ok(g.draft.draws.every(draw=>draw.rolledTier===1&&draw.promotionApplied));assert.equal(g.general.uses['field-promotion'],1);assert.equal(g.commandPoints.value,97-g.commandPoints.cost('reroll'));assert.equal(g.rng.getState(),rng);assert.deepEqual(serializeRun(resumed),serializeRun(g));
});

test('a primitive adoption after an old immutable prefix switches all later commands to selected-only promotion',()=>{
 const old=restoreRun(data,markerless(completeDraft())),target=old.towers[0],commands=[command('activateGeneral','field-promotion'),command('adoptCommanderRules',2),command('reroll'),command('activateGeneral','field-promotion'),command('select',target.id),command('activateGeneral','field-promotion',target.id)];
 const split=restoreRun(data,markerless(completeDraft()));replayCommands(old,commands);replayCommands(split,commands.slice(0,1));const resumed=restoreRun(data,JSON.parse(JSON.stringify(serializeRun(split))));replayCommands(resumed,commands.slice(1));
 assert.equal(old.general.commanderRulesVersion,2);assert.equal(old.draft.promotionRankCap,undefined);assert.equal(old.general.promotedDraft,undefined);assert.equal(old.general.uses['field-promotion'],2);assert.equal(old.towers.filter(tower=>tower.tier===2).length,1);assert.equal(old.towers.find(tower=>tower.id===target.id).tier,2);assert.equal(old.commandPoints.value,100-6-old.commandPoints.cost('reroll'));assert.deepEqual(serializeRun(resumed),serializeRun(old));
 assert.equal(old.adoptCommanderRules(1),false);assert.equal(old.general.commanderRulesVersion,2);
});

test('adoption is journaled, preserves committed legacy ranks, never refunds usage, and replay scope cannot leak on errors',()=>{
 const g=restoreRun(data,markerless(completeDraft()));replayCommands(g,[command('activateGeneral','field-promotion')]);g.journal=[];const before=g.towers.map(tower=>tower.tier),cp=g.commandPoints.value;assert.equal(g.adoptCommanderRules(2),true);assert.deepEqual(g.journal,[command('adoptCommanderRules',2)]);assert.deepEqual(g.towers.map(tower=>tower.tier),before);assert.equal(g.commandPoints.value,cp);assert.equal(g.general.uses['field-promotion'],1);
 assert.throws(()=>replayCommands(g,[command('activateGeneral','field-promotion',{})]));assert.equal(g.general.legacyCommanderReplay,false);assert.equal(g.activateGeneral('field-promotion'),false);assert.equal(serializeRun(g).commanderRulesVersion,2);
 for(const version of [0,4,'2',null]){const h=restoreRun(data,markerless(completeDraft()));assert.equal(h.adoptCommanderRules(version),false);assert.equal(h.general.commanderRulesVersion,1);}
});

test('Pending v2 promotions keep their original costs before v3 adoption, even across a reroll',()=>{
 const initial=completeDraft();initial.general.commanderRulesVersion=2;
 const g=restoreRun(data,serializeRun(initial)),[first,second,third]=g.towers;
 replayCommands(g,[
  command('select',first.id),command('activateGeneral','field-promotion',first.id),
  command('select',second.id),command('activateGeneral','field-promotion',second.id),
  command('reroll'),
 ]);
 assert.equal(g.general.uses['field-promotion'],2);
 const resumed=restoreRun(data,serializeRun(g)),cp=resumed.commandPoints.value;
 replayCommands(resumed,[command('adoptCommanderRules',3),command('select',third.id),command('activateGeneral','field-promotion',third.id)]);
 assert.equal(resumed.general.commanderRulesVersion,3);
 assert.equal(resumed.general.uses['field-promotion'],1);
 assert.equal(resumed.commandPoints.value,cp);
 assert.ok(resumed.towers.every(tower=>tower.tier===1));
});
