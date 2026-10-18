import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignEnemies,campaignRecipes,campaignWaves} from '../game/core/campaign-roster.js';
import {towerStats,combatTowerStats,damageAfterDefense} from '../game/core/math.js';
import {mvpLevel,mvpArmorReduction,mvpAllyDamageBonus} from '../game/core/mvp.js';
const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),enemies:campaignEnemies(raw.enemies),recipes:campaignRecipes(raw.recipes),waves:campaignWaves(raw.waves)};
const fresh=()=>new Game(data,{seed:5});
function arena(){const g=fresh();g.phase='combat';g.combat.start(g.wave);g.combat.spawnQueue=[{time:1e9,type:'host_01',modifiers:{}}];return g;}
function unit(g,family='soldier',extra={}){const t={id:g.nextId++,family,tier:1,state:'active',x:12,z:12,kills:0,cooldown:1e9,priority:'first',mvpLevel:0,...extra};g.towers.push(t);return t;}
function foe(g,extra={}){const e=g.combat.spawn('host_01',{variant:{hp:1000,armor:0,speed:0,...extra}});e.x=12;e.z=13;return e;}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('wave award uses actual lost HP, excludes overkill and blocked hits, emits once before wave-complete and resets next combat',()=>{
  const g=arena(),a=unit(g),b=unit(g),events=[];g.on((type,payload)=>{if(['mvp-awarded','wave-complete'].includes(type))events.push({type,payload,phase:g.phase});});
  g.combat.damage(foe(g,{hp:10}),1000,'physical',{directHit:true},a);
  g.combat.damage(foe(g,{hp:100}),20,'physical',{directHit:true},b);
  g.combat.damage(foe(g,{physicalImmune:true}),100000,'physical',{directHit:true},a);
  assert.equal(g.mvp.damageFor(a),10);assert.equal(g.mvp.damageFor(b),20);g.completeWave();
  assert.equal(a.mvpLevel,0);assert.equal(b.mvpLevel,1);assert.deepEqual(events.map(e=>e.type),['mvp-awarded','wave-complete']);
  assert.equal(events[0].payload.damage,20);assert.equal(events[0].payload.tower,b);assert.equal(events[0].phase,'combat');g.completeWave();assert.equal(events.length,2);
  g.phase='ready';g.startCombat();assert.equal(g.mvp.damageFor(a),0);assert.equal(g.mvp.damageFor(b),0);
});

test('winner ties prefer existing MVP then earlier build; level10 is skipped and zero damage awards nobody',()=>{
  const g=arena(),early=unit(g),late=unit(g,'soldier',{mvpLevel:3});
  const capped=unit(g,'soldier',{mvpLevel:10});
  for(const [t,amount]of [[early,20],[late,20],[capped,900]])g.combat.damage(foe(g),amount,'holy',{},t);
  assert.equal(g.mvp.awardWave().tower,late);assert.equal(late.mvpLevel,4);assert.equal(capped.mvpLevel,10);
  const ties=arena(),first=unit(ties),second=unit(ties);for(const t of [second,first])ties.combat.damage(foe(ties),10,'holy',{},t);assert.equal(ties.mvp.awardWave().tower,first);
  const empty=arena();unit(empty);assert.equal(empty.mvp.awardWave(),null);assert.equal(empty.mvp.awardWave(),null);
});

test('all damage event paths credit actual original owner, including poison/burn/bleed/aura/forks and secondary cleave',()=>{
  const g=arena(),a=unit(g,'druid'),b=unit(g,'phoenix'),target=foe(g,{hp:100000}),near=foe(g,{hp:100000});near.x=13;
  const totals=new Map();g.on((type,e)=>{if(type==='hit')totals.set(e.source,(totals.get(e.source)||0)+e.effectiveDamage);});g.rng=()=>0;
  g.combat.impact({source:a,target,stats:{...towerStats(a,data),bleed:.2,burnDps:10,cleave:.5,cleaveType:'magical',cleaveRadius:2}});
  g.combat.impact({source:b,target,stats:combatTowerStats(b,g.towers,data).stats});g.tick(.2);
  for(const t of [a,b]){assert.ok(totals.get(t)>0);close(g.mvp.damageFor(t),totals.get(t));}
  assert.ok(g.mvp.damageFor(b)>towerStats(b,data).damage,'Actual fire aura/fork damage is included, not just primary damage');
});

