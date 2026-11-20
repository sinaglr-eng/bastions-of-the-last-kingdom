import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {Game} from '../game/core/game.js';
import {damageAfterDefense,towerStats} from '../game/core/math.js';
import {SupportEffects,ENEMY_EFFECT_STYLES,SUPPORT_EFFECT_STYLES,enemyStatusState,towerSupportState} from '../game/render/support-effects.js';
import {supportGlyph,supportMapLegendMarkup,SUPPORT_EFFECT_DESCRIPTIONS} from '../ui/support-guide.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const unit=(family,id,tier=1,x=20)=>({family,id,tier,state:'active',x,z:20,kills:0,cooldown:999});
function arena(towers){
  const game=new Game(data,{seed:7});game.phase='combat';game.towers=towers;game.combat.spawnQueue=[{time:9999,type:'grunt'}];
  const enemy=game.combat.spawn('grunt');Object.assign(enemy,{x:21,z:20,hp:1e6,maxHp:1e6,speed:0,armor:10});
  return {game,enemy};
}

test('all six Engineer ranks show enemy armor reduction independently of actual barricade attack-speed disruption',()=>{
  const dataBefore=JSON.stringify(data);
  for(let tier=1;tier<=6;tier++){
    const engineer=unit('runebreaker',1,tier),defender=unit('archer',2),ruin={...unit('soldier',3,1,20.5),state:'ruin',weakened:10};
    const {game,enemy}=arena([engineer,defender,ruin]),stats=towerStats(engineer,data);
    const fx=new SupportEffects(new THREE.Scene(),{isVisible:enemy=>game.combat.isRevealed(enemy)});
    try{
      game.combat.impact({target:enemy,stats,source:engineer});game.combat.update(0);
      assert.equal(enemy.statuses.shred.amount,stats.shred);assert.equal(enemy.statuses.shred.time,4);
      assert.equal(enemy.statuses.shred.source,engineer);assert.equal(enemy.armorShred,stats.shred);
      const expected=damageAfterDefense(100,'physical',enemy,{},data.balance);
      assert.equal(game.combat.damage(enemy,100,'physical',{},defender),expected);
      const beforeRender=JSON.stringify({enemy,towers:game.towers});
      fx.sync(game.towers,data,{combat:game.combat,phase:game.phase});
      assert.equal(JSON.stringify({enemy,towers:game.towers}),beforeRender,'Rendering never changes armor, status duration or cooldowns');
      assert.equal(fx.batches.get('enemy:armor').count,1);assert.equal(fx.batches.get('weakened').count,2);
      assert.equal(fx.enemyStates.get(enemy.id).find(effect=>effect.key==='armor').glyph,'brokenShield');
      const penalty=towerSupportState(defender,game.towers,data,{combat:game.combat}).byKey.weakened;
      assert.ok(Math.abs(penalty.value-.15)<1e-12);assert.equal(penalty.glyph,'crack');assert.deepEqual(penalty.sourceIds,[ruin.id]);
      assert.equal(towerSupportState(defender,game.towers,data,{combat:game.combat}).byKey.armor,undefined);
      const cooldown=defender.cooldown;game.tick(.1);assert.ok(Math.abs(cooldown-defender.cooldown-.085)<1e-10);
      game.tick(3.89);assert.ok(enemy.statuses.shred.time>0);fx.sync(game.towers,data,{combat:game.combat,phase:game.phase});assert.equal(fx.batches.get('enemy:armor').count,1);
      game.paused=true;const elapsed=game.combat.elapsed,remaining=enemy.statuses.shred.time;game.tick(10);
      assert.equal(game.combat.elapsed,elapsed);assert.equal(enemy.statuses.shred.time,remaining);
      game.paused=false;game.tick(.02);fx.sync(game.towers,data,{combat:game.combat,phase:game.phase});
      assert.equal(enemy.statuses.shred,undefined);assert.equal(enemy.armorShred,0);assert.equal(fx.batches.get('enemy:armor').count,0);
      assert.equal(fx.batches.get('weakened').count,2,'The separate real barricade penalty remains active after armor reduction expires');
    }finally{fx.dispose();}
  }
  assert.equal(JSON.stringify(data),dataBefore);
});

