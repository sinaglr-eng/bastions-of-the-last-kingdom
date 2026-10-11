import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {towerStats,damageAfterDefense} from '../game/core/math.js';
import {campaignTowers,campaignRecipes,campaignEnemies} from '../game/core/campaign-roster.js';
import {ArmyReadiness} from '../game/core/army-readiness.js';
import {WaveThreatAnalyzer} from '../game/core/wave-threats.js';
import {TowerDpsTracker,effectiveHitDamage} from '../game/core/tower-dps.js';

const archived=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...archived,towers:campaignTowers(archived.towers),recipes:campaignRecipes(archived.recipes),enemies:campaignEnemies(archived.enemies)};
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

test('the exact four Ranger recipe descendants keep current scoped air debuffs and no defense-bypass override',()=>{
  const original=JSON.stringify(archived),descendants=new Set(['wyvernhunter']);let changed=true;
  while(changed){changed=false;for(const recipe of data.recipes)if(recipe.ingredients.some(i=>descendants.has(i.family))&&!descendants.has(recipe.resultFamily||recipe.id)){descendants.add(recipe.resultFamily||recipe.id);changed=true;}}
  assert.deepEqual([...descendants],lineage);for(const family of lineage){const s=towerStats({family,tier:1},data);assert.equal(s.type,'physical');for(const key of ['antiAirBypassesDefenses','antiAirMagicShred','antiAirPiercesImmunity'])assert.equal(s[key],undefined);}
  assert.deepEqual(lineage.slice(0,3).map(f=>{const s=data.towers[f];return [s.antiAirShred,s.antiAirSlow,s.slowDuration];}),[[20,.4,3],[30,.4,3],[35,.5,3]]);
  assert.equal(JSON.stringify(archived),original);
});

for(const family of lineage)test(family+' respects all normal flying defenses, including evasion, shield, armor and immunity',()=>{
  const cases=[{armor:30},{physicalImmune:true},{krakenShell:1e6},{evasion:1},{shields:2},{reactiveArmor:8,reactiveStacks:10}];
  for(const defense of cases){const {game,source,events}=arena(family),enemy=foe(game);Object.assign(enemy,defense);const hp=enemy.hp,s=towerStats(source,data);let calls=0;game.rng=()=>{calls++;return .99;};
    const actual=game.combat.damage(enemy,s.damage,s.type,{...s,directHit:true},source);
    const expected=defense.physicalImmune||defense.krakenShell||defense.evasion||defense.shields?0:s.damage*30/(30+(defense.armor||0)+(defense.reactiveArmor||0)*(defense.reactiveStacks||0));
    close(actual,expected);close(hp-enemy.hp,actual);assert.equal(enemy.shields,Math.max(0,(defense.shields||0)-1));assert.equal(calls,defense.evasion?1:0);
    assert.equal(events.some(e=>e.type==='hit'),actual>0);
  }
});

test('actual wave35 Physical-immune variants block Rangers while Magical-immune variants allow Physical hits but block poison',()=>{
  for(const family of lineage)for(const variant of data.enemies.host_35.variants){const {game,source}=arena(family),enemy=game.combat.spawn('host_35',{variant});Object.assign(enemy,{x:11,z:10,speed:0});const hp=enemy.hp,s=towerStats(source,data);
    game.combat.impact({source,target:enemy,stats:s});if(enemy.physicalImmune)assert.equal(enemy.hp,hp);else assert.ok(enemy.hp<hp);assert.equal(enemy.statuses.poison,undefined);
    if(enemy.physicalImmune)assert.equal(enemy.statuses.slow,undefined);else assert.equal(enemy.statuses.slow.amount,s.antiAirSlow);
  }
});

