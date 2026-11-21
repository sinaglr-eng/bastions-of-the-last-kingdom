import test from 'node:test';
import assert from 'node:assert/strict';
import {currentFactionData} from '../game/core/current-data.js';
import {Game} from '../game/core/game.js';
import {towerStats} from '../game/core/math.js';
import {attackTargetAllowed} from '../game/core/combat-rules.js';
import {serializeRun,restoreRun} from '../game/core/run-state.js';
import {replayCommands} from '../game/core/run-journal.js';

for(const faction of ['crown','forge','grove']){
 test(`visible flying target receives scheduled damage from every eligible ${faction} rank`,()=>{
  const data=currentFactionData(faction);
  let checked=0;
  for(const [family,unit] of Object.entries(data.towers))for(let tier=1;tier<=(unit.advanced?1:6);tier++){
   const game=new Game(data,{seed:19}),combat=game.combat;
   const tower={id:game.nextId++,family,tier,state:'active',x:10,z:10,kills:0,cooldown:0,mvpLevel:0};
   game.phase='combat';
   game.towers.push(tower);
   combat.spawnQueue=[{time:1000,type:'grunt'}];
   const flyer=Object.assign(combat.spawn('grunt'),{x:11,z:10,speed:0,hp:1e8,maxHp:1e8,armor:0,
    flying:true,resists:{},evasion:0,shields:0,physicalImmune:false,magicImmune:false,regen:0,route:[{x:100,z:10}],pathIndex:0});
   const eligible=faction!=='crown'||!['soldier','winterhold'].includes(family);
   const label=`${unit.name} rank ${tier}`;
   assert.equal(attackTargetAllowed(towerStats(tower,data),flyer),eligible,label);
   for(let step=0;step<160&&flyer.hp===flyer.maxHp;step++)game.tick(.05);
   assert.equal(flyer.hp<flyer.maxHp,eligible,label);
   if(faction==='grove'){
    const ground=Object.assign(combat.spawn('grunt'),{x:11,z:10,speed:0,hp:1e8,maxHp:1e8,armor:0,
     flying:false,resists:{},evasion:0,shields:0,physicalImmune:false,magicImmune:false,regen:0,route:[{x:100,z:10}],pathIndex:0});
    flyer.dead=true;
    for(let step=0;step<160&&ground.hp===ground.maxHp;step++)game.tick(.05);
    assert.ok(ground.hp<ground.maxHp,label+' can hit ground too');
   }
   checked++;
  }
  assert.equal(checked,86);
 });
}

test('Elf targeting is frozen across legacy and current save/replay',()=>{
 const current=currentFactionData('grove');
 for(const enabled of [false,true]){
  const data=currentFactionData('grove',{elfAirTargeting:enabled});
  const saved=serializeRun(new Game(data,{seed:7}));
  assert.equal(saved.elfAirTargeting,enabled||undefined);
  const resumed=restoreRun(current,saved);
  assert.equal(attackTargetAllowed(towerStats({family:'el_moonblade',tier:1},resumed.data),{flying:true}),enabled);
  assert.deepEqual(serializeRun(resumed),saved);
 }
});

test('Stag Bulwark starts hitting flyers after a verified legacy-save targeting boundary',()=>{
 const legacy=currentFactionData('grove',{elfAirTargeting:false}),game=new Game(legacy,{seed:19});
 const tower={id:game.nextId++,family:'el_stag_knight',tier:1,state:'active',x:10,z:10,kills:0,cooldown:0,mvpLevel:0};
 game.towers.push(tower);
 game.phase='combat';
 game.combat.spawnQueue=[{time:1000,type:'grunt'}];
 const flyer=Object.assign(game.combat.spawn('grunt'),{x:11,z:10,flying:true,speed:0,hp:1e8,maxHp:1e8,route:[{x:100,z:10}],pathIndex:0});
 replayCommands(game,[{action:'advance',ticks:120}]);
 assert.equal(flyer.hp,flyer.maxHp);
 const saved=serializeRun(game);
 const restored=restoreRun(currentFactionData('grove'),saved);
 assert.equal(restored.adoptElfAirTargeting(),true);
 assert.deepEqual(restored.journal,[{action:'adoptElfAirTargeting',args:[]}]);
 replayCommands(game,[...restored.journal,{action:'advance',ticks:240}]);
 replayCommands(restored,[{action:'advance',ticks:240}]);
 assert.ok(flyer.hp<flyer.maxHp);
 assert.deepEqual(serializeRun(restored),serializeRun(game));
});
