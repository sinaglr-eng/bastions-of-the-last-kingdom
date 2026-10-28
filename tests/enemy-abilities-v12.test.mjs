import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {ENEMY_RULES as R,enemyRegenerationPerSecond,enemyNumber} from '../game/core/enemy-rules.js';
import {configuredWarbandInfo,warbandTraitDetails} from '../game/core/warband-info.js';
import {enemyDefenseVisualState,enemyDefenseDescriptions} from '../game/render/enemy-defense-symbols.js';
import {campaignTowers,campaignEnemies,campaignRecipes,campaignWaves} from '../game/core/campaign-roster.js';

const archived=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL('../data/'+key+'.json',import.meta.url)))]));
const data={...archived,towers:campaignTowers(archived.towers),enemies:campaignEnemies(archived.enemies),recipes:campaignRecipes(archived.recipes),waves:campaignWaves(archived.waves)};
const close=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-7,message+`: ${actual} != ${expected}`);
function arena(){const game=new Game(data,{seed:7});game.phase='combat';game.combat.spawnQueue=[{time:999999,type:'host_01'}];return game;}
function stationary(game,type,modifiers={}){const enemy=game.combat.spawn(type,modifiers);enemy.speed=0;return enemy;}

test('current recharge invaders use their configured missing-health fraction at each 4s deadline, including multiple deadlines in a large tick',()=>{
  const before=JSON.stringify(data),types=Object.entries(data.enemies).filter(([,enemy])=>enemy.recharge>0).map(([type])=>type);
  assert.deepEqual(types,['host_32','host_43','host_49']);assert.equal(R.recharge.period,4);
  for(const type of types)for(const hp of [1,2.5]){
    const fraction=type==='host_49'?.25:.5;
    const game=arena(),enemy=stationary(game,type,{hp});enemy.hp=enemy.maxHp*.5;
    assert.equal(enemy.recharge,fraction);assert.equal(enemy.rechargeClock,4);
    game.combat.update(3.999);close(enemy.hp,enemy.maxHp*.5,'No early pulse');
    game.combat.update(.001);close(enemy.hp,enemy.maxHp*(1-.5*(1-fraction)),'The first pulse heals the configured fraction of missing health');
    game.combat.update(8);close(enemy.hp,enemy.maxHp*(1-.5*(1-fraction)**3),'Each pulse recomputes actual missing health');close(enemy.rechargeClock,4,'Large tick retains phase');
    enemy.hp=enemy.maxHp;game.combat.update(4);assert.equal(enemy.hp,enemy.maxHp,'Full health never overflows');
    assert.ok(warbandTraitDetails(enemy).some(row=>row.text.includes(`${fraction*100}% missing health every 4s`)));
  }
  assert.equal(JSON.stringify(data),before);
});

test('wave 49 restores 25% of missing HP: a 100 HP guardian at 20 HP reaches 40 HP after four seconds',()=>{
  const game=arena(),enemy=stationary(game,'host_49');enemy.maxHp=100;enemy.hp=20;
  game.rng=()=>{throw Error('Recharge must not consume RNG');};
  game.combat.update(3.999);assert.equal(enemy.hp,20);game.combat.update(.001);assert.equal(enemy.hp,40);
  game.combat.update(4);assert.equal(enemy.hp,55,'The second pulse uses the remaining 60 missing HP');
  assert.equal(enemy.rechargeClock,4);assert.equal(data.enemies.host_32.recharge,.5);assert.equal(data.enemies.host_43.recharge,.5);
});

test('wave 49 healing block suppresses scheduled pulses without banking them, and its numerical guides show 25%',()=>{
  const game=arena(),enemy=stationary(game,'host_49');enemy.maxHp=100;enemy.hp=20;
  game.combat.applyEffects(enemy,{healingBlockDuration:5});game.combat.update(13);
  assert.equal(enemy.hp,55,'Only the ordinary eight- and twelve-second deadlines heal');assert.equal(enemy.rechargeClock,3);
  game.combat.update(3);assert.equal(enemy.hp,66.25,'The next pulse remains on the sixteen-second deadline');
  assert.match(configuredWarbandInfo(data.enemies.host_49,{hp:2}).traits.find(text=>text.startsWith('Restores ')),/^Restores 25% missing health every 4s/);
  assert.match(enemyDefenseDescriptions(enemy).find(row=>row.kind==='recharge').detail,/25% missing HP every 4s/);
  assert.equal(archived.enemies.host_49.recharge,.12,'Original authoring definitions remain verbatim');
});