test('the same armor symbol covers actual in-range armor auras and never exposes hidden enemies',()=>{
  const source=unit('mechanicalgolem',1),{game,enemy}=arena([source]),stats=towerStats(source,data);
  const fx=new SupportEffects(new THREE.Scene(),{isVisible:enemy=>game.combat.isRevealed(enemy)});
  try{
    enemy.x=source.x+stats.effectRange;game.combat.update(0);
    assert.equal(enemyStatusState(enemy,game.towers,data).find(effect=>effect.key==='armor').value,enemy.armorShred);
    assert.equal(enemy.armorShred,stats.armorShredAura);fx.sync(game.towers,data,{combat:game.combat,phase:game.phase});assert.equal(fx.batches.get('enemy:armor').count,1);
    enemy.x+=.001;game.combat.update(0);assert.equal(enemy.armorShred,0);fx.sync(game.towers,data,{combat:game.combat,phase:game.phase});assert.equal(fx.batches.get('enemy:armor').count,0);
    enemy.x=source.x+3;game.combat.update(0);assert.equal(enemy.armorShred,stats.armorShredAura);
    enemy.cloaked=true;fx.sync(game.towers,data,{combat:game.combat,phase:game.phase});assert.equal(game.combat.isRevealed(enemy),false);
    assert.equal(fx.batches.get('enemy:armor').count,0);assert.equal(fx.enemyStates.has(enemy.id),false);
    enemy.cloaked=false;source.state='draft';game.combat.update(0);fx.sync(game.towers,data,{combat:game.combat,phase:game.phase});
    assert.equal(enemy.armorShred,0);assert.equal(fx.batches.get('enemy:armor').count,0);
  }finally{fx.dispose();}
});

test('actual armor glyph is a fractured shield, distinct from the barricade mesh and correctly explained in the accessible legend',()=>{
  const fx=new SupportEffects(new THREE.Scene());
  try{
    const armor=fx.batches.get('enemy:armor'),barricade=fx.batches.get('weakened');
    assert.equal(ENEMY_EFFECT_STYLES.armor.glyph,'brokenShield');assert.equal(SUPPORT_EFFECT_STYLES.weakened.glyph,'crack');
    assert.match(armor.userData.artwork,/status-fractured-shield\.webp$/);
    assert.match(barricade.userData.artwork,/status-broken-barricade\.webp$/);
    for(const mesh of [armor,barricade])assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite));
    assert.ok(supportGlyph('brokenShield',ENEMY_EFFECT_STYLES.armor.color).includes(armor.userData.artwork));
    assert.ok(supportGlyph('crack',SUPPORT_EFFECT_STYLES.weakened.color).includes(barricade.userData.artwork));
    const legend=supportMapLegendMarkup(),item=key=>legend.match(new RegExp(`<li[^>]*data-effect="${key}"[\\s\\S]*?</li>`))[0];
    assert.match(legend,/aria-label="Defender effect symbols"/);assert.match(legend,/aria-label="Enemy effect symbols"/);
    assert.match(item('armor'),/Enemy armor reduced/);assert.match(item('armor'),/data-glyph="brokenShield"/);assert.match(item('armor'),/tabindex="0"/);assert.match(item('armor'),/role="tooltip"/);
    assert.ok(item('armor').includes(SUPPORT_EFFECT_DESCRIPTIONS.armor));assert.match(item('armor'),/Engineer hits/);assert.match(item('armor'),/armor-reducing aura/);
    assert.doesNotMatch(item('armor'),/Barricade disruption|15%/);
    assert.match(item('weakened'),/Barricade disruption/);assert.match(item('weakened'),/data-glyph="crack"/);assert.match(item('weakened'),/2 tiles.*15%/);
  }finally{fx.dispose();}
});