test('Ranger armor debuff can contact damage immunity, while slow follows Physical immunity and both stop at shield/evasion',()=>{
  for(const family of lineage.slice(0,3)){const {game,source}=arena(family),s=towerStats(source,data),enemy=foe(game);enemy.physicalImmune=true;
    game.combat.impact({source,target:enemy,stats:s});assert.equal(enemy.statuses.shred.amount,s.antiAirShred);assert.equal(enemy.statuses.shred.time,4);assert.equal(enemy.statuses.slow,undefined);
    const magic=foe(game);magic.magicImmune=true;game.combat.impact({source,target:magic,stats:s});assert.equal(magic.statuses.slow.amount,s.antiAirSlow);assert.equal(magic.statuses.slow.time,3);
    for(const defense of [{shields:1},{evasion:1}]){const blocked=foe(game);Object.assign(blocked,defense);game.combat.impact({source,target:blocked,stats:s});assert.equal(blocked.statuses.shred,undefined);assert.equal(blocked.statuses.slow,undefined);}
  }
});

test('Master Ranger poison and Oathbreaker fire use Magical armor/immunity, keep their actual source and positive proc events',()=>{
  const {game,source,events}=arena('royalranger'),enemy=foe(game);enemy.armor=30;const tracker=new TowerDpsTracker();game.on((type,h)=>{if(type==='hit')tracker.recordHit(h,game.combat.elapsed);});
  const hp=enemy.hp;game.combat.impact({source,target:enemy,stats:towerStats(source,data)});game.tick(.25);
  close(hp-enemy.hp,45+48*.25);close(tracker.snapshot(game.towers,game.combat.elapsed)[0].damage,57);
  assert.ok(events.some(e=>e.type==='hit'&&!e.payload.directHit&&e.payload.type==='magical'&&e.payload.effect==='poison'&&e.payload.source===source));
  const burning=arena('elvenking'),air=foe(burning.game),ground=foe(burning.game,false,11.1);air.magicImmune=true;burning.game.rng=()=>0;burning.game.combat.impact({source:burning.source,target:air,stats:towerStats(burning.source,data)});
  close(1e7-air.hp,2316);close(1e7-ground.hp,2316*20);const fire=burning.events.filter(e=>e.type==='hit'&&e.payload.effect==='fire');assert.equal(fire.length,1);assert.equal(fire[0].payload.type,'magical');assert.equal(fire[0].payload.source,burning.source);
  const proc=burning.events.find(e=>e.type==='burn-proc').payload;assert.equal(proc.effect,'fire');assert.equal(proc.source,burning.source);close(proc.amount,2316*20);
});

function preview(ids,enemy){return {threats:ids.map(id=>({id,label:id})),enemies:[{type:'fixture',count:1,variants:[{enemy,maxHp:enemy.hp,armor:enemy.armor,flying:enemy.flying,threatIds:ids}]}]};}

test('readiness applies flying armor, shield, shell, evasion and immunity penalties without obsolete bypass claims',()=>{
  const ids=['heavyArmor','reactiveArmor','physicalImmune','flying','shield','shell','evasion'],engine=new ArmyReadiness(data),t={family:'wyvernhunter',tier:1,state:'active'};
  const clean=engine.evaluate(preview(ids,{hp:2000,armor:0,flying:true}),[t]),guarded=engine.evaluate(preview(ids,{hp:2000,armor:0,flying:true,...defenses}),[t]);
  assert.ok(clean.rows.some(r=>r.ordinal>0));assert.ok(guarded.rows.every(r=>r.ordinal===0));assert.ok(guarded.rows.every(r=>!/bypasses all damage defenses|Pure|resistance/i.test(r.response)));
});

test('readiness honestly covers actual campaign split immunities with Physical Ranger and independent Magical support',()=>{
  const engine=new ArmyReadiness(data),actual=new WaveThreatAnalyzer(data).analyze(34),t={family:'wyvernhunter',tier:1,state:'active'},result=engine.evaluate(actual,[t]);
  assert.equal(result.rows.find(r=>r.threatId==='physicalImmune').ordinal,0);assert.match(result.rows.find(r=>r.threatId==='magicImmune').response,/Physical or Holy/);
  const mixed=engine.evaluate(actual,[t,{family:'mage',tier:6,state:'active'}]);assert.ok(mixed.rows.find(r=>r.threatId==='physicalImmune').ordinal>0);
});
