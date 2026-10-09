import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {towerStats,damageAfterDefense} from '../game/core/math.js';
import {campaignTowers,campaignRecipes} from '../game/core/campaign-roster.js';
import {ArmyReadiness} from '../game/core/army-readiness.js';
import {WaveThreatAnalyzer} from '../game/core/wave-threats.js';
import {TowerDpsTracker,effectiveHitDamage} from '../game/core/tower-dps.js';

const archived=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...archived,towers:campaignTowers(archived.towers),recipes:campaignRecipes(archived.recipes)};
const lineage=['wyvernhunter','royalranger','kingsrangerguard','elvenking'];
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);
function arena(family){
  const game=new Game(data,{seed:42});game.phase='combat';game.combat.spawnQueue=[{time:1e9,type:'grunt'}];
  const source={id:game.nextId++,family,tier:1,state:'active',x:10,z:10,kills:0,cooldown:999};game.towers.push(source);
  game.rng=()=>.99;const events=[];game.on((type,payload)=>events.push({type,payload}));return {game,source,events};
}
function foe(game,flying=true,x=11){const enemy=game.combat.spawn('grunt');Object.assign(enemy,{x,z:10,flying,hp:1e7,maxHp:1e7,speed:0,armor:0,resists:{},shields:0});return enemy;}
const defenses={armor:1e6,reactiveArmor:1000,reactiveStacks:5,physicalImmune:true,magicImmune:true,
  resists:{magic:.85,poison:.85,fire:.85},ward:.85,krakenShell:1e6,evasion:1,shields:7,refraction:7};

test('the exact transitive Ranger recipe descendants receive the flying-only live override',()=>{
  const original=JSON.stringify(archived),descendants=new Set(['wyvernhunter']);let changed=true;
  while(changed){changed=false;for(const recipe of data.recipes)if(recipe.ingredients.some(ingredient=>descendants.has(ingredient.family))&&!descendants.has(recipe.resultFamily||recipe.id)){
    descendants.add(recipe.resultFamily||recipe.id);changed=true;
  }}
  assert.deepEqual([...descendants],lineage);
  assert.deepEqual(Object.keys(data.towers).filter(family=>data.towers[family].antiAirBypassesDefenses),[...lineage].sort((a,b)=>Object.keys(data.towers).indexOf(a)-Object.keys(data.towers).indexOf(b)));
  for(const family of descendants)assert.equal(towerStats({family,tier:1},data).antiAirBypassesDefenses,true);
  for(let tier=1;tier<=6;tier++)assert.equal(towerStats({family:'archer',tier},data).antiAirBypassesDefenses,undefined);
  assert.equal(JSON.stringify(archived),original,'approved historical source definitions remain unchanged');
});

for(const family of lineage)test(`${family} damages a flying target through every defense, with no shield consumption`,()=>{
  const {game,source,events}=arena(family),enemy=foe(game);Object.assign(enemy,structuredClone(defenses));
  const stats=towerStats(source,data),hp=enemy.hp;let rolls=0;game.rng=()=>{rolls++;return .99;};
  game.combat.impact({source,target:enemy,stats});
  close(hp-enemy.hp,stats.damage);assert.equal(enemy.shields,7);assert.equal(events.some(event=>event.type==='deflect'),false);
  const direct=events.filter(event=>event.type==='hit');assert.equal(direct.length,1);assert.equal(direct[0].payload.source,source);
  close(effectiveHitDamage(direct[0].payload),stats.damage);
  assert.equal(rolls,family==='elvenking'?2:1,'existing physical evasion and actual landed-proc rolls are preserved');
  assert.equal(damageAfterDefense(100,'physical',enemy,stats,data.balance),100);
  assert.equal(damageAfterDefense(100,'poison',enemy,stats,data.balance),100);
});

test('ground Ranger hits and unrelated flying attackers still respect individual defenses',()=>{
  const cases=[{armor:30},{physicalImmune:true},{magicImmune:true},{resists:{magic:.4,poison:.3}},
    {ward:.2},{reactiveArmor:20,reactiveStacks:2},{krakenShell:1000},{evasion:1},{shields:1}];
  for(const family of lineage)for(const defense of cases){
    const live=arena(family),historicalStats={...towerStats(live.source,data)};delete historicalStats.antiAirBypassesDefenses;
    const actual=foe(live.game,false),control=foe(live.game,false,12);Object.assign(actual,structuredClone(defense));Object.assign(control,structuredClone(defense));
    const stats=towerStats(live.source,data),before=actual.hp;
    const actualDamage=live.game.combat.damage(actual,stats.damage,stats.type,{...stats,directHit:true},live.source);
    const controlDamage=live.game.combat.damage(control,stats.damage,stats.type,{...historicalStats,directHit:true},live.source);
    close(actualDamage,controlDamage);close(actual.hp,control.hp);assert.equal(actual.shields,control.shields);
    if(defense.shields||stats.type==='physical'&&(defense.evasion||defense.physicalImmune)||stats.type==='poison'&&defense.magicImmune)assert.equal(before,actual.hp);
  }
  const {game,source}=arena('archer'),enemy=foe(game);Object.assign(enemy,structuredClone(defenses));
  assert.equal(game.combat.damage(enemy,100,'physical',{...towerStats(source,data),directHit:true},source),0);
});

