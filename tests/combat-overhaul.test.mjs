import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignEnemies,campaignRecipes,campaignWaves} from '../game/core/campaign-roster.js';
import {damageAfterDefense,towerStats,combatTowerStats,supportBonuses} from '../game/core/math.js';
import {DAMAGE_TYPES} from '../game/core/combat-rules.js';
import {ENEMY_RULES,enemyRulesFor} from '../game/core/enemy-rules.js';

const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),enemies:campaignEnemies(raw.enemies),recipes:campaignRecipes(raw.recipes),waves:campaignWaves(raw.waves)};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function arena(roster=data){const game=new Game(roster,{seed:17});game.phase='combat';game.combat.start(game.wave);game.combat.spawnQueue=[{time:1e9,type:'host_01',modifiers:{}}];return game;}
function tower(game,family,tier=1,extra={}){const unit={id:game.nextId++,family,tier,state:'active',x:12,z:12,kills:0,cooldown:1e9,priority:'first',...extra};game.towers.push(unit);return unit;}
function foe(game,variant={}){const enemy=game.combat.spawn('host_01',{variant:{hp:10000,armor:0,speed:0,...variant}});enemy.x=12;enemy.z=13;return enemy;}

test('all 86 current profiles use exactly three damage classes and explicit ability changes, without rewriting archived data',()=>{
  const before=JSON.stringify(raw),types=new Set();let profiles=0;
  for(const [family,definition]of Object.entries(data.towers))for(let tier=1;tier<=(definition.advanced?1:6);tier++){
    const s=towerStats({family,tier},data);types.add(s.type);profiles++;
    assert.ok(DAMAGE_TYPES.includes(s.type));if(s.cleave)assert.ok(DAMAGE_TYPES.includes(s.cleaveType));
    for(const key of ['antiAirBypassesDefenses','magicShredAura','antiAirMagicShred','shredMagic'])assert.equal(s[key],undefined);
  }
  assert.equal(profiles,86);assert.deepEqual([...types].sort(),[...DAMAGE_TYPES].sort());
  assert.equal(data.towers.royalranger.type,'physical');assert.equal(data.towers.royalarsenal.type,'magical');
  assert.deepEqual([data.towers.starfall.damage,data.towers.starfall.chainDamage],[300,165]);
  assert.equal(data.towers.thunderheart.forkedDamage,3000);assert.equal(data.towers.archangel.bouncingFrostDamage,250);
  assert.deepEqual([data.towers.ladyclaire.chainDamage,data.towers.ladyclaire.melancholyChance],[250,0]);
  assert.deepEqual([data.towers.thornwarden.multishot,data.towers.verdantguard.multishot],[3,5]);
  assert.deepEqual([data.towers.highking.critChance,data.towers.crownofages.critChance],[.15,.2]);
  campaignTowers(raw.towers);campaignEnemies(raw.enemies);assert.equal(JSON.stringify(raw),before);
});

test('armor reduces all three classes; only Holy damage ignores both damage immunities and no elemental resistance survives',()=>{
  for(const type of DAMAGE_TYPES)close(damageAfterDefense(100,type,{armor:30,resists:{magic:.99,fire:.99}}, {},data.balance),50);
  for(const type of DAMAGE_TYPES)close(damageAfterDefense(100,type,{armor:60,armorShred:30,mvpArmorReduction:.1},{penetration:0},data.balance),100*30/60);
  assert.equal(damageAfterDefense(100,'physical',{armor:30,physicalImmune:true},{},data.balance),0);
  assert.equal(damageAfterDefense(100,'magical',{armor:30,magicImmune:true},{},data.balance),0);
  close(damageAfterDefense(100,'holy',{armor:30,magicImmune:true,physicalImmune:true},{},data.balance),50);
});