test('the wave 49 reduction also reaches its recharge variants without changing other waves or non-healing variants',()=>{
  const source=structuredClone(archived.enemies),before=JSON.stringify(source);
  source.host_49.variants=[{name:'Guardian variant',recharge:.12},{name:'Non-healing guardian variant',recharge:0}];
  const variantSource=JSON.stringify(source),current=campaignEnemies(source);
  assert.deepEqual(current.host_49.variants.map(row=>row.recharge),[.25,0]);
  for(const [id,definition]of Object.entries(data.enemies))if(id!=='host_49')assert.deepEqual(current[id],definition,`Unrelated wave preserved: ${id}`);
  assert.equal(JSON.stringify(source),variantSource,'Campaign adaptation leaves original variant data intact');
  assert.notEqual(variantSource,before,'This test added isolated variant fixtures only');
});

test('regeneration heals only the eligible part of a tick after a healing block expires, using actual maxHp rather than currentHp',()=>{
  const game=arena(),enemy=stationary(game,'host_15',{hp:3,variant:data.enemies.host_15.variants[1]});enemy.hp=enemy.maxHp*.2;
  game.combat.applyEffects(enemy,{healingBlockDuration:1.25});game.combat.update(2);
  close(enemy.hp,enemy.maxHp*(.2+.2*.75),'The first1.25s stays blocked');assert.equal(enemy.statuses.healBlock,undefined);
  assert.equal(enemyRegenerationPerSecond(enemy),enemy.maxHp*.2);
  const state=enemyDefenseVisualState(enemy).find(row=>row.kind==='regen');assert.equal(state.perSecond,enemy.maxHp*.2);assert.equal(state.fraction,.2);
  game.combat.update(200);assert.equal(enemy.hp,enemy.maxHp,'Fractional regeneration remains capped for a large dt');
});

test('recharge checks healing-block expiry at each actual deadline and never banks blocked pulses',()=>{
  for(const block of [4,4.0001,5,9]){
    const game=arena(),enemy=stationary(game,'host_32');enemy.hp=enemy.maxHp*.5;game.combat.applyEffects(enemy,{healingBlockDuration:block});
    game.combat.update(13);const eligible=[4,8,12].filter(deadline=>deadline>=block).length;
    close(enemy.hp,enemy.maxHp*(1-.5*.5**eligible),'Only deadlines after block expiry heal');close(enemy.rechargeClock,3,'Blocked pulses still advance the clock');
    assert.equal(enemy.statuses.healBlock,undefined);game.combat.update(3);close(enemy.hp,enemy.maxHp*(1-.5*.5**(eligible+1)),'The next ordinary deadline recovers');
  }
});

test('combined fractional regeneration and missing-health pulses agree between large and small time steps across a partial healing block',()=>{
  // An isolated mechanics combination proves pulse order without changing any
  // authored definition: regeneration before a pulse reduces its missing HP.
  const run=step=>{
    const game=arena(),enemy=stationary(game,'host_32',{hp:2});enemy.regen=.01;enemy.hp=enemy.maxHp*.1;game.combat.applyEffects(enemy,{healingBlockDuration:6});
    for(let remaining=16;remaining>1e-10;){const dt=Math.min(step,remaining);game.combat.update(dt);remaining-=dt;}
    return {hp:enemy.hp,maxHp:enemy.maxHp,clock:enemy.rechargeClock};
  };
  const large=run(16),small=run(.02);close(large.hp,small.hp,'No pulse is lost or granted retroactively');close(large.clock,small.clock,'The same 4s clock survives substeps');
  close(large.hp/large.maxHp,.92,'Analytical order: .12 before pulse at8s, .60 at12s, .84 at16s');
});

test('reactive armor adds 8 per direct hit up to 15 stacks and mitigates all three damage classes with preserved decay',()=>{
  assert.equal(R.reactive.maxStacks,15);assert.equal(R.reactive.decayPerSecond,.7);
  for(const type of ['host_24','host_28'])for(const damageType of ['physical','magical','holy']){
    const game=arena(),enemy=stationary(game,type,{variant:data.enemies[type].variants?.[0]});assert.equal(enemy.reactiveArmor,8);
    for(let hit=1;hit<=30;hit++){const armor=enemy.armor+Math.min(15,hit-1)*8;close(game.combat.damage(enemy,1,damageType,{directHit:true}),30/(30+armor),'Actual mitigation before the new stack');assert.equal(enemy.reactiveStacks,Math.min(15,hit));}
    const expected=40*data.balance.armorConstant/(data.balance.armorConstant+enemy.armor+120);
    close(game.combat.damage(enemy,40,damageType,{directHit:true}),expected,'Measured mitigation includes exactly120 extra armor');assert.equal(enemy.reactiveStacks,15);
    close(game.combat.damage(enemy,40,damageType,{}),expected,'Indirect damage obeys armor too');assert.equal(enemy.reactiveStacks,15,'Indirect damage adds no stack');
    game.combat.update(1);close(enemy.reactiveStacks,14.3,'One second removes0.7 stacks');game.combat.update(100);assert.equal(enemy.reactiveStacks,0,'Decay has a zero floor');
  }
  const game=arena(),moon=stationary(game,'host_28',{variant:data.enemies.host_28.variants[1]});assert.equal(moon.reactiveArmor,0);assert.equal(moon.stealth,true);game.combat.damage(moon,1,'holy',{directHit:true});assert.equal(moon.reactiveStacks,0,'Cloaked variant never acquires the other variant’s ability');
});

