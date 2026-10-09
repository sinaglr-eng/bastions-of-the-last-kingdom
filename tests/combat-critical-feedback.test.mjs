import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {towerStats} from '../game/core/math.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
function arena(family='roseguard'){
  const game=new Game(data,{seed:42});game.phase='combat';game.combat.spawnQueue=[{time:1e9,type:'grunt'}];
  const source={id:game.nextId++,family,tier:1,state:'active',x:10,z:10,kills:0,cooldown:999};game.towers.push(source);
  const events=[];game.on((type,payload)=>events.push({type,payload}));return {game,source,events};
}
function foe(game,x=11){const enemy=game.combat.spawn('grunt');Object.assign(enemy,{x,z:10,hp:1e6,maxHp:1e6,speed:0,armor:0,resists:{}});return enemy;}
const strikes=events=>events.filter(event=>event.type==='critical-hit').map(event=>event.payload);

test('actual champion crit boundary emits applied damage only, with the existing single RNG roll',()=>{
  for(const [roll,isCritical] of [[.099999,true],[.1,false]]){
    const {game,source,events}=arena(),enemy=foe(game);enemy.armor=data.balance.armorConstant;
    let rolls=0;game.rng=()=>{rolls++;return roll;};
    game.combat.impact({source,target:enemy,stats:towerStats(source,data)});
    const expected=(isCritical?1200:240)/2;
    assert.equal(enemy.hp,1e6-expected);assert.equal(rolls,1);assert.equal(strikes(events).length,isCritical?1:0);
    if(isCritical){const [critical]=strikes(events);assert.equal(critical.enemy,enemy);assert.equal(critical.source,source);
      assert.equal(critical.amount,600);assert.equal(critical.effectiveDamage,600);assert.equal(critical.multiplier,5);
      assert.equal(critical.type,'physical');assert.equal(critical.directHit,true);assert.equal(critical.visible,true);
      assert.ok(events.findIndex(event=>event.type==='hit')<events.findIndex(event=>event.type==='critical-hit'));
    }
  }
});

test('a successful crit roll cannot announce shielded, evaded, immune, shell-absorbed or already dead damage',()=>{
  for(const condition of ['shield','evasion','immunity','shell','dead']){
    const {game,source,events}=arena(),enemy=foe(game);let rolls=0;game.rng=()=>{rolls++;return 0;};
    if(condition==='shield')enemy.shields=1;if(condition==='evasion')enemy.evasion=1;
    if(condition==='immunity')enemy.physicalImmune=true;if(condition==='shell')enemy.krakenShell=2000;
    if(condition==='dead')enemy.dead=true;
    game.combat.impact({source,target:enemy,stats:towerStats(source,data)});
    assert.equal(strikes(events).length,0,condition);assert.equal(enemy.hp,1e6,condition);
    assert.equal(rolls,condition==='evasion'?2:1,condition);
  }
});

test('overkill crit reports effective health removed and credits one actual kill',()=>{
  const {game,source,events}=arena(),enemy=foe(game);enemy.hp=7;game.rng=()=>0;
  game.combat.impact({source,target:enemy,stats:towerStats(source,data)});
  const [critical]=strikes(events);assert.equal(critical.amount,1200);assert.equal(critical.effectiveDamage,7);
  assert.equal(enemy.dead,true);assert.equal(source.kills,1);
  assert.ok(events.findIndex(event=>event.type==='critical-hit')<events.findIndex(event=>event.type==='death'));
});

test('crit-multiplied pure cleave announces its actual victims, including a physical-immune secondary',()=>{
  const {game,source,events}=arena('crownofages'),target=foe(game),secondary=foe(game,11.1),immune=foe(game,11.2),distant=foe(game,50);
  immune.physicalImmune=true;let rolls=0;game.rng=()=>{rolls++;return 0;};
  game.combat.impact({source,target,stats:towerStats(source,data)});
  assert.equal(rolls,1);assert.deepEqual(strikes(events).map(event=>[event.enemy.id,event.amount,event.directHit]),
    [[target.id,13500,true],[secondary.id,6750,false],[immune.id,6750,false]]);
  assert.equal(strikes(events)[2].type,'pure');assert.equal(immune.hp,1e6-6750);assert.equal(distant.hp,1e6);
});

test('ordinary hits and DOT ticks do not inherit a previous impact critical announcement',()=>{
  const {game,source,events}=arena(),enemy=foe(game);game.rng=()=>0;
  game.combat.impact({source,target:enemy,stats:towerStats(source,data)});assert.equal(strikes(events).length,1);
  game.combat.damage(enemy,50,'physical',{},source);
  game.combat.applyEffects(enemy,{damage:10,poisonDps:10,dotDuration:1},source);game.tick(.1);
  assert.equal(strikes(events).length,1);assert.ok(events.some(event=>event.type==='hit'&&event.payload.type==='poison'));
});
