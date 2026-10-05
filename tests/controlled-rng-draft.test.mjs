import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CommandPoints} from '../game/core/command-points.js';
import {DraftManager} from '../game/core/draft.js';
import {seededRandom} from '../game/core/math.js';

const data=Object.fromEntries(['balance','towers'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const makeDraft=(rng=seededRandom(42),source=data)=>new DraftManager(source,rng,new CommandPoints(source.balance));
const placedIdentity=(draw,extra={})=>({id:draw.towerId,family:draw.family,tier:draw.tier,kills:0,priority:'first',x:draw.identity?.x??10+draw.index,z:draw.identity?.z??10,state:'draft',round:1,...extra});
function placeAll(draft,startId=1){for(const draw of draft.draws){if(draw.placed)continue;assert.ok(draft.reveal(draw.index));draw.placed=true;draw.towerId=startId+draw.index;}return draft.draws;}
const identities=draft=>draft.draws.map(({family,tier})=>({family,tier}));

test('Command Points starts each run at three, pays configured actions atomically and never becomes negative',()=>{
  const cp=new CommandPoints(data.balance);assert.equal(cp.value,3);
  assert.deepEqual(cp.costs,{reroll:1,reserve:1,move:2});assert.equal(cp.canSpend('unknown'),false);assert.equal(cp.spend('unknown'),false);
  assert.equal(cp.spend('move'),true);assert.equal(cp.value,1);assert.equal(cp.spend('move'),false);assert.equal(cp.value,1);
  assert.equal(cp.spend('reserve'),true);assert.equal(cp.value,0);assert.equal(cp.spend('reroll'),false);assert.equal(cp.value,0);
  assert.equal(new CommandPoints(data.balance).value,3);cp.reset();assert.equal(cp.value,3);
});

test('Command Points amounts use the central balance settings without changing the source configuration',()=>{
  const source=structuredClone(data.balance);Object.assign(source.commandPoints,{starting:8,bossReward:7});Object.assign(source.commandPoints.costs,{reroll:2,reserve:3,move:4});
  const before=JSON.stringify(source),cp=new CommandPoints(source);assert.equal(cp.value,8);
  assert.equal(cp.spend('reroll'),true);assert.equal(cp.value,6);assert.equal(cp.spend('reserve'),true);assert.equal(cp.value,3);
  assert.equal(cp.rewardBoss({id:9,boss:true,dead:true,hp:0}),7);assert.equal(cp.value,10);assert.equal(cp.spend('move'),true);assert.equal(cp.value,6);
  assert.equal(JSON.stringify(source),before);
  for(const mutate of [b=>b.commandPoints.starting=-1,b=>b.commandPoints.bossReward=1.5,b=>b.commandPoints.costs.move=-2,b=>b.commandPoints.maxReserveCount=2,b=>b.commandPoints.maxRerollsPerDraft=2]){
    const invalid=structuredClone(data.balance);mutate(invalid);assert.throws(()=>new CommandPoints(invalid),/Invalid Command Points/);
  }
});

test('Only a killed boss earns five CP exactly once per unique boss, with no reward for leakage or living units',()=>{
  const cp=new CommandPoints(data.balance);
  for(const enemy of [{id:1,boss:true,hp:0,dead:false},{id:1,boss:true,hp:100,dead:true},{id:1,hp:0,dead:true},{id:0,boss:true,hp:0,dead:true},{id:NaN,boss:true,hp:0,dead:true}])assert.equal(cp.rewardBoss(enemy),0);
  assert.equal(cp.value,3);const boss={id:1,boss:true,hp:-1,dead:true};assert.equal(cp.rewardBoss(boss),5);assert.equal(cp.value,8);
  assert.equal(cp.rewardBoss(boss),0);assert.equal(cp.rewardBoss({...boss}),0);assert.equal(cp.value,8);
  assert.equal(cp.rewardBoss({...boss,id:2}),5);assert.equal(cp.value,13);
  cp.reset();assert.equal(cp.value,3);assert.equal(cp.rewardBoss(boss),5);assert.equal(cp.value,8);
});

test('Normal draft retains five hidden placement-first options, cached reveals and the existing weighted generator',()=>{
  let calls=0;const random=seededRandom(3),draft=makeDraft(()=>{calls++;return random();});draft.roll(15);
  assert.equal(draft.draws.length,5);assert.equal(calls,0);assert.ok(draft.draws.every(draw=>draw.origin==='random'&&!draw.family&&!draw.tier&&!draw.placed));
  const draw=draft.reveal(2);assert.equal(calls,2);assert.equal(draft.reveal(2),draw);assert.equal(calls,2);draw.placed=true;assert.equal(draft.reveal(2),null);assert.equal(calls,2);
  assert.equal(draft.canReroll(),false);assert.equal(draft.reroll(),false);assert.equal(draft.commandPoints.value,3);assert.match(draft.rerollReason,/Place all five/);
  assert.equal(draft.reserve(2,placedIdentity({...draw,towerId:3})),false);assert.equal(draft.commandPoints.value,3);
});

test('Reroll pays one CP, regenerates every random candidate with normal probabilities, preserves placements and is once per draft',()=>{
  const draft=makeDraft(),control=makeDraft();draft.roll(15);control.roll(15);placeAll(draft);placeAll(control);
  const before=identities(draft),locations=draft.draws.map(({index,towerId,placed})=>({index,towerId,placed}));
  control.roll(15);placeAll(control);
  assert.equal(draft.canReroll(),true);assert.equal(draft.reroll(),true);assert.equal(draft.commandPoints.value,2);assert.equal(draft.rerollsUsed,1);
  assert.deepEqual(identities(draft),identities(control));assert.notDeepEqual(identities(draft),before);
  assert.deepEqual(draft.draws.map(({index,towerId,placed})=>({index,towerId,placed})),locations);
  const after=JSON.stringify(draft.draws);assert.equal(draft.reroll(),false);assert.equal(JSON.stringify(draft.draws),after);assert.equal(draft.commandPoints.value,2);assert.match(draft.rerollReason,/already used/);
  assert.equal(draft.finalize(1),true);assert.equal(draft.finalSelection,1);assert.deepEqual(draft.finalDefender,{id:draft.draws[1].towerId,family:draft.draws[1].family,tier:draft.draws[1].tier});draft.roll(15);assert.equal(draft.rerollsUsed,0);assert.equal(draft.finalDefender,null);placeAll(draft,6);assert.equal(draft.reroll(),true);assert.equal(draft.commandPoints.value,1);
});

test('Forced development drafts use the same family and tier rules for normal and rerolled candidates',()=>{
  const draft=makeDraft();draft.forced={family:'soldier',tier:3};draft.roll(0);placeAll(draft);draft.forced={family:'mage',tier:1};
  assert.equal(draft.reroll(),true);assert.ok(draft.draws.every(draw=>draw.family==='soldier'&&draw.tier===3));
});

test('A paid Reserve preserves one fixed map identity, blocks a second reserve and finalizes separately from the keeper',()=>{
  const draft=makeDraft();draft.roll(15);placeAll(draft);
  const candidate=placedIdentity(draft.draws[2],{kills:4,priority:'strongest',customStats:{damage:17}}),snapshot=draft.reserve(2,candidate);
  assert.equal(draft.commandPoints.value,2);assert.equal(draft.reserveSelection.index,2);assert.equal(draft.draws[2].reservedForNextDraft,true);
  assert.deepEqual(snapshot,{id:candidate.id,family:candidate.family,tier:candidate.tier,kills:4,priority:'strongest',x:candidate.x,z:candidate.z,customStats:{damage:17}});
  candidate.customStats.damage=99;assert.equal(snapshot.customStats.damage,17);assert.equal(snapshot.x,candidate.x);assert.equal(snapshot.z,candidate.z);assert.equal('state' in snapshot,false);
  assert.equal(draft.reserve(1,placedIdentity(draft.draws[1])),false);assert.equal(draft.commandPoints.value,2);
  assert.equal(draft.finalize(2),false);assert.equal(draft.finalSelection,null);assert.equal(draft.finalize(4),true);assert.equal(draft.finalSelection,4);
  assert.deepEqual(draft.reservedDefender,snapshot);assert.equal(draft.finalize(4),false);
});

test('A paid Reserve blocks later reroll without losing the saved defender or charging again',()=>{
  const draft=makeDraft();draft.roll(15);placeAll(draft);const saved=draft.reserve(1,placedIdentity(draft.draws[1]));
  const before=JSON.stringify(draft.draws);assert.equal(draft.canReroll(),false);assert.match(draft.rerollReason,/Reserve is confirmed/);assert.equal(draft.reroll(),false);
  assert.equal(draft.commandPoints.value,2);assert.equal(JSON.stringify(draft.draws),before);assert.deepEqual(draft.reserveSelection.defender,saved);
});

test('A valid draft ingredient can finalize a crafted result on a retained foundation while preserving the separate Reserve',()=>{
  const draft=makeDraft();draft.roll(15);placeAll(draft,10);const saved=draft.reserve(2,placedIdentity(draft.draws[2]));
  const family=Object.keys(data.towers).find(key=>data.towers[key].advanced),result={id:7,family,tier:1,kills:19,priority:'strongest',upgrades:0,x:18,z:18,state:'active',round:1};
  assert.ok(family);assert.equal(draft.finalize(4,{...result,id:0}),false);assert.equal(draft.finalDefender,null);assert.equal(draft.resolved,false);
  assert.equal(draft.finalize(4,result),true);assert.equal(draft.finalSelection,4);assert.deepEqual(draft.finalDefender,{id:7,family,tier:1,kills:19,priority:'strongest',upgrades:0});assert.notEqual(draft.finalDefender.id,draft.draws[4].towerId);
  assert.deepEqual(draft.reservedDefender,saved);assert.equal(draft.commandPoints.value,2);result.family='missing';assert.equal(draft.finalDefender.family,family);
  draft.roll(0);assert.equal(draft.finalDefender,null);assert.equal(draft.finalSelection,null);assert.deepEqual(draft.draws[0].identity,saved);assert.equal(draft.draws.length,5);
});

test('Next draft keeps the saved identity already placed in fixed Slot 1 and generates only four new hidden options',()=>{
  let calls=0;const random=seededRandom(40),draft=makeDraft(()=>{calls++;return random();});draft.roll(15);placeAll(draft);
  const saved=draft.reserve(3,placedIdentity(draft.draws[3],{kills:9,priority:'last'}));draft.finalize(4);const before=calls;
  draft.roll(0);assert.equal(draft.draws.length,5);assert.equal(calls,before);assert.equal(draft.reservedDefender,null);assert.equal(draft.reserveSelection,null);
  const first=draft.draws[0];assert.equal(first.origin,'reserve');assert.equal(first.protectedFromReroll,true);assert.deepEqual(first.identity,saved);assert.equal(first.family,saved.family);assert.equal(first.tier,saved.tier);
  assert.equal(first.placed,true);assert.equal(first.fixedPosition,true);assert.equal(first.towerId,saved.id);assert.equal(draft.reveal(0),null);assert.equal(calls,before);assert.ok(draft.draws.slice(1).every(draw=>!draw.family&&!draw.tier&&!draw.placed&&!draw.fixedPosition&&draw.origin==='random'));
  placeAll(draft,10);assert.equal(calls,before+8);assert.equal(first.towerId,saved.id);assert.ok(draft.draws.slice(1).every(draw=>draw.tier===1));assert.equal(first.tier,saved.tier);
});

test('Reroll protects the returning Slot 1 identity, regenerates only four random choices, and spends exactly one CP',()=>{
  let calls=0;const random=seededRandom(88),draft=makeDraft(()=>{calls++;return random();});draft.roll(15);placeAll(draft);const saved=draft.reserve(2,placedIdentity(draft.draws[2]));draft.finalize(4);
  draft.roll(15);placeAll(draft,10);const first=structuredClone(draft.draws[0]),before=calls;
  assert.equal(draft.reroll(),true);assert.equal(calls,before+8);assert.equal(draft.commandPoints.value,1);assert.deepEqual(draft.draws[0],first);assert.deepEqual(draft.draws[0].identity,saved);
  assert.equal(draft.draws.length,5);assert.equal(draft.reroll(),false);assert.equal(calls,before+8);
});

test('Carried Reserve is not permanent: ignoring it removes future carry, keeping it is normal, and renewing it costs again',()=>{
  for(const decision of ['ignore','keep','reserve']){
    const draft=makeDraft();draft.roll(0);placeAll(draft);const saved=draft.reserve(2,placedIdentity(draft.draws[2]));draft.finalize(4);draft.roll(0);placeAll(draft,10);
    assert.equal(draft.commandPoints.value,2);
    if(decision==='reserve'){assert.deepEqual(draft.reserve(0,placedIdentity(draft.draws[0])),saved);assert.equal(draft.commandPoints.value,1);draft.finalize(4);}
    else {draft.finalize(decision==='keep'?0:4);assert.equal(draft.commandPoints.value,2);assert.equal(draft.reservedDefender,null);}
    draft.roll(0);assert.equal(draft.draws.length,5);assert.equal(draft.draws[0].origin,decision==='reserve'?'reserve':'random');
    if(decision==='reserve')assert.deepEqual(draft.draws[0].identity,saved);else assert.ok(draft.draws.every(draw=>!draw.family&&!draw.tier));
  }
});

test('A different paid candidate replaces the previous carry and clears its protected state without a sixth slot',()=>{
  const draft=makeDraft();draft.roll(15);placeAll(draft);draft.reserve(2,placedIdentity(draft.draws[2]));draft.finalize(4);draft.roll(15);placeAll(draft,10);
  const previous=draft.draws[0].identity,next=draft.reserve(1,placedIdentity(draft.draws[1]));assert.notEqual(next.id,previous.id);
  assert.equal(draft.draws[0].protectedFromReroll,false);assert.equal(draft.draws[0].reservedForNextDraft,false);assert.equal(draft.commandPoints.value,1);
  assert.equal(draft.finalize(0),true);assert.deepEqual(draft.reservedDefender,next);draft.roll(15);assert.equal(draft.draws.length,5);assert.deepEqual(draft.draws[0].identity,next);
});

test('Zero CP leaves the ordinary draft functional and rejects paid actions without mutation',()=>{
  const draft=makeDraft();draft.commandPoints.spend('move');draft.commandPoints.spend('reserve');draft.roll(0);placeAll(draft);const before=JSON.stringify(draft.draws);
  assert.equal(draft.commandPoints.value,0);assert.equal(draft.canReserve(0),false);assert.equal(draft.reserve(0,placedIdentity(draft.draws[0])),false);assert.equal(draft.reroll(),false);
  assert.equal(JSON.stringify(draft.draws),before);assert.equal(draft.commandPoints.value,0);assert.equal(draft.finalize(0),true);draft.roll(0);assert.equal(draft.draws.length,5);
});

test('Stale or invalid Reserve identity cannot charge CP, and discard/new run clears every carry state',()=>{
  const draft=makeDraft();draft.roll(0);placeAll(draft);
  for(const candidate of [null,placedIdentity(draft.draws[1],{id:999}),placedIdentity(draft.draws[1],{family:'missing'}),placedIdentity(draft.draws[1],{tier:0}),placedIdentity(draft.draws[1],{x:NaN}),placedIdentity(draft.draws[1],{z:1.5}),placedIdentity(draft.draws[1],{x:undefined})])assert.equal(draft.reserve(1,candidate),false);
  assert.equal(draft.commandPoints.value,3);draft.reserve(1,placedIdentity(draft.draws[1]));draft.finalize(4);draft.discardReserve();
  assert.equal(draft.carriedReserve,null);assert.equal(draft.reserveSelection,null);assert.equal(draft.reservedDefender,null);draft.roll(0);assert.ok(draft.draws.every(draw=>!draw.family&&!draw.identity));
  const next=makeDraft();next.roll(0);assert.equal(next.commandPoints.value,3);assert.equal(next.rerollsUsed,0);assert.equal(next.finalSelection,null);assert.equal(next.finalDefender,null);assert.equal(next.reserveSelection,null);assert.equal(next.carriedReserve,null);assert.equal(next.reservedDefender,null);
});