test('actual wave 35 opposite immunity variants both take the full Ranger lineage hit',()=>{
  for(const family of lineage)for(const variant of data.enemies.host_35.variants){
    const {game,source}=arena(family),enemy=game.combat.spawn('host_35',{variant});Object.assign(enemy,{x:11,z:10,speed:0});
    const before=enemy.hp,stats=towerStats(source,data);assert.equal(enemy.flying,true);
    game.combat.impact({source,target:enemy,stats});close(before-enemy.hp,stats.damage);
  }
});

test('Ranger poison and burning secondary damage retain flying bypass and their true source DPS credit',()=>{
  const {game,source,events}=arena('royalranger'),enemy=foe(game);Object.assign(enemy,structuredClone(defenses));
  const tracker=new TowerDpsTracker();game.on((type,hit)=>{if(type==='hit')tracker.recordHit(hit,game.combat.elapsed);});
  const before=enemy.hp;game.combat.impact({source,target:enemy,stats:towerStats(source,data)});game.tick(.25);
  close(before-enemy.hp,90+48*.25);close(tracker.snapshot(game.towers,game.combat.elapsed)[0].damage,102);
  assert.ok(events.some(event=>event.type==='hit'&&event.payload.type==='poison'&&!event.payload.directHit&&event.payload.source===source));
  const burning=arena('elvenking'),air=foe(burning.game),ground=foe(burning.game,false,11.1);Object.assign(air,structuredClone(defenses));ground.magicImmune=true;
  burning.game.rng=()=>0;burning.game.combat.impact({source:burning.source,target:air,stats:towerStats(burning.source,data)});
  close(1e7-air.hp,2316+2316*20);assert.equal(ground.hp,1e7);
  const fire=burning.events.filter(event=>event.type==='hit'&&event.payload.type==='fire');assert.equal(fire.length,1);assert.equal(fire[0].payload.source,burning.source);
});

function preview(ids,enemy,variants=null){
  const choices=variants||[enemy];return {threats:ids.map(id=>({id,label:id})),enemies:[{type:'fixture',count:1,variants:choices.map(choice=>({enemy:choice,maxHp:choice.hp,armor:choice.armor,flying:choice.flying,threatIds:ids}))}]};
}
test('readiness counts flying bypass without applying shield, shell, evasion or immunity penalties',()=>{
  const ids=['heavyArmor','reactiveArmor','magicResistance','magicImmune','physicalImmune','flying','shield','shell','evasion'];
  const clean={hp:2000,armor:0,flying:true},protectedEnemy={...clean,...structuredClone(defenses),refraction:100};
  const engine=new ArmyReadiness(data),tower={family:'wyvernhunter',tier:1,state:'active'};
  const baseline=engine.evaluate(preview(ids,clean),[tower]),guarded=engine.evaluate(preview(ids,protectedEnemy),[tower]);
  assert.deepEqual(guarded.rows.map(row=>row.ordinal),baseline.rows.map(row=>row.ordinal));assert.ok(guarded.rows.every(row=>row.ordinal===3));
  assert.ok(guarded.rows.every(row=>/Ranger lineage bypasses all damage defenses against flying/.test(row.response)));
  const unrelated=engine.evaluate(preview(ids,protectedEnemy),[{family:'archer',tier:6,state:'active'}]);assert.ok(unrelated.rows.every(row=>row.ordinal===0));
  assert.deepEqual(engine.evaluate(preview(ids,protectedEnemy),[tower,{family:'archer',tier:6,state:'active'}]).rows,guarded.rows,'bypass must not free unrelated allied attacks');
});

test('readiness retains ground immunity limits and honestly covers actual campaign variants',()=>{
  const ids=['physicalImmune'],air={hp:2000,armor:0,flying:true,physicalImmune:true},ground={...air,flying:false};
  const tower={family:'wyvernhunter',tier:1,state:'active'},engine=new ArmyReadiness(data);
  const mixed=engine.evaluate(preview(ids,air,[air,ground]),[tower]);assert.equal(mixed.rows[0].ordinal,0);
  assert.doesNotMatch(mixed.rows[0].response,/Ranger lineage bypasses/);
  const actual=new WaveThreatAnalyzer(data).analyze(34),result=engine.evaluate(actual,[tower]);
  assert.ok(result.rows.some(row=>row.threatId==='magicImmune'&&/Ranger lineage bypasses/.test(row.response)));
  assert.ok(result.rows.some(row=>row.threatId==='physicalImmune'&&/Ranger lineage bypasses/.test(row.response)));
});
