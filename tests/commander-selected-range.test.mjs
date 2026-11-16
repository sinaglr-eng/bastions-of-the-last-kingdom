import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../game/core/game.js';
import {currentFactionData} from '../game/core/current-data.js';
import {serializeRun,restoreRun} from '../game/core/run-state.js';
import {replayCommands} from '../game/core/run-journal.js';
import {towerStats,combatTowerStats,supportBonuses,offensiveAuraRange} from '../game/core/math.js';

const factions=['crown','forge','grove'],positions=[[18,18],[17,18],[19,18],[18,17],[18,19]];
const same=(a,b)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
function draft(){const g=new Game(currentFactionData('crown'),{seed:71,loadout:{'field-promotion':3}});g.commandPoints.value=20;for(const [x,z]of positions)assert.equal(g.place(x,z),true);return g;}
function arena(faction,family,rank=3){
 const g=new Game(currentFactionData(faction),{seed:89,loadout:{'extended-range':rank}});g.phase='combat';g.combat.spawnQueue=[{time:1e9,type:'host_01'}];g.economy.gold=1000;
 const tower={id:g.nextId++,family,tier:1,state:'active',x:18,z:18,cooldown:0,kills:0,mvpLevel:0,priority:'first'};g.towers.push(tower);return{g,tower};
}
function foe(g,x,z,props={}){return Object.assign(g.combat.spawn('host_01'),{x,z,hp:1e8,maxHp:1e8,armor:0,physicalImmune:false,magicImmune:false,evasion:0,boss:false,regen:0,speed:0,shields:0,krakenShell:0,statuses:{},cloaked:false,stealth:false,traveled:10,pathLength:1000,route:[{x,z},{x:x+100,z}],pathIndex:1,...props});}

test('selected promotion rejects missing, stale, malformed, foreign and retained targets without charging or rolling',()=>{
 const g=draft(),target=g.selection,before=g.rng.getState();
 g.towers.push({id:999,family:'soldier',tier:1,state:'active',round:0,x:2,z:2});
 for(const id of [undefined,null,'5',0,-1,1.5,{},Number.MAX_SAFE_INTEGER+1,999,1000,g.towers[0].id]){
  const cp=g.commandPoints.value,uses=g.general.remainingUses('field-promotion');assert.equal(g.activateGeneral('field-promotion',id),false,String(id));assert.equal(g.commandPoints.value,cp);assert.equal(g.general.remainingUses('field-promotion'),uses);
 }
 assert.equal(g.general.promotionState().target.towerId,target.id);assert.equal(g.general.promotionState().selectedTowerId,target.id);
 assert.equal(g.activateGeneral('field-promotion',target.id),true);assert.equal(g.rng.getState(),before);
 g.select(g.towers[1].id);assert.equal(g.activateGeneral('field-promotion',target.id),false);assert.equal(g.commandPoints.value,17);
});

test('legacy global promotion saves retain committed ranks and uses but lose the obsolete reroll modifier',()=>{
 const g=draft();g.activateGeneral('field-promotion',g.selected);g.general.promotedDraft={round:g.round,cap:6};g.draft.promotionRankCap=6;
 const target=g.selection,h=restoreRun(g.data,JSON.parse(JSON.stringify(serializeRun(g))));
 assert.equal(h.towers.find(t=>t.id===target.id).tier,target.tier);assert.equal(h.towers.find(t=>t.id===target.id).fieldPromoted,true);assert.equal(h.general.uses['field-promotion'],1);assert.equal(h.general.promotedDraft,undefined);assert.equal(h.draft.promotionRankCap,undefined);
 h.draft.roundForced={family:'archer',tier:2};assert.equal(h.reroll(),true);assert.ok(h.towers.every(t=>t.tier===2&&!t.fieldPromoted));assert.equal(h.general.uses['field-promotion'],1);
});

test('Extended Range validates gold and combat phase, spends exactly 200 gold once per wave with no CP or RNG',()=>{
 for(const rank of [1,2,3]){
  const {g}=arena('crown','archer',rank),rng=g.rng.getState(),cp=g.commandPoints.value;let event;
  g.on((type,payload)=>{if(type==='general-range')event=payload;});
  for(const phase of ['build','select','ready','reward','won','lost']){g.phase=phase;assert.equal(g.activateGeneral('extended-range'),false);assert.equal(g.economy.gold,1000);}g.phase='combat';
  g.economy.gold=199;assert.equal(g.activateGeneral('extended-range'),false);assert.equal(g.economy.gold,199);assert.equal(g.general.rangeBonus,0);
  g.economy.gold=200;assert.equal(g.activateGeneral('extended-range'),true);assert.equal(g.economy.gold,0);assert.equal(g.commandPoints.value,cp);assert.equal(g.rng.getState(),rng);assert.equal(g.general.rangeBonus,[1,1.5,2][rank-1]);
  assert.deepEqual(event,{id:'extended-range',round:1,bonus:[1,1.5,2][rank-1],cost:200,currency:'gold'});assert.equal(g.general.rangeState().used,true);assert.equal(g.general.rangeState().active,true);
  g.economy.gold=1000;assert.equal(g.activateGeneral('extended-range'),false);assert.equal(g.economy.gold,1000);
  g.phase='reward';assert.equal(g.general.rangeBonus,0);g.nextRound();g.phase='combat';assert.equal(g.general.rangeBonus,0);assert.equal(g.general.rangeState().used,false);assert.equal(g.activateGeneral('extended-range'),true);assert.equal(g.economy.gold,800);
 }
 const guest=new Game(currentFactionData('crown'));guest.phase='combat';assert.equal(guest.activateGeneral('extended-range'),false);
 const {g}=arena('crown','archer');g.developerMode=true;assert.equal(g.activateGeneral('extended-range'),false);assert.equal(g.economy.gold,1000);
});