test('evasion, depletion-recharging shields and shell still stop Holy direct hits; True Strike and DOT use their actual separate contracts',()=>{
  const game=arena(),source=tower(game,'ladyclaire'),enemy=foe(game,{evasion:.25,krakenShell:100,refraction:3});let rolls=0;game.rng=()=>{rolls++;return .1;};
  assert.equal(game.combat.damage(enemy,500,'holy',{type:'holy',directHit:true},source),0);assert.equal(enemy.shields,3);assert.equal(rolls,1);
  assert.equal(game.combat.damage(enemy,500,'holy',{type:'holy',directHit:true,trueStrike:true},source),0);assert.equal(enemy.shields,2);assert.equal(rolls,1);
  for(let i=0;i<2;i++)assert.equal(game.combat.damage(enemy,500,'holy',{type:'holy',directHit:true,trueStrike:true},source),0);
  assert.equal(enemy.shields,0);assert.equal(enemy.shieldReadyAt,2);close(game.combat.damage(enemy,500,'holy',{type:'holy',directHit:true,trueStrike:true},source),400);
  close(game.combat.damage(enemy,50,'holy',{type:'holy'},source),50,'DOT does not roll evasion or consume shell');assert.equal(rolls,1);
  game.tick(1.999);assert.equal(enemy.shields,0);game.tick(.001);assert.equal(enemy.shields,3);assert.equal(ENEMY_RULES.refraction.period,2);
});

test('Magical immunity blocks poison/fire while Physical immunity blocks slow/freeze, including Holy companion effects',()=>{
  const game=arena(),source=tower(game,'druid'),enemy=foe(game,{magicImmune:true,physicalImmune:true});game.rng=()=>0;
  const effects={type:'magical',damage:10,poisonDps:6,burnDps:12,slow:.4,freeze:1,freezeDuration:2,shred:30};
  game.combat.applyEffects(enemy,effects,source);assert.equal(enemy.statuses.poison,undefined);assert.equal(enemy.statuses.burn,undefined);assert.equal(enemy.statuses.slow,undefined);assert.equal(enemy.statuses.freeze,undefined);assert.equal(enemy.statuses.shred.amount,30);
  game.combat.applyEffects(enemy,{...effects,type:'holy'},source);for(const key of ['poison','burn','slow','freeze'])assert.equal(enemy.statuses[key],undefined);
  const before=enemy.hp;game.tick(.25);assert.equal(enemy.hp,before,'A blocked Holy companion cannot deal later DOT');
  game.combat.impact({source,target:enemy,stats:{...effects,type:'holy'}});assert.ok(enemy.hp<before,'Holy damage itself still bypasses both immunities');
});

test('armor reduction can land through damage immunity, respects evasion/shields, uses strongest amount and never goes negative',()=>{
  const game=arena(),source=tower(game,'runebreaker',5),enemy=foe(game,{physicalImmune:true,armor:30}),stats=towerStats(source,data);
  game.combat.impact({source,target:enemy,stats});assert.equal(enemy.hp,enemy.maxHp);assert.equal(enemy.statuses.shred.amount,32);
  close(damageAfterDefense(100,'holy',enemy,{},data.balance),100);
  const shielded=foe(game,{physicalImmune:true,refraction:3});game.combat.impact({source,target:shielded,stats});assert.equal(shielded.statuses.shred,undefined);assert.equal(shielded.shields,2);
  game.combat.applyEffects(enemy,{type:'physical',shred:10},source);assert.equal(enemy.statuses.shred.amount,32);
});

test('ten successful Druid I hits add ten independent 5s stacks and credit each owner actual HP with no refresh of earlier hits',()=>{
  const game=arena(),first=tower(game,'druid'),second=tower(game,'druid'),enemy=foe(game),stats=towerStats(first,data),hits=[];
  game.on((type,event)=>{if(type==='hit'&&!event.directHit)hits.push(event);});
  for(let hit=0;hit<10;hit++)game.combat.impact({source:first,target:enemy,stats});
  assert.equal(enemy.statuses.poison.stacks,10);assert.equal(enemy.statuses.poison.dps,60);game.tick(1);
  close(hits.reduce((sum,hit)=>sum+hit.effectiveDamage,0),60);assert.ok(hits.every(hit=>hit.source===first&&hit.type==='magical'));
  game.combat.impact({source:second,target:enemy,stats:towerStats(second,data)});
  assert.deepEqual(enemy.statuses.poison.applications.map(stack=>stack.time),[...Array(10).fill(4),5]);
  game.tick(4);assert.equal(enemy.statuses.poison.stacks,1);assert.equal(enemy.statuses.poison.applications[0].source,second);
  const before=enemy.hp;game.tick(1);close(before-enemy.hp,6);assert.equal(enemy.statuses.poison,undefined);
});

