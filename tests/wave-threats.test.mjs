import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WaveThreatAnalyzer} from '../game/core/wave-threats.js';
import {CombatManager} from '../game/core/combat.js';
import {DraftManager} from '../game/core/draft.js';
import {CommandPoints} from '../game/core/command-points.js';
import {seededRandom} from '../game/core/math.js';
import {campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';

const data=Object.fromEntries(['balance','enemies','waves','towers'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const ids=analysis=>analysis.threats.map(threat=>threat.id);
const enemy=(name,extra={})=>({name,hp:100,armor:0,speed:1,...extra});
const wave=(type,count=10,extra={})=>({name:`${type} wave`,groups:[{type,count,interval:.6}],...extra});
const scenario=(enemies,waves,settings={})=>({enemies,waves,towers:data.towers,balance:{...data.balance,wavePreview:{...data.balance.wavePreview,...settings}}});
const combat=(source,rng=seededRandom(18))=>new CombatManager({data:source,rng,towers:[],grid:{route:[{x:0,z:0},{x:1,z:0}],checkpoints:[{x:0,z:0},{x:1,z:0}]},emit(){}});

test('Immediate full preview contains the authored count, enemy types and real numerical detail',()=>{
  const result=new WaveThreatAnalyzer(data).outlook(14).next;
  assert.equal(result.number,15);assert.equal(result.name,data.waves[14].name);assert.equal(result.totalCount,11);
  assert.equal(result.enemies[0].type,'host_15');assert.equal(result.enemies[0].count,11);assert.equal(result.enemies[0].variants.length,2);
  assert.equal(result.enemies[0].variants[0].maxHp,975);assert.equal(result.enemies[0].variants[0].flying,true);
  assert.ok(result.enemies[0].variants[0].traitDetails.some(trait=>trait.text.includes('48.75 HP/s')));
  assert.ok(ids(result).includes('regeneration'));assert.ok(ids(result).includes('flying'));
});

test('Classifications derive every supported ability from actual fields and leave unsupported categories absent',()=>{
  const raw=enemy('Mechanics',{hp:1000,armor:40,speed:3,boss:true,magicImmune:true,physicalImmune:true,regen:.05,recharge:.12,refraction:3,reactiveArmor:8,krakenShell:30,evasion:.25,stealth:true,blink:3,hasteAura:1.18,disarm:true,thief:50});
  const source=scenario({all:raw,regular:enemy('Regular')},[wave('all',24)]),result=new WaveThreatAnalyzer(source).analyze(0);
  for(const id of ['boss','magicImmune','physicalImmune','highHealth','flying','stealth','blink','heavyArmor','debuffer','shell','shield','buffer','reactiveArmor','regeneration','recharge','evasion','fast','swarm','thief']){
    if(id==='flying'){assert.ok(!ids(result).includes(id));continue;}
    assert.ok(ids(result).includes(id),id);assert.ok(result.enemies[0].variants[0].threatIds.includes(id),id);
  }
  assert.ok(!ids(result).some(id=>['summoning','ranged','physicalResistance','controlResistance'].includes(id)));
});

test('Repeated enemy groups aggregate their counts and repeated tags while preserving different modifiers',()=>{
  const source=scenario({orc:enemy('Iron Orc',{armor:40})},[{name:'Two groups',groups:[{type:'orc',count:8,hp:1,interval:.6},{type:'orc',count:7,hp:2,interval:.6}]}]);
  const result=new WaveThreatAnalyzer(source).analyze(0);
  assert.equal(result.totalCount,15);assert.equal(result.enemies.length,1);assert.equal(result.enemies[0].count,15);
  assert.deepEqual(result.enemies[0].variants.map(variant=>variant.maxHp),[100,200]);
  assert.equal(result.threats.filter(threat=>threat.id==='heavyArmor').length,1);
});

test('Effective variants follow Combat health, speed, armor and resistance modifier precedence',()=>{
  const source=scenario({troll:enemy('Troll',{armor:5,speed:2,resists:{magic:.1},variants:[{name:'Leech',hp:200,regen:.05},{name:'Hidden',stealth:true}]})},[{name:'Modified',hp:3,armor:2,speed:1.5,resists:{fire:.3},groups:[{type:'troll',count:10,hp:2,armor:7,speed:1.25,interval:.6}]}]);
  const [leech,hidden]=new WaveThreatAnalyzer(source).analyze(0).enemies[0].variants;
  assert.equal(leech.maxHp,400);assert.equal(leech.enemy.hp,400);assert.equal(leech.armor,12);assert.equal(leech.speed,2.5);
  assert.deepEqual(leech.enemy.resists,{magic:.1,fire:.3});assert.equal(hidden.maxHp,200);
  assert.ok(leech.traits.some(trait=>trait.includes('20 HP/s')));assert.ok(hidden.threatIds.includes('stealth'));
});

test('Explicit group variant overrides an explicit wave variant and null deliberately selects the base',()=>{
  const source=scenario({orc:enemy('Base',{variants:[{name:'Random',armor:70}]})},[
    wave('orc',4,{variant:{name:'Wave selection',hp:300},groups:[{type:'orc',count:4,interval:.6,variant:{name:'Group selection',hp:250}}]}),
    wave('orc',4,{variant:null}),
  ]);
  const analyzer=new WaveThreatAnalyzer(source);
  assert.equal(analyzer.analyze(0).enemies[0].variants.length,1);assert.equal(analyzer.analyze(0).enemies[0].variants[0].name,'Group selection');
  assert.equal(analyzer.analyze(0).enemies[0].variants[0].maxHp,250);
  assert.equal(analyzer.analyze(1).enemies[0].variants[0].name,'Base');assert.equal(analyzer.analyze(1).enemies[0].variants[0].armor,0);
});

test('Independent random immunity variants are possible profiles without a promised per-variant count',()=>{
  const result=new WaveThreatAnalyzer(data).analyze(34),row=result.enemies[0];
  assert.equal(row.count,15);assert.equal(row.variants.length,2);
  assert.ok(result.threats.find(threat=>threat.id==='magicImmune').possible);
  assert.ok(result.threats.find(threat=>threat.id==='physicalImmune').possible);
  assert.ok(row.variants.every(variant=>!Object.hasOwn(variant,'count')&&!Object.hasOwn(variant,'probability')));
  assert.ok(row.variants.some(variant=>variant.enemy.magicImmune));assert.ok(row.variants.some(variant=>variant.enemy.physicalImmune));
});

test('One fast invader among forty regular invaders does not dominate the wave',()=>{
  const source=scenario({regular:enemy('Regular'),fast:enemy('Fast',{speed:4})},[{groups:[{type:'regular',count:40,interval:.6},{type:'fast',count:1,interval:.6}]}]);
  const result=new WaveThreatAnalyzer(source).analyze(0);
  assert.ok(!ids(result).includes('fast'));assert.ok(ids(result).includes('swarm'));
  assert.ok(result.enemies.find(row=>row.type==='fast').variants[0].threatIds.includes('fast'),'Optional numerical detail remains accurate');
});

test('One boss and its abilities remain primary even within a large ordinary group',()=>{
  const source=scenario({regular:enemy('Regular'),boss:enemy('Boss',{boss:true,hp:5000,regen:.05,magicImmune:true})},[{groups:[{type:'regular',count:40,interval:.6},{type:'boss',count:1,interval:.6}]}]);
  const result=new WaveThreatAnalyzer(source).analyze(0);
  assert.equal(result.special,'boss');assert.equal(result.profile,'Boss Wave');assert.equal(result.primaryThreats[0].id,'boss');
  assert.ok(result.primaryThreats.some(threat=>threat.id==='regeneration'));assert.ok(result.primaryThreats.some(threat=>threat.id==='magicImmune'));
  assert.ok(result.threats.find(threat=>threat.id==='regeneration').bossRelated);
});

test('A boss-wave flag does not give ordinary minion abilities the priority of the actual boss',()=>{
  const source=scenario({regular:enemy('Minion',{magicImmune:true,stealth:true,disarm:true}),boss:enemy('Boss',{boss:true,regen:.05,refraction:3})},[{boss:true,groups:[{type:'regular',count:40,interval:.6},{type:'boss',count:1,interval:.6}]}]);
  const result=new WaveThreatAnalyzer(source).analyze(0);
  assert.equal(result.primaryThreats[0].id,'boss');assert.equal(result.primaryThreats[1].id,'shield');assert.equal(result.primaryThreats[2].id,'regeneration');
  for(const id of ['magicImmune','stealth','debuffer'])assert.equal(result.threats.find(threat=>threat.id===id).bossRelated,false);
});

test('Normal late-wave health scaling is not mistaken for a special High Health threat',()=>{
  const analyzer=new WaveThreatAnalyzer(data),high=[];
  for(let index=0;index<data.waves.length;index++)if(ids(analyzer.analyze(index)).includes('highHealth'))high.push(index+1);
  assert.deepEqual(high,[10,20,30,40,50]);
  assert.ok(!ids(analyzer.analyze(48)).includes('highHealth'));
});

test('A nonboss health outlier is compared with nearby regular waves and not nearby bosses',()=>{
  const source=scenario({regular:enemy('Regular'),bulky:enemy('Bulky',{hp:800}),boss:enemy('Boss',{hp:100000,boss:true})},[wave('regular'),wave('bulky'),wave('boss',1,{boss:true}),wave('regular')]);
  assert.ok(ids(new WaveThreatAnalyzer(source).analyze(1)).includes('highHealth'));
});

test('Profiles summarize actual composition without handwritten per-wave classifications',()=>{
  const analyzer=new WaveThreatAnalyzer(data);
  assert.equal(analyzer.analyze(0).profile,'Standard Wave');assert.equal(analyzer.analyze(21).profile,'Armored Assault');
  assert.equal(analyzer.analyze(18).profile,'Fast Raid');assert.equal(analyzer.analyze(31).profile,'Sustained Pressure');
  assert.equal(analyzer.analyze(37).profile,'Mixed Threat');assert.equal(analyzer.analyze(43).profile,'Swarm');
});

test('Default primary limits allow three ordinary tags and five complex or boss tags',()=>{
  const analyzer=new WaveThreatAnalyzer(data);
  assert.equal(analyzer.analyze(24).primaryThreats.length,3);assert.equal(analyzer.analyze(38).primaryThreats.length,5);
  assert.equal(analyzer.analyze(49).primaryThreats.length,5);assert.equal(analyzer.analyze(49).primaryThreats[0].id,'boss');
  assert.ok(analyzer.analyze(49).primaryThreats.some(threat=>threat.id==='magicImmune'),'Possible boss ability receives priority over plain armor');
  assert.ok(analyzer.analyze(49).primaryThreats.some(threat=>threat.id==='shell'));
});

test('The following wave is explicitly partial and cannot leak full variants, quantities or numeric scores',()=>{
  const outlook=new WaveThreatAnalyzer(data).outlook(13),after=outlook.after;
  assert.equal(after.number,15);assert.equal(after.name,data.waves[14].name);
  assert.deepEqual(Object.keys(after).sort(),['index','name','number','primaryThreats','profile','special']);
  assert.ok(after.primaryThreats.length);
  for(const threat of after.primaryThreats)assert.deepEqual(Object.keys(threat).sort(),['description','icon','id','label','possible']);
  for(const forbidden of ['totalCount','enemies','variants','maxHp','armor','speed','populationShare','weight','traitDetails'])assert.ok(!JSON.stringify(after).includes(`"${forbidden}":`));
});

test('Boss forecast changes from marker to identity to key traits to full preview at the documented distances',()=>{
  const analyzer=new WaveThreatAnalyzer(data);
  for(const [index,visibility,distance] of [[0,'marker',9],[4,'marker',5],[5,'identity',4],[6,'identity',3],[7,'traits',2],[8,'traits',1],[9,'full',0]]){
    const boss=analyzer.outlook(index).boss;
    assert.equal(boss.visibility,visibility);assert.equal(boss.distance,distance);assert.equal(boss.number,10);
    assert.equal(Object.hasOwn(boss,'name'),visibility!=='marker');assert.equal(Object.hasOwn(boss,'primaryThreats'),['traits','full'].includes(visibility));
    assert.equal(Object.hasOwn(boss,'preview'),visibility==='full');
    if(visibility==='full')assert.equal(boss.preview,analyzer.analyze(9));
  }
});

test('Forecast distance is anchored to the forthcoming wave during draft and the next index during combat',()=>{
  const analyzer=new WaveThreatAnalyzer(data);
  const preparing=analyzer.outlook(8),fighting=analyzer.outlook(9);
  assert.equal(preparing.next.number,9);assert.equal(preparing.boss.distance,1);assert.equal(preparing.boss.visibility,'traits');
  assert.equal(fighting.next.number,10);assert.equal(fighting.boss.distance,0);assert.equal(fighting.boss.visibility,'full');
});

test('Campaign limits and final waves omit unavailable future cards and bosses safely',()=>{
  const analyzer=new WaveThreatAnalyzer(data);
  const limited=analyzer.outlook(14,15);assert.equal(limited.next.number,15);assert.equal(Object.hasOwn(limited,'after'),false);assert.equal(Object.hasOwn(limited,'boss'),false);
  const final=analyzer.outlook(49);assert.equal(final.next.number,50);assert.equal(Object.hasOwn(final,'after'),false);assert.equal(final.boss.visibility,'full');
  assert.deepEqual(analyzer.outlook(50),{next:null});assert.deepEqual(analyzer.outlook(15,15),{next:null});
});

test('Missing enemy definitions, empty waves and invalid indices have safe fallbacks',()=>{
  const source=scenario({},[wave('missing',2),{name:'Empty',groups:[]}]),analyzer=new WaveThreatAnalyzer(source);
  const unknown=analyzer.analyze(0);assert.equal(unknown.enemies[0].unknown,true);assert.equal(unknown.enemies[0].name,'missing');
  assert.equal(unknown.enemies[0].variants[0].maxHp,0);assert.deepEqual(unknown.threats,[]);
  assert.equal(analyzer.analyze(1).totalCount,0);assert.deepEqual(analyzer.analyze(1).enemies,[]);
  for(const index of [-1,2,1.5,NaN,'0'])assert.equal(analyzer.analyze(index),null);
  assert.deepEqual(new WaveThreatAnalyzer({enemies:{}}).outlook(0),{next:null});
});

test('Unsupported lore tags, guessed abilities and unused physical resistance fields never become threats',()=>{
  const source=scenario({fake:enemy('Unusual',{traits:['summoning','healing','ranged','control resistance'],threat:'Fast armored healer',summoning:true,healing:20,ranged:true,controlResistance:1,resists:{physical:.9,madeUp:.9}})},[wave('fake')]);
  assert.deepEqual(new WaveThreatAnalyzer(source).analyze(0).threats,[]);
});

test('Actual magical resistance types classify while immunity avoids a redundant resistance tag',()=>{
  const source=scenario({mage:enemy('Mage',{resists:{fire:.3}}),immune:enemy('Immune',{magicImmune:true,resists:{magic:.8}})},[wave('mage'),wave('immune')]);
  const analyzer=new WaveThreatAnalyzer(source);
  assert.ok(ids(analyzer.analyze(0)).includes('magicResistance'));assert.ok(ids(analyzer.analyze(1)).includes('magicImmune'));
  assert.ok(!ids(analyzer.analyze(1)).includes('magicResistance'));
});

test('Legacy by-type movement support, ward support, enrage and barricade disruption match implemented mechanics',()=>{
  const source=scenario({shaman:data.enemies.shaman,warlock:data.enemies.warlock,berserker:data.enemies.berserker,sapper:data.enemies.sapper},[wave('shaman'),wave('warlock'),wave('berserker'),wave('sapper')]);
  const analyzer=new WaveThreatAnalyzer(source);
  assert.ok(ids(analyzer.analyze(0)).includes('buffer'));assert.ok(!ids(analyzer.analyze(0)).includes('regeneration'));
  assert.ok(ids(analyzer.analyze(1)).includes('buffer'));assert.ok(ids(analyzer.analyze(2)).includes('fast'));assert.ok(ids(analyzer.analyze(3)).includes('debuffer'));
});

test('Central thresholds tune classification and display limits without editing enemy definitions',()=>{
  const source=scenario({orc:enemy('Orc',{armor:20,speed:2,regen:.05})},[wave('orc',10)],{maxPrimaryThreats:1,classification:{...data.balance.wavePreview.classification,heavyArmor:20,fastSpeed:2,swarmCount:10}});
  const result=new WaveThreatAnalyzer(source).analyze(0);
  for(const id of ['heavyArmor','fast','swarm','regeneration'])assert.ok(ids(result).includes(id));
  source.balance.wavePreview.complexThreatCount=8;
  assert.equal(new WaveThreatAnalyzer(source).analyze(0).primaryThreats.length,1);
  assert.equal(source.enemies.orc.armor,20);
});

test('Preview distance and boss forecast distance are configurable with no extra missing-wave cards',()=>{
  const source=scenario(data.enemies,data.waves,{fullPreviewWavesAhead:2,partialPreviewWavesAhead:3,bossForecast:{markerDistance:2,identityDistance:1,traitsDistance:1}}),analyzer=new WaveThreatAnalyzer(source);
  assert.equal(analyzer.outlook(0).next.number,2);assert.equal(analyzer.outlook(0).after.number,3);assert.equal(Object.hasOwn(analyzer.outlook(0),'boss'),false);
  assert.equal(analyzer.outlook(7).boss.visibility,'marker');assert.equal(analyzer.outlook(8).boss.visibility,'traits');
  assert.equal(Object.hasOwn(analyzer.outlook(49),'after'),false);assert.equal(analyzer.outlook(49).next,null);
});

test('Cached analyses are stable immutable snapshots and do not mutate source definitions',()=>{
  const source=structuredClone(data),before=JSON.stringify(source),analyzer=new WaveThreatAnalyzer(source),first=analyzer.analyze(34);
  assert.equal(analyzer.analyze(34),first);assert.equal(analyzer.outlook(34).next,first);assert.equal(JSON.stringify(source),before);
  assert.ok(Object.isFrozen(first));assert.ok(Object.isFrozen(first.enemies[0].variants[0].enemy));assert.ok(Object.isFrozen(first.enemies[0].variants[0].threatIds));
  assert.throws(()=>{first.enemies[0].variants[0].enemy.hp=1;},TypeError);
  source.enemies.host_35.hp=1;assert.equal(analyzer.analyze(34).enemies[0].variants[0].maxHp,21640);
});

test('Analyzer settings are immutable snapshots of the central configuration',()=>{
  const source=structuredClone(data),analyzer=new WaveThreatAnalyzer(source);
  assert.ok(Object.isFrozen(analyzer.config));assert.ok(Object.isFrozen(analyzer.config.classification));assert.ok(Object.isFrozen(analyzer.config.bossForecast));
  assert.equal(analyzer.config.fullPreviewWavesAhead,1);assert.equal(analyzer.config.partialPreviewWavesAhead,2);
  source.balance.wavePreview.classification.heavyArmor=999;assert.equal(analyzer.config.classification.heavyArmor,30);
  assert.throws(()=>{analyzer.config.bossForecast.markerDistance=999;},TypeError);
});

test('The analyzer consumes no global or game RNG even while examining every variant and future boss',()=>{
  const random=Math.random;let calls=0;
  Math.random=()=>{calls++;throw new Error('Preview consumed global RNG');};
  try{
    const source={...data,rng:()=>{calls++;throw new Error('Preview consumed game RNG');}},analyzer=new WaveThreatAnalyzer(source);
    for(let index=0;index<data.waves.length;index++){analyzer.analyze(index);analyzer.outlook(index);}
    assert.equal(calls,0);
  }finally{Math.random=random;}
});

test('Every possible campaign variant preview agrees with the actual CombatManager spawn fields',()=>{
  const source={...data,enemies:campaignEnemies(data.enemies),waves:campaignWaves(data.waves)},analyzer=new WaveThreatAnalyzer(source),engine=combat(source);
  const fields=['name','type','maxHp','armor','speed','flying','boss','resists','regen','recharge','refraction','reactiveArmor','krakenShell','evasion','stealth','cloakDaggers','disarm','blink','rush','hasteAura','untouchable','thief','magicImmune','physicalImmune'];
  for(let index=0;index<source.waves.length;index++){
    const analysis=analyzer.analyze(index),configured=source.waves[index];
    for(const group of configured.groups){
      const definition=source.enemies[group.type],modifiers={...configured,...group};
      const variants=Object.hasOwn(modifiers,'variant')?[modifiers.variant]:definition.variants?.length?definition.variants:[undefined];
      for(const variant of variants){
        const actual=engine.spawn(group.type,{...modifiers,variant});
        const match=analysis.enemies.find(row=>row.type===group.type).variants.find(profile=>fields.every(field=>JSON.stringify(profile.enemy[field])===JSON.stringify(actual[field])));
        assert.ok(match,`Wave ${index+1}: ${actual.name}`);assert.equal(match.maxHp,actual.maxHp);assert.equal(match.speed,actual.speed);
      }
    }
  }
  assert.equal(analyzer.analyze(49).name,'Lord Bernhard, the Black Sorcerer on the Wyvern Queen');
});

test('Opening previews leaves actual seeded mixed-variant spawn queues unchanged',()=>{
  const analyzer=new WaveThreatAnalyzer(data),control=combat(data,seededRandom(47)),inspected=combat(data,seededRandom(47));
  control.start(data.waves[34]);
  for(let index=0;index<data.waves.length;index++)analyzer.outlook(index);
  inspected.start(data.waves[34]);
  assert.deepEqual(inspected.spawnQueue,control.spawnQueue);assert.equal(inspected.spawnQueue.length,15);
  assert.equal(new Set(inspected.spawnQueue.map(item=>item.modifiers.variant.name)).size,2);
});

test('Preview stays available throughout placement, reroll, reserve and final draft decisions without spending CP or RNG',()=>{
  const analyzer=new WaveThreatAnalyzer(data),preview=analyzer.analyze(34),cp=new CommandPoints(data.balance);
  const inspected=new DraftManager(data,seededRandom(82),cp),control=new DraftManager(data,seededRandom(82));
  inspected.roll(15);control.roll(15);
  for(let index=0;index<5;index++){
    assert.equal(analyzer.outlook(34).next,preview);inspected.reveal(index);control.reveal(index);
    for(const draft of [inspected,control]){draft.draws[index].placed=true;draft.draws[index].towerId=index+1;}
  }
  assert.equal(cp.value,3);assert.deepEqual(inspected.draws,control.draws);
  assert.equal(inspected.reroll(),true);assert.equal(control.reroll(),true);assert.equal(analyzer.outlook(34).next,preview);assert.deepEqual(inspected.draws,control.draws);
  const saved=inspected.draws[1];assert.ok(inspected.reserve(1,{id:saved.towerId,family:saved.family,tier:saved.tier,x:11,z:10}));
  assert.equal(cp.value,1);assert.equal(analyzer.outlook(34).next,preview);assert.equal(inspected.finalize(2),true);
  inspected.roll(15);assert.equal(inspected.draws.length,5);assert.equal(inspected.draws[0].placed,true);assert.equal(inspected.draws[0].family,saved.family);
  assert.equal(analyzer.outlook(34).next,preview);assert.equal(cp.value,1);
});