test('all 258 current profiles gain exactly the Commander attack-range bonus, without changing damage, weapons or aura footprints',()=>{
 let count=0;
 for(const faction of factions){
  const data=currentFactionData(faction),original=JSON.stringify(data),g=new Game(data,{loadout:{'extended-range':2}});g.phase='combat';
  for(const [family,definition]of Object.entries(data.towers))for(const tier of definition.advanced?[1]:[1,2,3,4,5,6]){
   const tower={id:1,family,tier,state:'active',x:18,z:18};g.towers.length=0;g.towers.push(tower);g.general.waveRange=null;
   const before=combatTowerStats(tower,g.towers,data),support=supportBonuses(tower,g.towers,data);g.general.waveRange={round:g.round,bonus:1.5};const after=combatTowerStats(tower,g.towers,data);
   assert.equal(after.stats.range,before.stats.range+1.5,`${faction}/${family}/${tier}`);assert.equal(after.bonuses.commanderRange,1.5);assert.equal(after.bonuses.range,before.bonuses.range);same(supportBonuses(tower,g.towers,data),support);
   for(const kind of ['burn','slow','armor'])if(before.stats[{burn:'burnAura',slow:'slowAura',armor:'armorShredAura'}[kind]])assert.equal(offensiveAuraRange(after.stats,kind),offensiveAuraRange(before.stats,kind));
   const a=structuredClone(before.stats),b=structuredClone(after.stats);delete a.range;delete b.range;
   if(a.continuousAttack){assert.equal(after.stats.continuousAttack.range,after.stats.range);delete a.continuousAttack.range;delete b.continuousAttack.range;}
   for(const key of ['burnAuraRange','slowAuraRange','effectRange'])if(a[key]===undefined)delete b[key];same(a,b);
   tower.state='draft';assert.equal(combatTowerStats(tower,g.towers,data).stats.range,towerStats(tower,data).range);count++;
  }
  assert.equal(JSON.stringify(data),original);
 }
 assert.equal(count,258);
});

for(const [faction,family]of [['crown','archer'],['forge','dw_musketeer'],['grove','el_grove_archer'],['forge','dw_steamharpooner'],['grove','el_baby_fire_dragon'],['grove','el_mother_fire_dragon']])test(`Extended Range lets actual ${faction}/${family} attacks hit beyond native range`,()=>{
 const {g,tower}=arena(faction,family),base=combatTowerStats(tower,g.towers,g.data).stats,enemy=foe(g,tower.x+base.range+1,tower.z);
 g.advanceTicks(30);assert.equal(enemy.hp,enemy.maxHp,'Native attacks cannot reach this enemy');assert.equal(g.activateGeneral('extended-range'),true);g.advanceTicks(90);assert.ok(enemy.hp<enemy.maxHp,'The current wave bonus must affect the real target and attack path');
});

test('extended cones retain angle and fire-aura radius while reaching distant primary targets',()=>{
 const {g,tower}=arena('grove','el_mother_fire_dragon'),base=towerStats(tower,g.data),distance=base.range+1,half=base.continuousAttack.angleDegrees*Math.PI/360;
 const center=foe(g,tower.x+distance,tower.z,{traveled:500}),outside=foe(g,tower.x+Math.cos(half+.2)*distance,tower.z+Math.sin(half+.2)*distance,{traveled:0});
 const aura=base.abilities.find(a=>a.familyId==='fire-aura'),auraOutside=foe(g,tower.x-(aura.radius+.25),tower.z,{traveled:0});
 assert.equal(g.activateGeneral('extended-range'),true);g.advanceTicks(30);assert.ok(center.hp<center.maxHp);assert.equal(outside.hp,outside.maxHp);assert.equal(auraOutside.hp,auraOutside.maxHp);assert.equal(auraOutside.statuses.burn,undefined);
});

test('Extended Range survives a midwave save, replays deterministic commands, and expires at completion and campaign continuation',()=>{
 const data=currentFactionData('crown'),g=new Game(data,{seed:73,loadout:{'extended-range':2,'field-promotion':3,'quartermaster':1}}),initial=serializeRun(g);
 for(const [x,z]of positions)g.place(x,z);g.activateGeneral('field-promotion',g.selected);g.keep();g.startCombat();assert.equal(g.activateGeneral('extended-range'),true);g.advanceTicks(60,{record:true});
 const snapshot=serializeRun(g),restored=restoreRun(data,JSON.parse(JSON.stringify(snapshot)));same(serializeRun(restored),snapshot);assert.equal(restored.general.rangeBonus,1.5);assert.equal(restored.activateGeneral('extended-range'),false);
 const replay=restoreRun(data,initial);replayCommands(replay,g.journal);same(serializeRun(replay),snapshot);
 g.advanceTicks(60);restored.advanceTicks(60);same(serializeRun(restored),serializeRun(g));g.round=50;g.general.waveRange.round=50;g.completeWave();assert.equal(g.round,51);assert.equal(g.general.rangeBonus,0);assert.equal(g.general.waveRange,null);
});