test('MVP has no enemy armor effect and stale imported MVP armor fields cannot change any damage class',()=>{
  const g=arena(),a=unit(g,'soldier',{mvpLevel:5}),b=unit(g,'soldier',{mvpLevel:10}),e=foe(g,{armor:100});
  g.combat.applyEffects(e,{type:'physical',shred:30},a);assert.equal(mvpArmorReduction(e,g.towers),0);assert.equal(e.mvpArmorReduction,undefined);
  e.mvpArmorReduction=.9;for(const type of ['physical','magical','holy'])close(damageAfterDefense(100,type,e,{},data.balance),30);
  b.attackPaused=true;g.combat.prepareArmor(e);assert.equal(e.mvpArmorReduction,undefined);
});

test('MVP adds only own 5% per level up to 50%, with no bonus from nearby MAX MVP allies',()=>{
  const g=arena(),source=unit(g,'archer',{mvpLevel:5}),a=unit(g,'soldier',{mvpLevel:10}),b=unit(g,'soldier',{mvpLevel:10});
  assert.equal(mvpAllyDamageBonus(source,[source,a,b]),0);assert.equal(mvpAllyDamageBonus(a,[a]),0);close(combatTowerStats(source,g.towers,data).stats.damage,towerStats(source,data).damage*1.25);
  source.mvpLevel=10;close(combatTowerStats(source,g.towers,data).stats.damage,towerStats(source,data).damage*1.5);
  assert.equal(mvpLevel({mvpLevel:99}),10);assert.equal(mvpLevel({mvpLevel:-1}),0);assert.equal(mvpLevel({mvpLevel:NaN}),0);
});

test('every basic merge and all38 current champion crafts inherit max ingredient MVP, never sum it or delete the selected identity',()=>{
  let merges=0,crafts=0;
  for(const [family,d]of Object.entries(data.towers).filter(([,d])=>!d.advanced))for(let tier=1;tier<6;tier++){
    const g=fresh();g.draft.forced={family,tier};g.draft.roll(0);for(let x=10;x<15;x++)assert.equal(g.place(x,10),true);
    const [a,b]=g.towers;a.mvpLevel=2;b.mvpLevel=7;g.select(a.id);assert.equal(g.merge(),true);assert.equal(a.mvpLevel,7);assert.equal(a.tier,tier+1);assert.equal(b.state,'ruin');merges++;
  }
  for(const recipe of data.recipes.filter(r=>data.towers[r.result?.family||r.result||r.id]?.advanced)){
    const g=fresh();g.economy.xp=data.balance.xpPerLevel*100;let pieces;
    if(recipe.currentRoundOnly){for(let x=10;x<15;x++)g.place(x,10);pieces=g.towers.slice(0,3);recipe.ingredients.forEach((p,i)=>{Object.assign(pieces[i],p);Object.assign(g.draft.draws.find(d=>d.towerId===pieces[i].id),p);});}
    else{g.phase='ready';pieces=recipe.ingredients.map((p,i)=>unit(g,p.family,{tier:p.tier,x:10+i}));for(const t of pieces)assert.equal(g.grid.occupy(t.x,t.z,t.id).ok,true);}
    pieces.forEach((t,i)=>t.mvpLevel=[3,7,4][i]);const anchor=pieces[1];g.select(anchor.id);const id=anchor.id;assert.equal(g.craft(recipe.id),true,recipe.id);assert.equal(anchor.id,id);assert.equal(anchor.mvpLevel,7);assert.equal(anchor.tier,1);assert.equal(pieces.filter(t=>t.state==='active').length,1);crafts++;
  }
  assert.equal(merges,40);assert.equal(crafts,38);
});

