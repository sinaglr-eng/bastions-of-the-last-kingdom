import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignEnemies,campaignRecipes,campaignWaves} from '../game/core/campaign-roster.js';
import {seededRandom,towerStats} from '../game/core/math.js';
import {WaveThreatAnalyzer} from '../game/core/wave-threats.js';
import {configuredWarbandInfo,currentWarbandInfo,warbandTraitDetails} from '../game/core/warband-info.js';
import {selectedEnemyView,selectedEnemyMarkup} from '../ui/selected-enemy.js';
import {wavePreviewMarkup} from '../ui/wave-preview.js';

const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),enemies:campaignEnemies(raw.enemies),recipes:campaignRecipes(raw.recipes),waves:campaignWaves(raw.waves)};
const forms=[5,15,27,28,29,41].map(wave=>({wave,type:`host_${String(wave).padStart(2,'0')}`}));
const families={physical:'archer',magical:'mage',holy:'cleric'};
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);
function arena({wave,type},moon=true){
  const game=new Game(data,{seed:42});game.round=wave;game.phase='combat';
  game.combat.spawnQueue=[{time:1e9,type:'host_01'}];
  const enemy=game.combat.spawn(type,{variant:data.enemies[type].variants[moon?1:0]});
  return {game,enemy};
}
function impact(game,enemy,type,roll,{trueStrike=false}={}){
  const source={id:game.nextId++,family:families[type],tier:1,state:'active',x:enemy.x,z:enemy.z,kills:0,attackPaused:true};
  game.towers=[source];const stats={...towerStats(source,data),trueStrike};
  let calls=0,result;game.rng=()=>{calls++;return roll;};
  game.on((event,trace)=>{if(event==='damage-trace'&&trace.enemy===enemy&&trace.directHit)result=trace;});
  game.combat.impact({source,target:enemy,stats});
  assert.ok(result,'A real projectile impact reaches direct-hit resolution');
  return {result,calls,stats,source};
}

test('exactly six authored Moon Clan forms have 25% evasion; base/non-Moon values and historical input remain unchanged',()=>{
  const before=JSON.stringify(raw),adapted=campaignEnemies(raw.enemies),found=[];
  for(const [type,base]of Object.entries(adapted)){
    assert.equal(base.evasion,raw.enemies[type].evasion>0?.25:raw.enemies[type].evasion,type+' base evasion');
    for(const [index,variant]of (base.variants||[]).entries()){
      if(variant.name.endsWith(' · Moon Clan')){found.push(type);assert.equal(variant.evasion,.25);}
      else assert.equal(variant.evasion,raw.enemies[type].variants[index].evasion>0?.25:raw.enemies[type].variants[index].evasion,type+' other variant');
    }
  }
  assert.deepEqual(found,forms.map(form=>form.type));
  assert.equal(JSON.stringify(raw),before,'Adapting the live roster does not write archived definitions');
  assert.equal(raw.enemies.host_29.evasion,.25);assert.equal(raw.enemies.host_29.variants[1].evasion,undefined);
});

for(const form of forms)test(`wave ${form.wave}: actual Moon Clan spawn preserves every authored stat, appearance and existing defense`,()=>{
  const {game,enemy}=arena(form),original={...raw.enemies[form.type],...raw.enemies[form.type].variants[1]};
  assert.equal(enemy.evasion,.25);
  for(const key of ['name','hp','armor','speed','gold','xp','leak','flying','boss','beast','color','size','model','appearance','visualAsset','designArchetype','auraStage','traits','reactiveArmor','stealth','physicalImmune'])
    assert.deepEqual(enemy[key],original[key],`${form.type}: ${key}`);
  assert.equal(enemy.maxHp,original.hp);assert.equal(enemy.shields,original.refraction||0);
  if(form.wave===15)assert.equal(enemy.regen,.2);
  if(form.wave===27)assert.equal(enemy.untouchable,.75);
  if(form.wave===28){assert.equal(enemy.cloaked,true);assert.equal(enemy.reactiveArmor,0);}
  const normal=game.combat.spawn(form.type,{variant:data.enemies[form.type].variants[0]});
  assert.equal(normal.evasion,form.wave===29?.25:undefined,'The paired non-Moon form keeps its existing evasion');
});

test('all six forms evade Physical/Magical/Holy impacts below 25%, never at 25%; immunity and shields retain their order',()=>{
  for(const form of forms)for(const type of Object.keys(families))for(const roll of [.249999,.25]){
    const {game,enemy}=arena(form),hp=enemy.hp,shields=enemy.shields,{result,calls,stats}=impact(game,enemy,type,roll);
    assert.equal(calls,1,`${form.type} ${type}: exactly one evasion roll`);
    if(roll<.25){assert.equal(result.blockReason,'evasion');assert.equal(result.contact,false);assert.equal(enemy.hp,hp);assert.equal(enemy.shields,shields);continue;}
    if(shields){assert.equal(result.blockReason,'shield');assert.equal(enemy.shields,shields-1);assert.equal(enemy.hp,hp);}
    else if(type==='physical'&&enemy.physicalImmune){assert.equal(result.blockReason,'physical-immunity');assert.equal(enemy.hp,hp);}
    else{assert.equal(result.blockReason,null);close(hp-enemy.hp,stats.damage*30/(30+enemy.armor));}
  }
});