test('every authored thief steals exactly 50 gold once on reaching the keep, with a zero floor and no theft on a kill',()=>{
  const types=Object.entries(data.enemies).filter(([,enemy])=>enemy.thief>0).map(([type])=>type);assert.deepEqual(types,['host_16','host_34','host_48']);
  for(const type of types){
    const game=arena();game.economy.gold=70;const enemy=stationary(game,type);assert.equal(enemy.thief,50);enemy.pathIndex=enemy.route.length;game.combat.update(0);
    assert.equal(game.economy.gold,20);assert.equal(game.leaks,1);game.combat.update(1);assert.equal(game.economy.gold,20,'Dead leaked actor cannot steal again');
    const second=stationary(game,type);second.pathIndex=second.route.length;game.combat.update(0);assert.equal(game.economy.gold,0,'Theft never creates negative gold');
    const killed=stationary(game,type),gold=game.economy.gold;game.combat.damage(killed,Number.MAX_SAFE_INTEGER,'holy',{});assert.equal(killed.dead,true);game.combat.update(0);assert.equal(game.economy.gold,gold,'A defeated thief never reaches the keep');
  }
});

test('each actual blood-rush warband uses its configured multiplier during its 2s window and returns to base speed before the 6s repeat',()=>{
  const types=Object.entries(data.enemies).filter(([,enemy])=>enemy.rush>0).map(([type])=>type);assert.deepEqual(types,['host_19','host_42','host_47']);
  const multipliers={host_19:5,host_42:2,host_47:5};
  assert.deepEqual([R.rush.duration,R.rush.period],[2,6]);
  for(const type of types){
    const multiplier=multipliers[type],game=arena(),enemy=game.combat.spawn(type);assert.equal(enemy.rush,multiplier);game.combat.update(1);close(enemy.traveled,enemy.speed*multiplier,'Active rush uses the actual warband multiplier');
    const previous=enemy.traveled;game.combat.elapsed=2;game.combat.update(1);close(enemy.traveled-previous,enemy.speed,'Between windows uses unchanged movement stat');
    const next=enemy.traveled;game.combat.elapsed=6;game.combat.update(.1);close(enemy.traveled-next,enemy.speed*.1*multiplier,'Next period restores the configured multiplier');
  }
});

test('configured and live numerical guide details use modified maximum health and match every strengthened ability',()=>{
  const info=configuredWarbandInfo(data.enemies.host_08,{hp:3});assert.ok(info.traits.some(text=>text.includes('20% maximum health/s (153.6 HP/s)')));
  const enemy={...data.enemies.host_08,maxHp:768,hp:20},description=enemyDefenseDescriptions(enemy).find(row=>row.kind==='regen');assert.ok(description.detail.includes('153.6 HP/s'),'Missing current health never changes regeneration rate');
  assert.ok(enemyDefenseDescriptions(data.enemies.host_32).find(row=>row.kind==='recharge').detail.includes('50% missing HP every 4s'));
  const reactive=warbandTraitDetails(data.enemies.host_24).find(row=>row.kind==='reactive');assert.ok(reactive.text.includes('+8 armor')&&reactive.text.includes('15 stacks (120 armor)'));
  assert.ok(warbandTraitDetails(data.enemies.host_16).some(row=>row.text==='Steals 50 gold on reaching the keep'));
  assert.ok(warbandTraitDetails(data.enemies.host_19).some(row=>row.text.includes('×5 speed for 2s every 6s')));
  for(const type of ['host_08','host_15','host_21'])assert.ok(warbandTraitDetails(data.enemies[type]).some(row=>row.text.includes(enemyNumber(data.enemies[type].hp*.2)+' HP/s')));
  assert.equal(archived.enemies.host_32.recharge,.12);assert.equal(archived.enemies.host_08.regen,.05,'historical definitions remain intact');
});