test('only successful actual champion crafts earn a run discovery, including already-known and inherited-champion recipes',()=>{
  const inherited=data.recipes.find(r=>!r.currentRoundOnly&&r.ingredients.some(p=>data.towers[p.family]?.advanced));
  const basic=data.recipes.find(r=>!r.currentRoundOnly&&r.ingredients.every(p=>!data.towers[p.family]?.advanced));
  assert.ok(inherited);assert.ok(basic);
  for(const recipe of [basic,inherited])for(let repeat=0;repeat<2;repeat++){
    const family=recipe.result?.family||recipe.result||recipe.id;
    const g=new Game(data,{seed:5,discoveries:[family]});g.economy.xp=data.balance.xpPerLevel*100;g.phase='ready';
    assert.deepEqual([...g.earnedDiscoveries],[],'known history is not an award for this run');
    const arrived=unit(g,family,{x:22,z:20,mvpLevel:10});assert.ok(g.grid.occupy(arrived.x,arrived.z,arrived.id).ok);
    assert.deepEqual([...g.earnedDiscoveries],[],'arriving with a champion or MVP does not earn its recipe');
    assert.equal(g.craft(recipe.id),false);assert.equal(g.earnedDiscoveries.size,0);
    const pieces=recipe.ingredients.map((p,i)=>unit(g,p.family,{tier:p.tier,x:10+i}));
    for(const t of pieces)assert.ok(g.grid.occupy(t.x,t.z,t.id).ok);
    g.select(pieces[0].id);assert.equal(g.previewRecipe(recipe.id),true);assert.equal(g.earnedDiscoveries.size,0);
    let duringDiscover=null;g.on((type)=>{if(type==='discover')duringDiscover=[...g.earnedDiscoveries];});
    assert.equal(g.craft(recipe.id),true,recipe.id);assert.deepEqual([...g.earnedDiscoveries],[family]);
    assert.deepEqual(duringDiscover,[family],'the actual run award is available before persistence listens');
    assert.equal(g.craft(recipe.id),false);assert.deepEqual([...g.earnedDiscoveries],[family]);
  }
});

test('per-tower pause stops new shots/offensive aura, but launched shots, existing DOT and supporting auras continue without RNG or CP changes',()=>{
  const g=arena(),source=unit(g,'phoenix'),ally=unit(g,'archer'),support=unit(g,'archbishop',{mvpLevel:10}),e=foe(g,{hp:100000});
  source.cooldown=0;g.tick(.01);assert.ok(g.combat.projectiles.some(p=>p.source===source));
  const cp=g.commandPoints.value,rng=g.rng;assert.equal(g.setTowerAttackPaused(source.id,true),true);assert.equal(g.setTowerAttackPaused(support.id,true),true);
  const shots=[];g.on((type,event)=>{if(type==='shot'||type==='aura-attack')shots.push(event);});const before=e.hp;
  g.tick(.3);assert.ok(e.hp<before,'Already launched hit remains effective');assert.equal(shots.filter(s=>s.source===source).length,0);
  const hp=e.hp;g.combat.applyEffects(e,{type:'magical',poisonDps:10},source);g.tick(.1);assert.ok(e.hp<hp,'Existing DOT continues');assert.equal(g.commandPoints.value,cp);
  assert.equal(combatTowerStats(ally,g.towers,data).bonuses.haste,6);assert.equal(g.setTowerAttackPaused(999,true),false);assert.equal(g.setTowerAttackPaused(ally.id,'yes'),false);
  // Setting pause itself never asks the combat RNG for a random decision.
  let calls=0;g.rng=()=>{calls++;return .5;};assert.equal(g.setTowerAttackPaused(source.id,false),true);assert.equal(calls,0);g.rng=rng;
});

test('pausing offensive armor/slow auras restores enemy armor/movement and no MVP armor support remains',()=>{
  const g=arena(),bomber=unit(g,'griffinbomber',{mvpLevel:10}),frost=unit(g,'winterhold'),enemy=foe(g,{armor:60,speed:1});enemy.route=[{x:12,z:13},{x:12,z:25}];enemy.pathIndex=1;
  g.tick(.1);assert.equal(enemy.armorShred,35);assert.equal(enemy.mvpArmorReduction,undefined);assert.ok(enemy.currentSpeed<1);
  g.setTowerAttackPaused(bomber.id,true);g.setTowerAttackPaused(frost.id,true);g.tick(.1);assert.equal(enemy.armorShred,0);assert.equal(enemy.mvpArmorReduction,undefined);close(enemy.currentSpeed,1);
  g.setTowerAttackPaused(bomber.id,false);g.setTowerAttackPaused(frost.id,false);g.tick(.1);assert.equal(enemy.armorShred,35);assert.ok(enemy.currentSpeed<1);
});