test('True Strike bypasses the Moon Clan evasion roll on all three hit classes while retaining armor, shields and immunity',()=>{
  for(const form of forms)for(const type of Object.keys(families)){
    const {game,enemy}=arena(form),hp=enemy.hp,shields=enemy.shields,{result,calls,stats}=impact(game,enemy,type,0,{trueStrike:true});
    assert.equal(calls,0,'True Strike consumes no evasion RNG');assert.notEqual(result.blockReason,'evasion');
    if(shields){assert.equal(result.blockReason,'shield');assert.equal(enemy.shields,shields-1);assert.equal(enemy.hp,hp);}
    else if(type==='physical'&&enemy.physicalImmune){assert.equal(result.blockReason,'physical-immunity');assert.equal(enemy.hp,hp);}
    else close(hp-enemy.hp,stats.damage*30/(30+enemy.armor));
  }
});

test('already applied poison and other non-direct damage bypass Moon Clan evasion without spending shields or RNG',()=>{
  for(const form of forms){
    const {game,enemy}=arena(form);game.rng=()=>assert.fail('DOT and non-direct damage never roll evasion');
    const shields=enemy.shields;
    for(const type of Object.keys(families)){
      const hp=enemy.hp,damage=game.combat.damage(enemy,1,type,{});
      close(damage,type==='physical'&&enemy.physicalImmune?0:30/(30+enemy.armor));close(hp-enemy.hp,damage);
    }
    game.combat.applyEffects(enemy,{type:'magical',poisonDps:1,healingBlockDuration:1});
    const hp=enemy.hp;game.tick(.1);close(hp-enemy.hp,.1*30/(30+enemy.armor));
    assert.equal(enemy.statuses.poison.stacks,1);close(enemy.statuses.poison.time,4.9);assert.equal(enemy.shields,shields);
  }
});

test('guide, wave preview, queued composition and selected live inspection derive the same actual Moon Clan defense',()=>{
  const analyzer=new WaveThreatAnalyzer(data);
  for(const form of forms){
    const {game,enemy}=arena(form),definition=data.enemies[form.type],variant=definition.variants[1];
    const guide=configuredWarbandInfo({...definition,type:form.type},{variant}),outlook=analyzer.outlook(form.wave-1),preview=outlook.next.enemies[0].variants;
    const moon=preview.find(row=>row.name===enemy.name),normal=preview.find(row=>row.name===definition.name);
    assert.deepEqual(guide.traitDetails,warbandTraitDetails(enemy));assert.deepEqual(moon.traitDetails,guide.traitDetails);
    assert.equal(moon.enemy.evasion,.25);assert.equal(normal.enemy.evasion,form.wave===29?.25:undefined);
    assert.ok(moon.threatIds.includes('evasion'));assert.ok(outlook.next.threats.some(row=>row.id==='evasion'&&row.possible===(form.wave!==29)));
    assert.match(wavePreviewMarkup(outlook,data,{}),/25% chance to evade Physical, Magical and Holy direct hits/);
    const selected=selectedEnemyView(enemy,{data,combat:game.combat});assert.deepEqual(selected.traitDetails,guide.traitDetails);
    assert.match(selectedEnemyMarkup(enemy,{data,combat:game.combat}),/25% chance to evade Physical, Magical and Holy direct hits/);
    game.combat.start({...game.wave,variant});const queued=currentWarbandInfo(game);
    assert.equal(queued.length,1);assert.equal(queued[0].queuedCount,game.wave.groups[0].count);assert.deepEqual(queued[0].traitDetails,guide.traitDetails);
    const first=game.combat.spawnQueue.shift(),actual=game.combat.spawn(first.type,first.modifiers);
    assert.equal(actual.evasion,.25);assert.deepEqual(currentWarbandInfo(game)[0].traitDetails,guide.traitDetails);
  }
});

test('seeded live impact samples retain the same 25% chance on all six forms, including wave 29 without stacking',()=>{
  for(const form of forms)for(const type of Object.keys(families)){
    const {game,enemy}=arena(form),rng=seededRandom(807),expected=seededRandom(807),traces=[];
    const source={id:game.nextId++,family:families[type],tier:1,state:'active',x:enemy.x,z:enemy.z,kills:0,attackPaused:true};
    game.towers=[source];game.rng=rng;const stats={...towerStats(source,data),damage:.00001};
    game.on((event,trace)=>{if(event==='damage-trace'&&trace.directHit)traces.push(trace);});
    let expectedMisses=0;for(let i=0;i<1024;i++){expectedMisses+=expected()<.25?1:0;game.combat.impact({source,target:enemy,stats});}
    const misses=traces.filter(trace=>trace.blockReason==='evasion').length;
    assert.equal(traces.length,1024);assert.equal(misses,expectedMisses);assert.ok(misses/1024>.2&&misses/1024<.3);
  }
});

test('seeded real wave queues retain independent, repeatable Moon Clan choices and original spawn schedules',()=>{
  for(const form of forms){
    const run=seed=>{const game=new Game(data,{seed});game.round=form.wave;game.combat.start(game.wave);return game.combat.spawnQueue;};
    const a=run(42),b=run(42),other=run(123);assert.deepEqual(a,b);assert.notDeepEqual(a,other);
    const group=data.waves[form.wave-1].groups[0];assert.equal(a.length,group.count);
    assert.ok(a.some(row=>row.modifiers.variant.evasion===.25));
    for(const [index,row]of a.entries()){
      close(row.time,.25+index*group.interval);
      assert.equal(row.modifiers.variant.evasion,row.modifiers.variant.name.endsWith(' · Moon Clan')?.25:undefined);
    }
  }
});