test('Fire Ballista adds 120 Magical burn/s on a real physical hit; it does not burn a Magical-immune target or stack burn',()=>{
  const game=arena(),source=tower(game,'fireballista'),enemy=foe(game),stats=towerStats(source,data);
  game.combat.impact({source,target:enemy,stats});assert.equal(enemy.statuses.burn.dps,120);assert.equal(enemy.statuses.burn.time,3);
  game.combat.impact({source,target:enemy,stats});assert.equal(enemy.statuses.burn.dps,120);
  const before=enemy.hp;game.tick(1);close(before-enemy.hp,120);
  const immune=foe(game,{magicImmune:true});game.combat.impact({source,target:immune,stats});assert.equal(immune.statuses.burn,undefined);assert.ok(immune.hp<immune.maxHp);
});

test('Golem can proc and petrify a damage-immune foe while its Physical hit remains blocked and hidden targets remain hidden',()=>{
  const game=arena(),source=tower(game,'emeraldgolem'),enemy=foe(game,{magicImmune:true,physicalImmune:true});
  enemy.x=12;enemy.z=13;enemy.route=[{x:12,z:13},{x:12,z:12}];enemy.pathIndex=1;game.rng=()=>0;
  game.combat.impact({source,target:enemy,stats:towerStats(source,data)});assert.equal(enemy.hp,enemy.maxHp);assert.ok(source.stoneGaze);
  game.combat.updateStoneGazes(2);assert.equal(enemy.statuses.petrify.time,3);assert.equal(enemy.statuses.petrify.physicalBonus,1);assert.equal(enemy.statuses.gazeSlow,undefined);
  assert.equal(game.combat.damage(enemy,100,'physical',{},source),0);
});

test('standard haste uses strongest 100%, Archbishop adds its separate500%, and all actual damage channels receive current support/MVP scaling',()=>{
  const game=arena(),source=tower(game,'phoenix',1,{mvpLevel:10}),high=tower(game,'monk'),arch=tower(game,'archbishop'),foreign=tower(game,'soldier',1,{mvpLevel:10});
  tower(game,'cleric',6);tower(game,'dawnspire');
  const bonuses=supportBonuses(source,game.towers,data);assert.equal(bonuses.haste,7);assert.equal(bonuses.damage,2);
  const {stats,multiplier}=combatTowerStats(source,game.towers,data);close(multiplier,3);
  for(const key of ['damage','burnAura','poisonDps','forkedDamage'])close(stats[key],towerStats(source,data)[key]*3);
  high.attackPaused=arch.attackPaused=foreign.attackPaused=true;assert.equal(combatTowerStats(source,game.towers,data).multiplier,3,'Paused ally support and own MVP bonus remain active');
});

test('console rule overrides remain run-local; actual traces expose armor→shell→effectiveHP and blocked attempts without extra RNG',()=>{
  const roster=structuredClone(data);roster.balance.enemyRules={refraction:{period:3},reactive:{maxStacks:7},blink:{period:0}};
  const game=arena(roster),control=arena(),source=tower(game,'archer'),enemy=foe(game,{armor:30,krakenShell:10}),traces=[];
  game.on((type,event)=>{if(type==='damage-trace')traces.push(event);});
  assert.equal(enemyRulesFor(game).refraction.period,3);assert.equal(enemyRulesFor(control).refraction.period,2);assert.equal(ENEMY_RULES.refraction.period,2);assert.equal(enemyRulesFor(game).blink.period,5);
  const before=game.rng();const controlBefore=control.rng();assert.equal(before,controlBefore);
  game.combat.damage(enemy,100,'physical',{directHit:true},source);
  const trace=traces[0];assert.deepEqual([trace.beforeDefense,trace.effectiveArmor,trace.afterArmor,trace.shellBlock,trace.afterShell,trace.effectiveDamage],[100,30,50,10,40,40]);assert.equal(trace.blockReason,null);
  enemy.shields=1;game.combat.damage(enemy,100,'physical',{directHit:true},source);assert.equal(traces[1].blockReason,'shield');assert.equal(traces[1].effectiveDamage,0);
  assert.equal(game.rng(),control.rng(),'Trace rendering uses no RNG');
});
